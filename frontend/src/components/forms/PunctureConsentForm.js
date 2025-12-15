import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import SignaturePad from '../SignaturePad';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, FileText, Droplet } from 'lucide-react';
import { casesAPI } from '../../api';

const PunctureConsentForm = ({ 
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
  const [witnessSignature, setWitnessSignature] = useState(null);

  const [formData, setFormData] = useState({
    consciousnessStatus: 'conscious',
    patientName: initialData.patientName || defaultPatientName || '',
    patientTc: initialData.patientTc || '',
    patientAddress: initialData.patientAddress || '',
    patientPhone: initialData.patientPhone || '',
    legalRepName: initialData.legalRepName || '',
    legalRepAddress: initialData.legalRepAddress || '',
    legalRepPhone: initialData.legalRepPhone || '',
    doctorName: initialData.doctorName || '',
    witnessName: initialData.witnessName || '',
    injectionType: initialData.injectionType || '',
    date: initialData.date || new Date().toISOString().split('T')[0],
    time: initialData.time || new Date().toTimeString().slice(0,5)
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
  }, [patientInfo]);

  const isConscious = formData.consciousnessStatus === 'conscious';

  // Onay dialog'unu göster
  const handleRequestConsent = () => {
    if (!formData.patientName && !formData.legalRepName) {
      toast.error('Hasta veya veli adı gereklidir');
      return;
    }
    setShowConsentDialog(true);
  };

  // Onay kabul edildiğinde
  const handleAcceptConsent = () => {
    setConsentAccepted(true);
    setShowConsentDialog(false);
    toast.success('Ponksiyon onamı kabul edildi');
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
        formType: 'puncture',
        patientSignature: patientSignature,
        doctorSignature: doctorSignature,
        witnessSignature: witnessSignature,
        caseId: caseId,
        savedAt: new Date().toISOString(),
        consentAcceptedAt: new Date().toISOString()
      };

      if (caseId) {
        await casesAPI.updateMedicalForm(caseId, {
          consent_forms: {
            puncture: saveData
          }
        });
      }

      toast.success('Ponksiyon onam formu kaydedildi');
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
            <DialogTitle className="flex items-center gap-2 text-purple-600">
              <Droplet className="h-5 w-5" />
              Ponksiyon Onam Onayı
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="font-semibold text-purple-800 mb-2">
                  Sayın {formData.patientName || formData.legalRepName || 'Hasta'},
                </p>
                <p className="text-purple-700 text-sm">
                  Size uygulanacak ponksiyon/enjeksiyon işlemi hakkında bilgilendirildiniz.
                </p>
              </div>
              
              <div className="text-sm space-y-2 bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">İşlem hakkında bilgilendirildiniz:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>İşlemin amacı ve yöntemi</li>
                  <li>Olası riskler: ağrı, kanama, enfeksiyon, sinir hasarı</li>
                  <li>Alternatif tedavi seçenekleri</li>
                  <li>İşlem sonrası dikkat edilmesi gerekenler</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="text-red-700">
                  <strong>Uyarı:</strong> Bilinen ilaç alerjiniz veya kanama bozukluğunuz varsa 
                  mutlaka doktorunuza bildiriniz!
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConsentDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleAcceptConsent} className="bg-purple-600 hover:bg-purple-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Okudum ve Kabul Ediyorum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Başlık */}
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-xl font-bold">İNTRAARTİKÜLER, KAS İÇİ, KAS ÇEVRESİ</h1>
        <h1 className="text-xl font-bold">ENJEKSİYON ve PONKSİYON BİLGİLENDİRİLMİŞ ONAM FORMU</h1>
        {consentAccepted && (
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
            <CheckCircle className="h-4 w-4" />
            Onam Kabul Edildi
          </div>
        )}
      </div>

      <p className="text-sm font-medium">Sayın Hasta, Sayın Veli/Vasi</p>

      <Card>
        <CardHeader><CardTitle className="text-base">Yöntem</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-2">
          <p className="text-justify">Sistemik romatizmal hastalıklar, lokal ve/veya genel travmalar, metabolik hastalıklar, beyinomurilik yaralanmaları, iltihabi hastalıklar, psikolojik rahatsızlıklar, herhangi bir ameliyat ve tıbbi girişimin istenmeyen etkisi gibi olaylara bağlı olarak kaslar, kemikler, sinirler, eklem ve çevresindeki yapıların fonksiyon ve yapılarında bozulma olabilir.</p>
          <p className="font-semibold mt-2">Enjeksiyon Tedavisi:</p>
          <p className="text-justify">Yukarıda belirtilen durumların tanısını desteklemek veya tedavi etmek için kas, eklem içi ve çevresel ile diğer yumuşak dokulara lokal anestezik, steroid(kortizon), botulinum toksin, fenol, alkol, hyalüronik asit gibi maddelerin uygulanmasıdır.</p>
          <p className="font-semibold mt-2">Ponksiyon/Aspirasyon:</p>
          <p className="text-justify">Eklem içi veya başka dokular arasındaki sıvının (eklem sıvısı, kan, iltihap vb.) bir iğne yardımı ile boşaltılmasıdır.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">İşlemin Avantajları</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Hem tanı hemde tedaviye yardımcı olması</li>
            <li>Aynı seansta analiz için sıvı almanın mümkün olması</li>
            <li>Eklem içi iltihabi süreci durdurması</li>
            <li>Ağrı ve hareket kısıtlılığı gibi şikayetlerin hafifletmesi</li>
            <li>Gereksiz sistemik tedaviden kaçınılması</li>
            <li>Yan etki riskinin çok az olması</li>
            <li>Ucuz olması</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">İşlemin Riskleri</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-2">
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
        </CardContent>
      </Card>

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
                className={patientInfo?.name ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>TC Kimlik No</Label>
              <Input 
                value={formData.patientTc} 
                onChange={(e) => setFormData({...formData, patientTc: e.target.value})}
                maxLength={11}
                className={patientInfo?.tc_no ? 'bg-green-50 border-green-300' : ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Yapılacak İşlem</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Size yapılacak işlem:</Label>
            <Input value={formData.injectionType} onChange={(e) => setFormData({...formData, injectionType: e.target.value})} placeholder="İlaç/işlem adı" />
          </div>
        </CardContent>
      </Card>

      {/* Onam Beyanı */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Onam Beyanı</CardTitle></CardHeader>
        <CardContent>
          {!consentAccepted ? (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <p className="text-purple-700 text-sm mb-3">
                Ponksiyon onamını kabul etmek için aşağıdaki butona tıklayınız.
              </p>
              <Button onClick={handleRequestConsent} className="bg-purple-600 hover:bg-purple-700">
                <Droplet className="h-4 w-4 mr-2" />
                Onamı Oku ve Kabul Et
              </Button>
            </div>
          ) : (
            <div className="bg-green-50 p-4 rounded flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Onam Kabul Edildi</p>
                <p className="text-sm text-green-600">
                  Formun içeriğini okudum ve anladım. Kendi özgür irademle karar veriyorum.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Hasta Bilinç Durumu</CardTitle></CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* İmza Alanları */}
      {isConscious ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Hastanın</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Adı-Soyadı</Label>
                <Input value={formData.patientName} readOnly className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>Adresi</Label>
                <Input value={formData.patientAddress} onChange={(e) => setFormData({...formData, patientAddress: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Tel. No</Label>
                <Input value={formData.patientPhone} onChange={(e) => setFormData({...formData, patientPhone: e.target.value})} />
              </div>
              {patientSignature ? (
                <div className="space-y-2">
                  <Label>İmza (Otomatik Alındı)</Label>
                  <div className="border-2 border-green-500 bg-green-50 rounded-lg p-2">
                    <img src={patientSignature} alt="Hasta İmzası" className="w-full h-20 object-contain" />
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
              <div className="pt-8">
                <SignaturePad label="İmza" onSignature={setDoctorSignature} value={doctorSignature} required />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Şahit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Adı-Soyadı</Label>
                <Input value={formData.witnessName} onChange={(e) => setFormData({...formData, witnessName: e.target.value})} />
              </div>
              <div className="pt-8">
                <SignaturePad label="İmza" onSignature={setWitnessSignature} value={witnessSignature} />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Yasal Temsilci (Vasi/Veli)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Adı-Soyadı</Label>
                <Input value={formData.legalRepName} onChange={(e) => setFormData({...formData, legalRepName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Adresi</Label>
                <Input value={formData.legalRepAddress} onChange={(e) => setFormData({...formData, legalRepAddress: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Tel. No</Label>
                <Input value={formData.legalRepPhone} onChange={(e) => setFormData({...formData, legalRepPhone: e.target.value})} />
              </div>
              {patientSignature ? (
                <div className="space-y-2">
                  <Label>İmza (Otomatik Alındı)</Label>
                  <div className="border-2 border-green-500 bg-green-50 rounded-lg p-2">
                    <img src={patientSignature} alt="Veli İmzası" className="w-full h-20 object-contain" />
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
              <div className="pt-8">
                <SignaturePad label="İmza" onSignature={setDoctorSignature} value={doctorSignature} required />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Şahit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Adı-Soyadı</Label>
                <Input value={formData.witnessName} onChange={(e) => setFormData({...formData, witnessName: e.target.value})} />
              </div>
              <div className="pt-8">
                <SignaturePad label="İmza" onSignature={setWitnessSignature} value={witnessSignature} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Butonlar */}
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

export default PunctureConsentForm;
