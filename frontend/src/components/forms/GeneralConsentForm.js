import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import SignaturePad from '../SignaturePad';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { casesAPI } from '../../api';

const GeneralConsentForm = ({ caseId, caseData, patientInfo, patientSignature, onSave, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [doctorSignature, setDoctorSignature] = useState(null);
  
  const [formData, setFormData] = useState({
    patientName: '',
    patientTc: '',
    procedureName: '',
    acceptTerms: false,
    doctorName: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Hasta bilgilerini otomatik doldur
  useEffect(() => {
    if (patientInfo) {
      setFormData(prev => ({
        ...prev,
        patientName: `${patientInfo.name || ''} ${patientInfo.surname || ''}`.trim() || prev.patientName,
        patientTc: patientInfo.tc_no || patientInfo.tcNo || prev.patientTc,
      }));
    }
    if (caseData) {
      const complaint = caseData.patient?.complaint || caseData.complaint || '';
      setFormData(prev => ({
        ...prev,
        procedureName: complaint || prev.procedureName
      }));
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
    setFormData(prev => ({ ...prev, acceptTerms: true }));
    setShowConsentDialog(false);
    toast.success('Onam kabul edildi');
  };

  // Formu kaydet
  const handleSave = async () => {
    if (!consentAccepted) {
      toast.error('Lütfen önce onam formunu kabul edin');
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
        formType: 'general_consent',
        patientSignature: patientSignature || formData.patientSignature,
        doctorSignature: doctorSignature,
        caseId: caseId,
        savedAt: new Date().toISOString(),
        consentAcceptedAt: new Date().toISOString()
      };

      if (caseId) {
        await casesAPI.updateMedicalForm(caseId, {
          consent_forms: {
            general_consent: saveData
          }
        });
      }

      toast.success('Onam formu kaydedildi');
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
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Onam Onayı Gerekli
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-semibold text-amber-800 mb-2">Sayın {formData.patientName || 'Hasta'},</p>
                <p className="text-amber-700 text-sm">
                  Size uygulanacak "{formData.procedureName || 'tıbbi müdahale'}" işlemi hakkında 
                  bilgilendirildiniz. Bu formu kabul etmeden önce lütfen aşağıdaki maddeleri dikkatlice okuyunuz.
                </p>
              </div>
              
              <div className="text-sm space-y-2 bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">Bu formu kabul ettiğinizde:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>İşlemin amacı, yöntemi ve olası riskleri hakkında bilgilendirildiğinizi,</li>
                  <li>Sorularınızın cevaplandığını,</li>
                  <li>Kendi özgür iradenizle onay verdiğinizi,</li>
                  <li>İşlemin uygulanmasına izin verdiğinizi kabul etmiş olursunuz.</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-700">
                  <strong>Not:</strong> İstediğiniz zaman onayınızı geri çekme hakkına sahipsiniz.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConsentDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleAcceptConsent} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Okudum ve Kabul Ediyorum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Başlığı */}
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">GENEL TİBBİ MÜDAHALE ONAM FORMU</h1>
        {consentAccepted && (
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
            <CheckCircle className="h-4 w-4" />
            Onam Kabul Edildi
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-sm space-y-2">
        <p className="font-semibold">Sayın Hasta/Veli/Vasi,</p>
        <p className="text-justify">Bu form, size uygulanacak tıbbi müdahale hakkında bilgilendirilmeniz ve onamınızın alınması için hazırlanmıştır. Lütfen dikkatle okuyunuz.</p>
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
                placeholder="Ad Soyad"
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

      {/* Uygulanacak İşlem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uygulanacak İşlem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Tıbbi Müdahale/İşlem Adı:</Label>
            <Input 
              value={formData.procedureName} 
              onChange={(e) => setFormData({...formData, procedureName: e.target.value})} 
              placeholder="İşlem adı" 
            />
          </div>
        </CardContent>
      </Card>

      {/* Bilgilendirme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bilgilendirme</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
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
        </CardContent>
      </Card>

      {/* Hasta Hakları */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hasta Hakları</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Uygulanabilecek tanı yöntemleri konusunda ek sorular sorabilirim</li>
            <li>Tanı yöntemine karar vermeden önce uygun bir süre düşünebilirim</li>
            <li>Önerilen tanı yöntemleri arasından seçim yapabilirim</li>
            <li>İstemediğim taktirde tedavi/girişime onam vermek zorunda değilim</li>
            <li>İstediğim aşamada işlemi durdurabilirim</li>
          </ul>
        </CardContent>
      </Card>

      {/* Onam Beyanı */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Onam Beyanı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!consentAccepted ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <p className="text-amber-700 text-sm mb-3">
                Onam formunu kabul etmek için aşağıdaki butona tıklayınız.
              </p>
              <Button onClick={handleRequestConsent} className="bg-amber-600 hover:bg-amber-700">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Onam Formunu Oku ve Kabul Et
              </Button>
            </div>
          ) : (
            <div className="bg-green-50 p-4 rounded flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Onam Kabul Edildi</p>
                <p className="text-sm text-green-600">
                  Formun içeriğini okudum ve anladım. Kendi özgür irademle karar verdim.
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Notlar/Açıklamalar</Label>
            <Textarea 
              value={formData.notes} 
              onChange={(e) => setFormData({...formData, notes: e.target.value})} 
              placeholder="Varsa ek notlar..." 
              rows={3} 
            />
          </div>
        </CardContent>
      </Card>

      {/* İmza Alanları */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hasta/Veli/Vasi</CardTitle>
          </CardHeader>
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
              <Label>Tarih</Label>
              <Input 
                type="date" 
                value={formData.date} 
                onChange={(e) => setFormData({...formData, date: e.target.value})} 
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
            ) : (
              <SignaturePad 
                label="İmza" 
                required 
                onSignature={(sig) => setFormData({...formData, patientSignature: sig})}
              />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Doktor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adı-Soyadı</Label>
              <Input 
                value={formData.doctorName} 
                onChange={(e) => setFormData({...formData, doctorName: e.target.value})} 
              />
            </div>
            <div className="pt-6">
              <SignaturePad 
                label="İmza" 
                required 
                value={doctorSignature}
                onSignature={setDoctorSignature}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Butonlar */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          ✕ Kapat
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          🖨 Yazdır
        </Button>
        <Button onClick={handleSave} disabled={saving || !consentAccepted}>
          {saving ? '⏳ Kaydediliyor...' : '✓ Kaydet'}
        </Button>
      </div>
    </div>
  );
};

export default GeneralConsentForm;
