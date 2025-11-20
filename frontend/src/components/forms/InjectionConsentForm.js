import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';

const InjectionConsentForm = () => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAddress: '',
    patientPhone: '',
    injectionType: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0,5),
    staffName: '',
    patientSignature: null,
    staffSignature: null
  });

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">ENJEKSİYON BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
      </div>

      <div className="space-y-3 text-sm">
        <p className="font-medium">Sayın Hasta/Vasi</p>
        <p className="text-justify">Intramüsküler enjeksiyon kas içine(kaba ete), Damar içine intra venöz, ciltaltına subcutan ve cilt arasına intra dermal ve uygulanması gereken ilaçların uygulanması için bir yöntemdir.</p>
        <p className="text-justify">Deneyimli bir sağlık personeli tarafından (doktor nezaretinde) küçük çocuk ve bebeklerin uyluk ön yüzüne, daha büyüklerin kalçasına bir enjektör(iğne) aracılığı ile yapılır.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Risler ve Yan Etkiler</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-2">
          <p>İşlemin bazen çok nadir görülen istenmeyen etkileri olabilir. Bunlar enjeksiyon yerinde şişlik, kızarıklık, enfeksiyon, kas ve sinir zedelenmesi ve alerjidir. Bu durumlar deneyimli bir sağlık personeli tarafından donanımlı bir sağlık kuruluşunda yapıldığında oldukça nadirdir ve tedavisi mümkündür.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Önemli Bilgiler</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-3">
          <p className="font-semibold">Penisilin Testi:</p>
          <p className="text-justify">Hastanemizde penisilin kas içi uygulanması öncesinde (doktor istemediği sürece) test yapılmamaktadır. Çünkü hayatı tehdit edecek düzeyde penisilin alerjisi test sırasında da gerçekleşebilir ve test sırasında alerji olmaması %100 enjeksiyon sırasında alerji olmayacağı anlamına gelmez.</p>
          <p className="text-justify">Alerji açısından en önemli çocuğun veya birinci dereceden akrabalarının(anne,baba,kardeş) daha önce bir ilaca karşı alerjisinin olmamasıdır. Böylece bir durum var ise sağlık personelimize bildiriniz.</p>
          <p className="font-semibold mt-3">Reçete Kontrolleri:</p>
          <p className="text-justify">Enjeksiyonunuz reçeteniz uygun düzenlenmiş ise yapılacaktır. Eğer reçetenizde doktor kaşesi yoksa, kaşe okunaklı değil ise, reçete bir haftadan eskiyse, ilaç dozunda bir sorun varsa sağlık personelimize sizi yeniden değerlendirme için doktora yönlendirecektir.</p>
          <p className="font-semibold mt-3">Düzenli Tedaviler:</p>
          <p className="text-justify">Akut romatizmal ateş, B12 vitamini eksikliği gibi belli aralıklarla düzenli enjeksiyon olması gereken hastalara durumlarını bildirir raporları var ise reçete sorulmadan enjeksiyonu yapılacaktır.</p>
          <p className="font-semibold mt-3">Gözlem Süresi:</p>
          <p className="text-justify">Enjeksiyon sonrasında alerjik reaksiyon oluşup oluşmadığının izlenmesi açısından yarım saat bekletileceksiniz. Bu süre sonunda sağlık personeli tarafından tekrar görüldükten sonra gidebilirsiniz.</p>
          <div className="bg-yellow-50 p-3 rounded mt-3">
            <p className="font-semibold">NOT:</p>
            <p>Bir enjeksiyondan daha uzun süreli bir tedaviniz varsa; imzaladığınız formun fotokopisini alıp, diğer enjeksiyonlar için geldiğinde getirdiğiniz taktirde tedavi bitene kadar tekrar imzalamanıza gerek olmayacaktır.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Uygulanacak Enjeksiyon</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Size yapılacak enjeksiyon:</Label>
            <Input value={formData.injectionType} onChange={(e) => setFormData({...formData, injectionType: e.target.value})} placeholder="İlaç adı / Enjeksiyon tipi" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Onay Beyanı</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-green-50 p-4 rounded text-sm">
            <p className="font-medium mb-2">Bu onam formunu okuyup-anladım, anlamadığım yerler hakkında sağlık personelinden yeterli açıklamayı aldım.</p>
            <p className="font-medium">Bu işlemin bana/hastama uygulanmasına izin veriyorum.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Hasta/Vasi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Adresi</Label><Input value={formData.patientAddress} onChange={(e) => setFormData({...formData, patientAddress: e.target.value})} /></div>
            <div className="space-y-2"><Label>Tel. No</Label><Input value={formData.patientPhone} onChange={(e) => setFormData({...formData, patientPhone: e.target.value})} /></div>
            <SignaturePad label="İmza" onSignature={(sig) => setFormData({...formData, patientSignature: sig})} required />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Bilgilendirme Yapan Sağlık Çalışanı</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.staffName} onChange={(e) => setFormData({...formData, staffName: e.target.value})} /></div>
            <div className="pt-12">
              <SignaturePad label="İmza" onSignature={(sig) => setFormData({...formData, staffSignature: sig})} required />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button>✓ Kaydet</Button>
      </div>
    </div>
  );
};

export default InjectionConsentForm;
