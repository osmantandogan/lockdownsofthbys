import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import SignaturePad from '../SignaturePad';
import { toast } from 'sonner';
import { CheckCircle, FileText, Scissors } from 'lucide-react';
import { casesAPI } from '../../api';

const MinorSurgeryConsentForm = ({ 
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
  const [doctorSignature, setDoctorSignature] = useState(null);
  const [translatorSignature, setTranslatorSignature] = useState(null);

  const [formData, setFormData] = useState({
    diagnosis: initialData.diagnosis || '',
    procedureDuration: initialData.procedureDuration || '',
    consciousStatus: 'conscious',
    patientStatus: 'local',
    patientName: initialData.patientName || defaultPatientName || '',
    patientTc: initialData.patientTc || '',
    patientAddress: initialData.patientAddress || '',
    patientPhone: initialData.patientPhone || '',
    legalRepName: '',
    legalRepAddress: '',
    legalRepPhone: '',
    doctorName: '',
    translatorName: '',
    translatorPhone: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0,5)
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
      setFormData(prev => ({
        ...prev,
        diagnosis: caseData.patient?.complaint || caseData.complaint || prev.diagnosis
      }));
    }
  }, [patientInfo, caseData]);

  const isConscious = formData.consciousStatus === 'conscious';
  const isForeign = formData.patientStatus === 'foreign';

  const handleRequestConsent = () => {
    if (!formData.patientName && !formData.legalRepName) {
      toast.error('Hasta veya veli adı gereklidir');
      return;
    }
    setShowConsentDialog(true);
  };

  const handleAcceptConsent = () => {
    setConsentAccepted(true);
    setShowConsentDialog(false);
    toast.success('Küçük cerrahi onamı kabul edildi');
  };

  const handleSave = async () => {
    if (readOnly) return;
    
    if (!consentAccepted) {
      toast.error('Lütfen önce onamı kabul edin');
      handleRequestConsent();
      return;
    }

    if (!patientSignature) {
      toast.error('Hasta imzası gereklidir');
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        ...formData,
        formType: 'minor_surgery',
        patientSignature: patientSignature,
        doctorSignature: doctorSignature,
        translatorSignature: translatorSignature,
        caseId: caseId,
        savedAt: new Date().toISOString(),
        consentAcceptedAt: new Date().toISOString()
      };

      if (caseId) {
        await casesAPI.updateMedicalForm(caseId, {
          consent_forms: {
            minor_surgery: saveData
          }
        });
      }

      toast.success('Küçük cerrahi onam formu kaydedildi');
      if (onSave) onSave(saveData);
      if (onClose) onClose();
    } catch (error) {
      console.error('Form kaydetme hatası:', error);
      toast.error('Form kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Onay Dialog'u */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Scissors className="h-5 w-5" />
              Küçük Cerrahi Onam Onayı
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-semibold text-red-800 mb-2">
                  Sayın {formData.patientName || formData.legalRepName || 'Hasta'},
                </p>
                <p className="text-red-700 text-sm">
                  Size uygulanacak küçük cerrahi girişim hakkında bilgilendirildiniz.
                </p>
              </div>
              
              <div className="text-sm space-y-2 bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">İşlem hakkında bilgilendirildiniz:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>İşlemin amacı ve uygulama yöntemi</li>
                  <li>Olası riskler: kanama, enfeksiyon, iz kalması</li>
                  <li>Anestezi riskleri</li>
                  <li>İşlem sonrası bakım gereksinimleri</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <p className="text-amber-700">
                  <strong>Önemli:</strong> Kullandığınız tüm ilaçları, özellikle kan sulandırıcıları 
                  doktorunuza mutlaka bildiriniz!
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConsentDialog(false)}>İptal</Button>
            <Button onClick={handleAcceptConsent} className="bg-red-600 hover:bg-red-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Okudum ve Kabul Ediyorum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Başlık */}
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">KÜÇÜK CERRAHİ GİRİŞİM</h1>
        <h1 className="text-2xl font-bold">BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
        {consentAccepted && (
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm">
            <CheckCircle className="h-4 w-4" />
            Onam Kabul Edildi
          </div>
        )}
      </div>

      <div className="text-sm space-y-3">
        <p className="font-medium">Sayın Hasta, Sayın Veli/Vasi</p>
        <p className="text-justify">Lütfen bu formu dikkatle okuyun. Bu form sizi işlem hakkında bilgilendirme amacıyla oluşturulmuştur.</p>
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
              <Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                className={patientInfo?.name ? 'bg-green-50 border-green-300' : ''} />
            </div>
            <div className="space-y-2">
              <Label>TC Kimlik No</Label>
              <Input value={formData.patientTc} onChange={(e) => setFormData({...formData, patientTc: e.target.value})}
                maxLength={11} className={patientInfo?.tc_no ? 'bg-green-50 border-green-300' : ''} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Tanı ve İşlem Bilgisi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Tanı:</Label>
            <Input value={formData.diagnosis} onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} placeholder="Tanı" />
          </div>
          <div className="space-y-2">
            <Label>Tahmini süre (dakika):</Label>
            <Input type="number" value={formData.procedureDuration} onChange={(e) => setFormData({...formData, procedureDuration: e.target.value})} placeholder="30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">İşlemin Riskleri</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Anestezik maddeye bağlı alerjik reaksiyonlar</li>
            <li>Kanama, yara yeri enfeksiyonu, iz kalması</li>
            <li>Ciltte renk değişiklikleri</li>
            <li>Lezyonun tekrarlaması</li>
            <li>Komşu dokularda hasar</li>
          </ul>
        </CardContent>
      </Card>

      {/* Onam Beyanı */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Onam Beyanı</CardTitle></CardHeader>
        <CardContent>
          {!consentAccepted ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-red-700 text-sm mb-3">Küçük cerrahi onamını kabul etmek için aşağıdaki butona tıklayınız.</p>
              <Button onClick={handleRequestConsent} className="bg-red-600 hover:bg-red-700">
                <Scissors className="h-4 w-4 mr-2" />
                Onamı Oku ve Kabul Et
              </Button>
            </div>
          ) : (
            <div className="bg-green-50 p-4 rounded flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Onam Kabul Edildi</p>
                <p className="text-sm text-green-600">Kendi özgür irademle karar verdim.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Hasta Durumu</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.consciousStatus} onValueChange={(v) => setFormData({...formData, consciousStatus: v})}>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2"><RadioGroupItem value="conscious" id="conscious-surgery" /><Label htmlFor="conscious-surgery">Bilinci Açık ve Reşit</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="unconscious" id="unconscious-surgery" /><Label htmlFor="unconscious-surgery">Yasal Temsilci Var</Label></div>
            </div>
          </RadioGroup>
          <RadioGroup value={formData.patientStatus} onValueChange={(v) => setFormData({...formData, patientStatus: v})}>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2"><RadioGroupItem value="local" id="local" /><Label htmlFor="local">Yerli Hasta</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="foreign" id="foreign" /><Label htmlFor="foreign">Yabancı Hasta</Label></div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* İmza Alanları */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">{isConscious ? 'Hastanın' : 'Yasal Temsilci'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adı-Soyadı</Label>
              <Input value={isConscious ? formData.patientName : formData.legalRepName} 
                onChange={(e) => isConscious ? setFormData({...formData, patientName: e.target.value}) : setFormData({...formData, legalRepName: e.target.value})}
                className={patientInfo?.name ? 'bg-green-50 border-green-300' : ''} />
            </div>
            <div className="space-y-2">
              <Label>Tel. No</Label>
              <Input value={isConscious ? formData.patientPhone : formData.legalRepPhone}
                onChange={(e) => isConscious ? setFormData({...formData, patientPhone: e.target.value}) : setFormData({...formData, legalRepPhone: e.target.value})} />
            </div>
            {patientSignature ? (
              <div className="space-y-2">
                <Label>İmza (Otomatik Alındı)</Label>
                <div className="border-2 border-green-500 bg-green-50 rounded-lg p-2">
                  <img src={patientSignature} alt="İmza" className="w-full h-20 object-contain" />
                  <p className="text-xs text-green-600 text-center mt-1">✓ İmza alındı</p>
                </div>
              </div>
            ) : (
              <SignaturePad label="İmza" required />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-sm">Doktor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adı-Soyadı</Label>
              <Input value={formData.doctorName} onChange={(e) => setFormData({...formData, doctorName: e.target.value})} />
            </div>
            <SignaturePad label="İmza" onSignature={setDoctorSignature} value={doctorSignature} required />
          </CardContent>
        </Card>
      </div>

      {isForeign && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Tercüman</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Adı-Soyadı</Label><Input value={formData.translatorName} onChange={(e) => setFormData({...formData, translatorName: e.target.value})} /></div>
              <div className="space-y-2"><Label>Tel. No</Label><Input value={formData.translatorPhone} onChange={(e) => setFormData({...formData, translatorPhone: e.target.value})} /></div>
            </div>
            <SignaturePad label="İmza" onSignature={setTranslatorSignature} value={translatorSignature} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>✕ Kapat</Button>
        <Button variant="outline" onClick={() => window.print()}>🖨 Yazdır</Button>
        <Button onClick={handleSave} disabled={saving || !consentAccepted}>
          {saving ? 'Kaydediliyor...' : '✓ Kaydet'}
        </Button>
      </div>
    </div>
  );
};

export default MinorSurgeryConsentForm;
