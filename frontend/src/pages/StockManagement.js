import React, { useState, useEffect } from 'react';
import { stockNewAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Package, MapPin, Truck, Building2, Search, RefreshCw, 
  AlertTriangle, CheckCircle, Clock, Loader2, ChevronRight,
  Box, Pill, Droplet, Wrench, XCircle, Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Kategori ikonları
const categoryIcons = {
  ilac: Pill,
  sarf: Package,
  serum: Droplet,
  tibbi_cihaz: Wrench,
  malzeme: Box
};

// Kategori renkleri
const categoryColors = {
  ilac: 'bg-purple-100 text-purple-800',
  sarf: 'bg-blue-100 text-blue-800',
  serum: 'bg-cyan-100 text-cyan-800',
  tibbi_cihaz: 'bg-orange-100 text-orange-800',
  malzeme: 'bg-gray-100 text-gray-800'
};

const StockManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('locations');
  const [loading, setLoading] = useState(true);
  
  // Lokasyonlar
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetailOpen, setLocationDetailOpen] = useState(false);
  const [locationStock, setLocationStock] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Stok Listesi
  const [allStock, setAllStock] = useState([]);
  const [stockSearch, setStockSearch] = useState('');
  
  // Talepler
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetailOpen, setRequestDetailOpen] = useState(false);
  
  // Erişim kontrolü
  const canManage = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadLocations(),
        loadAllStock(),
        loadRequests()
      ]);
    } catch (error) {
      console.error('Veri yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const response = await stockNewAPI.getAllLocations();
      setLocations(response.data?.locations || []);
    } catch (error) {
      console.error('Lokasyonlar yüklenemedi:', error);
      toast.error('Lokasyonlar yüklenemedi');
    }
  };

  const loadAllStock = async () => {
    try {
      const response = await stockNewAPI.getAllLocations();
      const locs = response.data?.locations || [];
      
      // Tüm stokları birleştir
      const allItems = {};
      for (const loc of locs) {
        for (const item of loc.items || []) {
          const name = item.name;
          if (!allItems[name]) {
            allItems[name] = {
              name,
              category: item.category || 'sarf',
              total_quantity: 0,
              locations: []
            };
          }
          allItems[name].total_quantity += item.quantity || 0;
          allItems[name].locations.push({
            name: loc.location_name,
            type: loc.location_type,
            quantity: item.quantity || 0
          });
        }
      }
      
      setAllStock(Object.values(allItems));
    } catch (error) {
      console.error('Stoklar yüklenemedi:', error);
    }
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const response = await stockNewAPI.getRequests({});
      setRequests(response.data?.requests || []);
    } catch (error) {
      console.error('Talepler yüklenemedi:', error);
      toast.error('Talepler yüklenemedi');
    } finally {
      setRequestsLoading(false);
    }
  };

  const openLocationDetail = async (location) => {
    setSelectedLocation(location);
    setLocationDetailOpen(true);
    setLoadingDetail(true);
    
    try {
      const response = await stockNewAPI.getLocationStock(location.location_id);
      setLocationStock(response.data);
    } catch (error) {
      console.error('Lokasyon detayı yüklenemedi:', error);
      toast.error('Detaylar yüklenemedi');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await stockNewAPI.approveRequest(requestId);
      toast.success('Talep onaylandı');
      loadRequests();
      setRequestDetailOpen(false);
    } catch (error) {
      toast.error('Onaylama başarısız: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await stockNewAPI.rejectRequest(requestId);
      toast.success('Talep reddedildi');
      loadRequests();
      setRequestDetailOpen(false);
    } catch (error) {
      toast.error('Reddetme başarısız: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeliverRequest = async (requestId) => {
    try {
      await stockNewAPI.deliverRequest(requestId);
      toast.success('Talep teslim edildi');
      loadRequests();
      setRequestDetailOpen(false);
      // Lokasyonları yeniden yükle (stoklar değişti)
      loadLocations();
      loadAllStock();
    } catch (error) {
      toast.error('Teslim işlemi başarısız: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Filtrelenmiş stok listesi
  const filteredStock = allStock.filter(item => 
    !stockSearch || item.name.toLowerCase().includes(stockSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7" />
            Stok Yönetimi
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Araç ve lokasyon bazlı stok takibi
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Özet Kartları */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{locations.length}</p>
                <p className="text-sm text-gray-500">Lokasyon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allStock.length}</p>
                <p className="text-sm text-gray-500">Ürün Çeşidi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {locations.reduce((sum, l) => sum + (l.critical_count || 0), 0)}
                </p>
                <p className="text-sm text-gray-500">Kritik Stok</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {requests.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-500">Bekleyen Talep</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ana İçerik */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Lokasyonlar
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stok Listesi
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Talepler
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {requests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* LOKASYONLAR TAB */}
        <TabsContent value="locations" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <MapPin className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Henüz lokasyon stoğu yok</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Sistem başlatıldığında otomatik oluşturulacak
                  </p>
                </CardContent>
              </Card>
            ) : (
              locations.map((loc) => (
                <Card 
                  key={loc.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openLocationDetail(loc)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          loc.location_type === 'vehicle' 
                            ? 'bg-blue-100' 
                            : 'bg-purple-100'
                        }`}>
                          {loc.location_type === 'vehicle' ? (
                            <Truck className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Building2 className="h-5 w-5 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{loc.location_name}</h3>
                          <p className="text-sm text-gray-500">
                            {loc.location_type === 'vehicle' ? 'Ambulans' : 'Bekleme Noktası'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    <div className="mt-4 flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        {loc.total_items || 0} ürün
                      </span>
                      {loc.critical_count > 0 && (
                        <Badge variant="destructive">
                          {loc.critical_count} kritik
                        </Badge>
                      )}
                      {loc.missing_count > 0 && loc.critical_count === 0 && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          {loc.missing_count} eksik
                        </Badge>
                      )}
                      {loc.critical_count === 0 && loc.missing_count === 0 && (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Tam
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* STOK LİSTESİ TAB */}
        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tüm Stoklar</CardTitle>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Ürün ara..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredStock.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Stok bulunamadı</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStock.map((item, idx) => {
                    const CategoryIcon = categoryIcons[item.category] || Package;
                    const colorClass = categoryColors[item.category] || categoryColors.sarf;
                    
                    return (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${colorClass}`}>
                            <CategoryIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              {item.locations?.length || 0} lokasyonda mevcut
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{item.total_quantity}</p>
                          <p className="text-xs text-gray-500">toplam</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TALEPLER TAB */}
        <TabsContent value="requests" className="mt-4">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Send className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Henüz talep yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <Card 
                  key={req.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedRequest(req);
                    setRequestDetailOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            req.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                            req.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }>
                            {req.status === 'pending' ? 'Beklemede' :
                             req.status === 'approved' ? 'Onaylandı' :
                             req.status === 'delivered' ? 'Teslim Edildi' : 'Reddedildi'}
                          </Badge>
                          {req.case_no && (
                            <Badge variant="outline">Vaka #{req.case_no}</Badge>
                          )}
                        </div>
                        <h3 className="font-semibold">{req.location_name}</h3>
                        <p className="text-sm text-gray-500">
                          {req.items?.length || 0} ürün • {req.requester_name}
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {new Date(req.created_at).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Lokasyon Detay Dialog */}
      <Dialog open={locationDetailOpen} onOpenChange={setLocationDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLocation?.location_type === 'vehicle' ? (
                <Truck className="h-5 w-5" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
              {selectedLocation?.location_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : locationStock ? (
            <div className="space-y-4">
              {/* Kategorilere göre listele */}
              {Object.entries(locationStock.items_by_category || {}).map(([category, items]) => {
                if (!items || items.length === 0) return null;
                const CategoryIcon = categoryIcons[category] || Package;
                
                return (
                  <div key={category}>
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-gray-700">
                      <CategoryIcon className="h-4 w-4" />
                      {category === 'ilac' ? 'İlaçlar' :
                       category === 'sarf' ? 'Sarf Malzemeleri' :
                       category === 'serum' ? 'Serumlar' :
                       category === 'tibbi_cihaz' ? 'Tıbbi Cihazlar' :
                       category === 'malzeme' ? 'Malzemeler' : 'Diğer'}
                      <Badge variant="outline">{items.length}</Badge>
                    </h4>
                    <div className="grid gap-2">
                      {items.map((item, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            item.is_critical ? 'bg-red-50' :
                            item.is_low ? 'bg-yellow-50' : 'bg-gray-50'
                          }`}
                        >
                          <span className={item.is_critical ? 'text-red-700' : ''}>
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${
                              item.is_critical ? 'text-red-600' :
                              item.is_low ? 'text-yellow-600' : ''
                            }`}>
                              {item.quantity}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-500 text-sm">
                              {item.min_quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Veri bulunamadı</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Talep Detay Dialog */}
      <Dialog open={requestDetailOpen} onOpenChange={setRequestDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Talep Detayı</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={
                  selectedRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  selectedRequest.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                  selectedRequest.status === 'delivered' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }>
                  {selectedRequest.status === 'pending' ? 'Beklemede' :
                   selectedRequest.status === 'approved' ? 'Onaylandı' :
                   selectedRequest.status === 'delivered' ? 'Teslim Edildi' : 'Reddedildi'}
                </Badge>
                {selectedRequest.case_no && (
                  <Badge variant="outline">Vaka #{selectedRequest.case_no}</Badge>
                )}
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p><strong>Lokasyon:</strong> {selectedRequest.location_name}</p>
                <p><strong>Talep Eden:</strong> {selectedRequest.requester_name}</p>
                <p><strong>Tarih:</strong> {new Date(selectedRequest.created_at).toLocaleString('tr-TR')}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Talep Edilen Ürünler</h4>
                <div className="space-y-2">
                  {selectedRequest.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>{item.name}</span>
                      <span className="font-medium">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {canManage && selectedRequest?.status === 'pending' && (
            <DialogFooter className="gap-2">
              <Button 
                variant="destructive" 
                onClick={() => handleRejectRequest(selectedRequest.id)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reddet
              </Button>
              <Button 
                onClick={() => handleApproveRequest(selectedRequest.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Onayla
              </Button>
            </DialogFooter>
          )}
          
          {canManage && selectedRequest?.status === 'approved' && (
            <DialogFooter>
              <Button onClick={() => handleDeliverRequest(selectedRequest.id)}>
                <Truck className="h-4 w-4 mr-2" />
                Teslim Edildi
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockManagement;
