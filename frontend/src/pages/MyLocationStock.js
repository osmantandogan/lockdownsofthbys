import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Search,
  QrCode,
  Truck,
  MapPin,
  RefreshCw,
  ClipboardCheck,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { stockAPI, shiftsAPI, medicationsAPI } from '../api';

/**
 * ATT/Paramedik için Lokasyon Stok Kontrolü
 * Sadece kendi araç/bekleme noktası stoklarını görebilirler
 * Önceki sayımları göremezler - sadece güncel stok ve yeni sayım
 */
const MyLocationStock = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState(null); // Atandığım araç/lokasyon
  const [stockItems, setStockItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Sayım modu
  const [countingMode, setCountingMode] = useState(false);
  const [countedItems, setCountedItems] = useState({});
  const [savingCount, setSavingCount] = useState(false);
  
  // Detay modalı
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Bugünkü görevimi ve lokasyonumu bul
  const loadMyAssignment = useCallback(async () => {
    try {
      setLoading(true);
      
      // Bugünkü vardiya atamasını getir
      const response = await shiftsAPI.getTodayAssignments();
      const assignments = response.data || [];
      
      // Kullanıcının atamasını bul
      const myAssignment = assignments.find(a => 
        a.user_id === user?.id || 
        a.personnel?.some(p => p.id === user?.id || p._id === user?.id)
      );
      
      if (myAssignment) {
        // Araç bilgisini al
        const vehiclePlate = myAssignment.vehicle?.plate || myAssignment.vehicle_plate;
        const waitingPoint = myAssignment.waiting_point;
        
        setMyLocation({
          type: 'vehicle',
          id: myAssignment.vehicle?.id || myAssignment.vehicle_id,
          name: vehiclePlate ? `${vehiclePlate}` : 'Araç',
          plate: vehiclePlate,
          waitingPoint: waitingPoint,
          assignment: myAssignment
        });
        
        // Bu lokasyonun stoklarını yükle
        await loadLocationStock(vehiclePlate, waitingPoint);
      } else {
        // Atama bulunamadı
        setMyLocation(null);
        toast.info('Bugün için aktif bir araç atamanız bulunmuyor');
      }
    } catch (error) {
      console.error('Görev yüklenemedi:', error);
      toast.error('Görev bilgileri alınamadı');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Lokasyon stoklarını yükle
  const loadLocationStock = async (plate, waitingPoint) => {
    try {
      // Araç plakasına göre stok getir
      const response = await stockAPI.getAll({ 
        location_detail: plate 
      });
      
      let items = response.data || [];
      
      // Bekleme noktası stoklarını da ekle
      if (waitingPoint) {
        const wpResponse = await stockAPI.getAll({ 
          location_detail: waitingPoint 
        });
        items = [...items, ...(wpResponse.data || [])];
      }
      
      setStockItems(items);
    } catch (error) {
      console.error('Stok yüklenemedi:', error);
      toast.error('Stok bilgileri alınamadı');
    }
  };

  useEffect(() => {
    loadMyAssignment();
  }, [loadMyAssignment]);

  // Arama/filtreleme
  const filteredItems = stockItems.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.gtin?.includes(searchQuery)
  );

  // Barkod arama
  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;
    
    try {
      const response = await medicationsAPI.parseBarcode(barcodeInput);
      const parsed = response.data;
      
      // Stokta bu GTIN'e sahip ürünü bul
      const found = stockItems.find(item => item.gtin === parsed.gtin);
      
      if (found) {
        setSelectedItem(found);
        toast.success(`${found.name} bulundu!`);
      } else {
        toast.warning('Bu ürün lokasyonunuzda bulunamadı');
      }
    } catch (error) {
      // Direkt arama yap
      setSearchQuery(barcodeInput);
    }
    
    setBarcodeInput('');
  };

  // Sayım modunu başlat
  const startCounting = () => {
    setCountingMode(true);
    // Mevcut stok miktarlarını başlangıç değeri olarak ayarla
    const initial = {};
    stockItems.forEach(item => {
      initial[item._id || item.id] = item.quantity;
    });
    setCountedItems(initial);
    toast.info('Sayım modu başladı. Stok miktarlarını güncelleyebilirsiniz.');
  };

  // Sayım iptal
  const cancelCounting = () => {
    setCountingMode(false);
    setCountedItems({});
  };

  // Sayım kaydet
  const saveCounting = async () => {
    try {
      setSavingCount(true);
      
      // Değişen öğeleri bul
      const changes = [];
      Object.entries(countedItems).forEach(([itemId, newQty]) => {
        const item = stockItems.find(i => (i._id || i.id) === itemId);
        if (item && item.quantity !== newQty) {
          changes.push({
            item_id: itemId,
            old_quantity: item.quantity,
            new_quantity: newQty,
            item_name: item.name
          });
        }
      });
      
      if (changes.length === 0) {
        toast.info('Değişiklik yapılmadı');
        setCountingMode(false);
        return;
      }
      
      // Her değişikliği kaydet
      for (const change of changes) {
        await stockAPI.update(change.item_id, { quantity: change.new_quantity });
      }
      
      toast.success(`${changes.length} ürün güncellendi`);
      
      // Stokları yeniden yükle
      if (myLocation?.plate) {
        await loadLocationStock(myLocation.plate, myLocation.waitingPoint);
      }
      
      setCountingMode(false);
      setCountedItems({});
    } catch (error) {
      console.error('Sayım kaydedilemedi:', error);
      toast.error('Sayım kaydedilemedi');
    } finally {
      setSavingCount(false);
    }
  };

  // Ürün detaylarını göster
  const showItemDetails = async (item) => {
    setSelectedItem(item);
    setLoadingDetails(true);
    
    try {
      const response = await stockAPI.getItemBarcodeDetails(
        myLocation?.plate || '',
        item.name
      );
      setItemDetails(response.data);
    } catch (error) {
      console.error('Detay yüklenemedi:', error);
      setItemDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Stok durumu badge'i
  const getStockBadge = (item) => {
    const now = new Date();
    const expiry = item.expiry_date ? new Date(item.expiry_date) : null;
    const daysToExpiry = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;
    
    if (item.quantity === 0) {
      return <Badge variant="destructive">Stok Yok</Badge>;
    }
    if (item.quantity <= item.min_quantity) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Kritik</Badge>;
    }
    if (expiry && daysToExpiry !== null && daysToExpiry < 0) {
      return <Badge variant="destructive">Süresi Dolmuş</Badge>;
    }
    if (expiry && daysToExpiry !== null && daysToExpiry <= 30) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Yakında Dolacak</Badge>;
    }
    return <Badge variant="outline" className="border-green-500 text-green-600">Normal</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Lokasyon bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!myLocation) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Lokasyon Bulunamadı
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 mb-4">
              Bugün için aktif bir araç atamanız bulunmuyor.
            </p>
            <p className="text-sm text-gray-500">
              Vardiya ataması yapıldıktan sonra lokasyon stoklarınızı buradan görebilirsiniz.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={loadMyAssignment}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lokasyon Stoğum</h1>
          <p className="text-gray-600 flex items-center gap-2 mt-1">
            <Truck className="h-4 w-4" />
            {myLocation.plate || myLocation.name}
            {myLocation.waitingPoint && (
              <>
                <MapPin className="h-4 w-4 ml-2" />
                {myLocation.waitingPoint}
              </>
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadMyAssignment}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
          
          {!countingMode ? (
            <Button onClick={startCounting} className="bg-blue-600 hover:bg-blue-700">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Sayım Yap
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelCounting}>
                İptal
              </Button>
              <Button 
                onClick={saveCounting} 
                disabled={savingCount}
                className="bg-green-600 hover:bg-green-700"
              >
                {savingCount ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Sayımı Kaydet
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Sayım Modu Uyarısı */}
      {countingMode && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-blue-800 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              <strong>Sayım Modu Aktif:</strong> Stok miktarlarını güncelleyebilirsiniz. İşlem bittiğinde "Sayımı Kaydet" butonuna tıklayın.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Arama */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label>Ürün Ara</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="İsim veya kod ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex-1">
              <Label>Karekod/Barkod</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Karekod okutun veya yapıştırın..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                />
                <Button variant="outline" onClick={handleBarcodeSearch}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <Package className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <div className="text-2xl font-bold text-blue-600">{stockItems.length}</div>
            <div className="text-sm text-gray-600">Toplam Ürün</div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-orange-600 mb-2" />
            <div className="text-2xl font-bold text-orange-600">
              {stockItems.filter(i => i.quantity <= i.min_quantity).length}
            </div>
            <div className="text-sm text-gray-600">Kritik Stok</div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto text-red-600 mb-2" />
            <div className="text-2xl font-bold text-red-600">
              {stockItems.filter(i => {
                if (!i.expiry_date) return false;
                const days = Math.ceil((new Date(i.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                return days < 0;
              }).length}
            </div>
            <div className="text-sm text-gray-600">Süresi Dolmuş</div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <div className="text-2xl font-bold text-green-600">
              {stockItems.filter(i => i.quantity > i.min_quantity).length}
            </div>
            <div className="text-sm text-gray-600">Normal</div>
          </CardContent>
        </Card>
      </div>

      {/* Stok Listesi */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stok Listesi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'Aramayla eşleşen ürün bulunamadı' : 'Bu lokasyonda stok bulunmuyor'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredItems.map((item) => (
                <div 
                  key={item._id || item.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  onClick={() => !countingMode && showItemDetails(item)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {getStockBadge(item)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Kod: {item.code || '-'} | 
                      Lot: {item.lot_number || '-'} | 
                      SKT: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {countingMode ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const id = item._id || item.id;
                            setCountedItems(prev => ({
                              ...prev,
                              [id]: Math.max(0, (prev[id] || 0) - 1)
                            }));
                          }}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          className="w-20 text-center"
                          value={countedItems[item._id || item.id] ?? item.quantity}
                          onChange={(e) => {
                            const id = item._id || item.id;
                            setCountedItems(prev => ({
                              ...prev,
                              [id]: parseInt(e.target.value) || 0
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const id = item._id || item.id;
                            setCountedItems(prev => ({
                              ...prev,
                              [id]: (prev[id] || 0) + 1
                            }));
                          }}
                        >
                          +
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {item.quantity}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.unit || 'adet'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ürün Detay Modalı */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500">Kod</Label>
                <p className="font-medium">{selectedItem?.code || '-'}</p>
              </div>
              <div>
                <Label className="text-gray-500">GTIN</Label>
                <p className="font-medium">{selectedItem?.gtin || '-'}</p>
              </div>
              <div>
                <Label className="text-gray-500">Miktar</Label>
                <p className="font-medium">{selectedItem?.quantity} {selectedItem?.unit || 'adet'}</p>
              </div>
              <div>
                <Label className="text-gray-500">Min. Miktar</Label>
                <p className="font-medium">{selectedItem?.min_quantity}</p>
              </div>
              <div>
                <Label className="text-gray-500">Lot No</Label>
                <p className="font-medium">{selectedItem?.lot_number || '-'}</p>
              </div>
              <div>
                <Label className="text-gray-500">SKT</Label>
                <p className="font-medium">
                  {selectedItem?.expiry_date 
                    ? new Date(selectedItem.expiry_date).toLocaleDateString('tr-TR')
                    : '-'
                  }
                </p>
              </div>
            </div>
            
            {/* Karekod Detayları */}
            {loadingDetails && (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}
            
            {itemDetails?.barcodes && itemDetails.barcodes.length > 0 && (
              <div>
                <Label className="text-gray-500 mb-2 block">Karekod Detayları</Label>
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {itemDetails.barcodes.map((bc, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <span className="font-mono">{bc.serial || bc.barcode}</span>
                      <span className="text-gray-500">
                        {bc.expiry_date 
                          ? new Date(bc.expiry_date).toLocaleDateString('tr-TR')
                          : '-'
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyLocationStock;

