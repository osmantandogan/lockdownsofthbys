import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import SignaturePad from '../SignaturePad';

const AmbulanceEquipmentCheckForm = () => {
  const [formData, setFormData] = useState({
    vehiclePlate: '',
    lockNumber: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0,5),
    notes: '',
    staffName: ''
  });

  const [checks, setChecks] = useState({});

  const categories = [
    {
      title: '🛏️ Sedyeler ve İmmobilizasyon',
      items: [
        'Ana Sedye ve Emniyet Kemeri',
        'Kombinasyon Sedye',
        'Vakum Sedye',
        'Faraş Sedye',
        'Sırt Tahtası',
        'Traksiyon Atel Seti',
        'Şişme Atel Seti (6 Parça)',
        'Boyunluk Seti'
      ]
    },
    {
      title: '🏥 Tıbbi Cihazlar',
      items: [
        'Transport Ventilatör',
        'Sabit Oksijen Tüpü',
        'Sabit Vakum Aspiratör',
        'Portatif Aspiratör',
        'Tansiyon Aleti (Erişkin)',
        'Tansiyon Aleti (Çocuk)',
        'Oksimetre',
        'Termometre',
        'Diagnostik Set',
        'Defibrilatör',
        'Enjektör Pompası',
        'Glukometre',
        'Serum Askısı'
      ]
    },
    {
      title: '🚨 Acil Müdahale Ekipmanları',
      items: [
        'KED Kurtarma Yeleği',
        'Balon Valf Maske Seti',
        'Laringoskop Seti',
        'Entübasyon Tüpleri',
        'Havayolu Tüpü',
        'Acil Doğum Seti',
        'Dikiş Seti',
        'Isı İzolasyon Kap'
      ]
    },
    {
      title: '🩹 Malzemeler',
      items: [
        'Enjektör (10 Adet)',
        'Serum Seti',
        'Oksijen Maskesi',
        'Aspirasyon Kataterleri',
        'İdrar Sondası',
        'Yanık Seti',
        'Tıbbi Malzeme Çantası',
        'Cenaze Torbası (2)',
        'Bistüri (5)',
        'Povidon İod',
        'Alkol 500ml',
        'Battaniye (2)',
        'Çarşaf (2)',
        'Pamuk',
        'Baş Yastığı (2)'
      ]
    },
    {
      title: '💊 İlaçlar',
      items: [
        'Adrenalin 1mg (10)',
        'Aminocardol 240mg (4)',
        'Lidokain 2% (5)',
        'Atropin 0.5mg (10)',
        'Antihistaminik (4)',
        'Beta Bloker (2)',
        'Spazmolitik (4)',
        'Calcium (3)',
        'Kortikosteroid (2)',
        'Diazepam 10mg (5)',
        'Dextrose 20% 500ml (3)',
        'İzolyte 500ml (5)',
        'İzotonik 500ml (5)',
        'Ringer Laktat 500ml (5)',
        'Mannitol 500ml (2)'
      ]
    }
  ];

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const checkedItems = Object.keys(checks).length;
  const healthyItems = Object.values(checks).filter(v => v === 'saglam' || v === 'var').length;
  const faultyItems = Object.values(checks).filter(v => v === 'arizali').length;
  const missingItems = Object.values(checks).filter(v => v === 'yok').length;
  const progress = (checkedItems / totalItems) * 100;

  const handleCheck = (item, value) => {
    setChecks({...checks, [item]: value});
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-xl font-bold">AMBULANS CİHAZ, MALZEME VE İLAÇ</h1>
        <h1 className="text-xl font-bold">GÜNLÜK KONTROL FORMU</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Araç Plakası</Label>
              <Input value={formData.vehiclePlate} onChange={(e) => setFormData({...formData, vehiclePlate: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Acil Çanta Kilit No</Label>
              <Input value={formData.lockNumber} onChange={(e) => setFormData({...formData, lockNumber: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Saat</Label>
              <Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Kontrol İlerlemesi</span>
              <span className="font-bold">{checkedItems}/{totalItems}</span>
            </div>
            <Progress value={progress} />
            <div className="grid grid-cols-4 gap-2 text-xs text-center">
              <div><p className="font-bold text-green-600">{healthyItems}</p><p>Sağlam/Var</p></div>
              <div><p className="font-bold text-red-600">{faultyItems}</p><p>Arızalı</p></div>
              <div><p className="font-bold text-gray-600">{missingItems}</p><p>Yok</p></div>
              <div><p className="font-bold text-blue-600">{Math.round(progress)}%</p><p>Tamamlandı</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {categories.map((category, catIndex) => (
        <Card key={catIndex}>
          <CardHeader>
            <CardTitle className="text-base">{category.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {category.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex justify-between items-center py-2 border-b last:border-0">
                <Label className="text-sm flex-1">{item}</Label>
                <RadioGroup 
                  value={checks[item] || ''} 
                  onValueChange={(v) => handleCheck(item, v)}
                  className="flex space-x-2"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value={catIndex === 4 ? 'var' : 'saglam'} id={`${item}-good`} />
                    <Label htmlFor={`${item}-good`} className="text-xs font-normal">
                      {catIndex === 4 ? 'Var' : 'Sağlam'}
                    </Label>
                  </div>
                  {catIndex !== 4 && (
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="arizali" id={`${item}-faulty`} />
                      <Label htmlFor={`${item}-faulty`} className="text-xs font-normal">Arızalı</Label>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="yok" id={`${item}-none`} />
                    <Label htmlFor={`${item}-none`} className="text-xs font-normal">Yok</Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle className="text-sm">Notlar</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            placeholder="Varsa eksiklikler, arızalar veya notlar..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Sorumlu Sağlık Personeli</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Adı Soyadı</Label>
            <Input value={formData.staffName} onChange={(e) => setFormData({...formData, staffName: e.target.value})} />
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

export default AmbulanceEquipmentCheckForm;
