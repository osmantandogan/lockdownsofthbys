import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI, patientsAPI, shiftsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { User, MapPin, AlertCircle, Hash, Building2, UserPlus, Stethoscope, Search, Heart, AlertTriangle, Clock, Calendar, WifiOff, Cloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import ReferenceDataCache from '../services/ReferenceDataCache';
import { getTurkeyTimeISO } from '../utils/timezone';

// Türkiye İl/İlçe Verileri
const TURKEY_PROVINCES = [
  'Zonguldak', 'Bartın', 'Karabük', 'Kastamonu', 'Bolu', 'Düzce', 'Ankara', 'İstanbul', 'Kocaeli', 'Sakarya'
];

const DISTRICTS_BY_PROVINCE = {
  'Zonguldak': ['Merkez', 'Ereğli', 'Çaycuma', 'Devrek', 'Gökçebey', 'Alaplı', 'Kilimli', 'Kozlu'],
  'Bartın': ['Merkez', 'Amasra', 'Kurucaşile', 'Ulus'],
  'Karabük': ['Merkez', 'Safranbolu', 'Yenice', 'Eskipazar', 'Ovacık', 'Eflani'],
  'Kastamonu': ['Merkez', 'Cide', 'İnebolu', 'Tosya', 'Taşköprü'],
  'Bolu': ['Merkez', 'Gerede', 'Mudurnu', 'Mengen', 'Göynük'],
  'Düzce': ['Merkez', 'Akçakoca', 'Kaynaşlı', 'Yığılca', 'Gölyaka'],
  'Ankara': ['Çankaya', 'Keçiören', 'Mamak', 'Etimesgut', 'Yenimahalle', 'Sincan', 'Altındağ', 'Pursaklar'],
  'İstanbul': ['Kadıköy', 'Beşiktaş', 'Üsküdar', 'Fatih', 'Şişli', 'Bakırköy', 'Beyoğlu', 'Sarıyer', 'Maltepe', 'Pendik'],
  'Kocaeli': ['İzmit', 'Gebze', 'Darıca', 'Körfez', 'Gölcük', 'Derince', 'Dilovası'],
  'Sakarya': ['Adapazarı', 'Serdivan', 'Erenler', 'Arifiye', 'Hendek', 'Sapanca', 'Karasu']
};

/**
 * Hasta Kayıt Ekranı
 * ATT, Paramedik ve Hemşireler için ayaktan gelen hasta kayıtları
 */
const PatientRegistration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, createOfflineCase } = useOffline();
  const [loading, setLoading] = useState(false);
  const [nextCaseNumber, setNextCaseNumber] = useState('');
  const [firmsFromCache, setFirmsFromCache] = useState(false);
  
  // Firma sistemi (Cache/API'den)
  const [firms, setFirms] = useState([]);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companyInputRef = useRef(null);
  
  // Proje dışı toggle
  const [isOutsideProject, setIsOutsideProject] = useState(false);
  
  // Kullanıcının günlük lokasyonu
  const [userCurrentLocation, setUserCurrentLocation] = useState('');
  
  // TC Autocomplete için
  const [tcSearch, setTcSearch] = useState('');
  const [tcSuggestions, setTcSuggestions] = useState([]);
  const [tcSearching, setTcSearching] = useState(false);
  const [selectedPatientCard, setSelectedPatientCard] = useState(null);
  const [showTcDropdown, setShowTcDropdown] = useState(false);
  
  // Form oluşturma zamanı
  const [formCreatedAt] = useState(new Date());
  
  const [formData, setFormData] = useState({
    // Patient Info
    patientName: '',
    patientSurname: '',
    patientTcNo: '',
    patientBirthDate: '',
    patientAge: '',
    patientGender: '',
    patientPhone: '',
    patientComplaint: '',
    patientNote: '', // Not alanı hasta bilgilerine taşındı
    // Company
    companyName: '',
    // Location - Proje dışı için
    province: '',
    district: '',
    neighborhood: '',
    streetAddress: '',
    // Priority
    priority: 'dusuk' // Ayaktan gelenlerde varsayılan düşük
  });

  useEffect(() => {
    generateNextCaseNumber();
    loadFirms();
    loadUserCurrentLocation();
  }, []);

  // Firma dropdown dışında tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (companyInputRef.current && !companyInputRef.current.contains(event.target)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Firmaları yükle (önce cache, sonra API)
  const loadFirms = async () => {
    try {
      const result = await ReferenceDataCache.getFirms();
      setFirms(Array.isArray(result.data) ? result.data : []);
      setFirmsFromCache(result.fromCache);
      
      if (result.fromCache && !isOnline) {
        console.log('[PatientRegistration] Firmalar cache\'den yüklendi (offline)');
      }
    } catch (error) {
      console.error('Firmalar yüklenemedi:', error);
      setFirms([]);
    }
  };

  // Kullanıcının o gün çalıştığı lokasyonu al
  const loadUserCurrentLocation = async () => {
    try {
      // Bugünün vardiya atamasını kontrol et
      const response = await shiftsAPI.getMyAssignments();
      const assignments = response.data || [];
      
      // Bugünün tarihiyle eşleşen aktif atamayı bul
      const today = new Date().toISOString().split('T')[0];
      const todayAssignment = assignments.find(a => 
        a.date?.startsWith(today) || a.shift_date?.startsWith(today)
      );
      
      if (todayAssignment?.vehicle?.current_location) {
        setUserCurrentLocation(todayAssignment.vehicle.current_location);
      } else if (todayAssignment?.location_name) {
        setUserCurrentLocation(todayAssignment.location_name);
      } else if (todayAssignment?.vehicle?.plate) {
        setUserCurrentLocation(`Araç: ${todayAssignment.vehicle.plate}`);
      } else {
        setUserCurrentLocation('Sağlık Merkezi');
      }
    } catch (error) {
      console.error('Lokasyon alınamadı:', error);
      setUserCurrentLocation('Sağlık Merkezi');
    }
  };

  // TC arama - debounced (offline destekli)
  useEffect(() => {
    const searchPatients = async () => {
      if (tcSearch.length < 3) {
        setTcSuggestions([]);
        setShowTcDropdown(false);
        return;
      }
      
      setTcSearching(true);
      try {
        // Offline-first arama
        const result = await ReferenceDataCache.searchPatients(tcSearch);
        setTcSuggestions((result.data || []).slice(0, 5));
        setShowTcDropdown(result.data?.length > 0);
      } catch (error) {
        console.error('TC arama hatası:', error);
        setTcSuggestions([]);
      } finally {
        setTcSearching(false);
      }
    };

    const timeoutId = setTimeout(searchPatients, 300);
    return () => clearTimeout(timeoutId);
  }, [tcSearch]);

  // Doğum tarihinden yaş hesapla
  const calculateAgeFromBirthDate = (birthDate) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  // Doğum tarihi değiştiğinde yaşı güncelle
  const handleBirthDateChange = (value) => {
    setFormData(prev => ({
      ...prev,
      patientBirthDate: value,
      patientAge: calculateAgeFromBirthDate(value)
    }));
  };

  // Hasta seçildiğinde form alanlarını doldur
  const handleSelectPatient = async (patient) => {
    try {
      let fullPatient = patient;
      
      if (!patient.requires_approval) {
        try {
          const response = await patientsAPI.getById(patient.id);
          fullPatient = response.data;
        } catch (e) {
          console.log('Tam bilgi alınamadı, mevcut bilgiyle devam ediliyor');
        }
      }
      
      setSelectedPatientCard(fullPatient);
      
      // Doğum tarihinden yaş hesapla
      let age = '';
      let birthDate = '';
      if (fullPatient.birth_date) {
        birthDate = fullPatient.birth_date.split('T')[0];
        age = calculateAgeFromBirthDate(birthDate);
      }
      
      setFormData(prev => ({
        ...prev,
        patientTcNo: fullPatient.tc_no,
        patientName: fullPatient.name || '',
        patientSurname: fullPatient.surname || '',
        patientBirthDate: birthDate,
        patientAge: age,
        patientGender: fullPatient.gender === 'erkek' ? 'erkek' : fullPatient.gender === 'kadin' ? 'kadin' : '',
        patientPhone: fullPatient.phone || ''
      }));
      
      setTcSearch(fullPatient.tc_no);
      setShowTcDropdown(false);
      toast.success('Hasta bilgileri yüklendi');
    } catch (error) {
      toast.error('Hasta bilgileri yüklenemedi');
    }
  };

  // TC maskele
  const maskTcNo = (tc) => {
    if (!tc || tc.length < 11) return tc;
    return tc.slice(0, 3) + '******' + tc.slice(-2);
  };

  // Yeni hasta kartı oluştur
  const handleCreateNewPatient = async () => {
    if (!tcSearch || tcSearch.length !== 11) {
      toast.error('Geçerli bir TC Kimlik No giriniz (11 haneli)');
      return;
    }
    
    try {
      const newPatient = await patientsAPI.create({
        tc_no: tcSearch,
        name: formData.patientName || 'İsim Girilmedi',
        surname: formData.patientSurname || 'Soyisim Girilmedi',
        birth_date: formData.patientBirthDate || null,
        gender: formData.patientGender || 'belirtilmemis'
      });
      
      setSelectedPatientCard(newPatient.data);
      setFormData(prev => ({ ...prev, patientTcNo: tcSearch }));
      toast.success('Yeni hasta kartı oluşturuldu');
    } catch (error) {
      if (error.response?.data?.detail?.includes('zaten mevcut')) {
        toast.info('Bu TC ile kayıtlı hasta kartı zaten var');
      } else {
        toast.error(error.response?.data?.detail || 'Hasta kartı oluşturulamadı');
      }
    }
  };

  const generateNextCaseNumber = async () => {
    try {
      const response = await casesAPI.getNextCaseNumber();
      setNextCaseNumber(response.data.next_case_number);
    } catch (error) {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      setNextCaseNumber(`${dateStr}-000001`);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Sadece numerik giriş
  const handleNumericChange = (field, value, maxLength = 11) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, maxLength);
    handleChange(field, numericValue);
  };

  // Firma seçimi
  const handleCompanySelect = (firmName) => {
    setFormData(prev => ({ ...prev, companyName: firmName }));
    setCompanySearch(firmName);
    setShowCompanyDropdown(false);
  };

  // Filtrelenmiş firmalar
  const filteredFirms = companySearch
    ? firms.filter(f => f.name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 8)
    : [];

  // İlçeler
  const availableDistricts = formData.province ? (DISTRICTS_BY_PROVINCE[formData.province] || []) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const patientTcNo = tcSearch.length === 11 ? tcSearch : (formData.patientTcNo || null);
      
      // Lokasyon bilgisi - proje dışı ise il/ilçe/mahalle, değilse kullanıcının lokasyonu
      let locationAddress = userCurrentLocation || 'Sağlık Merkezi - Ayaktan Başvuru';
      let locationDetails = null;
      
      if (isOutsideProject) {
        locationAddress = [
          formData.province,
          formData.district,
          formData.neighborhood,
          formData.streetAddress
        ].filter(Boolean).join(', ');
        locationDetails = {
          province: formData.province,
          district: formData.district,
          neighborhood: formData.neighborhood,
          street_address: formData.streetAddress
        };
      }

      // Form oluşturma zamanını kaydet (Türkiye saati)
      const callTime = getTurkeyTimeISO();
      
      const caseData = {
        caller: {
          name: `${formData.patientName} ${formData.patientSurname}`,
          phone: formData.patientPhone || 'Belirtilmedi',
          relationship: 'kendisi'
        },
        patient: {
          name: formData.patientName,
          surname: formData.patientSurname,
          tc_no: patientTcNo,
          birth_date: formData.patientBirthDate || null,
          age: parseInt(formData.patientAge) || null,
          gender: formData.patientGender,
          complaint: formData.patientComplaint,
          note: formData.patientNote || null
        },
        company: formData.companyName || null,
        location: {
          address: locationAddress,
          district: formData.district || null,
          village_or_neighborhood: formData.neighborhood || null,
          is_outside_project: isOutsideProject,
          details: locationDetails
        },
        priority: formData.priority,
        case_details: {
          type: 'ayaktan_basvuru',
          registered_by: user?.name || 'Bilinmeyen',
          registered_role: user?.role || 'att',
          user_location: userCurrentLocation
        },
        // Zaman damgaları - hasta alındı olarak başlat
        timestamps: {
          call_received: callTime,
          scene_arrival: callTime, // Ayaktan başvuruda zaten sahadayız
          patient_contact: callTime // Hasta zaten yanımızda
        },
        // Durum - hasta alındı olarak başlat
        status: 'hasta_alindi'
      };

      // Online ise normal kayıt, offline ise yerel kayıt
      if (isOnline) {
        const response = await casesAPI.create(caseData);
        const caseId = response.data.id || response.data._id;
        const caseNumber = response.data.case_number;
        
        if (!caseId) {
          toast.error('Kayıt oluşturuldu ancak ID alınamadı. Vakalar listesinden erişebilirsiniz.');
          navigate('/dashboard/cases');
          return;
        }
        
        toast.success(`Hasta kaydı oluşturuldu: ${caseNumber}`);
        navigate(`/dashboard/cases/${caseId}`);
      } else {
        // Offline kayıt
        const result = await createOfflineCase(caseData);
        if (result.success) {
          toast.info('Hasta kaydı çevrimdışı olarak kaydedildi. İnternet bağlantısı sağlandığında sunucuya gönderilecek.');
          navigate('/dashboard/cases');
        } else {
          toast.error('Çevrimdışı kayıt başarısız: ' + result.error);
        }
      }
      
    } catch (error) {
      console.error('Error creating patient registration:', error);
      
      // Online ise normal hata, değilse offline kayıt dene
      if (!isOnline) {
        try {
          const result = await createOfflineCase(caseData);
          if (result.success) {
            toast.info('Hasta kaydı çevrimdışı olarak kaydedildi.');
            navigate('/dashboard/cases');
            return;
          }
        } catch (offlineError) {
          console.error('Offline save also failed:', offlineError);
        }
      }
      
      const { getErrorMessage } = await import('../utils/formHelpers');
      toast.error(getErrorMessage(error, 'Hasta kaydı oluşturulamadı'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="patient-registration-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="h-8 w-8 text-red-600" />
            Hasta Kayıt
          </h1>
          <p className="text-gray-500">Ayaktan gelen hasta kaydı oluşturun</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Kayıt Zamanı */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Kayıt Zamanı</p>
                <p className="text-sm font-bold text-blue-700">
                  {formCreatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
          {/* Kayıt Numarası */}
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <Hash className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xs text-red-600 font-medium">Yeni Kayıt No</p>
                <p className="text-lg font-bold text-red-700">{nextCaseNumber || 'Yükleniyor...'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bilgilendirme */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Stethoscope className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Ayaktan Başvuru Kaydı</p>
            <p className="text-sm text-blue-700">
              Bu ekran sağlık merkezine ayaktan gelen hastaların kaydı içindir. 
              {userCurrentLocation && <span className="font-semibold"> Lokasyonunuz: {userCurrentLocation}</span>}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Firma Seçimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-red-600" />
              <span>Firma Bilgisi *</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" ref={companyInputRef}>
              <Label htmlFor="company">Firma Seçin *</Label>
              <Input
                id="company"
                value={companySearch}
                onChange={(e) => {
                  setCompanySearch(e.target.value);
                  setShowCompanyDropdown(true);
                  if (!e.target.value) {
                    setFormData(prev => ({ ...prev, companyName: '' }));
                  }
                }}
                onFocus={() => companySearch && setShowCompanyDropdown(true)}
                placeholder="Firma adı yazarak arayın..."
                required={!formData.companyName}
              />
              
              {/* Firma Dropdown */}
              {showCompanyDropdown && companySearch && (
                <div className="relative">
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredFirms.length > 0 ? (
                      filteredFirms.map((firm, index) => (
                        <div
                          key={firm._id || firm.id || index}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleCompanySelect(firm.name)}
                        >
                          <span className="font-medium">{firm.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-gray-500 text-center">
                        Firma bulunamadı
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {formData.companyName && (
                <p className="text-sm text-green-600 font-medium">
                  Seçilen: {formData.companyName}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proje Dışı Toggle ve Lokasyon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-red-600" />
                <span>Lokasyon</span>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="outsideProject" className="text-sm font-normal">Proje Dışı</Label>
                <Switch
                  id="outsideProject"
                  checked={isOutsideProject}
                  onCheckedChange={setIsOutsideProject}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isOutsideProject ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>İl *</Label>
                  <Select value={formData.province} onValueChange={(v) => {
                    handleChange('province', v);
                    handleChange('district', '');
                  }} required>
                    <SelectTrigger>
                      <SelectValue placeholder="İl seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {TURKEY_PROVINCES.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>İlçe *</Label>
                  <Select value={formData.district} onValueChange={(v) => handleChange('district', v)} required disabled={!formData.province}>
                    <SelectTrigger>
                      <SelectValue placeholder="İlçe seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDistricts.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mahalle</Label>
                  <Input
                    value={formData.neighborhood}
                    onChange={(e) => handleChange('neighborhood', e.target.value)}
                    placeholder="Mahalle adı"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sokak/Apartman</Label>
                  <Input
                    value={formData.streetAddress}
                    onChange={(e) => handleChange('streetAddress', e.target.value)}
                    placeholder="Sokak, apartman, daire no"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800">
                  <span className="font-semibold">Olay Yeri:</span> {userCurrentLocation || 'Sağlık Merkezi - Ayaktan Başvuru'}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Lokasyon otomatik olarak günlük çalışma yerinizden alındı.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hasta Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5 text-red-600" />
              <span>Hasta Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="patientName">Ad *</Label>
                <Input
                  id="patientName"
                  value={formData.patientName}
                  onChange={(e) => handleChange('patientName', e.target.value)}
                  placeholder="Hastanın adı"
                  required
                  readOnly={!!selectedPatientCard}
                  className={selectedPatientCard ? 'bg-gray-50' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientSurname">Soyad *</Label>
                <Input
                  id="patientSurname"
                  value={formData.patientSurname}
                  onChange={(e) => handleChange('patientSurname', e.target.value)}
                  placeholder="Hastanın soyadı"
                  required
                  readOnly={!!selectedPatientCard}
                  className={selectedPatientCard ? 'bg-gray-50' : ''}
                />
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="patientTcNo">TC Kimlik No</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="patientTcNo"
                    type="tel"
                    inputMode="numeric"
                    value={tcSearch}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                      setTcSearch(value);
                      if (value.length < 3) {
                        setSelectedPatientCard(null);
                        setFormData(prev => ({ ...prev, patientTcNo: value }));
                      }
                    }}
                    onFocus={() => tcSuggestions.length > 0 && setShowTcDropdown(true)}
                    placeholder="TC ile hasta ara..."
                    maxLength={11}
                    className="pl-10"
                  />
                  {tcSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                
                {/* TC Autocomplete Dropdown */}
                {showTcDropdown && tcSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {tcSuggestions.map((patient) => (
                      <div
                        key={patient.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => handleSelectPatient(patient)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{patient.name} {patient.surname}</p>
                            <p className="text-sm text-gray-500 font-mono">{maskTcNo(patient.tc_no)}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {patient.has_allergies && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Alerji
                              </Badge>
                            )}
                            {patient.has_chronic_diseases && (
                              <Badge className="bg-purple-100 text-purple-700 text-xs">
                                <Heart className="h-3 w-3 mr-1" />
                                Kronik
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Yeni hasta oluştur butonu */}
                {tcSearch.length === 11 && !selectedPatientCard && tcSuggestions.length === 0 && !tcSearching && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 mb-2">
                      Bu TC ile kayıtlı hasta bulunamadı
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCreateNewPatient}
                      className="text-blue-600 border-blue-300"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Yeni Hasta Kartı Oluştur
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="patientBirthDate">Doğum Tarihi</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="patientBirthDate"
                    type="date"
                    value={formData.patientBirthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="pl-10"
                    readOnly={!!selectedPatientCard}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientAge">Yaş *</Label>
                <Input
                  id="patientAge"
                  type="number"
                  min="0"
                  max="150"
                  value={formData.patientAge}
                  onChange={(e) => handleChange('patientAge', e.target.value)}
                  placeholder="Yaş"
                  required
                  readOnly={!!formData.patientBirthDate}
                  className={formData.patientBirthDate ? 'bg-gray-50' : ''}
                />
                {formData.patientBirthDate && (
                  <p className="text-xs text-gray-500">Doğum tarihinden hesaplandı</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientGender">Cinsiyet *</Label>
                <Select 
                  value={formData.patientGender} 
                  onValueChange={(value) => handleChange('patientGender', value)} 
                  required
                  disabled={!!selectedPatientCard}
                >
                  <SelectTrigger className={selectedPatientCard ? 'bg-gray-50' : ''}>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erkek">Erkek</SelectItem>
                    <SelectItem value="kadin">Kadın</SelectItem>
                    <SelectItem value="diger">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientPhone">Telefon</Label>
                <Input
                  id="patientPhone"
                  type="tel"
                  inputMode="numeric"
                  value={formData.patientPhone}
                  onChange={(e) => handleNumericChange('patientPhone', e.target.value)}
                  placeholder="05XXXXXXXXX"
                  maxLength={11}
                />
              </div>
            </div>
            
            {/* Seçilen Hasta - Tıbbi Bilgiler */}
            {selectedPatientCard && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800">
                      Hasta Kartı Yüklendi
                    </span>
                  </div>
                  <Badge className="bg-green-100 text-green-700">
                    {selectedPatientCard.blood_type || 'Kan Grubu Bilinmiyor'}
                  </Badge>
                </div>
                
                {/* Alerjiler */}
                {selectedPatientCard.allergies?.length > 0 && (
                  <div className="p-3 bg-orange-50 rounded border border-orange-200">
                    <p className="text-sm font-semibold text-orange-800 mb-2 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Alerjiler ({selectedPatientCard.allergies.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatientCard.allergies.map((allergy, idx) => (
                        <Badge 
                          key={idx}
                          className={
                            allergy.severity === 'anafilaksi' ? 'bg-red-100 text-red-800' :
                            allergy.severity === 'siddetli' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {allergy.name}
                          {allergy.severity === 'anafilaksi' && ' ⚠️'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Kronik Hastalıklar */}
                {selectedPatientCard.chronic_diseases?.length > 0 && (
                  <div className="p-3 bg-purple-50 rounded border border-purple-200">
                    <p className="text-sm font-semibold text-purple-800 mb-2 flex items-center">
                      <Heart className="h-4 w-4 mr-2" />
                      Kronik Hastalıklar ({selectedPatientCard.chronic_diseases.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatientCard.chronic_diseases.map((disease, idx) => (
                        <Badge key={idx} className="bg-purple-100 text-purple-800">
                          {disease.name}
                          {disease.medications && (
                            <span className="ml-1 text-xs opacity-75">({disease.medications})</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Doktor Uyarıları */}
                {selectedPatientCard.doctor_notes?.filter(n => n.is_alert).length > 0 && (
                  <div className="p-3 bg-red-50 rounded border border-red-200">
                    <p className="text-sm font-semibold text-red-800 mb-2 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Doktor Uyarıları
                    </p>
                    {selectedPatientCard.doctor_notes.filter(n => n.is_alert).map((note, idx) => (
                      <p key={idx} className="text-sm text-red-700">
                        • {note.title}: {note.content}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="patientComplaint">Şikayet / Başvuru Nedeni *</Label>
              <Textarea
                id="patientComplaint"
                placeholder="Hastanın şikayetini veya başvuru nedenini açıklayın"
                value={formData.patientComplaint}
                onChange={(e) => handleChange('patientComplaint', e.target.value)}
                required
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="patientNote">Not (Opsiyonel)</Label>
              <Textarea
                id="patientNote"
                placeholder="Ek notlar..."
                value={formData.patientNote}
                onChange={(e) => handleChange('patientNote', e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Öncelik */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span>Öncelik Seviyesi</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)} required>
              <SelectTrigger>
                <SelectValue placeholder="Öncelik seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yuksek">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Yüksek (Kırmızı) - Acil</span>
                  </div>
                </SelectItem>
                <SelectItem value="orta">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Orta (Sarı)</span>
                  </div>
                </SelectItem>
                <SelectItem value="dusuk">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Düşük (Yeşil) - Rutin</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/dashboard')}
          >
            İptal
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Kaydediliyor...' : 'Hasta Kaydı Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PatientRegistration;
