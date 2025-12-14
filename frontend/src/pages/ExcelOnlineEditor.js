import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { excelTemplatesAPI } from '../api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, Save, FileSpreadsheet, Undo, Redo,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Grid3X3, Palette, Type, Merge, Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

// Handsontable modüllerini kaydet
registerAllModules();

const ExcelOnlineEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const hotRef = useRef(null);
  
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState([]);
  const [mergeCells, setMergeCells] = useState([]);
  const [colWidths, setColWidths] = useState([]);
  const [rowHeights, setRowHeights] = useState([]);
  const [cellStyles, setCellStyles] = useState({});

  // Template yükle
  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await excelTemplatesAPI.getById(id);
      const tmpl = response.data;
      setTemplate(tmpl);
      
      // Grid verilerini hazırla
      const maxRow = tmpl.max_row || 100;
      const maxCol = tmpl.max_column || 30;
      
      // Boş grid oluştur
      const gridData = Array.from({ length: maxRow }, () => 
        Array.from({ length: maxCol }, () => '')
      );
      
      // Hücre stillerini sakla
      const styles = {};
      
      // Hücreleri doldur
      (tmpl.cells || []).forEach(cell => {
        const row = cell.row - 1;
        const col = cell.col - 1;
        if (row >= 0 && row < maxRow && col >= 0 && col < maxCol) {
          gridData[row][col] = cell.value || '';
          
          // Stilleri sakla
          styles[`${row},${col}`] = {
            font: cell.font || {},
            fill: cell.fill || {},
            alignment: cell.alignment || {},
            border: cell.border || {}
          };
        }
      });
      
      setData(gridData);
      setCellStyles(styles);
      
      // Birleşik hücreler
      const merges = (tmpl.merged_cells || []).map(mc => ({
        row: mc.min_row - 1,
        col: mc.min_col - 1,
        rowspan: mc.max_row - mc.min_row + 1,
        colspan: mc.max_col - mc.min_col + 1
      }));
      setMergeCells(merges);
      
      // Sütun genişlikleri
      const colW = Array.from({ length: maxCol }, (_, i) => {
        const letter = getColumnLetter(i + 1);
        return tmpl.column_widths?.[letter] ? tmpl.column_widths[letter] * 7 : 80;
      });
      setColWidths(colW);
      
      // Satır yükseklikleri
      const rowH = Array.from({ length: maxRow }, (_, i) => {
        return tmpl.row_heights?.[String(i + 1)] || 23;
      });
      setRowHeights(rowH);
      
    } catch (error) {
      console.error('Template yükleme hatası:', error);
      toast.error('Şablon yüklenemedi');
    } finally {
      setLoading(false);
    }
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

  // Kaydet
  const handleSave = async () => {
    if (!hotRef.current) return;
    
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const currentData = hot.getData();
      
      // Hücreleri hazırla
      const cells = [];
      for (let row = 0; row < currentData.length; row++) {
        for (let col = 0; col < currentData[row].length; col++) {
          const value = currentData[row][col];
          const styleKey = `${row},${col}`;
          const style = cellStyles[styleKey] || {};
          
          // Boş olmayan veya stili olan hücreleri kaydet
          if (value || Object.keys(style).length > 0) {
            cells.push({
              row: row + 1,
              col: col + 1,
              col_letter: getColumnLetter(col + 1),
              address: `${getColumnLetter(col + 1)}${row + 1}`,
              value: value || '',
              font: style.font || {},
              fill: style.fill || {},
              alignment: style.alignment || {},
              border: style.border || {}
            });
          }
        }
      }
      
      // Birleşik hücreleri dönüştür
      const mergedCells = mergeCells.map(mc => ({
        range: `${getColumnLetter(mc.col + 1)}${mc.row + 1}:${getColumnLetter(mc.col + mc.colspan)}${mc.row + mc.rowspan}`,
        min_row: mc.row + 1,
        max_row: mc.row + mc.rowspan,
        min_col: mc.col + 1,
        max_col: mc.col + mc.colspan
      }));
      
      // Sütun genişliklerini dönüştür
      const columnWidths = {};
      colWidths.forEach((w, i) => {
        columnWidths[getColumnLetter(i + 1)] = Math.round(w / 7);
      });
      
      // Satır yüksekliklerini dönüştür
      const rowHeightsObj = {};
      rowHeights.forEach((h, i) => {
        if (h !== 23) {
          rowHeightsObj[String(i + 1)] = h;
        }
      });
      
      await excelTemplatesAPI.update(id, {
        cells,
        merged_cells: mergedCells,
        column_widths: columnWidths,
        row_heights: rowHeightsObj,
        max_row: currentData.length,
        max_column: currentData[0]?.length || 30
      });
      
      toast.success('Excel şablonu kaydedildi!');
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  // Hücre renderer - stil uygula
  const cellRenderer = useCallback((instance, td, row, col, prop, value, cellProperties) => {
    td.innerHTML = value || '';
    
    const styleKey = `${row},${col}`;
    const style = cellStyles[styleKey];
    
    if (style) {
      // Font stilleri
      if (style.font?.bold) td.style.fontWeight = 'bold';
      if (style.font?.italic) td.style.fontStyle = 'italic';
      if (style.font?.size) td.style.fontSize = `${style.font.size}px`;
      if (style.font?.color && style.font.color.length >= 6) {
        td.style.color = `#${style.font.color.slice(-6)}`;
      }
      
      // Arka plan
      if (style.fill?.color && style.fill.color !== '00000000' && style.fill.color.length >= 6) {
        td.style.backgroundColor = `#${style.fill.color.slice(-6)}`;
      }
      
      // Hizalama
      if (style.alignment?.horizontal) td.style.textAlign = style.alignment.horizontal;
      if (style.alignment?.vertical) td.style.verticalAlign = style.alignment.vertical;
    }
    
    return td;
  }, [cellStyles]);

  // Stil uygula
  const applyStyle = (styleType, value) => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const selected = hot.getSelected();
    
    if (!selected || selected.length === 0) {
      toast.error('Önce hücre seçin');
      return;
    }
    
    const newStyles = { ...cellStyles };
    
    selected.forEach(([r1, c1, r2, c2]) => {
      const startRow = Math.min(r1, r2);
      const endRow = Math.max(r1, r2);
      const startCol = Math.min(c1, c2);
      const endCol = Math.max(c1, c2);
      
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const key = `${row},${col}`;
          if (!newStyles[key]) newStyles[key] = { font: {}, fill: {}, alignment: {}, border: {} };
          
          switch (styleType) {
            case 'bold':
              newStyles[key].font.bold = !newStyles[key].font?.bold;
              break;
            case 'italic':
              newStyles[key].font.italic = !newStyles[key].font?.italic;
              break;
            case 'align':
              newStyles[key].alignment.horizontal = value;
              break;
            case 'bgColor':
              newStyles[key].fill.color = value.replace('#', '');
              break;
            case 'textColor':
              newStyles[key].font.color = value.replace('#', '');
              break;
            default:
              break;
          }
        }
      }
    });
    
    setCellStyles(newStyles);
    hot.render();
  };

  // Hücreleri birleştir
  const handleMergeCells = () => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const selected = hot.getSelected();
    
    if (!selected || selected.length === 0) {
      toast.error('Önce hücre seçin');
      return;
    }
    
    const [r1, c1, r2, c2] = selected[0];
    const startRow = Math.min(r1, r2);
    const endRow = Math.max(r1, r2);
    const startCol = Math.min(c1, c2);
    const endCol = Math.max(c1, c2);
    
    const newMerge = {
      row: startRow,
      col: startCol,
      rowspan: endRow - startRow + 1,
      colspan: endCol - startCol + 1
    };
    
    setMergeCells(prev => [...prev, newMerge]);
    toast.success('Hücreler birleştirildi');
  };

  // Undo/Redo
  const handleUndo = () => {
    if (hotRef.current) {
      hotRef.current.hotInstance.undo();
    }
  };

  const handleRedo = () => {
    if (hotRef.current) {
      hotRef.current.hotInstance.redo();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Excel şablonu yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar - Excel benzeri */}
      <div className="bg-white border-b shadow-sm">
        {/* Üst bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gradient-to-r from-green-600 to-green-700">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/form-templates')} className="text-white hover:bg-green-500">
              <ArrowLeft className="h-4 w-4 mr-1" /> Geri
            </Button>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-white" />
              <span className="font-semibold text-white text-lg">{template?.name || 'Excel Şablonu'}</span>
              <Badge className="bg-white/20 text-white border-white/30">
                Online Düzenleme
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => navigate(`/dashboard/form-templates/excel/${id}/mapping`)} 
              variant="ghost" 
              className="text-white hover:bg-green-500"
            >
              <Grid3X3 className="h-4 w-4 mr-1" /> Veri Eşleme
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-white text-green-700 hover:bg-green-50">
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
        
        {/* Araç çubuğu */}
        <div className="flex items-center gap-1 px-4 py-2 flex-wrap">
          {/* Undo/Redo */}
          <Button variant="ghost" size="sm" onClick={handleUndo} title="Geri Al (Ctrl+Z)">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRedo} title="Yinele (Ctrl+Y)">
            <Redo className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          {/* Font stilleri */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => applyStyle('bold')}
            title="Kalın (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => applyStyle('italic')}
            title="İtalik (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          {/* Hizalama */}
          <Button variant="ghost" size="sm" onClick={() => applyStyle('align', 'left')} title="Sola Hizala">
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyStyle('align', 'center')} title="Ortala">
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyStyle('align', 'right')} title="Sağa Hizala">
            <AlignRight className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          {/* Renkler */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Arka Plan Rengi">
                <Palette className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="grid grid-cols-5 gap-1 p-2">
                {['#FFFFFF', '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', 
                  '#FF0000', '#0000FF', '#000080', '#800080', '#808000',
                  '#FFC000', '#92D050', '#00B0F0', '#7030A0', '#C00000'].map(color => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => applyStyle('bgColor', color)}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Yazı Rengi">
                <Type className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="grid grid-cols-5 gap-1 p-2">
                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                  '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080',
                  '#808080', '#C0C0C0', '#FF6600', '#663399', '#339966'].map(color => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => applyStyle('textColor', color)}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          {/* Birleştir */}
          <Button variant="ghost" size="sm" onClick={handleMergeCells} title="Hücreleri Birleştir">
            <Merge className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Excel Grid */}
      <div className="flex-1 overflow-hidden">
        <HotTable
          ref={hotRef}
          data={data}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height="100%"
          licenseKey="non-commercial-and-evaluation"
          mergeCells={mergeCells}
          colWidths={colWidths}
          rowHeights={rowHeights}
          manualColumnResize={true}
          manualRowResize={true}
          contextMenu={true}
          comments={true}
          undo={true}
          outsideClickDeselects={false}
          selectionMode="multiple"
          fillHandle={true}
          autoWrapRow={true}
          autoWrapCol={true}
          stretchH="all"
          cells={(row, col) => ({
            renderer: cellRenderer
          })}
          afterColumnResize={(newSize, column) => {
            const newWidths = [...colWidths];
            newWidths[column] = newSize;
            setColWidths(newWidths);
          }}
          afterRowResize={(newSize, row) => {
            const newHeights = [...rowHeights];
            newHeights[row] = newSize;
            setRowHeights(newHeights);
          }}
          className="htCustom"
        />
      </div>
      
      {/* Alt bilgi çubuğu */}
      <div className="bg-gray-100 border-t px-4 py-1 text-xs text-gray-500 flex items-center justify-between">
        <span>💡 İpucu: Sağ tık menüsünden satır/sütun ekleyebilirsiniz</span>
        <span>{template?.max_row || 100} satır × {template?.max_column || 30} sütun</span>
      </div>
      
      {/* Custom styles */}
      <style>{`
        .htCustom {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .htCustom .htCore td {
          border: 1px solid #e0e0e0;
        }
        .htCustom .htCore th {
          background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
          font-weight: 600;
          color: #495057;
        }
        .htCustom .htCore .currentRow td {
          background-color: #e8f4fd !important;
        }
        .htCustom .htCore .currentCol th {
          background: linear-gradient(to bottom, #d4edda, #c3e6cb) !important;
        }
        .handsontable .htBorders .wtBorder {
          background-color: #28a745 !important;
        }
      `}</style>
    </div>
  );
};

export default ExcelOnlineEditor;

