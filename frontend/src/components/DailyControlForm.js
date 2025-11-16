import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';

const DailyControlForm = ({ formData, onChange }) => {
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
      {/* Aracın Genel Durumu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Aracın Genel Durumu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CheckItem label="Aracın Ruhsatı" field="ruhsat" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
          <CheckItem label="Dış Görünüş" field="disGorunus" options={[
            { value: 'temiz', label: 'Temiz' },
            { value: 'kirli', label: 'Kirli' }
          ]} />
          <CheckItem label="Kaporta" field="kaporta" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'hasarli', label: 'Hasarlı' }
          ]} />
          <CheckItem label="Lastikler" field="lastikler" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'sorunlu', label: 'Sorunlu' }
          ]} />
        </CardContent>
      </Card>

      {/* Yakıt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Yakıt Durumu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Yakıt Seviyesi</Label>
            <RadioGroup value={formData.yakitSeviyesi} onValueChange={(v) => handleChange('yakitSeviyesi', v)}>
              <div className="flex space-x-3">
                {['0', '25', '50', '75', '100'].map((val) => (
                  <div key={val} className="flex items-center space-x-2">
                    <RadioGroupItem value={val} id={`fuel-${val}`} />
                    <Label htmlFor={`fuel-${val}`} className="font-normal">%{val}</Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Sistem Kontrolleri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. Sistem Kontrolleri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <CheckItem label="Motor" field="motor" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'arizali', label: 'Arızalı' }
          ]} />
          <CheckItem label="Fren" field="fren" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'arizali', label: 'Arızalı' }
          ]} />
          <CheckItem label="GPS" field="gps" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'arizali', label: 'Arızalı' }
          ]} />
          <CheckItem label="Siren" field="siren" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'arizali', label: 'Arızalı' }
          ]} />
          <CheckItem label="Farlar" field="farlar" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'arizali', label: 'Arızalı' }
          ]} />
          <CheckItem label="Stepne" field="stepne" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
          <CheckItem label="Yangın Tüpü" field="yanginTupu" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
          <CheckItem label="Kriko" field="kriko" options={[
            { value: 'var', label: 'Var' },
            { value: 'yok', label: 'Yok' }
          ]} />
        </CardContent>
      </Card>

      {/* Kabin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Kabin Kontrolü</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CheckItem label="Temizlik" field="kabinTemizlik" options={[
            { value: 'temiz', label: 'Temiz' },
            { value: 'kirli', label: 'Kirli' }
          ]} />
          <CheckItem label="Aydınlatma" field="aydinlatma" options={[
            { value: 'saglam', label: 'Sağlam' },
            { value: 'arizali', label: 'Arızalı' }
          ]} />
        </CardContent>
      </Card>

      {/* Notlar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notlar</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notlar || ''}
            onChange={(e) => handleChange('notlar', e.target.value)}
            placeholder="Varsa ekstra notlar, sorunlar..."
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyControlForm;
