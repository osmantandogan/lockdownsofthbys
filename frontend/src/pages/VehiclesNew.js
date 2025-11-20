import React, { useEffect, useState } from 'react';
import { vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Truck, AlertTriangle, Calendar, Users, Plus, Edit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const VehiclesNew = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState({});
  const [dailyAssignments, setDailyAssignments] = useState([]);
  const [monthlyCalendar, setMonthlyCalendar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [formData, setFormData] = useState({
    plate: '',
    type: 'ambulans',
    km: 0,
    fuel_level: 50,
    last_inspection_date: '',
    next_maintenance_km: 20000
  });

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedMonth]);

  const loadData = async () => {
    try {
      const [vehiclesRes, statsRes, dailyRes, monthlyRes] = await Promise.all([
        vehiclesAPI.getAll(),
        vehiclesAPI.getStats(),
        vehiclesAPI.getDailyAssignments(selectedDate),
        vehiclesAPI.getMonthlyCalendar(selectedMonth.year, selectedMonth.month)
      ]);
      setVehicles(vehiclesRes.data);
      setStats(statsRes.data);
      setDailyAssignments(dailyRes.data);
      setMonthlyCalendar(monthlyRes.data);
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
      toast.success('Araç oluşturuldu');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Araç oluşturulamadı');
    }
  };

  const handleUpdate = async () => {
    try {
      await vehiclesAPI.update(selectedVehicle.id, formData);
      toast.success('Araç güncellendi');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Araç güncellenemedi');
    }
  };

  const openEditDialog = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      plate: vehicle.plate,
      type: vehicle.type,
      km: vehicle.km,
      fuel_level: vehicle.fuel_level || 50,
      last_inspection_date: vehicle.last_inspection_date ? new Date(vehicle.last_inspection_date).toISOString().split('T')[0] : '',
      next_maintenance_km: vehicle.next_maintenance_km || 20000
    });
    setEditMode(true);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setEditMode(false);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      plate: '',
      type: 'ambulans',
      km: 0,
      fuel_level: 50,
      last_inspection_date: '',
      next_maintenance_km: 20000
    });
    setSelectedVehicle(null);
    setEditMode(false);
  };

  const calculateKmRemaining = (currentKm, nextMaintenanceKm) => {
    if (!nextMaintenanceKm) return null;
    return nextMaintenanceKm - currentKm;
  };

  const calculateInspectionDaysRemaining = (lastInspectionDate) => {
    if (!lastInspectionDate) return null;
    const last = new Date(lastInspectionDate);
    const oneYearLater = new Date(last);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const diffTime = oneYearLater - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getMaintenanceAlert = (vehicle) => {
    const kmRemaining = calculateKmRemaining(vehicle.km, vehicle.next_maintenance_km);
    const daysRemaining = calculateInspectionDaysRemaining(vehicle.last_inspection_date);
    
    if (kmRemaining !== null && kmRemaining <= 2000) {
      return { type: 'km', message: `${kmRemaining} KM kaldı`, color: 'bg-red-100 text-red-800' };
    }
    
    if (daysRemaining !== null && daysRemaining <= 60 && daysRemaining > 0) {
      return { type: 'inspection', message: `${daysRemaining} gün kaldı`, color: 'bg-yellow-100 text-yellow-800' };
    }
    
    if (daysRemaining !== null && daysRemaining <= 0) {
      return { type: 'overdue', message: 'Muayene gecikti!', color: 'bg-red-100 text-red-800' };
    }
    
    return null;
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

  const roleLabels = {
    sofor: 'Şoför',
    bas_sofor: 'Baş Şoför',
    paramedik: 'Paramedik',
    att: 'ATT'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Group daily assignments by vehicle
  const assignmentsByVehicle = dailyAssignments.reduce((acc, assignment) => {
    if (!acc[assignment.vehicle_id]) {
      acc[assignment.vehicle_id] = [];
    }
    acc[assignment.vehicle_id].push(assignment);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="vehicles-page">
      <div>
        <h1 className="text-3xl font-bold">Araç Yönetimi</h1>
        <p className="text-gray-500">Filo takibi ve vardiya planlaması</p>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Araç Ekle
          </Button>
        </div>
      )}

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

      <Tabs defaultValue="vehicles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vehicles">Araç Listesi</TabsTrigger>
          <TabsTrigger value="daily">Bugünkü Vardiyalar</TabsTrigger>
          <TabsTrigger value="monthly">Aylık Takvim</TabsTrigger>
        </TabsList>

        {/* Vehicle List - Excel Format */}
        <TabsContent value="vehicles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Araç Takip Tablosu</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Araç Plakası</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Güncel KM</TableHead>
                    <TableHead>Son Muayene</TableHead>
                    <TableHead>KM Kalan</TableHead>
                    <TableHead>Muayene Kalan Gün</TableHead>
                    <TableHead>Genel Uyarı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => {
                    const kmRemaining = calculateKmRemaining(vehicle.km, vehicle.next_maintenance_km);
                    const daysRemaining = calculateInspectionDaysRemaining(vehicle.last_inspection_date);
                    const alert = getMaintenanceAlert(vehicle);
                    
                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium">{vehicle.plate}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[vehicle.status]}>
                            {statusLabels[vehicle.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{vehicle.km.toLocaleString()} km</TableCell>
                        <TableCell>
                          {vehicle.last_inspection_date 
                            ? new Date(vehicle.last_inspection_date).toLocaleDateString('tr-TR')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {kmRemaining !== null ? (
                            <span className={kmRemaining <= 2000 ? 'text-red-600 font-bold' : ''}>
                              {kmRemaining.toLocaleString()} km
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {daysRemaining !== null ? (
                            <span className={daysRemaining <= 60 ? 'text-yellow-600 font-bold' : ''}>
                              {daysRemaining} gün
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {alert ? (
                            <Badge className={alert.color}>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {alert.message}
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Assignments - Grid */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Bugünkü Vardiyalar</span>
                </CardTitle>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48"
                />
              </div>
            </CardHeader>
            <CardContent>
              {dailyAssignments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Bu tarih için vardiya ataması yok</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {vehicles.map((vehicle) => {
                    const vehicleAssignments = assignmentsByVehicle[vehicle.id] || [];
                    
                    return (
                      <Card key={vehicle.id} className={vehicleAssignments.length > 0 ? 'border-blue-500' : ''}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Truck className="h-5 w-5 text-blue-600" />
                                <span className="font-bold">{vehicle.plate}</span>
                              </div>
                              <Badge className={statusColors[vehicle.status]} className="text-xs">
                                {statusLabels[vehicle.status]}
                              </Badge>
                            </div>
                            
                            {vehicleAssignments.length > 0 ? (
                              <div className="space-y-2">
                                {vehicleAssignments.map((assignment) => (
                                  <div key={assignment.assignment_id} className="bg-blue-50 p-3 rounded-lg">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-medium text-sm">{assignment.user_name}</p>
                                        <p className="text-xs text-gray-600">{roleLabels[assignment.user_role]}</p>
                                      </div>
                                      <Badge className="text-xs">
                                        {assignment.status === 'pending' ? 'Bekliyor' : 
                                         assignment.status === 'started' ? 'Başladı' : 'Bitti'}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 text-center py-2">Atama yok</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Calendar - Table */}
        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Aylık Vardiya Takvimi</span>
                </CardTitle>
                <div className="flex space-x-2">
                  <select
                    value={selectedMonth.month}
                    onChange={(e) => setSelectedMonth(prev => ({...prev, month: parseInt(e.target.value)}))}
                    className="border rounded px-3 py-2"
                  >
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>
                        {new Date(2000, m - 1).toLocaleString('tr-TR', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedMonth.year}
                    onChange={(e) => setSelectedMonth(prev => ({...prev, year: parseInt(e.target.value)}))}
                    className="border rounded px-3 py-2"
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Araç</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyCalendar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        Bu ay için vardiya ataması yok
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyCalendar.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(item.date).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell className="font-medium">{item.vehicle_plate}</TableCell>
                        <TableCell>{item.user_name}</TableCell>
                        <TableCell>{roleLabels[item.user_role] || item.user_role}</TableCell>
                        <TableCell>
                          <Badge className="text-xs">
                            {item.status === 'pending' ? 'Bekliyor' :
                             item.status === 'started' ? 'Başladı' :
                             item.status === 'completed' ? 'Tamamlandı' : item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Araç Ekle/Düzenle Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode ? 'Araç Düzenle' : 'Yeni Araç Ekle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plaka</Label>
              <Input 
                value={formData.plate} 
                onChange={(e) => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                placeholder="34 ABC 123"
              />
            </div>
            <div className="space-y-2">
              <Label>Araç Tipi</Label>
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
            <div className="grid gap-4 md:grid-cols-2">
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
                  value={formData.fuel_level} 
                  onChange={(e) => setFormData({...formData, fuel_level: parseInt(e.target.value) || 0})}
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
            <Button onClick={editMode ? handleUpdate : handleCreate} className="w-full">
              {editMode ? 'Güncelle' : 'Oluştur'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehiclesNew;
