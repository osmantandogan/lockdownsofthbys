import React, { useState, useEffect } from 'react';
import { stockAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Package, Plus, Edit, AlertTriangle } from 'lucide-react';

const StockManagement = () => {
  const [stocks, setStocks] = useState([]);
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    quantity: 0,
    min_quantity: 0,
    location: 'merkez_depo',
    location_detail: '',
    lot_number: '',
    expiry_date: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [stocksRes, alertsRes] = await Promise.all([
        stockAPI.getAll(),
        stockAPI.getAlerts()
      ]);
      setStocks(stocksRes.data);
      setAlerts(alertsRes.data);
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
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      quantity: 0,
      min_quantity: 0,
      location: 'merkez_depo',
      location_detail: '',
      lot_number: '',
      expiry_date: ''
    });
    setEditMode(false);
    setSelectedStock(null);
  };

  const locationLabels = {
    ambulans: 'Ambulans',
    saha_ofis: 'Saha Ofis',
    acil_canta: 'Acil Çanta',
    merkez_depo: 'Merkez Depo'
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
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Stok
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editMode ? 'Stok Düzenle' : 'Yeni Stok Ekle'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Malzeme Adı *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={editMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stok Kodu *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    disabled={editMode}
                  />
                </div>
              </div>
              
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
                  <Label>Minimum Miktar</Label>
                  <Input
                    type="number"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({...formData, min_quantity: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lokasyon</Label>
                  <Select value={formData.location} onValueChange={(v) => setFormData({...formData, location: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merkez_depo">Merkez Depo</SelectItem>
                      <SelectItem value="ambulans">Ambulans</SelectItem>
                      <SelectItem value="saha_ofis">Saha Ofis</SelectItem>
                      <SelectItem value="acil_canta">Acil Çanta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lokasyon Detay</Label>
                  <Input
                    value={formData.location_detail}
                    onChange={(e) => setFormData({...formData, location_detail: e.target.value})}
                    placeholder="Araç plakası, raf no, vb."
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

              <Button 
                onClick={editMode ? handleUpdate : handleCreate} 
                className="w-full"
              >
                {editMode ? 'Güncelle' : 'Stok Ekle'}
              </Button>
            </div>
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
                        <p className="font-medium">{locationLabels[stock.location]}</p>
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
    </div>
  );
};

export default StockManagement;

