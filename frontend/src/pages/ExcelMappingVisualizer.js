import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { excelTemplatesAPI } from '../api';
import api from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  Save, ArrowLeft, Search, X, Check, RefreshCw, 
  FileSpreadsheet, ZoomIn, ZoomOut, Grid3X3, Eye, 
  User, Clock, Heart, Truck, MapPin, FileText, 
  Pill, Package, PenTool, AlertCircle, Phone, Settings
} from 'lucide-react';

// Kategorize edilmiş veri alanları
const FIELD_CATEGORIES = [
  {
    id: 'hasta_bilgileri',
    name: 'Hasta Bilgileri',
    icon: User,
    color: 'blue',
    fields: [
      { key: 'patientName', label: 'Hasta Adı' },
      { key: 'patientSurname', label: 'Hasta Soyadı' },
      { key: 'patientFullName', label: 'Hasta Ad Soyad' },
      { key: 'patientAge', label: 'Yaş' },
      { key: 'patientBirthDate', label: 'Doğum Tarihi' },
      { key: 'patientGender', label: 'Cinsiyet' },
      { key: 'patientTC', label: 'T.C. Kimlik No' },
      { key: 'patientAddress', label: 'Adres' },
      { key: 'patientPhone', label: 'Telefon' },
      { key: 'patientComplaint', label: 'Şikayet' },
      { key: 'patientDiagnosis', label: 'Ön Tanı' },
      { key: 'chronicDiseases', label: 'Kronik Hastalıklar' },
      { key: 'allergies', label: 'Alerjiler' },
      { key: 'patientStatus', label: 'Hasta Durumu' }
    ]
  },
  {
    id: 'cagri_bilgileri',
    name: 'Çağrı Bilgileri',
    icon: Phone,
    color: 'purple',
    fields: [
      { key: 'callType', label: 'Çağrı Tipi' },
      { key: 'callReason', label: 'Çağrı Nedeni' },
      { key: 'callReasonDetail', label: 'Çağrı Nedeni Detay' },
      { key: 'referralSource', label: 'Vakayı Veren Kurum' },
      { key: 'sceneType', label: 'Olay Yeri Tipi' },
      { key: 'incidentLocation', label: 'Olay Yeri' }
    ]
  },
  {
    id: 'zaman_bilgileri',
    name: 'Zaman Bilgileri',
    icon: Clock,
    color: 'amber',
    fields: [
      { key: 'date', label: 'Tarih' },
      { key: 'callTime', label: 'Çağrı Saati' },
      { key: 'arrivalSceneTime', label: 'Olay Yerine Varış' },
      { key: 'arrivalPatientTime', label: 'Hastaya Varış' },
      { key: 'departureTime', label: 'Olay Yerinden Ayrılış' },
      { key: 'hospitalArrivalTime', label: 'Hastaneye Varış' },
      { key: 'returnStationTime', label: 'İstasyona Dönüş' }
    ]
  },
  {
    id: 'vital_bulgular',
    name: 'Vital Bulgular',
    icon: Heart,
    color: 'red',
    fields: [
      { key: 'vitalTime1', label: '1. Ölçüm Saati' },
      { key: 'vitalBP1', label: '1. Tansiyon' },
      { key: 'vitalPulse1', label: '1. Nabız' },
      { key: 'vitalSpO2_1', label: '1. SpO2' },
      { key: 'vitalResp1', label: '1. Solunum' },
      { key: 'vitalTemp1', label: '1. Ateş' },
      { key: 'vitalTime2', label: '2. Ölçüm Saati' },
      { key: 'vitalBP2', label: '2. Tansiyon' },
      { key: 'vitalPulse2', label: '2. Nabız' },
      { key: 'vitalSpO2_2', label: '2. SpO2' },
      { key: 'vitalResp2', label: '2. Solunum' },
      { key: 'vitalTemp2', label: '2. Ateş' },
      { key: 'vitalTime3', label: '3. Ölçüm Saati' },
      { key: 'vitalBP3', label: '3. Tansiyon' },
      { key: 'vitalPulse3', label: '3. Nabız' },
      { key: 'vitalSpO2_3', label: '3. SpO2' },
      { key: 'vitalResp3', label: '3. Solunum' },
      { key: 'vitalTemp3', label: '3. Ateş' },
      { key: 'bloodSugar', label: 'Kan Şekeri' },
      { key: 'bodyTemp', label: 'Vücut Sıcaklığı' }
    ]
  },
  {
    id: 'klinik_gozlemler',
    name: 'Klinik Gözlemler',
    icon: Eye,
    color: 'indigo',
    fields: [
      { key: 'consciousStatus', label: 'Bilinç Durumu' },
      { key: 'emotionalState', label: 'Duygu Durumu' },
      { key: 'pupil', label: 'Pupil' },
      { key: 'skin', label: 'Cilt/Deri' },
      { key: 'respirationType', label: 'Solunum Tipi' },
      { key: 'pulseType', label: 'Nabız Tipi' }
    ]
  },
  {
    id: 'gks',
    name: 'Glasgow Koma Skalası',
    icon: AlertCircle,
    color: 'orange',
    fields: [
      { key: 'gcsMotor', label: 'Motor Yanıt' },
      { key: 'gcsVerbal', label: 'Verbal Yanıt' },
      { key: 'gcsEye', label: 'Göz Açma' },
      { key: 'gcsTotal', label: 'GKS Toplam' }
    ]
  },
  {
    id: 'arac_bilgileri',
    name: 'Araç Bilgileri',
    icon: Truck,
    color: 'gray',
    fields: [
      { key: 'vehiclePlate', label: 'Plaka' },
      { key: 'vehicleType', label: 'Araç Tipi' },
      { key: 'startKm', label: 'Başlangıç KM' },
      { key: 'endKm', label: 'Bitiş KM' },
      { key: 'protocol112', label: '112 Protokol No' },
      { key: 'healmedyProtocol', label: 'ATN/Protokol No' },
      { key: 'caseCode', label: 'Vaka Kodu' },
      { key: 'stationCode', label: 'İstasyon Kodu' }
    ]
  },
  {
    id: 'nakil_bilgileri',
    name: 'Nakil Bilgileri',
    icon: MapPin,
    color: 'lime',
    fields: [
      { key: 'hospitalName', label: 'Nakledilen Hastane' },
      { key: 'hospitalProtocol', label: 'Hastane Protokol No' },
      { key: 'transferType', label: 'Transfer Tipi' },
      { key: 'pickupAddress', label: 'Alındığı Adres' },
      { key: 'isForensic', label: 'Adli Vaka' },
      { key: 'outcome', label: 'Sonuç' }
    ]
  },
  {
    id: 'personel_bilgileri',
    name: 'Personel Bilgileri',
    icon: User,
    color: 'cyan',
    fields: [
      { key: 'driverName', label: 'Şoför' },
      { key: 'paramedic1Name', label: 'Paramedik/Hemşire 1' },
      { key: 'paramedic2Name', label: 'Paramedik/Hemşire 2' },
      { key: 'doctorName', label: 'Doktor' },
      { key: 'attName', label: 'ATT' },
      { key: 'createdByName', label: 'Oluşturan' }
    ]
  },
  {
    id: 'ilaclar',
    name: 'Kullanılan İlaçlar',
    icon: Pill,
    color: 'green',
    fields: [
      { key: 'medication1', label: '1. İlaç' },
      { key: 'medication1Dose', label: '1. İlaç Dozu' },
      { key: 'medication1Route', label: '1. İlaç Yolu' },
      { key: 'medication2', label: '2. İlaç' },
      { key: 'medication2Dose', label: '2. İlaç Dozu' },
      { key: 'medication2Route', label: '2. İlaç Yolu' },
      { key: 'medicationsList', label: 'İlaç Listesi' }
    ]
  },
  {
    id: 'malzemeler',
    name: 'Kullanılan Malzemeler',
    icon: Package,
    color: 'yellow',
    fields: [
      { key: 'materialsList', label: 'Malzeme Listesi' },
      { key: 'proceduresList', label: 'İşlem Listesi' }
    ]
  },
  {
    id: 'imzalar',
    name: 'İmzalar',
    icon: PenTool,
    color: 'slate',
    fields: [
      { key: 'patientSignature', label: 'Hasta/Yakını İmzası' },
      { key: 'patientSignatureName', label: 'Hasta/Yakını Ad Soyad' },
      { key: 'staffSignature', label: 'Personel İmzası' },
      { key: 'doctorSignature', label: 'Doktor İmzası' },
      { key: 'driverSignature', label: 'Şoför İmzası' },
      { key: 'receiverSignature', label: 'Teslim Alan İmzası' },
      { key: 'receiverName', label: 'Teslim Alan Ad Soyad' },
      { key: 'receiverTitle', label: 'Teslim Alan Unvanı' }
    ]
  },
  {
    id: 'cpr',
    name: 'CPR Bilgileri',
    icon: Heart,
    color: 'pink',
    fields: [
      { key: 'cprBy', label: 'CPR Uygulayan' },
      { key: 'cprStart', label: 'CPR Başlangıç' },
      { key: 'cprEnd', label: 'CPR Bitiş' },
      { key: 'cprReason', label: 'CPR Bırakma Nedeni' }
    ]
  },
  {
    id: 'diger',
    name: 'Diğer',
    icon: FileText,
    color: 'gray',
    fields: [
      { key: 'notes', label: 'Notlar' },
      { key: 'icdCode', label: 'ICD-10 Kodu' },
      { key: 'icdDescription', label: 'ICD-10 Tanım' },
      { key: 'accidentVehicle1', label: 'Kaza Plaka 1' },
      { key: 'accidentVehicle2', label: 'Kaza Plaka 2' },
      { key: 'accidentVehicle3', label: 'Kaza Plaka 3' },
      { key: 'accidentVehicle4', label: 'Kaza Plaka 4' },
      { key: 'triageCode', label: 'Triyaj Kodu' }
    ]
  }
];

// Tüm alanları düz liste olarak al
const ALL_FIELDS = FIELD_CATEGORIES.flatMap(cat => 
  cat.fields.map(f => ({ ...f, category: cat.name, categoryId: cat.id, color: cat.color }))
);

const ExcelMappingVisualizer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(null);
  const [cells, setCells] = useState({});
  const [mergedCells, setMergedCells] = useState([]);
  const [dataMappings, setDataMappings] = useState({});
  const [maxRow, setMaxRow] = useState(80);
  const [maxCol, setMaxCol] = useState(27);
  const [zoom, setZoom] = useState(80);
  const [columnWidths, setColumnWidths] = useState({});
  const [rowHeights, setRowHeights] = useState({});
  
  // Inline dropdown state
  const [activeCell, setActiveCell] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sütun harfi al
  const getColumnLetter = (col) => {
    let result = '';
    while (col > 0) {
      col--;
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26);
    }
    return result;
  };

  // Hücre adresi oluştur
  const getCellAddress = (row, col) => `${getColumnLetter(col)}${row}`;

  // Template yükle
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await excelTemplatesAPI.getById(id);
        const data = response.data;
        
        setTemplate(data);
        setMaxRow(data.max_row || 80);
        setMaxCol(data.max_column || 27);
        setMergedCells(data.merged_cells || []);
        setRowHeights(data.row_heights || {});
        setColumnWidths(data.column_widths || {});
        setDataMappings(data.data_mappings || {});
        
        // Hücreleri obje olarak düzenle
        const cellsObj = {};
        (data.cells || []).forEach(cell => {
          cellsObj[cell.address] = cell;
        });
        setCells(cellsObj);
        
      } catch (error) {
        console.error('Template yüklenemedi:', error);
        toast.error('Şablon yüklenemedi');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadTemplate();
    }
  }, [id]);

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveCell(null);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dropdown açıldığında search input'a focus
  useEffect(() => {
    if (activeCell && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [activeCell]);

  // Hücreye tıklama
  const handleCellClick = (row, col, event) => {
    const address = getCellAddress(row, col);
    const rect = event.currentTarget.getBoundingClientRect();
    
    // Dropdown pozisyonunu hesapla
    setDropdownPosition({
      x: rect.left,
      y: rect.bottom + 4
    });
    
    setActiveCell(address);
    setSearchQuery('');
  };

  // Alan seçimi
  const handleFieldSelect = (field) => {
    if (!activeCell) return;
    
    setDataMappings(prev => ({
      ...prev,
      [activeCell]: field.key
    }));
    
    toast.success(`${activeCell} → ${field.label}`);
    setActiveCell(null);
    setSearchQuery('');
  };

  // Mapping kaldır
  const handleRemoveMapping = (address) => {
    setDataMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[address];
      return newMappings;
    });
    toast.success(`${address} eşlemesi kaldırıldı`);
    setActiveCell(null);
  };

  // Kaydet
  const handleSave = async () => {
    setSaving(true);
    try {
      await excelTemplatesAPI.update(id, {
        ...template,
        data_mappings: dataMappings
      });
      toast.success('Eşlemeler kaydedildi!');
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  // Arama filtresi
  const filteredFields = searchQuery 
    ? ALL_FIELDS.filter(f => 
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_FIELDS;

  // Birleşik hücre kontrolü
  const getMergedCellInfo = (row, col) => {
    for (const merged of mergedCells) {
      if (row >= merged.min_row && row <= merged.max_row &&
          col >= merged.min_col && col <= merged.max_col) {
        return {
          isMerged: true,
          isOrigin: row === merged.min_row && col === merged.min_col,
          rowSpan: merged.max_row - merged.min_row + 1,
          colSpan: merged.max_col - merged.min_col + 1,
          merged
        };
      }
    }
    return { isMerged: false };
  };

  // Renk al
  const getColorClass = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700 border-blue-300',
      purple: 'bg-purple-100 text-purple-700 border-purple-300',
      amber: 'bg-amber-100 text-amber-700 border-amber-300',
      red: 'bg-red-100 text-red-700 border-red-300',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
      orange: 'bg-orange-100 text-orange-700 border-orange-300',
      gray: 'bg-gray-100 text-gray-700 border-gray-300',
      lime: 'bg-lime-100 text-lime-700 border-lime-300',
      cyan: 'bg-cyan-100 text-cyan-700 border-cyan-300',
      green: 'bg-green-100 text-green-700 border-green-300',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      slate: 'bg-slate-100 text-slate-700 border-slate-300',
      pink: 'bg-pink-100 text-pink-700 border-pink-300'
    };
    return colors[color] || colors.gray;
  };

  // Eşlenmiş alan bilgisi
  const getMappedFieldInfo = (address) => {
    const fieldKey = dataMappings[address];
    if (!fieldKey) return null;
    return ALL_FIELDS.find(f => f.key === fieldKey);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/form-templates')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Geri
          </Button>
          
          <div className="h-6 border-r mx-2" />
          
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-amber-600" />
            <div>
              <h1 className="font-semibold text-lg">{template?.name || 'Excel Mapping'}</h1>
              <p className="text-xs text-gray-500">Hücrelere tıklayarak veri eşleştirmesi yapın</p>
            </div>
          </div>
          
          <Badge className="bg-amber-100 text-amber-700">
            <FileSpreadsheet className="h-3 w-3 mr-1" /> 
            {Object.keys(dataMappings).length} eşleme
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(40, z - 10))} className="h-7 w-7 p-0">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-12 text-center font-medium">{zoom}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(150, z + 10))} className="h-7 w-7 p-0">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="h-6 border-r mx-1" />
          
          <Button variant="outline" onClick={() => navigate(`/dashboard/form-templates/excel/${id}`)}>
            <Settings className="h-4 w-4 mr-1" /> Şablonu Düzenle
          </Button>
          
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {/* Bilgi Bandı */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b px-4 py-2 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-amber-700">
          <Eye className="h-4 w-4" />
          <strong>İpucu:</strong> Bir hücreye tıklayın, ardından açılan listeden veri alanı seçin
        </span>
        <div className="flex-1" />
        <span className="text-gray-500">
          Toplam: {maxRow} satır × {maxCol} sütun
        </span>
      </div>

      {/* Grid Area */}
      <div className="flex-1 overflow-auto p-4">
        <div 
          className="inline-block bg-white shadow-lg rounded-lg overflow-hidden"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          <table className="border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-gray-200 border border-gray-300 w-10 h-8 text-xs font-medium">#</th>
                {Array.from({ length: maxCol }, (_, i) => (
                  <th 
                    key={i} 
                    className="sticky top-0 z-10 bg-gray-200 border border-gray-300 text-xs font-medium px-2 h-8"
                    style={{ minWidth: columnWidths[getColumnLetter(i + 1)] || 60 }}
                  >
                    {getColumnLetter(i + 1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRow }, (_, rowIdx) => {
                const row = rowIdx + 1;
                return (
                  <tr key={row}>
                    <td className="sticky left-0 z-10 bg-gray-200 border border-gray-300 text-xs text-center font-medium w-10">
                      {row}
                    </td>
                    {Array.from({ length: maxCol }, (_, colIdx) => {
                      const col = colIdx + 1;
                      const address = getCellAddress(row, col);
                      const cell = cells[address];
                      const mergeInfo = getMergedCellInfo(row, col);
                      const mappedField = getMappedFieldInfo(address);
                      const isActive = activeCell === address;
                      
                      // Birleşik hücrenin origin değilse gösterme
                      if (mergeInfo.isMerged && !mergeInfo.isOrigin) {
                        return null;
                      }
                      
                      return (
                        <td
                          key={col}
                          rowSpan={mergeInfo.isOrigin ? mergeInfo.rowSpan : 1}
                          colSpan={mergeInfo.isOrigin ? mergeInfo.colSpan : 1}
                          className={`
                            border border-gray-300 text-xs relative cursor-pointer transition-all
                            ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                            ${mappedField ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'hover:bg-gray-50'}
                          `}
                          style={{
                            minWidth: columnWidths[getColumnLetter(col)] || 60,
                            height: rowHeights[row] || 24,
                            fontWeight: cell?.font?.bold ? 'bold' : 'normal',
                            fontSize: cell?.font?.size ? `${Math.max(8, cell.font.size * 0.8)}px` : '10px',
                            textAlign: cell?.alignment?.horizontal || 'left',
                            padding: '2px 4px'
                          }}
                          onClick={(e) => handleCellClick(row, col, e)}
                          title={mappedField ? `${mappedField.label} (${mappedField.key})` : 'Tıklayarak alan eşleyin'}
                        >
                          {/* Hücre içeriği */}
                          <div className="flex items-center gap-1 min-h-[18px]">
                            <span className="flex-1 truncate">{cell?.value || ''}</span>
                            {mappedField && (
                              <Badge 
                                className={`text-[9px] px-1 py-0 h-4 shrink-0 ${getColorClass(mappedField.color)}`}
                                title={`${mappedField.category}: ${mappedField.label}`}
                              >
                                {mappedField.label.slice(0, 10)}...
                              </Badge>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Dropdown */}
      {activeCell && (
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 z-50 w-80 max-h-96 flex flex-col"
          style={{
            left: Math.min(dropdownPosition.x, window.innerWidth - 340),
            top: Math.min(dropdownPosition.y, window.innerHeight - 420)
          }}
        >
          {/* Header */}
          <div className="p-3 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">
                Hücre: <span className="text-blue-600 font-mono">{activeCell}</span>
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => { setActiveCell(null); setSearchQuery(''); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Alan ara... (tarih, hasta, vital...)"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Mevcut eşleme varsa göster */}
          {dataMappings[activeCell] && (
            <div className="p-2 bg-green-50 border-b flex items-center justify-between">
              <span className="text-sm text-green-700">
                Mevcut: <strong>{getMappedFieldInfo(activeCell)?.label}</strong>
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleRemoveMapping(activeCell)}
              >
                <X className="h-3 w-3 mr-1" /> Kaldır
              </Button>
            </div>
          )}

          {/* Alan Listesi */}
          <div className="flex-1 overflow-y-auto">
            {FIELD_CATEGORIES.map(category => {
              const categoryFields = filteredFields.filter(f => f.categoryId === category.id);
              if (categoryFields.length === 0) return null;
              
              const IconComponent = category.icon;
              
              return (
                <div key={category.id}>
                  <div className={`px-3 py-1.5 text-xs font-semibold sticky top-0 flex items-center gap-1.5 ${getColorClass(category.color)}`}>
                    <IconComponent className="h-3 w-3" />
                    {category.name}
                  </div>
                  {categoryFields.map(field => (
                    <div
                      key={field.key}
                      className={`
                        px-3 py-2 cursor-pointer flex items-center justify-between text-sm
                        hover:bg-blue-50 transition-colors
                        ${dataMappings[activeCell] === field.key ? 'bg-green-100' : ''}
                      `}
                      onClick={() => handleFieldSelect(field)}
                    >
                      <div>
                        <div className="font-medium">{field.label}</div>
                        <div className="text-xs text-gray-400 font-mono">{field.key}</div>
                      </div>
                      {dataMappings[activeCell] === field.key && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            
            {filteredFields.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                "{searchQuery}" için sonuç bulunamadı
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sağ tarafta eşleme özeti */}
      {Object.keys(dataMappings).length > 0 && (
        <div className="fixed right-4 top-32 w-64 bg-white rounded-lg shadow-lg border max-h-[60vh] overflow-hidden flex flex-col z-30">
          <div className="p-3 border-b bg-gradient-to-r from-green-50 to-emerald-50">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              Eşlemeler ({Object.keys(dataMappings).length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {Object.entries(dataMappings).map(([cell, fieldKey]) => {
              const field = ALL_FIELDS.find(f => f.key === fieldKey);
              return (
                <div 
                  key={cell} 
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs hover:bg-gray-100 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600">{cell}</span>
                    <span className="text-gray-400">→</span>
                    <span className="truncate">{field?.label || fieldKey}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                    onClick={() => handleRemoveMapping(cell)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelMappingVisualizer;

