import React, { useState, useEffect } from 'react';
import { warehouseAPI, vehiclesAPI, itsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Warehouse, QrCode, Package, TrendingDown, Clock, 
  AlertTriangle, Search, Plus, MapPin, ArrowRight,
  Scissors, Truck, RefreshCw, BarChart3, Box
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const WarehouseManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('stock');
  const [loading, setLoading] = useState(true);
  
  // Depo stoğu
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [stats, setStats] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // QR Ekleme
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingStock, setAddingStock] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [parsedQR, setParsedQR] = useState(null);
  const [boxQuantity, setBoxQuantity] = useState(1);
  const [itemsPerBox, setItemsPerBox] = useState(1);
  const [warehouseLocation, setWarehouseLocation] = useState('');
  
  // Parçalama
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [splitQuantity, setSplitQuantity] = useState(1);
  const [splitDestination, setSplitDestination] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [splitting, setSplitting] = useState(false);
  
  // Detay
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  
  // Erişim kontrolü
  const canManage = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);
  const canSplit = ['merkez_ofis', 'operasyon_muduru', 'cagri_merkezi', 'bas_sofor'].includes(user?.role);

  useEffect(() => {
    loadData();
    loadVehicles();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadWarehouseStock(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Veri yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouseStock = async () => {
    try {
      const response = await warehouseAPI.getStock({});
      setWarehouseStock(response.data?.items || []);
    } catch (error) {
      console.error('Depo stoğu yüklenemedi:', error);
      toast.error('Depo stoğu yüklenemedi');
    }
  };

  const loadStats = async () => {
    try {
      const response = await warehouseAPI.getStats();
      setStats(response.data || {});
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll();
      setVehicles(response.data || []);
    } catch (error) {
      console.error('Araçlar yüklenemedi:', error);
    }
  };

  // QR Parse ve Ekle
  const handleParseQR = async () => {
    if (!qrCode.trim()) {
      toast.error('QR kod girin');
      return;
    }
    
    try {
      const response = await warehouseAPI.parseQR({ qr_code: qrCode });
      setParsedQR(response.data);
      toast.success('QR kod başarıyla okundu!');
    } catch (error) {
      console.error('QR parse hatası:', error);
      toast.error(error.response?.data?.detail || 'QR kod okunamadı');
      setParsedQR(null);
    }
  };

  const handleAddStock = async () => {
    if (!parsedQR) {
      toast.error('Önce QR kodu okutun');
      return;
    }
    
    setAddingStock(true);
    try {
      await warehouseAPI.addStock({
        qr_code: qrCode,
        box_quantity: boxQuantity,
        items_per_box: itemsPerBox,
        warehouse_location: warehouseLocation,
        item_name: parsedQR.drug_name
      });
      
      toast.success('Depoya eklendi!');
      setShowAddDialog(false);
      setQrCode('');
      setParsedQR(null);
      setBoxQuantity(1);
      setItemsPerBox(1);
      setWarehouseLocation('');
      loadData();
    } catch (error) {
      console.error('Stok eklenemedi:', error);
      toast.error(error.response?.data?.detail || 'Stok eklenemedi');
    } finally {
      setAddingStock(false);
    }
  };

  // Parçalama başlat
  const openSplitDialog = (item) => {
    setSelectedItem(item);
    setSplitQuantity(1);
    setSplitDestination(null);
    setShowSplitDialog(true);
  };

  const handleSplit = async () => {
    if (!splitDestination) {
      toast.error('Hedef lokasyon seçin');
      return;
    }
    
    if (splitQuantity <= 0 || splitQuantity > selectedItem.remaining_items) {
      toast.error(`Geçerli miktar girin (1-${selectedItem.remaining_items})`);
      return;
    }
    
    setSplitting(true);
    try {
      const response = await warehouseAPI.splitBox(selectedItem.id, {
        quantity: splitQuantity,
        destination_id: splitDestination.id,
        destination_name: splitDestination.name,
        destination_type: splitDestination.type
      });
      
      toast.success(response.data.message);
      setShowSplitDialog(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Parçalama hatası:', error);
      toast.error(error.response?.data?.detail || 'Parçalama yapılamadı');
    } finally {
      setSplitting(false);
    }
  };

  // Detay göster
  const showDetail = async (item) => {
    try {
      const response = await warehouseAPI.getStockDetail(item.id);
      setDetailItem(response.data);
      setShowDetailDialog(true);
    } catch (error) {
      console.error('Detay yüklenemedi:', error);
      toast.error('Detay bilgiler alınamadı');
    }
  };

  // Filtreleme
  const filteredStock = warehouseStock.filter(item =>
    !searchQuery || 
    item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.gtin?.includes(searchQuery) ||
    item.lot_number?.includes(searchQuery)
  );

  // Durum badge
  const getStatusBadge = (item) => {
    const expiry = item.expiry_date ? new Date(item.expiry_date) : null;
    const now = new Date();
    
    if (item.status === 'empty') {
      return <Badge variant="destructive">Bitti</Badge>;
    }
    if (expiry && expiry < now) {
      return <Badge variant="destructive">Süresi Dolmuş</Badge>;
    }
    if (expiry) {
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        return <Badge className="bg-yellow-500">SKT: {daysLeft} gün</Badge>;
      }
    }
    if (item.is_opened) {
      return <Badge className="bg-orange-500">Açılmış</Badge>;
    }
    return <Badge variant="outline" className="border-green-500 text-green-600">Aktif</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Warehouse className="h-7 w-7" />
            Merkez Depo Yönetimi
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            İTS QR kodlu stok takibi ve parçalama
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
          
          {canManage && (
            <Button onClick={() => setShowAddDialog(true)} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              QR Ekle
            </Button>
          )}
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <Box className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <div className="text-2xl font-bold text-blue-600">{stats.total_boxes || 0}</div>
            <div className="text-sm text-gray-600">Toplam Kutu</div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <Package className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <div className="text-2xl font-bold text-green-600">{stats.total_items || 0}</div>
            <div className="text-sm text-gray-600">Toplam Adet</div>
          </CardContent>
        </Card>
        
        <Card className="border-yellow-200">
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
            <div className="text-2xl font-bold text-yellow-600">{stats.expiring_soon || 0}</div>
            <div className="text-sm text-gray-600">Yakında Dolacak</div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-600 mb-2" />
            <div className="text-2xl font-bold text-red-600">{stats.expired || 0}</div>
            <div className="text-sm text-gray-600">Süresi Dolmuş</div>
          </CardContent>
        </Card>
      </div>

      {/* Arama */}
      <Card>
        <CardContent className="p-4">
          <Label>Ürün Ara</Label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="İlaç adı, GTIN veya lot numarası ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stok Listesi */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Depo Stoğu ({filteredStock.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStock.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Depo stoğu bulunamadı
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filteredStock.map((item) => (
                <div 
                  key={item.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => showDetail(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.item_name}</span>
                        {getStatusBadge(item)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        GTIN: {item.gtin} | Lot: {item.lot_number} | 
                        Raf: {item.warehouse_location || '-'}
                      </div>
                      <div className="text-sm text-gray-500">
                        SKT: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('tr-TR') : '-'}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">
                          {item.remaining_items}
                        </div>
                        <div className="text-xs text-gray-500">
                          / {item.total_items} adet
                        </div>
                        <div className="text-xs text-gray-500">
                          ({item.box_quantity} kutu)
                        </div>
                      </div>
                      
                      {canSplit && item.remaining_items > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSplitDialog(item);
                          }}
                        >
                          <Scissors className="h-4 w-4 mr-1" />
                          Parçala
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Ekleme Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Depoya QR ile Stok Ekle</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>İTS QR Kod</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="QR kodu okutun veya yapıştırın..."
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleParseQR()}
                />
                <Button onClick={handleParseQR}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {parsedQR && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="font-medium text-green-800">✓ QR Kod Okundu</p>
                  <div className="text-sm text-gray-700 mt-2 space-y-1">
                    <p><strong>İlaç:</strong> {parsedQR.drug_name || 'Bilinmiyor'}</p>
                    <p><strong>GTIN:</strong> {parsedQR.gtin}</p>
                    <p><strong>Lot:</strong> {parsedQR.lot_number}</p>
                    <p><strong>SKT:</strong> {parsedQR.expiry_date || '-'}</p>
                    {parsedQR.its_verified && (
                      <Badge className="bg-green-600 mt-2">İTS Doğrulandı</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {parsedQR && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Kutu Sayısı</Label>
                    <Input
                      type="number"
                      min="1"
                      value={boxQuantity}
                      onChange={(e) => setBoxQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label>Kutudaki Adet</Label>
                    <Input
                      type="number"
                      min="1"
                      value={itemsPerBox}
                      onChange={(e) => setItemsPerBox(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Raf Konumu (Opsiyonel)</Label>
                  <Input
                    placeholder="örn: Raf-A-12, Dolap-3"
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                  />
                </div>
                
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>Toplam:</strong> {boxQuantity} × {itemsPerBox} = <strong>{boxQuantity * itemsPerBox} adet</strong>
                  </p>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              İptal
            </Button>
            {parsedQR && (
              <Button 
                onClick={handleAddStock} 
                disabled={addingStock}
                className="bg-green-600 hover:bg-green-700"
              >
                {addingStock ? 'Ekleniyor...' : 'Depoya Ekle'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parçalama Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kutu Parçala ve Gönder</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <Card className="bg-gray-50">
                <CardContent className="p-4">
                  <p className="font-medium">{selectedItem.item_name}</p>
                  <p className="text-sm text-gray-600">
                    Kalan: <strong>{selectedItem.remaining_items} adet</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    Lot: {selectedItem.lot_number} | SKT: {new Date(selectedItem.expiry_date).toLocaleDateString('tr-TR')}
                  </p>
                </CardContent>
              </Card>
              
              <div>
                <Label>Gönderilecek Miktar (Adet)</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedItem.remaining_items}
                  value={splitQuantity}
                  onChange={(e) => setSplitQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              
              <div>
                <Label>Hedef Lokasyon</Label>
                <Select onValueChange={(value) => {
                  const [type, id] = value.split('::');
                  const vehicle = vehicles.find(v => v._id === id || v.id === id);
                  setSplitDestination({
                    type: type,
                    id: id,
                    name: vehicle?.plate || id
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Araç veya bekleme noktası seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2 text-xs text-gray-500 font-medium">ARAÇLAR</div>
                    {vehicles.filter(v => v.type === 'ambulans').map((v) => (
                      <SelectItem key={v._id || v.id} value={`vehicle::${v._id || v.id}`}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          {v.plate}
                        </div>
                      </SelectItem>
                    ))}
                    <div className="p-2 text-xs text-gray-500 font-medium border-t mt-1">BEKLEME NOKTALARI</div>
                    <SelectItem value="waiting_point::osman_gazi_fpu">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Osman Gazi/FPU
                      </div>
                    </SelectItem>
                    <SelectItem value="waiting_point::green_zone_ronesans">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Green Zone/Rönesans
                      </div>
                    </SelectItem>
                    <SelectItem value="waiting_point::bati_kuzey_isg">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Batı-Kuzey/İSG BİNA
                      </div>
                    </SelectItem>
                    <SelectItem value="waiting_point::red_zone_kara">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Red Zone/Kara Tesisleri
                      </div>
                    </SelectItem>
                    <SelectItem value="waiting_point::dogu_rihtimi">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Doğu Rıhtımı
                      </div>
                    </SelectItem>
                    <SelectItem value="waiting_point::filyos_saglik_merkezi">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Filyos Sağlık Merkezi
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {splitDestination && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-blue-800">
                      <strong>{splitQuantity} adet</strong> → <strong>{splitDestination.name}</strong>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Internal QR otomatik oluşturulacak
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitDialog(false)}>
              İptal
            </Button>
            <Button 
              onClick={handleSplit} 
              disabled={splitting || !splitDestination}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {splitting ? (
                <>
                  <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Parçala ve Gönder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detay Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailItem?.item_name}</DialogTitle>
          </DialogHeader>
          
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">GTIN</Label>
                  <p className="font-medium">{detailItem.gtin}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Lot Numarası</Label>
                  <p className="font-medium">{detailItem.lot_number}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Son Kullanma Tarihi</Label>
                  <p className="font-medium">
                    {new Date(detailItem.expiry_date).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Raf Konumu</Label>
                  <p className="font-medium">{detailItem.warehouse_location || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Kalan/Toplam</Label>
                  <p className="font-medium">{detailItem.remaining_items} / {detailItem.total_items} adet</p>
                </div>
                <div>
                  <Label className="text-gray-500">Kutu Sayısı</Label>
                  <p className="font-medium">{detailItem.box_quantity} kutu</p>
                </div>
              </div>
              
              {detailItem.split_history && detailItem.split_history.length > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-gray-500 mb-2 block">Parçalama Geçmişi</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detailItem.split_history.map((split, idx) => (
                      <div key={idx} className="text-sm bg-gray-50 p-2 rounded">
                        <p>
                          <strong>{split.quantity_split} adet</strong> → {split.destination_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {split.split_by_name} - {new Date(split.split_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseManagement;

