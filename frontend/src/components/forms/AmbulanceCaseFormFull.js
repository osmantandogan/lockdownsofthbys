import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { casesAPI, vehiclesAPI, settingsAPI } from '../../api';
import { useParams } from 'react-router-dom';
import PDFExportButton from '../PDFExportButton';
import { exportAmbulanceCaseForm, downloadPDF } from '../../utils/pdfExport';
import { Check } from 'lucide-react';

/**
 * Otomatik İmza Bileşeni
 * Kullanıcının kayıtlı imzası varsa gösterir, yoksa SignaturePad gösterir
 */
const AutoSignature = ({ label, userSignature, userName, userRole, targetRoles, onSignature, currentSignature }) => {
  // Bu imza kutusu için uygun rol mü kontrol et
  const isTargetRole = targetRoles.some(role => userRole?.includes(role));
  
  // Otomatik imza gösterilmeli mi?
  const showAutoSignature = isTargetRole && userSignature;
  
  if (showAutoSignature) {
    return (
      <div className="space-y-2">
        <Label>{label} (Otomatik)</Label>
        <div className="border-2 border-green-500 rounded-lg p-2 bg-green-50">
          <img 
            src={userSignature} 
            alt="Kayıtlı İmza" 
            className="h-24 w-full object-contain"
          />
        </div>
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="h-3 w-3" />
          {userName} - Kayıtlı imza otomatik kullanılıyor
        </p>
      </div>
    );
  }
  
  // Manuel imza
  return (
    <div className="space-y-2">
      {currentSignature ? (
        <>
          <Label>{label}</Label>
          <div className="border-2 border-blue-500 rounded-lg p-2 bg-blue-50">
            <img 
              src={currentSignature} 
              alt="İmza" 
              className="h-24 w-full object-contain"
            />
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => onSignature(null)}
          >
            İmzayı Sil
          </Button>
        </>
      ) : (
        <SignaturePad label={label} onSignature={onSignature} />
      )}
    </div>
  );
};


const AmbulanceCaseFormFull = () => {
  const { user } = useAuth();
  const { caseId } = useParams(); // URL'den case ID çek
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Kullanıcının kayıtlı imzası
  const [userSignature, setUserSignature] = useState(null);
  
  // Personel imzaları
  const [staffSignatures, setStaffSignatures] = useState({
    receiver: null,      // Hastayı teslim alan
    doctorParamedic: null, // Doktor/Paramedik
    healthStaff: null,   // Sağlık personeli (ATT/Hemşire)
    driver: null         // Sürücü
  });
  
  // Hasta imzaları
  const [patientSignatures, setPatientSignatures] = useState({
    companion: null,     // Refakatçi bilgilendirme
    hospitalReject: null, // Hastane reddi
    patientReject: null  // Hasta reddi
  });
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    atnNo: '',
    healmedyProtocol: '',
    patientName: '',
    tcNo: '',
    gender: '',
    age: '',
    callTime: '',
    arrivalTime: '',
    departureTime: '',
    hospitalArrivalTime: '',
    phone: '',
    address: '',
    pickupLocation: '',
    transfer1: '',
    transfer2: '',
    complaint: '',
    consciousStatus: true,
    diagnosis: '',
    chronicDiseases: '',
    applications: '',
    isolation: [],
    emotionalState: '',
    pupils: '',
    skin: '',
    respiration: '',
    pulse: '',
    motorResponse: '',
    verbalResponse: '',
    eyeOpening: '',
    cprBy: '',
    cprStart: '',
    cprEnd: '',
    cprReason: '',
    companions: '',
    waitHours: '',
    waitMinutes: '',
    vehicleType: '',
    startKm: '',
    endKm: '',
    institution: '',
    protocol112: '',
    hospitalProtocol: '',
    referringInstitution: '',
    roundTrip: ''
  });

  // Kullanıcının kayıtlı imzasını yükle
  useEffect(() => {
    const loadUserSignature = async () => {
      try {
        // Kullanıcının profil bilgisini al (imza dahil)
        const response = await settingsAPI.getProfile();
        if (response.data?.signature) {
          setUserSignature(response.data.signature);
          
          // Kullanıcının rolüne göre otomatik imzayı ilgili alana yerleştir
          const role = user?.role;
          if (role === 'doktor' || role === 'paramedik') {
            setStaffSignatures(prev => ({ ...prev, doctorParamedic: response.data.signature }));
          } else if (role === 'att' || role === 'hemsire') {
            setStaffSignatures(prev => ({ ...prev, healthStaff: response.data.signature }));
          } else if (role === 'sofor') {
            setStaffSignatures(prev => ({ ...prev, driver: response.data.signature }));
          }
        }
      } catch (error) {
        console.log('Kullanıcı imzası yüklenemedi:', error);
      }
    };
    
    loadUserSignature();
  }, [user?.role]);
  
  // Otomatik vaka ve araç bilgisi yükleme
  useEffect(() => {
    const loadCaseData = async () => {
      if (!caseId) {
        setLoading(false);
        return;
      }

      try {
        // Vaka bilgisini çek
        const caseRes = await casesAPI.getById(caseId);
        const caseData = caseRes?.data;
        
        if (!caseData) {
          console.log('Vaka bilgisi bulunamadı');
          setLoading(false);
          return;
        }
        
        // Araç bilgisini çek
        let vehicle = null;
        if (caseData.assigned_team?.vehicle_id) {
          try {
            const vehicleRes = await vehiclesAPI.getById(caseData.assigned_team.vehicle_id);
            vehicle = vehicleRes?.data;
          } catch (err) {
            console.log('Araç bilgisi alınamadı:', err.message);
          }
        }
        
        // Form verilerini otomatik doldur
        setFormData(prev => ({
          ...prev,
          healmedyProtocol: caseData.case_number || '',
          patientName: `${caseData.patient?.name || ''} ${caseData.patient?.surname || ''}`.trim(),
          tcNo: caseData.patient?.tc_no || '',
          gender: caseData.patient?.gender || '',
          age: caseData.patient?.age?.toString() || '',
          phone: caseData.patient?.phone || caseData.caller?.phone || '',
          address: caseData.location?.address || '',
          pickupLocation: caseData.location?.pickup_location || caseData.location?.address || '',
          complaint: caseData.patient?.complaint || '',
          vehicleType: vehicle?.plate || '',
          startKm: vehicle?.km || '' // Aracın mevcut KM'si
        }));
        
        toast.success('Vaka bilgileri otomatik yüklendi');
      } catch (error) {
        console.error('Vaka bilgisi yüklenemedi:', error);
        toast.error('Vaka bilgisi yüklenemedi');
      } finally {
        setLoading(false);
      }
    };
    
    loadCaseData();
  }, [caseId]);

  // =============== KAYDET FONKSİYONU ===============
  const handleSave = async () => {
    setSaving(true);
    try {
      // Tüm form verilerini medical_form formatında hazırla
      const medicalFormData = {
        // Temel bilgiler
        date: formData.date,
        atnNo: formData.atnNo,
        healmedyProtocol: formData.healmedyProtocol,
        patientName: formData.patientName,
        tcNo: formData.tcNo,
        gender: formData.gender,
        age: formData.age,
        phone: formData.phone,
        address: formData.address,
        pickupLocation: formData.pickupLocation,
        complaint: formData.complaint,
        
        // Saatler
        callTime: formData.callTime,
        arrivalTime: formData.arrivalTime,
        departureTime: formData.departureTime,
        hospitalArrivalTime: formData.hospitalArrivalTime,
        
        // Transfer bilgileri
        transfer1: formData.transfer1,
        transfer2: formData.transfer2,
        
        // Klinik bilgiler
        consciousStatus: formData.consciousStatus,
        diagnosis: formData.diagnosis,
        chronicDiseases: formData.chronicDiseases,
        applications: formData.applications,
        isolation: formData.isolation,
        emotionalState: formData.emotionalState,
        pupils: formData.pupils,
        skin: formData.skin,
        respiration: formData.respiration,
        pulse: formData.pulse,
        
        // GKS (Glasgow Koma Skalası)
        gcs: {
          motorResponse: formData.motorResponse,
          verbalResponse: formData.verbalResponse,
          eyeOpening: formData.eyeOpening
        },
        
        // CPR bilgileri
        cpr: {
          by: formData.cprBy,
          start: formData.cprStart,
          end: formData.cprEnd,
          reason: formData.cprReason
        },
        
        // Refakatçi bilgileri
        companions: formData.companions,
        waitHours: formData.waitHours,
        waitMinutes: formData.waitMinutes,
        
        // Araç ve protokol bilgileri
        vehicleType: formData.vehicleType,
        startKm: formData.startKm,
        endKm: formData.endKm,
        institution: formData.institution,
        protocol112: formData.protocol112,
        hospitalProtocol: formData.hospitalProtocol,
        referringInstitution: formData.referringInstitution,
        roundTrip: formData.roundTrip,
        
        // Vital bulgular
        vitalSigns: vitalSigns,
        
        // Uygulanan işlemler
        procedures: procedures,
        
        // Transfer bilgileri (detaylı)
        transfers: transfers,
        
        // İmzalar
        staffSignatures: staffSignatures,
        patientSignatures: patientSignatures,
        
        // Meta bilgiler
        savedBy: user?.name || user?.username,
        savedRole: user?.role,
        savedAt: new Date().toISOString()
      };

      // Eğer caseId varsa, vakayı güncelle
      if (caseId) {
        await casesAPI.updateMedicalForm(caseId, medicalFormData);
        toast.success('Form vakaya kaydedildi!');
      } else {
        // caseId yoksa sadece form_submissions'a kaydet
        await handleFormSave('ambulance_case', formData, {
          validateFields: [],
          validateSignature: false,
          extraData: { vitalSigns, procedures }
        })();
        toast.success('Form kaydedildi!');
      }
    } catch (error) {
      console.error('Form kaydetme hatası:', error);
      toast.error(error.response?.data?.detail || 'Form kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const [vitalSigns, setVitalSigns] = useState([
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' }
  ]);

  const [procedures, setProcedures] = useState({});
  const [transfers, setTransfers] = useState({});

  const proceduresList = [
    'Maske ile hava yolu desteği',
    'Airway ile hava yolu desteği',
    'Entübasyon uygulaması',
    'Nazal Entübasyon uygulaması',
    'LMA uygulaması',
    'Combi tüp uygulaması',
    'Acil trakeotomi açılması',
    'Mekanik ventilasyon',
    'Nebulizatör ile ilaç uygulama',
    'Oksijen inhalasyon tedavisi 1 Saat',
    'Aspirasyon uygulaması',
    'Ventilatör ile takip (CPAP BİPAP dahil)',
    'Balon valf maske uygulaması',
    'CPR uygulaması',
    'Defibrilasyon',
    'Kardiyoversiyon',
    'Monitörizasyon',
    'İnfüzyon pompası',
    'Kanama kontrolü',
    'Çubuk atel uygulaması',
    'Vakum atel uygulaması',
    'Şişme atel uygulaması',
    'U atel uygulaması',
    'Traksiyon atel uygulaması',
    'Pelvis kemeri uygulaması',
    'Sekiz bandaj uygulaması',
    'Elastik bandaj (velpa)',
    'Femur(vücut) traksiyonu',
    'Eklem çıkığı kapalı redüksiyonu',
    'Servical collar uygulama',
    'Travma yeleği',
    'Sırt tahtası uygulaması',
    'Vakum sedye uygulaması'
  ];

  const transferList = [
    'Evde Muayene',
    'Yerinde Muayene',
    'Hastaneye Nakil',
    'Hastaneler Arası Nakil',
    'Tıbbi Tetkik İçin Nakil',
    'Eve Nakil',
    'Şehirler Arası Nakil',
    'Uluslar Arası Nakil',
    'İlçe Dışı Transport',
    'İlçe İçi Transfer',
    'EX (Yerinde Bırakıldı)',
    'Başka Araçla Nakil',
    'Sağlık Tedbir',
    'Diğer'
  ];

  const gksPuani = (parseInt(formData.motorResponse) || 0) + 
                    (parseInt(formData.verbalResponse) || 0) + 
                    (parseInt(formData.eyeOpening) || 0);

  const isConscious = formData.consciousStatus;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">AMBULANS VAKA FORMU</h1>
        {caseId && (
          <p className="text-sm text-green-600">✓ Vaka bilgileri otomatik yüklendi</p>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>📋 Temel Bilgiler</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Tarih</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
            <div className="space-y-2"><Label>ATN No</Label><Input value={formData.atnNo} onChange={(e) => setFormData({...formData, atnNo: e.target.value})} /></div>
            <div className="space-y-2"><Label>HealMedy Protokol</Label><Input value={formData.healmedyProtocol} onChange={(e) => setFormData({...formData, healmedyProtocol: e.target.value})} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Adı Soyadı</Label><Input value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} /></div>
            <div className="space-y-2"><Label>T.C. Kimlik No</Label><Input value={formData.tcNo} onChange={(e) => setFormData({...formData, tcNo: e.target.value})} maxLength={11} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Cinsiyeti</Label>
              <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="erkek">Erkek</SelectItem>
                  <SelectItem value="kadin">Kadın</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Yaşı</Label><Input type="number" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} /></div>
            <div className="space-y-2"><Label>Telefon Numarası</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Vaka Çağrı Saati</Label><Input type="time" value={formData.callTime} onChange={(e) => setFormData({...formData, callTime: e.target.value})} /></div>
            <div className="space-y-2"><Label>Vaka Varış Saati</Label><Input type="time" value={formData.arrivalTime} onChange={(e) => setFormData({...formData, arrivalTime: e.target.value})} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Vakadan Ayrılış Saati</Label><Input type="time" value={formData.departureTime} onChange={(e) => setFormData({...formData, departureTime: e.target.value})} /></div>
            <div className="space-y-2"><Label>Hastaneye Varış Saati</Label><Input type="time" value={formData.hospitalArrivalTime} onChange={(e) => setFormData({...formData, hospitalArrivalTime: e.target.value})} /></div>
          </div>
          <div className="space-y-2"><Label>Adres</Label><Textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} rows={2} /></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Hastanın Alındığı Yer</Label><Input value={formData.pickupLocation} onChange={(e) => setFormData({...formData, pickupLocation: e.target.value})} /></div>
            <div className="space-y-2"><Label>Nakledildiği 1. Yer</Label><Input value={formData.transfer1} onChange={(e) => setFormData({...formData, transfer1: e.target.value})} /></div>
            <div className="space-y-2"><Label>Nakledildiği 2. Yer</Label><Input value={formData.transfer2} onChange={(e) => setFormData({...formData, transfer2: e.target.value})} /></div>
          </div>
          <div className="space-y-2"><Label>Hastanın Şikayeti</Label><Textarea value={formData.complaint} onChange={(e) => setFormData({...formData, complaint: e.target.value})} rows={3} /></div>
          <div className="flex items-center space-x-3 bg-yellow-50 p-3 rounded">
            <Switch id="conscious" checked={isConscious} onCheckedChange={(v) => setFormData({...formData, consciousStatus: v})} />
            <Label htmlFor="conscious" className="cursor-pointer">Hasta Bilinci Durumu: <strong>{isConscious ? 'Bilinci Açık' : 'Bilinci Kapalı'}</strong></Label>
          </div>
          {!isConscious && (
            <div className="bg-blue-50 p-3 rounded text-xs">
              <p>ℹ️ Hasta bilinci kapalıysa, sadece kritik vital bulgular ve acil müdahale bilgileri görüntülenecektir.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>🏥 Tıbbi Bilgiler</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Ön Tanı</Label><Input value={formData.diagnosis} onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} /></div>
            <div className="space-y-2"><Label>Kronik Hastalıklar</Label><Input value={formData.chronicDiseases} onChange={(e) => setFormData({...formData, chronicDiseases: e.target.value})} /></div>
          </div>
          <div className="space-y-2"><Label>Açıklama, Hastaya Yapılan Uygulama, Kullanılan İlaçlar</Label><Textarea value={formData.applications} onChange={(e) => setFormData({...formData, applications: e.target.value})} rows={4} /></div>
          <div className="space-y-2">
            <Label>İzolasyon Durumu</Label>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2">
                <Checkbox id="iso-solunum" checked={formData.isolation.includes('solunum')} onCheckedChange={(checked) => {
                  const newIso = checked ? [...formData.isolation, 'solunum'] : formData.isolation.filter(i => i !== 'solunum');
                  setFormData({...formData, isolation: newIso});
                }} />
                <Label htmlFor="iso-solunum" className="font-normal cursor-pointer">Solunum İzolasyonu</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="iso-damlacik" checked={formData.isolation.includes('damlacik')} onCheckedChange={(checked) => {
                  const newIso = checked ? [...formData.isolation, 'damlacik'] : formData.isolation.filter(i => i !== 'damlacik');
                  setFormData({...formData, isolation: newIso});
                }} />
                <Label htmlFor="iso-damlacik" className="font-normal cursor-pointer">Damlacık İzolasyonu</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="iso-temas" checked={formData.isolation.includes('temas')} onCheckedChange={(checked) => {
                  const newIso = checked ? [...formData.isolation, 'temas'] : formData.isolation.filter(i => i !== 'temas');
                  setFormData({...formData, isolation: newIso});
                }} />
                <Label htmlFor="iso-temas" className="font-normal cursor-pointer">Temas İzolasyonu</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isConscious && (
        <Card>
          <CardHeader><CardTitle>📊 Vital Ölçümler</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {vitalSigns.map((vital, index) => (
              <Card key={index} className="bg-gray-50">
                <CardHeader><CardTitle className="text-sm">{index + 1}. ÖLÇÜM</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-6">
                  <div className="space-y-1"><Label className="text-xs">Ölçüm Saati</Label><Input type="time" className="h-9" value={vital.time} onChange={(e) => {
                    const newVitals = [...vitalSigns];
                    newVitals[index].time = e.target.value;
                    setVitalSigns(newVitals);
                  }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{index + 1}. Tansiyon</Label><Input placeholder="120/80" className="h-9" value={vital.bp} onChange={(e) => {
                    const newVitals = [...vitalSigns];
                    newVitals[index].bp = e.target.value;
                    setVitalSigns(newVitals);
                  }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{index + 1}. Nabız</Label><Input placeholder="72" className="h-9" value={vital.pulse} onChange={(e) => {
                    const newVitals = [...vitalSigns];
                    newVitals[index].pulse = e.target.value;
                    setVitalSigns(newVitals);
                  }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{index + 1}. SPO2</Label><Input placeholder="98" className="h-9" value={vital.spo2} onChange={(e) => {
                    const newVitals = [...vitalSigns];
                    newVitals[index].spo2 = e.target.value;
                    setVitalSigns(newVitals);
                  }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{index + 1}. Solunum/DK</Label><Input placeholder="16" className="h-9" value={vital.respiration} onChange={(e) => {
                    const newVitals = [...vitalSigns];
                    newVitals[index].respiration = e.target.value;
                    setVitalSigns(newVitals);
                  }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{index + 1}. Ateş</Label><Input placeholder="36.5" className="h-9" value={vital.temp} onChange={(e) => {
                    const newVitals = [...vitalSigns];
                    newVitals[index].temp = e.target.value;
                    setVitalSigns(newVitals);
                  }} /></div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {isConscious && (
        <Card>
          <CardHeader><CardTitle>👁️ Klinik Gözlemler</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Emosyonel Durum</Label>
                <RadioGroup value={formData.emotionalState} onValueChange={(v) => setFormData({...formData, emotionalState: v})}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Normal', 'Üzüntülü', 'Huzursuz', 'Kayıtsız', 'Diğer'].map(opt => (
                      <div key={opt} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.toLowerCase()} id={`emo-${opt}`} />
                        <Label htmlFor={`emo-${opt}`} className="font-normal text-xs">{opt}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Pupiller</Label>
                <RadioGroup value={formData.pupils} onValueChange={(v) => setFormData({...formData, pupils: v})}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Normal', 'Miyotik', 'Midriatik', 'Anizokorik', 'Reaksiyon Yok', 'Fix Dilate'].map(opt => (
                      <div key={opt} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.toLowerCase()} id={`pup-${opt}`} />
                        <Label htmlFor={`pup-${opt}`} className="font-normal text-xs">{opt}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Deri</Label>
                <RadioGroup value={formData.skin} onValueChange={(v) => setFormData({...formData, skin: v})}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Normal', 'Soluk', 'Siyatonik', 'Hiperemik', 'İkterik', 'Terli'].map(opt => (
                      <div key={opt} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.toLowerCase()} id={`skin-${opt}`} />
                        <Label htmlFor={`skin-${opt}`} className="font-normal text-xs">{opt}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Solunum</Label>
                <RadioGroup value={formData.respiration} onValueChange={(v) => setFormData({...formData, respiration: v})}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Rahat', 'Derin', 'Yüzeysel', 'Düzensiz', 'Dispneik', 'Yok'].map(opt => (
                      <div key={opt} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.toLowerCase()} id={`resp-${opt}`} />
                        <Label htmlFor={`resp-${opt}`} className="font-normal text-xs">{opt}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nabız</Label>
              <RadioGroup value={formData.pulse} onValueChange={(v) => setFormData({...formData, pulse: v})}>
                <div className="flex space-x-6">
                  {['Düzenli', 'Aritmik', 'Filiform', 'Alınmıyor'].map(opt => (
                    <div key={opt} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt.toLowerCase()} id={`pulse-${opt}`} />
                      <Label htmlFor={`pulse-${opt}`} className="font-normal text-xs">{opt}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2"><Label>Motor Yanıt (A)</Label><Input type="number" value={formData.motorResponse} onChange={(e) => setFormData({...formData, motorResponse: e.target.value})} placeholder="1-6" min="1" max="6" /></div>
              <div className="space-y-2"><Label>Sözlü Yanıt (B)</Label><Input type="number" value={formData.verbalResponse} onChange={(e) => setFormData({...formData, verbalResponse: e.target.value})} placeholder="1-5" min="1" max="5" /></div>
              <div className="space-y-2"><Label>Göz Açma (C)</Label><Input type="number" value={formData.eyeOpening} onChange={(e) => setFormData({...formData, eyeOpening: e.target.value})} placeholder="1-4" min="1" max="4" /></div>
              <div className="space-y-2">
                <Label>GKS Puanı</Label>
                <div className="h-9 flex items-center justify-center bg-blue-100 rounded font-bold text-blue-800">
                  {gksPuani || 0}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2"><Label>CPR Yapan</Label><Input value={formData.cprBy} onChange={(e) => setFormData({...formData, cprBy: e.target.value})} /></div>
              <div className="space-y-2"><Label>Başlama Zamanı</Label><Input type="time" value={formData.cprStart} onChange={(e) => setFormData({...formData, cprStart: e.target.value})} /></div>
              <div className="space-y-2"><Label>Bırakma Zamanı</Label><Input type="time" value={formData.cprEnd} onChange={(e) => setFormData({...formData, cprEnd: e.target.value})} /></div>
              <div className="space-y-2"><Label>Bırakma Nedeni</Label><Input value={formData.cprReason} onChange={(e) => setFormData({...formData, cprReason: e.target.value})} /></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>💉 Yapılan Uygulamalar ve İşlemler</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {proceduresList.map((proc, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox id={`proc-${index}`} checked={procedures[proc] || false} onCheckedChange={(checked) => setProcedures({...procedures, [proc]: checked})} />
                <Label htmlFor={`proc-${index}`} className="text-xs font-normal cursor-pointer">{proc}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>🚁 Transfer Durumu</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {transferList.map((transfer, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox id={`trans-${index}`} checked={transfers[transfer] || false} onCheckedChange={(checked) => setTransfers({...transfers, [transfer]: checked})} />
                <Label htmlFor={`trans-${index}`} className="text-xs font-normal cursor-pointer">{transfer}</Label>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Refakatçı Sayısı</Label><Input type="number" value={formData.companions} onChange={(e) => setFormData({...formData, companions: e.target.value})} /></div>
            <div className="space-y-2"><Label>Ambulans Bekleme (Saat)</Label><Input type="number" value={formData.waitHours} onChange={(e) => setFormData({...formData, waitHours: e.target.value})} /></div>
            <div className="space-y-2"><Label>Ambulans Bekleme (Dakika)</Label><Input type="number" value={formData.waitMinutes} onChange={(e) => setFormData({...formData, waitMinutes: e.target.value})} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📝 Hasta Bilgilendirme ve Onay Formları</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Hasta Bilgilendirme Onayı</h3>
            <p className="text-xs text-justify bg-gray-50 p-3 rounded">
              Hastamın nakli sırasında ambulansta bulunmamın ambulans ekibinin görevini zorlaştırdığı gibi personel ve ambulans sürüş güvenliği açısından olumsuz sonuçlar doğurabileceği, meydana gelebilecek bir kazadan ve buna bağlı olarak ortaya çıkabilecek hukuki sorunlardan etkilenebileceğim, ambulansta bulunduğum sürece emniyet kemerimi takmam gerektiği konusunda ambulans personeli tarafından ayrıntılı olarak bilgilendirildim.
            </p>
            <div className="space-y-2"><Label>Hasta/Hasta Yakını Adı Soyadı</Label><Input placeholder="Ad Soyad" /></div>
            <SignaturePad label="İmza" />
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Hastanenin Hasta Reddi</h3>
            <div className="space-y-2"><Label>Red Nedeni</Label><Textarea rows={2} /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Kurumun/Hastanenin Adı</Label><Input /></div>
              <div className="space-y-2"><Label>Hekimin Adı Soyadı</Label><Input /></div>
            </div>
            <SignaturePad label="Hekim İmzası" />
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Hastanın Hizmet Reddi</h3>
            <p className="text-xs text-justify bg-red-50 p-3 rounded">
              Ambulansla gelen görevli bana hastanın hemen tedavisi / hastaneye nakli gerektiğini, aksi halde kötü sonuçlar doğurabileceğini anlayacağım şekilde ayrıntılı olarak anlattı. Buna rağmen tedaviyi /hasta naklini kabul etmiyorum.
            </p>
            <div className="space-y-2"><Label>Hastanın/Yakınının Adı Soyadı</Label><Input placeholder="Ad Soyad" /></div>
            <SignaturePad label="İmza" />
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Personel İmza Bölümü</h3>
            {userSignature && (
              <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                ℹ️ Kayıtlı imzanız otomatik olarak ilgili alana yerleştirildi.
              </p>
            )}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-2"><Label>Hastayı Teslim Alanın Ünvanı Adı Soyadı</Label><Input /></div>
                <AutoSignature 
                  label="İmza"
                  userSignature={userSignature}
                  userName={user?.name}
                  userRole={user?.role}
                  targetRoles={[]} // Teslim alan hastane personeli - otomatik imza yok
                  currentSignature={staffSignatures.receiver}
                  onSignature={(sig) => setStaffSignatures(prev => ({ ...prev, receiver: sig }))}
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Doktor/Paramedik Adı Soyadı</Label>
                  <Input 
                    value={(user?.role === 'doktor' || user?.role === 'paramedik') ? user?.name : ''}
                    readOnly={(user?.role === 'doktor' || user?.role === 'paramedik')}
                    className={(user?.role === 'doktor' || user?.role === 'paramedik') ? 'bg-green-50' : ''}
                  />
                </div>
                <AutoSignature 
                  label="İmza"
                  userSignature={userSignature}
                  userName={user?.name}
                  userRole={user?.role}
                  targetRoles={['doktor', 'paramedik']}
                  currentSignature={staffSignatures.doctorParamedic}
                  onSignature={(sig) => setStaffSignatures(prev => ({ ...prev, doctorParamedic: sig }))}
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Sağlık Personeli (ATT/Hemşire) Adı Soyadı</Label>
                  <Input 
                    value={(user?.role === 'att' || user?.role === 'hemsire') ? user?.name : ''}
                    readOnly={(user?.role === 'att' || user?.role === 'hemsire')}
                    className={(user?.role === 'att' || user?.role === 'hemsire') ? 'bg-green-50' : ''}
                  />
                </div>
                <AutoSignature 
                  label="İmza"
                  userSignature={userSignature}
                  userName={user?.name}
                  userRole={user?.role}
                  targetRoles={['att', 'hemsire']}
                  currentSignature={staffSignatures.healthStaff}
                  onSignature={(sig) => setStaffSignatures(prev => ({ ...prev, healthStaff: sig }))}
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Sürücü/Pilot Adı Soyadı</Label>
                  <Input 
                    value={user?.role === 'sofor' ? user?.name : ''}
                    readOnly={user?.role === 'sofor'}
                    className={user?.role === 'sofor' ? 'bg-green-50' : ''}
                  />
                </div>
                <AutoSignature 
                  label="İmza"
                  userSignature={userSignature}
                  userName={user?.name}
                  userRole={user?.role}
                  targetRoles={['sofor']}
                  currentSignature={staffSignatures.driver}
                  onSignature={(sig) => setStaffSignatures(prev => ({ ...prev, driver: sig }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>🚑 Taşıt ve Protokol Bilgileri</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Taşıt Bilgisi</Label>
              <Select value={formData.vehicleType} onValueChange={(v) => setFormData({...formData, vehicleType: v})}>
                <SelectTrigger><SelectValue placeholder="Lütfen Araç Seçiniz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambulans1">Ambulans 1</SelectItem>
                  <SelectItem value="ambulans2">Ambulans 2</SelectItem>
                  <SelectItem value="helikopter">Helikopter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Başlangıç KM Bilgisi</Label><Input type="number" value={formData.startKm} onChange={(e) => setFormData({...formData, startKm: e.target.value})} /></div>
            <div className="space-y-2"><Label>Bitiş KM Bilgisi</Label><Input type="number" value={formData.endKm} onChange={(e) => setFormData({...formData, endKm: e.target.value})} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Kurum Adı</Label><Input value={formData.institution} onChange={(e) => setFormData({...formData, institution: e.target.value})} /></div>
            <div className="space-y-2"><Label>112 Protokol Numarası</Label><Input value={formData.protocol112} onChange={(e) => setFormData({...formData, protocol112: e.target.value})} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Hastane Protokol/Dosya No</Label><Input value={formData.hospitalProtocol} onChange={(e) => setFormData({...formData, hospitalProtocol: e.target.value})} /></div>
            <div className="space-y-2"><Label>Vakayı Veren Kurum Bilgisi</Label><Input value={formData.referringInstitution} onChange={(e) => setFormData({...formData, referringInstitution: e.target.value})} /></div>
          </div>
          <div className="space-y-2">
            <Label>Gidiş-Dönüş</Label>
            <RadioGroup value={formData.roundTrip} onValueChange={(v) => setFormData({...formData, roundTrip: v})}>
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="evet" id="rt-yes" />
                  <Label htmlFor="rt-yes" className="font-normal">Evet</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hayir" id="rt-no" />
                  <Label htmlFor="rt-no" className="font-normal">Hayır</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={() => {
          setFormData({
            date: new Date().toISOString().split('T')[0],
            atnNo: '', healmedyProtocol: '', patientName: '', tcNo: '', gender: '', age: '',
            callTime: '', arrivalTime: '', departureTime: '', hospitalArrivalTime: '',
            phone: '', address: '', pickupLocation: '', transfer1: '', transfer2: '',
            complaint: '', consciousStatus: true, diagnosis: '', chronicDiseases: '',
            applications: '', isolation: [], emotionalState: '', pupils: '', skin: '',
            respiration: '', pulse: '', motorResponse: '', verbalResponse: '', eyeOpening: '',
            cprBy: '', cprStart: '', cprEnd: '', cprReason: '', companions: '',
            waitHours: '', waitMinutes: '', vehicleType: '', startKm: '', endKm: '',
            institution: '', protocol112: '', hospitalProtocol: '', referringInstitution: '', roundTrip: ''
          });
          setVitalSigns([
            { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
            { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
            { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' }
          ]);
          setProcedures({});
          toast.success('Form temizlendi');
        }}>🗑 Temizle</Button>
        <PDFExportButton 
          formType="ambulance_case"
          formData={{
            ...formData,
            staffSignatures,
            patientSignatures
          }}
          extraData={{ vitalSigns, procedures }}
          filename={`ambulans_vaka_${formData.healmedyProtocol || formData.patientName || 'form'}`}
          variant="outline"
        >
          📄 PDF İndir
        </PDFExportButton>
        <Button variant="outline" onClick={() => {
          const doc = exportAmbulanceCaseForm({
            ...formData,
            staffSignatures,
            patientSignatures
          }, vitalSigns, procedures);
          const blob = doc.output('blob');
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }}>🔍 PDF Önizleme</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "💾 Kaydet"}</Button>
      </div>
    </div>
  );
};

export default AmbulanceCaseFormFull;
