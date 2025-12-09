import React, { useState, useEffect, useRef } from 'react';
import { stockAPI, vehiclesAPI, itsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { Package, Plus, Edit, AlertTriangle, MapPin, Truck, Warehouse, Briefcase, ArrowLeft, CheckCircle, QrCode, Search, Loader2 } from 'lucide-react';
import StockLocationSummary from '../components/StockLocationSummary';

const StockManagement = () => {
  const [stocks, setStocks] = useState([]);
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [dialogStep, setDialogStep] = useState(1); // 1: Lokasyon seç, 2: Detayları doldur
  const [vehicles, setVehicles] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [itsDrug, setItsDrug] = useState(null); // İTS'den bulunan ilaç
  const barcodeInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    quantity: 0,
    min_quantity: 0,
    location: '',
    location_detail: '',
    lot_number: '',
    expiry_date: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [stocksRes, alertsRes, vehiclesRes] = await Promise.all([
        stockAPI.getAll(),
        stockAPI.getAlerts(),
        vehiclesAPI.getAll()
      ]);
      setStocks(stocksRes.data);
      setAlerts(alertsRes.data);
      setVehicles(vehiclesRes.data || []);
      
      // Araçlardan ve bekleme noktalarından lokasyon listesi oluştur
      const locations = [];
      (vehiclesRes.data || []).forEach(v => {
        locations.push({
          type: 'vehicle',
          name: `${v.plate} Aracı`,
          plate: v.plate,
          icon: 'truck'
        });
        locations.push({
          type: 'waiting_point',
          name: `${v.plate} Bekleme Noktası`,
          plate: v.plate,
          icon: 'mappin'
        });
      });
      setCustomLocations(locations);
    } catch (error) {
      console.error('Stok yüklenemedi:', error);
      toast.error('Stok yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await stockAPI.create(formData);
      toast.success('Stok oluşturuldu');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Stok oluşturulamadı');
    }
  };

  const handleUpdate = async () => {
    try {
      await stockAPI.update(selectedStock.id, {
        quantity: formData.quantity,
        min_quantity: formData.min_quantity,
        location: formData.location,
        location_detail: formData.location_detail
      });
      toast.success('Stok güncellendi');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Stok güncellenemedi');
    }
  };

  const openEditDialog = (stock) => {
    setSelectedStock(stock);
    setFormData({
      name: stock.name,
      code: stock.code,
      quantity: stock.quantity,
      min_quantity: stock.min_quantity,
      location: stock.location,
      location_detail: stock.location_detail || '',
      lot_number: stock.lot_number || '',
      expiry_date: stock.expiry_date ? new Date(stock.expiry_date).toISOString().split('T')[0] : ''
    });
    setEditMode(true);
    setDialogStep(2); // Düzenleme modunda direkt form'a git
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      quantity: 0,
      min_quantity: 0,
      location: '',
      location_detail: '',
      lot_number: '',
      expiry_date: ''
    });
    setEditMode(false);
    setSelectedStock(null);
    setDialogStep(1);
    setItsDrug(null); // İTS ilaç bilgisini temizle
  };

  const selectLocation = (locationName) => {
    setFormData(prev => ({ ...prev, location: locationName }));
    setDialogStep(2);
  };

  const goBackToLocationSelect = () => {
    setDialogStep(1);
  };

  // Karekod okutunca İTS'den ilaç bilgisi getir
  const handleBarcodeChange = async (barcode) => {
    setFormData(prev => ({ ...prev, code: barcode }));
    setItsDrug(null);
    
    // En az 10 karakter girildiyse ara
    if (barcode.length >= 10) {
      setBarcodeLoading(true);
      try {
        const response = await itsAPI.parseBarcode(barcode);
        const { parsed, drug } = response.data;
        
        if (drug) {
          // İlaç bulundu - bilgileri doldur
          setItsDrug(drug);
          setFormData(prev => ({
            ...prev,
            name: drug.name || prev.name,
            lot_number: parsed.lot_number || prev.lot_number,
            expiry_date: parsed.expiry_date || prev.expiry_date
          }));
          toast.success(`İlaç bulundu: ${drug.name}`);
        } else if (parsed.gtin) {
          // GTIN var ama ilaç bulunamadı
          toast.info('Karekod okundu ama İTS\'de bulunamadı');
          // Parse edilen bilgileri yine de doldur
          if (parsed.lot_number) {
            setFormData(prev => ({ ...prev, lot_number: parsed.lot_number }));
          }
          if (parsed.expiry_date) {
            setFormData(prev => ({ ...prev, expiry_date: parsed.expiry_date }));
          }
        }
      } catch (error) {
        console.error('Barcode parse error:', error);
      } finally {
        setBarcodeLoading(false);
      }
    }
  };

  // İlaç ara (manuel)
  const searchDrugs = async (query) => {
    if (query.length < 2) return;
    
    try {
      const response = await itsAPI.searchDrugs(query, 10);
      return response.data.drugs || [];
    } catch (error) {
      console.error('Drug search error:', error);
      return [];
    }
  };

  const locationLabels = {
    ambulans: 'Ambulans',
    saha_ofis: 'Saha Ofis',
    acil_canta: 'Acil Çanta',
    merkez_depo: 'Merkez Depo',
    'Merkez Depo': 'Merkez Depo',
    'Acil Çanta': 'Acil Çanta'
  };
  
  // Lokasyon adını göster (dinamik lokasyonlar için)
  const getLocationName = (location) => {
    return locationLabels[location] || location || 'Bilinmiyor';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stok Yönetimi</h1>
          <p className="text-gray-500">Tıbbi malzeme ve ilaç stok takibi</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Tüm Stoklar</span>
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center space-x-2">
            <MapPin className="h-4 w-4" />
            <span>Lokasyonlar</span>
          </TabsTrigger>
        </TabsList>

        {/* Lokasyonlar Sekmesi */}
        <TabsContent value="locations">
          <StockLocationSummary />
        </TabsContent>

        {/* Tüm Stoklar Sekmesi */}
        <TabsContent value="all">
        <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Stok
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editMode ? 'Stok Düzenle' : dialogStep === 1 ? '1. Adım: Stok Lokasyonu Seç' : '2. Adım: Stok Bilgilerini Gir'}
              </DialogTitle>
            </DialogHeader>
            
            {/* ADIM 1: LOKASYON SEÇİMİ */}
            {dialogStep === 1 && !editMode && (
              <div className="space-y-4 pt-4">
                <p className="text-sm text-gray-500">Stok eklenecek lokasyonu seçin</p>
                
                {/* Sabit Lokasyonlar */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Sabit Lokasyonlar</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => selectLocation('Merkez Depo')}
                      className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors text-left"
                    >
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Warehouse className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Merkez Depo</p>
                        <p className="text-xs text-gray-500">Ana stok deposu</p>
                      </div>
                    </button>
                    <button
                      onClick={() => selectLocation('Acil Çanta')}
                      className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors text-left"
                    >
                      <div className="p-2 bg-red-100 rounded-lg">
                        <Briefcase className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium">Acil Çanta</p>
                        <p className="text-xs text-gray-500">Portatif ilaç çantası</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Araç Lokasyonları */}
                {customLocations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700">Araç ve Bekleme Noktaları</h4>
                    <ScrollArea className="h-[250px] pr-3">
                      <div className="space-y-2">
                        {vehicles.map(vehicle => (
                          <div key={vehicle.id || vehicle._id} className="space-y-2">
                            {/* Araç */}
                            <button
                              onClick={() => selectLocation(`${vehicle.plate} Aracı`)}
                              className="w-full flex items-center justify-between p-3 border-2 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors text-left"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                  <Truck className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-medium">{vehicle.plate}</p>
                                  <p className="text-xs text-gray-500">Araç içi stok</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {vehicle.status === 'musait' ? 'Müsait' : 'Görevde'}
                              </Badge>
                            </button>
                            {/* Bekleme Noktası */}
                            <button
                              onClick={() => selectLocation(`${vehicle.plate} Bekleme Noktası`)}
                              className="w-full flex items-center justify-between p-3 border-2 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors text-left ml-6"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                  <MapPin className="h-4 w-4 text-amber-600" />
                                </div>
                                <div>
                                  <p className="font-medium">{vehicle.plate} Bekleme Noktası</p>
                                  <p className="text-xs text-gray-500">Bekleme noktası stoğu</p>
                                </div>
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* ADIM 2: STOK BİLGİLERİ */}
            {(dialogStep === 2 || editMode) && (
              <div className="space-y-4 pt-4">
                {/* Seçilen Lokasyon Gösterimi */}
                {!editMode && (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Lokasyon: {formData.location}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={goBackToLocationSelect}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Değiştir
                    </Button>
                  </div>
                )}
                
                {editMode && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="font-medium text-blue-800">Lokasyon: {formData.location}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Malzeme Adı * {itsDrug && <Badge variant="secondary" className="ml-2 text-xs">İTS</Badge>}</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      disabled={editMode || !!itsDrug}
                      placeholder="İlaç veya malzeme adı"
                      className={itsDrug ? 'bg-green-50 border-green-300' : ''}
                    />
                    {!itsDrug && !editMode && (
                      <p className="text-xs text-gray-500">Karekod okutarak otomatik doldurabilirsiniz</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <QrCode className="h-4 w-4" />
                      <span>Karekod / GTIN *</span>
                      {barcodeLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    </Label>
                    <Input
                      ref={barcodeInputRef}
                      value={formData.code}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      disabled={editMode}
                      placeholder="Karekodu okutun veya GTIN girin"
                      className={itsDrug ? 'border-green-500 bg-green-50' : ''}
                    />
                    {itsDrug && (
                      <div className="text-xs text-green-600 flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>İTS'de bulundu: {itsDrug.manufacturer_name}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* İTS'den bulunan ilaç bilgisi */}
                {itsDrug && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">İTS İlaç Bilgisi</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">GTIN:</span>
                        <span className="ml-2 font-mono">{itsDrug.gtin}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Üretici:</span>
                        <span className="ml-2">{itsDrug.manufacturer_name}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Miktar</Label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Miktar (Uyarı)</Label>
                    <Input
                      type="number"
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({...formData, min_quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {!editMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Lot Numarası</Label>
                      <Input
                        value={formData.lot_number}
                        onChange={(e) => setFormData({...formData, lot_number: e.target.value})}
                        placeholder="Üretim lot numarası"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Son Kullanma Tarihi</Label>
                      <Input
                        type="date"
                        value={formData.expiry_date}
                        onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 pt-2">
                  {!editMode && (
                    <Button variant="outline" onClick={goBackToLocationSelect} className="flex-1">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Geri
                    </Button>
                  )}
                  <Button 
                    onClick={editMode ? handleUpdate : handleCreate} 
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {editMode ? 'Güncelle' : 'Stok Ekle'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{alerts.critical_stock || 0}</p>
              <p className="text-sm text-gray-500">Kritik Stok</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{alerts.expired || 0}</p>
              <p className="text-sm text-gray-500">Süresi Geçmiş</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{alerts.expiring_soon || 0}</p>
              <p className="text-sm text-gray-500">Yakında Dolacak</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stok Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Malzeme</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Lokasyon</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Henüz stok kaydı yok
                  </TableCell>
                </TableRow>
              ) : (
                stocks.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-medium">{stock.name}</TableCell>
                    <TableCell className="font-mono text-xs">{stock.code}</TableCell>
                    <TableCell>
                      <span className={stock.quantity < stock.min_quantity ? 'text-red-600 font-bold' : ''}>
                        {stock.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">{stock.min_quantity}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{getLocationName(stock.location)}</p>
                        {stock.location_detail && (
                          <p className="text-xs text-gray-500">{stock.location_detail}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {stock.quantity < stock.min_quantity ? (
                        <Badge variant="destructive">Kritik</Badge>
                      ) : stock.quantity < stock.min_quantity * 1.5 ? (
                        <Badge variant="secondary">Düşük</Badge>
                      ) : (
                        <Badge className="bg-green-600">Yeterli</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openEditDialog(stock)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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
    </div>
  );
};

export default StockManagement;

