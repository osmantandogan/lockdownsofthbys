import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import SignaturePad from '../SignaturePad';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, FileText, Syringe } from 'lucide-react';
import { casesAPI } from '../../api';

const InjectionConsentForm = ({ 
  readOnly = false, 
  initialData = {}, 
  caseId = null, 
  caseData = null,
  patientInfo = null,
  patientSignature = null,
  patientName: defaultPatientName = '',
  onSave,
  onClose
}) => {
  const [saving, setSaving] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [staffSignature, setStaffSignature] = useState(null);

  const [formData, setFormData] = useState({
    patientName: initialData.patientName || defaultPatientName || '',
    patientTc: initialData.patientTc || '',
    patientAddress: initialData.patientAddress || '',
    patientPhone: initialData.patientPhone || '',
    injectionType: initialData.injectionType || '',
    date: initialData.date || new Date().toISOString().split('T')[0],
    time: initialData.time || new Date().toTimeString().slice(0,5),
    staffName: initialData.staffName || '',
    patientSignature: initialData.patientSignature || null,
    staffSignature: initialData.staffSignature || null
  });

  // Hasta bilgilerini otomatik doldur
  useEffect(() => {
    if (patientInfo) {
      const fullName = `${patientInfo.name || ''} ${patientInfo.surname || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        patientName: fullName || prev.patientName,
        patientTc: patientInfo.tc_no || patientInfo.tcNo || prev.patientTc,
        patientPhone: patientInfo.phone || prev.patientPhone,
        patientAddress: patientInfo.address || prev.patientAddress,
      }));
    }
    if (caseData) {
      // İlaç bilgisini medications'tan al
      const medications = caseData.medical_form?.medications || {};
      const firstMed = Object.keys(medications).find(k => medications[k]?.selected);
      if (firstMed) {
        setFormData(prev => ({
          ...prev,
          injectionType: firstMed || prev.injectionType
        }));
      }
    }
  }, [patientInfo, caseData]);

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
    setShowConsentDialog(false);
    toast.success('Enjeksiyon onamı kabul edildi');
  };

  const handleSave = async () => {
    if (readOnly) return;
    
    if (!consentAccepted) {
      toast.error('Lütfen önce onamı kabul edin');
      handleRequestConsent();
      return;
    }

    if (!patientSignature && !formData.patientSignature) {
      toast.error('Hasta imzası gereklidir');
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        ...formData,
        formType: 'injection',
        patientSignature: patientSignature || formData.patientSignature,
        staffSignature: staffSignature,
        caseId: caseId,
        savedAt: new Date().toISOString(),
        consentAcceptedAt: new Date().toISOString()
      };

      if (caseId) {
        await casesAPI.updateMedicalForm(caseId, {
          consent_forms: {
            injection: saveData
          }
        });
      }

      toast.success('Enjeksiyon onam formu kaydedildi');
      if (onSave) onSave(saveData);
      if (onClose) onClose();
    } catch (error) {
      console.error('Form kaydetme hatası:', error);
      toast.error('Form kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  const handleClear = () => {
    if (readOnly) return;
    if (confirm('Formu temizlemek istediğinizden emin misiniz?')) {
      setFormData({
        patientName: defaultPatientName || '',
        patientTc: '',
        patientAddress: '',
        patientPhone: '',
        injectionType: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0,5),
        staffName: '',
        patientSignature: null,
        staffSignature: null
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
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Syringe className="h-5 w-5" />
              Enjeksiyon Onam Onayı
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="font-semibold text-orange-800 mb-2">Sayın {formData.patientName || 'Hasta'},</p>
                <p className="text-orange-700 text-sm">
                  Size uygulanacak "{formData.injectionType || 'enjeksiyon'}" işlemi hakkında 
                  bilgilendirildiniz.
                </p>
              </div>
              
              <div className="text-sm space-y-2 bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">Enjeksiyon işlemi hakkında bilgilendirildiniz:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>Enjeksiyonun amacı ve uygulama yöntemi</li>
                  <li>Olası riskler: şişlik, kızarıklık, enfeksiyon, alerji</li>
                  <li>Enjeksiyon sonrası yarım saat bekleme gerekliliği</li>
                  <li>Alerjik reaksiyon belirtileri</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="text-red-700">
                  <strong>Uyarı:</strong> Daha önce herhangi bir ilaca karşı alerjiniz varsa 
                  mutlaka sağlık personeline bildiriniz!
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConsentDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleAcceptConsent} className="bg-orange-600 hover:bg-orange-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Okudum ve Kabul Ediyorum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Başlık */}
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">ENJEKSİYON BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
        {consentAccepted && (
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm">
            <CheckCircle className="h-4 w-4" />
            Onam Kabul Edildi
          </div>
        )}
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
          <p className="font-semibold mt-3">Gözlem Süresi:</p>
          <p className="text-justify">Enjeksiyon sonrasında alerjik reaksiyon oluşup oluşmadığının izlenmesi açısından yarım saat bekletileceksiniz.</p>
        </CardContent>
      </Card>

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
                onChange={(e) => !readOnly && setFormData({...formData, patientName: e.target.value})}
                disabled={readOnly}
                className={patientInfo?.name ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>TC Kimlik No</Label>
              <Input 
                value={formData.patientTc} 
                onChange={(e) => !readOnly && setFormData({...formData, patientTc: e.target.value})}
                disabled={readOnly}
                maxLength={11}
                className={patientInfo?.tc_no ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Uygulanacak Enjeksiyon</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Size yapılacak enjeksiyon:</Label>
            <Input 
              value={formData.injectionType} 
              onChange={(e) => !readOnly && setFormData({...formData, injectionType: e.target.value})} 
              placeholder="İlaç adı / Enjeksiyon tipi"
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Onam Beyanı */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Onam Beyanı</CardTitle></CardHeader>
        <CardContent>
          {!consentAccepted ? (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <p className="text-orange-700 text-sm mb-3">
                Enjeksiyon onamını kabul etmek için aşağıdaki butona tıklayınız.
              </p>
              <Button onClick={handleRequestConsent} className="bg-orange-600 hover:bg-orange-700">
                <Syringe className="h-4 w-4 mr-2" />
                Onamı Oku ve Kabul Et
              </Button>
            </div>
          ) : (
            <div className="bg-green-50 p-4 rounded flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Onam Kabul Edildi</p>
                <p className="text-sm text-green-600">
                  Bu işlemin bana/hastama uygulanmasına izin veriyorum.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* İmza Alanları */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Hasta/Vasi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adı-Soyadı</Label>
              <Input 
                value={formData.patientName} 
                readOnly
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label>Adresi</Label>
              <Input 
                value={formData.patientAddress} 
                onChange={(e) => !readOnly && setFormData({...formData, patientAddress: e.target.value})}
                disabled={readOnly}
                className={patientInfo?.address ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>Tel. No</Label>
              <Input 
                value={formData.patientPhone} 
                onChange={(e) => !readOnly && setFormData({...formData, patientPhone: e.target.value})}
                disabled={readOnly}
                className={patientInfo?.phone ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
            {patientSignature ? (
              <div className="space-y-2">
                <Label>İmza (Otomatik Alındı)</Label>
                <div className="border-2 border-green-500 bg-green-50 rounded-lg p-2">
                  <img src={patientSignature} alt="Hasta İmzası" className="w-full h-24 object-contain" />
                  <p className="text-xs text-green-600 text-center mt-1">✓ İmza alındı</p>
                </div>
              </div>
            ) : !readOnly ? (
              <SignaturePad label="İmza" onSignature={(sig) => setFormData({...formData, patientSignature: sig})} required />
            ) : formData.patientSignature && (
              <div>
                <Label>İmza</Label>
                <img src={formData.patientSignature} alt="İmza" className="max-w-xs border rounded mt-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Bilgilendirme Yapan Sağlık Çalışanı</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adı-Soyadı</Label>
              <Input 
                value={formData.staffName} 
                onChange={(e) => !readOnly && setFormData({...formData, staffName: e.target.value})}
                disabled={readOnly}
              />
            </div>
            {!readOnly ? (
              <SignaturePad 
                label="İmza" 
                onSignature={setStaffSignature} 
                value={staffSignature}
                required 
              />
            ) : formData.staffSignature && (
              <div>
                <Label>İmza</Label>
                <img src={formData.staffSignature} alt="İmza" className="max-w-xs border rounded mt-2" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Butonlar */}
      {!readOnly && (
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>✕ Kapat</Button>
          <Button variant="outline" onClick={handleClear}>🗑 Temizle</Button>
          <Button variant="outline" onClick={handlePrint}>🖨 Yazdır</Button>
          <Button onClick={handleSave} disabled={saving || !consentAccepted}>
            {saving ? 'Kaydediliyor...' : '✓ Kaydet'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InjectionConsentForm;
