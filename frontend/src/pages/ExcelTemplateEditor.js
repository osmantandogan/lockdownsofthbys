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
  FileSpreadsheet, Download, Eye, Trash2, Settings,
  Copy, Scissors, GripVertical
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
  const [editingCell, setEditingCell] = useState(null); // {row, col, value}
  const [draggingCell, setDraggingCell] = useState(null); // {row, col, address}
  const [dragOverCell, setDragOverCell] = useState(null); // {row, col}
  const [copiedCell, setCopiedCell] = useState(null); // {cell data}
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [rowHeights, setRowHeights] = useState({});
  const [columnWidths, setColumnWidths] = useState({});
  const editingInputRef = useRef(null);
  const previousEditingCellRef = useRef(null);
  const imageInputRef = useRef(null);
  
  // Editor settings
  const [zoom, setZoom] = useState(100);
  const [showGridLines, setShowGridLines] = useState(true);
  const [maxRow, setMaxRow] = useState(100);
  const [maxCol, setMaxCol] = useState(30);
  
  // Dialogs
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showStyleDialog, setShowStyleDialog] = useState(false);
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
      // Font objesini doğru şekilde merge et
      if (updates.font && current.font) {
        updates.font = { ...current.font, ...updates.font };
      }
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
      setEditingCell(null);
    } else {
      setSelectedCell({ row, col, address });
      setSelectedRange(null);
      // Double click veya F2 ile düzenleme moduna geç
      if (event.detail === 2 || editingCell?.row === row && editingCell?.col === col) {
        const cell = cells[address];
        setEditingCell({ row, col, address, value: cell?.value || '' });
      } else {
        setEditingCell(null);
      }
    }
  };

  // Klavye navigasyonu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedCell) return;

      // Düzenleme modunda değilse
      if (!editingCell) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            if (selectedCell.row > 1) {
              setSelectedCell({ ...selectedCell, row: selectedCell.row - 1, address: getCellAddress(selectedCell.row - 1, selectedCell.col) });
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (selectedCell.row < maxRow) {
              setSelectedCell({ ...selectedCell, row: selectedCell.row + 1, address: getCellAddress(selectedCell.row + 1, selectedCell.col) });
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (selectedCell.col > 1) {
              setSelectedCell({ ...selectedCell, col: selectedCell.col - 1, address: getCellAddress(selectedCell.row, selectedCell.col - 1) });
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (selectedCell.col < maxCol) {
              setSelectedCell({ ...selectedCell, col: selectedCell.col + 1, address: getCellAddress(selectedCell.row, selectedCell.col + 1) });
            }
            break;
          case 'Enter':
            e.preventDefault();
            const cell = cells[selectedCell.address];
            setEditingCell({ row: selectedCell.row, col: selectedCell.col, address: selectedCell.address, value: cell?.value || '' });
            break;
          case 'F2':
            e.preventDefault();
            const cell2 = cells[selectedCell.address];
            setEditingCell({ row: selectedCell.row, col: selectedCell.col, address: selectedCell.address, value: cell2?.value || '' });
            break;
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            updateCell(selectedCell.address, { value: '' });
            break;
          default:
            // Normal karakter girme - düzenleme moduna geç
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              setEditingCell({ row: selectedCell.row, col: selectedCell.col, address: selectedCell.address, value: e.key });
            }
            break;
        }
      } else {
        // Düzenleme modunda
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleCellEditFinish();
          // Aşağı hücreye geç
          if (selectedCell.row < maxRow) {
            setSelectedCell({ ...selectedCell, row: selectedCell.row + 1, address: getCellAddress(selectedCell.row + 1, selectedCell.col) });
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          handleCellEditFinish();
          // Sağ hücreye geç
          if (e.shiftKey) {
            if (selectedCell.col > 1) {
              setSelectedCell({ ...selectedCell, col: selectedCell.col - 1, address: getCellAddress(selectedCell.row, selectedCell.col - 1) });
            }
          } else {
            if (selectedCell.col < maxCol) {
              setSelectedCell({ ...selectedCell, col: selectedCell.col + 1, address: getCellAddress(selectedCell.row, selectedCell.col + 1) });
            }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setEditingCell(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, cells, maxRow, maxCol, copiedCell]);

  // Düzenleme input focus - sadece yeni hücreye geçildiğinde select yap
  useEffect(() => {
    if (editingCell && editingInputRef.current) {
      editingInputRef.current.focus();
      
      // Sadece yeni bir hücreye geçildiğinde select yap (value değişikliği değil)
      const isNewCell = !previousEditingCellRef.current || 
        previousEditingCellRef.current.row !== editingCell.row || 
        previousEditingCellRef.current.col !== editingCell.col;
      
      if (isNewCell) {
        // Yeni hücreye geçildi - tüm metni seç
        editingInputRef.current.select();
        previousEditingCellRef.current = { row: editingCell.row, col: editingCell.col };
      }
      // Aynı hücrede value değişiyorsa hiçbir şey yapma (kullanıcı yazıyor)
    } else {
      previousEditingCellRef.current = null;
    }
  }, [editingCell?.row, editingCell?.col]); // Sadece row/col değiştiğinde tetikle, value değil

  // Hücre düzenleme bitir
  const handleCellEditFinish = () => {
    if (editingCell) {
      updateCell(editingCell.address, { 
        value: editingCell.value,
        row: editingCell.row,
        col: editingCell.col,
        col_letter: getColumnLetter(editingCell.col)
      });
      setEditingCell(null);
    }
  };

  // Hücre düzenleme değişikliği
  const handleCellEditChange = (value) => {
    setEditingCell(prev => prev ? { ...prev, value } : null);
  };

  // Hücre sil
  const handleDeleteCell = () => {
    if (!selectedCell) {
      toast.error('Önce bir hücre seçin');
      return;
    }
    updateCell(selectedCell.address, { value: '' });
    toast.success('Hücre içeriği silindi');
  };

  // Hücre kopyala
  const handleCopyCell = () => {
    if (!selectedCell) {
      toast.error('Önce bir hücre seçin');
      return;
    }
    const cell = cells[selectedCell.address];
    if (cell) {
      setCopiedCell(cell);
      toast.success('Hücre kopyalandı');
    }
  };

  // Hücre yapıştır
  const handlePasteCell = () => {
    if (!selectedCell || !copiedCell) {
      toast.error('Önce bir hücre kopyalayın');
      return;
    }
    updateCell(selectedCell.address, {
      ...copiedCell,
      address: selectedCell.address,
      row: selectedCell.row,
      col: selectedCell.col,
      col_letter: getColumnLetter(selectedCell.col)
    });
    toast.success('Hücre yapıştırıldı');
  };

  // Hücre kes
  const handleCutCell = () => {
    if (!selectedCell) {
      toast.error('Önce bir hücre seçin');
      return;
    }
    const cell = cells[selectedCell.address];
    if (cell) {
      setCopiedCell(cell);
      updateCell(selectedCell.address, { value: '' });
      toast.success('Hücre kesildi');
    }
  };

  // Drag & Drop - Başlat
  const handleDragStart = (row, col, e) => {
    const address = getCellAddress(row, col);
    const cell = cells[address];
    if (cell && cell.value) {
      setDraggingCell({ row, col, address, cell });
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', address);
    }
  };

  // Drag & Drop - Üzerine gel
  const handleDragOver = (row, col, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ row, col });
  };

  // Drag & Drop - Bırak
  const handleDrop = (row, col, e) => {
    e.preventDefault();
    if (draggingCell) {
      const targetAddress = getCellAddress(row, col);
      const sourceCell = cells[draggingCell.address];
      
      if (sourceCell) {
        // Hedef hücreye taşı
        updateCell(targetAddress, {
          ...sourceCell,
          address: targetAddress,
          row: row,
          col: col,
          col_letter: getColumnLetter(col)
        });
        
        // Kaynak hücreyi temizle (kesme işlemi)
        updateCell(draggingCell.address, { value: '' });
        
        toast.success(`Hücre ${draggingCell.address} → ${targetAddress} taşındı`);
      }
    }
    setDraggingCell(null);
    setDragOverCell(null);
  };

  // Drag & Drop - Bırakma iptal
  const handleDragEnd = () => {
    setDraggingCell(null);
    setDragOverCell(null);
  };

  // Satır ekle
  const handleInsertRow = (afterRow) => {
    // Tüm hücreleri bir satır aşağı kaydır
    const newCells = {};
    Object.keys(cells).forEach(address => {
      const cell = cells[address];
      if (cell.row > afterRow) {
        const newRow = cell.row + 1;
        const newAddress = getCellAddress(newRow, cell.col);
        newCells[newAddress] = {
          ...cell,
          row: newRow,
          address: newAddress
        };
      } else {
        newCells[address] = cell;
      }
    });
    setCells(newCells);
    setMaxRow(prev => prev + 1);
    toast.success('Satır eklendi');
  };

  // Satır sil
  const handleDeleteRow = (rowToDelete) => {
    // Silinecek satırdaki hücreleri kaldır
    const newCells = {};
    Object.keys(cells).forEach(address => {
      const cell = cells[address];
      if (cell.row !== rowToDelete) {
        if (cell.row > rowToDelete) {
          // Aşağıdaki satırları yukarı kaydır
          const newRow = cell.row - 1;
          const newAddress = getCellAddress(newRow, cell.col);
          newCells[newAddress] = {
            ...cell,
            row: newRow,
            address: newAddress
          };
        } else {
          newCells[address] = cell;
        }
      }
    });
    setCells(newCells);
    setMaxRow(prev => Math.max(1, prev - 1));
    toast.success('Satır silindi');
  };

  // Sütun ekle
  const handleInsertColumn = (afterCol) => {
    const newCells = {};
    Object.keys(cells).forEach(address => {
      const cell = cells[address];
      if (cell.col > afterCol) {
        const newCol = cell.col + 1;
        const newAddress = getCellAddress(cell.row, newCol);
        newCells[newAddress] = {
          ...cell,
          col: newCol,
          col_letter: getColumnLetter(newCol),
          address: newAddress
        };
      } else {
        newCells[address] = cell;
      }
    });
    setCells(newCells);
    setMaxCol(prev => prev + 1);
    toast.success('Sütun eklendi');
  };

  // Sütun sil
  const handleDeleteColumn = (colToDelete) => {
    const newCells = {};
    Object.keys(cells).forEach(address => {
      const cell = cells[address];
      if (cell.col !== colToDelete) {
        if (cell.col > colToDelete) {
          const newCol = cell.col - 1;
          const newAddress = getCellAddress(cell.row, newCol);
          newCells[newAddress] = {
            ...cell,
            col: newCol,
            col_letter: getColumnLetter(newCol),
            address: newAddress
          };
        } else {
          newCells[address] = cell;
        }
      }
    });
    setCells(newCells);
    setMaxCol(prev => Math.max(1, prev - 1));
    toast.success('Sütun silindi');
  };

  // Görsel ekle
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCell) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Sadece görsel dosyaları yüklenebilir');
      return;
    }

    setImageUploading(true);
    try {
      // Görseli base64'e çevir
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        const address = selectedCell.address;
        
        // Hücreye görsel ekle
        updateCell(address, {
          ...cells[address],
          image: base64,
          imageWidth: 200, // Varsayılan genişlik
          imageHeight: 200, // Varsayılan yükseklik
          value: cells[address]?.value || '' // Mevcut değeri koru
        });
        
        toast.success('Görsel eklendi');
        setShowImageDialog(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Görsel yükleme hatası:', error);
      toast.error('Görsel yüklenemedi');
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  // Görsel sil
  const handleRemoveImage = () => {
    if (!selectedCell) return;
    const address = selectedCell.address;
    const cell = cells[address];
    if (cell) {
      const { image, imageWidth, imageHeight, ...rest } = cell;
      updateCell(address, rest);
      toast.success('Görsel kaldırıldı');
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
    if (!selectedCell) {
      toast.error('Önce bir hücre seçin');
      return;
    }

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
      case 'fontSize':
        updates = { font: { ...current.font, size: value } };
        break;
      case 'fontColor':
        updates = { font: { ...current.font, color: value } };
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
    // Temel Bilgiler
    { key: 'healmedyProtocol', label: 'Protokol No' },
    { key: 'date', label: 'Tarih' },
    { key: 'caseCode', label: 'Vaka Kodu' },
    { key: 'caseNumber', label: 'Vaka Numarası' },
    { key: 'vehiclePlate', label: 'Plaka' },
    { key: 'vehicleType', label: 'Araç Tipi' },
    
    // Hasta Bilgileri
    { key: 'patientName', label: 'Hasta Adı' },
    { key: 'patientSurname', label: 'Hasta Soyadı' },
    { key: 'patientFullName', label: 'Hasta Ad Soyad' },
    { key: 'patientAge', label: 'Yaş' },
    { key: 'patientGender', label: 'Cinsiyet' },
    { key: 'patientTC', label: 'T.C. Kimlik No' },
    { key: 'patientAddress', label: 'Adres' },
    { key: 'patientPhone', label: 'Telefon' },
    { key: 'patientComplaint', label: 'Şikayet' },
    { key: 'patientDiagnosis', label: 'Ön Tanı' },
    { key: 'chronicDiseases', label: 'Kronik Hastalıklar' },
    { key: 'allergies', label: 'Alerjiler' },
    
    // Zaman Bilgileri
    { key: 'callTime', label: 'Çağrı Saati' },
    { key: 'arrivalSceneTime', label: 'Olay Yerine Varış' },
    { key: 'arrivalPatientTime', label: 'Hastaya Varış' },
    { key: 'departureTime', label: 'Ayrılış Saati' },
    { key: 'hospitalArrivalTime', label: 'Hastaneye Varış' },
    { key: 'returnStationTime', label: 'İstasyona Dönüş' },
    
    // Vital Bulgular
    { key: 'vitalBP1', label: '1. Tansiyon' },
    { key: 'vitalBP2', label: '2. Tansiyon' },
    { key: 'vitalPulse1', label: '1. Nabız' },
    { key: 'vitalPulse2', label: '2. Nabız' },
    { key: 'vitalSpO2_1', label: '1. SpO2' },
    { key: 'vitalSpO2_2', label: '2. SpO2' },
    { key: 'vitalTemp1', label: '1. Ateş' },
    { key: 'vitalTemp2', label: '2. Ateş' },
    { key: 'vitalGlucose', label: 'Kan Şekeri' },
    { key: 'vitalGCS', label: 'Glasgow Koma Skalası' },
    
    // Hastane Bilgileri
    { key: 'hospitalName', label: 'Hastane Adı' },
    { key: 'hospitalType', label: 'Hastane Tipi' },
    { key: 'transferHospital', label: 'Transfer Hastanesi' },
    
    // Personel Bilgileri
    { key: 'driverName', label: 'Şoför Adı' },
    { key: 'paramedic1Name', label: '1. Paramedik Adı' },
    { key: 'paramedic2Name', label: '2. Paramedik Adı' },
    { key: 'doctorName', label: 'Doktor Adı' },
    { key: 'nurseName', label: 'Hemşire Adı' },
    { key: 'createdByName', label: 'Oluşturan Kişi' },
    { key: 'registeredByName', label: 'Kaydeden Kişi' },
    
    // İmzalar
    { key: 'staffSignature', label: 'Personel İmzası' },
    { key: 'doctorSignature', label: 'Doktor İmzası' },
    { key: 'patientSignature', label: 'Hasta İmzası' },
    { key: 'relativeSignature', label: 'Yakın İmzası' },
    
    // Diğer
    { key: 'startKm', label: 'Başlangıç KM' },
    { key: 'endKm', label: 'Bitiş KM' },
    { key: 'protocol112', label: '112 Protokol No' },
    { key: 'locationAddress', label: 'Olay Yeri Adresi' },
    { key: 'locationDistrict', label: 'İlçe' },
    { key: 'locationCoordinates', label: 'Koordinatlar' }
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
          
          {/* Font Size */}
          <div className="flex items-center gap-1">
            <Label className="text-xs whitespace-nowrap">Font:</Label>
            <Input
              type="number"
              min="8"
              max="72"
              value={cells[selectedCell?.address]?.font?.size || 10}
              onChange={(e) => {
                if (selectedCell) {
                  applyStyle('fontSize', parseInt(e.target.value) || 10);
                }
              }}
              className="w-16 h-7 text-xs"
              disabled={!selectedCell}
            />
          </div>
          
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
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowStyleDialog(true)}
            className={selectedCell ? '' : 'opacity-50'}
            disabled={!selectedCell}
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            Stil
          </Button>
          
          <div className="h-6 border-r mx-1" />
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleCopyCell}
            disabled={!selectedCell}
            title="Kopyala (Ctrl+C)"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleCutCell}
            disabled={!selectedCell}
            title="Kes (Ctrl+X)"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handlePasteCell}
            disabled={!copiedCell}
            title="Yapıştır (Ctrl+V)"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <div className="h-6 border-r mx-1" />
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              if (selectedCell) {
                imageInputRef.current?.click();
              } else {
                toast.error('Önce bir hücre seçin');
              }
            }}
            disabled={!selectedCell}
            title="Görsel Ekle"
          >
            <Type className="h-4 w-4 mr-1" />
            Görsel
          </Button>
          {selectedCell && cells[selectedCell.address]?.image && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleRemoveImage}
              title="Görseli Kaldır"
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          
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
                    className="sticky top-0 z-10 bg-gray-200 border text-xs font-normal px-1 relative group"
                    style={{ minWidth: columnWidths[getColumnLetter(i + 1)] || 80 }}
                  >
                    {getColumnLetter(i + 1)}
                    <div className="absolute bottom-0 left-0 right-0 h-3 opacity-0 group-hover:opacity-100 flex gap-1 items-center justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-3 p-0"
                        onClick={() => handleInsertColumn(i + 1)}
                        title="Sütun ekle"
                      >
                        <Plus className="h-2 w-2" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-3 p-0 text-red-600"
                        onClick={() => handleDeleteColumn(i + 1)}
                        title="Sütun sil"
                      >
                        <Minus className="h-2 w-2" />
                      </Button>
                    </div>
                    {/* Sütun genişliği ayarla */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 z-20"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const colLetter = getColumnLetter(i + 1);
                        const startWidth = columnWidths[colLetter] || 80;
                        
                        const handleMouseMove = (moveEvent) => {
                          const diff = moveEvent.clientX - startX;
                          const newWidth = Math.max(30, startWidth + diff);
                          setColumnWidths(prev => ({ ...prev, [colLetter]: newWidth }));
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      title="Sütun genişliğini ayarla"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRow }, (_, rowIdx) => {
                const row = rowIdx + 1;
                return (
                  <tr key={row} style={{ height: rowHeights[row] || 24 }}>
                    <td className="sticky left-0 z-10 bg-gray-200 border text-xs text-center font-normal relative group">
                      {row}
                      <div className="absolute right-0 top-0 bottom-0 w-4 opacity-0 group-hover:opacity-100 flex flex-col gap-1 items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-3 w-3 p-0"
                          onClick={() => handleInsertRow(row)}
                          title="Satır ekle"
                        >
                          <Plus className="h-2 w-2" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-3 w-3 p-0 text-red-600"
                          onClick={() => handleDeleteRow(row)}
                          title="Satır sil"
                        >
                          <Minus className="h-2 w-2" />
                        </Button>
                      </div>
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
                          onDoubleClick={(e) => {
                            const cell2 = cells[address];
                            setEditingCell({ row, col, address, value: cell2?.value || '' });
                          }}
                          draggable={!!cell?.value}
                          onDragStart={(e) => {
                            if (cell?.value) {
                              handleDragStart(row, col, e);
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            handleDragOver(row, col, e);
                          }}
                          onDrop={(e) => handleDrop(row, col, e)}
                          onDragEnd={handleDragEnd}
                          style={{
                            ...(dragOverCell?.row === row && dragOverCell?.col === col ? { backgroundColor: '#fef3c7' } : {})
                          }}
                        >
                          {editingCell?.row === row && editingCell?.col === col ? (
                            <input
                              ref={editingInputRef}
                              type="text"
                              value={editingCell.value}
                              onChange={(e) => handleCellEditChange(e.target.value)}
                              onBlur={handleCellEditFinish}
                              className="w-full h-full px-1 py-0.5 border-none outline-none bg-transparent"
                              style={{
                                fontWeight: cell?.font?.bold ? 'bold' : 'normal',
                                fontStyle: cell?.font?.italic ? 'italic' : 'normal',
                                textAlign: cell?.alignment?.horizontal || 'left',
                                fontSize: cell?.font?.size ? `${cell.font.size}px` : undefined,
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
                                })()
                              }}
                            />
                          ) : (
                            <div className="px-1 py-0.5 min-h-[20px] whitespace-pre-wrap relative">
                              {cell?.image ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <img 
                                    src={cell.image} 
                                    alt="Cell image"
                                    style={{
                                      maxWidth: cell.imageWidth || 200,
                                      maxHeight: cell.imageHeight || 200,
                                      objectFit: 'contain'
                                    }}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      setSelectedCell({ row, col, address });
                                      setShowImageDialog(true);
                                    }}
                                  />
                                </div>
                              ) : (
                                cell?.value || ''
                              )}
                            </div>
                          )}
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

      {/* Style Dialog */}
      <Dialog open={showStyleDialog} onOpenChange={setShowStyleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hücre Stili</DialogTitle>
            <p className="text-sm text-gray-500">
              {selectedCell && `Seçili hücre: ${selectedCell.address}`}
            </p>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Arka Plan Rengi</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={(() => {
                        const cell = cells[selectedCell.address];
                        if (!cell?.fill?.color) return '#ffffff';
                        const color = cell.fill.color;
                        if (color.length === 8) {
                          return `#${color.slice(2)}`;
                        } else if (color.length === 6) {
                          return `#${color}`;
                        }
                        return '#ffffff';
                      })()}
                      onChange={(e) => handleFillColorChange(e.target.value)}
                      className="w-full h-10 border rounded cursor-pointer"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => applyStyle('fill', 'ffffff')}
                    >
                      Temizle
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Metin Rengi</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={(() => {
                        const cell = cells[selectedCell.address];
                        if (!cell?.font?.color) return '#000000';
                        const fontColor = cell.font.color;
                        if (fontColor.length === 8) {
                          return `#${fontColor.slice(2)}`;
                        } else if (fontColor.length === 6) {
                          return `#${fontColor}`;
                        }
                        return '#000000';
                      })()}
                      onChange={(e) => handleFontColorChange(e.target.value)}
                      className="w-full h-10 border rounded cursor-pointer"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => applyStyle('fontColor', '000000')}
                    >
                      Sıfırla
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Font Boyutu</Label>
                <Input
                  type="number"
                  min="8"
                  max="72"
                  value={cells[selectedCell.address]?.font?.size || 10}
                  onChange={(e) => applyStyle('fontSize', parseInt(e.target.value) || 10)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hizalama</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={cells[selectedCell.address]?.alignment?.horizontal === 'left' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyStyle('align', 'left')}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={cells[selectedCell.address]?.alignment?.horizontal === 'center' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyStyle('align', 'center')}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={cells[selectedCell.address]?.alignment?.horizontal === 'right' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyStyle('align', 'right')}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          {!selectedCell && (
            <p className="text-sm text-gray-500 text-center py-4">
              Stil düzenlemek için önce bir hücre seçin
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setShowStyleDialog(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Upload Input (Hidden) */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Görsel Yönetimi</DialogTitle>
            <p className="text-sm text-gray-500">
              {selectedCell && `Seçili hücre: ${selectedCell.address}`}
            </p>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-4">
              {cells[selectedCell.address]?.image ? (
                <div className="space-y-2">
                  <Label>Mevcut Görsel</Label>
                  <div className="border rounded p-2 flex items-center justify-center">
                    <img 
                      src={cells[selectedCell.address].image} 
                      alt="Current"
                      className="max-w-full max-h-64"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Genişlik (px)</Label>
                      <Input
                        type="number"
                        min="50"
                        max="1000"
                        value={cells[selectedCell.address].imageWidth || 200}
                        onChange={(e) => {
                          const address = selectedCell.address;
                          updateCell(address, {
                            ...cells[address],
                            imageWidth: parseInt(e.target.value) || 200
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Yükseklik (px)</Label>
                      <Input
                        type="number"
                        min="50"
                        max="1000"
                        value={cells[selectedCell.address].imageHeight || 200}
                        onChange={(e) => {
                          const address = selectedCell.address;
                          updateCell(address, {
                            ...cells[address],
                            imageHeight: parseInt(e.target.value) || 200
                          });
                        }}
                      />
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleRemoveImage}
                    className="w-full"
                  >
                    Görseli Kaldır
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Yeni Görsel Yükle</Label>
                  <Button
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full"
                    disabled={imageUploading}
                  >
                    {imageUploading ? 'Yükleniyor...' : 'Görsel Seç'}
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowImageDialog(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExcelTemplateEditor;

