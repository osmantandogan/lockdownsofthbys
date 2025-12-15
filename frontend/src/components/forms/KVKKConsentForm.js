import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import SignaturePad from '../SignaturePad';
import { toast } from 'sonner';
import PDFExportButton from '../PDFExportButton';
import { AlertTriangle, CheckCircle, FileText, Shield } from 'lucide-react';
import { casesAPI } from '../../api';

const KVKKConsentForm = ({ 
  readOnly = false, 
  initialData = {}, 
  caseId = null, 
  caseData = null,
  patientInfo = null,
  patientSignature = null,
  caseNumber = null, 
  patientName: defaultPatientName = '',
  onSave,
  onClose
}) => {
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    patientName: initialData.patientName || defaultPatientName || '',
    patientTc: initialData.patientTc || '',
    informed: initialData.informed || '',
    consent: initialData.consent || '',
    approvedRelatives: initialData.approvedRelatives || '',
    approvedEntities: initialData.approvedEntities || '',
    signatoryName: initialData.signatoryName || '',
    signDate: initialData.signDate || new Date().toISOString().split('T')[0],
    signature: initialData.signature || null
  });

  // Hasta bilgilerini otomatik doldur
  useEffect(() => {
    if (patientInfo) {
      const fullName = `${patientInfo.name || ''} ${patientInfo.surname || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        patientName: fullName || prev.patientName,
        patientTc: patientInfo.tc_no || patientInfo.tcNo || prev.patientTc,
        signatoryName: fullName || prev.signatoryName,
      }));
    }
  }, [patientInfo]);

  // Onay dialog'unu göster
  const handleRequestConsent = () => {
    if (!formData.patientName) {
      toast.error('Hasta adı gereklidir');
      return;
    }
    setShowConsentDialog(true);
  };

  // Onay kabul edildiğinde
  const handleAcceptConsent = () => {
    setConsentAccepted(true);
    setFormData(prev => ({ ...prev, informed: 'informed', consent: 'consent' }));
    setShowConsentDialog(false);
    toast.success('KVKK onamı kabul edildi');
  };

  const handleSave = async () => {
    if (readOnly) return;
    
    if (!consentAccepted) {
      toast.error('Lütfen önce KVKK onamını kabul edin');
      handleRequestConsent();
      return;
    }

    if (!patientSignature && !formData.signature) {
      toast.error('Hasta imzası gereklidir');
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        ...formData,
        formType: 'kvkk',
        signature: patientSignature || formData.signature,
        caseId: caseId,
        caseNumber: caseNumber,
        savedAt: new Date().toISOString(),
        consentAcceptedAt: new Date().toISOString()
      };

      if (caseId) {
        await casesAPI.updateMedicalForm(caseId, {
          consent_forms: {
            kvkk: saveData
          }
        });
      }

      toast.success('KVKK onam formu kaydedildi');
      if (onSave) onSave(saveData);
      if (onClose) onClose();
    } catch (error) {
      console.error('Form kaydetme hatası:', error);
      toast.error('Form kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    if (readOnly) return;
    if (confirm('Formu temizlemek istediğinizden emin misiniz?')) {
      setFormData({
        patientName: defaultPatientName || '',
        patientTc: '',
        informed: '',
        consent: '',
        approvedRelatives: '',
        approvedEntities: '',
        signatoryName: '',
        signDate: new Date().toISOString().split('T')[0],
        signature: null
      });
      setConsentAccepted(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Onay Dialog'u */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Shield className="h-5 w-5" />
              KVKK Onam Onayı
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold text-blue-800 mb-2">Sayın {formData.patientName || 'Hasta'},</p>
                <p className="text-blue-700 text-sm">
                  6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerinizin 
                  işlenmesi hakkında bilgilendirildiniz.
                </p>
              </div>
              
              <div className="text-sm space-y-2 bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">Bu formu kabul ettiğinizde:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>Kişisel verilerinizin nasıl işleneceği hakkında bilgilendirildiğinizi,</li>
                  <li>Verilerinizin hangi amaçlarla kullanılacağını anladığınızı,</li>
                  <li>KVKK kapsamındaki haklarınızı öğrendiğinizi,</li>
                  <li>Pazarlama faaliyetleri için onay verip vermediğinizi beyan etmiş olursunuz.</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <p className="text-amber-700">
                  <strong>Yasal Bilgi:</strong> KVKK kapsamında istediğiniz zaman verilerinizin 
                  silinmesini veya düzeltilmesini talep edebilirsiniz.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConsentDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleAcceptConsent} className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Okudum ve Kabul Ediyorum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">KİŞİSEL VERİLERİN KORUNMASI HAKKINDA</h1>
        <h1 className="text-2xl font-bold">BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
        {consentAccepted && (
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
            <CheckCircle className="h-4 w-4" />
            KVKK Onamı Kabul Edildi
          </div>
        )}
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
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Hasta Bilgileri
            {patientInfo && <span className="text-xs text-green-600 font-normal">(Otomatik dolduruldu)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Hasta Adı Soyadı</Label>
              <Input
                value={formData.patientName}
                onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                placeholder="Hasta adı soyadı"
                className={patientInfo?.name ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>TC Kimlik No</Label>
              <Input
                value={formData.patientTc}
                onChange={(e) => setFormData({...formData, patientTc: e.target.value})}
                placeholder="11111111111"
                maxLength={11}
                className={patientInfo?.tc_no ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
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

      {/* Onam Beyanı */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Onam Beyanı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!consentAccepted ? (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-blue-700 text-sm mb-3">
                KVKK onamını kabul etmek için aşağıdaki butona tıklayınız.
              </p>
              <Button onClick={handleRequestConsent} className="bg-blue-600 hover:bg-blue-700">
                <Shield className="h-4 w-4 mr-2" />
                KVKK Onamını Oku ve Kabul Et
              </Button>
            </div>
          ) : (
            <div className="bg-blue-50 p-4 rounded flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-medium text-blue-700">KVKK Onamı Kabul Edildi</p>
                <p className="text-sm text-blue-600">
                  Kişisel verilerinizin işlenmesi hakkında bilgilendirildiniz.
                </p>
              </div>
            </div>
          )}
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
                className={patientInfo?.name ? 'bg-green-50 border-green-300' : ''}
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
          
          {patientSignature ? (
            <div className="space-y-2">
              <Label>İmza (Otomatik Alındı)</Label>
              <div className="border-2 border-blue-500 bg-blue-50 rounded-lg p-2">
                <img src={patientSignature} alt="Hasta İmzası" className="w-full h-24 object-contain" />
                <p className="text-xs text-blue-600 text-center mt-1">✓ İmza alındı</p>
              </div>
            </div>
          ) : (
            <SignaturePad
              label="İmza"
              onSignature={(sig) => setFormData({...formData, signature: sig})}
              required
            />
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {!readOnly && (
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            ✕ Kapat
          </Button>
          <Button variant="outline" onClick={handleClear}>
            🗑 Temizle
          </Button>
          <PDFExportButton 
            formType="kvkk"
            formData={formData}
            extraData={{
              consentText: `6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, kişisel verilerimin işlenmesi hakkında aydınlatıldım.`
            }}
            filename={`kvkk_onam_${formData.patientName || 'form'}`}
            variant="outline"
          >
            📄 PDF İndir
          </PDFExportButton>
          <Button variant="outline" onClick={handlePrint}>
            🖨 Yazdır
          </Button>
          <Button onClick={handleSave} disabled={saving || !consentAccepted}>
            {saving ? 'Kaydediliyor...' : '✓ Kaydet'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default KVKKConsentForm;
