import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Trash2 } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';
import { getTurkeyDate } from '../../utils/timezone';


  const handleSave = async () => {
    setSaving(true);
    const saveFunc = handleFormSave('medical_gas_request', formData, {
      validateFields: ['managerName'],
      validateSignature: false,
      onSuccess: () => {
        // Form saved successfully
      }
    });
    await saveFunc();
    setSaving(false);
  };

  const MedicalGasRequestForm = () => {
  const [gases, setGases] = useState([
    { id: 1, name: '', quantity: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    date: getTurkeyDate(),
    managerName: '',
    managerTitle: ''
  });

  const addGas = () => {
    if (gases.length < 15) {
      setGases([...gases, { id: gases.length + 1, name: '', quantity: '' }]);
    }
  };

  const removeGas = (id) => {
    setGases(gases.filter(g => g.id !== id));
  };

  const updateGas = (id, field, value) => {
    setGases(gases.map(g => g.id === id ? {...g, [field]: value} : g));
  };

  const totalQuantity = gases.reduce((sum, g) => sum + (parseInt(g.quantity) || 0), 0);

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">MEDİKAL GAZ İSTEK FORMU</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Medikal Gaz Listesi</CardTitle>
            <Button onClick={addGas} size="sm" disabled={gases.length >= 15}>
              <Plus className="h-4 w-4 mr-2" />
              Gaz Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gases.map((gas, index) => (
            <Card key={gas.id} className="bg-gray-50">
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-3 items-end">
                  <div className="space-y-2">
                    <Label>{index + 1}. MEDİKAL GAZ ADI</Label>
                    <Input
                      value={gas.name}
                      onChange={(e) => updateGas(gas.id, 'name', e.target.value)}
                      placeholder="Gaz adı (örn: Oksijen, Hava, Azot)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TALEP EDİLEN MİKTAR</Label>
                    <Input
                      type="number"
                      value={gas.quantity}
                      onChange={(e) => updateGas(gas.id, 'quantity', e.target.value)}
                      placeholder="Miktar (litre/m³)"
                    />
                  </div>
                  {gases.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGas(gas.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-blue-50">
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalQuantity}</p>
            <p className="text-sm text-gray-600">Toplam Talep Edilen Miktar</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">İsteği Yapan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Bölüm Yöneticisi</Label>
              <Input value={formData.managerName} onChange={(e) => setFormData({...formData, managerName: e.target.value})} placeholder="Ad Soyad" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ünvan</Label>
            <Input value={formData.managerTitle} onChange={(e) => setFormData({...formData, managerTitle: e.target.value})} placeholder="Ünvan" />
          </div>
          <SignaturePad label="İmza" required />
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">💾 PDF Önizleme</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "💾 Kaydet"}</Button>
      </div>
    </div>
  );
};

export default MedicalGasRequestForm;
