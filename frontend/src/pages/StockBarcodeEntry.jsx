import React, { useState, useEffect } from 'react';
import { stockBarcodeAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import BarcodeScanner from '../components/BarcodeScanner';
import { useAuth } from '../contexts/AuthContext';
import {
  QrCode,
  Package,
  MapPin,
  Truck,
  Warehouse,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Hash,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  ScanLine,
  PackagePlus,
  Info,
  AlertCircle
} from 'lucide-react';

const StockBarcodeEntry = () => {
  const { user } = useAuth();
  const [step, setStep] = useState('location'); // location, scan, summary, transfer
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [expiringItems, setExpiringItems] = useState([]);
  
  // YENİ: Transfer modu state
  const [transferMode, setTransferMode] = useState(false);
  const [transferBarcode, setTransferBarcode] = useState('');
  const [transferLookup, setTransferLookup] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferLoading, setTransferLoading] = useState(false);
  const [boxFinished, setBoxFinished] = useState(false);
  const [targetLocation, setTargetLocation] = useState(null);

  // Lokasyon seçenekleri
  const locationOptions = [
    { key: 'merkez_depo', label: 'Merkez Depo', icon: Warehouse, color: 'blue' },
    { key: 'acil_canta', label: 'Acil Çanta', icon: Briefcase, color: 'red' },
    { key: 'saha_ofis', label: 'Saha Ofis', icon: MapPin, color: 'purple' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, inventoryRes, expiringRes] = await Promise.all([
        vehiclesAPI.getAll(),
        stockBarcodeAPI.getInventoryByLocation(),
        stockBarcodeAPI.getExpiringItems(30)
      ]);
      setVehicles(vehiclesRes.data || []);
      setInventory(inventoryRes.data);
      setExpiringItems(expiringRes.data?.expiring_items || []);
    } catch (error) {
      console.error('Data load error:', error);
      // Hata durumunda bile devam et
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (location, locationDetail = null) => {
    setSelectedLocation({ location, locationDetail });
    setStep('scan');
    setScannerOpen(true);
  };
  
  // YENİ: Transfer modu için barkod ile ilaç adı sorgulama
  const handleTransferLookup = async (barcode) => {
    if (!barcode || barcode.length < 5) {
      setTransferLookup(null);
      return;
    }
    
    setTransferLoading(true);
    try {
      // TİTCK veritabanından ilaç adını sorgula
      const response = await stockBarcodeAPI.lookupBarcodePost(barcode);
      setTransferLookup(response.data);
      
      if (response.data.found) {
        toast.success(`İlaç bulundu: ${response.data.name}`);
      } else {
        toast.info('Barkod veritabanında bulunamadı. Manuel isim girebilirsiniz.');
      }
    } catch (error) {
      console.error('Lookup error:', error);
      toast.error('Barkod sorgulanamadı');
      setTransferLookup(null);
    } finally {
      setTransferLoading(false);
    }
  };
  
  // YENİ: Transfer işlemi
  const handleTransferSubmit = async () => {
    if (!transferLookup || !targetLocation) {
      toast.error('Lütfen barkod okutun ve hedef lokasyon seçin');
      return;
    }
    
    setTransferLoading(true);
    try {
      // Ana depodan hedef lokasyona transfer
      const response = await stockBarcodeAPI.addByBarcode({
        barcode: transferBarcode,
        location: targetLocation.location,
        location_detail: targetLocation.locationDetail,
        name: transferLookup.name || 'Bilinmeyen İlaç',
        quantity: transferQuantity,
        box_finished: boxFinished
      });
      
      toast.success(`${transferQuantity} adet "${transferLookup.name || 'İlaç'}" ${targetLocation.locationDetail || targetLocation.location} lokasyonuna transfer edildi`);
      
      // State'i temizle
      setTransferBarcode('');
      setTransferLookup(null);
      setTransferQuantity(1);
      setBoxFinished(false);
      
      // İlgili item'ı scannedItems'a ekle
      const newItem = {
        ...response.data.stock_item,
        parsed: response.data.parsed,
        timestamp: new Date(),
        quantity: transferQuantity,
        transfer_type: 'depo_to_lokasyon'
      };
      setScannedItems(prev => [newItem, ...prev]);
      
    } catch (error) {
      const message = error.response?.data?.detail || 'Transfer işlemi başarısız';
      toast.error(message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleScan = async (barcode) => {
    try {
      // Önce TİTCK veritabanından ilaç adını ara
      let medicationName = null;
      try {
        const lookupRes = await stockBarcodeAPI.lookupBarcodePost(barcode);
        if (lookupRes.data?.found) {
          medicationName = lookupRes.data.name;
        }
      } catch (lookupErr) {
        console.warn('TİTCK lookup failed:', lookupErr);
      }
      
      // Backend'e karekod gönder (bulunan ismi de ekle)
      const response = await stockBarcodeAPI.addByBarcode({
        barcode: barcode,
        location: selectedLocation.location,
        location_detail: selectedLocation.locationDetail,
        name: medicationName // TİTCK'den bulunan isim
      });
      
      toast.success(response.data.message || 'İlaç stoğa eklendi');
      
      const newItem = {
        ...response.data.stock_item,
        parsed: response.data.parsed,
        timestamp: new Date(),
        titck_name: medicationName // TİTCK'den bulunan ismi de kaydet
      };
      
      setScannedItems(prev => [newItem, ...prev]);
      return { success: true, item: newItem };
      
    } catch (error) {
      const message = error.response?.data?.detail || 'Karekod işlenemedi';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const handleFinish = () => {
    setScannerOpen(false);
    setStep('summary');
    loadData(); // Özeti yenile
  };

  const resetAndStart = () => {
    setSelectedLocation(null);
    setScannedItems([]);
    setStep('location');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Adım 1: Lokasyon Seçimi
  if (step === 'location') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PackagePlus className="h-8 w-8 text-blue-600" />
            Karekod ile Stok Girişi
          </h1>
          <p className="text-gray-500 mt-1">
            İlaç karekodlarını tarayarak stoğa ekleyin. Her karekod benzersizdir ve 1 adet ürünü temsil eder.
          </p>
        </div>

        {/* Özet Kartlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-blue-600">
                {inventory?.locations?.reduce((sum, l) => sum + (l.count || 0), 0) || 0}
              </div>
              <div className="text-sm text-gray-500">Toplam Stok</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-green-600">
                {inventory?.locations?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Lokasyon</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100">
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-orange-600">
                {expiringItems.length}
              </div>
              <div className="text-sm text-gray-500">SKT Yaklaşan</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-purple-600">
                {scannedItems.length}
              </div>
              <div className="text-sm text-gray-500">Bu Oturumda</div>
            </CardContent>
          </Card>
        </div>

        {/* SKT Uyarısı */}
        {expiringItems.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-orange-800 flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5" />
                Son Kullanma Tarihi Yaklaşan İlaçlar ({expiringItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-24">
                <div className="flex flex-wrap gap-2">
                  {expiringItems.slice(0, 10).map((item, idx) => (
                    <Badge key={idx} variant="outline" className="bg-white text-orange-700 border-orange-300">
                      {item.name} - {item.days_until_expiry} gün
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* ==================== ANA DEPODAN TRANSFER ==================== */}
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-800">
              <Package className="h-5 w-5" />
              Ana Depodan Lokasyona Transfer
            </CardTitle>
            <CardDescription>
              Merkez depodan araç veya carter'a ilaç transfer edin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barkod Girişi */}
            <div className="space-y-2">
              <Label>İlaç Barkodu (Karekod) Okutun</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Barkodu okutun veya girin..."
                  value={transferBarcode}
                  onChange={(e) => {
                    setTransferBarcode(e.target.value);
                    if (e.target.value.length >= 8) {
                      handleTransferLookup(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && transferBarcode.length >= 5) {
                      handleTransferLookup(transferBarcode);
                    }
                  }}
                  className="font-mono"
                />
                <Button 
                  onClick={() => handleTransferLookup(transferBarcode)}
                  disabled={transferLoading || transferBarcode.length < 5}
                  variant="outline"
                >
                  {transferLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {/* Bulunan İlaç Bilgisi */}
            {transferLookup && (
              <Card className={`${transferLookup.found ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {transferLookup.found ? (
                      <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-semibold ${transferLookup.found ? 'text-green-800' : 'text-amber-800'}`}>
                        {transferLookup.found ? transferLookup.name : 'Barkod veritabanında bulunamadı'}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Barkod: {transferLookup.barcode || transferBarcode}
                        {transferLookup.gtin && ` | GTIN: ${transferLookup.gtin}`}
                      </p>
                      {!transferLookup.found && (
                        <Input
                          className="mt-2"
                          placeholder="Manuel ilaç adı girin..."
                          onChange={(e) => setTransferLookup(prev => ({...prev, name: e.target.value, found: true}))}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Transfer Detayları */}
            {transferLookup?.found && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hedef Lokasyon */}
                <div className="space-y-2">
                  <Label>Hedef Lokasyon</Label>
                  <Select 
                    value={targetLocation ? `${targetLocation.location}|${targetLocation.locationDetail || ''}` : ''}
                    onValueChange={(val) => {
                      const [loc, detail] = val.split('|');
                      setTargetLocation({ location: loc, locationDetail: detail || null });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Lokasyon seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acil_canta|">Acil Çanta</SelectItem>
                      <SelectItem value="saha_ofis|">Saha Ofis</SelectItem>
                      {vehicles.map(v => (
                        <SelectItem key={v.id || v._id} value={`ambulans|${v.plate}`}>
                          🚑 {v.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Adet */}
                <div className="space-y-2">
                  <Label>Transfer Adedi</Label>
                  <Input
                    type="number"
                    min="1"
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}
            
            {/* Kutu Bitti Seçeneği */}
            {transferLookup?.found && (
              <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <Checkbox
                  id="boxFinished"
                  checked={boxFinished}
                  onCheckedChange={(checked) => setBoxFinished(checked)}
                />
                <div>
                  <Label htmlFor="boxFinished" className="text-red-800 font-medium cursor-pointer">
                    Bu kutu bitti
                  </Label>
                  <p className="text-xs text-red-600">
                    İşaretlerseniz kalan stok sıfırlanır ve kutu sistemden düşürülür
                  </p>
                </div>
              </div>
            )}
            
            {/* Transfer Butonu */}
            {transferLookup?.found && targetLocation && (
              <Button 
                onClick={handleTransferSubmit}
                disabled={transferLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                size="lg"
              >
                {transferLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Package className="h-5 w-5 mr-2" />
                )}
                {transferQuantity} Adet Transfer Et
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Lokasyon Seçimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Stok Lokasyonu Seçin
            </CardTitle>
            <CardDescription>
              Karekodları okutacağınız lokasyonu seçin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sabit Lokasyonlar */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-gray-700">Sabit Lokasyonlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {locationOptions.map(loc => {
                  const Icon = loc.icon;
                  const bgColor = `bg-${loc.color}-100`;
                  const hoverBorder = `hover:border-${loc.color}-500`;
                  const hoverBg = `hover:bg-${loc.color}-50`;
                  
                  return (
                    <button
                      key={loc.key}
                      onClick={() => handleLocationSelect(loc.key)}
                      className={`flex items-center justify-between p-4 border-2 rounded-xl hover:border-${loc.color}-500 hover:bg-${loc.color}-50 transition-all group`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-3 bg-${loc.color}-100 rounded-xl group-hover:bg-${loc.color}-200 transition-colors`}>
                          <Icon className={`h-6 w-6 text-${loc.color}-600`} />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">{loc.label}</p>
                          <p className="text-xs text-gray-500">Stok girişi</p>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 text-gray-400 group-hover:text-${loc.color}-600`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Araç Lokasyonları */}
            {vehicles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-gray-700">Araçlar (Ambulanslar)</h3>
                <ScrollArea className="h-[280px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
                    {vehicles.map(vehicle => (
                      <button
                        key={vehicle.id || vehicle._id}
                        onClick={() => handleLocationSelect('ambulans', vehicle.plate)}
                        className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                            <Truck className="h-6 w-6 text-green-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold">{vehicle.plate}</p>
                            <p className="text-xs text-gray-500">
                              {vehicle.status === 'musait' ? 'Müsait' : vehicle.status === 'gorevde' ? 'Görevde' : 'Bakımda'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={vehicle.status === 'musait' ? 'outline' : 'secondary'} className="text-xs">
                            {vehicle.status === 'musait' ? 'Aktif' : 'Meşgul'}
                          </Badge>
                          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-green-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Adım 2: Tarama
  if (step === 'scan') {
    const locationLabel = selectedLocation.location === 'ambulans' 
      ? `Ambulans: ${selectedLocation.locationDetail}`
      : locationOptions.find(l => l.key === selectedLocation.location)?.label || selectedLocation.location;

    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={resetAndStart}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Lokasyon Değiştir
          </Button>
          <Badge variant="outline" className="text-base px-4 py-2">
            <MapPin className="h-4 w-4 mr-2" />
            {locationLabel}
          </Badge>
        </div>

        {/* Tarayıcı Dialog */}
        <Dialog open={scannerOpen} onOpenChange={(open) => {
          if (!open) {
            // Dialog kapanırken scanner'ı düzgün temizle
            setScannerOpen(false);
          } else {
            setScannerOpen(true);
          }
        }}>
          <DialogContent className="max-w-lg p-0" aria-describedby={undefined}>
            <DialogHeader className="sr-only">
              <DialogTitle>Karekod Tarayıcı</DialogTitle>
            </DialogHeader>
            <BarcodeScanner
              mode="entry"
              locationName={locationLabel}
              title="Stok Girişi - Karekod Tara"
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
              continuousScan={true}
            />
          </DialogContent>
        </Dialog>

        {/* Taranan Öğeler */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Taranan Ürünler ({scannedItems.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setScannerOpen(true)}>
                  <ScanLine className="h-4 w-4 mr-2" />
                  Taramaya Devam Et
                </Button>
                <Button onClick={handleFinish} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Tamamla
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {scannedItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <QrCode className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Henüz ürün taranmadı</p>
                <p className="text-sm">Taramaya başlamak için butona tıklayın</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {scannedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 rounded-full">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {item.gtin && (
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {item.gtin}
                              </span>
                            )}
                            {item.lot_number && (
                              <span>Lot: {item.lot_number}</span>
                            )}
                            {item.expiry_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                SKT: {new Date(item.expiry_date).toLocaleDateString('tr-TR')}
                              </span>
                            )}
                          </div>
                          {item.serial_number && (
                            <p className="text-xs text-gray-400 font-mono mt-1">
                              SN: {item.serial_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Eklendi</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Bilgi Kartı */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Her karekod = 1 adet</p>
              <p>Her ilaç karekodu benzersizdir. Aynı karekod iki kez okutulamaz.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Adım 3: Özet
  if (step === 'summary') {
    const locationLabel = selectedLocation?.location === 'ambulans' 
      ? `Ambulans: ${selectedLocation?.locationDetail}`
      : locationOptions.find(l => l.key === selectedLocation?.location)?.label || selectedLocation?.location;

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-800">Stok Girişi Tamamlandı!</h2>
                <p className="text-green-700">
                  {scannedItems.length} ürün <strong>{locationLabel}</strong> lokasyonuna eklendi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eklenen Ürünler Özeti */}
        <Card>
          <CardHeader>
            <CardTitle>Eklenen Ürünler</CardTitle>
          </CardHeader>
          <CardContent>
            {scannedItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Bu oturumda ürün eklenmedi</p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {scannedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.lot_number && `Lot: ${item.lot_number}`}
                            {item.expiry_date && ` • SKT: ${new Date(item.expiry_date).toLocaleDateString('tr-TR')}`}
                          </p>
                        </div>
                      </div>
                      {item.serial_number && (
                        <span className="text-xs text-gray-400 font-mono">
                          {item.serial_number.substring(0, 10)}...
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button variant="outline" onClick={resetAndStart} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Yeni Giriş Yap
          </Button>
          <Button 
            onClick={() => window.location.href = '/dashboard/stock'} 
            className="flex-1"
          >
            Stok Yönetimine Git
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default StockBarcodeEntry;
