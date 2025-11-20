import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';

const PreCaseCheckForm = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0,5),
    staffName: ''
  });

  const [checks, setChecks] = useState({});

  const equipmentList = [
    'Defibrilatör',
    'Mekanik Ventilatör',
    'Portatif Aspiratör',
    'Sabit Aspiratör',
    'Sabit Oksijen Aspiratör',
    'Portatif Oksijen Sistemi',
    'Ana Sedye',
    'Kombinasyon Sedye',
    'Omurga Tahtası',
    'Kaşık Sedye',
    'Acil Çantası',
    'İlkyardım Çantası',
    'Arka Kabin Zemin',
    'Tıbbi Atık'
  ];

  const handleCheck = (item, field, value) => {
    setChecks({
      ...checks,
      [item]: { ...checks[item], [field]: value }
    });
  };

  const setAllAvailable = () => {
    const newChecks = {};
    equipmentList.forEach(item => {
      newChecks[item] = { availability: 'var' };
    });
    setChecks(newChecks);
  };

  const setAllWorking = () => {
    const newChecks = {};
    equipmentList.forEach(item => {
      newChecks[item] = { ...checks[item], status: 'calisiyor' };
    });
    setChecks(newChecks);
  };

  const setAllClean = () => {
    const newChecks = {};
    equipmentList.forEach(item => {
      newChecks[item] = { ...checks[item], cleanliness: 'temiz' };
    });
    setChecks(newChecks);
  };

  const clearAll = () => {
    setChecks({});
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">VAKA ÖNCESİ KONTROL FORMU</h1>
      </div>

      <Card className="bg-blue-50">
        <CardHeader><CardTitle className="text-sm">Hızlı Kontrol Seçenekleri</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={setAllAvailable}>Tümü Var</Button>
            <Button size="sm" variant="outline" onClick={setAllWorking}>Tümü Çalışıyor</Button>
            <Button size="sm" variant="outline" onClick={setAllClean}>Tümü Temiz</Button>
            <Button size="sm" variant="outline" onClick={clearAll}>Temizle</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ekipman Kontrol Listesi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {equipmentList.map((item, index) => (
            <Card key={index} className="bg-gray-50">
              <CardHeader><CardTitle className="text-sm">{item}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Varlık</Label>
                  <RadioGroup 
                    value={checks[item]?.availability || ''}
                    onValueChange={(v) => handleCheck(item, 'availability', v)}
                  >
                    <div className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="var" id={`${item}-var`} />
                        <Label htmlFor={`${item}-var`} className="font-normal text-xs">Var</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yok" id={`${item}-yok`} />
                        <Label htmlFor={`${item}-yok`} className="font-normal text-xs">Yok</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Durum</Label>
                    <RadioGroup 
                      value={checks[item]?.status || ''}
                      onValueChange={(v) => handleCheck(item, 'status', v)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="calisiyor" id={`${item}-work`} />
                          <Label htmlFor={`${item}-work`} className="font-normal text-xs">Çalışıyor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="calismiyor" id={`${item}-notwork`} />
                          <Label htmlFor={`${item}-notwork`} className="font-normal text-xs">Çalışmıyor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="arizali" id={`${item}-faulty`} />
                          <Label htmlFor={`${item}-faulty`} className="font-normal text-xs">Arızalı</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Temizlik</Label>
                    <RadioGroup 
                      value={checks[item]?.cleanliness || ''}
                      onValueChange={(v) => handleCheck(item, 'cleanliness', v)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="temiz" id={`${item}-clean`} />
                          <Label htmlFor={`${item}-clean`} className="font-normal text-xs">Temiz</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="kirli" id={`${item}-dirty`} />
                          <Label htmlFor={`${item}-dirty`} className="font-normal text-xs">Kirli</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="temizlendi" id={`${item}-cleaned`} />
                          <Label htmlFor={`${item}-cleaned`} className="font-normal text-xs">Temizlendi</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Kontrolü Yapan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Saat</Label>
              <Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Adı Soyadı</Label>
              <Input value={formData.staffName} onChange={(e) => setFormData({...formData, staffName: e.target.value})} />
            </div>
          </div>
          <SignaturePad label="İMZA" required />
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

export default PreCaseCheckForm;
