import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Search, Filter, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Cases = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: ''
  });

  useEffect(() => {
    loadCases();
  }, [filters]);

  const loadCases = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.search) params.search = filters.search;

      const response = await casesAPI.getAll(params);
      setCases(response.data);
    } catch (error) {
      console.error('Error loading cases:', error);
      toast.error('Vakalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const priorityColors = {
    yuksek: 'bg-red-100 text-red-800',
    orta: 'bg-yellow-100 text-yellow-800',
    dusuk: 'bg-green-100 text-green-800'
  };

  const priorityLabels = {
    yuksek: 'Yüksek',
    orta: 'Orta',
    dusuk: 'Düşük'
  };

  const statusLabels = {
    acildi: 'Açıldı',
    ekip_bilgilendirildi: 'Ekip Bilgilendirildi',
    ekip_yola_cikti: 'Ekip Yola Çıktı',
    sahada: 'Sahada',
    hasta_alindi: 'Hasta Alındı',
    doktor_konsultasyonu: 'Doktor Konsültasyonu',
    merkeze_donus: 'Merkeze Dönüş',
    hastane_sevki: 'Hastane Sevki',
    tamamlandi: 'Tamamlandı',
    iptal: 'İptal'
  };

  const canCreateCase = ['cagri_merkezi', 'operasyon_muduru', 'merkez_ofis'].includes(user?.role);

  return (
    <div className="space-y-6" data-testid="cases-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vakalar</h1>
          <p className="text-gray-500">Tüm vakalara genel bakış</p>
        </div>
        {canCreateCase && (
          <Button onClick={() => navigate('/dashboard/call-center')} data-testid="new-case-button">
            <Plus className="h-4 w-4 mr-2" />
            Yeni Vaka
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtreler</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Durum</label>
              <Select value={filters.status || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}>
                <SelectTrigger data-testid="filter-status">
                  <SelectValue placeholder="Tüm durumlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm durumlar</SelectItem>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Öncelik</label>
              <Select value={filters.priority || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value === 'all' ? '' : value }))}>
                <SelectTrigger data-testid="filter-priority">
                  <SelectValue placeholder="Tüm öncelikler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm öncelikler</SelectItem>
                  <SelectItem value="yuksek">Yüksek</SelectItem>
                  <SelectItem value="orta">Orta</SelectItem>
                  <SelectItem value="dusuk">Düşük</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Arama</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Vaka no, hasta adı..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                  data-testid="filter-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Vaka bulunamadı</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cases.map((caseItem) => (
            <Card
              key={caseItem.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/dashboard/cases/${caseItem.id}`)}
              data-testid={`case-item-${caseItem.case_number}`}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-lg">{caseItem.case_number}</span>
                      <Badge className={priorityColors[caseItem.priority]}>
                        {priorityLabels[caseItem.priority]}
                      </Badge>
                      <Badge variant="outline">{statusLabels[caseItem.status]}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Hasta:</span> {caseItem.patient.name} {caseItem.patient.surname}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Yaş:</span> {caseItem.patient.age} | 
                        <span className="font-medium"> Cinsiyet:</span> {caseItem.patient.gender}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Şikayet:</span> {caseItem.patient.complaint}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Oluşturulma: {new Date(caseItem.created_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Cases;
