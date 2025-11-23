import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, ArrowDown, ArrowUp, ArrowLeftRight } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    stock_item_id: '',
    movement_type: 'in',
    quantity: 0,
    reason: '',
    notes: ''
  });

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    try {
      const response = await axios.get(`${API_URL}/stock/movements`, { withCredentials: true });
      setMovements(response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      await axios.post(`${API_URL}/stock/movements`, formData, { withCredentials: true });
      toast.success('Stok hareketi kaydedildi');
      setDialogOpen(false);
    } catch (error) {
      toast.error('Hareket kaydedilemedi');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-3xl font-bold">Stok Hareketleri</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Hareket Ekle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Stok Hareketi Kaydet</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Hareket Tipi</Label>
                <Select value={formData.movement_type} onValueChange={(v) => setFormData({...formData, movement_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in"><ArrowDown className="h-4 w-4 inline mr-2" />Giriş</SelectItem>
                    <SelectItem value="out"><ArrowUp className="h-4 w-4 inline mr-2" />Çıkış</SelectItem>
                    <SelectItem value="transfer"><ArrowLeftRight className="h-4 w-4 inline mr-2" />Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Miktar</Label>
                <Input type="number" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Sebep</Label>
                <Input value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Notlar</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
              </div>
              <Button onClick={handleSubmit} className="w-full">Kaydet</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">Stok hareket geçmişi burada görünecek</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockMovements;
