import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import SignaturePad from '../SignaturePad';

const PunctureConsentForm = () => {
  const [formData, setFormData] = useState({
    consciousnessStatus: 'conscious',
    patientName: '',
    patientAddress: '',
    patientPhone: '',
    legalRepName: '',
    legalRepAddress: '',
    legalRepPhone: '',
    doctorName: '',
    witnessName: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0,5)
  });

  const isConscious = formData.consciousnessStatus === 'conscious';

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-xl font-bold">İNTRAARTİKÜLER, KAS İÇİ, KAS ÇEVRESİ</h1>
        <h1 className="text-xl font-bold">ENJEKSİYON ve PONKSİYON BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
      </div>

      <p className="text-sm font-medium">Sayın Hasta, Sayın Veli/Vasi</p>

      <Card><CardHeader><CardTitle className="text-base">Yöntem</CardTitle></CardHeader><CardContent className="text-xs space-y-2">
        <p className="text-justify">Sistemik romatizmal hastalıklar, lokal ve/veya genel travmalar, metabolik hastalıklar, beyinomurilik yaralanmaları, iltihabi hastalıklar, psikolojik rahatsızlıklar, herhangi bir ameliyat ve tıbbi girişimin istenmeyen etkisi gibi olaylara bağlı olarak kaslar, kemikler, sinirler, eklem ve çevresindeki yapıların fonksiyon ve yapılarında bozulma olabilir.</p>
        <p className="font-semibold mt-2">Enjeksiyon Tedavisi:</p>
        <p className="text-justify">Yukarıda belirtilen durumların tanısını desteklemek veya tedavi etmek için kas, eklem içi ve çevresel ile diğer yumuşak dokulara lokal anestezik, steroid(kortizon), botulinum toksin, fenol, alkol, hyalüronik asit gibi maddelerin uygulanmasıdır.</p>
        <p className="font-semibold mt-2">Ponksiyon/Aspirasyon:</p>
        <p className="text-justify">Eklem içi veya başka dokular arasındaki sıvının (eklem sıvısı, kan, iltihap vb.) bir iğne yardımı ile boşaltılmasıdır.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">İşlemin Avantajları</CardTitle></CardHeader><CardContent><ul className="list-disc pl-5 text-xs space-y-1">
        <li>Hem tanı hemde tedaviye yardımcı olması</li>
        <li>Aynı seansta analiz için sıvı almanın mümkün olması</li>
        <li>Eklem içi iltihabi süreci durdurması</li>
        <li>Ağrı ve hareket kısıtlılığı gibi şikayetlerin hafifletmesi</li>
        <li>Gereksiz sistemik tedaviden kaçınılması</li>
        <li>Yan etki riskinin çok az olması</li>
        <li>Ucuz olması</li>
      </ul></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">İşlemin Riskleri</CardTitle></CardHeader><CardContent className="text-xs space-y-2">
        <p className="font-semibold">Genel riskler ve komplikasyonlar:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ağrıda artış, yanma, sızlanma</li>
          <li>Enjeksiyon yerinde kızarıklık, hafif şişlik</li>
          <li>Mide bulantısı, baş dönmesi, tansiyon düşmesi</li>
          <li>Kan şekeri ve tansiyonda değişiklikler</li>
          <li>Çok nadir: Kalp ritmi bozukluğu, sinir-kas yaralanması, felç, kanama, alerjik reaksiyonlar</li>
        </ul>
        <div className="bg-red-50 p-3 rounded mt-3">
          <p className="font-semibold">UYARI: Bilinen ilaç alerjisi durumlarını, hastalıklarınızı doktorunuza belirtmelisiniz.</p>
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Yapılacak İşlem</CardTitle></CardHeader><CardContent>
        <div className="space-y-2">
          <Label>Size yapılacak enjeksiyon:</Label>
          <Input value={formData.injectionType} onChange={(e) => setFormData({...formData, injectionType: e.target.value})} placeholder="İlaç/işlem adı" />
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Onay</CardTitle></CardHeader><CardContent>
        <div className="bg-green-50 p-4 rounded space-y-2">
          <p className="font-medium text-sm">Formun içeriğini okudum ve anladım. Doktorumun tüm sorularımı cevapladı.</p>
          <p className="font-medium text-sm">Kendi özgür irademle karar veriyorum.</p>
          <p className="text-xs mt-2">✓ Okudum, Anladım, Onaylıyorum</p>
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Hasta Bilinç Durumu</CardTitle></CardHeader><CardContent>
        <RadioGroup value={formData.consciousnessStatus} onValueChange={(v) => setFormData({...formData, consciousnessStatus: v})}>
          <div className="flex space-x-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="conscious" id="conscious" />
              <Label htmlFor="conscious">Bilinci Açık</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="unconscious" id="unconscious" />
              <Label htmlFor="unconscious">Bilinci Kapalı / Yasal Temsilci Var</Label>
            </div>
          </div>
        </RadioGroup>
      </CardContent></Card>

      {isConscious ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">Hastanın</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Adresi</Label><Input value={formData.patientAddress} onChange={(e) => setFormData({...formData, patientAddress: e.target.value})} /></div>
            <div className="space-y-2"><Label>Tel. No</Label><Input value={formData.patientPhone} onChange={(e) => setFormData({...formData, patientPhone: e.target.value})} /></div>
            <SignaturePad label="İmza" required />
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Doktor</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.doctorName} onChange={(e) => setFormData({...formData, doctorName: e.target.value})} /></div>
            <div className="pt-12"><SignaturePad label="İmza" required /></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Şahit</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.witnessName} onChange={(e) => setFormData({...formData, witnessName: e.target.value})} /></div>
            <div className="pt-12"><SignaturePad label="İmza" /></div>
          </CardContent></Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">Yasal Temsilci (Vasi/Veli)</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.legalRepName} onChange={(e) => setFormData({...formData, legalRepName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Adresi</Label><Input value={formData.legalRepAddress} onChange={(e) => setFormData({...formData, legalRepAddress: e.target.value})} /></div>
            <div className="space-y-2"><Label>Tel. No</Label><Input value={formData.legalRepPhone} onChange={(e) => setFormData({...formData, legalRepPhone: e.target.value})} /></div>
            <SignaturePad label="İmza" required />
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Doktor</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.doctorName} onChange={(e) => setFormData({...formData, doctorName: e.target.value})} /></div>
            <div className="pt-12"><SignaturePad label="İmza" required /></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Şahit</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.witnessName} onChange={(e) => setFormData({...formData, witnessName: e.target.value})} /></div>
            <div className="pt-12"><SignaturePad label="İmza" /></div>
          </CardContent></Card>
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button>✓ Kaydet</Button>
      </div>
    </div>
  );
};

export default PunctureConsentForm;
