import React, { useEffect, useState } from 'react';
import { vehiclesAPI } from '../api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Truck, Plus, Edit, QrCode, Download, Trash2, AlertTriangle, Calendar, Clock } from 'lucide-react';
import VehicleKmReport from './VehicleKmReport';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';

// Sonraki muayene tarihini hesapla (1 yıl sonra)
const getNextInspectionDate = (lastInspection) => {
  if (!lastInspection) return null;
  const date = new Date(lastInspection);
  date.setFullYear(date.getFullYear() + 1);
  return date;
};

// Kalan gün sayısını hesapla
const getDaysUntilInspection = (lastInspection) => {
  const nextDate = getNextInspectionDate(lastInspection);
  if (!nextDate) return null;
  const today = new Date();
  const diffTime = nextDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Muayene durumu rengini belirle
const getInspectionStatus = (daysRemaining) => {
  if (daysRemaining === null) return null;
  if (daysRemaining <= 0) return { color: 'bg-red-500 text-white', label: 'Süresi Geçti!' };
  if (daysRemaining <= 30) return { color: 'bg-red-100 text-red-700', label: `${daysRemaining} gün kaldı` };
  if (daysRemaining <= 60) return { color: 'bg-yellow-100 text-yellow-700', label: `${daysRemaining} gün kaldı` };
  return { color: 'bg-green-100 text-green-700', label: `${daysRemaining} gün kaldı` };
};

// Bakım kilometresi durumunu belirle
const getMaintenanceKmStatus = (currentKm, nextMaintenanceKm) => {
  if (!nextMaintenanceKm || nextMaintenanceKm === 0) return null;
  const remainingKm = nextMaintenanceKm - currentKm;
  if (remainingKm <= 0) return { color: 'bg-red-500 text-white', label: 'Bakım Zamanı!', km: 0 };
  if (remainingKm <= 1000) return { color: 'bg-red-100 text-red-700', label: 'Bakım Yaklaşıyor', km: remainingKm };
  if (remainingKm <= 2000) return { color: 'bg-yellow-100 text-yellow-700', label: 'Bakım Yaklaşıyor', km: remainingKm };
  return null; // 2000'den fazla ise gösterme
};

const Vehicles = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);
  const [formData, setFormData] = useState({
    plate: '',
    type: 'ambulans',
    km: 0,
    fuel_level: 100,
    status: 'musait',
    last_inspection_date: '',
    next_maintenance_km: 0
  });

  // Yetki kontrolleri
  const canViewVehicles = ['operasyon_muduru', 'merkez_ofis', 'bas_sofor'].includes(user?.role);
  const canManageVehicles = ['operasyon_muduru', 'merkez_ofis', 'bas_sofor'].includes(user?.role);
  const canViewKmReport = ['operasyon_muduru', 'merkez_ofis', 'bas_sofor'].includes(user?.role);
  
  // Erişim kontrolü
  if (!canViewVehicles) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Erişim Reddedildi</h2>
        <p className="text-gray-600">Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vehiclesRes, statsRes] = await Promise.all([
        vehiclesAPI.getAll(),
        vehiclesAPI.getStats()
      ]);
      setVehicles(vehiclesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      toast.error('Araçlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await vehiclesAPI.create(formData);
      toast.success('Araç başarıyla oluşturuldu');
      setDialogOpen(false);
      setFormData({ plate: '', type: 'ambulans', km: 0, fuel_level: 100, status: 'musait', last_inspection_date: '', next_maintenance_km: 0 });
      setEditMode(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Araç oluşturulamadı');
    }
  };

  const handleUpdate = async () => {
    try {
      const vehicleId = selectedVehicle.id || selectedVehicle._id;
      console.log('Updating vehicle ID:', vehicleId);
      console.log('Form data:', formData);
      
      if (!vehicleId) {
        toast.error('Araç ID bulunamadı');
        return;
      }
      
      await vehiclesAPI.update(vehicleId, formData);
      toast.success('Araç güncellendi');
      setDialogOpen(false);
      setEditMode(false);
      setSelectedVehicle(null);
      loadData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.response?.data?.detail || 'Araç güncellenemedi');
    }
  };

  const handleDelete = async () => {
    if (!vehicleToDelete) return;
    
    const vehicleId = vehicleToDelete.id || vehicleToDelete._id;
    
    try {
      await vehiclesAPI.delete(vehicleId);
      toast.success('Araç silindi');
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
      loadData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.response?.data?.detail || 'Araç güncellenemedi');
    }
  };

  const openEditDialog = (vehicle) => {
    console.log('Opening edit for vehicle:', vehicle);
    console.log('Vehicle ID:', vehicle.id, 'Vehicle _id:', vehicle._id);
    setSelectedVehicle(vehicle);
    setFormData({
      plate: vehicle.plate,
      type: vehicle.type,
      km: vehicle.km,
      fuel_level: vehicle.fuel_level || 100,
      status: vehicle.status,
      last_inspection_date: vehicle.last_inspection_date ? new Date(vehicle.last_inspection_date).toISOString().split('T')[0] : '',
      next_maintenance_km: vehicle.next_maintenance_km || 0
    });
    setEditMode(true);
    setDialogOpen(true);
  };

  const statusColors = {
    musait: 'bg-green-100 text-green-800',
    gorevde: 'bg-blue-100 text-blue-800',
    bakimda: 'bg-yellow-100 text-yellow-800',
    arizali: 'bg-red-100 text-red-800',
    kullanim_disi: 'bg-gray-100 text-gray-800'
  };

  const statusLabels = {
    musait: 'Müsait',
    gorevde: 'Görevde',
    bakimda: 'Bakımda',
    arizali: 'Arızalı',
    kullanim_disi: 'Kullanım Dışı'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="vehicles-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Araçlar</h1>
          <p className="text-gray-500">Araç filosu yönetimi</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Araç Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Araç Düzenle' : 'Yeni Araç Ekle'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plaka *</Label>
                  <Input
                    value={formData.plate}
                    onChange={(e) => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                    placeholder="34 ABC 123"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Araç Tipi *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambulans">Ambulans</SelectItem>
                      <SelectItem value="arac">Araç</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Durum</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="musait">Müsait</SelectItem>
                    <SelectItem value="gorevde">Görevde</SelectItem>
                    <SelectItem value="bakimda">Bakımda</SelectItem>
                    <SelectItem value="arizali">Arızalı</SelectItem>
                    <SelectItem value="kullanim_disi">Kullanım Dışı</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kilometre</Label>
                  <Input
                    type="number"
                    value={formData.km}
                    onChange={(e) => setFormData({...formData, km: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yakıt Seviyesi (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.fuel_level}
                    onChange={(e) => setFormData({...formData, fuel_level: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Son Muayene Tarihi</Label>
                  <Input
                    type="date"
                    value={formData.last_inspection_date}
                    onChange={(e) => setFormData({...formData, last_inspection_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sonraki Bakım KM</Label>
                  <Input
                    type="number"
                    value={formData.next_maintenance_km}
                    onChange={(e) => setFormData({...formData, next_maintenance_km: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              {editMode && selectedVehicle?.qr_code && (
                <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                  <Label>QR Kod</Label>
                  <div className="flex flex-col items-center p-4 bg-white rounded space-y-3">
                    <QRCodeCanvas 
                      value={selectedVehicle.qr_code} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                    <p className="font-mono text-sm">{selectedVehicle.qr_code}</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const canvas = document.querySelector('canvas');
                        const url = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.download = `${selectedVehicle.plate}-QR.png`;
                        link.href = url;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      QR İndir
                    </Button>
                  </div>
                </div>
              )}

              <div className={`flex ${editMode && canManageVehicles ? 'justify-between' : 'justify-end'} space-x-2`}>
                {editMode && canManageVehicles && (
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      setVehicleToDelete(selectedVehicle);
                      setDialogOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Aracı Sil
                  </Button>
                )}
                <Button 
                  onClick={editMode ? handleUpdate : handleCreate} 
                  className="flex-1 max-w-xs"
                >
                  {editMode ? 'Güncelle' : 'Araç Oluştur'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className={`grid w-full max-w-md ${canViewKmReport ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="list">Araç Listesi</TabsTrigger>
          {canViewKmReport && (
            <TabsTrigger value="km-report">KM Raporu</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total || 0}</p>
              <p className="text-sm text-gray-500">Toplam</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.available || 0}</p>
              <p className="text-sm text-gray-500">Müsait</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.on_duty || 0}</p>
              <p className="text-sm text-gray-500">Görevde</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.maintenance || 0}</p>
              <p className="text-sm text-gray-500">Bakımda</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.faulty || 0}</p>
              <p className="text-sm text-gray-500">Arızalı</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicles List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id} data-testid={`vehicle-${vehicle.plate}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Truck className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-bold text-lg">{vehicle.plate}</p>
                    <p className="text-sm text-gray-500 capitalize">{vehicle.type}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <Badge className={statusColors[vehicle.status]}>
                    {statusLabels[vehicle.status]}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openEditDialog(vehicle)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Düzenle
                  </Button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">KM:</span> {vehicle.km.toLocaleString()}</p>
                {vehicle.fuel_level !== null && (
                  <p><span className="font-medium">Yakıt:</span> %{vehicle.fuel_level}</p>
                )}
                <p className="flex items-center space-x-1 text-xs text-gray-500">
                  <QrCode className="h-3 w-3" />
                  <span className="font-mono">{vehicle.qr_code}</span>
                </p>
              </div>
              
              {/* Son Muayene Tarihi - Her zaman göster */}
              {vehicle.last_inspection_date && (() => {
                const daysRemaining = getDaysUntilInspection(vehicle.last_inspection_date);
                const status = getInspectionStatus(daysRemaining);
                const nextDate = getNextInspectionDate(vehicle.last_inspection_date);
                const lastDate = new Date(vehicle.last_inspection_date);
                
                // Eğer 60 günden fazla varsa yeşil, yoksa mevcut renk
                const bgColor = daysRemaining > 60 ? 'bg-green-100 text-green-700' : (status?.color || 'bg-gray-100 text-gray-700');
                
                return (
                  <div className={`mt-3 p-2 rounded-lg ${bgColor} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs font-medium">Son Muayene</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{lastDate.toLocaleDateString('tr-TR')}</p>
                      {status && daysRemaining !== null && (
                        <p className="text-xs opacity-75">{status.label}</p>
                      )}
                    </div>
                  </div>
                );
              })()}
              
              {/* Bakım Kilometresi Uyarısı */}
              {(() => {
                const kmStatus = getMaintenanceKmStatus(vehicle.km, vehicle.next_maintenance_km);
                if (kmStatus) {
                  return (
                    <div className={`mt-2 p-2 rounded-lg ${kmStatus.color} flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs font-medium">Bakım KM</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">{kmStatus.label}</p>
                        <p className="text-xs opacity-75">
                          {kmStatus.km.toLocaleString()} km kaldı
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </CardContent>
          </Card>
        ))}
          </div>
        </TabsContent>

        {canViewKmReport && (
          <TabsContent value="km-report" className="mt-6">
            <VehicleKmReport />
          </TabsContent>
        )}
      </Tabs>

      {/* Silme Onay Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Aracı Sil</span>
            </DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Araç kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              <strong>{vehicleToDelete?.plate}</strong> plakalı aracı silmek istediğinize emin misiniz?
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Aracı Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vehicles;
