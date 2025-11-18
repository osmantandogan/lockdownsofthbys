import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import SignaturePad from '../SignaturePad';

const AmbulanceCaseForm = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    atnNo: '',
    healmedyProtocol: '',
    patientName: '',
    tcNo: '',
    gender: '',
    age: '',
    phone: '',
    complaint: '',
    consciousStatus: 'conscious'
  });

  const [vitalSigns, setVitalSigns] = useState([
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' }
  ]);

  const [procedures, setProcedures] = useState({});

  const isConscious = formData.consciousStatus === 'conscious';

  const proceduresList = [
    'Maske ile hava yolu',
    'Entübasyon',
    'CPR',
    'Defibrilasyon',
    'Oksijen inhalasyon',
    'Aspirasyon',
    'Çubuk atel',
    'Vakum atel'
  ];

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">AMBULANS VAKA FORMU</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>📋 Temel Bilgiler</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Tarih</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
            <div className="space-y-2"><Label>ATN No</Label><Input value={formData.atnNo} onChange={(e) => setFormData({...formData, atnNo: e.target.value})} /></div>
            <div className="space-y-2"><Label>HealMedy Protokol</Label><Input value={formData.healmedyProtocol} onChange={(e) => setFormData({...formData, healmedyProtocol: e.target.value})} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Adı Soyadı</Label><Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} /></div>
            <div className="space-y-2"><Label>T.C. Kimlik No</Label><Input value={formData.tcNo} onChange={(e) => setFormData({...formData, tcNo: e.target.value})} maxLength={11} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Cinsiyet</Label>
              <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="erkek">Erkek</SelectItem>
                  <SelectItem value="kadin">Kadın</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Yaşı</Label><Input type="number" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} /></div>
            <div className="space-y-2"><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
          </div>
          <div className="space-y-2"><Label>Hastanın Şikayeti</Label><Textarea value={formData.complaint} onChange={(e) => setFormData({...formData, complaint: e.target.value})} rows={3} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📊 Vital Ölçümler</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {vitalSigns.map((vital, index) => (
            <Card key={index} className="bg-gray-50">
              <CardHeader><CardTitle className="text-sm">{index + 1}. ÖLÇÜM</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <div className="space-y-1"><Label className="text-xs">Saat</Label><Input type="time" className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Tansiyon</Label><Input placeholder="120/80" className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Nabız</Label><Input placeholder="72" className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">SPO2</Label><Input placeholder="98" className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Solunum</Label><Input placeholder="16" className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Ateş</Label><Input placeholder="36.5" className="h-9" /></div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>💉 Yapılan Uygulamalar</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            {proceduresList.map((proc, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox id={`proc-${index}`} checked={procedures[proc] || false} onCheckedChange={(checked) => setProcedures({...procedures, [proc]: checked})} />
                <Label htmlFor={`proc-${index}`} className="text-xs font-normal cursor-pointer">{proc}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📝 İmzalar</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Doktor/Paramedik</Label><Input placeholder="Ad Soyad" /></div>
              <SignaturePad label="İmza" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Sürücü/Pilot</Label><Input placeholder="Ad Soyad" /></div>
              <SignaturePad label="İmza" />
            </div>
          </div>
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

export default AmbulanceCaseForm;
