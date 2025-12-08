import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2 } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { shiftsAPI, vehiclesAPI } from '../../api';


  const handleSave = async () => {
    setSaving(true);
    const saveFunc = handleFormSave('material_request', formData, {
      validateFields: ['managerName'],
      validateSignature: false,
      onSuccess: () => {
        // Form saved successfully
      }
    });
    await saveFunc();
    setSaving(false);
  };

  const MaterialRequestForm = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([
    { id: 1, name: '', quantity: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    consciousnessStatus: 'conscious',
    date: new Date().toISOString().split('T')[0],
    managerName: '',
    managerTitle: '',
    requestType: '', // ilac, medikal, ofis, personel, arac
    vehiclePlate: '' // Şoför için otomatik
  });

  // Rol bazlı otomatik doldurmalar
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setFormData(prev => ({
          ...prev,
          managerName: user.name,
          managerTitle: user.role
        }));

        // Şoför ise otomatik aracını seç
        if (user.role === 'sofor' || user.role === 'bas_sofor') {
          try {
            const shiftRes = await shiftsAPI.getActive();
            const shift = shiftRes?.data;
            if (shift?.vehicle_id) {
              const vehicleRes = await vehiclesAPI.getById(shift.vehicle_id);
              const vehicle = vehicleRes?.data;
              if (vehicle?.plate) {
                setFormData(prev => ({
                  ...prev,
                  requestType: 'arac',
                  vehiclePlate: vehicle.plate
                }));
                toast.success('Aracınız otomatik seçildi');
              }
            }
          } catch (error) {
            console.log('Araç bilgisi alınamadı:', error.message);
          }
        }
      }
    };
    loadData();
  }, [user]);

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

      {/* Talep Türü - Şoför dışındaki roller için */}
      {user && user.role !== 'sofor' && user.role !== 'bas_sofor' && (
        <Card>
          <CardHeader><CardTitle>Talep Türü</CardTitle></CardHeader>
          <CardContent>
            <Select value={formData.requestType} onValueChange={(v) => setFormData({...formData, requestType: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Ne için talep oluşturuyorsunuz?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ilac">İlaç</SelectItem>
                <SelectItem value="medikal">Medikal Malzeme</SelectItem>
                <SelectItem value="ofis">Ofis Malzemeleri</SelectItem>
                <SelectItem value="personel">Personel Malzemeleri</SelectItem>
                <SelectItem value="arac">Araç İçin</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Şoför için otomatik araç gösterimi */}
      {formData.vehiclePlate && (
        <Card className="bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-900">
              ✓ Talep türü: <strong>Araç İçin</strong> - Aracınız: <strong>{formData.vehiclePlate}</strong>
            </p>
          </CardContent>
        </Card>
      )}

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
        <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "💾 Kaydet"}</Button>
      </div>
    </div>
  );
};

export default MaterialRequestForm;
