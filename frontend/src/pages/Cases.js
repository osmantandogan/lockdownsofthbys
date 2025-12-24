import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Search, Filter, Plus, ChevronRight, Users, Pill, Hospital, Calendar, X, Truck, WifiOff, CloudOff, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import OfflineStorage from '../services/OfflineStorage';

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

const Cases = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, getPendingCases, cacheCase, syncNow, pendingCount } = useOffline();
  const [cases, setCases] = useState([]);
  const [pendingCases, setPendingCases] = useState([]);
  const [cachedCases, setCachedCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recent'); // 'recent', 'archive', or 'pending'
  const [archivePage, setArchivePage] = useState(1);
  const [hasMoreArchive, setHasMoreArchive] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  
  // Arşiv yetki kontrolü
  const [archivePasswordDialog, setArchivePasswordDialog] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [archiveUnlocked, setArchiveUnlocked] = useState(false);
  
  // Arşive doğrudan erişebilen roller
  const archiveAuthorizedRoles = ['doctor', 'operations_manager', 'central_office', 'head_driver'];
  const canAccessArchive = archiveAuthorizedRoles.includes(user?.role);
  
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
    source: '', // 'call_center' or 'registration'
    start_date: '',
    end_date: ''
  });
  
  const [advancedFilters, setAdvancedFilters] = useState({
    user_id: '',
    medication_name: '',
    has_hospital_transfer: ''
  });

  // Debounce search input to avoid too many API calls
  const debouncedSearch = useDebounce(filters.search, 500);
  const debouncedUserIdSearch = useDebounce(advancedFilters.user_id, 500);
  const debouncedMedicationSearch = useDebounce(advancedFilters.medication_name, 500);

  // Pending ve cached vakaları yükle
  const loadOfflineCases = useCallback(async () => {
    try {
      const pending = await getPendingCases();
      setPendingCases(pending || []);
      
      const cached = await OfflineStorage.getCachedCases();
      setCachedCases(cached || []);
    } catch (error) {
      console.error('Offline vakalar yüklenemedi:', error);
    }
  }, [getPendingCases]);

  const loadCases = useCallback(async () => {
    // Pending tab'ında API çağrısı yapma
    if (activeTab === 'pending') {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (debouncedSearch) params.search = debouncedSearch;  // Use debounced value
      if (filters.source) params.source = filters.source;
      
      if (activeTab === 'recent') {
        // Son 24 saat
        params.last_24h = true;
      } else if (activeTab === 'archive') {
        // Arşiv - tarih filtresi
        if (filters.start_date) params.start_date = filters.start_date;
        if (filters.end_date) params.end_date = filters.end_date;
        params.page = archivePage;
        params.limit = 30;
      }
      
      // Advanced filters - use debounced values
      if (debouncedUserIdSearch) params.user_id = debouncedUserIdSearch;
      if (debouncedMedicationSearch) params.medication_name = debouncedMedicationSearch;
      if (advancedFilters.has_hospital_transfer && advancedFilters.has_hospital_transfer !== 'all') {
        params.has_hospital_transfer = advancedFilters.has_hospital_transfer === 'true';
      }

      const response = await casesAPI.getAll(params);
      const newCases = response.data || [];
      
      // Vakaları cache'le
      for (const caseItem of newCases.slice(0, 20)) {
        try {
          await cacheCase(caseItem);
        } catch (e) {
          // Cache hatası görmezden gel
        }
      }
      
      if (activeTab === 'recent') {
        setCases(newCases);
      } else if (activeTab === 'archive') {
        // Archive - append to existing
        if (archivePage === 1) {
          setCases(newCases);
        } else {
          setCases(prev => [...prev, ...newCases]);
        }
        setHasMoreArchive(newCases.length === 30);
      }
    } catch (error) {
      console.error('Error loading cases:', error);
      
      // Offline ise cache'den göster
      if (!isOnline) {
        const cached = await OfflineStorage.getCachedCases();
        setCases(cached || []);
        toast.info('Çevrimdışı mod - Cache\'den gösteriliyor');
      } else {
        toast.error('Vakalar yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [
    activeTab, 
    filters.status, 
    filters.priority, 
    debouncedSearch, 
    filters.source, 
    filters.start_date, 
    filters.end_date, 
    debouncedUserIdSearch, 
    debouncedMedicationSearch, 
    advancedFilters.has_hospital_transfer, 
    archivePage,
    isOnline
  ]);

  // Use debounced values for API calls
  useEffect(() => {
    loadCases();
    loadOfflineCases();
  }, [loadCases, loadOfflineCases]);

  const loadMoreArchive = () => {
    setArchivePage(prev => prev + 1);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      search: '',
      source: '',
      start_date: '',
      end_date: ''
    });
    setAdvancedFilters({
      user_id: '',
      medication_name: '',
      has_hospital_transfer: ''
    });
    setArchivePage(1);
  };

  const getSourceBadge = (source) => {
    if (source === 'registration') {
      return <Badge className="bg-purple-100 text-purple-800">Kayıt Ekranı</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800">Çağrı Merkezi</Badge>;
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

  const canCreateCase = ['cagri_merkezi', 'operasyon_muduru', 'merkez_ofis', 'hemsire', 'doktor'].includes(user?.role);

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

      {/* Arşiv Şifre Diyaloğu */}
      <Dialog open={archivePasswordDialog} onOpenChange={setArchivePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 Arşiv Erişimi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">Arşive erişmek için yönetici şifresini girin.</p>
            <Input
              type="password"
              placeholder="Şifre"
              value={archivePassword}
              onChange={(e) => setArchivePassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (archivePassword === '1234') {
                    setArchiveUnlocked(true);
                    setActiveTab('archive');
                    setArchivePasswordDialog(false);
                    setArchivePassword('');
                    toast.success('Arşiv erişimi sağlandı');
                  } else {
                    toast.error('Hatalı şifre');
                    setArchivePassword('');
                  }
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setArchivePasswordDialog(false);
                  setArchivePassword('');
                }}
                className="flex-1"
              >
                İptal
              </Button>
              <Button
                onClick={() => {
                  if (archivePassword === '1234') {
                    setArchiveUnlocked(true);
                    setActiveTab('archive');
                    setArchivePasswordDialog(false);
                    setArchivePassword('');
                    toast.success('Arşiv erişimi sağlandı');
                  } else {
                    toast.error('Hatalı şifre');
                    setArchivePassword('');
                  }
                }}
                className="flex-1"
              >
                Giriş
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        // Arşiv sekmesi için yetki kontrolü
        if (v === 'archive' && !canAccessArchive && !archiveUnlocked) {
          setArchivePasswordDialog(true);
          return;
        }
        setActiveTab(v);
        setArchivePage(1);
        setCases([]);
      }}>
        <TabsList>
          <TabsTrigger value="recent">Son 24 Saat</TabsTrigger>
          <TabsTrigger value="archive">
            {!canAccessArchive && !archiveUnlocked && '🔒 '}Arşiv
          </TabsTrigger>
          {pendingCases.length > 0 && (
            <TabsTrigger value="pending" className="text-orange-600">
              <WifiOff className="h-4 w-4 mr-1" />
              Bekleyen ({pendingCases.length})
            </TabsTrigger>
          )}
        </TabsList>
        
        {/* Offline bilgi barı */}
        {!isOnline && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-800 text-sm">
            <CloudOff className="h-4 w-4" />
            <span>Çevrimdışı mod - Cache&apos;den gösteriliyor. {pendingCases.length > 0 && `${pendingCases.length} vaka bekleniyor.`}</span>
          </div>
        )}

        {/* Filters */}
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Filtreler</span>
              </CardTitle>
              <div className="flex gap-2">
                <Dialog open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-1" />
                      Gelişmiş Filtreler
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Gelişmiş Filtreler</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Hangi Kişi İşlem Yapmış</Label>
                        <Input
                          placeholder="Kullanıcı ID veya isim ara..."
                          value={advancedFilters.user_id}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, user_id: e.target.value }))}
                        />
                        <p className="text-xs text-gray-500 mt-1">Kullanıcı ID veya isim ile arayın</p>
                      </div>
                      <div>
                        <Label>Hangi İlaç Kullanılmış</Label>
                        <Input
                          placeholder="İlaç adı..."
                          value={advancedFilters.medication_name}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, medication_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Hastaneye Sevk</Label>
                        <Select
                          value={advancedFilters.has_hospital_transfer}
                          onValueChange={(v) => setAdvancedFilters(prev => ({ ...prev, has_hospital_transfer: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seçiniz" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tümü</SelectItem>
                            <SelectItem value="true">Evet</SelectItem>
                            <SelectItem value="false">Hayır</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => {
                          setAdvancedFilters({ user_id: '', medication_name: '', has_hospital_transfer: '' });
                          loadCases();
                        }} variant="outline" className="flex-1">
                          Temizle
                        </Button>
                        <Button onClick={() => {
                          setAdvancedFiltersOpen(false);
                          loadCases();
                        }} className="flex-1">
                          Uygula
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Temizle
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
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
                <label className="text-sm font-medium">Kaynak</label>
                <Select value={filters.source || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, source: value === 'all' ? '' : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tüm kaynaklar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm kaynaklar</SelectItem>
                    <SelectItem value="call_center">Çağrı Merkezi</SelectItem>
                    <SelectItem value="registration">Kayıt Ekranı</SelectItem>
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
            
            {activeTab === 'archive' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Başlangıç Tarihi</label>
                  <Input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bitiş Tarihi</label>
                  <Input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cases List */}
        <TabsContent value="recent" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : cases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">Son 24 saatte vaka bulunamadı</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cases.map((caseItem) => (
                <Card
                  key={caseItem.id || caseItem._id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/dashboard/cases/${caseItem.id || caseItem._id}`)}
                  data-testid={`case-item-${caseItem.case_number}`}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-3 flex-wrap gap-2">
                          <span className="font-bold text-lg">{caseItem.case_number}</span>
                          {getSourceBadge(caseItem.source)}
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
                        {/* Atanan Ekip Bilgisi */}
                        {caseItem.assigned_team && (
                          <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Truck className="h-4 w-4 text-blue-600" />
                                <span className="font-semibold text-blue-800">
                                  {caseItem.assigned_team.vehicle_plate || 'Plaka Yok'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {caseItem.assigned_team.driver_name && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">Şoför:</span>
                                    <span className="font-medium text-blue-700">{caseItem.assigned_team.driver_name}</span>
                                  </div>
                                )}
                                {caseItem.assigned_team.paramedic_name && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">Paramedik:</span>
                                    <span className="font-medium text-blue-700">{caseItem.assigned_team.paramedic_name}</span>
                                  </div>
                                )}
                                {caseItem.assigned_team.att_name && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">ATT:</span>
                                    <span className="font-medium text-blue-700">{caseItem.assigned_team.att_name}</span>
                                  </div>
                                )}
                                {caseItem.assigned_team.nurse_name && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">Hemşire:</span>
                                    <span className="font-medium text-blue-700">{caseItem.assigned_team.nurse_name}</span>
                                  </div>
                                )}
                                {caseItem.assigned_team.doctor_name && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">Doktor:</span>
                                    <span className="font-medium text-blue-700">{caseItem.assigned_team.doctor_name}</span>
                                  </div>
                                )}
                              </div>
                              {caseItem.assigned_team.assigned_by_name && (
                                <div className="text-xs text-gray-500 border-t border-blue-200 pt-2 mt-2">
                                  Atayan: {caseItem.assigned_team.assigned_by_name} ({caseItem.assigned_team.assigned_by_role || 'Rol Yok'})
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          {loading && archivePage === 1 ? (
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
            <>
              <div className="grid gap-4">
                {cases.map((caseItem) => (
                  <Card
                    key={caseItem.id || caseItem._id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/dashboard/cases/${caseItem.id || caseItem._id}`)}
                    data-testid={`case-item-${caseItem.case_number}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-3 flex-wrap gap-2">
                            <span className="font-bold text-lg">{caseItem.case_number}</span>
                            {getSourceBadge(caseItem.source)}
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
                          {/* Atanan Ekip Bilgisi */}
                          {caseItem.assigned_team && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Truck className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-blue-800">
                                    {caseItem.assigned_team.vehicle_plate || 'Plaka Yok'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {caseItem.assigned_team.driver_name && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-600">Şoför:</span>
                                      <span className="font-medium text-blue-700">{caseItem.assigned_team.driver_name}</span>
                                    </div>
                                  )}
                                  {caseItem.assigned_team.paramedic_name && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-600">Paramedik:</span>
                                      <span className="font-medium text-blue-700">{caseItem.assigned_team.paramedic_name}</span>
                                    </div>
                                  )}
                                  {caseItem.assigned_team.att_name && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-600">ATT:</span>
                                      <span className="font-medium text-blue-700">{caseItem.assigned_team.att_name}</span>
                                    </div>
                                  )}
                                  {caseItem.assigned_team.nurse_name && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-600">Hemşire:</span>
                                      <span className="font-medium text-blue-700">{caseItem.assigned_team.nurse_name}</span>
                                    </div>
                                  )}
                                  {caseItem.assigned_team.doctor_name && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-600">Doktor:</span>
                                      <span className="font-medium text-blue-700">{caseItem.assigned_team.doctor_name}</span>
                                    </div>
                                  )}
                                </div>
                                {caseItem.assigned_team.assigned_by_name && (
                                  <div className="text-xs text-gray-500 border-t border-blue-200 pt-2 mt-2">
                                    Atayan: {caseItem.assigned_team.assigned_by_name} ({caseItem.assigned_team.assigned_by_role || 'Rol Yok'})
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">
                            Oluşturulma: {new Date(caseItem.created_at).toLocaleString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {hasMoreArchive && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={loadMoreArchive} variant="outline" disabled={loading}>
                    {loading ? 'Yükleniyor...' : 'Daha Fazla Yükle (30)'}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Pending Cases Tab */}
        <TabsContent value="pending" className="mt-4">
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <WifiOff className="h-5 w-5" />
                  Bekleyen Vakalar ({pendingCases.length})
                </CardTitle>
                {isOnline && pendingCases.length > 0 && (
                  <Button 
                    onClick={() => {
                      syncNow();
                      toast.info('Senkronizasyon başlatıldı');
                    }}
                    size="sm"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Şimdi Senkronize Et
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Bu vakalar çevrimdışı iken oluşturuldu. İnternet bağlantısı sağlandığında otomatik olarak sunucuya gönderilecek.
              </p>
            </CardContent>
          </Card>

          {pendingCases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">Bekleyen vaka yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingCases.map((pendingCase, index) => (
                <Card 
                  key={pendingCase.id || index}
                  className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                            <Clock className="h-3 w-3 mr-1" />
                            Beklemede
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(pendingCase.createdAt).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {pendingCase.patient?.name} {pendingCase.patient?.surname}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">TC:</span> {pendingCase.patient?.tc_no || 'Belirtilmedi'}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Şikayet:</span> {pendingCase.patient?.complaint || 'Belirtilmedi'}
                          </p>
                          {pendingCase.company && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Firma:</span> {pendingCase.company}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Cases;
