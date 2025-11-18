import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import SignaturePad from '../SignaturePad';

const MinorSurgeryConsentForm = () => {
  const [formData, setFormData] = useState({
    diagnosis: '',
    procedureDuration: '',
    consciousStatus: 'conscious',
    patientStatus: 'local',
    patientName: '',
    patientAddress: '',
    patientPhone: '',
    legalRepName: '',
    legalRepAddress: '',
    legalRepPhone: '',
    doctorName: '',
    translatorName: '',
    translatorPhone: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0,5)
  });

  const isConscious = formData.consciousStatus === 'conscious';
  const isForeign = formData.patientStatus === 'foreign';

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">KÜÇÜK CERRAHİ GİRİŞİM</h1>
        <h1 className="text-2xl font-bold">BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
      </div>

      <div className="text-sm space-y-3">
        <p className="font-medium">Sayın Hasta, Sayın Veli/Vasi</p>
        <p className="text-justify">Lütfen bu formu dikkatle okuyun. Bu form sizi işlem hakkında bilgilendirme amacıyla oluşturulmuştur. Bilgilendirme sonucunda tamamen serbest iradenizle işlemi yaptırma veya reddetme hakkına sahipsiniz.</p>
      </div>

      <Card><CardHeader><CardTitle className="text-sm">Tanı ve İşlem Bilgisi</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="space-y-2"><Label>Yapılan tetkik ve değerlendirmeler sonucu size tanısı:</Label>
          <Input value={formData.diagnosis} onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} placeholder="Tanı" /></div>
        <p className="text-xs text-justify">ile size küçük cerrahi girişim yapılmasını uygun görmekteyiz. Bu tedaviye siz tedavi için uygun koşulları sağladığınız ve tedaviyi kabul etmeniz halinde yapacağız.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Girişimin Tanımı ve Amacı</CardTitle></CardHeader><CardContent className="text-xs space-y-2">
        <p className="text-justify">Bu işlem doktorunuzun tanısını koyduğu lezyonu, lokal anestezik madde ile uyuşturulduktan sonra, cerrahi ile keserek uzaklaştırmak amacıyla yapılmaktadır. Yapılan kesi, girişim sonrası uygun sütür materyali ile dikilmektedir.</p>
        <p className="text-justify">Planlanan girişim ile cilt, ciltaltı, kas, bağ ve kirişlerin bütünlüğünün sağlanması ve bu dokuların fonksiyonunu sürdürmek hedeflenmektedir.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">İşlemin Uygulanmaması Durumunda</CardTitle></CardHeader><CardContent className="text-xs">
        <p className="text-justify">Bu işlem yapılmaması yaranızın açık kalması ve infekte olmasına yol açar. Onarım yapılmadığı takdirde yaralanan bölgede fonksiyon kaybı meydana gelir.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">İşlemin Riskleri ve Komplikasyonları</CardTitle></CardHeader><CardContent className="text-xs space-y-2">
        <p className="text-justify">Tıbbi tüm girişimlerde olduğu gibi, bu işlemde de bazı komplikasyon riskleri mevcuttur:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Uygulanan anestezik maddeye bağlı alerjik reaksiyonlar</li>
          <li>Kanama</li>
          <li>Yara yeri enfeksiyonu</li>
          <li>İz kalması</li>
          <li>İyileşme sonrası ciltte açık veya koyu renk değişiklikleri</li>
          <li>Lezyonun tamamen çıkarılamayıp kısmen sebat etmesi ya da tekrarlanması</li>
          <li>İşlem sırasında veya sonrasında ağrı</li>
          <li>Komşu doku ve organlarda kısmi hasar</li>
          <li>Dikiş materyaline karşı alerjik reaksiyonlar</li>
          <li>Dikiş açılması, kan toplanması, şişlik</li>
          <li>Duyu ve his kayıpları</li>
        </ul>
        <p className="text-justify mt-2">Onarılan cilt, cilt altı, kas, bağ ve kirişler aşırı zorlandığı takdirde ayrılabilir veya hareketsiz kalmaya bağlı yapışıklıklar oluşabilir.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Dikkat Edilmesi Gerekenler</CardTitle></CardHeader><CardContent className="text-xs space-y-3">
        <p className="font-semibold">Girişimden Önce:</p>
        <p className="text-justify">Kullandığınız tüm ilaçları, mevcut sistemik hastalıklarınızı işlem yapılmadan önce doktorunuza mutlaka bildiriniz. Özellikle aspirin, kumadin, omega3, yeşil çay gibi pıhtılaşma önleyiciler önemlidir.</p>
        <p className="font-semibold mt-2">Girişimden Sonra:</p>
        <p className="text-justify">Yapılan işlem sonrası gerekli görüldüğünde verilecek tedavileri düzenli olarak kullanınız. Pansuman veya kontrol amacıyla verilen randevularınıza mutlaka geliniz.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">İşlem Tahmini Süresi</CardTitle></CardHeader><CardContent>
        <div className="space-y-2"><Label>Tahmini süre (dakika):</Label>
          <Input type="number" value={formData.procedureDuration} onChange={(e) => setFormData({...formData, procedureDuration: e.target.value})} placeholder="30" /></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Hasta Bilinci ve Durumu</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label>Hasta Bilinç Durumu:</Label>
          <RadioGroup value={formData.consciousStatus} onValueChange={(v) => setFormData({...formData, consciousStatus: v})}>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2"><RadioGroupItem value="conscious" id="conscious-surgery" /><Label htmlFor="conscious-surgery">Bilinci Açık ve Reşit</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="unconscious" id="unconscious-surgery" /><Label htmlFor="unconscious-surgery">Bilinci Kapalı / Yasal Temsilci Var</Label></div>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-2"><Label>Hasta Durumu:</Label>
          <RadioGroup value={formData.patientStatus} onValueChange={(v) => setFormData({...formData, patientStatus: v})}>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2"><RadioGroupItem value="local" id="local" /><Label htmlFor="local">Yerli Hasta</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="foreign" id="foreign" /><Label htmlFor="foreign">Yabancı Hasta (Çeviri Gerekli)</Label></div>
            </div>
          </RadioGroup>
        </div>
      </CardContent></Card>

      {isConscious ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm">Hastanın</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Adresi</Label><Input value={formData.patientAddress} onChange={(e) => setFormData({...formData, patientAddress: e.target.value})} /></div>
            <div className="space-y-2"><Label>Tel. No</Label><Input value={formData.patientPhone} onChange={(e) => setFormData({...formData, patientPhone: e.target.value})} /></div>
            <SignaturePad label="İmza" required />
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Ameliyat/İşlemi Yapan Doktor</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Doktor Adı-Soyadı</Label><Input value={formData.doctorName} onChange={(e) => setFormData({...formData, doctorName: e.target.value})} /></div>
            <div className="pt-16"><SignaturePad label="İmza" required /></div>
          </CardContent></Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm">Yasal Temsilci (Vasi/Veli)</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.legalRepName} onChange={(e) => setFormData({...formData, legalRepName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Adresi</Label><Input value={formData.legalRepAddress} onChange={(e) => setFormData({...formData, legalRepAddress: e.target.value})} /></div>
            <div className="space-y-2"><Label>Tel. No</Label><Input value={formData.legalRepPhone} onChange={(e) => setFormData({...formData, legalRepPhone: e.target.value})} /></div>
            <SignaturePad label="İmza" required />
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Doktor</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.doctorName} onChange={(e) => setFormData({...formData, doctorName: e.target.value})} /></div>
            <div className="pt-16"><SignaturePad label="İmza" required /></div>
          </CardContent></Card>
        </div>
      )}

      {isForeign && (
        <Card><CardHeader><CardTitle className="text-sm">Tercüman (Yabancı Hasta için)</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Tercüman Adı-Soyadı</Label><Input value={formData.translatorName} onChange={(e) => setFormData({...formData, translatorName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Tel. No</Label><Input value={formData.translatorPhone} onChange={(e) => setFormData({...formData, translatorPhone: e.target.value})} /></div>
          </div>
          <SignaturePad label="İmza" />
        </CardContent></Card>
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button>✓ Kaydet</Button>
      </div>
    </div>
  );
};

export default MinorSurgeryConsentForm;
