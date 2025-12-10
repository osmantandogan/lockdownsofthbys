import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formTemplatesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Save, Plus, Trash2, GripVertical, Settings, 
  ChevronLeft, ArrowLeft, Grid, Table, X, Move,
  Rows, Columns, Merge, Split, FileDown, Eye,
  User, Clock, Heart, Stethoscope, FileText, Pill,
  Truck, MapPin, Phone, AlertCircle, PenTool, Camera
} from 'lucide-react';

// A4 boyutları (piksel, 96 DPI)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const SCALE = 0.85;
const HEADER_HEIGHT = 50;
const FOOTER_HEIGHT = 30;

// Hazır kutucuk tanımları - Vaka Formundan
const BLOCK_DEFINITIONS = [
  {
    id: 'hasta_bilgileri',
    name: 'Hasta Bilgileri',
    icon: User,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    fields: ['TC Kimlik No', 'Ad', 'Soyad', 'Yaş', 'Doğum Tarihi', 'Cinsiyet'],
    defaultHeight: 2,
    defaultWidth: 2
  },
  {
    id: 'cagri_bilgileri',
    name: 'Çağrı Bilgileri',
    icon: Phone,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    fields: ['Çağrı Zamanı', 'Çağrı Tipi', 'Çağrı Nedeni', 'Vakayı Veren Kurum'],
    defaultHeight: 2,
    defaultWidth: 2
  },
  {
    id: 'zaman_bilgileri',
    name: 'Zaman Bilgileri',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    fields: ['Çağrı Saati', 'Olay Yerine Varış', 'Hastaya Varış', 'Olay Yerinden Ayrılış', 'Hastaneye Varış', 'İstasyona Dönüş'],
    defaultHeight: 2,
    defaultWidth: 3
  },
  {
    id: 'vital_bulgular_1',
    name: 'Vital Bulgular 1',
    icon: Heart,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: ['Saat', 'Tansiyon', 'Nabız', 'SpO2', 'Solunum', 'Ateş'],
    defaultHeight: 1,
    defaultWidth: 3
  },
  {
    id: 'vital_bulgular_2',
    name: 'Vital Bulgular 2',
    icon: Heart,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: ['Saat', 'Tansiyon', 'Nabız', 'SpO2', 'Solunum', 'Ateş'],
    defaultHeight: 1,
    defaultWidth: 3
  },
  {
    id: 'vital_bulgular_3',
    name: 'Vital Bulgular 3',
    icon: Heart,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: ['Saat', 'Tansiyon', 'Nabız', 'SpO2', 'Solunum', 'Ateş'],
    defaultHeight: 1,
    defaultWidth: 3
  },
  {
    id: 'klinik_gozlemler',
    name: 'Klinik Gözlemler',
    icon: Eye,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    fields: ['Bilinç Durumu', 'Duygu Durumu', 'Pupil', 'Cilt', 'Solunum Tipi', 'Nabız Tipi'],
    defaultHeight: 2,
    defaultWidth: 2
  },
  {
    id: 'gks_skorlari',
    name: 'GKS (Glasgow)',
    icon: AlertCircle,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    fields: ['Motor Yanıt', 'Verbal Yanıt', 'Göz Açma', 'Toplam Skor'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'anamnez',
    name: 'Anamnez/Şikayet',
    icon: FileText,
    color: 'bg-teal-100 text-teal-700 border-teal-300',
    fields: ['Başvuru Şikayeti', 'Öykü', 'Kronik Hastalıklar'],
    defaultHeight: 2,
    defaultWidth: 3
  },
  {
    id: 'fizik_muayene',
    name: 'Fizik Muayene',
    icon: Stethoscope,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    fields: ['Fizik Muayene Bulguları'],
    defaultHeight: 2,
    defaultWidth: 3
  },
  {
    id: 'uygulanan_islemler',
    name: 'Uygulanan İşlemler',
    icon: Settings,
    color: 'bg-violet-100 text-violet-700 border-violet-300',
    fields: ['Maske ile hava yolu', 'Airway', 'Entübasyon', 'LMA', 'CPR', 'Defibrilasyon', 'Monitörizasyon', 'Kanama kontrolü', 'Atel uygulaması', 'Servical collar', 'Sırt tahtası', 'Diğer işlemler'],
    defaultHeight: 3,
    defaultWidth: 3
  },
  {
    id: 'cpr_bilgileri',
    name: 'CPR Bilgileri',
    icon: Heart,
    color: 'bg-pink-100 text-pink-700 border-pink-300',
    fields: ['CPR Uygulayan', 'CPR Başlangıç', 'CPR Bitiş', 'CPR Nedeni'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'nakil_durumu',
    name: 'Nakil Durumu',
    icon: Truck,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    fields: ['Nakil Tipi', 'Transfer Tipi (İlçe içi/dışı/il dışı)'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'nakil_hastanesi',
    name: 'Nakil Hastanesi',
    icon: MapPin,
    color: 'bg-lime-100 text-lime-700 border-lime-300',
    fields: ['Hastane Adı', 'Hastane Protokol No'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'healmedy_lokasyonu',
    name: 'Healmedy Lokasyonu',
    icon: MapPin,
    color: 'bg-sky-100 text-sky-700 border-sky-300',
    fields: ['Osman Gazi/FPU', 'Green Zone/Rönesans', 'Batı-Kuzey/İSG BİNA', 'Red Zone/Kara Tesisleri', 'Doğu Rıhtımı'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'arac_bilgileri',
    name: 'Araç Bilgileri',
    icon: Truck,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    fields: ['Plaka', 'Başlangıç KM', 'Bitiş KM', '112 Protokol No'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'ekip_bilgileri',
    name: 'Ekip Bilgileri',
    icon: User,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    fields: ['Şoför', 'Paramedik', 'ATT', 'Hemşire'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'kullanilan_ilaclar',
    name: 'Kullanılan İlaçlar',
    icon: Pill,
    color: 'bg-green-100 text-green-700 border-green-300',
    fields: ['İlaç Adı', 'Doz', 'Uygulama Yolu', 'Saat'],
    defaultHeight: 2,
    defaultWidth: 3
  },
  {
    id: 'kullanilan_malzemeler',
    name: 'Kullanılan Malzemeler',
    icon: Settings,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    fields: ['Malzeme Listesi'],
    defaultHeight: 2,
    defaultWidth: 2
  },
  {
    id: 'tani_icd10',
    name: 'Tanı (ICD-10)',
    icon: FileText,
    color: 'bg-rose-100 text-rose-700 border-rose-300',
    fields: ['ICD-10 Kodu', 'Tanı Açıklaması'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'imza_hasta',
    name: 'İmza - Hasta/Yakını',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: ['Ad Soyad', 'İmza'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'imza_doktor',
    name: 'İmza - Doktor/Paramedik',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: ['Ad Soyad', 'İmza'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'imza_saglik_personeli',
    name: 'İmza - Sağlık Personeli',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: ['Ad Soyad', 'İmza'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'imza_sofor',
    name: 'İmza - Şoför/Pilot',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: ['Ad Soyad', 'İmza'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'imza_teslim_alan',
    name: 'İmza - Teslim Alan',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: ['Ad Soyad', 'İmza'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'adli_vaka',
    name: 'Adli Vaka',
    icon: AlertCircle,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: ['Adli Vaka mı? (Evet/Hayır)'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'vaka_sonucu',
    name: 'Vaka Sonucu',
    icon: FileText,
    color: 'bg-green-100 text-green-700 border-green-300',
    fields: ['Sonuç Açıklaması'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'genel_notlar',
    name: 'Genel Notlar',
    icon: FileText,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    fields: ['Serbest not alanı'],
    defaultHeight: 2,
    defaultWidth: 3
  },
  {
    id: 'kaza_bilgileri',
    name: 'Kaza Bilgileri',
    icon: AlertCircle,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    fields: ['Araç Plaka 1', 'Araç Plaka 2', 'Araç Plaka 3', 'Araç Plaka 4'],
    defaultHeight: 1,
    defaultWidth: 2
  },
  {
    id: 'izolasyon',
    name: 'İzolasyon',
    icon: AlertCircle,
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    fields: ['İzolasyon Gereksinimleri'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'kan_sekeri',
    name: 'Kan Şekeri',
    icon: Heart,
    color: 'bg-pink-100 text-pink-700 border-pink-300',
    fields: ['Kan Şekeri (mg/dL)'],
    defaultHeight: 1,
    defaultWidth: 1
  },
  {
    id: 'logo_baslik',
    name: 'Logo/Başlık',
    icon: Camera,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    fields: ['Logo', 'Form Başlığı', 'Alt Başlık'],
    defaultHeight: 1,
    defaultWidth: 4
  }
];

const TableTemplateEditor = () => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const gridRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  // Grid yapısı
  const [template, setTemplate] = useState({
    name: 'Yeni Tablo Şablonu',
    description: '',
    template_type: 'table',
    rows: 20,
    columns: 6,
    cells: {}, // { "row-col": { blockId, rowSpan, colSpan } }
    header: { enabled: true, text: 'VAKA FORMU', logo: null },
    footer: { enabled: true, text: 'Healmedy Sağlık Hizmetleri' },
    usage_types: ['vaka_formu'],
    is_default: false
  });

  useEffect(() => {
    if (templateId && templateId !== 'new') {
      loadTemplate(templateId);
    } else {
      setLoading(false);
    }
  }, [templateId]);

  const loadTemplate = async (id) => {
    try {
      const response = await formTemplatesAPI.getById(id);
      setTemplate(response.data);
    } catch (error) {
      console.error('Şablon yüklenemedi:', error);
      toast.error('Şablon yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!template.name.trim()) {
      toast.error('Şablon adı gerekli');
      return;
    }

    setSaving(true);
    try {
      if (templateId && templateId !== 'new') {
        await formTemplatesAPI.update(templateId, template);
        toast.success('Şablon güncellendi');
      } else {
        const response = await formTemplatesAPI.create(template);
        toast.success('Şablon oluşturuldu');
        navigate(`/dashboard/form-templates/table/${response.data.id}`);
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (block) => {
    setDraggedBlock(block);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (rowIndex, colIndex) => {
    if (!draggedBlock) return;
    
    const cellKey = `${rowIndex}-${colIndex}`;
    const newCells = { ...template.cells };
    
    // Önceki hücreleri temizle (aynı blok varsa)
    Object.keys(newCells).forEach(key => {
      if (newCells[key]?.blockId === draggedBlock.id) {
        delete newCells[key];
      }
    });
    
    // Yeni hücreyi ekle
    newCells[cellKey] = {
      blockId: draggedBlock.id,
      blockName: draggedBlock.name,
      rowSpan: draggedBlock.defaultHeight,
      colSpan: draggedBlock.defaultWidth,
      fields: draggedBlock.fields,
      color: draggedBlock.color
    };
    
    setTemplate({ ...template, cells: newCells });
    setDraggedBlock(null);
  };

  const handleCellClick = (rowIndex, colIndex) => {
    setSelectedCell({ row: rowIndex, col: colIndex });
  };

  const removeCell = (cellKey) => {
    const newCells = { ...template.cells };
    delete newCells[cellKey];
    setTemplate({ ...template, cells: newCells });
  };

  const updateCellSpan = (cellKey, field, value) => {
    const newCells = { ...template.cells };
    if (newCells[cellKey]) {
      newCells[cellKey][field] = parseInt(value) || 1;
      setTemplate({ ...template, cells: newCells });
    }
  };

  const addRow = () => {
    setTemplate({ ...template, rows: template.rows + 1 });
  };

  const removeRow = () => {
    if (template.rows > 5) {
      setTemplate({ ...template, rows: template.rows - 1 });
    }
  };

  const addColumn = () => {
    if (template.columns < 10) {
      setTemplate({ ...template, columns: template.columns + 1 });
    }
  };

  const removeColumn = () => {
    if (template.columns > 3) {
      setTemplate({ ...template, columns: template.columns - 1 });
    }
  };

  // Hücrenin başka bir hücre tarafından kapsanıp kapsanmadığını kontrol et
  const isCellCovered = (rowIndex, colIndex) => {
    for (const [key, cell] of Object.entries(template.cells)) {
      const [startRow, startCol] = key.split('-').map(Number);
      const endRow = startRow + (cell.rowSpan || 1) - 1;
      const endCol = startCol + (cell.colSpan || 1) - 1;
      
      if (rowIndex >= startRow && rowIndex <= endRow && 
          colIndex >= startCol && colIndex <= endCol) {
        if (rowIndex === startRow && colIndex === startCol) {
          return { covered: false, cell, key };
        }
        return { covered: true };
      }
    }
    return { covered: false };
  };

  const cellWidth = (A4_WIDTH * SCALE) / template.columns;
  const cellHeight = ((A4_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT) * SCALE) / template.rows;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard/form-templates')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Geri
          </Button>
          <div>
            <Input
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 p-0 h-auto"
              placeholder="Şablon adı..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-4 w-4 mr-1" /> Ayarlar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sol Panel - Kutucuklar */}
        <div className="w-72 bg-white border-r overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Grid className="h-4 w-4" /> Hazır Kutucuklar
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Kutucukları tabloya sürükleyin
            </p>
            
            <div className="space-y-2">
              {BLOCK_DEFINITIONS.map((block) => {
                const Icon = block.icon;
                const isUsed = Object.values(template.cells).some(c => c.blockId === block.id);
                
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => handleDragStart(block)}
                    className={`p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all ${block.color} ${
                      isUsed ? 'opacity-50' : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 opacity-50" />
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{block.name}</span>
                      {isUsed && <Badge className="ml-auto text-xs">Eklendi</Badge>}
                    </div>
                    <div className="mt-1 text-xs opacity-70">
                      {block.fields.slice(0, 3).join(', ')}
                      {block.fields.length > 3 && ` +${block.fields.length - 3}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Merkez - Tablo Grid */}
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
          <div 
            className="bg-white shadow-xl rounded-lg overflow-hidden"
            style={{ 
              width: A4_WIDTH * SCALE,
              minHeight: A4_HEIGHT * SCALE
            }}
          >
            {/* Header */}
            {template.header.enabled && (
              <div 
                className="bg-gray-800 text-white flex items-center justify-center font-bold text-lg"
                style={{ height: HEADER_HEIGHT * SCALE }}
              >
                {template.header.text || 'FORM BAŞLIĞI'}
              </div>
            )}
            
            {/* Grid */}
            <div 
              ref={gridRef}
              className="relative"
              style={{ 
                display: 'grid',
                gridTemplateColumns: `repeat(${template.columns}, 1fr)`,
                gridTemplateRows: `repeat(${template.rows}, ${cellHeight}px)`,
                gap: '1px',
                backgroundColor: '#e5e7eb'
              }}
            >
              {Array.from({ length: template.rows }).map((_, rowIndex) =>
                Array.from({ length: template.columns }).map((_, colIndex) => {
                  const cellCheck = isCellCovered(rowIndex, colIndex);
                  
                  if (cellCheck.covered) {
                    return null; // Bu hücre başka bir hücre tarafından kapsanıyor
                  }
                  
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const cellData = cellCheck.cell;
                  
                  if (cellData) {
                    const blockDef = BLOCK_DEFINITIONS.find(b => b.id === cellData.blockId);
                    const Icon = blockDef?.icon || FileText;
                    
                    return (
                      <div
                        key={cellKey}
                        className={`relative group ${cellData.color || 'bg-gray-50'} border border-gray-300 overflow-hidden`}
                        style={{
                          gridRow: `span ${cellData.rowSpan || 1}`,
                          gridColumn: `span ${cellData.colSpan || 1}`,
                        }}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                      >
                        <div className="p-2 h-full">
                          <div className="flex items-center gap-1 mb-1">
                            <Icon className="h-3 w-3" />
                            <span className="font-semibold text-xs truncate">{cellData.blockName}</span>
                          </div>
                          <div className="text-[9px] opacity-70 line-clamp-3">
                            {cellData.fields?.join(' | ')}
                          </div>
                        </div>
                        
                        {/* Boyut ayarları */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-5 w-5 p-0"
                            onClick={(e) => { e.stopPropagation(); removeCell(cellKey); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Span kontrolleri */}
                        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white rounded px-1">
                          <select
                            className="text-[10px] border-none bg-transparent"
                            value={cellData.colSpan || 1}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateCellSpan(cellKey, 'colSpan', e.target.value)}
                          >
                            {[1, 2, 3, 4, 5, 6].map(n => (
                              <option key={n} value={n}>{n}K</option>
                            ))}
                          </select>
                          <select
                            className="text-[10px] border-none bg-transparent"
                            value={cellData.rowSpan || 1}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateCellSpan(cellKey, 'rowSpan', e.target.value)}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                              <option key={n} value={n}>{n}S</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={cellKey}
                      className={`bg-white border border-dashed border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors ${
                        draggedBlock ? 'cursor-copy' : 'cursor-pointer'
                      }`}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(rowIndex, colIndex)}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      <div className="h-full flex items-center justify-center text-gray-300 text-xs">
                        {draggedBlock && '+'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Footer */}
            {template.footer.enabled && (
              <div 
                className="bg-gray-100 text-gray-600 flex items-center justify-center text-xs"
                style={{ height: FOOTER_HEIGHT * SCALE }}
              >
                {template.footer.text || 'Alt bilgi'}
              </div>
            )}
          </div>
        </div>

        {/* Sağ Panel - Kontroller */}
        <div className="w-56 bg-white border-l p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Tablo Ayarları</h3>
          
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-500">Satır Sayısı</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" variant="outline" onClick={removeRow}>-</Button>
                <span className="font-mono w-12 text-center">{template.rows}</span>
                <Button size="sm" variant="outline" onClick={addRow}>+</Button>
              </div>
            </div>
            
            <div>
              <Label className="text-xs text-gray-500">Sütun Sayısı</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" variant="outline" onClick={removeColumn}>-</Button>
                <span className="font-mono w-12 text-center">{template.columns}</span>
                <Button size="sm" variant="outline" onClick={addColumn}>+</Button>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-xs text-gray-500">Kullanılan Kutucuklar</Label>
              <div className="mt-2 space-y-1">
                {Object.values(template.cells).map((cell, idx) => (
                  <div key={idx} className="text-xs bg-gray-50 px-2 py-1 rounded flex justify-between">
                    <span>{cell.blockName}</span>
                    <span className="text-gray-400">{cell.colSpan}x{cell.rowSpan}</span>
                  </div>
                ))}
                {Object.keys(template.cells).length === 0 && (
                  <p className="text-xs text-gray-400">Henüz kutucuk eklenmedi</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ayarlar Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Şablon Ayarları</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Şablon Adı</Label>
              <Input
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea
                value={template.description}
                onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Başlık Metni</Label>
              <Input
                value={template.header.text}
                onChange={(e) => setTemplate({ 
                  ...template, 
                  header: { ...template.header, text: e.target.value } 
                })}
              />
            </div>
            <div>
              <Label>Alt Bilgi</Label>
              <Input
                value={template.footer.text}
                onChange={(e) => setTemplate({ 
                  ...template, 
                  footer: { ...template.footer, text: e.target.value } 
                })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Varsayılan Şablon</Label>
              <Switch
                checked={template.is_default}
                onCheckedChange={(v) => setTemplate({ ...template, is_default: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TableTemplateEditor;

