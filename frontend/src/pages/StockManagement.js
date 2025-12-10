import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Package, Plus, Edit, AlertTriangle, MapPin, Truck, Warehouse, Briefcase, ArrowLeft, CheckCircle, QrCode, Search, Loader2, X, Calendar, Hash, RefreshCw, ChevronRight, Pill, Box, Scissors, ArrowRightLeft, History, Send } from 'lucide-react';
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

  // Karekod Bazlı Stok State
  const [barcodeGroups, setBarcodeGroups] = useState([]);
  const [barcodeLoading2, setBarcodeLoading2] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [barcodeLocationFilter, setBarcodeLocationFilter] = useState('merkez_depo');
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [medicationDetailsOpen, setMedicationDetailsOpen] = useState(false);
  const [medicationDetails, setMedicationDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Stok Parçalama State
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [selectedItemForSplit, setSelectedItemForSplit] = useState(null);
  const [splitQuantity, setSplitQuantity] = useState(1);
  const [splitTargetLocation, setSplitTargetLocation] = useState('');
  const [splitLoading, setSplitLoading] = useState(false);
  
  // Stok Hareketleri State
  const [movementsDialogOpen, setMovementsDialogOpen] = useState(false);
  const [stockMovements, setStockMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  
  // Stok Lokasyonları State
  const [stockLocations, setStockLocations] = useState([]);
  const [syncingLocations, setSyncingLocations] = useState(false);

  useEffect(() => {
    loadData();
    loadBarcodeGroups();
    loadStockLocations();
  }, []);
  
  // Lokasyon filtresi değiştiğinde yeniden yükle
  useEffect(() => {
    loadBarcodeGroups();
  }, [barcodeLocationFilter]);

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

  // Karekod Bazlı Stok Yükle
  const loadBarcodeGroups = useCallback(async () => {
    setBarcodeLoading2(true);
    try {
      const params = {};
      if (barcodeLocationFilter && barcodeLocationFilter !== 'all') {
        params.location = barcodeLocationFilter;
      }
      if (barcodeSearch) {
        params.search = barcodeSearch;
      }
      
      const response = await stockAPI.getGroupedInventory(params);
      setBarcodeGroups(response.data.groups || []);
    } catch (error) {
      console.error('Karekod stok yüklenemedi:', error);
      toast.error('Karekod stok yüklenemedi');
    } finally {
      setBarcodeLoading2(false);
    }
  }, [barcodeLocationFilter, barcodeSearch]);

  // İlaç detaylarını yükle (QR kodları ile)
  const loadMedicationDetails = async (medication) => {
    setSelectedMedication(medication);
    setMedicationDetailsOpen(true);
    setLoadingDetails(true);
    
    try {
      const location = barcodeLocationFilter !== 'all' ? barcodeLocationFilter : null;
      const response = await stockAPI.getItemQRDetails(medication.name, location);
      setMedicationDetails(response.data);
    } catch (error) {
      console.error('İlaç detayları yüklenemedi:', error);
      toast.error('Detaylar yüklenemedi');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Tab değiştiğinde karekod stokunu yükle
  const handleTabChange = (value) => {
    if (value === 'barcode') {
      loadBarcodeGroups();
    }
  };

  // Tarih formatla
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  // SKT durumu kontrol
  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { status: 'expired', label: 'Süresi Dolmuş', color: 'bg-red-500' };
    if (daysLeft <= 30) return { status: 'expiring', label: `${daysLeft} gün`, color: 'bg-orange-500' };
    if (daysLeft <= 90) return { status: 'warning', label: `${daysLeft} gün`, color: 'bg-yellow-500' };
    return { status: 'ok', label: formatDate(expiryDate), color: 'bg-green-500' };
  };

  // Stok Lokasyonlarını Yükle
  const loadStockLocations = async () => {
    try {
      const response = await stockAPI.getStockLocations();
      setStockLocations(response.data.locations || []);
    } catch (error) {
      console.error('Lokasyonlar yüklenemedi:', error);
    }
  };

  // Araç Lokasyonlarını Otomatik Senkronize Et
  const syncVehicleLocations = async () => {
    setSyncingLocations(true);
    try {
      const response = await stockAPI.syncVehicleLocations();
      toast.success(response.data.message);
      loadStockLocations();
    } catch (error) {
      console.error('Senkronizasyon hatası:', error);
      toast.error('Lokasyonlar senkronize edilemedi');
    } finally {
      setSyncingLocations(false);
    }
  };

  // Eski "Bekleme Noktası" Lokasyonlarını Temizle
  const cleanupOldLocations = async () => {
    setSyncingLocations(true);
    try {
      const response = await stockAPI.cleanupOldLocations();
      toast.success(response.data.message);
      loadStockLocations();
    } catch (error) {
      console.error('Temizleme hatası:', error);
      toast.error('Eski lokasyonlar temizlenemedi');
    } finally {
      setSyncingLocations(false);
    }
  };

  // Stok Parçalama İşlemi
  const openSplitDialog = (item) => {
    setSelectedItemForSplit(item);
    setSplitQuantity(1);
    setSplitTargetLocation('');
    setSplitDialogOpen(true);
  };

  const handleSplitStock = async () => {
    if (!selectedItemForSplit || !splitTargetLocation || splitQuantity < 1) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    setSplitLoading(true);
    try {
      const response = await stockAPI.splitStock({
        barcode_stock_id: selectedItemForSplit.id,
        target_location: splitTargetLocation,
        quantity_in_package: splitQuantity,
        notes: `Stok parçalama: ${splitQuantity} adet`
      });
      
      toast.success(response.data.message);
      setSplitDialogOpen(false);
      setMedicationDetailsOpen(false);
      loadBarcodeGroups();
    } catch (error) {
      console.error('Parçalama hatası:', error);
      toast.error(error.response?.data?.detail || 'Stok parçalanamadı');
    } finally {
      setSplitLoading(false);
    }
  };

  // Stok Hareketlerini Yükle
  const loadStockMovements = async () => {
    setMovementsLoading(true);
    try {
      const response = await stockAPI.getStockMovements({ limit: 50 });
      setStockMovements(response.data.movements || []);
    } catch (error) {
      console.error('Hareketler yüklenemedi:', error);
    } finally {
      setMovementsLoading(false);
    }
  };

  const openMovementsDialog = () => {
    setMovementsDialogOpen(true);
    loadStockMovements();
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={syncVehicleLocations}
            disabled={syncingLocations}
          >
            {syncingLocations ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Lokasyonları Senkronize Et
          </Button>
          <Button variant="outline" onClick={openMovementsDialog}>
            <History className="h-4 w-4 mr-2" />
            Stok Hareketleri
          </Button>
        </div>
      </div>

      <Tabs defaultValue="barcode" className="space-y-4" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="barcode" className="flex items-center space-x-2">
            <QrCode className="h-4 w-4" />
            <span>Karekod Stok</span>
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Tüm Stoklar</span>
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center space-x-2">
            <MapPin className="h-4 w-4" />
            <span>Lokasyonlar</span>
          </TabsTrigger>
        </TabsList>

        {/* Karekod Bazlı Stok Sekmesi */}
        <TabsContent value="barcode">
          <div className="space-y-4">
            {/* Filtreler */}
            <div className="flex gap-4 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-sm text-gray-500 mb-1 block">İlaç Ara</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="İlaç adı ara..."
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadBarcodeGroups()}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="w-[200px]">
                <Label className="text-sm text-gray-500 mb-1 block">Lokasyon</Label>
                <Select value={barcodeLocationFilter} onValueChange={setBarcodeLocationFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Lokasyonlar</SelectItem>
                    <SelectItem value="merkez_depo">Merkez Depo</SelectItem>
                    <SelectItem value="ambulans">Ambulans</SelectItem>
                    <SelectItem value="acil_canta">Acil Çanta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={loadBarcodeGroups} disabled={barcodeLoading2}>
                {barcodeLoading2 ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Yenile
              </Button>
            </div>

            {/* Özet Bilgi */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {barcodeGroups.length} çeşit ilaç, toplam{' '}
                {barcodeGroups.reduce((sum, g) => sum + g.count, 0)} adet karekod
              </span>
            </div>

            {/* İlaç Listesi - Gruplu Görünüm */}
            {barcodeLoading2 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : barcodeGroups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Box className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Stokta ürün bulunamadı</p>
                  <p className="text-sm mt-2">Karekod okutarak stok ekleyebilirsiniz</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {barcodeGroups.map((group) => {
                  const expiryStatus = getExpiryStatus(group.earliest_expiry);
                  
                  return (
                    <Card 
                      key={group.name}
                      className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-l-4 ${
                        expiryStatus?.status === 'expired' ? 'border-l-red-500 bg-red-50/50' :
                        expiryStatus?.status === 'expiring' ? 'border-l-orange-500 bg-orange-50/50' :
                        'border-l-green-500'
                      }`}
                      onClick={() => loadMedicationDetails(group)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <Pill className="h-5 w-5 text-blue-600 flex-shrink-0" />
                              <h4 className="font-semibold text-sm truncate" title={group.name}>
                                {group.name}
                              </h4>
                            </div>
                            
                            {group.manufacturer_name && (
                              <p className="text-xs text-gray-500 mb-2 truncate">
                                {group.manufacturer_name}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Badge className="bg-blue-600 text-white">
                                {group.count} adet
                              </Badge>
                              
                              {expiryStatus && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    expiryStatus.status === 'expired' ? 'border-red-300 text-red-700 bg-red-50' :
                                    expiryStatus.status === 'expiring' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                                    expiryStatus.status === 'warning' ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
                                    'border-green-300 text-green-700 bg-green-50'
                                  }`}
                                >
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {expiryStatus.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* İlaç Detay Popup */}
          <Dialog open={medicationDetailsOpen} onOpenChange={setMedicationDetailsOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <QrCode className="h-5 w-5 text-blue-600" />
                  <span className="truncate">{selectedMedication?.name}</span>
                </DialogTitle>
              </DialogHeader>
              
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : medicationDetails ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Özet Bilgi */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{medicationDetails.count}</p>
                      <p className="text-xs text-gray-500">Toplam Adet</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        {selectedMedication?.gtin || '-'}
                      </p>
                      <p className="text-xs text-gray-500">GTIN</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        {selectedMedication?.manufacturer_name || '-'}
                      </p>
                      <p className="text-xs text-gray-500">Üretici</p>
                    </div>
                  </div>

                  {/* QR Kod Listesi */}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 mb-2">Karekod Detayları</p>
                    <ScrollArea className="h-[350px] pr-2">
                      <div className="space-y-2">
                        {medicationDetails.items?.map((item, idx) => {
                          const itemExpiry = getExpiryStatus(item.expiry_date);
                          
                          return (
                            <div 
                              key={item.id || idx}
                              className={`p-3 rounded-lg border transition-colors ${
                                item.is_expired ? 'bg-red-50 border-red-200' :
                                item.is_expiring_soon ? 'bg-orange-50 border-orange-200' :
                                'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 flex-1 min-w-0">
                                  <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                                    <QrCode className="h-5 w-5 text-gray-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <Badge variant="outline" className="text-xs font-mono">
                                        #{idx + 1}
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        {item.location_detail || item.location}
                                      </span>
                                    </div>
                                    
                                    <p className="font-mono text-xs text-gray-600 truncate" title={item.serial_number}>
                                      SN: {item.serial_number || 'N/A'}
                                    </p>
                                    
                                    {item.lot_number && (
                                      <p className="text-xs text-gray-500 flex items-center mt-1">
                                        <Hash className="h-3 w-3 mr-1" />
                                        LOT: {item.lot_number}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-3">
                                  <div className="flex items-center gap-2">
                                    {itemExpiry && (
                                      <Badge 
                                        className={`text-xs ${
                                          itemExpiry.status === 'expired' ? 'bg-red-500' :
                                          itemExpiry.status === 'expiring' ? 'bg-orange-500' :
                                          itemExpiry.status === 'warning' ? 'bg-yellow-500' :
                                          'bg-green-500'
                                        }`}
                                      >
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {formatDate(item.expiry_date)}
                                      </Badge>
                                    )}
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openSplitDialog(item);
                                      }}
                                    >
                                      <Scissors className="h-3 w-3 mr-1" />
                                      Parçala
                                    </Button>
                                  </div>
                                  
                                  {item.days_until_expiry !== undefined && (
                                    <p className={`text-xs ${
                                      item.days_until_expiry < 0 ? 'text-red-600' :
                                      item.days_until_expiry <= 30 ? 'text-orange-600' :
                                      'text-gray-500'
                                    }`}>
                                      {item.days_until_expiry < 0 
                                        ? `${Math.abs(item.days_until_expiry)} gün geçti`
                                        : `${item.days_until_expiry} gün kaldı`
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Detay bilgisi bulunamadı
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

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

      {/* Stok Parçalama Dialog */}
      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Scissors className="h-5 w-5 text-orange-600" />
              <span>Stok Parçala</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedItemForSplit && (
            <div className="space-y-4">
              {/* Ürün Bilgisi */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-900">{selectedMedication?.name}</p>
                <p className="text-xs text-blue-700 mt-1">
                  SN: {selectedItemForSplit.serial_number || 'N/A'}
                </p>
                {selectedItemForSplit.lot_number && (
                  <p className="text-xs text-blue-700">
                    LOT: {selectedItemForSplit.lot_number}
                  </p>
                )}
                {selectedItemForSplit.expiry_date && (
                  <p className="text-xs text-blue-700">
                    SKT: {formatDate(selectedItemForSplit.expiry_date)}
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Dikkat:</strong> Bu işlem karekodu sistemden düşürecek ve adet bazlı stoğa dönüştürecektir.
                </p>
              </div>

              {/* Kutu İçi Adet */}
              <div className="space-y-2">
                <Label>Kutu İçindeki Adet Sayısı *</Label>
                <Input
                  type="number"
                  min="1"
                  value={splitQuantity}
                  onChange={(e) => setSplitQuantity(parseInt(e.target.value) || 1)}
                  placeholder="Örn: 10, 20, 30..."
                />
                <p className="text-xs text-gray-500">
                  Kutunun/ambalajın içinde kaç adet ürün var?
                </p>
              </div>

              {/* Hedef Lokasyon */}
              <div className="space-y-2">
                <Label>Hedef Lokasyon *</Label>
                <Select value={splitTargetLocation} onValueChange={setSplitTargetLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Lokasyon seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Merkez Depo">Merkez Depo</SelectItem>
                    <SelectItem value="Acil Çanta">Acil Çanta</SelectItem>
                    {stockLocations.filter(l => l.type === 'vehicle').map(loc => (
                      <SelectItem key={loc.id} value={loc.name}>
                        🚑 {loc.name}
                      </SelectItem>
                    ))}
                    {stockLocations.filter(l => l.type === 'waiting_point').map(loc => (
                      <SelectItem key={loc.id} value={loc.name}>
                        📍 {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* İşlem Butonu */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSplitDialogOpen(false)}>
                  İptal
                </Button>
                <Button 
                  onClick={handleSplitStock}
                  disabled={splitLoading || !splitTargetLocation || splitQuantity < 1}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {splitLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Scissors className="h-4 w-4 mr-2" />
                  )}
                  Parçala ({splitQuantity} adet)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stok Hareketleri Dialog */}
      <Dialog open={movementsDialogOpen} onOpenChange={setMovementsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <History className="h-5 w-5 text-purple-600" />
              <span>Stok Hareketleri</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {movementsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : stockMovements.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Henüz stok hareketi yok</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-2">
                  {stockMovements.map((movement) => (
                    <div 
                      key={movement.id}
                      className={`p-3 rounded-lg border ${
                        movement.type === 'split' ? 'bg-orange-50 border-orange-200' :
                        movement.type === 'transfer' ? 'bg-blue-50 border-blue-200' :
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-lg ${
                            movement.type === 'split' ? 'bg-orange-100' :
                            movement.type === 'transfer' ? 'bg-blue-100' :
                            'bg-gray-100'
                          }`}>
                            {movement.type === 'split' ? (
                              <Scissors className="h-4 w-4 text-orange-600" />
                            ) : (
                              <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{movement.item_name}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {movement.type === 'split' ? 'Parçalama' : 'Transfer'}: {movement.quantity} {movement.unit || 'adet'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {movement.from_location} → {movement.to_location}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <p>{new Date(movement.created_at).toLocaleDateString('tr-TR')}</p>
                          <p>{new Date(movement.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                          <p className="mt-1 text-gray-400">{movement.performed_by_name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="outline" onClick={loadStockMovements} disabled={movementsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${movementsLoading ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
            <Button variant="outline" onClick={() => setMovementsDialogOpen(false)}>
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockManagement;

