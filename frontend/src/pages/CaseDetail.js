import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { casesAPI, vehiclesAPI, usersAPI, referenceAPI, videoCallAPI, medicationsAPI, stockAPI, stockBarcodeAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { toast } from 'sonner';
import { 
  ArrowLeft, User, Phone, MapPin, Truck, Clock, Video, Users, 
  Check, X, Search, Building2, Stethoscope, Activity, FileText,
  Heart, Thermometer, Droplet, Brain, AlertCircle, Eye, Syringe,
  Ambulance, ClipboardList, VideoOff, FileSignature, Shield, Scissors, Save,
  Package, QrCode, Trash2, Plus, Pill, Camera, FileDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import VideoCall from '../components/VideoCall';
import { ScrollArea } from '../components/ui/scroll-area';
import { generateCaseFormPDF, downloadPDF, openPDFInNewTab } from '../services/pdfService';
import { downloadCaseExcel } from '../services/excelExport';
import CaseAccessRestriction from '../components/CaseAccessRestriction';
import { saveAs } from 'file-saver';
import BarcodeScanner from '../components/BarcodeScanner';
import SignaturePad from '../components/SignaturePad';

// Onam Form Bileşenleri
import KVKKConsentForm from '../components/forms/KVKKConsentForm';
import InjectionConsentForm from '../components/forms/InjectionConsentForm';
import PunctureConsentForm from '../components/forms/PunctureConsentForm';
import MinorSurgeryConsentForm from '../components/forms/MinorSurgeryConsentForm';
import GeneralConsentForm from '../components/forms/GeneralConsentForm';

// Jitsi server URL - kendi sunucunuzu kullanmak için değiştirin
const JITSI_DOMAIN = process.env.REACT_APP_JITSI_DOMAIN || 'meet.jit.si';

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('form');
  
  // Real-time collaboration
  const [participants, setParticipants] = useState([]);
  const [medicalForm, setMedicalForm] = useState({});
  
  // Patient info editing
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    surname: '',
    tc_no: '',
    age: '',
    birth_date: '',
    gender: ''
  });
  const [patientInfoChanged, setPatientInfoChanged] = useState(false);
  const [savingPatientInfo, setSavingPatientInfo] = useState(false);
  const [icdSearch, setIcdSearch] = useState('');
  const [icdResults, setIcdResults] = useState([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalResults, setHospitalResults] = useState([]);
  const [hospitalsGrouped, setHospitalsGrouped] = useState(null);
  const [doctorApproval, setDoctorApproval] = useState(null);
  
  // Consent Forms
  const [selectedConsentForm, setSelectedConsentForm] = useState(null);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  
  // Inline Consent/Signature Forms (Nakil İmzaları)
  const [inlineConsents, setInlineConsents] = useState({
    // HASTA BİLGİLENDİRME ONAYI
    patient_info_consent_name: '',
    patient_info_consent_signature: null,
    // HASTANENİN HASTA REDDİ
    hospital_rejection_reason: '',
    hospital_rejection_institution: '',
    hospital_rejection_doctor_name: '',
    hospital_rejection_doctor_signature: null,
    // HASTANIN HİZMET REDDİ
    patient_rejection_name: '',
    patient_rejection_signature: null,
    // HASTAYI TESLİM ALAN
    receiver_title_name: '',
    receiver_signature: null,
    // DOKTOR/PARAMEDİK
    doctor_paramedic_name: '',
    doctor_paramedic_signature: null,
    // SAĞLIK PERSONELİ
    health_personnel_name: '',
    health_personnel_signature: null,
    // SÜRÜCÜ/PİLOT
    driver_pilot_name: '',
    driver_pilot_signature: null
  });
  const [savingConsents, setSavingConsents] = useState(false);
  
  // Medication/Materials state
  const [medications, setMedications] = useState([]);
  const [vehicleStock, setVehicleStock] = useState([]);
  const [stockSearch, setStockSearch] = useState('');
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [showNewStockDialog, setShowNewStockDialog] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [addingMedication, setAddingMedication] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  
  // YENİ: Çoklu stok kaynağı desteği (Araç + Carter)
  const [allStockData, setAllStockData] = useState({ vehicle: [], carter: null, carter_name: '' });
  const [selectedStockSource, setSelectedStockSource] = useState('vehicle'); // 'vehicle' veya 'carter'
  const [loadingAllStock, setLoadingAllStock] = useState(false);
  
  // Onam formları listesi
  const consentFormsList = [
    {
      id: 'kvkk',
      title: 'KVKK - Kişisel Verilerin Korunması Onam Formu',
      icon: Shield,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Kişisel verilerin korunması hakkında bilgilendirme ve onam formu'
    },
    {
      id: 'injection',
      title: 'Enjeksiyon Uygulama Onam Formu',
      icon: Syringe,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'İlaç ve enjeksiyon uygulaması için hasta/veli onamı'
    },
    {
      id: 'puncture',
      title: 'Ponksiyon/İğne Uygulaması Onam Formu',
      icon: Syringe,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'Ponksiyon, kan alma ve damar yolu açma işlemleri onamı'
    },
    {
      id: 'minor-surgery',
      title: 'Minör Cerrahi İşlem Onam Formu',
      icon: Scissors,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      description: 'Küçük cerrahi müdahaleler için rıza formu'
    },
    {
      id: 'general-consent',
      title: 'Genel Tıbbi Müdahale Onam Formu',
      icon: FileSignature,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Genel tıbbi işlemler için hasta rıza formu'
    }
  ];
  
  // Vital Signs - 3 sets
  const [vitalSigns, setVitalSigns] = useState([
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' },
    { time: '', bp: '', pulse: '', spo2: '', respiration: '', temp: '' }
  ]);
  
  // Clinical observations
  const [clinicalObs, setClinicalObs] = useState({
    emotionalState: '',
    pupils: '',
    skin: '',
    respirationType: '',
    pulseType: '',
    motorResponse: '',
    verbalResponse: '',
    eyeOpening: '',
    consciousStatus: true
  });
  
  // Excel Form için ek alanlar
  const [extendedForm, setExtendedForm] = useState({
    chronicDiseases: '',       // Kronik hastalıklar
    callType: '',              // Çağrı tipi: telsiz, telefon, diger
    callReason: '',            // Çağrı nedeni (detaylı)
    sceneType: '',             // Olay yeri tipi
    bloodSugar: '',            // Kan şekeri (mg/dL)
    bodyTemp: '',              // Vücut sıcaklığı
    isForensic: false,         // Adli vaka
    outcome: '',               // Sonuç
    transferType: '',          // İlçe içi/dışı/il dışı
    accidentVehicles: ['', '', '', ''], // Kazaya karışan araç plakaları (4 adet)
    referralSource: '',        // Vakayı veren kurum
    patientArrivalTime: '',    // Hastaya varış saati
    stationReturnTime: '',     // İstasyona dönüş saati
    materialsUsed: []          // Kullanılan malzemeler
  });
  
  // CPR data
  const [cprData, setCprData] = useState({
    cprBy: '',
    cprStart: '',
    cprEnd: '',
    cprReason: ''
  });
  
  // Procedures and transfers
  const [procedures, setProcedures] = useState({});
  const [transfers, setTransfers] = useState({});
  
  // Vehicle and protocol info
  const [vehicleInfo, setVehicleInfo] = useState({
    startKm: '',
    endKm: '',
    protocol112: '',
    hospitalProtocol: '',
    referringInstitution: '',
    roundTrip: ''
  });
  
  // Time tracking
  const [timeInfo, setTimeInfo] = useState({
    callTime: '',
    arrivalTime: '',       // Olay yerine varış
    patientArrivalTime: '', // Hastaya varış
    departureTime: '',     // Olay yerinden ayrılış
    hospitalArrivalTime: '', // Hastaneye varış
    stationReturnTime: ''  // İstasyona dönüş
  });
  
  // Isolation and chronic diseases
  const [isolation, setIsolation] = useState([]);
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [applications, setApplications] = useState('');
  
  // Dialogs
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    vehicle_id: '',
    driver_id: '',
    paramedic_id: '',
    att_id: ''
  });
  const [statusForm, setStatusForm] = useState({
    status: '',
    note: ''
  });

  // Polling interval ref
  const pollInterval = useRef(null);
  
  // Procedure list (33 items)
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
  
  // Transfer list (14 items)
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
  
  // Role labels
  const roleLabels = {
    merkez_ofis: 'Merkez Ofis',
    operasyon_muduru: 'Operasyon Müdürü',
    cagri_merkezi: 'Çağrı Merkezi',
    doktor: 'Doktor',
    hemsire: 'Hemşire',
    paramedik: 'Paramedik',
    att: 'ATT',
    bas_sofor: 'Baş Şoför',
    sofor: 'Şoför'
  };

  // GKS calculation
  const gksPuani = (parseInt(clinicalObs.motorResponse) || 0) + 
                   (parseInt(clinicalObs.verbalResponse) || 0) + 
                   (parseInt(clinicalObs.eyeOpening) || 0);

  // Load initial data
  useEffect(() => {
    loadData();
    loadHospitalsGrouped();
    
    // Cleanup on unmount
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      // Leave case
      casesAPI.leaveCase(id).catch(() => {});
    };
  }, [id]);
  
  // Start polling for real-time updates - only when page is visible and case is open
  useEffect(() => {
    if (!caseData) return;
    
    // Join case
    casesAPI.joinCase(id).catch(console.error);
    
    // Vaka kapalıysa polling yapma
    const closedStatuses = ['tamamlandi', 'iptal_edildi', 'kapandi'];
    if (closedStatuses.includes(caseData.status)) {
      return;
    }
    
    // Visibility change handler - sayfa görünür değilse polling durdur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
      } else {
        // Sayfa tekrar görünür olduğunda polling başlat
        if (!pollInterval.current) {
          pollInterval.current = setInterval(() => {
            loadMedicalForm();
            loadParticipants();
          }, 5000); // 5 saniyeye çıkardık
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial polling - only if page is visible
    if (!document.hidden) {
      pollInterval.current = setInterval(() => {
        loadMedicalForm();
        loadParticipants();
      }, 5000); // 5 saniyede bir
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };
  }, [caseData?.status, id]);

  const loadData = async () => {
    try {
      const [caseRes, vehiclesRes, usersRes] = await Promise.all([
        casesAPI.getById(id),
        vehiclesAPI.getAll({ status: 'musait' }),
        usersAPI.getAll()
      ]);
      setCaseData(caseRes.data);
      setVehicles(vehiclesRes.data);
      setUsers(usersRes.data);
      
      // Set patient info for editing
      if (caseRes.data.patient) {
        setPatientInfo({
          name: caseRes.data.patient.name || '',
          surname: caseRes.data.patient.surname || '',
          tc_no: caseRes.data.patient.tc_no || '',
          age: caseRes.data.patient.age || '',
          birth_date: caseRes.data.patient.birth_date || '',
          gender: caseRes.data.patient.gender || ''
        });
      }
      
      // Load medical form
      await loadMedicalForm();
      
      // Load medications
      await loadMedications();
      
      // Load all stock (araç + carter) after case data is loaded
      if (caseRes.data?.assigned_team?.vehicle_id) {
        try {
          const stockRes = await stockAPI.getVehicleAllStock(caseRes.data.assigned_team.vehicle_id);
          setAllStockData({
            vehicle: stockRes.data?.vehicle_stock || [],
            carter: stockRes.data?.carter_stock || [],
            carter_name: stockRes.data?.carter_name || 'Carter',
            carter_location_id: stockRes.data?.carter_location_id || null
          });
        } catch (stockErr) {
          console.error('Error loading all stock:', stockErr);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };
  
  // Load medications for case
  const loadMedications = async () => {
    try {
      const res = await medicationsAPI.getCaseMedications(id);
      setMedications(res.data || []);
    } catch (error) {
      console.error('Error loading medications:', error);
    }
  };
  
  // YENİ: Araç ve Carter stoklarını yükle
  const loadAllStock = async () => {
    if (!caseData?.assigned_team?.vehicle_id) return;
    
    setLoadingAllStock(true);
    try {
      const res = await stockAPI.getVehicleAllStock(caseData.assigned_team.vehicle_id);
      setAllStockData({
        vehicle: res.data?.vehicle_stock || [],
        carter: res.data?.carter_stock || [],
        carter_name: res.data?.carter_name || 'Carter',
        carter_location_id: res.data?.carter_location_id || null
      });
    } catch (error) {
      console.error('Error loading all stock:', error);
      // Fallback: sadece araç stoku
      setAllStockData({ vehicle: [], carter: [], carter_name: '' });
    } finally {
      setLoadingAllStock(false);
    }
  };
  
  // Handle barcode submit
  const handleBarcodeSubmit = async () => {
    if (!barcodeInput.trim()) return;
    
    try {
      // Get vehicle plate from assigned team
      const vehiclePlate = caseData?.assigned_team?.vehicle_id 
        ? vehicles.find(v => v.id === caseData.assigned_team.vehicle_id)?.plate
        : null;
      
      const res = await medicationsAPI.parseBarcode(barcodeInput, vehiclePlate);
      setBarcodeResult(res.data);
      setBarcodeInput('');
    } catch (error) {
      console.error('Error parsing barcode:', error);
      toast.error('Barkod okunamadı');
    }
  };
  
  // Handle stock search
  const handleStockSearch = async (query) => {
    if (query.length < 2) {
      setStockSearchResults([]);
      return;
    }
    
    try {
      // Get vehicle plate
      const vehiclePlate = caseData?.assigned_team?.vehicle_id 
        ? vehicles.find(v => v.id === caseData.assigned_team.vehicle_id)?.plate
        : null;
      
      const res = await stockAPI.search({ 
        q: query, 
        location: 'ambulans',
        location_detail: vehiclePlate
      });
      setStockSearchResults(res.data || []);
    } catch (error) {
      console.error('Error searching stock:', error);
    }
  };
  
  // Add medication to case (with source info: vehicle or carter)
  const handleAddMedication = async (stockItem, parsedBarcode, sourceType = 'vehicle') => {
    setAddingMedication(true);
    try {
      // Kaynak bilgisini belirle
      const sourceInfo = sourceType === 'carter' 
        ? { 
            source_type: 'carter', 
            source_location_id: allStockData.carter_location_id,
            source_location_name: allStockData.carter_name 
          }
        : { 
            source_type: 'vehicle',
            source_location_id: caseData?.assigned_team?.vehicle_id,
            source_location_name: vehicles.find(v => v.id === caseData?.assigned_team?.vehicle_id)?.plate || 'Araç'
          };
      
      await medicationsAPI.addToCases(id, {
        name: stockItem?.name || 'Bilinmiyor',
        gtin: parsedBarcode?.gtin || stockItem?.gtin,
        lot_number: parsedBarcode?.lot_number || stockItem?.lot_number,
        serial_number: parsedBarcode?.serial_number || stockItem?.serial_number,
        expiry_date: parsedBarcode?.expiry_date_parsed || stockItem?.expiry_date,
        quantity: 1,
        unit: stockItem?.unit || 'adet',
        stock_item_id: stockItem?.id,
        ...sourceInfo
      });
      
      const sourceLabel = sourceType === 'carter' ? allStockData.carter_name : 'Araç';
      toast.success(`Malzeme eklendi (${sourceLabel} stoğundan düşüldü)`);
      setBarcodeResult(null);
      setStockSearch('');
      setStockSearchResults([]);
      await loadMedications();
      
      // Stokları güncelle
      if (caseData?.assigned_team?.vehicle_id) {
        const stockRes = await stockAPI.getVehicleAllStock(caseData.assigned_team.vehicle_id);
        setAllStockData({
          vehicle: stockRes.data?.vehicle_stock || [],
          carter: stockRes.data?.carter_stock || [],
          carter_name: stockRes.data?.carter_name || 'Carter',
          carter_location_id: stockRes.data?.carter_location_id || null
        });
      }
    } catch (error) {
      console.error('Error adding medication:', error);
      toast.error('Malzeme eklenemedi');
    } finally {
      setAddingMedication(false);
    }
  };
  
  // Remove medication from case
  const handleRemoveMedication = async (medicationId) => {
    try {
      await medicationsAPI.removeFromCase(id, medicationId);
      toast.success('Malzeme kaldırıldı ve stoğa iade edildi');
      await loadMedications();
    } catch (error) {
      console.error('Error removing medication:', error);
      toast.error('Malzeme kaldırılamadı');
    }
  };
  
  // Create new stock item from barcode
  const handleCreateNewStock = async () => {
    if (!newStockName.trim() || !barcodeResult) return;
    
    try {
      // Get vehicle plate
      const vehiclePlate = caseData?.assigned_team?.vehicle_id 
        ? vehicles.find(v => v.id === caseData.assigned_team.vehicle_id)?.plate
        : null;
      
      const res = await medicationsAPI.createFromBarcode({
        barcode: barcodeResult.parsed?.raw_data || '',
        name: newStockName,
        quantity: 10, // Default initial quantity
        min_quantity: 5,
        location: 'ambulans',
        location_detail: vehiclePlate
      });
      
      toast.success('Yeni ürün stoğa eklendi');
      setNewStockName('');
      setBarcodeResult(null);
      
      // Now add it to the case
      if (res.data?.stock_item) {
        await handleAddMedication(res.data.stock_item, barcodeResult.parsed);
      }
    } catch (error) {
      console.error('Error creating stock:', error);
      toast.error('Ürün eklenemedi');
    }
  };
  
  // Vaka durum güncelleme (ATT ve Paramedik için)
  const handleStatusUpdate = async (newStatus) => {
    if (!newStatus || statusUpdating) return;
    
    setStatusUpdating(true);
    try {
      await casesAPI.updateStatus(id, { 
        status: newStatus, 
        note: `Durum güncellendi: ${getStatusLabel(newStatus)}` 
      });
      toast.success(`Durum güncellendi: ${getStatusLabel(newStatus)}`);
      // Reload case data
      const res = await casesAPI.getById(id);
      setCaseData(res.data);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Durum güncellenemedi');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Hasta bilgisi güncelleme
  const handlePatientInfoChange = (field, value) => {
    setPatientInfo(prev => ({ ...prev, [field]: value }));
    setPatientInfoChanged(true);
  };

  const savePatientInfo = async () => {
    if (!patientInfoChanged || savingPatientInfo) return;
    
    setSavingPatientInfo(true);
    try {
      await casesAPI.updatePatientInfo(id, {
        name: patientInfo.name,
        surname: patientInfo.surname,
        tc_no: patientInfo.tc_no || null,
        age: parseInt(patientInfo.age) || null,
        birth_date: patientInfo.birth_date || null,
        gender: patientInfo.gender
      });
      toast.success('Hasta bilgileri güncellendi');
      setPatientInfoChanged(false);
      
      // Reload case data
      const res = await casesAPI.getById(id);
      setCaseData(res.data);
    } catch (error) {
      console.error('Error updating patient info:', error);
      toast.error('Hasta bilgileri güncellenemedi');
    } finally {
      setSavingPatientInfo(false);
    }
  };

  // Status labels
  const getStatusLabel = (status) => {
    const labels = {
      'acildi': 'Açıldı',
      'ekip_bilgilendirildi': 'Ekip Bilgilendirildi',
      'ekip_yola_cikti': 'Ekip Yola Çıktı',
      'sahada': 'Sahada',
      'hasta_alindi': 'Hasta Alındı',
      'doktor_konsultasyonu': 'Doktor Konsültasyonu',
      'merkeze_donus': 'Merkeze Dönüş',
      'hastane_sevki': 'Hastane Sevki',
      'tamamlandi': 'Tamamlandı',
      'iptal': 'İptal'
    };
    return labels[status] || status;
  };
  
  // Next status logic for ATT/Paramedik
  const getNextStatuses = (currentStatus) => {
    const statusFlow = {
      'acildi': ['ekip_bilgilendirildi'],
      'ekip_bilgilendirildi': ['ekip_yola_cikti'],
      'ekip_yola_cikti': ['sahada'],
      'sahada': ['hasta_alindi', 'tamamlandi', 'iptal'],
      'hasta_alindi': ['doktor_konsultasyonu', 'merkeze_donus', 'hastane_sevki'],
      'doktor_konsultasyonu': ['merkeze_donus', 'hastane_sevki'],
      'merkeze_donus': ['tamamlandi'],
      'hastane_sevki': ['tamamlandi'],
      'tamamlandi': [],
      'iptal': []
    };
    return statusFlow[currentStatus] || [];
  };
  
  const loadMedicalForm = async () => {
    try {
      const response = await casesAPI.getMedicalForm(id);
      const formData = response.data.medical_form || {};
      setMedicalForm(formData);
      setDoctorApproval(response.data.doctor_approval);
      setParticipants(response.data.participants || []);
      
      // Load extended form data
      if (formData.vital_signs) setVitalSigns(formData.vital_signs);
      if (formData.clinical_obs) setClinicalObs(formData.clinical_obs);
      if (formData.cpr_data) setCprData(formData.cpr_data);
      if (formData.procedures) setProcedures(formData.procedures);
      if (formData.transfers) setTransfers(formData.transfers);
      if (formData.vehicle_info) setVehicleInfo(formData.vehicle_info);
      if (formData.time_info) setTimeInfo(formData.time_info);
      if (formData.isolation) setIsolation(formData.isolation);
      if (formData.extended_form) setExtendedForm(prev => ({ ...prev, ...formData.extended_form }));
      if (formData.chronic_diseases) setChronicDiseases(formData.chronic_diseases);
      if (formData.applications) setApplications(formData.applications);
      if (formData.inline_consents) setInlineConsents(prev => ({ ...prev, ...formData.inline_consents }));
    } catch (error) {
      console.error('Error loading medical form:', error);
    }
  };
  
  const loadParticipants = async () => {
    try {
      const response = await casesAPI.getParticipants(id);
      setParticipants(response.data.participants || []);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };
  
  const loadHospitalsGrouped = async () => {
    try {
      const response = await referenceAPI.getHospitalsGrouped();
      setHospitalsGrouped(response.data);
    } catch (error) {
      console.error('Error loading hospitals:', error);
    }
  };
  
  // Debounced form update
  const updateFormField = useCallback(async (field, value) => {
    setMedicalForm(prev => ({ ...prev, [field]: value }));
    
    try {
      await casesAPI.updateMedicalForm(id, { [field]: value });
    } catch (error) {
      console.error('Error updating form:', error);
    }
  }, [id]);
  
  // Update vital signs
  const updateVitalSigns = async (index, field, value) => {
    const newVitals = [...vitalSigns];
    newVitals[index][field] = value;
    setVitalSigns(newVitals);
    updateFormField('vital_signs', newVitals);
  };
  
  // Update clinical observations
  const updateClinicalObs = async (field, value) => {
    const newObs = { ...clinicalObs, [field]: value };
    setClinicalObs(newObs);
    updateFormField('clinical_obs', newObs);
  };
  
  // Update extended form fields
  const updateExtendedForm = async (field, value) => {
    const newForm = { ...extendedForm, [field]: value };
    setExtendedForm(newForm);
    updateFormField('extended_form', newForm);
  };
  
  // Update CPR data
  const updateCprData = async (field, value) => {
    const newCpr = { ...cprData, [field]: value };
    setCprData(newCpr);
    updateFormField('cpr_data', newCpr);
  };
  
  // Update vehicle info
  const updateVehicleInfo = async (field, value) => {
    const newInfo = { ...vehicleInfo, [field]: value };
    setVehicleInfo(newInfo);
    updateFormField('vehicle_info', newInfo);
  };
  
  // Update time info
  const updateTimeInfo = async (field, value) => {
    const newInfo = { ...timeInfo, [field]: value };
    setTimeInfo(newInfo);
    updateFormField('time_info', newInfo);
  };
  
  // Toggle procedure
  const toggleProcedure = (proc) => {
    const newProcs = { ...procedures, [proc]: !procedures[proc] };
    setProcedures(newProcs);
    updateFormField('procedures', newProcs);
  };
  
  // Toggle transfer
  const toggleTransfer = (transfer) => {
    const newTransfers = { ...transfers, [transfer]: !transfers[transfer] };
    setTransfers(newTransfers);
    updateFormField('transfers', newTransfers);
  };
  
  // Toggle isolation
  const toggleIsolation = (type) => {
    const newIso = isolation.includes(type) 
      ? isolation.filter(i => i !== type)
      : [...isolation, type];
    setIsolation(newIso);
    updateFormField('isolation', newIso);
  };
  
  // ICD code search
  const searchIcdCodes = async (query) => {
    if (!query || query.length < 2) {
      setIcdResults([]);
      return;
    }
    
    try {
      const response = await referenceAPI.searchIcdCodes(query);
      setIcdResults(response.data);
    } catch (error) {
      console.error('Error searching ICD codes:', error);
    }
  };
  
  // Hospital search
  const searchHospitals = async (query) => {
    if (!query || query.length < 2) {
      setHospitalResults([]);
      return;
    }
    
    try {
      const response = await referenceAPI.getHospitals({ q: query });
      setHospitalResults(response.data);
    } catch (error) {
      console.error('Error searching hospitals:', error);
    }
  };
  
  // Add ICD diagnosis
  const addDiagnosis = (icd, type = 'preliminary') => {
    const field = type === 'preliminary' ? 'preliminary_diagnosis' : 'final_diagnosis';
    const current = medicalForm[field] || [];
    
    // Check if already added
    if (current.some(d => d.code === icd.code)) {
      toast.error('Bu tanı zaten eklenmiş');
      return;
    }
    
    const updated = [...current, icd];
    updateFormField(field, updated);
    setIcdSearch('');
    setIcdResults([]);
    toast.success(`${icd.code} - ${icd.name} eklendi`);
  };
  
  // Remove diagnosis
  const removeDiagnosis = (code, type = 'preliminary') => {
    const field = type === 'preliminary' ? 'preliminary_diagnosis' : 'final_diagnosis';
    const current = medicalForm[field] || [];
    const updated = current.filter(d => d.code !== code);
    updateFormField(field, updated);
  };
  
  // Select hospital
  const selectHospital = (hospital) => {
    updateFormField('transfer_hospital', hospital);
    setHospitalSearch('');
    setHospitalResults([]);
    toast.success(`${hospital.name} seçildi`);
  };
  
  // Doctor approval
  const handleDoctorApproval = async (status) => {
    try {
      const response = await casesAPI.doctorApproval(id, {
        status,
        notes: status === 'approved' ? 'İşlem onaylandı' : null,
        rejection_reason: status === 'rejected' ? 'Red nedeni belirtilmedi' : null
      });
      toast.success(response.data.message);
      setDoctorApproval(response.data.approval);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };
  
  // Video call state
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [videoRoomUrl, setVideoRoomUrl] = useState(null);
  const [videoProvider, setVideoProvider] = useState(null);
  
  // Start video call - embed in page
  const startVideoCall = async () => {
    try {
      // Daily.co API'yi dene
      const response = await videoCallAPI.createRoom(id);
      console.log('Video call response:', response.data);
      const { room_url, provider } = response.data;
      
      if (room_url) {
        console.log('Setting video state:', { room_url, provider });
        // State'leri hızlı sırayla güncelle
        setVideoProvider(provider || 'daily');
        setVideoRoomUrl(room_url);
        // Kısa gecikme ile aktif et
        setTimeout(() => {
          setVideoCallActive(true);
          toast.success('Görüntülü görüşme başlatılıyor...');
        }, 100);
      } else {
        toast.error('Video odası URL alınamadı');
      }
    } catch (error) {
      console.error('Video call error:', error);
      toast.error('Görüntülü görüşme başlatılamadı');
    }
  };
  
  // End video call
  const endVideoCall = async () => {
    console.log('endVideoCall called');
    console.trace('endVideoCall stack trace');
    try {
      await videoCallAPI.endRoom(id);
    } catch (e) {
      // Ignore
    }
    setVideoCallActive(false);
    setVideoRoomUrl(null);
    setVideoProvider(null);
    toast.info('Görüntülü görüşme sonlandırıldı');
  };
  
  // Check video call status on load - only once at mount
  const videoStatusCheckedRef = useRef(false);
  useEffect(() => {
    const checkVideoStatus = async () => {
      // Sadece bir kez kontrol et
      if (videoStatusCheckedRef.current) return;
      videoStatusCheckedRef.current = true;
      
      try {
        const response = await videoCallAPI.getRoomStatus(id);
        if (response.data.active && response.data.room_url) {
          setVideoRoomUrl(response.data.room_url);
          setVideoProvider(response.data.provider);
          setVideoCallActive(true);
        }
      } catch (e) {
        // Ignore
      }
    };
    if (id) checkVideoStatus();
  }, [id]);

  // Inline consent değeri güncelleme
  const updateInlineConsent = (field, value) => {
    setInlineConsents(prev => ({ ...prev, [field]: value }));
  };
  
  // Inline consent'leri kaydet
  const saveInlineConsents = async () => {
    setSavingConsents(true);
    try {
      await casesAPI.updateMedicalForm(id, { inline_consents: inlineConsents });
      toast.success('İmzalar kaydedildi');
    } catch (error) {
      console.error('Error saving inline consents:', error);
      toast.error('İmzalar kaydedilemedi');
    } finally {
      setSavingConsents(false);
    }
  };
  
  // Onam formu açma
  const openConsentForm = (formId) => {
    setSelectedConsentForm(formId);
    setConsentDialogOpen(true);
  };
  
  // Onam formu bileşenini render et
  const renderConsentFormContent = (formId) => {
    const commonProps = {
      caseId: id,
      caseNumber: caseData?.case_number,
      patientName: caseData?.patient_name || ''
    };
    
    switch(formId) {
      case 'kvkk':
        return <KVKKConsentForm {...commonProps} />;
      case 'injection':
        return <InjectionConsentForm {...commonProps} />;
      case 'puncture':
        return <PunctureConsentForm {...commonProps} />;
      case 'minor-surgery':
        return <MinorSurgeryConsentForm {...commonProps} />;
      case 'general-consent':
        return <GeneralConsentForm {...commonProps} />;
      default:
        return null;
    }
  };

  const handleAssignTeam = async () => {
    try {
      await casesAPI.assignTeam(id, assignForm);
      toast.success('Ekip atandı');
      setAssignDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ekip atanamadı');
    }
  };

  const handleUpdateStatus = async () => {
    try {
      await casesAPI.updateStatus(id, statusForm);
      toast.success('Durum güncellendi');
      setStatusDialogOpen(false);
      setStatusForm({ status: '', note: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Durum güncellenemedi');
    }
  };

  const statusLabels = {
    acildi: 'Açıldı',
    ekip_bilgilendirildi: 'Ekip Bilgilendirildi',
    ekip_yola_cikti: 'Ekip Yola Çıktı',
    sahada: 'Sahada',
    hasta_alindi: 'Hasta Alındı',
    doktor_konsultasyonu: 'Doktor Konsültasyonu',
    merkeze_donus: 'Merkeze Dönüş',
    hastane_sevki: 'Hastane Sevki',
    tamamlandi: 'Tamamlandı',
    iptal: 'İptal'
  };

  const priorityColors = {
    yuksek: 'bg-red-100 text-red-800',
    orta: 'bg-yellow-100 text-yellow-800',
    dusuk: 'bg-green-100 text-green-800'
  };

  const priorityLabels = {
    yuksek: 'Yüksek',
    orta: 'Orta',
    dusuk: 'Düşük'
  };

  const canManageCase = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);
  const isDoctor = user?.role === 'doktor';
  const canEditForm = ['doktor', 'hemsire', 'paramedik', 'att'].includes(user?.role);

  if (loading || !caseData) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="case-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/cases')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
          <div>
            <h1 className="text-2xl font-bold">AMBULANS VAKA FORMU</h1>
          <div className="flex items-center space-x-2 mt-1">
              <Badge variant="outline">{caseData.case_number}</Badge>
            <Badge className={priorityColors[caseData.priority]}>
              {priorityLabels[caseData.priority]}
            </Badge>
            <Badge variant="outline">{statusLabels[caseData.status]}</Badge>
          </div>
        </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Status Update Buttons - Only for ATT/Paramedik */}
          {(user?.role === 'att' || user?.role === 'paramedik') && caseData?.status !== 'tamamlandi' && caseData?.status !== 'iptal' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Durum:</span>
              <Badge variant="outline" className="mr-2">{getStatusLabel(caseData?.status)}</Badge>
              <span className="text-sm text-gray-400">→</span>
              <Select 
                value="" 
                onValueChange={handleStatusUpdate}
                disabled={statusUpdating || getNextStatuses(caseData?.status).length === 0}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={statusUpdating ? "Güncelleniyor..." : "Sonraki durum"} />
                </SelectTrigger>
                <SelectContent>
                  {getNextStatuses(caseData?.status).map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Participants */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Katılanlar:</span>
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((p, idx) => (
                <Avatar key={idx} className="w-8 h-8 border-2 border-white" title={p.user_name}>
                  {p.profile_photo ? (
                    <AvatarImage src={p.profile_photo} alt={p.user_name} />
                  ) : null}
                  <AvatarFallback className="text-xs bg-gradient-to-br from-red-500 to-red-700 text-white">
                    {p.user_name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {participants.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium border-2 border-white">
                  +{participants.length - 5}
                </div>
              )}
            </div>
          </div>
          
          {/* Video Call Button */}
          {/* PDF Export Button */}
          <Button 
            variant="outline"
            onClick={async () => {
              if (!caseData) {
                toast.error('Vaka verisi yüklenemedi');
                return;
              }

              try {
                toast.info('PDF oluşturuluyor...');
                
                // Prepare form data to send to backend
                const formDataObj = {
                  ...medicalForm,
                  // Add any additional data needed for PDF
                  patientName: patientInfo.name && patientInfo.surname 
                    ? `${patientInfo.name} ${patientInfo.surname}` 
                    : '',
                  age: patientInfo.age || '',
                  tcNo: patientInfo.tc_no || '',
                  date: new Date().toLocaleDateString('tr-TR'),
                };

                // Call backend API
                const apiUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
                const response = await fetch(
                  `${apiUrl}/api/pdf/case/${id}/with-form-data`, 
                  {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formDataObj),
                    credentials: 'include',
                  }
                );

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(errorData.detail || 'PDF generation failed');
                }

                // Download PDF
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Ambulans_Vaka_Formu_${caseData.case_number || id}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                toast.success('PDF başarıyla indirildi!');
              } catch (error) {
                console.error('PDF oluşturma hatası:', error);
                toast.error(error.message || 'PDF oluşturulurken hata oluştu');
              }
            }}
            className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
          >
            <FileDown className="h-4 w-4 mr-2" />
            PDF İndir
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                toast.info('Excel dosyası hazırlanıyor...');
                const response = await casesAPI.exportExcel(id);
                
                // Response'un gerçekten Excel olup olmadığını kontrol et
                const contentType = response.headers?.['content-type'] || '';
                
                if (!contentType.includes('spreadsheet') && !contentType.includes('octet-stream')) {
                  // Hata mesajı olabilir, blob'u text olarak oku
                  const text = await response.data.text();
                  console.error('Excel API hatası:', text);
                  try {
                    const errorData = JSON.parse(text);
                    toast.error(errorData.detail || 'Excel oluşturulurken hata oluştu');
                  } catch {
                    toast.error('Excel oluşturulurken hata oluştu');
                  }
                  return;
                }
                
                // Dosya adını oluştur
                const fileName = `VAKA_FORMU_${caseData?.case_number || id}_${new Date().toISOString().split('T')[0]}.xlsx`;
                
                // file-saver ile indir
                saveAs(response.data, fileName);
                
                toast.success(`Excel dosyası indirildi: ${fileName}`);
              } catch (error) {
                console.error('Excel oluşturma hatası:', error);
                // Axios error durumunda response data'yı kontrol et
                if (error.response?.data) {
                  try {
                    const text = await error.response.data.text?.() || '';
                    const errorData = JSON.parse(text);
                    toast.error(errorData.detail || 'Excel oluşturulurken hata oluştu');
                  } catch {
                    toast.error('Excel oluşturulurken hata oluştu');
                  }
                } else {
                  toast.error('Excel oluşturulurken hata oluştu');
                }
              }
            }}
            className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Excel İndir
          </Button>

          {videoCallActive ? (
            <Button 
              onClick={endVideoCall}
              variant="destructive"
            >
              <VideoOff className="h-4 w-4 mr-2" />
              Görüşmeyi Kapat
            </Button>
          ) : (
            <Button 
              onClick={startVideoCall}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              <Video className="h-4 w-4 mr-2" />
              Görüntülü Görüşme
            </Button>
          )}
        </div>
      </div>
      
      {/* Embedded Video Call */}
      {videoCallActive && videoRoomUrl && (
        <div className="mb-4">
          <VideoCall 
            roomUrl={videoRoomUrl}
            userName={user?.name}
            provider={videoProvider}
            onLeave={endVideoCall}
            onError={(e) => console.error('Video error:', e)}
          />
        </div>
      )}
      
      {/* 36 Saat Erişim Kısıtı Uyarısı */}
      <CaseAccessRestriction 
        accessInfo={caseData?.access_info}
        caseId={id}
        onAccessGranted={() => window.location.reload()}
      />
      
      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="form" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Temel Bilgiler</span>
          </TabsTrigger>
          <TabsTrigger value="vitals" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Vitaller</span>
          </TabsTrigger>
          <TabsTrigger value="procedures" className="flex items-center space-x-2">
            <Syringe className="h-4 w-4" />
            <span>Uygulamalar</span>
          </TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Malzemeler</span>
          </TabsTrigger>
          <TabsTrigger value="transfer" className="flex items-center space-x-2">
            <Ambulance className="h-4 w-4" />
            <span>Transfer</span>
          </TabsTrigger>
          <TabsTrigger value="consent" className="flex items-center space-x-2">
            <FileSignature className="h-4 w-4" />
            <span>Onam Formları</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Geçmiş</span>
          </TabsTrigger>
        </TabsList>

        {/* Doctor Approval Banner */}
        {isDoctor && !doctorApproval?.status && (
          <Card className="border-2 border-amber-300 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">Onay Bekliyor</p>
                    <p className="text-sm text-amber-700">Lütfen işlemleri inceleyip onayınızı verin</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => handleDoctorApproval('approved')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    İşleme Onay Veriyorum
                  </Button>
                  <Button 
                    onClick={() => handleDoctorApproval('rejected')}
                    variant="destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Onay Vermiyorum
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {doctorApproval?.status && (
          <Card className={`border-2 ${doctorApproval.status === 'approved' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <CardContent className="py-3">
              <div className="flex items-center space-x-3">
                {doctorApproval.status === 'approved' ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <X className="h-5 w-5 text-red-600" />
                )}
                <span className={doctorApproval.status === 'approved' ? 'text-green-800' : 'text-red-800'}>
                  {doctorApproval.doctor_name} tarafından {doctorApproval.status === 'approved' ? 'onaylandı' : 'reddedildi'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 1: Temel Bilgiler */}
        <TabsContent value="form" className="space-y-4">
          {/* Hasta ve Zaman Bilgileri */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <User className="h-5 w-5" />
                <span>Hasta ve Zaman Bilgileri</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Düzenlenebilir Hasta Bilgileri */}
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <Label>Ad</Label>
                  <Input 
                    value={patientInfo.name} 
                    onChange={(e) => handlePatientInfoChange('name', e.target.value)}
                    placeholder="Hasta adı"
                  />
                </div>
                <div>
                  <Label>Soyad</Label>
                  <Input 
                    value={patientInfo.surname} 
                    onChange={(e) => handlePatientInfoChange('surname', e.target.value)}
                    placeholder="Hasta soyadı"
                  />
                </div>
                <div>
                  <Label>T.C. Kimlik No</Label>
                  <Input 
                    value={patientInfo.tc_no} 
                    onChange={(e) => handlePatientInfoChange('tc_no', e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                    placeholder="TC Kimlik"
                    maxLength={11}
                  />
                </div>
                <div>
                  <Label>Doğum Tarihi</Label>
                  <Input 
                    type="date"
                    value={patientInfo.birth_date} 
                    onChange={(e) => {
                      const birthDate = e.target.value;
                      handlePatientInfoChange('birth_date', birthDate);
                      // Doğum tarihinden yaş hesapla
                      if (birthDate) {
                        const today = new Date();
                        const birth = new Date(birthDate);
                        let age = today.getFullYear() - birth.getFullYear();
                        const m = today.getMonth() - birth.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                          age--;
                        }
                        handlePatientInfoChange('age', age.toString());
                      }
                    }}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label>Yaş</Label>
                  <Input 
                    type="number"
                    min="0"
                    max="150"
                    value={patientInfo.age} 
                    onChange={(e) => handlePatientInfoChange('age', e.target.value)}
                    placeholder="Yaş"
                  />
                </div>
                <div>
                  <Label>Cinsiyet</Label>
                  <Select value={patientInfo.gender} onValueChange={(value) => handlePatientInfoChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="erkek">Erkek</SelectItem>
                      <SelectItem value="kadin">Kadın</SelectItem>
                      <SelectItem value="diger">Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Kaydet Butonu */}
              {patientInfoChanged && (
                <div className="flex justify-end">
                  <Button 
                    onClick={savePatientInfo}
                    disabled={savingPatientInfo}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savingPatientInfo ? 'Kaydediliyor...' : 'Hasta Bilgilerini Kaydet'}
                  </Button>
                </div>
              )}
              
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label>Çağrı Saati</Label>
                  <Input 
                    type="time" 
                    value={timeInfo.callTime} 
                    onChange={(e) => updateTimeInfo('callTime', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>Olay Yerine Varış</Label>
                  <Input 
                    type="time" 
                    value={timeInfo.arrivalTime} 
                    onChange={(e) => updateTimeInfo('arrivalTime', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>Hastaya Varış</Label>
                  <Input 
                    type="time" 
                    value={timeInfo.patientArrivalTime} 
                    onChange={(e) => updateTimeInfo('patientArrivalTime', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>Olay Yerinden Ayrılış</Label>
                  <Input 
                    type="time" 
                    value={timeInfo.departureTime} 
                    onChange={(e) => updateTimeInfo('departureTime', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Hastaneye Varış</Label>
                  <Input 
                    type="time" 
                    value={timeInfo.hospitalArrivalTime} 
                    onChange={(e) => updateTimeInfo('hospitalArrivalTime', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>İstasyona Dönüş</Label>
                  <Input 
                    type="time" 
                    value={timeInfo.stationReturnTime} 
                    onChange={(e) => updateTimeInfo('stationReturnTime', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
              </div>
              
              <div>
                <Label>Adres</Label>
                <Textarea value={caseData.location.address} disabled className="bg-gray-50" rows={2} />
              </div>
              
              <div>
                <Label>Hastanın Şikayeti</Label>
                <Textarea value={caseData.patient.complaint} disabled className="bg-gray-50" rows={2} />
              </div>
              
              <div>
                <Label>Kronik Hastalıklar</Label>
                <Textarea 
                  placeholder="Kronik hastalıkları yazın..."
                  value={extendedForm.chronicDiseases}
                  onChange={(e) => updateExtendedForm('chronicDiseases', e.target.value)}
                  disabled={!canEditForm}
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Çağrı Tipi</Label>
                  <Select 
                    value={extendedForm.callType} 
                    onValueChange={(v) => updateExtendedForm('callType', v)}
                    disabled={!canEditForm}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telsiz">Telsiz</SelectItem>
                      <SelectItem value="telefon">Telefon</SelectItem>
                      <SelectItem value="diger">Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Çağrı Nedeni</Label>
                  <Select 
                    value={extendedForm.callReason} 
                    onValueChange={(v) => updateExtendedForm('callReason', v)}
                    disabled={!canEditForm}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medikal">Medikal</SelectItem>
                      <SelectItem value="trafik_kazasi">Trafik Kazası</SelectItem>
                      <SelectItem value="is_kazasi">İş Kazası</SelectItem>
                      <SelectItem value="diger_kaza">Diğer Kaza</SelectItem>
                      <SelectItem value="yangin">Yangın</SelectItem>
                      <SelectItem value="intihar">İntihar</SelectItem>
                      <SelectItem value="kimyasal">Kimyasal</SelectItem>
                      <SelectItem value="kesici_delici">Kesici-Delici</SelectItem>
                      <SelectItem value="elektrik">Elektrik Çarpması</SelectItem>
                      <SelectItem value="atesli_silah">Ateşli Silah</SelectItem>
                      <SelectItem value="bogulma">Boğulma</SelectItem>
                      <SelectItem value="allerji">Allerji</SelectItem>
                      <SelectItem value="dusme">Düşme</SelectItem>
                      <SelectItem value="alkol_ilac">Alkol/İlaç</SelectItem>
                      <SelectItem value="kunt_travma">Künt Travma</SelectItem>
                      <SelectItem value="yanik">Yanık</SelectItem>
                      <SelectItem value="lpg">LPG</SelectItem>
                      <SelectItem value="tedbir">Tedbir</SelectItem>
                      <SelectItem value="protokol">Protokol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Olay Yeri</Label>
                  <Select 
                    value={extendedForm.sceneType} 
                    onValueChange={(v) => updateExtendedForm('sceneType', v)}
                    disabled={!canEditForm}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ev">Ev</SelectItem>
                      <SelectItem value="yaya">Yaya</SelectItem>
                      <SelectItem value="aracta">Araçta</SelectItem>
                      <SelectItem value="sokak">Sokak</SelectItem>
                      <SelectItem value="fabrika">Fabrika</SelectItem>
                      <SelectItem value="buro">Büro</SelectItem>
                      <SelectItem value="suda">Suda</SelectItem>
                      <SelectItem value="arazi">Arazi</SelectItem>
                      <SelectItem value="stadyum">Stadyum</SelectItem>
                      <SelectItem value="huzurevi">Huzurevi</SelectItem>
                      <SelectItem value="cami">Cami</SelectItem>
                      <SelectItem value="yurt">Yurt</SelectItem>
                      <SelectItem value="saglik_kurumu">Sağlık Kurumu</SelectItem>
                      <SelectItem value="resmi_daire">Resmi Daire</SelectItem>
                      <SelectItem value="egitim_kurumu">Eğitim Kurumu</SelectItem>
                      <SelectItem value="spor_salonu">Spor Salonu</SelectItem>
                      <SelectItem value="liman_santiye">Liman/Şantiye</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-yellow-50 p-3 rounded">
                <Switch 
                  id="conscious" 
                  checked={clinicalObs.consciousStatus} 
                  onCheckedChange={(v) => updateClinicalObs('consciousStatus', v)}
                  disabled={!canEditForm}
                />
                <Label htmlFor="conscious" className="cursor-pointer">
                  Hasta Bilinci Durumu: <strong>{clinicalObs.consciousStatus ? 'Bilinci Açık' : 'Bilinci Kapalı'}</strong>
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Tıbbi Bilgiler */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Stethoscope className="h-5 w-5" />
                <span>Tıbbi Bilgiler</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* ICD Diagnosis */}
              <div className="relative">
                <Label>Ön Tanı (ICD-10)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Örn: A00 veya Kolera"
                    className="pl-10"
                    value={icdSearch}
                    onChange={(e) => {
                      setIcdSearch(e.target.value);
                      searchIcdCodes(e.target.value);
                    }}
                    disabled={!canEditForm}
                  />
                </div>
                
                {icdResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {icdResults.map((icd, idx) => (
                      <button
                        key={idx}
                        onClick={() => addDiagnosis(icd)}
                        className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                      >
                        <span className="font-mono text-blue-600">{icd.code}</span>
                        <span className="text-sm text-gray-600 truncate ml-2">{icd.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {(medicalForm.preliminary_diagnosis || []).map((diag, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary"
                    className="flex items-center space-x-1 bg-indigo-100 text-indigo-800"
                  >
                    <span className="font-mono">{diag.code}</span>
                    <span>-</span>
                    <span className="truncate max-w-[150px]">{diag.name}</span>
                    {canEditForm && (
                      <button onClick={() => removeDiagnosis(diag.code)} className="ml-1 hover:text-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              
              <div>
                <Label>Kronik Hastalıklar</Label>
                <Input 
                  value={chronicDiseases} 
                  onChange={(e) => {
                    setChronicDiseases(e.target.value);
                    updateFormField('chronic_diseases', e.target.value);
                  }}
                  placeholder="DM, HT, KOAH vb."
                  disabled={!canEditForm}
                />
              </div>
              
              <div>
                <Label>Açıklama, Hastaya Yapılan Uygulama, Kullanılan İlaçlar</Label>
                <Textarea 
                  value={applications} 
                  onChange={(e) => {
                    setApplications(e.target.value);
                    updateFormField('applications', e.target.value);
                  }}
                  rows={4}
                  disabled={!canEditForm}
                />
              </div>
              
              <div>
                <Label>İzolasyon Durumu</Label>
                <div className="flex space-x-6 mt-2">
                  {['solunum', 'damlacik', 'temas'].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`iso-${type}`}
                        checked={isolation.includes(type)}
                        onCheckedChange={() => toggleIsolation(type)}
                        disabled={!canEditForm}
                      />
                      <Label htmlFor={`iso-${type}`} className="font-normal cursor-pointer">
                        {type === 'solunum' ? 'Solunum' : type === 'damlacik' ? 'Damlacık' : 'Temas'} İzolasyonu
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nakil Hastanesi */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Building2 className="h-5 w-5" />
                <span>Nakil Hastanesi</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {hospitalsGrouped && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <Label className="text-sm font-semibold text-emerald-700">HEALMEDY</Label>
                    <div className="space-y-1 mt-2">
                      {hospitalsGrouped.healmedy?.map((h, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectHospital(h)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                            medicalForm.transfer_hospital?.name === h.name
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {h.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-semibold text-blue-700">Özel Hastaneler</Label>
                    <div className="space-y-1 mt-2">
                      {hospitalsGrouped.ozel_hastaneler?.map((h, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectHospital(h)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                            medicalForm.transfer_hospital?.name === h.name
                              ? 'bg-blue-100 border-blue-500 text-blue-800'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {h.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-semibold text-purple-700">Zonguldak Devlet Hastaneleri</Label>
                    <div className="space-y-1 mt-2 max-h-[200px] overflow-y-auto">
                      {hospitalsGrouped.devlet_hastaneleri?.map((h, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectHospital(h)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                            medicalForm.transfer_hospital?.name === h.name
                              ? 'bg-purple-100 border-purple-500 text-purple-800'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {h.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div>
                <Label>Diğer İller (Arama)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Hastane adı yazın..."
                    className="pl-10"
                    value={hospitalSearch}
                    onChange={(e) => {
                      setHospitalSearch(e.target.value);
                      searchHospitals(e.target.value);
                    }}
                    disabled={!canEditForm}
                  />
                  
                  {hospitalResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {hospitalResults.map((h, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectHospital(h)}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50"
                        >
                          <div className="font-medium">{h.name}</div>
                          <div className="text-xs text-gray-500">{h.il} - {h.ilce}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {medicalForm.transfer_hospital && (
                <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-teal-800">{medicalForm.transfer_hospital.name}</p>
                      <p className="text-sm text-teal-600">{medicalForm.transfer_hospital.type}</p>
                    </div>
                    {canEditForm && (
                      <Button variant="ghost" size="sm" onClick={() => updateFormField('transfer_hospital', null)} className="text-red-500 hover:text-red-700">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Sonuç ve Transfer Tipi */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Sonuç</Label>
                  <Select 
                    value={extendedForm.outcome} 
                    onValueChange={(v) => updateExtendedForm('outcome', v)}
                    disabled={!canEditForm}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sonuç seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yerinde_mudahale">Yerinde Müdahale</SelectItem>
                      <SelectItem value="hastaneye_nakil">Hastaneye Nakil</SelectItem>
                      <SelectItem value="hastaneler_arasi">Hastaneler Arası Nakil</SelectItem>
                      <SelectItem value="tibbi_tetkik">Tıbbi Tetkik İçin Nakil</SelectItem>
                      <SelectItem value="eve_nakil">Eve Nakil</SelectItem>
                      <SelectItem value="ex_terinde">Ex Terinde Bırakıldı</SelectItem>
                      <SelectItem value="ex_morga">Ex Morga Nakil</SelectItem>
                      <SelectItem value="nakil_reddi">Nakil Reddi</SelectItem>
                      <SelectItem value="diger_ulasilan">Diğer Ulaşılan</SelectItem>
                      <SelectItem value="gorev_iptali">Görev İptali</SelectItem>
                      <SelectItem value="baska_aracla_nakil">Başka Araçla Nakil</SelectItem>
                      <SelectItem value="asilsiz_ihbar">Asılsız İhbar</SelectItem>
                      <SelectItem value="yaralanan_yok">Yaralanan Yok</SelectItem>
                      <SelectItem value="olay_yerinde_bekleme">Olay Yerinde Bekleme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Transfer Tipi</Label>
                  <Select 
                    value={extendedForm.transferType} 
                    onValueChange={(v) => updateExtendedForm('transferType', v)}
                    disabled={!canEditForm}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Transfer tipi seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ilce_ici">İlçe İçi</SelectItem>
                      <SelectItem value="ilce_disi">İlçe Dışı</SelectItem>
                      <SelectItem value="il_disi">İl Dışı</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Vakayı Veren Kurum */}
              <div className="mt-4">
                <Label>Vakayı Veren Kurum</Label>
                <Input 
                  placeholder="Kurumu yazınız..."
                  value={extendedForm.referralSource}
                  onChange={(e) => updateExtendedForm('referralSource', e.target.value)}
                  disabled={!canEditForm}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Vital ve Klinik Gözlemler */}
        <TabsContent value="vitals" className="space-y-4">
          {/* 3 Vital Ölçüm Seti */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Activity className="h-5 w-5" />
                <span>Vital Ölçümler</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {vitalSigns.map((vital, index) => (
                <Card key={index} className="bg-gray-50">
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm">{index + 1}. ÖLÇÜM</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-6">
                    <div>
                      <Label className="text-xs">Ölçüm Saati</Label>
                      <Input 
                        type="time" 
                        className="h-9"
                        value={vital.time}
                        onChange={(e) => updateVitalSigns(index, 'time', e.target.value)}
                        disabled={!canEditForm}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Tansiyon</Label>
                      <Input 
                        placeholder="120/80" 
                        className="h-9"
                        value={vital.bp}
                        onChange={(e) => updateVitalSigns(index, 'bp', e.target.value)}
                        disabled={!canEditForm}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nabız</Label>
                      <Input 
                        placeholder="72" 
                        className="h-9"
                        value={vital.pulse}
                        onChange={(e) => updateVitalSigns(index, 'pulse', e.target.value)}
                        disabled={!canEditForm}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">SPO2</Label>
                      <Input 
                        placeholder="98" 
                        className="h-9"
                        value={vital.spo2}
                        onChange={(e) => updateVitalSigns(index, 'spo2', e.target.value)}
                        disabled={!canEditForm}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Solunum/DK</Label>
                      <Input 
                        placeholder="16" 
                        className="h-9"
                        value={vital.respiration}
                        onChange={(e) => updateVitalSigns(index, 'respiration', e.target.value)}
                        disabled={!canEditForm}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Ateş</Label>
                      <Input 
                        placeholder="36.5" 
                        className="h-9"
                        value={vital.temp}
                        onChange={(e) => updateVitalSigns(index, 'temp', e.target.value)}
                        disabled={!canEditForm}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Klinik Gözlemler */}
          {clinicalObs.consciousStatus && (
            <Card>
              <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Eye className="h-5 w-5" />
                  <span>Klinik Gözlemler</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Emosyonel Durum</Label>
                    <RadioGroup 
                      value={clinicalObs.emotionalState} 
                      onValueChange={(v) => updateClinicalObs('emotionalState', v)}
                      disabled={!canEditForm}
                    >
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['Normal', 'Üzüntülü', 'Huzursuz', 'Kayıtsız', 'Diğer'].map(opt => (
                          <div key={opt} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt.toLowerCase()} id={`emo-${opt}`} />
                            <Label htmlFor={`emo-${opt}`} className="font-normal text-xs">{opt}</Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Pupiller</Label>
                    <RadioGroup 
                      value={clinicalObs.pupils} 
                      onValueChange={(v) => updateClinicalObs('pupils', v)}
                      disabled={!canEditForm}
                    >
                      <div className="grid grid-cols-3 gap-2 mt-2">
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
                  <div>
                    <Label>Deri</Label>
                    <RadioGroup 
                      value={clinicalObs.skin} 
                      onValueChange={(v) => updateClinicalObs('skin', v)}
                      disabled={!canEditForm}
                    >
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['Normal', 'Soluk', 'Siyatonik', 'Hiperemik', 'İkterik', 'Terli'].map(opt => (
                          <div key={opt} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt.toLowerCase()} id={`skin-${opt}`} />
                            <Label htmlFor={`skin-${opt}`} className="font-normal text-xs">{opt}</Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Solunum</Label>
                    <RadioGroup 
                      value={clinicalObs.respirationType} 
                      onValueChange={(v) => updateClinicalObs('respirationType', v)}
                      disabled={!canEditForm}
                    >
                      <div className="grid grid-cols-3 gap-2 mt-2">
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
                
                <div>
                  <Label>Nabız Tipi</Label>
                  <RadioGroup 
                    value={clinicalObs.pulseType} 
                    onValueChange={(v) => updateClinicalObs('pulseType', v)}
                    disabled={!canEditForm}
                  >
                    <div className="flex space-x-6 mt-2">
                      {['Düzenli', 'Aritmik', 'Filiform', 'Alınmıyor'].map(opt => (
                        <div key={opt} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt.toLowerCase()} id={`pulse-${opt}`} />
                          <Label htmlFor={`pulse-${opt}`} className="font-normal text-xs">{opt}</Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
                
                {/* GKS */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Motor Yanıt (1-6)</Label>
                    <Input 
                      type="number" 
                      min="1" max="6"
                      placeholder="1-6"
                      value={clinicalObs.motorResponse}
                      onChange={(e) => updateClinicalObs('motorResponse', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div>
                    <Label>Sözlü Yanıt (1-5)</Label>
                    <Input 
                      type="number" 
                      min="1" max="5"
                      placeholder="1-5"
                      value={clinicalObs.verbalResponse}
                      onChange={(e) => updateClinicalObs('verbalResponse', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div>
                    <Label>Göz Açma (1-4)</Label>
                    <Input 
                      type="number" 
                      min="1" max="4"
                      placeholder="1-4"
                      value={clinicalObs.eyeOpening}
                      onChange={(e) => updateClinicalObs('eyeOpening', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div>
                    <Label>GKS Puanı</Label>
                    <div className="h-9 flex items-center justify-center bg-blue-100 rounded font-bold text-blue-800">
                      {gksPuani || 0}
                    </div>
                  </div>
                </div>
                
                {/* Kan Şekeri ve Vücut Sıcaklığı */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Kan Şekeri (mg/dL)</Label>
                    <Input 
                      type="number"
                      placeholder="mg/dL"
                      value={extendedForm.bloodSugar}
                      onChange={(e) => updateExtendedForm('bloodSugar', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div>
                    <Label>Vücut Sıcaklığı (°C)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      placeholder="36.5"
                      value={extendedForm.bodyTemp}
                      onChange={(e) => updateExtendedForm('bodyTemp', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="forensic" 
                      checked={extendedForm.isForensic} 
                      onCheckedChange={(v) => updateExtendedForm('isForensic', v)}
                      disabled={!canEditForm}
                    />
                    <Label htmlFor="forensic" className="font-semibold text-red-700">
                      Adli Vaka
                    </Label>
                  </div>
                </div>
                
                {/* CPR */}
                <Separator />
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>CPR Yapan</Label>
                    <Input 
                      value={cprData.cprBy}
                      onChange={(e) => updateCprData('cprBy', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div>
                    <Label>Başlama Zamanı</Label>
                    <Input 
                      type="time"
                      value={cprData.cprStart}
                      onChange={(e) => updateCprData('cprStart', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div>
                    <Label>Bırakma Zamanı</Label>
                    <Input 
                      type="time"
                      value={cprData.cprEnd}
                      onChange={(e) => updateCprData('cprEnd', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                  <div>
                    <Label>Bırakma Nedeni</Label>
                    <Input 
                      value={cprData.cprReason}
                      onChange={(e) => updateCprData('cprReason', e.target.value)}
                      disabled={!canEditForm}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Notes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Anamnez</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Hasta öyküsü..."
                  rows={4}
                  value={medicalForm.anamnesis || ''}
                  onChange={(e) => updateFormField('anamnesis', e.target.value)}
                  disabled={!canEditForm}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fizik Muayene</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Fizik muayene bulguları..."
                  rows={4}
                  value={medicalForm.physical_exam || ''}
                  onChange={(e) => updateFormField('physical_exam', e.target.value)}
                  disabled={!canEditForm}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Yapılan Uygulamalar */}
        <TabsContent value="procedures" className="space-y-4">
          <Card>
            <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Syringe className="h-5 w-5" />
                <span>Yapılan Uygulamalar ve İşlemler</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {proceduresList.map((proc, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`proc-${index}`}
                      checked={procedures[proc] || false}
                      onCheckedChange={() => toggleProcedure(proc)}
                      disabled={!canEditForm}
                    />
                    <Label htmlFor={`proc-${index}`} className="text-xs font-normal cursor-pointer">{proc}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Genel Notlar</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ekstra notlar..."
                rows={4}
                value={medicalForm.notes || ''}
                onChange={(e) => updateFormField('notes', e.target.value)}
                disabled={!canEditForm}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Kullanılan Malzemeler/İlaçlar */}
        <TabsContent value="medications" className="space-y-4">
          <Card>
            <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Package className="h-5 w-5" />
                <span>Kullanılan İlaç ve Malzemeler</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Yetki kontrolü - ATT ve Paramedik */}
              {(user?.role === 'att' || user?.role === 'paramedik' || user?.role === 'hemsire' || user?.role === 'doktor') && (
                <div className="space-y-4">
                  {/* Kamera ile Tarama Butonu */}
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setShowCameraScanner(true)}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      Kamera ile İlaç Karekodu Tara
                    </Button>
                  </div>

                  {/* Kamera Tarayıcı Dialog */}
                  <Dialog open={showCameraScanner} onOpenChange={(open) => {
                    if (!open) {
                      setShowCameraScanner(false);
                    } else {
                      setShowCameraScanner(true);
                    }
                  }}>
                    <DialogContent className="max-w-lg p-0" aria-describedby={undefined}>
                      <DialogHeader className="sr-only">
                        <DialogTitle>İlaç Karekodu Tarayıcı</DialogTitle>
                      </DialogHeader>
                      <BarcodeScanner
                        mode="usage"
                        caseId={id}
                        title="İlaç Kullanımı - Karekod Tara"
                        onScan={async (barcode) => {
                          try {
                            // Araç plakasını bul
                            const vehiclePlate = caseData?.assigned_team?.vehicle_id 
                              ? vehicles.find(v => v.id === caseData.assigned_team.vehicle_id)?.plate
                              : null;
                            
                            const response = await stockBarcodeAPI.deductByBarcode({
                              barcode: barcode,
                              case_id: id,
                              vehicle_plate: vehiclePlate
                            });
                            
                            toast.success(response.data.message || 'İlaç vakaya eklendi');
                            await loadMedications();
                            return { success: true, item: response.data.medication };
                          } catch (error) {
                            const message = error.response?.data?.detail || 'İlaç eklenemedi';
                            toast.error(message);
                            return { success: false, error: message };
                          }
                        }}
                        onClose={() => setShowCameraScanner(false)}
                        continuousScan={true}
                      />
                    </DialogContent>
                  </Dialog>

                  {/* Karekod/Barkod Manuel Giriş */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>veya Manuel Karekod Girişi</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          placeholder="Karekodu yapıştırın veya tarayın..."
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && barcodeInput.trim()) {
                              await handleBarcodeSubmit();
                            }
                          }}
                        />
                        <Button 
                          variant="outline" 
                          onClick={handleBarcodeSubmit}
                          disabled={!barcodeInput.trim()}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Ara
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Barkod Sonucu */}
                  {barcodeResult && (
                    <Card className={`border-2 ${barcodeResult.found ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                      <CardContent className="p-4">
                        {barcodeResult.found ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-green-800">{barcodeResult.stock_item?.name}</p>
                                <p className="text-sm text-green-600">
                                  Stok: {barcodeResult.stock_item?.quantity} {barcodeResult.stock_item?.unit || 'adet'} | 
                                  Lot: {barcodeResult.parsed?.lot_number || '-'} | 
                                  SKT: {barcodeResult.parsed?.expiry_date_parsed ? new Date(barcodeResult.parsed.expiry_date_parsed).toLocaleDateString('tr-TR') : '-'}
                                </p>
                              </div>
                              <Button 
                                onClick={() => handleAddMedication(barcodeResult.stock_item, barcodeResult.parsed)}
                                disabled={addingMedication}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Ekle
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="font-semibold text-amber-800">Stokta bulunamadı</p>
                            <p className="text-sm text-amber-600">
                              GTIN: {barcodeResult.parsed?.gtin || '-'} | 
                              Lot: {barcodeResult.parsed?.lot_number || '-'}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Input
                                placeholder="Ürün adını girin..."
                                value={newStockName}
                                onChange={(e) => setNewStockName(e.target.value)}
                                className="flex-1"
                              />
                              <Button 
                                onClick={handleCreateNewStock}
                                disabled={!newStockName.trim()}
                                variant="outline"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Yeni Ürün Ekle
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Manuel Arama */}
                  <div>
                    <Label>veya Manuel Ara</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="İlaç/malzeme adı..."
                        value={stockSearch}
                        onChange={(e) => {
                          setStockSearch(e.target.value);
                          handleStockSearch(e.target.value);
                        }}
                      />
                    </div>
                    {stockSearchResults.length > 0 && (
                      <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                        {stockSearchResults.map((item) => (
                          <div 
                            key={item.id}
                            className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                            onClick={() => handleAddMedication(item, null, selectedStockSource)}
                          >
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-500">
                                Stok: {item.quantity} | {item.location_detail || item.location}
                              </p>
                            </div>
                            <Plus className="h-4 w-4 text-gray-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* YENİ: Stok Kaynağı Seçici (Araç vs Carter) */}
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Stok Kaynağı Seç</Label>
                      {loadingAllStock && (
                        <span className="text-sm text-gray-500">Yükleniyor...</span>
                      )}
                    </div>
                    
                    {/* Kaynak Seçimi Butonları */}
                    <div className="flex gap-2">
                      <Button
                        variant={selectedStockSource === 'vehicle' ? 'default' : 'outline'}
                        onClick={() => setSelectedStockSource('vehicle')}
                        className={`flex-1 ${selectedStockSource === 'vehicle' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        Araç Stoğu
                        <Badge variant="secondary" className="ml-2">
                          {allStockData.vehicle?.length || 0}
                        </Badge>
                      </Button>
                      {allStockData.carter_location_id && (
                        <Button
                          variant={selectedStockSource === 'carter' ? 'default' : 'outline'}
                          onClick={() => setSelectedStockSource('carter')}
                          className={`flex-1 ${selectedStockSource === 'carter' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          {allStockData.carter_name || 'Carter'}
                          <Badge variant="secondary" className="ml-2">
                            {allStockData.carter?.length || 0}
                          </Badge>
                        </Button>
                      )}
                    </div>
                    
                    {/* Seçili Kaynaktaki Stok Listesi */}
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      {selectedStockSource === 'vehicle' ? (
                        allStockData.vehicle?.length > 0 ? (
                          allStockData.vehicle.map((item) => (
                            <div 
                              key={item.id}
                              className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b last:border-b-0"
                              onClick={() => handleAddMedication(item, null, 'vehicle')}
                            >
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">
                                  Stok: {item.quantity} {item.unit || 'adet'}
                                  {item.expiry_date && ` | SKT: ${new Date(item.expiry_date).toLocaleDateString('tr-TR')}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-blue-600 border-blue-300">
                                  Araç
                                </Badge>
                                <Plus className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">Araçta stok bulunamadı</p>
                        )
                      ) : (
                        allStockData.carter?.length > 0 ? (
                          allStockData.carter.map((item) => (
                            <div 
                              key={item.id}
                              className="p-3 hover:bg-amber-50 cursor-pointer flex justify-between items-center border-b last:border-b-0"
                              onClick={() => handleAddMedication(item, null, 'carter')}
                            >
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">
                                  Stok: {item.quantity} {item.unit || 'adet'}
                                  {item.expiry_date && ` | SKT: ${new Date(item.expiry_date).toLocaleDateString('tr-TR')}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  {allStockData.carter_name}
                                </Badge>
                                <Plus className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">{allStockData.carter_name || 'Carter'} stoğu boş</p>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Kullanılan Malzemeler Listesi */}
              <div className="mt-6">
                <h4 className="font-semibold mb-3 flex items-center">
                  <Pill className="h-4 w-4 mr-2" />
                  Vakada Kullanılan ({medications.length})
                </h4>
                {medications.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Henüz malzeme eklenmedi</p>
                ) : (
                  <div className="space-y-2">
                    {medications.map((med) => (
                      <div 
                        key={med.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{med.name}</p>
                            {/* Kaynak Bilgisi Badge */}
                            {med.source_type && (
                              <Badge 
                                variant="outline" 
                                className={med.source_type === 'carter' 
                                  ? 'text-amber-600 border-amber-300 bg-amber-50' 
                                  : 'text-blue-600 border-blue-300 bg-blue-50'
                                }
                              >
                                {med.source_type === 'carter' 
                                  ? (med.source_location_name || 'Carter')
                                  : 'Araç'
                                }
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            Miktar: {med.quantity} {med.unit || 'adet'} | 
                            {med.lot_number && ` Lot: ${med.lot_number} |`}
                            {med.expiry_date && ` SKT: ${new Date(med.expiry_date).toLocaleDateString('tr-TR')}`}
                          </p>
                          <p className="text-xs text-gray-400">
                            Ekleyen: {med.added_by_name} - {new Date(med.added_at).toLocaleString('tr-TR')}
                          </p>
                        </div>
                        {(user?.role === 'att' || user?.role === 'paramedik' || user?.role === 'hemsire') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveMedication(med.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Transfer ve Araç Bilgileri */}
        <TabsContent value="transfer" className="space-y-4">
          <Card>
            <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Ambulance className="h-5 w-5" />
                <span>Transfer Durumu</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {transferList.map((transfer, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`trans-${index}`}
                      checked={transfers[transfer] || false}
                      onCheckedChange={() => toggleTransfer(transfer)}
                      disabled={!canEditForm}
                    />
                    <Label htmlFor={`trans-${index}`} className="text-xs font-normal cursor-pointer">{transfer}</Label>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Refakatçı Sayısı</Label>
                  <Input 
                    type="number"
                    value={medicalForm.companions || ''}
                    onChange={(e) => updateFormField('companions', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>Ambulans Bekleme (Saat)</Label>
                  <Input 
                    type="number"
                    value={medicalForm.waitHours || ''}
                    onChange={(e) => updateFormField('waitHours', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>Ambulans Bekleme (Dakika)</Label>
                  <Input 
                    type="number"
                    value={medicalForm.waitMinutes || ''}
                    onChange={(e) => updateFormField('waitMinutes', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <ClipboardList className="h-5 w-5" />
                <span>Taşıt ve Protokol Bilgileri</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Başlangıç KM</Label>
                  <Input 
                    type="number"
                    value={vehicleInfo.startKm}
                    onChange={(e) => updateVehicleInfo('startKm', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>Bitiş KM</Label>
                  <Input 
                    type="number"
                    value={vehicleInfo.endKm}
                    onChange={(e) => updateVehicleInfo('endKm', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>112 Protokol Numarası</Label>
                  <Input 
                    value={vehicleInfo.protocol112}
                    onChange={(e) => updateVehicleInfo('protocol112', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
                <div>
                  <Label>Hastane Protokol/Dosya No</Label>
                  <Input 
                    value={vehicleInfo.hospitalProtocol}
                    onChange={(e) => updateVehicleInfo('hospitalProtocol', e.target.value)}
                    disabled={!canEditForm}
                  />
                </div>
              </div>
              
              <div>
                <Label>Vakayı Veren Kurum Bilgisi</Label>
                <Input 
                  value={vehicleInfo.referringInstitution}
                  onChange={(e) => updateVehicleInfo('referringInstitution', e.target.value)}
                  disabled={!canEditForm}
                />
              </div>
              
              <div>
                <Label>Gidiş-Dönüş</Label>
                <RadioGroup 
                  value={vehicleInfo.roundTrip}
                  onValueChange={(v) => updateVehicleInfo('roundTrip', v)}
                  disabled={!canEditForm}
                >
                  <div className="flex space-x-6 mt-2">
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

          {/* Ekip Bilgileri */}
          {caseData.assigned_team && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Truck className="h-5 w-5" />
                  <span>Atanan Ekip</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><span className="font-medium">Araç:</span> {caseData.assigned_team.vehicle_id}</p>
                <p className="text-xs text-gray-500">
                  Atanma: {new Date(caseData.assigned_team.assigned_at).toLocaleString('tr-TR')}
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Admin Actions */}
        {canManageCase && (
            <div className="flex space-x-2">
            {!caseData.assigned_team && (
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                    <Button>Ekip Ata</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ekip Ata</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Araç *</Label>
                      <Select value={assignForm.vehicle_id} onValueChange={(v) => setAssignForm(prev => ({...prev, vehicle_id: v}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Araç seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAssignTeam} className="w-full">Ata</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                  <Button variant="outline">Durum Güncelle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Durum Güncelle</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Yeni Durum *</Label>
                    <Select value={statusForm.status} onValueChange={(v) => setStatusForm(prev => ({...prev, status: v}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Durum seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Not</Label>
                    <Textarea
                      value={statusForm.note}
                      onChange={(e) => setStatusForm(prev => ({...prev, note: e.target.value}))}
                      placeholder="Opsiyonel not"
                    />
                  </div>
                  <Button onClick={handleUpdateStatus} className="w-full">Güncelle</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
        </TabsContent>

        {/* TAB 5: Onam Formları */}
        <TabsContent value="consent">
          <div className="space-y-6">
            {/* Başlık */}
            <div className="border-b pb-2">
              <h2 className="text-2xl font-semibold">Onam Formları</h2>
              <p className="text-sm text-gray-500">Hasta ve veli rıza formları</p>
            </div>
            
            {/* ==================== HASTA BİLGİLENDİRME ONAYI ==================== */}
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-lg text-blue-800">HASTA BİLGİLENDİRME ONAYI</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  Hastanın nakli sırasında ambulansta bulunmamın ambulans ekibinin görevini zorlaştırdığı gibi personel ve ambulans sürüş güvenliği açısından olumsuz sonuçlar doğurabileceği, meydana gelebilecek bir kazadan ve buna bağlı olarak ortaya çıkabilecek hukuki sorunlardan etkilenebileceğim, ambulansta bulunduğum sürece emniyet kemerini takmam gerektiği konusunda ambulans personeli tarafından ayrıntılı olarak bilgilendirildim. Ambulansa binmem durumunda ortaya çıkabilecek olası riskleri ve hukuki sorunları anladım. Buna rağmen hastanın ambulansla nakli sırasında, Hasta Hakları Yönetmeliği'nin 40. Ve Yataklı Tedavi Kurumları İşletme Yönetmeliği'nin 62. Maddesinde belirtilen Refakatçi kapsamında olmak üzere, kendi hür irademle ambulansta hastama refakatçi olarak ön kabinde bulunmayı, nakil sırasında ortaya çıkabilecek her türlü hukuksal sorunla ilgili, maddi, manevi ve hukuki tüm sorumluluk şahsıma ait olmak üzere kabul ediyorum. Healmedy (MHAcare Sağlık Turizm İnşaat Ticaret A.Ş.) hekimlerinin/ param ediklerinin ve çalışma ekibinin uygulayacağı, hastalığım ın teşhis ve tedavisi için gerekli olan ilaçları, tetkikleri, verilecek anestezi ilaçlarını / transportu bilincim yerinde olarak kabul ediyorum. Sağlık durum um a ilişkin, riskler ve komplikasyonlar tarafıma anlatılmıştır. Bu tedavi yerine uygulanabilecek bir başka yöntem in bulunup bulunmadığı konusunda da sağlık ekibim tarafından bilgilendirildim. Tedavi ya da transport sırasında oluşabilecek olumsuz gelişmelerden haberdar olarak tedavim in/transportum un yapılmasını onaylıyorum.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="font-semibold">HASTA/HASTA YAKINI* (YASAL TEMSİLCİ)</Label>
                    <Label className="block mt-2">ADI-SOYADI:</Label>
                    <Input 
                      value={inlineConsents.patient_info_consent_name}
                      onChange={(e) => updateInlineConsent('patient_info_consent_name', e.target.value)}
                      placeholder="Hasta veya yakınının adı soyadı"
                      className="mt-1"
                    />
                  </div>
                  <SignaturePad 
                    label="İMZA"
                    onSignature={(sig) => updateInlineConsent('patient_info_consent_signature', sig)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ==================== HASTANENİN HASTA REDDİ & HASTANIN HİZMET REDDİ ==================== */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* HASTANENİN HASTA REDDİ */}
              <Card className="border-2 border-red-200">
                <CardHeader className="bg-red-50">
                  <CardTitle className="text-lg text-red-800">HASTANENİN HASTA REDDİ</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <Input 
                      value={inlineConsents.hospital_rejection_reason}
                      onChange={(e) => updateInlineConsent('hospital_rejection_reason', e.target.value)}
                      placeholder="Ret nedeni..."
                      className="mb-2"
                    />
                    <p className="text-sm text-gray-600">
                      nedenlerle hastayı hastanemize kabul edemiyorum. Hastanın başka hastaneye nakil için gerekli stabilizasyon sağladım. Şu anda durumu başka bir kuruma nakli için uygundur.
                    </p>
                  </div>
                  <div>
                    <Label>KURUMUN / HASTANENİN ADI</Label>
                    <Input 
                      value={inlineConsents.hospital_rejection_institution}
                      onChange={(e) => updateInlineConsent('hospital_rejection_institution', e.target.value)}
                      placeholder="Kurum adı"
                    />
                  </div>
                  <div>
                    <Label>HEKİMİN ADI SOYADI</Label>
                    <Input 
                      value={inlineConsents.hospital_rejection_doctor_name}
                      onChange={(e) => updateInlineConsent('hospital_rejection_doctor_name', e.target.value)}
                      placeholder="Hekim adı soyadı"
                    />
                  </div>
                  <SignaturePad 
                    label="İMZA"
                    onSignature={(sig) => updateInlineConsent('hospital_rejection_doctor_signature', sig)}
                  />
                </CardContent>
              </Card>

              {/* HASTANIN HİZMET REDDİ */}
              <Card className="border-2 border-orange-200">
                <CardHeader className="bg-orange-50">
                  <CardTitle className="text-lg text-orange-800">HASTANIN HİZMET REDDİ</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Ambulansla gelen görevli bana hastanın hemen tedavisi / hastaneye nakli gerektiğini, aksi halde kötü sonuçlar doğurabileceğini anlayacağım şekilde ayrıntılı olarak anlattı. Buna rağmen tedaviyi /hasta naklini kabul etmiyorum.
                  </p>
                  <div>
                    <Label>HASTANIN / YAKININ ADI SOYADI</Label>
                    <Input 
                      value={inlineConsents.patient_rejection_name}
                      onChange={(e) => updateInlineConsent('patient_rejection_name', e.target.value)}
                      placeholder="Hasta veya yakının adı soyadı"
                    />
                  </div>
                  <SignaturePad 
                    label="İMZA"
                    onSignature={(sig) => updateInlineConsent('patient_rejection_signature', sig)}
                  />
                </CardContent>
              </Card>
            </div>

            {/* ==================== TESLİM İMZALARI ==================== */}
            <Card className="border-2 border-green-200">
              <CardHeader className="bg-green-50">
                <CardTitle className="text-lg text-green-800">TESLİM İMZALARI</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* HASTAYI TESLİM ALAN */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <Label className="font-semibold text-gray-700">HASTAYI TESLİM ALANIN ÜNVANI ADI SOYADI</Label>
                    <Input 
                      value={inlineConsents.receiver_title_name}
                      onChange={(e) => updateInlineConsent('receiver_title_name', e.target.value)}
                      placeholder="Ünvan, Ad Soyad"
                    />
                    <SignaturePad 
                      label="İMZA"
                      onSignature={(sig) => updateInlineConsent('receiver_signature', sig)}
                    />
                  </div>

                  {/* DOKTOR/PARAMEDİK */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <Label className="font-semibold text-gray-700">DOKTOR/PARAMEDİK ADI SOYADI</Label>
                    <Input 
                      value={inlineConsents.doctor_paramedic_name || user?.name || ''}
                      onChange={(e) => updateInlineConsent('doctor_paramedic_name', e.target.value)}
                      placeholder="Ad Soyad"
                    />
                    <SignaturePad 
                      label="İMZA"
                      onSignature={(sig) => updateInlineConsent('doctor_paramedic_signature', sig)}
                    />
                  </div>

                  {/* SAĞLIK PERSONELİ */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <Label className="font-semibold text-gray-700">SAĞLIK PERSONELİ ADI SOYADI</Label>
                    <Input 
                      value={inlineConsents.health_personnel_name || user?.name || ''}
                      onChange={(e) => updateInlineConsent('health_personnel_name', e.target.value)}
                      placeholder="Ad Soyad"
                    />
                    <SignaturePad 
                      label="İMZA"
                      onSignature={(sig) => updateInlineConsent('health_personnel_signature', sig)}
                    />
                  </div>

                  {/* SÜRÜCÜ/PİLOT */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <Label className="font-semibold text-gray-700">SÜRÜCÜ/PİLOT ADI SOYADI</Label>
                    <Input 
                      value={inlineConsents.driver_pilot_name}
                      onChange={(e) => updateInlineConsent('driver_pilot_name', e.target.value)}
                      placeholder="Ad Soyad"
                    />
                    <SignaturePad 
                      label="İMZA"
                      onSignature={(sig) => updateInlineConsent('driver_pilot_signature', sig)}
                    />
                  </div>
                </div>
                
                {/* Kaydet Butonu */}
                <div className="flex justify-end mt-6">
                  <Button 
                    onClick={saveInlineConsents}
                    disabled={savingConsents}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savingConsents ? 'Kaydediliyor...' : 'Tüm İmzaları Kaydet'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ==================== DİĞER ONAM FORMLARI (Mevcut Kartlar) ==================== */}
            <div className="border-t pt-4 mt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Diğer Onam Formları</h3>
            </div>
            
            {/* Form Kartları Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {consentFormsList.map((form) => {
                const Icon = form.icon;
                return (
                  <Card 
                    key={form.id} 
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-gray-300"
                    onClick={() => openConsentForm(form.id)}
                  >
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-full ${form.bgColor} flex items-center justify-center ${form.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-sm leading-tight">{form.title}</h3>
                        <p className="text-xs text-gray-600">{form.description}</p>
                        <Button variant="outline" size="sm" className="w-full mt-2">
                          <FileText className="h-4 w-4 mr-2" />
                          Formu Aç
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Onam Formu Dialog */}
          <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
            <DialogContent className="max-w-5xl max-h-[95vh]">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {consentFormsList.find(f => f.id === selectedConsentForm)?.title}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[80vh] pr-4">
                {selectedConsentForm && renderConsentFormContent(selectedConsentForm)}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 6: Geçmiş */}
        <TabsContent value="history">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Durum Geçmişi</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {caseData.status_history.map((item, index) => {
              // Eski kayıtlar için users listesinden isim bul
              const userName = item.updated_by_name || 
                (item.updated_by && users.find(u => (u.id || u._id) === item.updated_by)?.name) ||
                'Sistem';
              const userRole = item.updated_by_role || 
                (item.updated_by && users.find(u => (u.id || u._id) === item.updated_by)?.role);
              
              return (
                <div key={index} className="flex space-x-4 items-start border-l-2 border-gray-200 pl-4 pb-4">
                  <div className="min-w-[140px] text-sm text-gray-500">
                    {new Date(item.updated_at).toLocaleString('tr-TR')}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{statusLabels[item.status] || item.status}</p>
                    {item.note && <p className="text-sm text-gray-600">{item.note}</p>}
                    {/* Kullanıcı bilgisi */}
                    <p className="text-xs text-gray-400 mt-1">
                      {userRole && (
                        <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded mr-2 uppercase text-[10px] font-medium">
                          {userRole}
                        </span>
                      )}
                      {userName}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CaseDetail;

