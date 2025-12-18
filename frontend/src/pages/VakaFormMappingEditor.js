import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { 
  ArrowLeft, Save, Search, X, Grid3X3, FileSpreadsheet,
  User, Clock, MapPin, Phone, Heart, AlertCircle, Truck,
  FileText, Pill, Package, Droplet, Settings, PenTool, Eye,
  Image, Upload, Trash2, RefreshCw, CheckSquare
} from 'lucide-react';

const VakaFormMappingEditor = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mappingData, setMappingData] = useState(null);
  const [dataMappings, setDataMappings] = useState({});
  const [templateCells, setTemplateCells] = useState({});  // Şablondaki orijinal değerler
  const [logoUrl, setLogoUrl] = useState('');
  const [logoCell, setLogoCell] = useState('A1');
  
  const [activeCell, setActiveCell] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // V3 Excel gerçek boyutları: 79 satır, 20 sütun (A-T)
  const maxRow = 79;
  const maxCol = 20;

  const fieldCategories = [
    {
      id: 'logo',
      name: '🖼️ Logo',
      icon: Image,
      color: 'purple',
      fields: [{ key: '__LOGO__', label: 'Firma Logosu' }]
    },
    // ==================== TEMEL BİLGİLER (V3) ====================
    {
      id: 'temel',
      name: 'Temel Bilgiler',
      icon: FileText,
      color: 'blue',
      fields: [
        { key: 'atn_no', label: 'ATN NO' },
        { key: 'caseNumber', label: 'Protokol No' },
        { key: 'caseDate', label: 'Tarih' },
        { key: 'caseCode', label: 'Kodu' },
        { key: 'vehiclePlate', label: 'Araç Plakası' },
        { key: 'stationName', label: 'İstasyon' },
        { key: 'referringInstitution', label: 'Vakayı Veren Kurum' },
        { key: 'startKm', label: 'Başlangıç KM' },
        { key: 'endKm', label: 'Bitiş KM' },
        { key: 'totalKm', label: 'Toplam KM' }
      ]
    },
    // ==================== SAATLER (V3) ====================
    {
      id: 'saatler',
      name: 'Saatler',
      icon: Clock,
      color: 'amber',
      fields: [
        { key: 'callTime', label: 'Çağrı Saati' },
        { key: 'arrivalSceneTime', label: 'Olay Yerine Varış' },
        { key: 'arrivalPatientTime', label: 'Hastaya Varış' },
        { key: 'departureSceneTime', label: 'Olay Yerinden Ayrılış' },
        { key: 'arrivalHospitalTime', label: 'Hastaneye Varış' },
        { key: 'returnStationTime', label: 'İstasyona Dönüş' }
      ]
    },
    // ==================== HASTA BİLGİLERİ (V3) ====================
    {
      id: 'hasta',
      name: 'Hasta Bilgileri',
      icon: User,
      color: 'teal',
      fields: [
        { key: 'patientName', label: 'Hasta Ad Soyad' },
        { key: 'patientTcNo', label: 'TC Kimlik No' },
        { key: 'patientAge', label: 'Yaş' },
        { key: 'patientPhone', label: 'Telefon' },
        { key: 'patientHomeAddress', label: 'İkamet Adresi' },
        { key: 'patientPickupAddress', label: 'Alındığı Adres' },
        { key: 'patientComplaint', label: 'Hastanın Şikayeti' },
        { key: 'chronicDiseases', label: 'Kronik Hastalıklar' }
      ]
    },
    // ==================== CİNSİYET CHECKBOX (V3) ====================
    {
      id: 'checkbox_cinsiyet',
      name: 'Cinsiyet (Checkbox)',
      icon: User,
      color: 'pink',
      isCheckbox: true,
      fields: [
        { key: 'gender.erkek', label: '☑ Erkek' },
        { key: 'gender.kadin', label: '☑ Kadın' }
      ]
    },
    // ==================== DURUMU / TRİYAJ (V3) ====================
    {
      id: 'checkbox_triyaj',
      name: 'Durumu (Triyaj)',
      icon: AlertCircle,
      color: 'red',
      isCheckbox: true,
      fields: [
        { key: 'priority.kirmizi_kod', label: '☑ Kırmızı Kod' },
        { key: 'priority.sari_kod', label: '☑ Sarı Kod' },
        { key: 'priority.yesil_kod', label: '☑ Yeşil Kod' },
        { key: 'priority.siyah_kod', label: '☑ Siyah Kod' },
        { key: 'priority.sosyal_endikasyon', label: '☑ Sosyal Endikasyon' }
      ]
    },
    // ==================== ÇAĞRI TİPİ (V3) ====================
    {
      id: 'checkbox_cagri_tipi',
      name: 'Çağrı Tipi (Checkbox)',
      icon: CheckSquare,
      color: 'orange',
      isCheckbox: true,
      fields: [
        { key: 'callType.telsiz', label: '☑ Telsiz' },
        { key: 'callType.telefon', label: '☑ Telefon' },
        { key: 'callType.diger', label: '☑ Diğer' }
      ]
    },
    // ==================== ÇAĞRI NEDENİ (V3 - TÜM SEÇENEKLER) ====================
    {
      id: 'checkbox_cagri_nedeni',
      name: 'Çağrı Nedeni (Checkbox)',
      icon: CheckSquare,
      color: 'orange',
      isCheckbox: true,
      fields: [
        { key: 'callReason.kesici_delici', label: '☑ Kesici-Delici' },
        { key: 'callReason.trafik_kaz', label: '☑ Trafik Kazası' },
        { key: 'callReason.diger_kaza', label: '☑ Diğer Kaza' },
        { key: 'callReason.is_kazasi', label: '☑ İş Kazası' },
        { key: 'callReason.yangin', label: '☑ Yangın' },
        { key: 'callReason.intihar', label: '☑ İntihar' },
        { key: 'callReason.kimyasal', label: '☑ Kimyasal' },
        { key: 'callReason.medikal', label: '☑ Medikal' },
        { key: 'callReason.elektrik_carp', label: '☑ Elektrik Çarpması' },
        { key: 'callReason.atesli_silah', label: '☑ Ateşli Silah' },
        { key: 'callReason.bogulma', label: '☑ Boğulma' },
        { key: 'callReason.allerji', label: '☑ Allerji' },
        { key: 'callReason.dusme', label: '☑ Düşme' },
        { key: 'callReason.alkol_ilac', label: '☑ Alkol/İlaç' },
        { key: 'callReason.kunt_trav', label: '☑ Künt Travma' },
        { key: 'callReason.yanik', label: '☑ Yanık' },
        { key: 'callReason.lpg', label: '☑ LPG' },
        { key: 'callReason.tedbir', label: '☑ Tedbir' },
        { key: 'callReason.protokol', label: '☑ Protokol' }
      ]
    },
    // ==================== OLAY YERİ (V3 - TÜM SEÇENEKLER) ====================
    {
      id: 'checkbox_olay_yeri',
      name: 'Olay Yeri (Checkbox)',
      icon: MapPin,
      color: 'indigo',
      isCheckbox: true,
      fields: [
        { key: 'scene.ev', label: '☑ Ev' },
        { key: 'scene.aracta', label: '☑ Araçta' },
        { key: 'scene.stadyum', label: '☑ Stadyum' },
        { key: 'scene.saglik_kurumu', label: '☑ Sağlık Kurumu' },
        { key: 'scene.yaya', label: '☑ Yaya' },
        { key: 'scene.buro', label: '☑ Büro' },
        { key: 'scene.huzurevi', label: '☑ Huzurevi' },
        { key: 'scene.resmi_daire', label: '☑ Resmi Daire' },
        { key: 'scene.suda', label: '☑ Suda' },
        { key: 'scene.fabrika', label: '☑ Fabrika' },
        { key: 'scene.cami', label: '☑ Cami' },
        { key: 'scene.egitim_kurumu', label: '☑ Eğitim Kurumu' },
        { key: 'scene.arazi', label: '☑ Arazi' },
        { key: 'scene.sokak', label: '☑ Sokak' },
        { key: 'scene.yurt', label: '☑ Yurt' },
        { key: 'scene.spor_salonu', label: '☑ Spor Salonu' }
      ]
    },
    // ==================== İLK MUAYENE - PUPİLLER (V3) ====================
    {
      id: 'checkbox_pupil',
      name: 'Pupiller (Checkbox)',
      icon: Eye,
      color: 'indigo',
      isCheckbox: true,
      fields: [
        { key: 'pupil.normal', label: '☑ Normal' },
        { key: 'pupil.miyotik', label: '☑ Miyotik' },
        { key: 'pupil.midriatik', label: '☑ Midriatik' },
        { key: 'pupil.anizokorik', label: '☑ Anizokorik' },
        { key: 'pupil.reak_yok', label: '☑ Reaksiyon Yok' },
        { key: 'pupil.fiks_dilate', label: '☑ Fiks Dilate' }
      ]
    },
    // ==================== İLK MUAYENE - DERİ (V3) ====================
    {
      id: 'checkbox_deri',
      name: 'Deri (Checkbox)',
      icon: Eye,
      color: 'indigo',
      isCheckbox: true,
      fields: [
        { key: 'skin.normal', label: '☑ Normal' },
        { key: 'skin.soluk', label: '☑ Soluk' },
        { key: 'skin.siyanotik', label: '☑ Siyanotik' },
        { key: 'skin.hiperemik', label: '☑ Hiperemik' },
        { key: 'skin.ikterik', label: '☑ İkterik' },
        { key: 'skin.terli', label: '☑ Terli' }
      ]
    },
    // ==================== VİTAL BULGULAR (V3) ====================
    {
      id: 'vital_bulgular',
      name: 'Vital Bulgular',
      icon: Heart,
      color: 'red',
      fields: [
        { key: 'vital1.saat', label: '1. Vital Saat' },
        { key: 'vital1.nabiz', label: '1. Nabız (dk)' },
        { key: 'vital1.tansiyon', label: '1. Tansiyon (mmHg)' },
        { key: 'vital1.solunum', label: '1. Solunum (dk)' },
        { key: 'vital1.spo2', label: '1. SpO2 (%)' },
        { key: 'vital2.saat', label: '2. Vital Saat' },
        { key: 'vital2.nabiz', label: '2. Nabız (dk)' },
        { key: 'vital2.tansiyon', label: '2. Tansiyon' },
        { key: 'vital2.solunum', label: '2. Solunum' },
        { key: 'vital2.spo2', label: '2. SpO2' },
        { key: 'kan_sekeri', label: 'Kan Şekeri' },
        { key: 'bloodSugar', label: 'Kan Şekeri (Alt.)' },
        { key: 'ates', label: 'Ateş' },
        { key: 'bodyTemp', label: 'Vücut Sıcaklığı (Alt.)' }
      ]
    },
    // ==================== VİTAL - NABIZ TİPİ (V3) ====================
    {
      id: 'checkbox_nabiz',
      name: 'Nabız Tipi (Checkbox)',
      icon: Heart,
      color: 'red',
      isCheckbox: true,
      fields: [
        { key: 'pulse.duzenli', label: '☑ Düzenli' },
        { key: 'pulse.ritmik', label: '☑ Ritmik' },
        { key: 'pulse.filiform', label: '☑ Filiform' },
        { key: 'pulse.alinmiyor', label: '☑ Alınmıyor' }
      ]
    },
    // ==================== VİTAL - SOLUNUM TİPİ (V3) ====================
    {
      id: 'checkbox_solunum',
      name: 'Solunum Tipi (Checkbox)',
      icon: Heart,
      color: 'red',
      isCheckbox: true,
      fields: [
        { key: 'resp.duzenli', label: '☑ Düzenli' },
        { key: 'resp.duzensiz', label: '☑ Düzensiz' },
        { key: 'resp.dispne', label: '☑ Dispne' },
        { key: 'resp.yok', label: '☑ Yok' }
      ]
    },
    // ==================== GLASGOW KOMA SKALASI (V3) ====================
    {
      id: 'gks',
      name: 'Glasgow Koma Skalası',
      icon: AlertCircle,
      color: 'orange',
      fields: [{ key: 'gcsTotal', label: 'GKS Toplam Puan' }]
    },
    {
      id: 'checkbox_gks_motor',
      name: 'GKS Motor (Checkbox)',
      icon: AlertCircle,
      color: 'orange',
      isCheckbox: true,
      fields: [
        { key: 'gcsMotor.6', label: '☑ 6 - Emre İtaat' },
        { key: 'gcsMotor.5', label: '☑ 5 - Ağrıyı Lokalize' },
        { key: 'gcsMotor.4', label: '☑ 4 - Ağrıdan Kaçınma' },
        { key: 'gcsMotor.3', label: '☑ 3 - Fleksör Yanıt' },
        { key: 'gcsMotor.2', label: '☑ 2 - Ekstansör Yanıt' },
        { key: 'gcsMotor.1', label: '☑ 1 - Yanıt Yok' }
      ]
    },
    {
      id: 'checkbox_gks_verbal',
      name: 'GKS Verbal (Checkbox)',
      icon: AlertCircle,
      color: 'orange',
      isCheckbox: true,
      fields: [
        { key: 'gcsVerbal.5', label: '☑ 5 - Oriente' },
        { key: 'gcsVerbal.4', label: '☑ 4 - Konfüze' },
        { key: 'gcsVerbal.3', label: '☑ 3 - Uygunsuz Sözler' },
        { key: 'gcsVerbal.2', label: '☑ 2 - Anlamsız Bağırma' },
        { key: 'gcsVerbal.1', label: '☑ 1 - Yanıt Yok' }
      ]
    },
    {
      id: 'checkbox_gks_goz',
      name: 'GKS Göz Açma (Checkbox)',
      icon: AlertCircle,
      color: 'orange',
      isCheckbox: true,
      fields: [
        { key: 'gcsEye.4', label: '☑ 4 - Spontan' },
        { key: 'gcsEye.3', label: '☑ 3 - Sesle' },
        { key: 'gcsEye.2', label: '☑ 2 - Ağrıyla' },
        { key: 'gcsEye.1', label: '☑ 1 - Yanıt Yok' }
      ]
    },
    // ==================== ÖN TANI VE AÇIKLAMALAR (V3) ====================
    {
      id: 'tani',
      name: 'Ön Tanı ve Açıklamalar',
      icon: FileText,
      color: 'purple',
      fields: [
        { key: 'on_tani', label: 'Ön Tanı' },
        { key: 'aciklamalar', label: 'Açıklamalar' }
      ]
    },
    // ==================== SONUÇ (V3 - TÜM SEÇENEKLER) ====================
    {
      id: 'sonuc',
      name: 'Sonuç Bilgileri',
      icon: Truck,
      color: 'emerald',
      fields: [
        { key: 'transferHospital', label: 'Nakledilen Hastane' },
        { key: 'crashVehicle1', label: 'Kazaya Karışan Araç 1' },
        { key: 'crashVehicle2', label: 'Kazaya Karışan Araç 2' },
        { key: 'crashVehicle3', label: 'Kazaya Karışan Araç 3' },
        { key: 'crashVehicle4', label: 'Kazaya Karışan Araç 4' },
        { key: 'cprStartTime', label: 'CPR Başlama Zamanı' },
        { key: 'cprStopTime', label: 'CPR Bırakma Zamanı' },
        { key: 'cprStopReason', label: 'Bırakma Nedeni' },
        { key: 'cprPerformer', label: 'CPR Uygulayan' }
      ]
    },
    {
      id: 'checkbox_sonuc',
      name: 'Sonuç (Checkbox)',
      icon: CheckSquare,
      color: 'emerald',
      isCheckbox: true,
      fields: [
        { key: 'outcome.yerinde_mudahale', label: '☑ Yerinde Müdahale' },
        { key: 'outcome.ex_terinde_birakildi', label: '☑ Ex Terinde Bırakıldı' },
        { key: 'outcome.baska_aracla_nakil', label: '☑ Başka Araçla Nakil' },
        { key: 'outcome.hastaneye_nakil', label: '☑ Hastaneye Nakil' },
        { key: 'outcome.ex_morga_nakil', label: '☑ Ex Morga Nakil' },
        { key: 'outcome.tlf_bsk_aracla_nakil', label: '☑ Tlf.la Bşk Araçla Nakil' },
        { key: 'outcome.hastaneler_arasi', label: '☑ Hastaneler Arası Nakil' },
        { key: 'outcome.nakil_reddi', label: '☑ Nakil Reddi' },
        { key: 'outcome.asilsiz_ihbar', label: '☑ Asılsız İhbar' },
        { key: 'outcome.tibbi_tetkik', label: '☑ Tıbbi Tetkik İçin Nakil' },
        { key: 'outcome.diger_ulasilan', label: '☑ Diğer Ulaşılan' },
        { key: 'outcome.yaralanan_yok', label: '☑ Yaralanan Yok' },
        { key: 'outcome.eve_nakil', label: '☑ Eve Nakil' },
        { key: 'outcome.gorev_iptali', label: '☑ Görev İptali' },
        { key: 'outcome.olay_yerinde_bekleme', label: '☑ Olay Yerinde Bekleme' }
      ]
    },
    {
      id: 'checkbox_mesafe',
      name: 'Mesafe (Checkbox)',
      icon: Truck,
      color: 'emerald',
      isCheckbox: true,
      fields: [
        { key: 'distance.ilce_ici', label: '☑ İlçe İçi' },
        { key: 'distance.ilce_disi', label: '☑ İlçe Dışı' },
        { key: 'distance.il_disi', label: '☑ İl Dışı' }
      ]
    },
    {
      id: 'checkbox_adli',
      name: 'Adli Vaka (Checkbox)',
      icon: AlertCircle,
      color: 'red',
      isCheckbox: true,
      fields: [
        { key: 'forensic.evet', label: '☑ Adli Vaka Evet' },
        { key: 'forensic.hayir', label: '☑ Adli Vaka Hayır' }
      ]
    },
    {
      id: 'checkbox_cpr',
      name: 'CPR (Checkbox)',
      icon: Heart,
      color: 'red',
      isCheckbox: true,
      fields: [
        { key: 'cpr.yapildi', label: '☑ CPR Yapıldı' }
      ]
    },
    // ==================== ÜCRET ====================
    {
      id: 'ucret',
      name: 'Ücret',
      icon: FileText,
      color: 'yellow',
      fields: [
        { key: 'ambulance_fee.cb', label: '☑ Ş.I. Ambulans Ücreti' },
        { key: 'ambulance_fee.adet', label: '# Ambulans Ücreti' }
      ]
    },
    // ==================== GENEL MÜDAHALE (V3) ====================
    {
      id: 'genel_mudahale',
      name: 'Genel Müdahale İşlemleri',
      icon: Settings,
      color: 'violet',
      isCheckbox: true,
      fields: [
        { key: 'proc.muayene_acil.cb', label: '☑ Muayene (Acil)' },
        { key: 'proc.muayene_acil.adet', label: '# Muayene Adet' },
        { key: 'proc.enjeksiyon_im.cb', label: '☑ Enjeksiyon IM' },
        { key: 'proc.enjeksiyon_im.adet', label: '# Enjeksiyon IM Adet' },
        { key: 'proc.enjeksiyon_iv.cb', label: '☑ Enjeksiyon IV' },
        { key: 'proc.enjeksiyon_iv.adet', label: '# Enjeksiyon IV Adet' },
        { key: 'proc.enjeksiyon_sc.cb', label: '☑ Enjeksiyon SC' },
        { key: 'proc.enjeksiyon_sc.adet', label: '# Enjeksiyon SC Adet' },
        { key: 'proc.iv_ilac.cb', label: '☑ I.V. İlaç Uygulaması' },
        { key: 'proc.iv_ilac.adet', label: '# I.V. İlaç Adet' },
        { key: 'proc.damar_yolu.cb', label: '☑ Damar Yolu Açılması' },
        { key: 'proc.damar_yolu.adet', label: '# Damar Yolu Adet' },
        { key: 'proc.sutur.cb', label: '☑ Sütür (küçük)' },
        { key: 'proc.sutur.adet', label: '# Sütür Adet' },
        { key: 'proc.mesane_sondasi.cb', label: '☑ Mesane Sondası Takılması' },
        { key: 'proc.mesane_sondasi.adet', label: '# Mesane Sondası Adet' },
        { key: 'proc.mide_yikama.cb', label: '☑ Mide Yıkanması' },
        { key: 'proc.mide_yikama.adet', label: '# Mide Yıkama Adet' },
        { key: 'proc.pansuman_kucuk.cb', label: '☑ Pansuman (küçük)' },
        { key: 'proc.pansuman_kucuk.adet', label: '# Pansuman Küçük Adet' },
        { key: 'proc.apse.cb', label: '☑ Apse Açmak' },
        { key: 'proc.apse.adet', label: '# Apse Adet' },
        { key: 'proc.yabanci_cisim.cb', label: '☑ Yabancı Cisim Çıkartılması' },
        { key: 'proc.yabanci_cisim.adet', label: '# Yabancı Cisim Adet' },
        { key: 'proc.yanik_pansuman_kucuk.cb', label: '☑ Yanık Pansuman (küçük)' },
        { key: 'proc.yanik_pansuman_kucuk.adet', label: '# Yanık Küçük Adet' },
        { key: 'proc.yanik_pansuman_orta.cb', label: '☑ Yanık Pansuman (orta)' },
        { key: 'proc.yanik_pansuman_orta.adet', label: '# Yanık Orta Adet' },
        { key: 'proc.ng_sonda.cb', label: '☑ NG Sonda Takma' },
        { key: 'proc.ng_sonda.adet', label: '# NG Sonda Adet' },
        { key: 'proc.kulak_buson.cb', label: '☑ Kulaktan Buşon Temizliği' },
        { key: 'proc.kulak_buson.adet', label: '# Kulak Buşon Adet' },
        { key: 'proc.kol_atel.cb', label: '☑ Kol Atel (kısa)' },
        { key: 'proc.kol_atel.adet', label: '# Kol Atel Adet' },
        { key: 'proc.bacak_atel.cb', label: '☑ Bacak Atel (kısa)' },
        { key: 'proc.bacak_atel.adet', label: '# Bacak Atel Adet' },
        { key: 'proc.cilt_traksiyon.cb', label: '☑ Cilt Traksiyonu Uygulaması' },
        { key: 'proc.cilt_traksiyon.adet', label: '# Cilt Traksiyon Adet' },
        { key: 'proc.servikal_collar.cb', label: '☑ Servikal Collar Uygulaması' },
        { key: 'proc.servikal_collar.adet', label: '# Servikal Collar Adet' },
        { key: 'proc.travma_yelegi.cb', label: '☑ Travma Yeleği' },
        { key: 'proc.travma_yelegi.adet', label: '# Travma Yeleği Adet' },
        { key: 'proc.vakum_sedye.cb', label: '☑ Vakum Sedye Uygulaması' },
        { key: 'proc.vakum_sedye.adet', label: '# Vakum Sedye Adet' },
        { key: 'proc.sirt_tahtasi.cb', label: '☑ Sırt Tahtası Uygulaması' },
        { key: 'proc.sirt_tahtasi.adet', label: '# Sırt Tahtası Adet' }
      ]
    },
    // ==================== DOLAŞIM DESTEĞİ ====================
    {
      id: 'dolasim_destegi',
      name: 'Dolaşım Desteği',
      icon: Heart,
      color: 'red',
      isCheckbox: true,
      fields: [
        { key: 'circ.cpr.cb', label: '☑ CPR (Resüsitasyon)' },
        { key: 'circ.cpr.adet', label: '# CPR Adet' },
        { key: 'circ.ekg.cb', label: '☑ EKG Uygulaması' },
        { key: 'circ.ekg.adet', label: '# EKG Adet' },
        { key: 'circ.defibrilasyon.cb', label: '☑ Defibrilasyon' },
        { key: 'circ.defibrilasyon.adet', label: '# Defibrilasyon Adet' },
        { key: 'circ.kardiyoversiyon.cb', label: '☑ Kardiyoversiyon' },
        { key: 'circ.monitorizasyon.cb', label: '☑ Monitörizasyon' },
        { key: 'circ.kanama_kontrolu.cb', label: '☑ Kanama Kontrolü' },
        { key: 'circ.cut_down.cb', label: '☑ Cut Down' }
      ]
    },
    // ==================== HAVA YOLU (V3) ====================
    {
      id: 'hava_yolu',
      name: 'Hava Yolu İşlemleri',
      icon: Settings,
      color: 'cyan',
      isCheckbox: true,
      fields: [
        { key: 'airway.balon_valf.cb', label: '☑ Balon Valf Maske' },
        { key: 'airway.balon_valf.adet', label: '# Balon Valf Adet' },
        { key: 'airway.aspirasyon.cb', label: '☑ Aspirasyon Uygulaması' },
        { key: 'airway.aspirasyon.adet', label: '# Aspirasyon Adet' },
        { key: 'airway.orofaringeal.cb', label: '☑ Orofaringeal Tüp Uygulaması' },
        { key: 'airway.orofaringeal.adet', label: '# Orofaringeal Adet' },
        { key: 'airway.entubasyon.cb', label: '☑ Endotrakeal Entübasyon' },
        { key: 'airway.entubasyon.adet', label: '# Entübasyon Adet' },
        { key: 'airway.mekanik_vent.cb', label: '☑ Mekanik Ventilasyon (CPAP-BIPAP)' },
        { key: 'airway.mekanik_vent.adet', label: '# Mekanik Vent Adet' },
        { key: 'airway.oksijen.cb', label: '☑ Oksijen İnhalasyon Tedavisi' },
        { key: 'airway.oksijen.adet', label: '# Oksijen Adet' }
      ]
    },
    // ==================== DİĞER İŞLEMLER (V3) ====================
    {
      id: 'diger_islemler',
      name: 'Diğer İşlemler',
      icon: Settings,
      color: 'gray',
      isCheckbox: true,
      fields: [
        { key: 'other.normal_dogum.cb', label: '☑ Normal Doğum' },
        { key: 'other.normal_dogum.adet', label: '# Normal Doğum Adet' },
        { key: 'other.kan_sekeri.cb', label: '☑ Kan Şekeri Ölçümü' },
        { key: 'other.kan_sekeri.adet', label: '# Kan Şekeri Adet' },
        { key: 'other.lokal_anestezi.cb', label: '☑ Lokal Anestezi' },
        { key: 'other.lokal_anestezi.adet', label: '# Lokal Anestezi Adet' },
        { key: 'other.tirnak_avulsiyon.cb', label: '☑ Tırnak Avülsiyonu' },
        { key: 'other.tirnak_avulsiyon.adet', label: '# Tırnak Avülsiyon Adet' },
        { key: 'other.transkutan_pao2.cb', label: '☑ Transkutan PaO2 Ölçümü' },
        { key: 'other.transkutan_pao2.adet', label: '# Transkutan Adet' },
        { key: 'other.debritman.cb', label: '☑ Debritman Alınması' },
        { key: 'other.debritman.adet', label: '# Debritman Adet' },
        { key: 'other.sutur_alinmasi.cb', label: '☑ Sütür Alınması' },
        { key: 'other.sutur_alinmasi.adet', label: '# Sütür Alınması Adet' }
      ]
    },
    // ==================== YENİDOĞAN (V3) ====================
    {
      id: 'yenidogan',
      name: 'Yenidoğan İşlemleri',
      icon: User,
      color: 'pink',
      isCheckbox: true,
      fields: [
        { key: 'newborn.transport_kuvoz.cb', label: '☑ Transport Küvözi ile Nakil' },
        { key: 'newborn.transport_kuvoz.adet', label: '# Transport Küvöz Adet' },
        { key: 'newborn.canlandirma.cb', label: '☑ Yenidoğan Canlandırma' },
        { key: 'newborn.canlandirma.adet', label: '# Yenidoğan Canlandırma Adet' },
        { key: 'newborn.im_enjeksiyon.cb', label: '☑ Yenidoğan I.M. Enjeksiyon' },
        { key: 'newborn.im_enjeksiyon.adet', label: '# Yenidoğan IM Adet' },
        { key: 'newborn.iv_enjeksiyon.cb', label: '☑ Yenidoğan I.V. Enjeksiyon' },
        { key: 'newborn.iv_enjeksiyon.adet', label: '# Yenidoğan IV Adet' },
        { key: 'newborn.iv_mayi.cb', label: '☑ Yenidoğan I.V. Mayi Takılması' },
        { key: 'newborn.iv_mayi.adet', label: '# Yenidoğan Mayi Adet' },
        { key: 'newborn.entubasyon.cb', label: '☑ Yenidoğan Entübasyonu' },
        { key: 'newborn.entubasyon.adet', label: '# Yenidoğan Entübasyon Adet' }
      ]
    },
    // ==================== SIVI TEDAVİSİ (V3) ====================
    {
      id: 'sivi_tedavisi',
      name: 'Sıvı Tedavisi',
      icon: Droplet,
      color: 'blue',
      isCheckbox: true,
      fields: [
        { key: 'fluid.nacl_250.cb', label: '☑ %0.9 NaCl 250 cc' },
        { key: 'fluid.nacl_250.adet', label: '# NaCl 250 Adet' },
        { key: 'fluid.nacl_500.cb', label: '☑ %0.9 NaCl 500 cc' },
        { key: 'fluid.nacl_500.adet', label: '# NaCl 500 Adet' },
        { key: 'fluid.nacl_100.cb', label: '☑ %0.9 NaCl 100 cc' },
        { key: 'fluid.nacl_100.adet', label: '# NaCl 100 Adet' },
        { key: 'fluid.dextroz_500.cb', label: '☑ %5 Dextroz 500 cc' },
        { key: 'fluid.dextroz_500.adet', label: '# Dextroz 500 Adet' },
        { key: 'fluid.mannitol_500.cb', label: '☑ %20 Mannitol 500 cc' },
        { key: 'fluid.mannitol_500.adet', label: '# Mannitol 500 Adet' },
        { key: 'fluid.isolyte_p.cb', label: '☑ İsolyte P 500 cc' },
        { key: 'fluid.isolyte_p.adet', label: '# İsolyte P Adet' },
        { key: 'fluid.isolyte_s.cb', label: '☑ İsolyte S 500 cc' },
        { key: 'fluid.isolyte_s.adet', label: '# İsolyte S Adet' },
        { key: 'fluid.dengeleyici.cb', label: '☑ %10 Dengeleyici Elektrolit 500 cc' },
        { key: 'fluid.dengeleyici.adet', label: '# Dengeleyici Adet' },
        { key: 'fluid.ringer_laktat.cb', label: '☑ Laktatlı Ringer 500 cc' },
        { key: 'fluid.ringer_laktat.adet', label: '# Ringer Adet' }
      ]
    },
    // ==================== İLAÇLAR ====================
    {
      id: 'ilaclar',
      name: 'Kullanılan İlaçlar',
      icon: Pill,
      color: 'green',
      fields: [
        { key: 'med.arveles.cb', label: '☑ Arveles amp.' },
        { key: 'med.arveles.adet', label: '# Arveles Adet' },
        { key: 'med.dikloron.cb', label: '☑ Dikloron amp.' },
        { key: 'med.dikloron.adet', label: '# Dikloron Adet' },
        { key: 'med.spazmolitik.cb', label: '☑ Spazmolitik amp.' },
        { key: 'med.adrenalin_05.cb', label: '☑ Adrenalin 0.5 mg' },
        { key: 'med.adrenalin_05.adet', label: '# Adrenalin 0.5 Adet' },
        { key: 'med.adrenalin_1.cb', label: '☑ Adrenalin 1 mg' },
        { key: 'med.adrenalin_1.adet', label: '# Adrenalin 1 Adet' },
        { key: 'med.atropin.cb', label: '☑ Atropin 0.5 mg' },
        { key: 'med.atropin.adet', label: '# Atropin Adet' },
        { key: 'med.flumazenil.cb', label: '☑ Flumazenil amp.' },
        { key: 'med.dopamin.cb', label: '☑ Dopamin amp.' },
        { key: 'med.citanest.cb', label: '☑ Citanest flk.' },
        { key: 'med.nahco3.cb', label: '☑ NaHCO3 amp.' },
        { key: 'med.dizem.cb', label: '☑ Dizem amp.' },
        { key: 'med.aminocordial.cb', label: '☑ Aminocordial amp.' },
        { key: 'med.furosemid.cb', label: '☑ Furosemid amp.' },
        { key: 'med.furosemid.adet', label: '# Furosemid Adet' },
        { key: 'med.ca_glukonat.cb', label: '☑ Ca Glukonat %10' },
        { key: 'med.diltizem.cb', label: '☑ Diltizem 25 mg' },
        { key: 'med.avil.cb', label: '☑ Avil amp.' },
        { key: 'med.dekort.cb', label: '☑ Dekort amp.' },
        { key: 'med.dekort.adet', label: '# Dekort Adet' },
        { key: 'med.antiepileptik.cb', label: '☑ Antiepileptik amp.' },
        { key: 'med.prednol.cb', label: '☑ Prednol 40 mg' },
        { key: 'med.aktif_komur.cb', label: '☑ Aktif Kömür tüp' },
        { key: 'med.beloc.cb', label: '☑ Beloc amp.' },
        { key: 'med.salbutamol.cb', label: '☑ Salbutamol' },
        { key: 'med.salbutamol.adet', label: '# Salbutamol Adet' },
        { key: 'med.aritmal.cb', label: '☑ Aritmal %2' },
        { key: 'med.isoptin.cb', label: '☑ Isoptin amp.' },
        { key: 'med.kapril.cb', label: '☑ Kapril 25 mg' },
        { key: 'med.magnezyum.cb', label: '☑ Magnezyum Sülfat' },
        { key: 'med.isorid.cb', label: '☑ Isorid 5 mg' },
        { key: 'med.coraspin.cb', label: '☑ Coraspin 300 mg' },
        { key: 'med.paracetamol.cb', label: '☑ Paracetamol' },
        { key: 'med.midazolam.cb', label: '☑ Midazolam' },
        { key: 'med.midazolam.adet', label: '# Midazolam Adet' },
        { key: 'med.dramamine.cb', label: '☑ Dramamine' },
        { key: 'med.rotapamid.cb', label: '☑ Rotapamid' }
      ]
    },
    // ==================== MALZEMELER ====================
    {
      id: 'malzemeler',
      name: 'Kullanılan Malzemeler',
      icon: Package,
      color: 'yellow',
      fields: [
        { key: 'mat.enjektor_1_2.cb', label: '☑ Enjektör 1-2 cc' },
        { key: 'mat.enjektor_1_2.adet', label: '# Enjektör 1-2 Adet' },
        { key: 'mat.enjektor_5.cb', label: '☑ Enjektör 5 cc' },
        { key: 'mat.enjektor_5.adet', label: '# Enjektör 5 Adet' },
        { key: 'mat.enjektor_10_20.cb', label: '☑ Enjektör 10-20 cc' },
        { key: 'mat.enjektor_10_20.adet', label: '# Enjektör 10-20 Adet' },
        { key: 'mat.monitor_pedi.cb', label: '☑ Monitör Pedi' },
        { key: 'mat.iv_kateter_14_22.cb', label: '☑ IV Kateter 14-22' },
        { key: 'mat.iv_kateter_14_22.adet', label: '# IV Kateter 14-22 Adet' },
        { key: 'mat.iv_kateter_24.cb', label: '☑ IV Kateter 24' },
        { key: 'mat.serum_seti.cb', label: '☑ Serum Seti' },
        { key: 'mat.serum_seti.adet', label: '# Serum Seti Adet' },
        { key: 'mat.steril_eldiven.cb', label: '☑ Steril Eldiven' },
        { key: 'mat.cerrahi_eldiven.cb', label: '☑ Cerrahi Eldiven' },
        { key: 'mat.sponc.cb', label: '☑ Sponç' },
        { key: 'mat.sargi_bezi.cb', label: '☑ Sargı Bezi' },
        { key: 'mat.idrar_torbasi.cb', label: '☑ İdrar Torbası' },
        { key: 'mat.bisturi_ucu.cb', label: '☑ Bistüri Ucu' },
        { key: 'mat.entubasyon_balonlu.cb', label: '☑ Entübasyon Tüpü (Balonlu)' },
        { key: 'mat.entubasyon_balonsuz.cb', label: '☑ Entübasyon Tüpü (Balonsuz)' },
        { key: 'mat.airway.cb', label: '☑ Airway' },
        { key: 'mat.foley_sonda.cb', label: '☑ Foley Sonda' },
        { key: 'mat.ng_sonda.cb', label: '☑ NG Sonda' },
        { key: 'mat.atravmatik_ipek.cb', label: '☑ Atravmatik İpek 3/0' },
        { key: 'mat.atravmatik_katkut.cb', label: '☑ Atravmatik Kat-Küt 3/0' },
        { key: 'mat.dogum_seti.cb', label: '☑ Doğum Seti' },
        { key: 'mat.yanik_battaniyesi.cb', label: '☑ Yanık Battaniyesi' },
        { key: 'mat.o2_maskesi_hazneli_eriskin.cb', label: '☑ O2 Maskesi Hazneli Erişkin' },
        { key: 'mat.o2_maskesi_hazneli_pediatrik.cb', label: '☑ O2 Maskesi Hazneli Pediatrik' },
        { key: 'mat.o2_kanulu_eriskin.cb', label: '☑ O2 Kanülü Erişkin' },
        { key: 'mat.o2_kanulu_pediatrik.cb', label: '☑ O2 Kanülü Pediatrik' },
        { key: 'mat.flaster.cb', label: '☑ Flaster' },
        { key: 'mat.servikal_collar.cb', label: '☑ Servikal Collar' },
        { key: 'mat.elastik_bandaj.cb', label: '☑ Elastik Bandaj' },
        { key: 'mat.etil_chloride.cb', label: '☑ Etil Chloride Sprey' },
        { key: 'mat.o2_maskesi_haznesiz_eriskin.cb', label: '☑ O2 Maskesi Haznesiz Erişkin' },
        { key: 'mat.o2_maskesi_haznesiz_pediatrik.cb', label: '☑ O2 Maskesi Haznesiz Pediatrik' }
      ]
    },
    // ==================== HASTANE REDDİ (V3) ====================
    {
      id: 'hastane_reddi',
      name: 'Hastane Reddi',
      icon: AlertCircle,
      color: 'red',
      fields: [
        { key: 'hospital_rejection.text', label: 'Hastane Ret Açıklaması' }
      ]
    },
    // ==================== HASTA HİZMET REDDİ (V3) ====================
    {
      id: 'hasta_reddi',
      name: 'Hasta Hizmet Reddi',
      icon: AlertCircle,
      color: 'red',
      fields: [
        { key: 'patient_rejection.text', label: 'Hasta Ret Açıklaması' }
      ]
    },
    // ==================== İMZALAR (V3) ====================
    {
      id: 'imzalar',
      name: 'İmzalar ve Personel',
      icon: PenTool,
      color: 'slate',
      fields: [
        // Hastayı Teslim Alan
        { key: 'sig.teslim_alan_adi', label: 'Hastayı Teslim Alan Adı' },
        { key: 'sig.teslim_alan_unvan', label: 'Teslim Alan Unvanı' },
        { key: 'sig.teslim_alan_imza', label: 'Teslim Alan İmza (✓)' },
        // Ambulans Personeli
        { key: 'sig.hekim_prm_adi', label: 'Hekim/PRM Adı Soyadı' },
        { key: 'sig.hekim_prm_imza', label: 'Hekim/PRM İmza (✓)' },
        { key: 'ambulans_hekim', label: 'Ambulans Hekim (Ekip)' },
        { key: 'sig.saglik_per_adi', label: 'Sağlık Per./ATT Adı' },
        { key: 'sig.saglik_per_imza', label: 'Sağlık Per. İmza (✓)' },
        { key: 'ambulans_saglik_per', label: 'Ambulans Sağlık Per. (Ekip)' },
        { key: 'sig.sofor_teknisyen_adi', label: 'Sür./Tekn. Adı' },
        { key: 'sig.sofor_teknisyen_imza', label: 'Sür./Tekn. İmza (✓)' },
        { key: 'ambulans_sofor', label: 'Ambulans Şoför (Ekip)' },
        // Hasta/Yakını
        { key: 'sig.hasta_yakin_adi', label: 'Hasta/Hasta Yakını Adı Soyadı' },
        { key: 'sig.hasta_yakin_imza', label: 'Hasta/Yakın İmzası (✓)' },
        // Hasta Reddi
        { key: 'sig.hasta_reddi_adi', label: 'Hasta Reddi - Adı' },
        { key: 'sig.hasta_reddi_imza', label: 'Hasta Reddi - İmza (✓)' },
        // Hastane Reddi
        { key: 'sig.hastane_reddi_doktor', label: 'Hastane Reddi - Doktor Adı' },
        { key: 'sig.hastane_reddi_imza', label: 'Hastane Reddi - İmza (✓)' },
        { key: 'sig.hastane_reddi_neden', label: 'Hastane Reddi - Neden' },
        { key: 'sig.hastane_reddi_kurum', label: 'Hastane Reddi - Kurum' }
      ]
    },
    // ==================== ONAY METNİ (V3) ====================
    {
      id: 'onay',
      name: 'Onay Metni',
      icon: FileText,
      color: 'gray',
      fields: [
        { key: 'consent.bilgilendirme_onay', label: 'Bilgilendirme ve Onay Metni' },
        { key: 'consent.refakatci_onayi', label: 'Refakatçi Nakil Onayı' }
      ]
    }
  ];

  useEffect(() => {
    loadMapping();
  }, []);

  // V3 Excel varsayılan hücre konumları (Birleşik hücrelere göre düzeltilmiş)
  // Excel: 79 satır x 20 sütun (A-T)
  const defaultV3Mappings = {
    // === ROW 1-5: LOGO VE BAŞLIK ===
    'A1': '__LOGO__',           // Logo (A1:C5 birleşik)
    'N1': 'atn_no',             // ATN NO değeri (N3:P5 birleşik)
    'Q3': 'startKm',            // Başlangıç KM değeri (Q3:R5)
    'S3': 'endKm',              // Bitiş KM değeri (S3:T5)
    
    // === ROW 6-12: İSTASYON, SAATLER, HASTA ===
    'B7': 'caseNumber',         // PROTOKOL NO değeri
    'B8': 'caseDate',           // TARİH değeri
    'B9': 'caseCode',           // KODU değeri
    'B10': 'referringInstitution', // VAKAYI VEREN KURUM değeri
    'B11': 'vehiclePlate',      // PLAKA değeri
    
    'D7': 'callTime',           // ÇAĞRI SAATİ değeri
    'D8': 'arrivalSceneTime',   // OLAY YERİNE VARIŞ değeri
    'D9': 'arrivalPatientTime', // HASTAYA VARIŞ değeri
    'D10': 'departureSceneTime',// OLAY YERİNDEN AYRILIŞ değeri
    'D11': 'arrivalHospitalTime', // HASTANEYE VARIŞ değeri
    'D12': 'returnStationTime', // İSTASYONA DÖNÜŞ değeri
    
    'G7': 'patientName',        // ADI SOYADI değeri (G7:L7)
    'G8': 'patientHomeAddress', // İKAMETGAH ADRESİ değeri (G8:L9)
    'G10': 'patientPickupAddress', // ALINDIĞI ADRES değeri (G10:L10)
    'G11': 'patientTcNo',       // TC KİMLİK NO değeri (G11:L11)
    'G12': 'patientPhone',      // TELEFON değeri (G12:L12)
    'N10': 'patientAge',        // YAŞ değeri (N10)
    
    // Cinsiyet checkbox
    'M7': 'gender.erkek',       // ERKEK
    'M9': 'gender.kadin',       // KADIN
    
    // Triyaj/Durumu checkbox (P sütunu)
    'P7': 'priority.kirmizi_kod',
    'P8': 'priority.sari_kod',
    'P9': 'priority.yesil_kod',
    'P10': 'priority.siyah_kod',
    'P11': 'priority.sosyal_endikasyon',
    
    // Kronik hastalıklar ve şikayet
    'R6': 'chronicDiseases',    // KRONİK HASTALIKLAR (R6:T6)
    'R9': 'patientComplaint',   // HASTANIN ŞİKAYETİ (R9:T9)
    
    // === ROW 13-17: ÇAĞRI TİPİ, NEDENİ, OLAY YERİ ===
    // Çağrı tipi
    'B14': 'callType.telsiz',
    'B15': 'callType.telefon',
    'B16': 'callType.diger',
    
    // Çağrı nedeni
    'C14': 'callReason.kesici_delici',
    'C15': 'callReason.trafik_kaz',
    'C16': 'callReason.diger_kaza',
    'C17': 'callReason.is_kazasi',
    'E14': 'callReason.yangin',
    'E15': 'callReason.intihar',
    'E16': 'callReason.kimyasal',
    'E17': 'callReason.medikal',
    'G14': 'callReason.elektrik_carp',
    'G15': 'callReason.atesli_silah',
    'G16': 'callReason.bogulma',
    'G17': 'callReason.allerji',
    'I14': 'callReason.dusme',
    'I15': 'callReason.alkol_ilac',
    'I16': 'callReason.kunt_trav',
    'I17': 'callReason.yanik',
    'K14': 'callReason.lpg',
    'K15': 'callReason.tedbir',
    'K16': 'callReason.protokol',
    
    // Olay yeri
    'M14': 'scene.ev',
    'M15': 'scene.yaya',
    'M16': 'scene.suda',
    'M17': 'scene.arazi',
    'O14': 'scene.aracta',
    'O15': 'scene.buro',
    'O16': 'scene.fabrika',
    'O17': 'scene.sokak',
    'Q14': 'scene.stadyum',
    'Q15': 'scene.huzurevi',
    'Q16': 'scene.cami',
    'Q17': 'scene.yurt',
    'S14': 'scene.saglik_kurumu',
    'S15': 'scene.resmi_daire',
    'S16': 'scene.egitim_kurumu',
    'S17': 'scene.spor_salonu',
    
    // === ROW 18-25: İLK MUAYENE BULGULARI ===
    // Pupiller
    'B20': 'pupil.normal',
    'B21': 'pupil.miyotik',
    'B22': 'pupil.midriatik',
    'B23': 'pupil.anizokorik',
    'B24': 'pupil.reak_yok',
    'B25': 'pupil.fiks_dilate',
    
    // Deri
    'C20': 'skin.normal',
    'C21': 'skin.soluk',
    'C22': 'skin.siyanotik',
    'C23': 'skin.hiperemik',
    'C24': 'skin.ikterik',
    'C25': 'skin.terli',
    
    // Vital 1 (Row 20)
    'E20': 'vital1.saat',
    'F20': 'vital1.nabiz',
    'H20': 'vital1.tansiyon',
    'J20': 'vital1.solunum',
    
    // Vital 2 (Row 21)
    'E21': 'vital2.saat',
    'F21': 'vital2.nabiz',
    'H21': 'vital2.tansiyon',
    'J21': 'vital2.solunum',
    
    // SpO2 (Row 22-23)
    'I22': 'vital1.spo2',
    'I23': 'vital2.spo2',
    
    // Nabız tipi
    'G22': 'pulse.duzenli',
    'G23': 'pulse.ritmik',
    'G24': 'pulse.filiform',
    'G25': 'pulse.alinmiyor',
    
    // Solunum tipi
    'K22': 'resp.duzenli',
    'K23': 'resp.duzensiz',
    'K24': 'resp.dispne',
    'K25': 'resp.yok',
    
    // Kan şekeri ve ateş
    'S19': 'kan_sekeri',
    'S22': 'ates',
    
    // GKS Motor (L sütunu, satır numarası = skor)
    'L20': 'gcsMotor.1',
    'L21': 'gcsMotor.2',
    'L22': 'gcsMotor.3',
    'L23': 'gcsMotor.4',
    'L24': 'gcsMotor.5',
    'L25': 'gcsMotor.6',
    
    // GKS Verbal (O sütunu)
    'O20': 'gcsVerbal.1',
    'O21': 'gcsVerbal.2',
    'O22': 'gcsVerbal.3',
    'O23': 'gcsVerbal.4',
    'O24': 'gcsVerbal.5',
    
    // GKS Göz (Q sütunu)
    'Q20': 'gcsEye.1',
    'Q21': 'gcsEye.2',
    'Q22': 'gcsEye.3',
    'Q23': 'gcsEye.4',
    
    // GKS toplam
    'O25': 'gcsTotal',
    
    // === ROW 26: ÖN TANI VE AÇIKLAMALAR ===
    'C26': 'on_tani',           // ÖN TANI değeri (C26:F26)
    'I26': 'aciklamalar',       // AÇIKLAMALAR değeri (I26:T26)
    
    // === ROW 27-32: SONUÇ ===
    'H28': 'transferHospital',  // NAKLEDİLEN HASTANE (H28 birleşik)
    'L28': 'crashVehicle1',
    'L29': 'crashVehicle2',
    'L30': 'crashVehicle3',
    'L31': 'crashVehicle4',
    'S28': 'cpr.yapildi',       // CPR YAPILDI İSE (S28:T28)
    'S29': 'cprStartTime',      // BAŞLAMA ZAMANI
    'S30': 'cprStopTime',       // BIRAKMA ZAMANI
    'P30': 'cprStopReason',     // BIRAKMA NEDENİ
    
    // Sonuç checkbox
    'B28': 'outcome.yerinde_mudahale',
    'B29': 'outcome.hastaneye_nakil',
    'B30': 'outcome.hastaneler_arasi',
    'B31': 'outcome.tibbi_tetkik',
    'B32': 'outcome.eve_nakil',
    'C28': 'outcome.ex_terinde_birakildi',
    'C29': 'outcome.ex_morga_nakil',
    'C30': 'outcome.nakil_reddi',
    'C31': 'outcome.diger_ulasilan',
    'C32': 'outcome.gorev_iptali',
    'E28': 'outcome.baska_aracla_nakil',
    'E29': 'outcome.tlf_bsk_aracla_nakil',
    'E30': 'outcome.asilsiz_ihbar',
    'E31': 'outcome.yaralanan_yok',
    'E32': 'outcome.olay_yerinde_bekleme',
    
    // Mesafe
    'H30': 'distance.ilce_ici',
    'H31': 'distance.ilce_disi',
    'H32': 'distance.il_disi',
    
    // Adli vaka
    'K32': 'forensic.label',
    'M32': 'forensic.evet',
    'O32': 'forensic.hayir',
    
    // === ROW 33-66: İŞLEMLER ===
    // Genel müdahale (A sütunu işlem adı, D sütunu adet)
    'A34': 'proc.muayene_acil.cb', 'D34': 'proc.muayene_acil.adet',
    'A35': 'ambulance_fee.cb', 'D35': 'ambulance_fee.adet',
    'A37': 'proc.enjeksiyon_im.cb', 'D37': 'proc.enjeksiyon_im.adet',
    'A38': 'proc.enjeksiyon_iv.cb', 'D38': 'proc.enjeksiyon_iv.adet',
    'A39': 'proc.enjeksiyon_sc.cb', 'D39': 'proc.enjeksiyon_sc.adet',
    'A40': 'proc.iv_ilac.cb', 'D40': 'proc.iv_ilac.adet',
    'A41': 'proc.damar_yolu.cb', 'D41': 'proc.damar_yolu.adet',
    'A42': 'proc.sutur.cb', 'D42': 'proc.sutur.adet',
    'A43': 'proc.mesane_sondasi.cb', 'D43': 'proc.mesane_sondasi.adet',
    'A44': 'proc.mide_yikama.cb', 'D44': 'proc.mide_yikama.adet',
    'A45': 'proc.pansuman_kucuk.cb', 'D45': 'proc.pansuman_kucuk.adet',
    'A46': 'proc.apse.cb', 'D46': 'proc.apse.adet',
    'A47': 'proc.yabanci_cisim.cb', 'D47': 'proc.yabanci_cisim.adet',
    'A48': 'proc.yanik_pansuman_kucuk.cb', 'D48': 'proc.yanik_pansuman_kucuk.adet',
    'A49': 'proc.yanik_pansuman_orta.cb', 'D49': 'proc.yanik_pansuman_orta.adet',
    'A50': 'proc.ng_sonda.cb', 'D50': 'proc.ng_sonda.adet',
    'A51': 'proc.kulak_buson.cb', 'D51': 'proc.kulak_buson.adet',
    'A52': 'proc.kol_atel.cb', 'D52': 'proc.kol_atel.adet',
    'A53': 'proc.bacak_atel.cb', 'D53': 'proc.bacak_atel.adet',
    'A54': 'proc.cilt_traksiyon.cb', 'D54': 'proc.cilt_traksiyon.adet',
    'A55': 'proc.servikal_collar.cb', 'D55': 'proc.servikal_collar.adet',
    'A56': 'proc.travma_yelegi.cb', 'D56': 'proc.travma_yelegi.adet',
    'A57': 'proc.vakum_sedye.cb', 'D57': 'proc.vakum_sedye.adet',
    'A58': 'proc.sirt_tahtasi.cb', 'D58': 'proc.sirt_tahtasi.adet',
    
    // Dolaşım desteği (Row 59-66)
    'A60': 'circ.cpr.cb', 'D60': 'circ.cpr.adet',
    'A61': 'circ.ekg.cb', 'D61': 'circ.ekg.adet',
    'A62': 'circ.defibrilasyon.cb', 'D62': 'circ.defibrilasyon.adet',
    'A63': 'circ.kardiyoversiyon.cb', 'D63': 'circ.kardiyoversiyon.adet',
    'A64': 'circ.monitorizasyon.cb', 'D64': 'circ.monitorizasyon.adet',
    'A65': 'circ.kanama_kontrolu.cb', 'D65': 'circ.kanama_kontrolu.adet',
    'A66': 'circ.cut_down.cb', 'D66': 'circ.cut_down.adet',
    
    // Hava yolu (E sütunu)
    'E35': 'airway.balon_valf.cb', 'I35': 'airway.balon_valf.adet',
    'E36': 'airway.aspirasyon.cb', 'I36': 'airway.aspirasyon.adet',
    'E37': 'airway.orofaringeal.cb', 'I37': 'airway.orofaringeal.adet',
    'E38': 'airway.entubasyon.cb', 'I38': 'airway.entubasyon.adet',
    'E39': 'airway.mekanik_vent.cb', 'I39': 'airway.mekanik_vent.adet',
    'E40': 'airway.oksijen.cb', 'I40': 'airway.oksijen.adet',
    
    // Diğer işlemler (Row 41-48)
    'E42': 'other.normal_dogum.cb', 'I42': 'other.normal_dogum.adet',
    'E43': 'other.kan_sekeri.cb', 'I43': 'other.kan_sekeri.adet',
    'E44': 'other.lokal_anestezi.cb', 'I44': 'other.lokal_anestezi.adet',
    'E45': 'other.tirnak_avulsiyon.cb', 'I45': 'other.tirnak_avulsiyon.adet',
    'E46': 'other.transkutan_pao2.cb', 'I46': 'other.transkutan_pao2.adet',
    'E47': 'other.debritman.cb', 'I47': 'other.debritman.adet',
    'E48': 'other.sutur_alinmasi.cb', 'I48': 'other.sutur_alinmasi.adet',
    
    // Yenidoğan işlemleri (Row 49-55)
    'E50': 'newborn.transport_kuvoz.cb', 'I50': 'newborn.transport_kuvoz.adet',
    'E51': 'newborn.canlandirma.cb', 'I51': 'newborn.canlandirma.adet',
    'E52': 'newborn.im_enjeksiyon.cb', 'I52': 'newborn.im_enjeksiyon.adet',
    'E53': 'newborn.iv_enjeksiyon.cb', 'I53': 'newborn.iv_enjeksiyon.adet',
    'E54': 'newborn.iv_mayi.cb', 'I54': 'newborn.iv_mayi.adet',
    'E55': 'newborn.entubasyon.cb', 'I55': 'newborn.entubasyon.adet',
    
    // Sıvı tedavisi (Row 56-66)
    'E57': 'fluid.nacl_250.cb', 'I57': 'fluid.nacl_250.adet',
    'E58': 'fluid.nacl_500.cb', 'I58': 'fluid.nacl_500.adet',
    'E59': 'fluid.nacl_100.cb', 'I59': 'fluid.nacl_100.adet',
    'E60': 'fluid.dextroz_500.cb', 'I60': 'fluid.dextroz_500.adet',
    'E62': 'fluid.mannitol_500.cb', 'I62': 'fluid.mannitol_500.adet',
    'E63': 'fluid.isolyte_p.cb', 'I63': 'fluid.isolyte_p.adet',
    'E64': 'fluid.isolyte_s.cb', 'I64': 'fluid.isolyte_s.adet',
    'E65': 'fluid.dengeleyici.cb', 'I65': 'fluid.dengeleyici.adet',
    'E66': 'fluid.ringer_laktat.cb', 'I66': 'fluid.ringer_laktat.adet',
    
    // Kullanılan ilaçlar (J sütunu işlem, N sütunu adet, O sütunu tür)
    'J35': 'med.arveles.cb', 'N35': 'med.arveles.adet', 'O35': 'med.arveles.tur',
    'J36': 'med.dikloron.cb', 'N36': 'med.dikloron.adet', 'O36': 'med.dikloron.tur',
    'J37': 'med.spazmolitik.cb', 'N37': 'med.spazmolitik.adet', 'O37': 'med.spazmolitik.tur',
    'J38': 'med.adrenalin_05.cb', 'N38': 'med.adrenalin_05.adet', 'O38': 'med.adrenalin_05.tur',
    'J39': 'med.adrenalin_1.cb', 'N39': 'med.adrenalin_1.adet', 'O39': 'med.adrenalin_1.tur',
    'J40': 'med.atropin.cb', 'N40': 'med.atropin.adet', 'O40': 'med.atropin.tur',
    'J41': 'med.flumazenil.cb', 'N41': 'med.flumazenil.adet', 'O41': 'med.flumazenil.tur',
    'J42': 'med.dopamin.cb', 'N42': 'med.dopamin.adet', 'O42': 'med.dopamin.tur',
    'J43': 'med.citanest.cb', 'N43': 'med.citanest.adet', 'O43': 'med.citanest.tur',
    'J44': 'med.nahco3.cb', 'N44': 'med.nahco3.adet', 'O44': 'med.nahco3.tur',
    'J45': 'med.dizem.cb', 'N45': 'med.dizem.adet', 'O45': 'med.dizem.tur',
    'J46': 'med.aminocordial.cb', 'N46': 'med.aminocordial.adet', 'O46': 'med.aminocordial.tur',
    'J47': 'med.furosemid.cb', 'N47': 'med.furosemid.adet', 'O47': 'med.furosemid.tur',
    'J48': 'med.ca_glukonat.cb', 'N48': 'med.ca_glukonat.adet', 'O48': 'med.ca_glukonat.tur',
    'J49': 'med.diltizem.cb', 'N49': 'med.diltizem.adet', 'O49': 'med.diltizem.tur',
    'J50': 'med.avil.cb', 'N50': 'med.avil.adet', 'O50': 'med.avil.tur',
    'J51': 'med.dekort.cb', 'N51': 'med.dekort.adet', 'O51': 'med.dekort.tur',
    'J52': 'med.antiepileptik.cb', 'N52': 'med.antiepileptik.adet', 'O52': 'med.antiepileptik.tur',
    'J53': 'med.prednol.cb', 'N53': 'med.prednol.adet', 'O53': 'med.prednol.tur',
    'J54': 'med.aktif_komur.cb', 'N54': 'med.aktif_komur.adet', 'O54': 'med.aktif_komur.tur',
    'J55': 'med.beloc.cb', 'N55': 'med.beloc.adet', 'O55': 'med.beloc.tur',
    'J56': 'med.salbutamol.cb', 'N56': 'med.salbutamol.adet', 'O56': 'med.salbutamol.tur',
    'J57': 'med.aritmal.cb', 'N57': 'med.aritmal.adet', 'O57': 'med.aritmal.tur',
    'J58': 'med.isoptin.cb', 'N58': 'med.isoptin.adet', 'O58': 'med.isoptin.tur',
    'J59': 'med.kapril.cb', 'N59': 'med.kapril.adet', 'O59': 'med.kapril.tur',
    'J60': 'med.magnezyum.cb', 'N60': 'med.magnezyum.adet', 'O60': 'med.magnezyum.tur',
    'J61': 'med.isorid.cb', 'N61': 'med.isorid.adet', 'O61': 'med.isorid.tur',
    'J62': 'med.coraspin.cb', 'N62': 'med.coraspin.adet', 'O62': 'med.coraspin.tur',
    'J63': 'med.paracetamol.cb', 'N63': 'med.paracetamol.adet', 'O63': 'med.paracetamol.tur',
    'J64': 'med.midazolam.cb', 'N64': 'med.midazolam.adet', 'O64': 'med.midazolam.tur',
    'J65': 'med.dramamine.cb', 'N65': 'med.dramamine.adet', 'O65': 'med.dramamine.tur',
    'J66': 'med.rotapamid.cb', 'N66': 'med.rotapamid.adet', 'O66': 'med.rotapamid.tur',
    
    // Kullanılan malzemeler (P sütunu işlem, T sütunu adet)
    'P35': 'mat.enjektor_1_2.cb', 'T35': 'mat.enjektor_1_2.adet',
    'P36': 'mat.enjektor_5.cb', 'T36': 'mat.enjektor_5.adet',
    'P37': 'mat.enjektor_10_20.cb', 'T37': 'mat.enjektor_10_20.adet',
    'P38': 'mat.monitor_pedi.cb', 'T38': 'mat.monitor_pedi.adet',
    'P39': 'mat.iv_kateter_14_22.cb', 'T39': 'mat.iv_kateter_14_22.adet',
    'P40': 'mat.iv_kateter_24.cb', 'T40': 'mat.iv_kateter_24.adet',
    'P41': 'mat.serum_seti.cb', 'T41': 'mat.serum_seti.adet',
    'P42': 'mat.steril_eldiven.cb', 'T42': 'mat.steril_eldiven.adet',
    'P43': 'mat.cerrahi_eldiven.cb', 'T43': 'mat.cerrahi_eldiven.adet',
    'P44': 'mat.sponc.cb', 'T44': 'mat.sponc.adet',
    'P45': 'mat.sargi_bezi.cb', 'T45': 'mat.sargi_bezi.adet',
    'P46': 'mat.idrar_torbasi.cb', 'T46': 'mat.idrar_torbasi.adet',
    'P47': 'mat.bisturi_ucu.cb', 'T47': 'mat.bisturi_ucu.adet',
    'P48': 'mat.entubasyon_balonlu.cb', 'T48': 'mat.entubasyon_balonlu.adet',
    'P49': 'mat.entubasyon_balonsuz.cb', 'T49': 'mat.entubasyon_balonsuz.adet',
    'P50': 'mat.airway.cb', 'T50': 'mat.airway.adet',
    'P51': 'mat.foley_sonda.cb', 'T51': 'mat.foley_sonda.adet',
    'P52': 'mat.ng_sonda.cb', 'T52': 'mat.ng_sonda.adet',
    'P53': 'mat.atravmatik_ipek.cb', 'T53': 'mat.atravmatik_ipek.adet',
    'P54': 'mat.atravmatik_katkut.cb', 'T54': 'mat.atravmatik_katkut.adet',
    'P55': 'mat.dogum_seti.cb', 'T55': 'mat.dogum_seti.adet',
    'P56': 'mat.yanik_battaniyesi.cb', 'T56': 'mat.yanik_battaniyesi.adet',
    'P57': 'mat.o2_maskesi_hazneli_eriskin.cb', 'T57': 'mat.o2_maskesi_hazneli_eriskin.adet',
    'P58': 'mat.o2_maskesi_hazneli_pediatrik.cb', 'T58': 'mat.o2_maskesi_hazneli_pediatrik.adet',
    'P59': 'mat.o2_kanulu_eriskin.cb', 'T59': 'mat.o2_kanulu_eriskin.adet',
    'P60': 'mat.o2_kanulu_pediatrik.cb', 'T60': 'mat.o2_kanulu_pediatrik.adet',
    'P61': 'mat.flaster.cb', 'T61': 'mat.flaster.adet',
    'P62': 'mat.servikal_collar.cb', 'T62': 'mat.servikal_collar.adet',
    'P63': 'mat.elastik_bandaj.cb', 'T63': 'mat.elastik_bandaj.adet',
    'P64': 'mat.etil_chloride.cb', 'T64': 'mat.etil_chloride.adet',
    'P65': 'mat.o2_maskesi_haznesiz_eriskin.cb', 'T65': 'mat.o2_maskesi_haznesiz_eriskin.adet',
    'P66': 'mat.o2_maskesi_haznesiz_pediatrik.cb', 'T66': 'mat.o2_maskesi_haznesiz_pediatrik.adet',
    
    // === ROW 67-74: REDLER ===
    'A67': 'hospital_rejection.text',  // HASTANENİN HASTA REDDİ (A68:I74)
    'J67': 'patient_rejection.text',   // HASTANIN HİZMET REDDİ (J68:T74)
    
    // === ROW 75-78: İMZALAR ===
    'A75': 'sig.teslim_alan_adi',      // HASTAYI TESLİM ALAN ADI (B77:C77)
    'D75': 'sig.teslim_alan_unvani',   // UNVANI (D77:G77)
    'B78': 'sig.teslim_alan_imza',     // İMZA
    'D77': 'sig.teslim_alan_kase',     // KAŞE
    
    'H76': 'sig.hekim_prm_name',       // HEKİM/PRM (I76)
    'M76': 'sig.hekim_prm_imza',       // İMZA (M76:N76)
    'H77': 'sig.saglik_per_name',      // SAĞLIK PER./ATT (I77)
    'M77': 'sig.saglik_per_imza',      // İMZA
    'H78': 'sig.sofor_teknisyen_name', // SÜR./TEKN. (I78)
    'M78': 'sig.sofor_teknisyen_imza', // İMZA
    
    'O77': 'sig.hasta_yakin_adi',      // Hasta/Hasta Yakını Adı (O77:R77)
    'S77': 'sig.hasta_yakin_imza'      // İMZASI (S77:T77)
  };

  const loadMapping = async () => {
    try {
      setLoading(true);
      
      // Hem mapping hem şablon hücrelerini paralel yükle
      const [mappingRes, templateRes] = await Promise.all([
        api.get('/pdf/vaka-form-mapping'),
        api.get('/pdf/vaka-form-template-cells').catch(() => ({ data: { cells: {} } }))
      ]);
      
      setMappingData(mappingRes.data);
      setTemplateCells(templateRes.data.cells || {});
      
      if (mappingRes.data.flat_mappings && Object.keys(mappingRes.data.flat_mappings).length > 0) {
        setDataMappings(mappingRes.data.flat_mappings);
      } else {
        // Varsayılan V3 mapping'i yükle
        setDataMappings(defaultV3Mappings);
        toast.info('V3 Excel varsayılan mapping yüklendi');
      }
      
      if (mappingRes.data.logo) {
        setLogoUrl(mappingRes.data.logo.url || '');
        setLogoCell(mappingRes.data.logo.cell || 'A1');
      }
    } catch (error) {
      console.error('Mapping yüklenemedi:', error);
      // Hata durumunda da varsayılan mapping'i yükle
      setDataMappings(defaultV3Mappings);
      toast.info('V3 Excel varsayılan mapping yüklendi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/pdf/vaka-form-mapping/bulk', {
        mappings: dataMappings,
        logo: { url: logoUrl, cell: logoCell }
      });
      toast.success('Mapping kaydedildi!');
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleCellClick = (address, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPosition({ x: rect.left, y: rect.bottom + 5 });
    setActiveCell(address);
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleMapField = (fieldKey) => {
    if (!activeCell) return;
    setDataMappings(prev => ({ ...prev, [activeCell]: fieldKey }));
    toast.success(`${activeCell} → ${fieldKey}`);
    setActiveCell(null);
  };

  const handleUnmap = (address) => {
    setDataMappings(prev => {
      const updated = { ...prev };
      delete updated[address];
      return updated;
    });
    toast.info(`${address} eşlemesi kaldırıldı`);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoUrl(ev.target.result);
      toast.success('Logo yüklendi');
    };
    reader.readAsDataURL(file);
  };

  const getColumnLetter = (col) => {
    let letter = '';
    while (col > 0) {
      col--;
      letter = String.fromCharCode(65 + (col % 26)) + letter;
      col = Math.floor(col / 26);
    }
    return letter;
  };

  const getCellAddress = (row, col) => `${getColumnLetter(col)}${row}`;

  const getColorClass = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700',
      purple: 'bg-purple-100 text-purple-700',
      amber: 'bg-amber-100 text-amber-700',
      red: 'bg-red-100 text-red-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      orange: 'bg-orange-100 text-orange-700',
      gray: 'bg-gray-100 text-gray-700',
      cyan: 'bg-cyan-100 text-cyan-700',
      green: 'bg-green-100 text-green-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      slate: 'bg-slate-100 text-slate-700',
      pink: 'bg-pink-100 text-pink-700',
      teal: 'bg-teal-100 text-teal-700',
      emerald: 'bg-emerald-100 text-emerald-700',
      violet: 'bg-violet-100 text-violet-700'
    };
    return colors[color] || colors.gray;
  };

  const getFieldInfo = (key) => {
    for (const cat of fieldCategories) {
      const field = cat.fields.find(f => f.key === key);
      if (field) return { ...field, color: cat.color, category: cat.name };
    }
    return { label: key, color: 'gray', category: 'Bilinmeyen' };
  };

  const filteredFields = useMemo(() => {
    if (!searchQuery) return fieldCategories;
    const q = searchQuery.toLowerCase();
    return fieldCategories
      .map(cat => ({
        ...cat,
        fields: cat.fields.filter(f => 
          f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
        )
      }))
      .filter(cat => cat.fields.length > 0);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveCell(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/form-templates')} className="text-white hover:bg-white/20">
            <ArrowLeft className="h-4 w-4 mr-1" /> Geri
          </Button>
          <div className="h-6 border-l border-white/30" />
          <Grid3X3 className="h-6 w-6" />
          <span className="font-bold text-xl">Vaka Formu Mapping Editörü</span>
          <Badge className="bg-white/20 text-white">{Object.keys(dataMappings).length} eşleme</Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              setDataMappings(defaultV3Mappings);
              toast.success('V3 varsayılan mapping yüklendi');
            }} 
            variant="outline" 
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Varsayılanı Yükle
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-white text-amber-700 hover:bg-amber-50">
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5 text-purple-600" />
          <span className="font-medium">Firma Logosu:</span>
        </div>
        {logoUrl ? (
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Logo" className="h-10 w-auto border rounded" />
            <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Logo Yükle
          </Button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Hücre:</span>
          <Input value={logoCell} onChange={(e) => setLogoCell(e.target.value.toUpperCase())} className="w-20 h-8 text-center font-mono" />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Excel Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white rounded-lg shadow-lg overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 bg-gray-200 border border-gray-300 w-10 h-7">#</th>
                  {Array.from({ length: maxCol }, (_, i) => (
                    <th key={i} className="sticky top-0 z-10 bg-gray-200 border border-gray-300 px-1 h-7 min-w-[50px]">
                      {getColumnLetter(i + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRow }, (_, rowIdx) => (
                  <tr key={rowIdx + 1}>
                    <td className="sticky left-0 z-10 bg-gray-200 border border-gray-300 text-center w-10 h-10">
                      {rowIdx + 1}
                    </td>
                    {Array.from({ length: maxCol }, (_, colIdx) => {
                      const address = getCellAddress(rowIdx + 1, colIdx + 1);
                      const mappedKey = dataMappings[address];
                      const fieldInfo = mappedKey ? getFieldInfo(mappedKey) : null;
                      const isActive = activeCell === address;
                      const isLogo = logoCell === address && logoUrl;

                      return (
                        <td
                          key={colIdx}
                          className={`border border-gray-300 min-w-[70px] h-10 cursor-pointer transition-all
                            ${isActive ? 'ring-2 ring-amber-500 bg-amber-50' : ''}
                            ${mappedKey ? 'bg-green-50' : 'hover:bg-gray-50'}
                            ${isLogo ? 'bg-purple-100' : ''}
                          `}
                          onClick={(e) => handleCellClick(address, e)}
                          title={mappedKey ? `${fieldInfo.category}: ${fieldInfo.label}` : address}
                        >
                          {isLogo ? (
                            <div className="flex items-center justify-center"><Image className="h-3 w-3 text-purple-600" /></div>
                          ) : (
                            <div className="flex flex-col h-full justify-between">
                              {/* Şablondaki orijinal değer */}
                              {templateCells[address] && (
                                <div className="text-[8px] text-gray-500 truncate px-0.5" title={templateCells[address]}>
                                  {templateCells[address].slice(0, 12)}
                                </div>
                              )}
                              {/* Eşlenmiş alan */}
                              {mappedKey && (
                                <div className={`px-0.5 py-0 text-[8px] truncate ${getColorClass(fieldInfo.color)} rounded mt-auto`}>
                                  → {fieldInfo.label.slice(0, 10)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="w-80 bg-white border-l overflow-auto p-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-amber-600" />Eşleme Özeti
          </h3>
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-auto">
            {Object.entries(dataMappings).length > 0 ? (
              Object.entries(dataMappings).sort((a, b) => a[0].localeCompare(b[0])).map(([addr, key]) => {
                const info = getFieldInfo(key);
                return (
                  <div key={addr} className="flex items-center justify-between p-2 bg-gray-50 rounded border text-sm">
                    <span className="font-mono font-bold text-blue-600">{addr}</span>
                    <Badge className={`text-xs ${getColorClass(info.color)}`}>{info.label.slice(0, 12)}</Badge>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleUnmap(addr)}>
                      <X className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 py-8">Henüz eşleme yok</p>
            )}
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {activeCell && (
        <div ref={dropdownRef} className="fixed bg-white rounded-lg shadow-2xl border z-50 w-96 max-h-[500px] flex flex-col"
          style={{ left: Math.min(dropdownPosition.x, window.innerWidth - 420), top: Math.min(dropdownPosition.y, window.innerHeight - 520) }}>
          <div className="p-3 border-b bg-amber-50 rounded-t-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">Hücre: <span className="text-amber-600 font-mono">{activeCell}</span></span>
              <Button variant="ghost" size="sm" onClick={() => setActiveCell(null)} className="h-6 w-6 p-0"><X className="h-4 w-4" /></Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Alan ara..." className="pl-8 h-8" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredFields.map(cat => (
              <div key={cat.id} className="mb-3">
                <div className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium ${getColorClass(cat.color)}`}>
                  {React.createElement(cat.icon, { className: 'h-3 w-3' })}
                  {cat.name}
                  {cat.isCheckbox && <Badge variant="outline" className="text-[9px] bg-white">CB</Badge>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {cat.fields.map(field => (
                    <div key={field.key} className={`px-2 py-1 rounded cursor-pointer hover:bg-gray-100 text-sm ${dataMappings[activeCell] === field.key ? 'bg-amber-100 font-medium' : ''}`}
                      onClick={() => handleMapField(field.key)}>
                      {field.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t bg-gray-50 rounded-b-lg flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => { handleUnmap(activeCell); setActiveCell(null); }} disabled={!dataMappings[activeCell]}>
              <X className="h-4 w-4 mr-1" /> Kaldır
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveCell(null)}>Kapat</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VakaFormMappingEditor;
