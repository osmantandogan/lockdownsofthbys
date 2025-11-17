import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';

const HandoverForm = ({ formData, onChange, vehiclePlate, vehicleKm }) => {
  const handleChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  const CheckItem = ({ label, field, options }) => (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <RadioGroup value={formData[field]} onValueChange={(v) => handleChange(field, v)}>
        <div className="flex space-x-4">
          {options.map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={`${field}-${opt.value}`} />
              <Label htmlFor={`${field}-${opt.value}`} className="font-normal text-sm">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Araç Bilgileri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Araç Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Araç Plakası</Label>
              <Input value={vehiclePlate} disabled className="bg-gray-100" />
            </div>
            <div className="space-y-2">
              <Label>Kayıt Tarihi</Label>
              <Input 
                type="date" 
                value={formData.kayitTarihi || new Date().toISOString().split('T')[0]}
                onChange={(e) => handleChange('kayitTarihi', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Teslim Alınan KM</Label>
              <Input
                type="number"
                value={formData.teslimAlinanKm || vehicleKm}
                onChange={(e) => handleChange('teslimAlinanKm', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Servis Yapılacak KM</Label>
              <Input
                type="number"
                value={formData.servisYapilacakKm || ''}
                onChange={(e) => handleChange('servisYapilacakKm', e.target.value)}
                placeholder="Örn: 60000"
              />
            </div>
          </div>
          {formData.teslimAlinanKm && formData.servisYapilacakKm && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium">
                Servise Kalan: <span className="text-blue-600 text-lg">
                  {(parseInt(formData.servisYapilacakKm) - parseInt(formData.teslimAlinanKm)).toLocaleString()} km
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ekipman Kontrol Listesi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ekipman Kontrol Listesi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <CheckItem label="Fosforlu Yelek" field="fosforluYelek" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
          <CheckItem label="Takviye Kablosu" field="takviyeKablosu" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
          <CheckItem label="Çekme Kablosu" field="cekmeKablosu" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
          <CheckItem label="Üçgen" field="ucgen" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
        </CardContent>
      </Card>

      {/* Notlar ve Hasar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notlar ve Hasar Bildirimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teslim Edenin Notları</Label>
            <Textarea
              value={formData.teslimEdenNotlar || ''}
              onChange={(e) => handleChange('teslimEdenNotlar', e.target.value)}
              placeholder="Vardiya sırasında yaşanan sorunlar, notlar..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Hasar Tespit Bildirimi</Label>
            <Textarea
              value={formData.hasarBildirimi || ''}
              onChange={(e) => handleChange('hasarBildirimi', e.target.value)}
              placeholder="Tespit edilen hasarlar, arızalar..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* İmza Bilgileri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Teslim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Teslim Edenin Adı Soyadı</Label>
            <Input
              value={formData.teslimEden || ''}
              onChange={(e) => handleChange('teslimEden', e.target.value)}
              placeholder="Ad Soyad"
            />
          </div>
          <div className="space-y-2">
            <Label>Teslim Alanın Adı Soyadı</Label>
            <Input
              value={formData.teslimAlan || ''}
              onChange={(e) => handleChange('teslimAlan', e.target.value)}
              placeholder="Ad Soyad"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HandoverForm;
