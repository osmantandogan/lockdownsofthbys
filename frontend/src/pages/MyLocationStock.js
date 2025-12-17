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
  Search,
  Truck,
  MapPin,
  RefreshCw,
  ClipboardCheck,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { stockNewAPI } from '../api';

/**
 * ATT/Paramedik için Lokasyon Stok Kontrolü
 * Sadece kendi araç/bekleme noktası stoklarını görebilirler
 * Önceki sayımları göremezler - sadece güncel stok ve yeni sayım
 */
const MyLocationStock = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accessibleLocations, setAccessibleLocations] = useState([]); // Erişebildiğim tüm lokasyonlar
  const [selectedLocation, setSelectedLocation] = useState(null); // Seçili lokasyon
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sayım modu
  const [countingMode, setCountingMode] = useState(false);
  const [countedItems, setCountedItems] = useState({});
  const [savingCount, setSavingCount] = useState(false);
  
  // Detay modalı
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Erişebildiğim tüm lokasyonları yükle
  const loadAccessibleLocations = useCallback(async () => {
    try {
      setLoading(true);
      
      // Yeni API endpoint'i - backend vardiya kontrolü yapıyor
      const response = await stockNewAPI.getMyAccessibleLocations();
      const data = response.data || {};
      
      const locations = data.locations || [];
      setAccessibleLocations(locations);
      
      // İlk lokasyonu varsayılan olarak seç
      if (locations.length > 0) {
        setSelectedLocation(locations[0]);
      } else {
        toast.info('Bugün için aktif bir vardiya atamanız bulunmuyor');
      }
      
    } catch (error) {
      console.error('Lokasyonlar yüklenemedi:', error);
      toast.error('Lokasyon bilgileri alınamadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccessibleLocations();
  }, [loadAccessibleLocations]);

  // Arama/filtreleme
  const stockItems = selectedLocation?.items || [];
  const filteredItems = stockItems.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sayım modunu başlat
  const startCounting = () => {
    setCountingMode(true);
    // Mevcut stok miktarlarını başlangıç değeri olarak ayarla (isim bazlı)
    const initial = {};
    stockItems.forEach(item => {
      initial[item.name] = item.quantity;
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
      
      if (!selectedLocation) {
        toast.error('Lokasyon seçilmedi');
        return;
      }
      
      // Güncellenmiş itemları hazırla
      const updatedItems = stockItems.map(item => {
        const itemKey = item.name; // İsme göre eşleştir
        const countedQty = countedItems[itemKey];
        
        return {
          name: item.name,
          quantity: countedQty !== undefined ? countedQty : item.quantity
        };
      });
      
      // Yeni API'ye gönder
      await stockNewAPI.updateLocationStock(selectedLocation.location_id, {
        items: updatedItems
      });
      
      toast.success('Sayım kaydedildi');
      
      // Stokları yeniden yükle
      await loadAccessibleLocations();
      
      setCountingMode(false);
      setCountedItems({});
    } catch (error) {
      console.error('Sayım kaydedilemedi:', error);
      toast.error(error.response?.data?.detail || 'Sayım kaydedilemedi');
    } finally {
      setSavingCount(false);
    }
  };

  // Ürün detaylarını göster
  const showItemDetails = (item) => {
    setSelectedItem(item);
  };

  // Stok durumu badge'i
  const getStockBadge = (item) => {
    if (!item) return null;
    
    if (item.quantity === 0) {
      return <Badge variant="destructive">Stok Yok</Badge>;
    }
    if (item.quantity < item.min_quantity) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Kritik</Badge>;
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

  if (!selectedLocation && accessibleLocations.length === 0) {
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
              Bugün için aktif bir vardiya atamanız bulunmuyor.
            </p>
            <p className="text-sm text-gray-500">
              Vardiya ataması yapıldıktan sonra lokasyon stoklarınızı buradan görebilirsiniz.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={loadAccessibleLocations}
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
      {/* Başlık ve Lokasyon Seçici */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Lokasyon Stoğum</h1>
          
          {/* Lokasyon Seçici */}
          {accessibleLocations.length > 1 ? (
            <div className="mt-3">
              <Label className="text-sm text-gray-600 mb-2 block">Lokasyon Seçin:</Label>
              <div className="flex gap-2">
                {accessibleLocations.map((loc, idx) => (
                  <Button
                    key={idx}
                    variant={selectedLocation?.location_id === loc.location_id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedLocation(loc)}
                    className="flex items-center gap-2"
                  >
                    {loc.location_type === 'vehicle' ? (
                      <Truck className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    {loc.location_name}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-600 flex items-center gap-2 mt-1">
              {selectedLocation?.location_type === 'vehicle' ? (
                <Truck className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {selectedLocation?.location_name}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAccessibleLocations}>
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
          <Label>Ürün Ara</Label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Ürün adı ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              {stockItems.filter(i => i.quantity < i.min_quantity).length}
            </div>
            <div className="text-sm text-gray-600">Kritik Stok</div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-600 mb-2" />
            <div className="text-2xl font-bold text-red-600">
              {stockItems.filter(i => i.quantity === 0).length}
            </div>
            <div className="text-sm text-gray-600">Stok Yok</div>
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
                    <div className="text-sm text-gray-500 mt-1 capitalize">
                      Kategori: {item.category || '-'} | Min: {item.min_quantity} {item.unit || 'ADET'}
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
                            const itemName = item.name;
                            setCountedItems(prev => ({
                              ...prev,
                              [itemName]: Math.max(0, (prev[itemName] ?? item.quantity) - 1)
                            }));
                          }}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          className="w-20 text-center"
                          value={countedItems[item.name] ?? item.quantity}
                          onChange={(e) => {
                            const itemName = item.name;
                            setCountedItems(prev => ({
                              ...prev,
                              [itemName]: parseInt(e.target.value) || 0
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const itemName = item.name;
                            setCountedItems(prev => ({
                              ...prev,
                              [itemName]: (prev[itemName] ?? item.quantity) + 1
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
                          {item.unit || 'ADET'}
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
                <Label className="text-gray-500">Mevcut Miktar</Label>
                <p className="text-2xl font-bold text-blue-600">{selectedItem?.quantity}</p>
              </div>
              <div>
                <Label className="text-gray-500">Birim</Label>
                <p className="text-xl font-medium">{selectedItem?.unit || 'ADET'}</p>
              </div>
              <div>
                <Label className="text-gray-500">Minimum Miktar</Label>
                <p className="font-medium text-orange-600">{selectedItem?.min_quantity}</p>
              </div>
              <div>
                <Label className="text-gray-500">Kategori</Label>
                <p className="font-medium capitalize">{selectedItem?.category || '-'}</p>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-gray-500 mb-2 block">Stok Durumu</Label>
              {getStockBadge(selectedItem || {})}
            </div>
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


