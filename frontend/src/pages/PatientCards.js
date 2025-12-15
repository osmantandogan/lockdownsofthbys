import React, { useState, useEffect, useCallback } from 'react';
import { patientsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import OfflineStorage from '../services/OfflineStorage';
import ReferenceDataCache from '../services/ReferenceDataCache';
import { 
  Search, User, Phone, MapPin, Heart, AlertTriangle, FileText, Plus, 
  Shield, Stethoscope, History, Clock, Trash2, Edit, Eye, Lock,
  Pill, Activity, UserPlus, AlertCircle, CheckCircle, XCircle, WifiOff, CloudOff
} from 'lucide-react';

const PatientCards = () => {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('tc'); // tc, name, phone
  const [searchResults, setSearchResults] = useState([]);
  const [allPatients, setAllPatients] = useState([]); // Tüm hastalar için
  const [allPatientsLoading, setAllPatientsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [stats, setStats] = useState({});
  const [isFromCache, setIsFromCache] = useState(false);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [allergyDialogOpen, setAllergyDialogOpen] = useState(false);
  const [diseaseDialogOpen, setDiseaseDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  
  // Form states
  const [newPatient, setNewPatient] = useState({
    tc_no: '', name: '', surname: '', birth_date: '', gender: 'belirtilmemis',
    blood_type: 'Bilinmiyor', phone: '', email: '', address: '', city: '', district: '',
    insurance_type: '', insurance_number: '', general_notes: ''
  });
  
  const [accessCode, setAccessCode] = useState('');
  const [accessReason, setAccessReason] = useState('');
  
  const [newAllergy, setNewAllergy] = useState({
    type: 'ilac', name: '', severity: 'orta', reaction: '', notes: ''
  });
  
  const [newDisease, setNewDisease] = useState({
    name: '', icd_code: '', diagnosis_date: '', status: 'aktif', medications: '', notes: ''
  });
  
  const [newNote, setNewNote] = useState({
    title: '', content: '', priority: 'normal', is_alert: false
  });

  // Yetkili roller
  const canDirectAccess = ['doktor', 'operasyon_muduru', 'merkez_ofis'].includes(user?.role);
  const canCreate = ['doktor', 'operasyon_muduru', 'merkez_ofis', 'hemsire', 'cagri_merkezi'].includes(user?.role);
  const needsApproval = ['hemsire', 'paramedik', 'att'].includes(user?.role);

  useEffect(() => {
    if (canDirectAccess) {
      loadStats();
      loadAllPatients();
    }
  }, []);

  const loadStats = async () => {
    try {
      const response = await patientsAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  const loadAllPatients = async () => {
    setAllPatientsLoading(true);
    try {
      if (isOnline) {
        // Online - API'den getir ve cache'le
        const response = await patientsAPI.search({ all_patients: true, limit: 500 });
        const patients = response.data || [];
        setAllPatients(patients);
        setIsFromCache(false);
        
        // Cache'e kaydet
        if (patients.length > 0) {
          await OfflineStorage.cachePatients(patients);
          console.log('[PatientCards] Hastalar cache\'e kaydedildi:', patients.length);
        }
      } else {
        // Offline - Cache'den getir
        const cached = await OfflineStorage.getCachedPatients();
        setAllPatients(cached || []);
        setIsFromCache(true);
        
        if (cached.length > 0) {
          toast.info('Çevrimdışı mod - Cache\'den gösteriliyor');
        }
      }
    } catch (error) {
      console.error('Hastalar yüklenirken hata:', error);
      
      // Hata durumunda cache'den dene
      try {
        const cached = await OfflineStorage.getCachedPatients();
        if (cached.length > 0) {
          setAllPatients(cached);
          setIsFromCache(true);
          toast.info('Cache\'den gösteriliyor');
          return;
        }
      } catch (cacheError) {
        console.error('Cache hatası:', cacheError);
      }
      
      toast.error('Hastalar yüklenemedi');
    } finally {
      setAllPatientsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Arama kriteri giriniz');
      return;
    }

    setSearchLoading(true);
    try {
      // Offline-first arama
      const result = await ReferenceDataCache.searchPatients(searchQuery);
      
      if (result.data.length > 0) {
        setSearchResults(result.data);
        setIsFromCache(result.fromCache);
        
        if (result.fromCache && !isOnline) {
          toast.info('Cache\'den gösteriliyor (çevrimdışı)');
        }
      } else {
        // Cache'de yoksa ve online ise API'den ara
        if (isOnline) {
          const params = {};
          if (searchType === 'tc') params.tc_no = searchQuery;
          if (searchType === 'name') params.name = searchQuery;
          if (searchType === 'phone') params.phone = searchQuery;
          
          const response = await patientsAPI.search(params);
          setSearchResults(response.data);
          setIsFromCache(false);
          
          // Sonuçları cache'le
          for (const patient of response.data) {
            await OfflineStorage.cachePatient(patient);
          }
          
          if (response.data.length === 0) {
            toast.info('Sonuç bulunamadı');
          }
        } else {
          setSearchResults([]);
          toast.info('Çevrimdışı - Cache\'de sonuç bulunamadı');
        }
      }
    } catch (error) {
      console.error('Arama hatası:', error);
      
      // Hata durumunda cache'den dene
      try {
        const cached = await OfflineStorage.searchPatients(searchQuery);
        if (cached.length > 0) {
          setSearchResults(cached);
          setIsFromCache(true);
          toast.info('Cache\'den gösteriliyor');
          return;
        }
      } catch (cacheError) {
        console.error('Cache arama hatası:', cacheError);
      }
      
      toast.error('Arama hatası');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleViewPatient = async (patient) => {
    if (patient.requires_approval && needsApproval) {
      setSelectedPatient(patient);
      setAccessDialogOpen(true);
      return;
    }

    setLoading(true);
    try {
      if (isOnline) {
        const response = await patientsAPI.getById(patient.id);
        setSelectedPatient(response.data);
        setDetailDialogOpen(true);
        
        // Cache'e kaydet
        await OfflineStorage.cachePatient(response.data);
      } else {
        // Offline - cache'den getir veya mevcut veriyi kullan
        const cached = await OfflineStorage.getCachedPatientByTc(patient.tc_no);
        if (cached) {
          setSelectedPatient(cached);
          setDetailDialogOpen(true);
          toast.info('Çevrimdışı - Cache\'den gösteriliyor');
        } else {
          // Cache'de detay yok, mevcut veriyi göster
          setSelectedPatient(patient);
          setDetailDialogOpen(true);
          toast.warning('Çevrimdışı - Sınırlı bilgi gösteriliyor');
        }
      }
    } catch (error) {
      if (error.response?.status === 403) {
        setSelectedPatient(patient);
        setAccessDialogOpen(true);
      } else {
        // Hata durumunda cache'den dene
        try {
          const cached = await OfflineStorage.getCachedPatientByTc(patient.tc_no);
          if (cached) {
            setSelectedPatient(cached);
            setDetailDialogOpen(true);
            toast.info('Cache\'den gösteriliyor');
            return;
          }
        } catch (cacheError) {
          console.error('Cache hatası:', cacheError);
        }
        toast.error('Hasta kartı yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccessRequest = async () => {
    if (!accessCode) {
      toast.error('Onay kodu giriniz');
      return;
    }

    setLoading(true);
    try {
      const response = await patientsAPI.requestAccess(selectedPatient.id, {
        patient_id: selectedPatient.id,
        reason: accessReason,
        approval_code: accessCode
      });
      setSelectedPatient(response.data);
      setAccessDialogOpen(false);
      setDetailDialogOpen(true);
      setAccessCode('');
      setAccessReason('');
      toast.success('Erişim onaylandı');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Geçersiz onay kodu');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatient.tc_no || !newPatient.name || !newPatient.surname) {
      toast.error('TC, Ad ve Soyad zorunludur');
      return;
    }

    if (newPatient.tc_no.length !== 11) {
      toast.error('TC Kimlik No 11 haneli olmalıdır');
      return;
    }

    setLoading(true);
    try {
      const response = await patientsAPI.create(newPatient);
      toast.success('Hasta kartı oluşturuldu');
      setCreateDialogOpen(false);
      setSelectedPatient(response.data);
      setDetailDialogOpen(true);
      setNewPatient({
        tc_no: '', name: '', surname: '', birth_date: '', gender: 'belirtilmemis',
        blood_type: 'Bilinmiyor', phone: '', email: '', address: '', city: '', district: '',
        insurance_type: '', insurance_number: '', general_notes: ''
      });
      // Yeni hasta eklendikten sonra listeyi güncelle
      if (canDirectAccess) {
        loadAllPatients();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Oluşturma hatası');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllergy = async () => {
    if (!newAllergy.name) {
      toast.error('Alerjen adı zorunludur');
      return;
    }

    try {
      await patientsAPI.addAllergy(selectedPatient.id, newAllergy);
      toast.success('Alerji eklendi');
      setAllergyDialogOpen(false);
      // Refresh patient data
      const response = await patientsAPI.getById(selectedPatient.id);
      setSelectedPatient(response.data);
      setNewAllergy({ type: 'ilac', name: '', severity: 'orta', reaction: '', notes: '' });
    } catch (error) {
      toast.error('Alerji eklenemedi');
    }
  };

  const handleAddDisease = async () => {
    if (!newDisease.name) {
      toast.error('Hastalık adı zorunludur');
      return;
    }

    try {
      await patientsAPI.addDisease(selectedPatient.id, newDisease);
      toast.success('Kronik hastalık eklendi');
      setDiseaseDialogOpen(false);
      const response = await patientsAPI.getById(selectedPatient.id);
      setSelectedPatient(response.data);
      setNewDisease({ name: '', icd_code: '', diagnosis_date: '', status: 'aktif', medications: '', notes: '' });
    } catch (error) {
      toast.error('Hastalık eklenemedi');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.title || !newNote.content) {
      toast.error('Başlık ve içerik zorunludur');
      return;
    }

    try {
      await patientsAPI.addDoctorNote(selectedPatient.id, newNote);
      toast.success('Not eklendi');
      setNoteDialogOpen(false);
      const response = await patientsAPI.getById(selectedPatient.id);
      setSelectedPatient(response.data);
      setNewNote({ title: '', content: '', priority: 'normal', is_alert: false });
    } catch (error) {
      toast.error('Not eklenemedi');
    }
  };

  const handleRemoveAllergy = async (allergyId) => {
    if (!confirm('Bu alerjiyi silmek istediğinizden emin misiniz?')) return;
    try {
      await patientsAPI.removeAllergy(selectedPatient.id, allergyId);
      toast.success('Alerji silindi');
      const response = await patientsAPI.getById(selectedPatient.id);
      setSelectedPatient(response.data);
    } catch (error) {
      toast.error('Silinemedi');
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'hafif': return 'bg-green-100 text-green-800';
      case 'orta': return 'bg-yellow-100 text-yellow-800';
      case 'siddetli': return 'bg-orange-100 text-orange-800';
      case 'anafilaksi': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'dusuk': return 'bg-gray-100 text-gray-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'yuksek': return 'bg-orange-100 text-orange-800';
      case 'kritik': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <User className="h-8 w-8 mr-3 text-red-600" />
            Hasta Kartları
          </h1>
          <p className="text-gray-500">TC Kimlik ile hasta geçmişi ve tıbbi bilgiler</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-red-600 hover:bg-red-700">
            <UserPlus className="h-4 w-4 mr-2" />
            Yeni Hasta Kartı
          </Button>
        )}
      </div>

      {/* Stats */}
      {canDirectAccess && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stats.total_patients || 0}</p>
              <p className="text-sm text-gray-500">Toplam Hasta</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-orange-600">{stats.with_allergies || 0}</p>
              <p className="text-sm text-gray-500">Alerjisi Olan</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-purple-600">{stats.with_chronic_diseases || 0}</p>
              <p className="text-sm text-gray-500">Kronik Hastalık</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.recently_accessed_30d || 0}</p>
              <p className="text-sm text-gray-500">Son 30 Gün Erişim</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Hasta Ara
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tc">TC Kimlik No</SelectItem>
                <SelectItem value="name">Ad Soyad</SelectItem>
                <SelectItem value="phone">Telefon</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={
                searchType === 'tc' ? '11 haneli TC Kimlik No' :
                searchType === 'name' ? 'Ad veya Soyad' : 'Telefon numarası'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? 'Aranıyor...' : 'Ara'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arama Sonuçları ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchResults.map((patient) => (
                <div 
                  key={patient.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-lg">
                      {patient.name?.charAt(0)}{patient.surname?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{patient.name} {patient.surname}</p>
                      <p className="text-sm text-gray-500">TC: {patient.tc_no}</p>
                      {patient.birth_date && (
                        <p className="text-xs text-gray-400">Doğum: {patient.birth_date}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {patient.has_allergies && (
                      <Badge className="bg-orange-100 text-orange-800">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Alerji
                      </Badge>
                    )}
                    {patient.has_chronic_diseases && (
                      <Badge className="bg-purple-100 text-purple-800">
                        <Heart className="h-3 w-3 mr-1" />
                        Kronik
                      </Badge>
                    )}
                    {patient.requires_approval && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Lock className="h-3 w-3 mr-1" />
                        Onay Gerekli
                      </Badge>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewPatient(patient)}
                      disabled={loading}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Görüntüle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tüm Hastalar - Sadece Yetkili Roller için */}
      {canDirectAccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <User className="h-5 w-5 mr-2 text-red-600" />
                Tüm Hastalar ({allPatients.length})
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadAllPatients}
                disabled={allPatientsLoading}
              >
                {allPatientsLoading ? 'Yükleniyor...' : 'Yenile'}
              </Button>
            </CardTitle>
            <CardDescription>
              Sistemde kayıtlı tüm hasta kartları
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allPatientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <span className="ml-3 text-gray-500">Hastalar yükleniyor...</span>
              </div>
            ) : allPatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Henüz kayıtlı hasta bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {allPatients.map((patient) => (
                  <div 
                    key={patient.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewPatient(patient)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-lg">
                        {patient.name?.charAt(0)}{patient.surname?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{patient.name} {patient.surname}</p>
                        <p className="text-sm text-gray-500">TC: {patient.tc_no}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          {patient.birth_date && (
                            <span className="text-xs text-gray-400">Doğum: {patient.birth_date}</span>
                          )}
                          {patient.phone && (
                            <span className="text-xs text-gray-400">• {patient.phone}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {patient.blood_type && patient.blood_type !== 'Bilinmiyor' && (
                        <Badge className="bg-red-100 text-red-800">
                          {patient.blood_type}
                        </Badge>
                      )}
                      {(patient.has_allergies || (patient.allergies && patient.allergies.length > 0)) && (
                        <Badge className="bg-orange-100 text-orange-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Alerji
                        </Badge>
                      )}
                      {(patient.has_chronic_diseases || (patient.chronic_diseases && patient.chronic_diseases.length > 0)) && (
                        <Badge className="bg-purple-100 text-purple-800">
                          <Heart className="h-3 w-3 mr-1" />
                          Kronik
                        </Badge>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPatient(patient);
                        }}
                        disabled={loading}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Görüntüle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Patient Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Hasta Kartı Oluştur</DialogTitle>
            <DialogDescription>TC Kimlik ile eşleştirilecek hasta bilgilerini girin</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>TC Kimlik No *</Label>
                <Input 
                  value={newPatient.tc_no}
                  onChange={(e) => setNewPatient({...newPatient, tc_no: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                  placeholder="11 haneli"
                  maxLength={11}
                />
              </div>
              <div className="space-y-2">
                <Label>Ad *</Label>
                <Input 
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Soyad *</Label>
                <Input 
                  value={newPatient.surname}
                  onChange={(e) => setNewPatient({...newPatient, surname: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Doğum Tarihi</Label>
                <Input 
                  type="date"
                  value={newPatient.birth_date}
                  onChange={(e) => setNewPatient({...newPatient, birth_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Cinsiyet</Label>
                <Select value={newPatient.gender} onValueChange={(v) => setNewPatient({...newPatient, gender: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erkek">Erkek</SelectItem>
                    <SelectItem value="kadin">Kadın</SelectItem>
                    <SelectItem value="diger">Diğer</SelectItem>
                    <SelectItem value="belirtilmemis">Belirtilmemiş</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kan Grubu</Label>
                <Select value={newPatient.blood_type} onValueChange={(v) => setNewPatient({...newPatient, blood_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', 'Bilinmiyor'].map(bt => (
                      <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input 
                  value={newPatient.phone}
                  onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
                  placeholder="05XX XXX XX XX"
                />
              </div>
              <div className="space-y-2">
                <Label>E-posta</Label>
                <Input 
                  type="email"
                  value={newPatient.email}
                  onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Adres</Label>
              <Textarea 
                value={newPatient.address}
                onChange={(e) => setNewPatient({...newPatient, address: e.target.value})}
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sigorta Türü</Label>
                <Select value={newPatient.insurance_type} onValueChange={(v) => setNewPatient({...newPatient, insurance_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SGK">SGK</SelectItem>
                    <SelectItem value="Özel">Özel Sigorta</SelectItem>
                    <SelectItem value="Yok">Sigorta Yok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sigorta No</Label>
                <Input 
                  value={newPatient.insurance_number}
                  onChange={(e) => setNewPatient({...newPatient, insurance_number: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Genel Notlar</Label>
              <Textarea 
                value={newPatient.general_notes}
                onChange={(e) => setNewPatient({...newPatient, general_notes: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>İptal</Button>
            <Button onClick={handleCreatePatient} disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access Request Dialog (for nurses) */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-yellow-600">
              <Lock className="h-5 w-5 mr-2" />
              Erişim Onayı Gerekli
            </DialogTitle>
            <DialogDescription>
              Bu hasta kartına erişmek için doktor veya müdürden onay kodu alınız
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedPatient && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedPatient.name} {selectedPatient.surname}</p>
                <p className="text-sm text-gray-500">TC: {selectedPatient.tc_no}</p>
                {selectedPatient.has_critical_info && (
                  <Badge className="mt-2 bg-red-100 text-red-800">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Kritik Bilgi Mevcut
                  </Badge>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Erişim Nedeni</Label>
              <Textarea 
                value={accessReason}
                onChange={(e) => setAccessReason(e.target.value)}
                placeholder="Hasta kartına neden erişmeniz gerekiyor?"
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Onay Kodu (6 haneli)</Label>
              <Input 
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Doktor/Müdür OTP kodu"
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
              <p className="text-xs text-gray-500">
                Doktor veya müdürün bildirim panelindeki 6 haneli kodu girin
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)}>İptal</Button>
            <Button onClick={handleAccessRequest} disabled={loading || accessCode.length !== 6}>
              {loading ? 'Doğrulanıyor...' : 'Erişim Talep Et'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patient Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <User className="h-5 w-5 mr-2 text-red-600" />
                Hasta Kartı
              </span>
              {selectedPatient && (
                <Badge className="text-lg px-4 py-1">
                  TC: {selectedPatient.tc_no}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPatient && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="info">Genel Bilgi</TabsTrigger>
                <TabsTrigger value="allergies" className="relative">
                  Alerjiler
                  {selectedPatient.allergies?.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full">
                      {selectedPatient.allergies.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="diseases">Kronik Hastalıklar</TabsTrigger>
                <TabsTrigger value="notes">Doktor Notları</TabsTrigger>
                <TabsTrigger value="history">Tıbbi Geçmiş</TabsTrigger>
              </TabsList>
              
              <ScrollArea className="h-[60vh] mt-4">
                {/* Genel Bilgi */}
                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-500">Kişisel Bilgiler</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ad Soyad:</span>
                          <span className="font-medium">{selectedPatient.name} {selectedPatient.surname}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Doğum Tarihi:</span>
                          <span>{selectedPatient.birth_date || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cinsiyet:</span>
                          <span>{selectedPatient.gender === 'erkek' ? 'Erkek' : selectedPatient.gender === 'kadin' ? 'Kadın' : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Kan Grubu:</span>
                          <Badge className="bg-red-100 text-red-800">{selectedPatient.blood_type}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-500">İletişim</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Telefon:</span>
                          <span>{selectedPatient.phone || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">E-posta:</span>
                          <span>{selectedPatient.email || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Adres:</span>
                          <span className="text-right max-w-[200px]">{selectedPatient.address || '-'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {selectedPatient.general_notes && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-500">Genel Notlar</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p>{selectedPatient.general_notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                {/* Alerjiler */}
                <TabsContent value="allergies" className="space-y-4">
                  {canDirectAccess && (
                    <Button onClick={() => setAllergyDialogOpen(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Alerji Ekle
                    </Button>
                  )}
                  
                  {selectedPatient.allergies?.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-gray-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        <p>Kayıtlı alerji bulunmuyor</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.allergies?.map((allergy) => (
                        <Card key={allergy.id} className="border-l-4 border-l-orange-500">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  <span className="font-semibold">{allergy.name}</span>
                                  <Badge className={getSeverityColor(allergy.severity)}>
                                    {allergy.severity === 'hafif' ? 'Hafif' :
                                     allergy.severity === 'orta' ? 'Orta' :
                                     allergy.severity === 'siddetli' ? 'Şiddetli' : 'Anafilaksi'}
                                  </Badge>
                                </div>
                                {allergy.reaction && (
                                  <p className="text-sm text-gray-600 mt-1">Reaksiyon: {allergy.reaction}</p>
                                )}
                                {allergy.notes && (
                                  <p className="text-sm text-gray-500 mt-1">{allergy.notes}</p>
                                )}
                              </div>
                              {canDirectAccess && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleRemoveAllergy(allergy.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                {/* Kronik Hastalıklar */}
                <TabsContent value="diseases" className="space-y-4">
                  {canDirectAccess && (
                    <Button onClick={() => setDiseaseDialogOpen(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Hastalık Ekle
                    </Button>
                  )}
                  
                  {selectedPatient.chronic_diseases?.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-gray-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        <p>Kayıtlı kronik hastalık bulunmuyor</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.chronic_diseases?.map((disease) => (
                        <Card key={disease.id} className="border-l-4 border-l-purple-500">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <Heart className="h-4 w-4 text-purple-500" />
                                  <span className="font-semibold">{disease.name}</span>
                                  {disease.icd_code && (
                                    <Badge variant="outline">{disease.icd_code}</Badge>
                                  )}
                                </div>
                                {disease.medications && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <Pill className="h-3 w-3 inline mr-1" />
                                    {disease.medications}
                                  </p>
                                )}
                                {disease.notes && (
                                  <p className="text-sm text-gray-500 mt-1">{disease.notes}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                {/* Doktor Notları */}
                <TabsContent value="notes" className="space-y-4">
                  {user?.role === 'doktor' && (
                    <Button onClick={() => setNoteDialogOpen(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Not Ekle
                    </Button>
                  )}
                  
                  {selectedPatient.doctor_notes?.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>Doktor notu bulunmuyor</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.doctor_notes?.map((note) => (
                        <Card key={note.id} className={note.is_alert ? 'border-2 border-red-500' : ''}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  {note.is_alert && <AlertCircle className="h-4 w-4 text-red-500" />}
                                  <span className="font-semibold">{note.title}</span>
                                  <Badge className={getPriorityColor(note.priority)}>
                                    {note.priority === 'dusuk' ? 'Düşük' :
                                     note.priority === 'normal' ? 'Normal' :
                                     note.priority === 'yuksek' ? 'Yüksek' : 'Kritik'}
                                  </Badge>
                                </div>
                                <p className="text-sm mt-2">{note.content}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {note.doctor_name} • {new Date(note.created_at).toLocaleString('tr-TR')}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                {/* Tıbbi Geçmiş */}
                <TabsContent value="history" className="space-y-4">
                  <Card>
                    <CardContent className="py-8 text-center text-gray-500">
                      <History className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>Tıbbi geçmiş bu hasta ile açılan vakalardan otomatik oluşturulur</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Allergy Dialog */}
      <Dialog open={allergyDialogOpen} onOpenChange={setAllergyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alerji Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alerji Tipi</Label>
              <Select value={newAllergy.type} onValueChange={(v) => setNewAllergy({...newAllergy, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ilac">İlaç</SelectItem>
                  <SelectItem value="gida">Gıda</SelectItem>
                  <SelectItem value="cevresel">Çevresel</SelectItem>
                  <SelectItem value="latex">Lateks</SelectItem>
                  <SelectItem value="diger">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Alerjen Adı *</Label>
              <Input 
                value={newAllergy.name}
                onChange={(e) => setNewAllergy({...newAllergy, name: e.target.value})}
                placeholder="örn: Penisilin, Fıstık"
              />
            </div>
            <div className="space-y-2">
              <Label>Şiddet</Label>
              <Select value={newAllergy.severity} onValueChange={(v) => setNewAllergy({...newAllergy, severity: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hafif">Hafif</SelectItem>
                  <SelectItem value="orta">Orta</SelectItem>
                  <SelectItem value="siddetli">Şiddetli</SelectItem>
                  <SelectItem value="anafilaksi">Anafilaksi Riski</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reaksiyon</Label>
              <Input 
                value={newAllergy.reaction}
                onChange={(e) => setNewAllergy({...newAllergy, reaction: e.target.value})}
                placeholder="örn: Döküntü, nefes darlığı"
              />
            </div>
            <div className="space-y-2">
              <Label>Notlar</Label>
              <Textarea 
                value={newAllergy.notes}
                onChange={(e) => setNewAllergy({...newAllergy, notes: e.target.value})}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllergyDialogOpen(false)}>İptal</Button>
            <Button onClick={handleAddAllergy}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Disease Dialog */}
      <Dialog open={diseaseDialogOpen} onOpenChange={setDiseaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kronik Hastalık Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Hastalık Adı *</Label>
              <Input 
                value={newDisease.name}
                onChange={(e) => setNewDisease({...newDisease, name: e.target.value})}
                placeholder="örn: Tip 2 Diyabet"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ICD-10 Kodu</Label>
                <Input 
                  value={newDisease.icd_code}
                  onChange={(e) => setNewDisease({...newDisease, icd_code: e.target.value})}
                  placeholder="örn: E11"
                />
              </div>
              <div className="space-y-2">
                <Label>Tanı Tarihi</Label>
                <Input 
                  type="date"
                  value={newDisease.diagnosis_date}
                  onChange={(e) => setNewDisease({...newDisease, diagnosis_date: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kullandığı İlaçlar</Label>
              <Textarea 
                value={newDisease.medications}
                onChange={(e) => setNewDisease({...newDisease, medications: e.target.value})}
                placeholder="Düzenli kullandığı ilaçları yazın"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Notlar</Label>
              <Textarea 
                value={newDisease.notes}
                onChange={(e) => setNewDisease({...newDisease, notes: e.target.value})}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiseaseDialogOpen(false)}>İptal</Button>
            <Button onClick={handleAddDisease}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Doctor Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Doktor Notu Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Başlık *</Label>
              <Input 
                value={newNote.title}
                onChange={(e) => setNewNote({...newNote, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>İçerik *</Label>
              <Textarea 
                value={newNote.content}
                onChange={(e) => setNewNote({...newNote, content: e.target.value})}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Öncelik</Label>
                <Select value={newNote.priority} onValueChange={(v) => setNewNote({...newNote, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dusuk">Düşük</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="yuksek">Yüksek</SelectItem>
                    <SelectItem value="kritik">Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <input
                  type="checkbox"
                  id="is_alert"
                  checked={newNote.is_alert}
                  onChange={(e) => setNewNote({...newNote, is_alert: e.target.checked})}
                />
                <Label htmlFor="is_alert">Uyarı olarak göster</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>İptal</Button>
            <Button onClick={handleAddNote}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientCards;

