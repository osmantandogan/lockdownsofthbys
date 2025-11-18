import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import SignaturePad from './SignaturePad';

const HandoverFormFull = ({ formData: externalFormData, onChange, vehiclePlate, vehicleKm }) => {
  const [localFormData, setLocalFormData] = useState({
    aracPlakasi: vehiclePlate || '',
    kayitTarihi: new Date().toISOString().split('T')[0],
    teslimAlinanKm: vehicleKm || '',
    servisYapilacakKm: '',
    fosforluYelek: '',
    takviyeKablosu: '',
    cekmeKablosu: '',
    ucgen: '',
    teslimEdenNotlar: '',
    hasarBildirimi: '',
    teslimEden: '',
    teslimAlan: '',
    birimYoneticisi: '',
    onayTarihi: new Date().toISOString().split('T')[0]
  });

  const formData = externalFormData || localFormData;
  const setFormData = onChange || setLocalFormData;

  const handleChange = (field, value) => {
    const newData = {...formData, [field]: value};
    setFormData(newData);
  };

  const servisKalan = formData.servisYapilacakKm && formData.teslimAlinanKm 
    ? parseInt(formData.servisYapilacakKm) - parseInt(formData.teslimAlinanKm)
    : 0;

  const getKmColor = () => {
    if (servisKalan < 500) return 'bg-red-100 text-red-800 border-red-500';
    if (servisKalan < 1000) return 'bg-yellow-100 text-yellow-800 border-yellow-500';
    return 'bg-green-100 text-green-800 border-green-500';
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">AMBULANS DEVİR TESLİM FORMU</h1>
      </div>

      <div className="bg-blue-50 p-3 rounded-lg">
        <p className="text-sm">ℹ️ Bu form, ambulans nöbet değişimlerinde araç ve ekipman teslim işlemleri için kullanılır.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>🚑 Araç Bilgileri</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Araç Plakası</Label>
              <Input 
                value={formData.aracPlakasi}
                onChange={(e) => handleChange('aracPlakasi', e.target.value.toUpperCase())}
                placeholder="34 ABC 123"
              />
            </div>
            <div className="space-y-2">
              <Label>Kayıt Tarihi</Label>
              <Input 
                type="date"
                value={formData.kayitTarihi}
                onChange={(e) => handleChange('kayitTarihi', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Teslim Alınan KM</Label>
              <Input 
                type="number"
                value={formData.teslimAlinanKm}
                onChange={(e) => handleChange('teslimAlinanKm', e.target.value)}
                placeholder="125000"
              />
            </div>
            <div className="space-y-2">
              <Label>Servis Yapılacak KM</Label>
              <Input 
                type="number"
                value={formData.servisYapilacakKm}
                onChange={(e) => handleChange('servisYapilacakKm', e.target.value)}
                placeholder="140000"
              />
            </div>
          </div>
          {servisKalan > 0 && (
            <div className={`p-4 rounded-lg border-2 ${getKmColor()}`}>
              <div className="text-center">
                <p className="text-3xl font-bold">{servisKalan.toLocaleString()} KM</p>
                <p className="text-sm font-medium mt-1">Servise Kalan Mesafe</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📋 Ekipman Kontrol Listesi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <Label className="text-sm">Fosforlu Yelek (3 Adet)</Label>
            <RadioGroup value={formData.fosforluYelek} onValueChange={(v) => handleChange('fosforluYelek', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="yelek-var" />
                  <Label htmlFor="yelek-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="yelek-yok" />
                  <Label htmlFor="yelek-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <Label className="text-sm">Takviye Kablosu</Label>
            <RadioGroup value={formData.takviyeKablosu} onValueChange={(v) => handleChange('takviyeKablosu', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="takviye-var" />
                  <Label htmlFor="takviye-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="takviye-yok" />
                  <Label htmlFor="takviye-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <Label className="text-sm">Çekme Kablosu</Label>
            <RadioGroup value={formData.cekmeKablosu} onValueChange={(v) => handleChange('cekmeKablosu', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="cekme-var" />
                  <Label htmlFor="cekme-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="cekme-yok" />
                  <Label htmlFor="cekme-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-between items-center py-2">
            <Label className="text-sm">Üçgen (1 Adet)</Label>
            <RadioGroup value={formData.ucgen} onValueChange={(v) => handleChange('ucgen', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="ucgen-var" />
                  <Label htmlFor="ucgen-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="ucgen-yok" />
                  <Label htmlFor="ucgen-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📝 Notlar ve Hasar Bildirimi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teslim Edenin Notları</Label>
            <Textarea 
              value={formData.teslimEdenNotlar}
              onChange={(e) => handleChange('teslimEdenNotlar', e.target.value)}
              placeholder="Vardiya sırasında yaşanan durumlar, önemli notlar..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Hasar Tespit Bildirimi</Label>
            <Textarea 
              value={formData.hasarBildirimi}
              onChange={(e) => handleChange('hasarBildirimi', e.target.value)}
              placeholder="Tespit edilen hasarlar, arızalar, eksiklikler..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>✍️ Teslim Eden Bilgileri</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teslim Edenin Adı-Soyadı</Label>
            <Input 
              value={formData.teslimEden}
              onChange={(e) => handleChange('teslimEden', e.target.value)}
              placeholder="Adı Soyadı"
            />
          </div>
          <SignaturePad label="İmza" required />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>✍️ Teslim Alan Bilgileri</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teslim Alanın Adı-Soyadı</Label>
            <Input 
              value={formData.teslimAlan}
              onChange={(e) => handleChange('teslimAlan', e.target.value)}
              placeholder="Adı Soyadı"
            />
          </div>
          <SignaturePad label="İmza" required />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>✅ Bölüm / Birim Yöneticisinin Onayı</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Birim Yöneticisinin Adı-Soyadı</Label>
              <Input 
                value={formData.birimYoneticisi}
                onChange={(e) => handleChange('birimYoneticisi', e.target.value)}
                placeholder="Adı Soyadı"
              />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input 
                type="date"
                value={formData.onayTarihi}
                onChange={(e) => handleChange('onayTarihi', e.target.value)}
              />
            </div>
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

export default HandoverFormFull;
