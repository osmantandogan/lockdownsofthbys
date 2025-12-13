import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, Search, Save, X, RefreshCw } from 'lucide-react';
import { firmsAPI } from '../api';

const FirmManagement = () => {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFirmName, setNewFirmName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFirms();
  }, []);

  const loadFirms = async () => {
    setLoading(true);
    try {
      const response = await firmsAPI.getAll();
      // API direkt array dönüyor, axios response.data'da sarar
      const firmsData = Array.isArray(response.data) ? response.data : [];
      console.log('Firmalar yüklendi:', firmsData);
      setFirms(firmsData);
    } catch (error) {
      console.error('Firmalar yüklenemedi:', error);
      toast.error('Firmalar yüklenemedi');
      setFirms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFirm = async () => {
    if (!newFirmName.trim()) {
      toast.error('Firma adı boş olamaz');
      return;
    }

    // Aynı isimde firma var mı kontrol et
    const exists = firms.some(f => f.name.toLowerCase() === newFirmName.trim().toLowerCase());
    if (exists) {
      toast.error('Bu isimde bir firma zaten mevcut');
      return;
    }

    setSaving(true);
    try {
      await firmsAPI.create({ name: newFirmName.trim() });
      toast.success('Firma eklendi');
      setNewFirmName('');
      setShowAddForm(false);
      loadFirms();
    } catch (error) {
      console.error('Firma eklenemedi:', error);
      toast.error('Firma eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFirm = async (firmId, firmName) => {
    if (!window.confirm(`"${firmName}" firmasını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await firmsAPI.delete(firmId);
      toast.success('Firma silindi');
      loadFirms();
    } catch (error) {
      console.error('Firma silinemedi:', error);
      toast.error('Firma silinemedi');
    }
  };

  // Arama filtresi
  const filteredFirms = searchQuery 
    ? firms.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : firms;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Firma Yönetimi
          </h1>
          <p className="text-gray-500 text-sm">Vaka formlarında kullanılan firma listesini yönetin</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFirms}>
            <RefreshCw className="h-4 w-4 mr-1" /> Yenile
          </Button>
          <Button 
            onClick={() => setShowAddForm(true)} 
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Yeni Firma
          </Button>
        </div>
      </div>

      {/* Yeni Firma Ekleme Formu */}
      {showAddForm && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-sm font-medium">Yeni Firma Adı</Label>
                <Input
                  placeholder="Firma adını girin..."
                  value={newFirmName}
                  onChange={(e) => setNewFirmName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFirm()}
                  autoFocus
                />
              </div>
              <Button 
                onClick={handleAddFirm} 
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Ekleniyor...' : 'Ekle'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setNewFirmName('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arama ve Liste */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Firma Listesi</CardTitle>
            <Badge variant="outline">{firms.length} firma</Badge>
          </div>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Firma ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-2">Yükleniyor...</p>
            </div>
          ) : filteredFirms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz firma eklenmemiş'}
            </div>
          ) : (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {filteredFirms.map((firm, index) => (
                <div 
                  key={firm._id || firm.id || index} 
                  className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{firm.name}</span>
                    {firm.is_default && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs">Varsayılan</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {firm.created_at && (
                      <span className="text-xs text-gray-400">
                        {new Date(firm.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFirm(firm._id || firm.id, firm.name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bilgilendirme */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Not:</strong> Burada eklediğiniz firmalar, Çağrı Merkezi formundaki firma arama alanında otomatik olarak görünecektir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirmManagement;

