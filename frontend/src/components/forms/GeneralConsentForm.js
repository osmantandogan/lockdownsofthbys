import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';

const GeneralConsentForm = () => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientTc: '',
    procedureName: '',
    acceptTerms: false,
    doctorName: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">GENEL TİBBİ MÜDAHALE ONAM FORMU</h1>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-sm space-y-2">
        <p className="font-semibold">Sayın Hasta/Veli/Vasi,</p>
        <p className="text-justify">Bu form, size uygulanacak tıbbi müdahale hakkında bilgilendirilmeniz ve onamınızın alınması için hazırlanmıştır. Lütfen dikkatle okuyunuz.</p>
      </div>

      <Card><CardHeader><CardTitle className="text-sm">Hasta Bilgileri</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Hasta Adı Soyadı</Label><Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} placeholder="Ad Soyad" /></div>
          <div className="space-y-2"><Label>TC Kimlik No</Label><Input value={formData.patientTc} onChange={(e) => setFormData({...formData, patientTc: e.target.value})} placeholder="11111111111" maxLength={11} /></div>
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Uygulanacak İşlem</CardTitle></CardHeader><CardContent>
        <div className="space-y-2"><Label>Tıbbi Müdahale/İşlem Adı:</Label>
          <Input value={formData.procedureName} onChange={(e) => setFormData({...formData, procedureName: e.target.value})} placeholder="İşlem adı" /></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Bilgilendirme</CardTitle></CardHeader><CardContent className="text-xs space-y-3">
        <div className="bg-gray-50 p-4 rounded space-y-2">
          <p className="font-semibold">Size yapılacak işlem hakkında aşağıdaki konularda bilgilendirildiniz:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>İşlemin amacı, yöntemi ve süresi</li>
            <li>İşlemin faydaları ve beklenen sonuçlar</li>
            <li>Olası riskler ve komplikasyonlar</li>
            <li>İşlem yapılmadığı takdirde oluşabilecek durumlar</li>
            <li>Alternatif tedavi seçenekleri</li>
            <li>İşlem sonrası yapılması gerekenler</li>
          </ul>
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Hasta Hakları</CardTitle></CardHeader><CardContent className="text-xs space-y-2">
        <ul className="list-disc pl-5 space-y-1">
          <li>Uygulanabilecek tanı yöntemleri konusunda ek sorular sorabilirim</li>
          <li>Tanı yöntemine karar vermeden önce uygun bir süre düşünebilirim</li>
          <li>Önerilen tanı yöntemleri arasından seçim yapabilirim</li>
          <li>İstemediğim taktirde tedavi/girişime onam vermek zorunda değilim</li>
          <li>İstediğim aşamada işlemi durdurabilirim</li>
        </ul>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Onam Beyanı</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="bg-green-50 p-4 rounded">
          <div className="flex items-center space-x-3">
            <Switch id="accept" checked={formData.acceptTerms} onCheckedChange={(v) => setFormData({...formData, acceptTerms: v})} />
            <Label htmlFor="accept" className="text-sm font-medium cursor-pointer">Formun içeriğini okudum ve anladım. Doktorumun tüm sorularımı cevapladı. Kendi özgür irademle karar veriyorum. Bu işlemin bana/hastama uygulanmasına izin veriyorum.</Label>
          </div>
        </div>
        <div className="space-y-2"><Label>Notlar/Açıklamalar</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Varsa ek notlar..." rows={3} /></div>
      </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Hasta/Veli/Vasi</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} /></div>
          <div className="space-y-2"><Label>Tarih</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
          <SignaturePad label="İmza" required />
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Doktor</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.doctorName} onChange={(e) => setFormData({...formData, doctorName: e.target.value})} /></div>
          <div className="pt-6"><SignaturePad label="İmza" required /></div>
        </CardContent></Card>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button>✓ Kaydet</Button>
      </div>
    </div>
  );
};

export default GeneralConsentForm;
