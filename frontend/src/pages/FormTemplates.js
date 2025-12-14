import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formTemplatesAPI, excelTemplatesAPI } from '../api';
import api from '../api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  FileText, Plus, Edit, Trash2, Copy, Star, 
  RefreshCw, MoreVertical, Table, FileSpreadsheet, Layout, Upload,
  Grid3X3, Save, RotateCcw, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';

const FormTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  
  // Vaka Form Mapping state'leri
  const [cellMapping, setCellMapping] = useState(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editForm, setEditForm] = useState({ cell: '', field: '', label: '' });
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadTemplates();
  }, []);

  // Vaka Form Mapping yükle
  const loadCellMapping = async () => {
    setMappingLoading(true);
    try {
      const response = await api.get('/pdf/vaka-form-mapping');
      setCellMapping(response.data);
      // Tüm bölümleri varsayılan olarak aç
      const sections = {};
      Object.keys(response.data.cell_mappings || {}).forEach(s => sections[s] = true);
      setExpandedSections(sections);
    } catch (error) {
      console.error('Cell mapping yüklenemedi:', error);
      toast.error('Hücre eşlemeleri yüklenemedi');
    } finally {
      setMappingLoading(false);
    }
  };

  // Cell mapping güncelle
  const handleUpdateCellMapping = async () => {
    try {
      await api.put(`/pdf/vaka-form-mapping/${editingCell}`, {
        field: editForm.field,
        label: editForm.label
      });
      toast.success('Hücre eşlemesi güncellendi');
      setEditingCell(null);
      loadCellMapping();
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      toast.error('Güncelleme başarısız');
    }
  };

  // Mapping'i sıfırla
  const handleResetMapping = async () => {
    if (!window.confirm('Tüm hücre eşlemelerini varsayılana sıfırlamak istediğinize emin misiniz?')) return;
    
    try {
      await api.post('/pdf/vaka-form-mapping/reset');
      toast.success('Eşlemeler sıfırlandı');
      loadCellMapping();
    } catch (error) {
      console.error('Sıfırlama hatası:', error);
      toast.error('Sıfırlama başarısız');
    }
  };

  // Tab değiştiğinde mapping'i yükle
  useEffect(() => {
    if (activeTab === 'mapping' && !cellMapping) {
      loadCellMapping();
    }
  }, [activeTab]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Hem form templates hem excel templates yükle
      const [formRes, excelRes] = await Promise.all([
        formTemplatesAPI.getAll({}),
        excelTemplatesAPI.getAll().catch(() => ({ data: [] }))
      ]);
      
      const allTemplates = [
        ...(formRes.data || []),
        ...(excelRes.data || []).map(t => ({ ...t, template_type: 'excel' }))
      ];
      
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Şablonlar yüklenemedi:', error);
      toast.error('Şablonlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // VAKA FORMU.xlsx dosyasını içe aktar
  const handleImportVakaFormu = async () => {
    // Dosya seçimi için input oluştur
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        toast.info('VAKA FORMU içe aktarılıyor...');
        const formData = new FormData();
        formData.append('file', file);
        
        await excelTemplatesAPI.importVakaFormu(formData);
        toast.success('VAKA FORMU başarıyla içe aktarıldı!');
        loadTemplates();
      } catch (error) {
        console.error('İçe aktarma hatası:', error);
        toast.error(error.response?.data?.detail || 'İçe aktarma başarısız');
      }
    };
    input.click();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu şablonu silmek istediğinize emin misiniz?')) return;
    
    try {
      await formTemplatesAPI.delete(id);
      toast.success('Şablon silindi');
      loadTemplates();
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error('Şablon silinemedi');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await formTemplatesAPI.duplicate(id);
      toast.success('Şablon kopyalandı');
      loadTemplates();
    } catch (error) {
      console.error('Kopyalama hatası:', error);
      toast.error('Şablon kopyalanamadı');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await formTemplatesAPI.setDefault(id);
      toast.success('Varsayılan şablon ayarlandı');
      loadTemplates();
    } catch (error) {
      console.error('Hata:', error);
      toast.error('İşlem başarısız');
    }
  };

  const getUsageLabel = (type) => {
    const labels = {
      'vaka_formu': 'Vaka Formu',
      'vardiya_formu': 'Vardiya Formu',
      'hasta_karti': 'Hasta Kartı',
      'genel_rapor': 'Genel Rapor'
    };
    return labels[type] || type;
  };

  const getUsageColor = (type) => {
    const colors = {
      'vaka_formu': 'bg-red-100 text-red-700',
      'vardiya_formu': 'bg-blue-100 text-blue-700',
      'hasta_karti': 'bg-green-100 text-green-700',
      'genel_rapor': 'bg-purple-100 text-purple-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const filteredTemplates = templates.filter(t => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pdf') return t.template_type === 'pdf' || !t.template_type;
    if (activeTab === 'table') return t.template_type === 'table';
    if (activeTab === 'excel') return t.template_type === 'excel';
    return true;
  });

  // Excel şablon silme
  const handleDeleteExcel = async (id) => {
    if (!window.confirm('Bu Excel şablonunu silmek istediğinize emin misiniz?')) return;
    
    try {
      await excelTemplatesAPI.delete(id);
      toast.success('Excel şablonu silindi');
      loadTemplates();
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error('Excel şablonu silinemedi');
    }
  };

  const getTemplateIcon = (type) => {
    switch (type) {
      case 'table': return <Table className="h-5 w-5 text-green-600" />;
      case 'excel': return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
      default: return <FileText className="h-5 w-5 text-blue-600" />;
    }
  };

  const getTemplateBadge = (type) => {
    switch (type) {
      case 'table': return <Badge className="bg-green-100 text-green-700">Tablo</Badge>;
      case 'excel': return <Badge className="bg-emerald-100 text-emerald-700">Excel</Badge>;
      default: return <Badge className="bg-blue-100 text-blue-700">PDF</Badge>;
    }
  };

  const getTemplateEditPath = (template) => {
    switch (template.template_type) {
      case 'table': return `/dashboard/form-templates/table/${template.id}`;
      case 'excel': return `/dashboard/form-templates/excel/${template.id}`;
      default: return `/dashboard/form-templates/pdf/${template.id}`;
    }
  };

  const TemplateCard = ({ template }) => (
    <Card 
      className={`hover:shadow-lg transition-shadow cursor-pointer ${
        template.is_default ? 'ring-2 ring-yellow-400' : ''
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getTemplateIcon(template.template_type)}
            <CardTitle className="text-base">{template.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {template.is_default && (
              <Badge className="bg-yellow-100 text-yellow-700">
                <Star className="h-3 w-3 mr-1 fill-current" /> Varsayılan
              </Badge>
            )}
            {getTemplateBadge(template.template_type)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(getTemplateEditPath(template))}>
                  <Edit className="h-4 w-4 mr-2" /> Düzenle
                </DropdownMenuItem>
                {template.template_type === 'excel' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate(`/dashboard/form-templates/excel/${template.id}/online`)}>
                      <ExternalLink className="h-4 w-4 mr-2 text-green-600" /> Online Düzenle (LibreOffice)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/dashboard/form-templates/excel/${template.id}/mapping`)}>
                      <Grid3X3 className="h-4 w-4 mr-2 text-amber-600" /> Görsel Mapping
                    </DropdownMenuItem>
                  </>
                )}
                {template.template_type !== 'excel' && (
                  <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                    <Copy className="h-4 w-4 mr-2" /> Kopyala
                  </DropdownMenuItem>
                )}
                {!template.is_default && (
                  <DropdownMenuItem onClick={() => handleSetDefault(template.id)}>
                    <Star className="h-4 w-4 mr-2" /> Varsayılan Yap
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => template.template_type === 'excel' 
                    ? handleDeleteExcel(template.id) 
                    : handleDelete(template.id)
                  }
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent onClick={() => navigate(getTemplateEditPath(template))}>
        {template.description && (
          <p className="text-sm text-gray-500 mb-3">{template.description}</p>
        )}
        
        <div className="flex flex-wrap gap-2 mb-3">
          {template.usage_types?.map((type) => (
            <Badge key={type} className={getUsageColor(type)}>
              {getUsageLabel(type)}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400">
          {template.template_type === 'excel' ? (
            <>
              <span>{template.max_row || 0} satır</span>
              <span>{template.max_column || 0} sütun</span>
            </>
          ) : template.template_type === 'table' ? (
            <>
              <span>{template.page_count || 1} sayfa</span>
              <span>{template.rows || 0}x{template.columns || 0} hücre</span>
            </>
          ) : (
            <>
              <span>{template.page_count || 1} sayfa</span>
              <span>{template.blocks?.length || 0} kutucuk</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Form Şablonları</h1>
          <p className="text-gray-500">PDF ve Tablo formatında şablonları yönetin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTemplates}>
            <RefreshCw className="h-4 w-4 mr-1" /> Yenile
          </Button>
          <Button variant="outline" onClick={handleImportVakaFormu}>
            <Upload className="h-4 w-4 mr-1" /> VAKA FORMU İçe Aktar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-blue-600">
                <Plus className="h-4 w-4 mr-1" /> Yeni Şablon
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/dashboard/form-templates/pdf/new')}>
                <FileText className="h-4 w-4 mr-2 text-blue-600" />
                PDF Şablonu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/dashboard/form-templates/table/new')}>
                <Table className="h-4 w-4 mr-2 text-green-600" />
                Tablo Şablonu
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard/form-templates/excel/new')}>
                <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                Excel Şablonu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Tümü ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF ({templates.filter(t => t.template_type === 'pdf' || !t.template_type).length})
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            Tablo ({templates.filter(t => t.template_type === 'table').length})
          </TabsTrigger>
          <TabsTrigger value="excel" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel ({templates.filter(t => t.template_type === 'excel').length})
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-2 bg-amber-50">
            <Grid3X3 className="h-4 w-4 text-amber-600" />
            Vaka Formu Mapping
          </TabsTrigger>
        </TabsList>

        {/* Vaka Formu Mapping İçeriği */}
        <TabsContent value="mapping" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Grid3X3 className="h-5 w-5 text-amber-600" />
                    Vaka Formu Excel Hücre Eşlemeleri
                  </CardTitle>
                  <CardDescription>
                    PDF oluşturulurken hangi verinin hangi Excel hücresine yazılacağını belirleyin
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate('/dashboard/form-templates/vaka-form-mapping')}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    📊 Görsel Excel Editörü
                  </Button>
                  <Button variant="outline" onClick={loadCellMapping} disabled={mappingLoading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${mappingLoading ? 'animate-spin' : ''}`} />
                    Yenile
                  </Button>
                  <Button variant="destructive" onClick={handleResetMapping}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Varsayılana Sıfırla
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {mappingLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              ) : cellMapping ? (
                <div className="space-y-4">
                  {/* Özet bilgi */}
                  <div className="flex gap-4 p-4 bg-amber-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">{cellMapping.total_cells}</div>
                      <div className="text-sm text-gray-600">Toplam Hücre</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">{cellMapping.total_checkboxes}</div>
                      <div className="text-sm text-gray-600">Checkbox</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">
                        {Object.keys(cellMapping.cell_mappings || {}).length}
                      </div>
                      <div className="text-sm text-gray-600">Bölüm</div>
                    </div>
                    {cellMapping.is_custom && (
                      <Badge className="bg-green-100 text-green-700 self-center">Özelleştirilmiş</Badge>
                    )}
                  </div>

                  {/* Bölümler */}
                  {Object.entries(cellMapping.cell_mappings || {}).map(([section, cells]) => (
                    <Collapsible
                      key={section}
                      open={expandedSections[section]}
                      onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, [section]: open }))}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                        <div className="flex items-center gap-2 font-medium">
                          {expandedSections[section] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {section}
                          <Badge variant="outline">{cells.length} hücre</Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">Hücre</th>
                                <th className="px-4 py-2 text-left font-medium">Alan (field)</th>
                                <th className="px-4 py-2 text-left font-medium">Görünen Ad</th>
                                <th className="px-4 py-2 text-left font-medium">Kaynak</th>
                                <th className="px-4 py-2 text-center font-medium">İşlem</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cells.map((cell, index) => (
                                <tr key={cell.cell} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-2 font-mono font-bold text-blue-600">{cell.cell}</td>
                                  <td className="px-4 py-2 font-mono text-purple-600">{cell.field}</td>
                                  <td className="px-4 py-2">{cell.label}</td>
                                  <td className="px-4 py-2">
                                    <Badge variant="outline" className="text-xs">
                                      {cell.source}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingCell(cell.cell);
                                        setEditForm({
                                          cell: cell.cell,
                                          field: cell.field,
                                          label: cell.label
                                        });
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}

                  {/* Checkbox Mappings */}
                  {cellMapping.checkbox_mappings && Object.keys(cellMapping.checkbox_mappings).length > 0 && (
                    <Collapsible
                      open={expandedSections['checkboxes']}
                      onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, checkboxes: open }))}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors">
                        <div className="flex items-center gap-2 font-medium text-orange-700">
                          {expandedSections['checkboxes'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          Checkbox Eşlemeleri
                          <Badge className="bg-orange-200 text-orange-700">
                            {Object.keys(cellMapping.checkbox_mappings).length} grup
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        {Object.entries(cellMapping.checkbox_mappings).map(([group, config]) => (
                          <div key={group} className="p-3 border rounded-lg bg-orange-50">
                            <div className="font-medium text-orange-700 mb-2">{group} ({config.field})</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {Object.entries(config.options).map(([value, cell]) => (
                                <div key={value} className="flex items-center gap-2 text-sm">
                                  <span className="font-mono text-blue-600">{cell}</span>
                                  <span className="text-gray-600">→ {value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Grid3X3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Hücre eşlemeleri yüklenmedi</p>
                  <Button className="mt-4" onClick={loadCellMapping}>Yükle</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Düzenleme Dialog'u */}
          <Dialog open={!!editingCell} onOpenChange={() => setEditingCell(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hücre Eşlemesini Düzenle</DialogTitle>
                <DialogDescription>
                  Excel hücresi {editForm.cell} için eşlemeyi düzenleyin
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Hücre</Label>
                  <Input value={editForm.cell} disabled className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Alan Adı (field)</Label>
                  <Input 
                    value={editForm.field}
                    onChange={(e) => setEditForm(prev => ({ ...prev, field: e.target.value }))}
                    placeholder="patientName, age, bloodPressure vb."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Görünen Ad</Label>
                  <Input 
                    value={editForm.label}
                    onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Hasta Adı Soyadı"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingCell(null)}>İptal</Button>
                <Button onClick={handleUpdateCellMapping}>
                  <Save className="h-4 w-4 mr-1" />
                  Kaydet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Şablon Listesi */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-600 mb-2">Henüz şablon yok</h3>
            <p className="text-gray-400 mb-4">PDF veya Tablo şablonu oluşturarak başlayın</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/dashboard/form-templates/pdf/new')}>
                <FileText className="h-4 w-4 mr-1" /> PDF Şablonu
              </Button>
              <Button onClick={() => navigate('/dashboard/form-templates/table/new')}>
                <Table className="h-4 w-4 mr-1" /> Tablo Şablonu
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FormTemplates;

