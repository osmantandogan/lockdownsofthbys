import React, { useEffect, useState, useRef } from 'react';
import { stockAPI, medicationsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Package, AlertTriangle, QrCode, Plus, Upload, Search, 
  Trash2, Edit, Check, X, Filter, RefreshCw 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Stock = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // QR/Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  
  // Add/Edit item state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    code: '',
    gtin: '',
    quantity: 1,
    min_quantity: 5,
    location: 'merkez_depo',
    location_detail: '',
    lot_number: '',
    expiry_date: '',
    unit: 'adet'
  });
  
  // Bulk upload state
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkLocation, setBulkLocation] = useState('merkez_depo');
  const [bulkLocationDetail, setBulkLocationDetail] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsRes, alertsRes] = await Promise.all([
        stockAPI.getAll(),
        stockAPI.getAlerts()
      ]);
      setItems(itemsRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Error loading stock:', error);
      toast.error('Stok yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const locationLabels = {
    ambulans: 'Ambulans',
    saha_ofis: 'Saha Ofis',
    acil_canta: 'Acil Çanta',
    merkez_depo: 'Merkez Depo'
  };

  const unitLabels = {
    adet: 'Adet',
    kutu: 'Kutu',
    ampul: 'Ampul',
    flakon: 'Flakon',
    ml: 'ML',
    cc: 'CC',
    tablet: 'Tablet',
    tup: 'Tüp',
    sprey: 'Sprey'
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 30;
  };

  const isCritical = (item) => item.quantity < item.min_quantity;

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.gtin && item.gtin.includes(searchQuery));
    
    const matchesLocation = locationFilter === 'all' || item.location === locationFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'critical') matchesStatus = isCritical(item);
    else if (statusFilter === 'expired') matchesStatus = isExpired(item.expiry_date);
    else if (statusFilter === 'expiring') matchesStatus = isExpiringSoon(item.expiry_date);
    
    return matchesSearch && matchesLocation && matchesStatus;
  });

  // Handle barcode scan
  const handleBarcodeSubmit = async () => {
    if (!barcodeInput.trim()) return;
    
    try {
      const res = await medicationsAPI.parseBarcode(barcodeInput, null);
      setBarcodeResult(res.data);
      
      if (res.data.found) {
        toast.success('Ürün stokta bulundu!');
      } else {
        toast.info('GTIN bulunamadı. Yeni ürün olarak ekleyebilirsiniz.');
      }
    } catch (error) {
      console.error('Error parsing barcode:', error);
      toast.error('Barkod okunamadı');
    }
  };

  // Handle add/update item
  const handleSaveItem = async () => {
    try {
      const data = {
        ...itemForm,
        quantity: parseInt(itemForm.quantity) || 0,
        min_quantity: parseInt(itemForm.min_quantity) || 5,
        expiry_date: itemForm.expiry_date || null
      };

      if (editingItem) {
        await stockAPI.update(editingItem.id, data);
        toast.success('Ürün güncellendi');
      } else {
        await stockAPI.create(data);
        toast.success('Ürün eklendi');
      }
      
      setShowAddDialog(false);
      setEditingItem(null);
      resetItemForm();
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('Kayıt başarısız');
    }
  };

  // Handle delete item
  const handleDeleteItem = async (id) => {
    if (!window.confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;
    
    try {
      await stockAPI.delete(id);
      toast.success('Ürün silindi');
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Silme başarısız');
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (!bulkText.trim()) {
      toast.error('Lütfen ilaç listesi girin');
      return;
    }

    setBulkUploading(true);
    
    try {
      const lines = bulkText.split('\n').filter(line => line.trim());
      let successCount = 0;
      let errorCount = 0;

      for (const line of lines) {
        const name = line.trim();
        if (!name) continue;

        try {
          await stockAPI.create({
            name: name,
            code: name.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, ''),
            quantity: 10,
            min_quantity: 5,
            location: bulkLocation,
            location_detail: bulkLocationDetail || null,
            unit: 'adet'
          });
          successCount++;
        } catch (err) {
          console.error(`Error adding ${name}:`, err);
          errorCount++;
        }
      }

      toast.success(`${successCount} ürün eklendi${errorCount > 0 ? `, ${errorCount} hata` : ''}`);
      setShowBulkDialog(false);
      setBulkText('');
      loadData();
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast.error('Toplu yükleme başarısız');
    } finally {
      setBulkUploading(false);
    }
  };

  // Add item from barcode result
  const handleAddFromBarcode = () => {
    if (!barcodeResult) return;
    
    setItemForm({
      name: barcodeResult.stock_item?.name || '',
      code: barcodeResult.parsed?.gtin?.substring(0, 8) || '',
      gtin: barcodeResult.parsed?.gtin || '',
      quantity: 1,
      min_quantity: 5,
      location: 'merkez_depo',
      location_detail: '',
      lot_number: barcodeResult.parsed?.lot_number || '',
      expiry_date: barcodeResult.parsed?.expiry_date_parsed ? 
        new Date(barcodeResult.parsed.expiry_date_parsed).toISOString().split('T')[0] : '',
      unit: 'adet'
    });
    
    setShowBarcodeDialog(false);
    setBarcodeResult(null);
    setBarcodeInput('');
    setShowAddDialog(true);
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      code: '',
      gtin: '',
      quantity: 1,
      min_quantity: 5,
      location: 'merkez_depo',
      location_detail: '',
      lot_number: '',
      expiry_date: '',
      unit: 'adet'
    });
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      code: item.code,
      gtin: item.gtin || '',
      quantity: item.quantity,
      min_quantity: item.min_quantity,
      location: item.location,
      location_detail: item.location_detail || '',
      lot_number: item.lot_number || '',
      expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : '',
      unit: item.unit || 'adet'
    });
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const canEdit = ['merkez_ofis', 'operasyon_muduru', 'hemsire'].includes(user?.role);

  return (
    <div className="space-y-6" data-testid="stock-page">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Stok Yönetimi</h1>
          <p className="text-gray-500">İlaç ve malzeme takibi ({items.length} ürün)</p>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            {/* QR/Barcode Button */}
            <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <QrCode className="h-4 w-4 mr-2" />
                  Karekod Okut
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Karekod / Barkod Okut</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Karekodu yapıştırın veya tarayın</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="Karekod verisi..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSubmit()}
                        autoFocus
                      />
                      <Button onClick={handleBarcodeSubmit}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {barcodeResult && (
                    <Card className={barcodeResult.found ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}>
                      <CardContent className="p-4 space-y-2">
                        {barcodeResult.found ? (
                          <>
                            <p className="font-semibold text-green-800">✓ Stokta Bulundu</p>
                            <p className="text-sm">{barcodeResult.stock_item?.name}</p>
                            <p className="text-xs text-gray-600">
                              Stok: {barcodeResult.stock_item?.quantity} | 
                              Lokasyon: {locationLabels[barcodeResult.stock_item?.location]}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-amber-800">⚠ GTIN Bulunamadı</p>
                            <p className="text-xs text-gray-600">
                              GTIN: {barcodeResult.parsed?.gtin || '-'}<br />
                              Lot: {barcodeResult.parsed?.lot_number || '-'}<br />
                              SKT: {barcodeResult.parsed?.expiry_date || '-'}
                            </p>
                            <Button size="sm" onClick={handleAddFromBarcode} className="w-full">
                              <Plus className="h-4 w-4 mr-2" />
                              Yeni Ürün Olarak Ekle
                            </Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Bulk Upload Button */}
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Toplu Yükle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Toplu Stok Yükleme</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Lokasyon</Label>
                    <Select value={bulkLocation} onValueChange={setBulkLocation}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(locationLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {bulkLocation === 'ambulans' && (
                    <div>
                      <Label>Araç Plakası</Label>
                      <Input
                        placeholder="34 ABC 123"
                        value={bulkLocationDetail}
                        onChange={(e) => setBulkLocationDetail(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label>İlaç/Malzeme Listesi (her satıra bir ürün)</Label>
                    <Textarea
                      placeholder="HEKSOBEN SPREY/OROHEKS&#10;PLANOR TABLET/OPİREL&#10;DOPASEL&#10;..."
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {bulkText.split('\n').filter(l => l.trim()).length} ürün girildi
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleBulkUpload} 
                    disabled={bulkUploading}
                    className="w-full"
                  >
                    {bulkUploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Yükleniyor...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Tümünü Ekle
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add Item Button */}
            <Dialog open={showAddDialog} onOpenChange={(open) => {
              setShowAddDialog(open);
              if (!open) {
                setEditingItem(null);
                resetItemForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Ürün
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Ürün Adı *</Label>
                      <Input
                        value={itemForm.name}
                        onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                        placeholder="Ürün adı"
                      />
                    </div>
                    
                    <div>
                      <Label>Kod</Label>
                      <Input
                        value={itemForm.code}
                        onChange={(e) => setItemForm({...itemForm, code: e.target.value})}
                        placeholder="Ürün kodu"
                      />
                    </div>
                    
                    <div>
                      <Label>GTIN (Barkod)</Label>
                      <Input
                        value={itemForm.gtin}
                        onChange={(e) => setItemForm({...itemForm, gtin: e.target.value})}
                        placeholder="14 haneli GTIN"
                      />
                    </div>
                    
                    <div>
                      <Label>Miktar *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({...itemForm, quantity: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label>Minimum Miktar</Label>
                      <Input
                        type="number"
                        min="0"
                        value={itemForm.min_quantity}
                        onChange={(e) => setItemForm({...itemForm, min_quantity: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label>Birim</Label>
                      <Select value={itemForm.unit} onValueChange={(v) => setItemForm({...itemForm, unit: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(unitLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Lokasyon *</Label>
                      <Select value={itemForm.location} onValueChange={(v) => setItemForm({...itemForm, location: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(locationLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {itemForm.location === 'ambulans' && (
                      <div className="col-span-2">
                        <Label>Araç Plakası</Label>
                        <Input
                          value={itemForm.location_detail}
                          onChange={(e) => setItemForm({...itemForm, location_detail: e.target.value})}
                          placeholder="34 ABC 123"
                        />
                      </div>
                    )}
                    
                    <div>
                      <Label>Lot Numarası</Label>
                      <Input
                        value={itemForm.lot_number}
                        onChange={(e) => setItemForm({...itemForm, lot_number: e.target.value})}
                        placeholder="Lot no"
                      />
                    </div>
                    
                    <div>
                      <Label>Son Kullanma Tarihi</Label>
                      <Input
                        type="date"
                        value={itemForm.expiry_date}
                        onChange={(e) => setItemForm({...itemForm, expiry_date: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => {
                      setShowAddDialog(false);
                      setEditingItem(null);
                      resetItemForm();
                    }}>
                      İptal
                    </Button>
                    <Button onClick={handleSaveItem} disabled={!itemForm.name}>
                      <Check className="h-4 w-4 mr-2" />
                      {editingItem ? 'Güncelle' : 'Ekle'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{alerts.critical_stock || 0}</p>
              <p className="text-sm text-gray-500">Kritik Stok</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">{alerts.expired || 0}</p>
              <p className="text-sm text-gray-500">Süresi Dolmuş</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')}>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">{alerts.expiring_soon || 0}</p>
              <p className="text-sm text-gray-500">Süresi Dolacak</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Ürün ara (isim, kod, GTIN)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Lokasyon" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Lokasyonlar</SelectItem>
            {Object.entries(locationLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="critical">Kritik Stok</SelectItem>
            <SelectItem value="expired">Süresi Dolmuş</SelectItem>
            <SelectItem value="expiring">Süresi Dolacak</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Stock List */}
      <div className="text-sm text-gray-500 mb-2">
        {filteredItems.length} / {items.length} ürün gösteriliyor
      </div>
      
      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} data-testid={`stock-item-${item.code}`} className={
            isCritical(item) ? 'border-red-300 bg-red-50' :
            isExpired(item.expiry_date) ? 'border-orange-300 bg-orange-50' :
            isExpiringSoon(item.expiry_date) ? 'border-yellow-300 bg-yellow-50' : ''
          }>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-4">
                  <Package className="h-6 w-6 text-blue-600 mt-1" />
                  <div className="space-y-2">
                    <div>
                      <p className="font-bold text-lg">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        Kod: {item.code}
                        {item.gtin && <span className="ml-2">| GTIN: {item.gtin}</span>}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <Badge variant="outline">{locationLabels[item.location]}</Badge>
                      {item.location_detail && (
                        <Badge variant="secondary">{item.location_detail}</Badge>
                      )}
                      <Badge variant="outline">{unitLabels[item.unit] || item.unit}</Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-medium">Miktar:</span> {item.quantity} / Min: {item.min_quantity}
                        {isCritical(item) && (
                          <Badge className="ml-2 bg-red-100 text-red-800">Kritik!</Badge>
                        )}
                      </p>
                      {item.lot_number && (
                        <p><span className="font-medium">Lot:</span> {item.lot_number}</p>
                      )}
                      {item.expiry_date && (
                        <p>
                          <span className="font-medium">SKT:</span> {new Date(item.expiry_date).toLocaleDateString('tr-TR')}
                          {isExpired(item.expiry_date) && (
                            <Badge className="ml-2 bg-orange-100 text-orange-800">Dolmuş!</Badge>
                          )}
                          {isExpiringSoon(item.expiry_date) && (
                            <Badge className="ml-2 bg-yellow-100 text-yellow-800">Dolacak</Badge>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Ürün bulunamadı</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Stock;
