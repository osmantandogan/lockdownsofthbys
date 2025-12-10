import React, { useState, useEffect, useCallback } from 'react';
import { stockAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  Truck, MapPin, AlertTriangle, Clock, Package, Plus, X,
  ChevronRight, AlertCircle, CheckCircle2, RefreshCw, QrCode,
  Calendar, Hash, Trash2
} from 'lucide-react';

/**
 * Stok Lokasyon Özeti Bileşeni
 * Araçlar ve bekleme noktalarındaki stok durumunu gösterir
 */
const StockLocationSummary = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationItems, setLocationItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Yeni lokasyon ekleme
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    type: 'vehicle',
    description: ''
  });

  // Yetkili roller
  const canAddLocation = ['operasyon_muduru', 'merkez_ofis', 'bas_sofor', 'cagri_merkezi'].includes(user?.role);
  const [cleaningUp, setCleaningUp] = useState(false);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await stockAPI.getLocationsSummary();
      setLocations(response.data);
    } catch (error) {
      console.error('Lokasyonlar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleLocationClick = async (location) => {
    setSelectedLocation(location);
    setSelectedItem(null);
    setItemDetails(null);
    setLoadingItems(true);
    
    try {
      const response = await stockAPI.getLocationItems(location.id);
      setLocationItems(response.data.items || []);
    } catch (error) {
      console.error('Lokasyon stokları yüklenemedi:', error);
      toast.error('Stoklar yüklenemedi');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleItemClick = async (item) => {
    if (selectedItem?.name === item.name) {
      // Aynı iteme tıklandıysa detayları göster
      setLoadingDetails(true);
      try {
        const response = await stockAPI.getItemBarcodeDetails(selectedLocation.id, item.name);
        setItemDetails(response.data);
      } catch (error) {
        console.error('Detaylar yüklenemedi:', error);
      } finally {
        setLoadingDetails(false);
      }
    } else {
      setSelectedItem(item);
      setItemDetails(null);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.name.trim()) {
      toast.error('Lokasyon adı gerekli');
      return;
    }
    
    try {
      await stockAPI.createLocation(newLocation);
      toast.success('Lokasyon eklendi');
      setAddDialogOpen(false);
      setNewLocation({ name: '', type: 'vehicle', description: '' });
      loadLocations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Lokasyon eklenemedi');
    }
  };

  // Eski "Bekleme Noktası" lokasyonlarını temizle
  const handleCleanupOldLocations = async () => {
    if (!window.confirm('Eski "PLAKA Bekleme Noktası" formatındaki lokasyonları silmek istediğinize emin misiniz?')) {
      return;
    }
    
    setCleaningUp(true);
    try {
      const response = await stockAPI.cleanupOldLocations();
      toast.success(response.data.message);
      loadLocations();
    } catch (error) {
      console.error('Temizleme hatası:', error);
      toast.error(error.response?.data?.detail || 'Eski lokasyonlar temizlenemedi');
    } finally {
      setCleaningUp(false);
    }
  };

  const getStatusBadge = (loc) => {
    if (loc.expired > 0) {
      return <Badge className="bg-red-500">Tarihi Geçmiş: {loc.expired}</Badge>;
    }
    if (loc.critical_stock > 0) {
      return <Badge className="bg-orange-500">Kritik: {loc.critical_stock}</Badge>;
    }
    if (loc.expiring_soon > 0) {
      return <Badge className="bg-yellow-500">Yakında Dolacak: {loc.expiring_soon}</Badge>;
    }
    return <Badge className="bg-green-500">Sorun Yok</Badge>;
  };

  const getTypeIcon = (type) => {
    if (type === 'vehicle') return <Truck className="h-5 w-5 text-blue-600" />;
    if (type === 'waiting_point') return <MapPin className="h-5 w-5 text-purple-600" />;
    return <Package className="h-5 w-5 text-gray-600" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Lokasyon Bazlı Stok</h3>
          <p className="text-sm text-gray-500">Araçlar ve bekleme noktalarındaki stok durumu</p>
        </div>
        <div className="flex gap-2">
          {canAddLocation && (
            <Button 
              variant="outline" 
              onClick={handleCleanupOldLocations}
              disabled={cleaningUp}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {cleaningUp ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eski Lokasyonları Temizle
            </Button>
          )}
          {canAddLocation && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Lokasyon Ekle
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Stok Lokasyonu</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Lokasyon Adı</Label>
                  <Input
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    placeholder="Örn: A Aracı, A Aracı Bekleme Noktası"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tip</Label>
                  <Select 
                    value={newLocation.type} 
                    onValueChange={(value) => setNewLocation({ ...newLocation, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vehicle">Araç</SelectItem>
                      <SelectItem value="waiting_point">Bekleme Noktası</SelectItem>
                      <SelectItem value="warehouse">Depo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Açıklama (Opsiyonel)</Label>
                  <Input
                    value={newLocation.description}
                    onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                    placeholder="Açıklama..."
                  />
                </div>
                <Button onClick={handleAddLocation} className="w-full">
                  Lokasyon Ekle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Lokasyon Listesi */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc) => (
          <Card 
            key={loc.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedLocation?.id === loc.id ? 'ring-2 ring-red-500' : ''
            } ${loc.has_issues ? 'border-orange-300' : ''}`}
            onClick={() => handleLocationClick(loc)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(loc.type)}
                  <div>
                    <h4 className="font-semibold">{loc.name}</h4>
                    <p className="text-xs text-gray-500 capitalize">{loc.type === 'vehicle' ? 'Araç' : loc.type === 'waiting_point' ? 'Bekleme Noktası' : 'Depo'}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="mt-3 flex flex-wrap gap-2">
                {loc.critical_stock > 0 && (
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Kritik: {loc.critical_stock}
                  </Badge>
                )}
                {loc.expired > 0 && (
                  <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Geçmiş: {loc.expired}
                  </Badge>
                )}
                {loc.expiring_soon > 0 && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                    <Clock className="h-3 w-3 mr-1" />
                    Yakında: {loc.expiring_soon}
                  </Badge>
                )}
                {!loc.has_issues && (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Sorun Yok
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {locations.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Henüz lokasyon eklenmemiş</p>
          </div>
        )}
      </div>

      {/* Seçili Lokasyonun Stokları (Popup 1) */}
      {selectedLocation && (
        <Card className="mt-4 border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getTypeIcon(selectedLocation.type)}
                <span>{selectedLocation.name} - Stok Listesi</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedLocation(null);
                  setLocationItems([]);
                  setSelectedItem(null);
                  setItemDetails(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loadingItems ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : locationItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Bu lokasyonda stok yok</p>
              </div>
            ) : (
              <ScrollArea className="h-60">
                <div className="space-y-2">
                  {/* İlaçları grupla */}
                  {Object.entries(
                    locationItems.reduce((acc, item) => {
                      const name = item.name || 'Bilinmeyen';
                      if (!acc[name]) acc[name] = { name, items: [], totalQty: 0 };
                      acc[name].items.push(item);
                      acc[name].totalQty += item.quantity || 1;
                      return acc;
                    }, {})
                  ).map(([name, group]) => (
                    <div 
                      key={name}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedItem?.name === name 
                          ? 'bg-red-50 border-red-300' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleItemClick({ name, ...group })}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Package className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-xs text-gray-500">{group.items.length} kayıt</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{group.totalQty} adet</Badge>
                          <p className="text-xs text-gray-400 mt-1">Detay için tıkla</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seçili İlacın Karekod Detayları (Popup 2) */}
      {itemDetails && (
        <Card className="mt-4 border-purple-200">
          <CardHeader className="bg-purple-50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <QrCode className="h-5 w-5 text-purple-600" />
                <span>{itemDetails.item_name} - Karekod Detayları</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setItemDetails(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Toplam Miktar:</span>
                  <Badge>{itemDetails.total_quantity} adet</Badge>
                </div>
                
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {itemDetails.details?.map((detail, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          detail.expiry_date && new Date(detail.expiry_date) < new Date()
                            ? 'bg-red-50 border-red-200'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <QrCode className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="font-mono text-sm">{detail.qr_code || detail.barcode || 'N/A'}</p>
                              {detail.lot_number && (
                                <p className="text-xs text-gray-500 flex items-center">
                                  <Hash className="h-3 w-3 mr-1" />
                                  LOT: {detail.lot_number}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {detail.expiry_date && (
                              <div className={`flex items-center text-xs ${
                                new Date(detail.expiry_date) < new Date() 
                                  ? 'text-red-600' 
                                  : 'text-gray-600'
                              }`}>
                                <Calendar className="h-3 w-3 mr-1" />
                                SKT: {formatDate(detail.expiry_date)}
                              </div>
                            )}
                            <Badge variant="outline" className="mt-1">
                              {detail.quantity || 1} {detail.unit || 'adet'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StockLocationSummary;

