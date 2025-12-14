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
  const [logoUrl, setLogoUrl] = useState('');
  const [logoCell, setLogoCell] = useState('A1');
  
  const [activeCell, setActiveCell] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const maxRow = 100;
  const maxCol = 35;

  const fieldCategories = [
    {
      id: 'logo',
      name: '🖼️ Logo',
      icon: Image,
      color: 'purple',
      fields: [{ key: '__LOGO__', label: 'Firma Logosu' }]
    },
    {
      id: 'temel',
      name: 'Temel Bilgiler',
      icon: FileText,
      color: 'blue',
      fields: [
        { key: 'caseNumber', label: 'Protokol No' },
        { key: 'caseDate', label: 'Tarih' },
        { key: 'vehiclePlate', label: 'Araç Plakası' },
        { key: 'pickupAddress', label: 'Alım Adresi' },
        { key: 'startKm', label: 'Başlangıç KM' },
        { key: 'endKm', label: 'Bitiş KM' },
        { key: 'totalKm', label: 'Toplam KM' },
        { key: 'referringInstitution', label: 'Sevk Eden Kurum' }
      ]
    },
    {
      id: 'saatler',
      name: 'Saatler',
      icon: Clock,
      color: 'amber',
      fields: [
        { key: 'callTime', label: 'Çağrı Saati' },
        { key: 'departureTime', label: 'Çıkış Saati' },
        { key: 'arrivalTime', label: 'Olay Yerine Varış' },
        { key: 'patientTime', label: 'Hastaya Ulaşma' },
        { key: 'hospitalTime', label: 'Hastaneye Varış' },
        { key: 'returnTime', label: 'Dönüş Saati' }
      ]
    },
    {
      id: 'hasta',
      name: 'Hasta Bilgileri',
      icon: User,
      color: 'teal',
      fields: [
        { key: 'patientName', label: 'Hasta Ad Soyad' },
        { key: 'patientTcNo', label: 'TC Kimlik No' },
        { key: 'patientAge', label: 'Yaş' },
        { key: 'patientGender', label: 'Cinsiyet' },
        { key: 'patientPhone', label: 'Telefon' },
        { key: 'patientAddress', label: 'Adres' },
        { key: 'patientComplaint', label: 'Şikayet' },
        { key: 'chronicDiseases', label: 'Kronik Hastalıklar' }
      ]
    },
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
    {
      id: 'checkbox_cagri_nedeni',
      name: 'Çağrı Nedeni (Checkbox)',
      icon: CheckSquare,
      color: 'orange',
      isCheckbox: true,
      fields: [
        { key: 'callReason.medikal', label: '☑ Medikal' },
        { key: 'callReason.trafik', label: '☑ Trafik Kazası' },
        { key: 'callReason.kaza', label: '☑ Diğer Kaza' },
        { key: 'callReason.is_kazasi', label: '☑ İş Kazası' },
        { key: 'callReason.yangin', label: '☑ Yangın' },
        { key: 'callReason.intihar', label: '☑ İntihar' }
      ]
    },
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
    {
      id: 'checkbox_triyaj',
      name: 'Triyaj (Checkbox)',
      icon: AlertCircle,
      color: 'red',
      isCheckbox: true,
      fields: [
        { key: 'priority.kirmizi', label: '☑ Kırmızı' },
        { key: 'priority.sari', label: '☑ Sarı' },
        { key: 'priority.yesil', label: '☑ Yeşil' },
        { key: 'priority.siyah', label: '☑ Siyah' }
      ]
    },
    {
      id: 'vital_bulgular',
      name: 'Vital Bulgular',
      icon: Heart,
      color: 'red',
      fields: [
        { key: 'vitalTime1', label: '1. Saat' },
        { key: 'vitalBP1', label: '1. Tansiyon' },
        { key: 'vitalPulse1', label: '1. Nabız' },
        { key: 'vitalSpO2_1', label: '1. SpO2' },
        { key: 'vitalResp1', label: '1. Solunum' },
        { key: 'vitalTemp1', label: '1. Ateş' },
        { key: 'vitalTime2', label: '2. Saat' },
        { key: 'vitalBP2', label: '2. Tansiyon' },
        { key: 'vitalPulse2', label: '2. Nabız' },
        { key: 'vitalSpO2_2', label: '2. SpO2' },
        { key: 'bloodSugar', label: 'Kan Şekeri' },
        { key: 'bodyTemp', label: 'Vücut Sıcaklığı' }
      ]
    },
    {
      id: 'checkbox_pupil',
      name: 'Pupil (Checkbox)',
      icon: Eye,
      color: 'indigo',
      isCheckbox: true,
      fields: [
        { key: 'pupil.normal', label: '☑ Normal' },
        { key: 'pupil.miyotik', label: '☑ Miyotik' },
        { key: 'pupil.midriatik', label: '☑ Midriatik' },
        { key: 'pupil.anizokorik', label: '☑ Anizokorik' }
      ]
    },
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
        { key: 'skin.terli', label: '☑ Terli' }
      ]
    },
    {
      id: 'gks',
      name: 'Glasgow Koma Skalası',
      icon: AlertCircle,
      color: 'orange',
      fields: [{ key: 'gcsTotal', label: 'GKS Toplam' }]
    },
    {
      id: 'checkbox_gks_motor',
      name: 'GKS Motor (Checkbox)',
      icon: AlertCircle,
      color: 'orange',
      isCheckbox: true,
      fields: [
        { key: 'gcsMotor.6', label: '☑ 6' },
        { key: 'gcsMotor.5', label: '☑ 5' },
        { key: 'gcsMotor.4', label: '☑ 4' },
        { key: 'gcsMotor.3', label: '☑ 3' },
        { key: 'gcsMotor.2', label: '☑ 2' },
        { key: 'gcsMotor.1', label: '☑ 1' }
      ]
    },
    {
      id: 'sonuc',
      name: 'Sonuç Bilgileri',
      icon: Truck,
      color: 'emerald',
      fields: [
        { key: 'transferHospital', label: 'Nakledilen Hastane' },
        { key: 'caseResult', label: 'Vaka Sonucu' },
        { key: 'isForensic', label: 'Adli Vaka' }
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
        { key: 'outcome.hastaneye_nakil', label: '☑ Hastaneye Nakil' },
        { key: 'outcome.ex_yerinde', label: '☑ Ex (Yerinde)' },
        { key: 'outcome.nakil_reddi', label: '☑ Nakil Reddi' },
        { key: 'outcome.gorev_iptali', label: '☑ Görev İptali' }
      ]
    },
    {
      id: 'checkbox_islem',
      name: 'İşlemler (Checkbox)',
      icon: Settings,
      color: 'violet',
      isCheckbox: true,
      fields: [
        { key: 'proc.muayene', label: '☑ Muayene' },
        { key: 'proc.enjeksiyon_im', label: '☑ Enjeksiyon IM' },
        { key: 'proc.enjeksiyon_iv', label: '☑ Enjeksiyon IV' },
        { key: 'proc.damar_yolu', label: '☑ Damar Yolu' },
        { key: 'proc.sutur', label: '☑ Sütür' },
        { key: 'proc.pansuman', label: '☑ Pansuman' },
        { key: 'proc.atel', label: '☑ Atel' },
        { key: 'circ.cpr', label: '☑ CPR' },
        { key: 'circ.ekg', label: '☑ EKG' },
        { key: 'circ.defibrilasyon', label: '☑ Defibrilasyon' },
        { key: 'airway.oksijen', label: '☑ Oksijen' },
        { key: 'airway.entubasyon', label: '☑ Entübasyon' }
      ]
    },
    {
      id: 'ilaclar',
      name: 'İlaçlar',
      icon: Pill,
      color: 'green',
      fields: [
        { key: 'medication.adrenalin', label: 'Adrenalin' },
        { key: 'medication.atropin', label: 'Atropin' },
        { key: 'medication.dopamin', label: 'Dopamin' },
        { key: 'medication.furosemid', label: 'Furosemid' },
        { key: 'medication.midazolam', label: 'Midazolam' },
        { key: 'medication.salbutamol', label: 'Salbutamol' },
        { key: 'medication.dekort', label: 'Dekort' },
        { key: 'medication.arveles', label: 'Arveles' },
        { key: 'medication.dikloron', label: 'Dikloron' }
      ]
    },
    {
      id: 'malzemeler',
      name: 'Malzemeler',
      icon: Package,
      color: 'yellow',
      fields: [
        { key: 'material.enjektor', label: 'Enjektör' },
        { key: 'material.iv_kateter', label: 'IV Kateter' },
        { key: 'material.serum_seti', label: 'Serum Seti' },
        { key: 'material.o2_maskesi', label: 'O2 Maskesi' },
        { key: 'material.sargi', label: 'Sargı' }
      ]
    },
    {
      id: 'sivi',
      name: 'Sıvı Tedavisi',
      icon: Droplet,
      color: 'blue',
      fields: [
        { key: 'fluid.nacl_09', label: '%0.9 NaCl' },
        { key: 'fluid.dextroz_5', label: '%5 Dekstroz' },
        { key: 'fluid.ringer_laktat', label: 'Ringer Laktat' }
      ]
    },
    {
      id: 'imzalar',
      name: 'İmzalar',
      icon: PenTool,
      color: 'slate',
      fields: [
        { key: 'sig.hekim_prm_name', label: 'Hekim/Paramedik Ad' },
        { key: 'sig.saglik_per_name', label: 'Sağlık Personeli Ad' },
        { key: 'sig.sofor_name', label: 'Şoför Ad' },
        { key: 'sig.teslim_adi', label: 'Teslim Alan Ad' },
        { key: 'sig.teslim_unvan', label: 'Teslim Alan Unvan' },
        { key: 'sig.hasta_adi', label: 'Hasta/Yakın Ad' }
      ]
    },
    {
      id: 'genel',
      name: 'Genel',
      icon: FileText,
      color: 'gray',
      fields: [
        { key: 'generalNotes', label: 'Genel Notlar' },
        { key: 'diagnosis', label: 'Ön Tanı' }
      ]
    }
  ];

  useEffect(() => {
    loadMapping();
  }, []);

  const loadMapping = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pdf/vaka-form-mapping');
      setMappingData(response.data);
      
      if (response.data.flat_mappings && Object.keys(response.data.flat_mappings).length > 0) {
        setDataMappings(response.data.flat_mappings);
      } else {
        const existing = {};
        Object.values(response.data.cell_mappings || {}).forEach(cells => {
          cells.forEach(cell => {
            existing[cell.cell] = cell.field;
          });
        });
        setDataMappings(existing);
      }
      
      if (response.data.logo) {
        setLogoUrl(response.data.logo.url || '');
        setLogoCell(response.data.logo.cell || 'A1');
      }
    } catch (error) {
      console.error('Mapping yüklenemedi:', error);
      toast.error('Mapping yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/pdf/vaka-form-mapping/bulk', {
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
        <Button onClick={handleSave} disabled={saving} className="bg-white text-amber-700 hover:bg-amber-50">
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
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
                    <td className="sticky left-0 z-10 bg-gray-200 border border-gray-300 text-center w-10 h-6">
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
                          className={`border border-gray-300 min-w-[50px] h-6 cursor-pointer transition-all
                            ${isActive ? 'ring-2 ring-amber-500 bg-amber-50' : ''}
                            ${mappedKey ? 'bg-green-50' : 'hover:bg-gray-50'}
                            ${isLogo ? 'bg-purple-100' : ''}
                          `}
                          onClick={(e) => handleCellClick(address, e)}
                          title={mappedKey ? `${fieldInfo.category}: ${fieldInfo.label}` : address}
                        >
                          {isLogo ? (
                            <div className="flex items-center justify-center"><Image className="h-3 w-3 text-purple-600" /></div>
                          ) : mappedKey ? (
                            <div className={`px-0.5 py-0 text-[9px] truncate ${getColorClass(fieldInfo.color)} rounded`}>
                              {fieldInfo.label.slice(0, 8)}
                            </div>
                          ) : null}
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
