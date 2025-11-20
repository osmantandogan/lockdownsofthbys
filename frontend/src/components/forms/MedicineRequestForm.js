import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2 } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';

const MedicineRequestForm = () => {
  const [medicines, setMedicines] = useState([
    { id: 1, name: '', form: '', quantity: '' }
  ]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    managerName: '',
    managerTitle: ''
  });

  const medicineForms = [
    'Tablet', 'Kapsül', 'Şurup', 'Ampul', 'Flakon', 'Krem', 'Pomad', 'Damla', 'Sprey', 'Jel'
  ];

  const addMedicine = () => {
    if (medicines.length < 20) {
      setMedicines([...medicines, { id: medicines.length + 1, name: '', form: '', quantity: '' }]);
    }
  };

  const removeMedicine = (id) => {
    setMedicines(medicines.filter(m => m.id !== id));
  };

  const updateMedicine = (id, field, value) => {
    setMedicines(medicines.map(m => m.id === id ? {...m, [field]: value} : m));
  };

  const totalItems = medicines.filter(m => m.name).length;
  const totalQuantity = medicines.reduce((sum, m) => sum + (parseInt(m.quantity) || 0), 0);

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">İLAÇ TALEP FORMU</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>İlaç Listesi</CardTitle>
            <Button onClick={addMedicine} size="sm" disabled={medicines.length >= 20}>
              <Plus className="h-4 w-4 mr-2" />
              İlaç Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {medicines.map((medicine, index) => (
            <Card key={medicine.id} className="bg-gray-50">
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-4 items-end">
                  <div className="space-y-2">
                    <Label>{index + 1}. İLAÇ ADI</Label>
                    <Input
                      value={medicine.name}
                      onChange={(e) => updateMedicine(medicine.id, 'name', e.target.value)}
                      placeholder="İlaç adı"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>İLACIN FORMU</Label>
                    <Select value={medicine.form} onValueChange={(v) => updateMedicine(medicine.id, 'form', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicineForms.map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>TALEP EDİLEN MİKTAR</Label>
                    <Input
                      type="number"
                      value={medicine.quantity}
                      onChange={(e) => updateMedicine(medicine.id, 'quantity', e.target.value)}
                      placeholder="Miktar"
                    />
                  </div>
                  {medicines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMedicine(medicine.id)}
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
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{totalItems}</p>
              <p className="text-sm text-gray-600">Toplam Kalem</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{totalQuantity}</p>
              <p className="text-sm text-gray-600">Toplam Adet</p>
            </div>
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
