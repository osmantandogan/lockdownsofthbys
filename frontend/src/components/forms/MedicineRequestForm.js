import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Trash2 } from 'lucide-react';
import SignaturePad from '../SignaturePad';

const MaterialRequestForm = () => {
  const [materials, setMaterials] = useState([
    { id: 1, name: '', quantity: '' }
  ]);
  const [formData, setFormData] = useState({
    consciousnessStatus: 'conscious',
    date: new Date().toISOString().split('T')[0],
    managerName: '',
    managerTitle: ''
  });

  const addMaterial = () => {
    if (materials.length < 18) {
      setMaterials([...materials, { id: materials.length + 1, name: '', quantity: '' }]);
    }
  };

  const removeMaterial = (id) => {
    setMaterials(materials.filter(m => m.id !== id));
  };

  const updateMaterial = (id, field, value) => {
    setMaterials(materials.map(m => m.id === id ? {...m, [field]: value} : m));
  };

  const totalQuantity = materials.reduce((sum, m) => sum + (parseInt(m.quantity) || 0), 0);

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">MALZEME TALEP VE TESLİM FORMU</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Malzeme Listesi</CardTitle>
            <Button onClick={addMaterial} size="sm" disabled={materials.length >= 18}>
              <Plus className="h-4 w-4 mr-2" />
              Malzeme Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {materials.map((material, index) => (
            <Card key={material.id} className="bg-gray-50">
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-3 items-end">
                  <div className="space-y-2">
                    <Label>{index + 1}. MALZEME ADI</Label>
                    <Input
                      value={material.name}
                      onChange={(e) => updateMaterial(material.id, 'name', e.target.value)}
                      placeholder="Malzeme adı"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TALEP EDİLEN MİKTAR</Label>
                    <Input
                      type="number"
                      value={material.quantity}
                      onChange={(e) => updateMaterial(material.id, 'quantity', e.target.value)}
                      placeholder="Miktar"
                    />
                  </div>
                  {materials.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMaterial(material.id)}
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
            <p className="text-sm text-gray-600">Toplam Talep Edilen Malzeme (Adet)</p>
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
        <Button>💾 Kaydet</Button>
      </div>
    </div>
  );
};

export default MedicineRequestForm;
