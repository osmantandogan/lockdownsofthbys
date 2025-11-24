import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';

const OrderForm = () => {
  const [items, setItems] = useState([{id: 1, name: '', unit: '', quantity: '', unitPrice: ''}]);
  const [formData, setFormData] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    orderNumber: `SIP-${Date.now()}`,
    supplier: '',
    deliveryDate: '',
    notes: '',
    orderedBy: ''
  });
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, {id: items.length + 1, name: '', unit: '', quantity: '', unitPrice: ''}]);
  const removeItem = (id) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id, field, value) => setItems(items.map(i => i.id === id ? {...i, [field]: value} : i));
  
  const total = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    const saveFunc = handleFormSave('order_form', {...formData, items}, {
      validateFields: ['supplier', 'orderedBy'],
      onSuccess: () => {
        setItems([{id: 1, name: '', unit: '', quantity: '', unitPrice: ''}]);
        setFormData({orderDate: new Date().toISOString().split('T')[0], orderNumber: `SIP-${Date.now()}`, supplier: '', deliveryDate: '', notes: '', orderedBy: ''});
      }
    });
    await saveFunc();
    setSaving(false);
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center border-b pb-4"><h1 className="text-2xl font-bold">SİPARİŞ/TALEP FORMU</h1></div>
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Sipariş No</Label><Input value={formData.orderNumber} disabled className="bg-gray-100" /></div>
        <div className="space-y-2"><Label>Tarih</Label><Input type="date" value={formData.orderDate} onChange={(e) => setFormData({...formData, orderDate: e.target.value})} /></div>
        <div className="space-y-2"><Label>Tedarikçi</Label><Input value={formData.supplier} onChange={(e) => setFormData({...formData, supplier: e.target.value})} /></div>
        <div className="space-y-2"><Label>Teslim Tarihi</Label><Input type="date" value={formData.deliveryDate} onChange={(e) => setFormData({...formData, deliveryDate: e.target.value})} /></div>
      </CardContent></Card>
      <Card><CardHeader><div className="flex justify-between"><CardTitle>Sipariş Kalemleri</CardTitle><Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-2" />Ekle</Button></div></CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, idx) => (
            <Card key={item.id} className="bg-gray-50"><CardContent className="p-4 grid gap-3 md:grid-cols-5 items-end">
              <div className="space-y-1"><Label className="text-xs">{idx+1}. Ürün/Malzeme</Label><Input value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Birim</Label><Input value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} placeholder="Adet/Kutu" /></div>
              <div className="space-y-1"><Label className="text-xs">Miktar</Label><Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Birim Fiyat</Label><Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} /></div>
              {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>}
            </CardContent></Card>
          ))}
        </CardContent>
      </Card>
      <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-3xl font-bold text-blue-600">{total.toLocaleString('tr-TR', {style: 'currency', currency: 'TRY'})}</p><p className="text-sm">Toplam Tutar</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Notlar</CardTitle></CardHeader><CardContent><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Onay</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label>Sipariş Veren</Label><Input value={formData.orderedBy} onChange={(e) => setFormData({...formData, orderedBy: e.target.value})} /></div>
        <SignaturePad label="İmza" />
      </CardContent></Card>
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : '💾 Kaydet'}</Button>
      </div>
    </div>
  );
};

export default OrderForm;
