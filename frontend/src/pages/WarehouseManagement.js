import React, { useState, useEffect } from 'react';
import { warehouseAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Warehouse, QrCode, Package, TrendingDown, Clock, 
  AlertTriangle, Search, Plus, MapPin, ArrowRight,
  Scissors, Truck, RefreshCw, BarChart3, Box, Trash2
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
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, split, empty
  
  // QR Ekleme
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingStock, setAddingStock] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [parsedQR, setParsedQR] = useState(null);
  const [boxQuantity, setBoxQuantity] = useState(1);
  const [itemsPerBox, setItemsPerBox] = useState(1);
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  
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
  
  // İtriyat listesi
  const [suppliesList, setSuppliesList] = useState([]);
  const [suppliesLoading, setSuppliesLoading] = useState(false);
  const [showAddSupplyDialog, setShowAddSupplyDialog] = useState(false);
  const [newSupply, setNewSupply] = useState({
    item_name: '',
    quantity: 1,
    unit: 'ADET',
    category: 'sarf',
    warehouse_location: ''
  });
  const [addingSupply, setAddingSupply] = useState(false);
  
  // Toplu Giriş
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [bulkQRText, setBulkQRText] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  
  // Erişim kontrolü
  const canManage = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);
  const canSplit = ['merkez_ofis', 'operasyon_muduru', 'cagri_merkezi', 'bas_sofor'].includes(user?.role);

  useEffect(() => {
    loadData();
    loadVehicles();
    loadSuppliesList();
  }, []);
  
  const loadSuppliesList = async () => {
    setSuppliesLoading(true);
    try {
      const response = await warehouseAPI.getSuppliesList();
      setSuppliesList(response.data.supplies || []);
    } catch (error) {
      console.error('İtriyat listesi yüklenemedi:', error);
      toast.error('İtriyat listesi yüklenemedi');
    } finally {
      setSuppliesLoading(false);
    }
  };
  
  const handleAddSupply = async () => {
    if (!newSupply.item_name.trim()) {
      toast.error('Ürün adı gerekli');
      return;
    }
    
    setAddingSupply(true);
    try {
      await warehouseAPI.addSupply(newSupply);
      toast.success('İtriyat başarıyla eklendi');
      setShowAddSupplyDialog(false);
      setNewSupply({
        item_name: '',
        quantity: 1,
        unit: 'ADET',
        category: 'sarf',
        warehouse_location: ''
      });
      loadSuppliesList();
    } catch (error) {
      console.error('İtriyat eklenemedi:', error);
      toast.error(error.response?.data?.detail || 'İtriyat eklenemedi');
    } finally {
      setAddingSupply(false);
    }
  };
  
  const handleDeleteSupply = async (supplyId) => {
    if (!confirm('Bu itriyatı silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    try {
      await warehouseAPI.deleteSupply(supplyId);
      toast.success('İtriyat silindi');
      loadSuppliesList();
    } catch (error) {
      console.error('İtriyat silinemedi:', error);
      toast.error(error.response?.data?.detail || 'İtriyat silinemedi');
    }
  };

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
      const parsed = response.data;
      setParsedQR(parsed);
      
      // Eğer QR'dan kutudaki adet bilgisi gelmişse otomatik doldur
      if (parsed.quantity && parsed.quantity < 1000) {  // Makul bir değer kontrolü
        setItemsPerBox(parsed.quantity);
        toast.success(`QR okundu! Kutuda ${parsed.quantity} adet`);
      } else {
        toast.success('QR kod başarıyla okundu!');
      }
      
      // İlaç adını da set et
      setManualItemName(parsed.drug_name || '');
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
    
    if (!manualItemName.trim()) {
      toast.error('İlaç adı gerekli');
      return;
    }
    
    setAddingStock(true);
    try {
      await warehouseAPI.addStock({
        qr_code: qrCode,
        box_quantity: boxQuantity,
        items_per_box: itemsPerBox,
        warehouse_location: warehouseLocation,
        item_name: manualItemName.trim()
      });
      
      toast.success('Depoya eklendi!');
      setShowAddDialog(false);
      setQrCode('');
      setParsedQR(null);
      setManualItemName('');
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

  // Toplu QR Girişi
  const handleBulkAdd = async () => {
    if (!bulkQRText.trim()) {
      toast.error('QR kodlarını girin (her satırda bir QR)');
      return;
    }
    
    setBulkProcessing(true);
    const qrLines = bulkQRText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    
    const results = {
      success: [],
      errors: [],
      total: qrLines.length
    };
    
    for (let i = 0; i < qrLines.length; i++) {
      const qr = qrLines[i];
      
      try {
        // QR'ı parse et
        const parseResponse = await warehouseAPI.parseQR({ qr_code: qr });
        const parsed = parseResponse.data;
        
        // İlaç adı yoksa atla
        if (!parsed.drug_name) {
          results.errors.push({
            qr: qr,
            error: 'İlaç adı İTS\'den alınamadı, manuel eklemelisiniz'
          });
          continue;
        }
        
        // Adet kontrolü - makul bir değer mi
        let itemsPerBox = 10; // varsayılan
        if (parsed.quantity && parsed.quantity > 0 && parsed.quantity < 1000) {
          itemsPerBox = parsed.quantity;
        }
        
        // Depoya ekle
        await warehouseAPI.addStock({
          qr_code: qr,
          box_quantity: 1,
          items_per_box: itemsPerBox,
          warehouse_location: '',
          item_name: parsed.drug_name
        });
        
        results.success.push({
          qr: qr,
          name: parsed.drug_name,
          quantity: itemsPerBox
        });
        
      } catch (error) {
        results.errors.push({
          qr: qr,
          error: error.response?.data?.detail || error.message || 'Hata'
        });
      }
    }
    
    setBulkResults(results);
    setBulkProcessing(false);
    
    if (results.success.length > 0) {
      toast.success(`${results.success.length} QR başarıyla eklendi!`);
      loadData();
    }
    
    if (results.errors.length > 0) {
      toast.error(`${results.errors.length} QR eklenemedi`);
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
      
      const internalQR = response.data.internal_qr;
      
      // Internal QR'ı göster
      toast.success(
        <div>
          <p>{response.data.message}</p>
          <p className="text-xs mt-2 font-mono bg-gray-100 p-2 rounded">
            Internal QR: {internalQR}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Araç ekibi bu QR'ı kullanarak stok kullanabilir
          </p>
        </div>,
        { duration: 8000 }
      );
      
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

  const handleDelete = async (itemId) => {
    if (!confirm('Bu ürünü depodan silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    try {
      await warehouseAPI.deleteStock(itemId);
      toast.success('Ürün silindi');
      setShowDetailDialog(false);
      loadData();
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error(error.response?.data?.detail || 'Ürün silinemedi');
    }
  };

  // Filtreleme
  const filteredStock = warehouseStock.filter(item => {
    // Arama filtresi
    const matchesSearch = !searchQuery || 
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.gtin?.includes(searchQuery) ||
      item.lot_number?.includes(searchQuery);
    
    // Durum filtresi
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && item.remaining_items === item.total_items) ||
      (statusFilter === 'split' && item.is_opened && item.remaining_items > 0) ||
      (statusFilter === 'empty' && item.remaining_items === 0);
    
    return matchesSearch && matchesStatus;
  });

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
            <>
              <Button onClick={() => setShowAddDialog(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                QR Ekle
              </Button>
              <Button onClick={() => setShowBulkAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                <Package className="h-4 w-4 mr-2" />
                Toplu Giriş
              </Button>
            </>
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

      {/* Arama ve Filtre */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
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
          </div>
          
          <div>
            <Label className="mb-2 block">Durum Filtresi</Label>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                Tümü ({warehouseStock.length})
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
              >
                Tam ({warehouseStock.filter(i => i.remaining_items === i.total_items).length})
              </Button>
              <Button
                variant={statusFilter === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('split')}
                className="border-orange-500 text-orange-600"
              >
                Parçalı ({warehouseStock.filter(i => i.is_opened && i.remaining_items > 0).length})
              </Button>
              <Button
                variant={statusFilter === 'empty' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('empty')}
              >
                Bitti ({warehouseStock.filter(i => i.remaining_items === 0).length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stock">İlaç Stoğu</TabsTrigger>
          <TabsTrigger value="supplies">İtriyat Listesi</TabsTrigger>
        </TabsList>
        
        <TabsContent value="stock" className="space-y-4">
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
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${item.is_opened && item.remaining_items > 0 ? 'border-l-4 border-orange-400' : ''}`}
                  onClick={() => showDetail(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.item_name}</span>
                        {getStatusBadge(item)}
                        {item.is_opened && item.remaining_items > 0 && (
                          <Badge className="bg-orange-100 text-orange-700">
                            <Scissors className="h-3 w-3 mr-1" />
                            Parçalandı
                          </Badge>
                        )}
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
                        {item.items_per_box && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            Kutu başına: {item.items_per_box} adet
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
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
                        {canManage && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
                                handleDelete(item.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        
        <TabsContent value="supplies" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Button 
                onClick={() => setShowAddSupplyDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                İtriyat Ekle
              </Button>
            )}
          </div>
          
          <Card>
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                İtriyat ve Sarf Malzemeleri ({suppliesList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {suppliesLoading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : suppliesList.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  İtriyat listesi bulunamadı
                </div>
              ) : (
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {suppliesList.map((item) => (
                    <div key={item.id || item._id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{item.item_name}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            Kategori: {item.category || 'sarf'} | Birim: {item.unit || 'ADET'}
                            {item.warehouse_location && ` | Raf: ${item.warehouse_location}`}
                          </div>
                          {item.expiry_date && (
                            <div className="text-xs text-orange-600 mt-1">
                              SKT: {new Date(item.expiry_date).toLocaleDateString('tr-TR')}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-bold text-green-600">
                              {item.remaining_items || item.total_items || 0}
                            </div>
                            <div className="text-xs text-gray-500">{item.unit || 'ADET'}</div>
                          </div>
                          {canManage && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSupply(item.id || item._id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

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
                    <p><strong>GTIN:</strong> {parsedQR.gtin}</p>
                    <p><strong>Lot:</strong> {parsedQR.lot_number}</p>
                    <p><strong>SKT:</strong> {parsedQR.expiry_date || '-'}</p>
                    {parsedQR.quantity && parsedQR.quantity < 1000 ? (
                      <p className="text-green-700"><strong>✓ Kutudaki Adet (QR'dan):</strong> {parsedQR.quantity}</p>
                    ) : (
                      <p className="text-orange-600"><strong>⚠ Kutudaki Adet:</strong> QR kodunda AI (30) bilgisi yok. Manuel girin.</p>
                    )}
                    {parsedQR.its_verified ? (
                      <Badge className="bg-green-600 mt-2">İTS Doğrulandı</Badge>
                    ) : (
                      <Badge className="bg-yellow-500 mt-2">İTS Doğrulanamadı</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {parsedQR && (
              <>
                <div>
                  <Label>İlaç Adı {!parsedQR.drug_name && <span className="text-red-600">*</span>}</Label>
                  <Input
                    placeholder="İlaç adını girin (İTS'den gelmedi)"
                    value={manualItemName}
                    onChange={(e) => setManualItemName(e.target.value)}
                  />
                  {!parsedQR.drug_name && (
                    <p className="text-xs text-orange-600 mt-1">
                      İTS'den ilaç adı alınamadı, lütfen manuel girin
                    </p>
                  )}
                </div>
                
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
                    {!parsedQR.quantity && (
                      <p className="text-xs text-gray-500 mt-1">
                        QR'dan adet bilgisi gelmedi
                      </p>
                    )}
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

      {/* Toplu Giriş Dialog */}
      <Dialog open={showBulkAddDialog} onOpenChange={setShowBulkAddDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Toplu QR Girişi</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>İTS QR Kodları (Her satırda bir QR)</Label>
              <Textarea
                className="h-96 font-mono text-sm"
                placeholder="QR kodlarını yapıştırın... 
Her satırda bir QR kod
# ile başlayan satırlar yorum olarak algılanır

Örnek:
0108699788750027212599607002003674172905311025607002
0108699788750027212599607002003670172905311025607002
..."
                value={bulkQRText}
                onChange={(e) => setBulkQRText(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Varsayılan: Her kutu 10 adet içerir. İsterseniz tek tek düzenleyebilirsiniz.
              </p>
            </div>
            
            {bulkResults && (
              <Card className={bulkResults.errors.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
                <CardContent className="p-4">
                  <p className="font-medium">
                    ✓ {bulkResults.success.length} başarılı, 
                    ✗ {bulkResults.errors.length} hatalı 
                    (Toplam: {bulkResults.total})
                  </p>
                  
                  {bulkResults.errors.length > 0 && (
                    <div className="mt-3 max-h-48 overflow-y-auto">
                      <p className="text-sm font-medium text-red-700 mb-2">Hatalar:</p>
                      {bulkResults.errors.map((err, idx) => (
                        <div key={idx} className="text-xs text-red-600 bg-white p-2 rounded mb-1">
                          <p className="font-mono">{err.qr.substring(0, 30)}...</p>
                          <p>{err.error}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowBulkAddDialog(false);
              setBulkQRText('');
              setBulkResults(null);
            }}>
              {bulkResults ? 'Kapat' : 'İptal'}
            </Button>
            
            {!bulkResults && (
              <Button 
                onClick={handleBulkAdd} 
                disabled={bulkProcessing || !bulkQRText.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkProcessing ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Toplu Ekle
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İtriyat Ekleme Dialog */}
      <Dialog open={showAddSupplyDialog} onOpenChange={setShowAddSupplyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>İtriyat/Sarf Malzemesi Ekle</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Ürün Adı *</Label>
              <Input
                placeholder="Örn: ASPİRASYON KATATERİ NO:6"
                value={newSupply.item_name}
                onChange={(e) => setNewSupply({ ...newSupply, item_name: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Miktar *</Label>
                <Input
                  type="number"
                  min="1"
                  value={newSupply.quantity}
                  onChange={(e) => setNewSupply({ ...newSupply, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Birim</Label>
                <Select
                  value={newSupply.unit}
                  onValueChange={(value) => setNewSupply({ ...newSupply, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADET">ADET</SelectItem>
                    <SelectItem value="PAKET">PAKET</SelectItem>
                    <SelectItem value="KUTU">KUTU</SelectItem>
                    <SelectItem value="ÇİFT">ÇİFT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Kategori</Label>
              <Select
                value={newSupply.category}
                onValueChange={(value) => setNewSupply({ ...newSupply, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sarf">Sarf Malzemesi</SelectItem>
                  <SelectItem value="tibbi_sarf">Tıbbi Sarf</SelectItem>
                  <SelectItem value="tibbi_cihaz">Tıbbi Cihaz</SelectItem>
                  <SelectItem value="temizlik">Temizlik</SelectItem>
                  <SelectItem value="kiyafet">Kıyafet</SelectItem>
                  <SelectItem value="malzeme">Malzeme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Raf Konumu (Opsiyonel)</Label>
              <Input
                placeholder="örn: Raf-A-12"
                value={newSupply.warehouse_location}
                onChange={(e) => setNewSupply({ ...newSupply, warehouse_location: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSupplyDialog(false)}>
              İptal
            </Button>
            <Button 
              onClick={handleAddSupply}
              disabled={addingSupply || !newSupply.item_name.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {addingSupply ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Ekleniyor...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Ekle
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
            {canManage && detailItem && (
              <Button 
                variant="destructive"
                onClick={() => handleDelete(detailItem.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Sil
              </Button>
            )}
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

