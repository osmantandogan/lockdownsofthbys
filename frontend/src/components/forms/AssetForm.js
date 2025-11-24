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

const AssetForm = () => {
  const [items, setItems] = useState([{id: 1, name: '', serialNo: '', quantity: 1}]);
  const [formData, setFormData] = useState({
    formDate: new Date().toISOString().split('T')[0],
    formNumber: `ZIM-${Date.now()}`,
    recipientName: '',
    recipientDepartment: '',
    returnDate: '',
    notes: '',
    givenBy: '',
    receivedBy: ''
  });
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, {id: items.length + 1, name: '', serialNo: '', quantity: 1}]);
  const removeItem = (id) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id, field, value) => setItems(items.map(i => i.id === id ? {...i, [field]: value} : i));

  const handleSave = async () => {
    setSaving(true);
    const saveFunc = handleFormSave('asset_form', {...formData, items}, {
      validateFields: ['recipientName', 'givenBy'],
      onSuccess: () => {
        setItems([{id: 1, name: '', serialNo: '', quantity: 1}]);
        setFormData({formDate: new Date().toISOString().split('T')[0], formNumber: `ZIM-${Date.now()}`, recipientName: '', recipientDepartment: '', returnDate: '', notes: '', givenBy: '', receivedBy: ''});
      }
    });
    await saveFunc();
    setSaving(false);
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center border-b pb-4"><h1 className="text-2xl font-bold">ZİMMET FORMU</h1></div>
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Zimmet No</Label><Input value={formData.formNumber} disabled className="bg-gray-100" /></div>
        <div className="space-y-2"><Label>Tarih</Label><Input type="date" value={formData.formDate} onChange={(e) => setFormData({...formData, formDate: e.target.value})} /></div>
        <div className="space-y-2"><Label>Teslim Alan</Label><Input value={formData.recipientName} onChange={(e) => setFormData({...formData, recipientName: e.target.value})} /></div>
        <div className="space-y-2"><Label>Bölüm</Label><Input value={formData.recipientDepartment} onChange={(e) => setFormData({...formData, recipientDepartment: e.target.value})} /></div>
        <div className="space-y-2"><Label>İade Tarihi</Label><Input type="date" value={formData.returnDate} onChange={(e) => setFormData({...formData, returnDate: e.target.value})} /></div>
      </CardContent></Card>
      <Card><CardHeader><div className="flex justify-between"><CardTitle>Zimmetli Demirbaşlar</CardTitle><Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-2" />Ekle</Button></div></CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, idx) => (
            <Card key={item.id} className="bg-gray-50"><CardContent className="p-4 grid gap-3 md:grid-cols-4 items-end">
              <div className="space-y-1"><Label className="text-xs">{idx+1}. Demirbaş Adı</Label><Input value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Seri No</Label><Input value={item.serialNo} onChange={(e) => updateItem(item.id, 'serialNo', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Miktar</Label><Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} /></div>
              {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>}
            </CardContent></Card>
          ))}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-sm">Notlar</CardTitle></CardHeader><CardContent><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} /></CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Zimmet Veren</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>Adı Soyadı</Label><Input value={formData.givenBy} onChange={(e) => setFormData({...formData, givenBy: e.target.value})} /></div>
          <SignaturePad label="İmza" />
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Zimmet Alan</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>Adı Soyadı</Label><Input value={formData.receivedBy} onChange={(e) => setFormData({...formData, receivedBy: e.target.value})} /></div>
          <SignaturePad label="İmza" />
        </CardContent></Card>
      </div>
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : '💾 Kaydet'}</Button>
      </div>
    </div>
  );
};

export default AssetForm;
