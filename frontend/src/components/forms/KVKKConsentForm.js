import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import SignaturePad from '../SignaturePad';
import { formsAPI } from '../../api';
import { toast } from 'sonner';

const KVKKConsentForm = () => {
  const [formData, setFormData] = useState({
    patientName: '',
    informed: '',
    consent: '',
    approvedRelatives: '',
    approvedEntities: '',
    signatoryName: '',
    signDate: new Date().toISOString().split('T')[0],
    signature: null
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.patientName) {
      toast.error('Lütfen hasta adını giriniz');
      return;
    }
    if (!formData.signature) {
      toast.error('Lütfen imzalayınız');
      return;
    }

    setSaving(true);
    try {
      await formsAPI.submit({
        form_type: 'kvkk',
        form_data: formData,
        patient_name: formData.patientName
      });
      toast.success('Form başarıyla kaydedildi!');
      handleClear();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Form kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    if (confirm('Formu temizlemek istediğinizden emin misiniz?')) {
      setFormData({
        patientName: '',
        informed: '',
        consent: '',
        approvedRelatives: '',
        approvedEntities: '',
        signatoryName: '',
        signDate: new Date().toISOString().split('T')[0],
        signature: null
      });
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">KİŞİSEL VERİLERİN KORUNMASI HAKKINDA</h1>
        <h1 className="text-2xl font-bold">BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
      </div>

      {/* Introduction */}
      <div className="space-y-3 text-sm">
        <p className="font-medium">Sayın Hasta/Vasi/Veli</p>
        <p className="text-justify">
          <strong>6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK)</strong> ve <strong>29863 Sayılı Kişisel Sağlık Verilerinin İşlenmesi ve Mahremiyetinin Sağlanması Hakkında Yönetmelik</strong> Kapsamında
        </p>
        <p className="text-justify">
          Oruçreis Mahallesi Tekstilkent Caddesi Koza Plaza A Blok Kat:20 Daire:75 Esenler/İstanbul adresinde faaliyet gösteren
        </p>
        <p className="text-justify">
          <strong>MHACARE SAĞLIK TURİZM İNŞAAT TİCARET ANONİM ŞİRKETİ</strong> "Veri Sorumlusu" sıfatına sahiptir.
        </p>
        <p className="text-justify text-xs leading-relaxed">
          "Veri Sorumlusu" sıfatına sahip yukarıda adı geçen kişilerce, kişisel verileriniz aşağıda açıklandığı şekilde, tamamen veya kısmen otomatik olan yada herhangi bir veri kayıt sisteminin parçası olmak kaydıyla otomatik olmayan yollarla elde edilebilir, kaydedilebilir, depolanabilir, muhafaza edilebilir, değiştirilebilir, yeniden düzenlenebilir, açıklanabilir, aktarılabilir, devralınabilir, elde edilebilir hale getirilebilir, sınıflandırılabilir ya da kullanılması engellenebilir ve KVKK ve 29863 sayılı Yönetmelikte sayılan şekillerde işlenebilecektir.
        </p>
      </div>

      {/* Hasta Bilgileri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hasta Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Hasta Adı</Label>
            <Input
              value={formData.patientName}
              onChange={(e) => setFormData({...formData, patientName: e.target.value})}
              placeholder="Hasta adı soyadı"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kişisel Verilerin Hangi Amaçla İşlenebileceği</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-justify">
            Şirketimiz 6698 Sayılı Kişisel Verilerin Korunması Kanunun 5.maddesinin 2.fıkrasında ve 6.maddenin 3.fıkrasında belirtilen kişisel veri işleme şartları içerisindeki amaçlarla ve koşullarla sınırlı olarak kişisel veriler işlemektedir.
          </p>
          <p className="font-medium">Şirketimiz kişisel verileri, bunlarla sınırlı olmamak üzere aşağıdaki amaçlarla işleyebilmektedir:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Kamu sağlığının korunması, koruyucu hekimlik, tıbbi teşhis, tedavi ve bakım hizmetlerinin yürütülmesi, Sağlık hizmetleri ile finansmanının planlanması ve yönetimi amacıyla</li>
            <li>Elektronik(internet/mobil vs.) veya kağıt ortamında sağlanan hizmetlere dayanak olacak tüm kayıt ve belgeleri düzenlemek</li>
            <li>Mevzuat gereği T.C. Sağlık Bakanlığı ve diğer kamu kurum ve kuruluşlarına aktarmak</li>
            <li>Kamu ve özel hukuk kişileriyle yapılmış olan anlaşmalarda öngörülen yükümlülüklere uymak</li>
            <li>Talep edilen diğer hizmetleri sunabilmek</li>
            <li>Hizmet alan ile oluşan hukuki ilişkinin gereğini yerine getirmektedir</li>
            <li>Sağlık hizmetlerinin finansmanı kapsamında özel sigorta şirketleri tarafından talep edilen her türlü bilgileri paylaşma</li>
          </ul>
        </CardContent>
      </Card>

      {/* Section 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kimlere ve Hangi Amaçla Aktarılabileceği</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-justify">
            Açıklanan amaçlar kapsamında işlenen verileriniz; KVKK'da öngörülen temel ilkelere uygun olarak ve KVKK'nın 8. ve 9. maddelerinde belirtilen kişisel veri işleme şartları ve amaçları dahilinde:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Sağlık bakanlığı ve bağlı alt birimleri</li>
            <li>Yetki vermiş olduğunuz temsilcileriniz</li>
            <li>Özel sigorta şirketleri</li>
            <li>Sosyal Güvenlik Kurumu</li>
            <li>Emniyet Genel Müdürlüğü ve sair kolluk kuvvetleri</li>
            <li>Nüfus Genel Müdürlüğü</li>
            <li>Türkiye Eczacılar Birliği</li>
            <li>Mahkemeler ve her türlü yargı makamı</li>
            <li>Merkezi ve sair üçüncü kişiler, Avukatlar</li>
            <li>Tıbbi teşhis ve tedavi için iş birliği içerisinde olduğumuz laboratuvarlar, tıp merkezleri, ambulans, tıbbi cihaz ve sağlık hizmeti sunan kurumlar</li>
            <li>Hizmetlerin sağlanabilmesi amacıyla sınırlı olarak tedarikçilerimiz ile paylaşılabilecektir</li>
          </ul>
        </CardContent>
      </Card>

      {/* Section 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi</CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          <p className="text-justify">
            Kişisel verileriniz Şirket tarafından müşteri temsilcileri, ilgili internet siteleri, mobil uygulama gibi kanallardan, Şirket erişimine imkan verdiğiniz sosyal medya hesapları üzerinden elektronik ortamda ve/veya çağrı merkezi kanalıyla otomatik yada otomatik olmayan yöntemlerle toplanmaktadır. İşbu toplanan kişisel verileri hukuki sebebi; 6698 sayılı Kişisel Verilerin Korunması Kanunu, Özel Hastaneler Yönetmeliği, Sağlık Bakanlığı düzenlemeleri ve sair mevzuat hükümleridir.
          </p>
        </CardContent>
      </Card>

      {/* Section 4 - Rights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MHACARE SAĞLIK'a Başvurarak Kişisel Verilerinizin;</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <ul className="list-disc pl-5 space-y-1">
            <li>İşlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme</li>
            <li>İşlenme amacını ve amacına uygun kullanıp kullanılmadığını öğrenme</li>
            <li>Yurt içinde/yurt dışında aktarıldığı 3.kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme</li>
            <li>KVKK'nın 7. ve 29863 sayılı yönetmeliğinin 9.maddesinde öngörülen şartlar çerçevesinde silinmesini/yok edilmesini isteme</li>
            <li>Aktarıldığı 3.kişilere yukarıda sayılı işlemlerin bildirilmesini isteme</li>
            <li>Münhasıran otomatik sistemler ile analiz edilmesi nedeniyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz</li>
          </ul>
          <p className="text-justify mt-3">
            Şirketimize KVKK Kanunu'nun 11.maddesi kapsamında yapacağınız başvuruların sağlıklı ve hızlı şekilde yönetilmesi için, internet sitemizin Kişisel Verilerin Korunması başlığı altında yer alan <strong>İlgili Kişi Bilgi Talep Başvuru Formu</strong> belgesini kullanmanızı, talebinize göre istenebilecek belge/bilgileri ve kimliğinizi tespit edici gerekli belgeleri de sağlayarak bizzat elden ya da iadeli taahhütlü mektup ile yapılmasını öneriyoruz. Ayrıca, <strong>info@healmedy.com</strong> üzerinden yine bizlere talebinizi iletebilirsiniz.
          </p>
        </CardContent>
      </Card>

      {/* Bilgilendirme Onayı */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bilgilendirme Beyanı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-justify">
            "Kişisel Verilerin Korunması Hakkında Aydınlatılmış Onam Formunda" yer alan bilgi ve açıklamaların Veri Sorumlusunca tarafıma doğru ve anlaşılır biçimde:
          </p>
          <RadioGroup value={formData.informed} onValueChange={(v) => setFormData({...formData, informed: v})}>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="informed" id="informed-yes" />
                <Label htmlFor="informed-yes" className="font-normal cursor-pointer">Anlatıldığını</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="not-informed" id="informed-no" />
                <Label htmlFor="informed-no" className="font-normal cursor-pointer">Anlatılmadığını</Label>
              </div>
            </div>
          </RadioGroup>
          <p className="text-sm">Beyan eder ve bana/vesi/vasisi bulunduğum</p>
          <Input
            value={formData.patientName}
            onChange={(e) => setFormData({...formData, patientName: e.target.value})}
            placeholder="Hasta/veli adı"
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Pazarlama Onayı */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pazarlama Faaliyetleri Onayı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-justify">
            'ya ait kişisel verilerin, ben Aksini bildirmedikçe MHACARE Sağlık tarafından her türlü pazarlama faaliyetleri, bilgilendirmeler, tanıtımlar, anketler, açılış, davet, etkinlik ve iletişim çalışmaları uygulamalarında kullanılmasına, saklanmasına ve bu uygulamalar ile ilgili olarak tarafıma ve/veya adına işlem gerçekleştirdiğim temsilcisi bulunduğum kişilere MHACARE Sağlık tarafından SMS, E-posta, posta, telefon ve her türlü iletişim yolu ile ulaşılmasına hiç bir baskı altında kalmaksızın açıkça:
          </p>
          <RadioGroup value={formData.consent} onValueChange={(v) => setFormData({...formData, consent: v})}>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="consent" id="consent-yes" />
                <Label htmlFor="consent-yes" className="font-normal cursor-pointer">Onay verdiğimi</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no-consent" id="consent-no" />
                <Label htmlFor="consent-no" className="font-normal cursor-pointer">Onay vermediğimi</Label>
              </div>
            </div>
          </RadioGroup>
          <p className="text-sm">Beyan Ederim</p>
          <div className="bg-yellow-50 p-3 rounded text-xs space-y-1">
            <p>* <strong>Onay verdiğimi</strong> kutusunun işaretlenmesi halinde anılan maddeye rıza gösterildiği anlamına gelmektedir.</p>
            <p>* <strong>Onay vermediğimi</strong> kutusunun işaretlenmesi halinde anılan maddeye rıza gösterilmediği anlamına gelmektedir.</p>
          </div>
        </CardContent>
      </Card>

      {/* Onay Verilen Kişiler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Onay Verilen Kişiler ve Kurumlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kişisel Verilerimin Aktarılmasına Onay Verdiğim Yakınlarım:</Label>
            <Textarea
              value={formData.approvedRelatives}
              onChange={(e) => setFormData({...formData, approvedRelatives: e.target.value})}
              placeholder="Onay verdiğiniz yakınlarınızın isimlerini giriniz..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Kişisel Verilerimin Aktarılmasına Onay Verdiğim Diğer Özel Hukuk Kişileri:</Label>
            <Textarea
              value={formData.approvedEntities}
              onChange={(e) => setFormData({...formData, approvedEntities: e.target.value})}
              placeholder="Onay verdiğiniz diğer kişi/kurumları giriniz..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* İmza */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hastanın ve/veya Velisi/Vasisi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Adı-Soyadı</Label>
              <Input
                value={formData.signatoryName}
                onChange={(e) => setFormData({...formData, signatoryName: e.target.value})}
                placeholder="Adı Soyadı"
              />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input
                type="date"
                value={formData.signDate}
                onChange={(e) => setFormData({...formData, signDate: e.target.value})}
              />
            </div>
          </div>
          <SignaturePad
            label="İmza"
            onSignature={(sig) => setFormData({...formData, signature: sig})}
            required
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={handleClear}>
          🗑 Temizle
        </Button>
        <Button variant="outline" onClick={handlePrint}>
          🖨 Yazdır
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : '✓ Kaydet'}
        </Button>
      </div>
    </div>
  );
};

export default KVKKConsentForm;
