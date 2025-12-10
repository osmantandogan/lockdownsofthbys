import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pdfTemplatesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  FileText, Save, Trash2, Plus, GripVertical, Settings, 
  ChevronLeft, ChevronRight, Copy, Eye, X, Move,
  Type, Image, Square, ArrowUp, ArrowDown
} from 'lucide-react';

// A4 boyutları (piksel, 96 DPI)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const SCALE = 0.8; // Canvas görüntüleme ölçeği

const PdfTemplateEditor = () => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const canvasRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockDefinitions, setBlockDefinitions] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Şablon verisi
  const [template, setTemplate] = useState({
    name: 'Yeni Şablon',
    description: '',
    page_count: 1,
    page_size: 'A4',
    orientation: 'portrait',
    header: { enabled: false, height: 60, text: '', logo: null, show_page_number: false },
    footer: { enabled: false, height: 40, text: '', show_page_number: true },
    blocks: [],
    usage_types: [],
    is_default: false
  });

  useEffect(() => {
    loadBlockDefinitions();
    if (templateId && templateId !== 'new') {
      loadTemplate(templateId);
    } else {
      setLoading(false);
    }
  }, [templateId]);

  const loadBlockDefinitions = async () => {
    try {
      const response = await pdfTemplatesAPI.getBlockDefinitions();
      setBlockDefinitions(response.data);
    } catch (error) {
      console.error('Kutucuk tanımları yüklenemedi:', error);
    }
  };

  const loadTemplate = async (id) => {
    try {
      const response = await pdfTemplatesAPI.getById(id);
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
        await pdfTemplatesAPI.update(templateId, template);
        toast.success('Şablon güncellendi');
      } else {
        const response = await pdfTemplatesAPI.create(template);
        toast.success('Şablon oluşturuldu');
        navigate(`/dashboard/pdf-templates/${response.data.id}`);
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Şablon kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  // Kutucuk sürükle-bırak
  const handleDragStart = (e, blockDef) => {
    e.dataTransfer.setData('blockType', blockDef.type);
    e.dataTransfer.setData('blockTitle', blockDef.title);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('blockType');
    const blockTitle = e.dataTransfer.getData('blockTitle');
    
    if (!blockType) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / SCALE;
    const y = (e.clientY - rect.top) / SCALE;
    
    const blockDef = blockDefinitions.find(b => b.type === blockType);
    
    const newBlock = {
      id: `block_${Date.now()}`,
      block_type: blockType,
      title: blockTitle,
      x: Math.max(10, Math.min(x - 100, A4_WIDTH - 210)),
      y: Math.max(10, Math.min(y - 30, A4_HEIGHT - 70)),
      width: 200,
      height: 60,
      page: currentPage,
      fields: blockDef?.fields?.map((f, i) => ({ ...f, visible: true, order: i })) || [],
      show_border: true,
      show_title: true,
      font_size: 10
    };
    
    setTemplate(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
    
    toast.success(`${blockTitle} eklendi`);
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
  };

  // Kutucuk seçimi
  const handleBlockClick = (e, block) => {
    e.stopPropagation();
    setSelectedBlock(block.id);
  };

  // Kutucuğu sil
  const deleteBlock = (blockId) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId)
    }));
    setSelectedBlock(null);
    toast.success('Kutucuk silindi');
  };

  // Kutucuk boyutlandırma
  const resizeBlock = (blockId, width, height) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => 
        b.id === blockId ? { ...b, width: Math.max(50, width), height: Math.max(30, height) } : b
      )
    }));
  };

  // Kutucuk taşıma
  const moveBlock = (blockId, x, y) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => 
        b.id === blockId ? { 
          ...b, 
          x: Math.max(0, Math.min(x, A4_WIDTH - b.width)),
          y: Math.max(0, Math.min(y, A4_HEIGHT - b.height))
        } : b
      )
    }));
  };

  // Kutucuk içerik düzenleme
  const openBlockEditor = (block) => {
    setSelectedBlock(block.id);
    setBlockEditorOpen(true);
  };

  const updateBlockFields = (blockId, fields) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => 
        b.id === blockId ? { ...b, fields } : b
      )
    }));
  };

  const toggleFieldVisibility = (blockId, fieldId) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          fields: b.fields.map(f => 
            f.field_id === fieldId ? { ...f, visible: !f.visible } : f
          )
        };
      })
    }));
  };

  const moveFieldUp = (blockId, fieldIndex) => {
    if (fieldIndex === 0) return;
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        const fields = [...b.fields];
        [fields[fieldIndex - 1], fields[fieldIndex]] = [fields[fieldIndex], fields[fieldIndex - 1]];
        return { ...b, fields: fields.map((f, i) => ({ ...f, order: i })) };
      })
    }));
  };

  const moveFieldDown = (blockId, fieldIndex) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        if (fieldIndex >= b.fields.length - 1) return b;
        const fields = [...b.fields];
        [fields[fieldIndex], fields[fieldIndex + 1]] = [fields[fieldIndex + 1], fields[fieldIndex]];
        return { ...b, fields: fields.map((f, i) => ({ ...f, order: i })) };
      })
    }));
  };

  const selectedBlockData = template.blocks.find(b => b.id === selectedBlock);
  const currentPageBlocks = template.blocks.filter(b => b.page === currentPage);

  if (loading) {
    return <div className="flex items-center justify-center h-96">Yükleniyor...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard/pdf-templates')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Geri
          </Button>
          <div>
            <Input 
              value={template.name}
              onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
              className="text-lg font-bold border-0 shadow-none focus:ring-0 p-0"
              placeholder="Şablon adı"
            />
            <p className="text-sm text-gray-500">PDF Şablon Editörü</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/dashboard/pdf-templates')}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sol Sidebar - Kutucuklar */}
        <div className="w-64 bg-gray-50 border-r p-4 overflow-y-auto">
          <h3 className="font-semibold mb-3 text-sm">Kutucuklar</h3>
          <p className="text-xs text-gray-500 mb-4">Sürükleyip sayfaya bırakın</p>
          
          <div className="space-y-2">
            {blockDefinitions.map((block) => (
              <div
                key={block.type}
                draggable
                onDragStart={(e) => handleDragStart(e, block)}
                className="bg-white p-3 rounded-lg border cursor-move hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-2"
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{block.title}</span>
              </div>
            ))}
          </div>

          {/* Sayfa Ayarları */}
          <div className="mt-6 pt-4 border-t">
            <h3 className="font-semibold mb-3 text-sm">Sayfa Ayarları</h3>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Sayfa Sayısı</Label>
                <Select 
                  value={String(template.page_count)} 
                  onValueChange={(v) => setTemplate(prev => ({ ...prev, page_count: parseInt(v) }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} Sayfa</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Kullanım Yeri</Label>
                <Select 
                  value={template.usage_types[0] || ''} 
                  onValueChange={(v) => setTemplate(prev => ({ ...prev, usage_types: [v] }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vaka_formu">Vaka Formu</SelectItem>
                    <SelectItem value="vardiya_formu">Vardiya Formu</SelectItem>
                    <SelectItem value="hasta_karti">Hasta Kartı</SelectItem>
                    <SelectItem value="genel_rapor">Genel Rapor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Varsayılan</Label>
                <Switch 
                  checked={template.is_default}
                  onCheckedChange={(v) => setTemplate(prev => ({ ...prev, is_default: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Üst Bilgi</Label>
                <Switch 
                  checked={template.header?.enabled}
                  onCheckedChange={(v) => setTemplate(prev => ({ 
                    ...prev, 
                    header: { ...prev.header, enabled: v } 
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Alt Bilgi</Label>
                <Switch 
                  checked={template.footer?.enabled}
                  onCheckedChange={(v) => setTemplate(prev => ({ 
                    ...prev, 
                    footer: { ...prev.footer, enabled: v } 
                  }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Merkez - Canvas */}
        <div className="flex-1 bg-gray-200 overflow-auto p-8 flex justify-center">
          <div>
            {/* Sayfa navigasyonu */}
            {template.page_count > 1 && (
              <div className="mb-4 flex items-center justify-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  Sayfa {currentPage + 1} / {template.page_count}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={currentPage >= template.page_count - 1}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* A4 Canvas */}
            <div
              ref={canvasRef}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
              onClick={() => setSelectedBlock(null)}
              className="bg-white shadow-xl relative"
              style={{
                width: A4_WIDTH * SCALE,
                height: A4_HEIGHT * SCALE,
                transform: `scale(1)`,
                transformOrigin: 'top center'
              }}
            >
              {/* Üst Bilgi Alanı */}
              {template.header?.enabled && (
                <div 
                  className="absolute top-0 left-0 right-0 bg-gray-100 border-b border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500"
                  style={{ height: template.header.height * SCALE }}
                >
                  Üst Bilgi Alanı
                </div>
              )}

              {/* Alt Bilgi Alanı */}
              {template.footer?.enabled && (
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-gray-100 border-t border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500"
                  style={{ height: template.footer.height * SCALE }}
                >
                  Alt Bilgi Alanı
                </div>
              )}

              {/* Kutucuklar */}
              {currentPageBlocks.map((block) => (
                <DraggableBlock
                  key={block.id}
                  block={block}
                  scale={SCALE}
                  isSelected={selectedBlock === block.id}
                  onClick={(e) => handleBlockClick(e, block)}
                  onDoubleClick={() => openBlockEditor(block)}
                  onMove={(x, y) => moveBlock(block.id, x, y)}
                  onResize={(w, h) => resizeBlock(block.id, w, h)}
                  onDelete={() => deleteBlock(block.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sağ Sidebar - Seçili Kutucuk Ayarları */}
        {selectedBlockData && (
          <div className="w-72 bg-white border-l p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">{selectedBlockData.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBlock(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Başlık */}
              <div>
                <Label className="text-xs">Başlık</Label>
                <Input 
                  value={selectedBlockData.title}
                  onChange={(e) => setTemplate(prev => ({
                    ...prev,
                    blocks: prev.blocks.map(b => 
                      b.id === selectedBlock ? { ...b, title: e.target.value } : b
                    )
                  }))}
                  className="h-8"
                />
              </div>

              {/* Boyut */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Genişlik</Label>
                  <Input 
                    type="number"
                    value={Math.round(selectedBlockData.width)}
                    onChange={(e) => resizeBlock(selectedBlock, parseInt(e.target.value), selectedBlockData.height)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Yükseklik</Label>
                  <Input 
                    type="number"
                    value={Math.round(selectedBlockData.height)}
                    onChange={(e) => resizeBlock(selectedBlock, selectedBlockData.width, parseInt(e.target.value))}
                    className="h-8"
                  />
                </div>
              </div>

              {/* Görünüm */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Çerçeve</Label>
                  <Switch 
                    checked={selectedBlockData.show_border}
                    onCheckedChange={(v) => setTemplate(prev => ({
                      ...prev,
                      blocks: prev.blocks.map(b => 
                        b.id === selectedBlock ? { ...b, show_border: v } : b
                      )
                    }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Başlık Göster</Label>
                  <Switch 
                    checked={selectedBlockData.show_title}
                    onCheckedChange={(v) => setTemplate(prev => ({
                      ...prev,
                      blocks: prev.blocks.map(b => 
                        b.id === selectedBlock ? { ...b, show_title: v } : b
                      )
                    }))}
                  />
                </div>
              </div>

              {/* Alanlar */}
              {selectedBlockData.fields?.length > 0 && (
                <div>
                  <Label className="text-xs mb-2 block">Alanlar</Label>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selectedBlockData.fields.map((field, index) => (
                      <div 
                        key={field.field_id}
                        className={`flex items-center gap-2 p-2 rounded text-xs ${
                          field.visible ? 'bg-blue-50' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Switch 
                          checked={field.visible}
                          onCheckedChange={() => toggleFieldVisibility(selectedBlock, field.field_id)}
                          className="h-4 w-8"
                        />
                        <span className="flex-1">{field.label}</span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0"
                            onClick={() => moveFieldUp(selectedBlock, index)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => moveFieldDown(selectedBlock, index)}
                            disabled={index === selectedBlockData.fields.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sil */}
              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full"
                onClick={() => deleteBlock(selectedBlock)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Kutucuğu Sil
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Sürüklenebilir Kutucuk Bileşeni
const DraggableBlock = ({ block, scale, isSelected, onClick, onDoubleClick, onMove, onResize, onDelete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ w: 0, h: 0 });
  const blockRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();
    setIsDragging(true);
    setStartPos({ 
      x: e.clientX - block.x * scale, 
      y: e.clientY - block.y * scale 
    });
  };

  const handleResizeStart = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartSize({ w: block.width, h: block.height });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = (e.clientX - startPos.x) / scale;
        const newY = (e.clientY - startPos.y) / scale;
        onMove(newX, newY);
      }
      if (isResizing) {
        const deltaX = (e.clientX - startPos.x) / scale;
        const deltaY = (e.clientY - startPos.y) / scale;
        onResize(startSize.w + deltaX, startSize.h + deltaY);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, startPos, startSize, scale, onMove, onResize]);

  return (
    <div
      ref={blockRef}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={handleMouseDown}
      className={`absolute cursor-move ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${block.show_border ? 'border border-gray-300' : ''}`}
      style={{
        left: block.x * scale,
        top: block.y * scale,
        width: block.width * scale,
        height: block.height * scale,
        backgroundColor: block.background_color || 'white'
      }}
    >
      {/* Başlık */}
      {block.show_title && (
        <div className="bg-gray-100 px-2 py-1 text-xs font-medium border-b truncate">
          {block.title}
        </div>
      )}
      
      {/* İçerik önizleme */}
      <div className="p-1 text-xs text-gray-400 overflow-hidden">
        {block.fields?.filter(f => f.visible).slice(0, 3).map(f => (
          <div key={f.field_id} className="truncate">{f.label}</div>
        ))}
        {block.fields?.filter(f => f.visible).length > 3 && (
          <div>...</div>
        )}
      </div>

      {/* Boyutlandırma tutamacı */}
      {isSelected && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
};

export default PdfTemplateEditor;

