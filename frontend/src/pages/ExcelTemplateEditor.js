import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { excelTemplatesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Save, ArrowLeft, Plus, Minus, Bold, Italic, 
  AlignLeft, AlignCenter, AlignRight, Merge, 
  Paintbrush, Type, Undo, Redo, ZoomIn, ZoomOut,
  FileSpreadsheet, Download, Eye, Trash2, Settings
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const ExcelTemplateEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const gridRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(null);
  
  // Grid state
  const [cells, setCells] = useState({});
  const [mergedCells, setMergedCells] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [rowHeights, setRowHeights] = useState({});
  const [columnWidths, setColumnWidths] = useState({});
  
  // Editor settings
  const [zoom, setZoom] = useState(100);
  const [showGridLines, setShowGridLines] = useState(true);
  const [maxRow, setMaxRow] = useState(100);
  const [maxCol, setMaxCol] = useState(30);
  
  // Dialogs
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [dataMappings, setDataMappings] = useState({});
  
  // Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Helper: Sütun harfi al
  const getColumnLetter = (col) => {
    let result = '';
    while (col > 0) {
      col--;
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26);
    }
    return result;
  };

  // Helper: Hücre adresi oluştur
  const getCellAddress = (row, col) => `${getColumnLetter(col)}${row}`;

  // Template yükle
  useEffect(() => {
    const loadTemplate = async () => {
      if (id === 'new') {
        // Yeni şablon
        setTemplate({
          name: 'Yeni Excel Şablonu',
          description: '',
          max_row: 100,
          max_column: 30
        });
        setMaxRow(100);
        setMaxCol(30);
        setLoading(false);
        return;
      }

      try {
        const response = await excelTemplatesAPI.getById(id);
        const data = response.data;
        
        setTemplate(data);
        setMaxRow(data.max_row || 100);
        setMaxCol(data.max_column || 30);
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

    loadTemplate();
  }, [id]);

  // Hücre değerini güncelle
  const updateCell = useCallback((address, updates) => {
    setCells(prev => {
      const current = prev[address] || { address, value: '' };
      return {
        ...prev,
        [address]: { ...current, ...updates }
      };
    });
  }, []);

  // Hücre seç
  const handleCellClick = (row, col, event) => {
    const address = getCellAddress(row, col);
    
    if (event.shiftKey && selectedCell) {
      // Range seçimi
      const startRow = Math.min(selectedCell.row, row);
      const endRow = Math.max(selectedCell.row, row);
      const startCol = Math.min(selectedCell.col, col);
      const endCol = Math.max(selectedCell.col, col);
      
      setSelectedRange({ startRow, endRow, startCol, endCol });
    } else {
      setSelectedCell({ row, col, address });
      setSelectedRange(null);
    }
  };

  // Hücre değeri değiştir
  const handleCellChange = (row, col, value) => {
    const address = getCellAddress(row, col);
    updateCell(address, { 
      value,
      row,
      col,
      col_letter: getColumnLetter(col)
    });
  };

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

  // Seçili hücreleri birleştir
  const handleMergeCells = () => {
    if (!selectedRange) {
      toast.error('Birleştirmek için birden fazla hücre seçin (Shift+Click)');
      return;
    }

    const newMerged = {
      range: `${getCellAddress(selectedRange.startRow, selectedRange.startCol)}:${getCellAddress(selectedRange.endRow, selectedRange.endCol)}`,
      min_row: selectedRange.startRow,
      max_row: selectedRange.endRow,
      min_col: selectedRange.startCol,
      max_col: selectedRange.endCol
    };

    setMergedCells(prev => [...prev, newMerged]);
    setSelectedRange(null);
    toast.success('Hücreler birleştirildi');
  };

  // Stil uygula
  const applyStyle = (styleType, value) => {
    if (!selectedCell) return;

    const address = selectedCell.address;
    const current = cells[address] || {};
    
    let updates = {};
    
    switch (styleType) {
      case 'bold':
        updates = { font: { ...current.font, bold: !current.font?.bold } };
        break;
      case 'italic':
        updates = { font: { ...current.font, italic: !current.font?.italic } };
        break;
      case 'align':
        updates = { alignment: { ...current.alignment, horizontal: value } };
        break;
      case 'fill':
        updates = { fill: { color: value } };
        break;
      default:
        break;
    }

    updateCell(address, updates);
  };

  // Kaydet
  const handleSave = async () => {
    if (!template?.name) {
      toast.error('Şablon adı gerekli');
      return;
    }

    setSaving(true);
    
    try {
      const cellsArray = Object.values(cells).filter(c => c.value || c.font || c.fill || c.border);
      
      const data = {
        name: template.name,
        description: template.description,
        usage_types: template.usage_types || ['vaka_formu'],
        max_row: maxRow,
        max_column: maxCol,
        cells: cellsArray,
        merged_cells: mergedCells,
        row_heights: rowHeights,
        column_widths: columnWidths,
        data_mappings: dataMappings
      };

      if (id === 'new') {
        const response = await excelTemplatesAPI.create(data);
        toast.success('Şablon oluşturuldu');
        navigate(`/dashboard/form-templates/excel/${response.data.id}`);
      } else {
        await excelTemplatesAPI.update(id, data);
        toast.success('Şablon kaydedildi');
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Şablon kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  // Veri eşleştirme alanları
  const dataFields = [
    { key: 'healmedyProtocol', label: 'Protokol No' },
    { key: 'date', label: 'Tarih' },
    { key: 'caseCode', label: 'Vaka Kodu' },
    { key: 'vehiclePlate', label: 'Plaka' },
    { key: 'patientName', label: 'Hasta Adı' },
    { key: 'patientAge', label: 'Yaş' },
    { key: 'patientGender', label: 'Cinsiyet' },
    { key: 'patientAddress', label: 'Adres' },
    { key: 'patientPhone', label: 'Telefon' },
    { key: 'complaint', label: 'Şikayet' },
    { key: 'diagnosis', label: 'Ön Tanı' },
    { key: 'callTime', label: 'Çağrı Saati' },
    { key: 'arrivalSceneTime', label: 'Olay Yerine Varış' },
    { key: 'arrivalPatientTime', label: 'Hastaya Varış' },
    { key: 'departureTime', label: 'Ayrılış Saati' },
    { key: 'hospitalArrivalTime', label: 'Hastaneye Varış' },
    { key: 'returnStationTime', label: 'İstasyona Dönüş' },
    { key: 'vitalBP1', label: '1. Tansiyon' },
    { key: 'vitalPulse1', label: '1. Nabız' },
    { key: 'vitalSpO2_1', label: '1. SpO2' },
    { key: 'vitalTemp1', label: '1. Ateş' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/form-templates')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Geri
          </Button>
          
          <div className="h-6 border-r mx-2" />
          
          <Input 
            value={template?.name || ''} 
            onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            className="w-64 h-8 font-semibold"
            placeholder="Şablon Adı"
          />
          
          <Badge className="bg-green-100 text-green-700">
            <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Format butonları */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => applyStyle('bold')}
            className={cells[selectedCell?.address]?.font?.bold ? 'bg-gray-200' : ''}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => applyStyle('italic')}
            className={cells[selectedCell?.address]?.font?.italic ? 'bg-gray-200' : ''}
          >
            <Italic className="h-4 w-4" />
          </Button>
          
          <div className="h-6 border-r mx-1" />
          
          <Button variant="ghost" size="sm" onClick={() => applyStyle('align', 'left')}>
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyStyle('align', 'center')}>
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyStyle('align', 'right')}>
            <AlignRight className="h-4 w-4" />
          </Button>
          
          <div className="h-6 border-r mx-1" />
          
          <Button variant="ghost" size="sm" onClick={handleMergeCells}>
            <Merge className="h-4 w-4" />
          </Button>
          
          <div className="h-6 border-r mx-1" />
          
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(50, z - 10))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">{zoom}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(200, z + 10))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="h-6 border-r mx-1" />
          
          <Button variant="ghost" size="sm" onClick={() => setShowMappingDialog(true)}>
            <Settings className="h-4 w-4 mr-1" /> Veri Eşleştirme
          </Button>
          
          <Button variant="ghost" size="sm" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          
          <div className="h-6 border-r mx-1" />
          
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {/* Selected Cell Info */}
      <div className="bg-gray-50 border-b px-4 py-1 flex items-center gap-4 text-sm">
        <span className="font-mono bg-white px-2 py-0.5 rounded border">
          {selectedCell?.address || '-'}
        </span>
        <Input 
          value={cells[selectedCell?.address]?.value || ''}
          onChange={(e) => selectedCell && handleCellChange(selectedCell.row, selectedCell.col, e.target.value)}
          className="flex-1 h-7"
          placeholder="Hücre içeriği..."
        />
        {dataMappings[selectedCell?.address] && (
          <Badge className="bg-purple-100 text-purple-700">
            📊 {dataFields.find(f => f.key === dataMappings[selectedCell?.address])?.label || dataMappings[selectedCell?.address]}
          </Badge>
        )}
      </div>

      {/* Grid Area */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div 
          className="inline-block min-w-full"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          <table className={`border-collapse ${showGridLines ? '' : 'border-none'}`}>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-gray-200 border w-10 h-6 text-xs">#</th>
                {Array.from({ length: maxCol }, (_, i) => (
                  <th 
                    key={i} 
                    className="sticky top-0 z-10 bg-gray-200 border text-xs font-normal px-1"
                    style={{ minWidth: columnWidths[getColumnLetter(i + 1)] || 80 }}
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
                  <tr key={row} style={{ height: rowHeights[row] || 24 }}>
                    <td className="sticky left-0 z-10 bg-gray-200 border text-xs text-center font-normal">
                      {row}
                    </td>
                    {Array.from({ length: maxCol }, (_, colIdx) => {
                      const col = colIdx + 1;
                      const address = getCellAddress(row, col);
                      const cell = cells[address];
                      const mergeInfo = getMergedCellInfo(row, col);
                      
                      // Birleşik hücrenin origin değilse gösterme
                      if (mergeInfo.isMerged && !mergeInfo.isOrigin) {
                        return null;
                      }
                      
                      const isSelected = selectedCell?.row === row && selectedCell?.col === col;
                      const isInRange = selectedRange && 
                        row >= selectedRange.startRow && row <= selectedRange.endRow &&
                        col >= selectedRange.startCol && col <= selectedRange.endCol;
                      
                      const hasMapping = Object.values(dataMappings).some(m => m === address);
                      
                      return (
                        <td
                          key={col}
                          rowSpan={mergeInfo.isOrigin ? mergeInfo.rowSpan : 1}
                          colSpan={mergeInfo.isOrigin ? mergeInfo.colSpan : 1}
                          className={`border text-xs relative cursor-cell
                            ${isSelected ? 'ring-2 ring-blue-500' : ''}
                            ${isInRange ? 'bg-blue-100' : ''}
                            ${hasMapping ? 'bg-purple-50' : ''}
                            ${showGridLines ? '' : 'border-transparent'}
                          `}
                          style={{
                            minWidth: columnWidths[getColumnLetter(col)] || 80,
                            backgroundColor: (() => {
                              if (!cell?.fill?.color) return '#ffffff';
                              // ARGB formatından RGB'ye çevir (FFRRGGBB -> #RRGGBB)
                              const color = cell.fill.color;
                              if (color.length === 8) {
                                // ARGB formatı: ilk 2 karakter alpha, son 6 karakter RGB
                                const rgb = color.slice(2);
                                // Eğer tamamen şeffaf (alpha = 00) veya siyah (000000) ise beyaz göster
                                if (color.slice(0, 2) === '00' || rgb === '000000') {
                                  return '#ffffff';
                                }
                                return `#${rgb}`;
                              } else if (color.length === 6) {
                                // Zaten RGB formatı
                                return color === '000000' ? '#ffffff' : `#${color}`;
                              }
                              return '#ffffff';
                            })(),
                            color: (() => {
                              if (!cell?.font?.color) return '#000000';
                              const fontColor = cell.font.color;
                              if (fontColor.length === 8) {
                                const rgb = fontColor.slice(2);
                                return `#${rgb}`;
                              } else if (fontColor.length === 6) {
                                return `#${fontColor}`;
                              }
                              return '#000000';
                            })(),
                            fontWeight: cell?.font?.bold ? 'bold' : 'normal',
                            fontStyle: cell?.font?.italic ? 'italic' : 'normal',
                            textAlign: cell?.alignment?.horizontal || 'left',
                            verticalAlign: cell?.alignment?.vertical || 'middle',
                            fontSize: cell?.font?.size ? `${cell.font.size}px` : undefined
                          }}
                          onClick={(e) => handleCellClick(row, col, e)}
                          onDoubleClick={() => {
                            // Double click ile düzenleme moduna geç
                          }}
                        >
                          <div className="px-1 py-0.5 min-h-[20px] whitespace-pre-wrap">
                            {cell?.value || ''}
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

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şablon Ayarları</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Satır Sayısı</Label>
                <Input 
                  type="number" 
                  value={maxRow} 
                  onChange={(e) => setMaxRow(parseInt(e.target.value) || 100)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sütun Sayısı</Label>
                <Input 
                  type="number" 
                  value={maxCol} 
                  onChange={(e) => setMaxCol(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={showGridLines} 
                onCheckedChange={setShowGridLines}
              />
              <Label>Grid çizgilerini göster</Label>
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input 
                value={template?.description || ''} 
                onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Veri Eşleştirme</DialogTitle>
            <p className="text-sm text-gray-500">
              Her veri alanının Excel'de hangi hücreye yazılacağını belirleyin.
              {selectedCell && (
                <span className="ml-2 text-blue-600">
                  Seçili hücre: <strong>{selectedCell.address}</strong>
                </span>
              )}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            {dataFields.map(field => (
              <div key={field.key} className="flex items-center gap-3">
                <Label className="w-40">{field.label}</Label>
                <Input 
                  value={dataMappings[field.key] || ''}
                  onChange={(e) => setDataMappings(prev => ({ ...prev, [field.key]: e.target.value.toUpperCase() }))}
                  placeholder="Örn: C5"
                  className="w-24 font-mono"
                />
                {selectedCell && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDataMappings(prev => ({ ...prev, [field.key]: selectedCell.address }))}
                  >
                    {selectedCell.address} Ata
                  </Button>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>İptal</Button>
            <Button onClick={() => {
              toast.success('Veri eşleştirmesi kaydedildi');
              setShowMappingDialog(false);
            }}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExcelTemplateEditor;

