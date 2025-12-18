import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { formConfigAPI } from '../api';
import { 
  Save, RotateCcw, Pill, Stethoscope, Heart, Wind, Settings, Baby, 
  Package, Droplet, Truck, Phone, AlertTriangle, MapPin, Brain, 
  Activity, Plus, Pencil, Trash2, Check, X, History, ChevronLeft,
  FileText
} from 'lucide-react';

const CaseFormConfig = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [version, setVersion] = useState(1);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Dialog states
  const [editDialog, setEditDialog] = useState({ open: false, type: '', category: '', index: -1, item: null });
  const [addDialog, setAddDialog] = useState({ open: false, type: '', category: '' });
  const [resetDialog, setResetDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [history, setHistory] = useState([]);

  // Yetki kontrolü
  const allowedRoles = ['merkez_ofis', 'operasyon_muduru', 'admin'];
  const canEdit = allowedRoles.includes(user?.role);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await formConfigAPI.getCaseFormFields();
      setConfig(response.data.config);
      setVersion(response.data.version);
      setLastUpdate(response.data.updated_at);
      setLastUpdatedBy(response.data.updated_by_name);
    } catch (error) {
      console.error('Config yükleme hatası:', error);
      toast.error('Yapılandırma yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await formConfigAPI.updateCaseFormFields(config);
      toast.success('Yapılandırma kaydedildi');
      setHasChanges(false);
      loadConfig(); // Yeni versiyon bilgisini al
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Kaydedilemedi: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canEdit) return;
    try {
      await formConfigAPI.resetCaseFormFields();
      toast.success('Varsayılan değerler yüklendi');
      setResetDialog(false);
      setHasChanges(false);
      loadConfig();
    } catch (error) {
      console.error('Reset hatası:', error);
      toast.error('Sıfırlama başarısız');
    }
  };

  const loadHistory = async () => {
    try {
      const response = await formConfigAPI.getHistory(10);
      setHistory(response.data);
      setHistoryDialog(true);
    } catch (error) {
      toast.error('Geçmiş yüklenemedi');
    }
  };

  // ============ ITEM GÜNCELLEME FONKSİYONLARI ============

  const updateSimpleItem = (type, index, field, value) => {
    setConfig(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
    setHasChanges(true);
  };

  const addSimpleItem = (type, item) => {
    setConfig(prev => ({
      ...prev,
      [type]: [...prev[type], item]
    }));
    setHasChanges(true);
  };

  const deleteSimpleItem = (type, index) => {
    setConfig(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };

  const updateProcedureItem = (category, index, field, value) => {
    setConfig(prev => ({
      ...prev,
      procedures: {
        ...prev.procedures,
        [category]: {
          ...prev.procedures[category],
          items: prev.procedures[category].items.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
          )
        }
      }
    }));
    setHasChanges(true);
  };

  const addProcedureItem = (category, item) => {
    setConfig(prev => ({
      ...prev,
      procedures: {
        ...prev.procedures,
        [category]: {
          ...prev.procedures[category],
          items: [...prev.procedures[category].items, item]
        }
      }
    }));
    setHasChanges(true);
  };

  const deleteProcedureItem = (category, index) => {
    setConfig(prev => ({
      ...prev,
      procedures: {
        ...prev.procedures,
        [category]: {
          ...prev.procedures[category],
          items: prev.procedures[category].items.filter((_, i) => i !== index)
        }
      }
    }));
    setHasChanges(true);
  };

  const updateProcedureCategory = (category, field, value) => {
    setConfig(prev => ({
      ...prev,
      procedures: {
        ...prev.procedures,
        [category]: {
          ...prev.procedures[category],
          [field]: value
        }
      }
    }));
    setHasChanges(true);
  };

  // ============ RENDER FONKSİYONLARI ============

  const renderSimpleList = (type, title, icon, color) => {
    const items = config?.[type] || [];
    const Icon = icon;
    
    return (
      <Card>
        <CardHeader className={`bg-gradient-to-r ${color} text-white rounded-t-lg py-3`}>
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <span>{title}</span>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {items.filter(i => i.active).length} aktif / {items.length} toplam
              </Badge>
            </div>
            {canEdit && (
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setAddDialog({ open: true, type, category: '' })}
              >
                <Plus className="h-4 w-4 mr-1" /> Yeni Ekle
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  item.active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Switch
                    checked={item.active}
                    onCheckedChange={(v) => updateSimpleItem(type, index, 'active', v)}
                    disabled={!canEdit}
                  />
                  <div className="flex-1">
                    <span className={`font-medium ${!item.active && 'line-through text-gray-500'}`}>
                      {item.name}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">({item.code})</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setEditDialog({ open: true, type, category: '', index, item })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => deleteSimpleItem(type, index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProcedures = () => {
    const procedures = config?.procedures || {};
    
    return (
      <div className="space-y-6">
        {Object.entries(procedures).map(([categoryKey, category]) => (
          <Card key={categoryKey}>
            <CardHeader className={`bg-gradient-to-r from-${category.color || 'gray'}-500 to-${category.color || 'gray'}-600 text-white rounded-t-lg py-3`}>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  {canEdit ? (
                    <Input
                      value={category.name}
                      onChange={(e) => updateProcedureCategory(categoryKey, 'name', e.target.value)}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/50 w-48"
                    />
                  ) : (
                    <span>{category.name}</span>
                  )}
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    {category.items.filter(i => i.active).length} aktif
                  </Badge>
                </div>
                {canEdit && (
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => setAddDialog({ open: true, type: 'procedures', category: categoryKey })}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Yeni Ekle
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {category.items.map((item, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-2 rounded border ${
                      item.active ? 'bg-white' : 'bg-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Switch
                        checked={item.active}
                        onCheckedChange={(v) => updateProcedureItem(categoryKey, index, 'active', v)}
                        disabled={!canEdit}
                        className="scale-75"
                      />
                      <span className={`text-sm ${!item.active && 'line-through text-gray-500'}`}>
                        {item.name}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditDialog({ open: true, type: 'procedures', category: categoryKey, index, item })}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={() => deleteProcedureItem(categoryKey, index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Yetkiniz Yok</h2>
            <p className="text-gray-500">Bu sayfaya erişim için Merkez Ofis veya Operasyon Müdürü yetkisi gereklidir.</p>
            <Button onClick={() => navigate(-1)} className="mt-4">
              <ChevronLeft className="h-4 w-4 mr-2" /> Geri Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Vaka Formu Yapılandırması
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Vaka formunda kullanılan tüm alanları düzenleyin
          </p>
          {lastUpdate && (
            <p className="text-xs text-gray-400 mt-1">
              v{version} • Son güncelleme: {new Date(lastUpdate).toLocaleString('tr-TR')} 
              {lastUpdatedBy && ` • ${lastUpdatedBy}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadHistory}>
            <History className="h-4 w-4 mr-2" /> Geçmiş
          </Button>
          <Button variant="outline" onClick={() => setResetDialog(true)}>
            <RotateCcw className="h-4 w-4 mr-2" /> Varsayılana Dön
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="h-4 w-4 mr-2" /> 
            {saving ? 'Kaydediliyor...' : hasChanges ? 'Kaydet*' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Kaydedilmemiş değişiklikler var. Kaydetmeyi unutmayın!
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="medications" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="medications" className="flex items-center gap-1">
            <Pill className="h-4 w-4" /> İlaçlar
          </TabsTrigger>
          <TabsTrigger value="procedures" className="flex items-center gap-1">
            <Stethoscope className="h-4 w-4" /> İşlemler
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-1">
            <Package className="h-4 w-4" /> Malzemeler
          </TabsTrigger>
          <TabsTrigger value="fluids" className="flex items-center gap-1">
            <Droplet className="h-4 w-4" /> Sıvılar
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center gap-1">
            <Truck className="h-4 w-4" /> Nakil Türleri
          </TabsTrigger>
          <TabsTrigger value="others" className="flex items-center gap-1">
            <Settings className="h-4 w-4" /> Diğer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="medications" className="mt-4">
          {renderSimpleList('medications', 'Kullanılan İlaçlar', Pill, 'from-green-500 to-emerald-500')}
        </TabsContent>

        <TabsContent value="procedures" className="mt-4">
          {renderProcedures()}
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          {renderSimpleList('materials', 'Kullanılan Malzemeler', Package, 'from-teal-500 to-cyan-500')}
        </TabsContent>

        <TabsContent value="fluids" className="mt-4">
          {renderSimpleList('fluids', 'Sıvı Tedavisi', Droplet, 'from-blue-500 to-indigo-500')}
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          {renderSimpleList('transfers', 'Nakil Türleri', Truck, 'from-purple-500 to-violet-500')}
        </TabsContent>

        <TabsContent value="others" className="mt-4 space-y-4">
          {renderSimpleList('call_types', 'Çağrı Tipleri', Phone, 'from-orange-500 to-amber-500')}
          {renderSimpleList('triage_codes', 'Triaj Kodları', AlertTriangle, 'from-red-500 to-rose-500')}
          {renderSimpleList('result_types', 'Sonuç Türleri', Check, 'from-indigo-500 to-purple-500')}
          {renderSimpleList('scene_types', 'Olay Yeri Türleri', MapPin, 'from-gray-500 to-slate-500')}
          {renderSimpleList('chronic_diseases', 'Kronik Hastalıklar', Activity, 'from-pink-500 to-rose-500')}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Öğeyi Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kod (değiştirilemez)</Label>
              <Input value={editDialog.item?.code || ''} disabled className="bg-gray-100" />
            </div>
            <div className="space-y-2">
              <Label>İsim</Label>
              <Input 
                value={editDialog.item?.name || ''} 
                onChange={(e) => setEditDialog({ ...editDialog, item: { ...editDialog.item, name: e.target.value } })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={editDialog.item?.active || false}
                onCheckedChange={(v) => setEditDialog({ ...editDialog, item: { ...editDialog.item, active: v } })}
              />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ ...editDialog, open: false })}>İptal</Button>
            <Button onClick={() => {
              if (editDialog.type === 'procedures') {
                updateProcedureItem(editDialog.category, editDialog.index, 'name', editDialog.item.name);
                updateProcedureItem(editDialog.category, editDialog.index, 'active', editDialog.item.active);
              } else {
                updateSimpleItem(editDialog.type, editDialog.index, 'name', editDialog.item.name);
                updateSimpleItem(editDialog.type, editDialog.index, 'active', editDialog.item.active);
              }
              setEditDialog({ ...editDialog, open: false });
            }}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addDialog.open} onOpenChange={(open) => setAddDialog({ ...addDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Öğe Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kod (benzersiz, küçük harf, alt çizgi kullanın)</Label>
              <Input 
                id="new-code"
                placeholder="ornek_kod"
                onChange={(e) => e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')}
              />
            </div>
            <div className="space-y-2">
              <Label>İsim</Label>
              <Input id="new-name" placeholder="Örnek İsim" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog({ ...addDialog, open: false })}>İptal</Button>
            <Button onClick={() => {
              const code = document.getElementById('new-code').value;
              const name = document.getElementById('new-name').value;
              if (!code || !name) {
                toast.error('Kod ve isim gereklidir');
                return;
              }
              const newItem = { code, name, active: true };
              if (addDialog.type === 'procedures') {
                addProcedureItem(addDialog.category, newItem);
              } else {
                addSimpleItem(addDialog.type, newItem);
              }
              setAddDialog({ ...addDialog, open: false });
              toast.success('Öğe eklendi');
            }}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Varsayılana Dön
            </DialogTitle>
            <DialogDescription>
              Tüm yapılandırma varsayılan değerlere sıfırlanacak. Bu işlem geri alınamaz!
              Mevcut değişiklikleriniz kaybolacaktır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>İptal</Button>
            <Button variant="destructive" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Sıfırla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Değişiklik Geçmişi
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {history.map((item, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <Badge>v{item.version}</Badge>
                    <span className="text-sm text-gray-500">
                      {new Date(item.updated_at).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{item.updated_by_name || 'Bilinmiyor'}</p>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-center text-gray-500 py-8">Henüz değişiklik yok</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseFormConfig;


