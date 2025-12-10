import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI, vehiclesAPI, patientsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Phone, User, MapPin, AlertCircle, Truck, Bell, FileText, Building2, Hash, Heart, AlertTriangle, Search, UserPlus, Download } from 'lucide-react';
import { COMPANIES, searchCompanies } from '../constants/companies';

const CallCenter = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [createdCaseId, setCreatedCaseId] = useState(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [nextCaseNumber, setNextCaseNumber] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [filteredCompanies, setFilteredCompanies] = useState(COMPANIES);
  
  // TC Autocomplete için
  const [tcSearch, setTcSearch] = useState('');
  const [tcSuggestions, setTcSuggestions] = useState([]);
  const [tcSearching, setTcSearching] = useState(false);
  const [selectedPatientCard, setSelectedPatientCard] = useState(null);
  const [showTcDropdown, setShowTcDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    // Caller Info
    callerName: '',
    callerPhone: '',
    callerRelationship: '',
    // Patient Info
    patientName: '',
    patientSurname: '',
    patientTcNo: '',
    patientAge: '',
    patientGender: '',
    patientComplaint: '',
    // Company
    companyId: '',
    companyName: '',
    // Location
    locationAddress: '',
    locationDistrict: '',
    locationVillage: '',
    // Priority
    priority: '',
    // Vehicle
    vehicleId: ''
  });

  useEffect(() => {
    loadVehicles();
    generateNextCaseNumber();
  }, []);

  // TC arama - debounced
  useEffect(() => {
    const searchPatients = async () => {
      if (tcSearch.length < 3) {
        setTcSuggestions([]);
        setShowTcDropdown(false);
        return;
      }
      
      setTcSearching(true);
      try {
        const response = await patientsAPI.search({ tc_no: tcSearch });
        // Maksimum 3 sonuç göster
        setTcSuggestions(response.data.slice(0, 3));
        setShowTcDropdown(response.data.length > 0);
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

  // Hasta seçildiğinde form alanlarını doldur
  const handleSelectPatient = async (patient) => {
    try {
      // Tam bilgiyi al (eğer erişim varsa)
      let fullPatient = patient;
      
      if (!patient.requires_approval) {
        try {
          const response = await patientsAPI.getById(patient.id);
          fullPatient = response.data;
        } catch (e) {
          // Tam erişim yoksa mevcut bilgiyle devam et
          console.log('Tam bilgi alınamadı, mevcut bilgiyle devam ediliyor');
        }
      }
      
      setSelectedPatientCard(fullPatient);
      
      // Doğum tarihinden yaş hesapla
      let age = '';
      if (fullPatient.birth_date) {
        const birthDate = new Date(fullPatient.birth_date);
        const today = new Date();
        age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000)).toString();
      }
      
      // Form alanlarını doldur
      setFormData(prev => ({
        ...prev,
        patientTcNo: fullPatient.tc_no,
        patientName: fullPatient.name || '',
        patientSurname: fullPatient.surname || '',
        patientAge: age,
        patientGender: fullPatient.gender === 'erkek' ? 'male' : fullPatient.gender === 'kadin' ? 'female' : '',
        patientBirthDate: fullPatient.birth_date || ''
      }));
      
      setTcSearch(fullPatient.tc_no);
      setShowTcDropdown(false);
      toast.success('Hasta bilgileri yüklendi');
    } catch (error) {
      toast.error('Hasta bilgileri yüklenemedi');
    }
  };

  // TC maskele (123******12 formatında)
  const maskTcNo = (tc) => {
    if (!tc || tc.length < 11) return tc;
    return tc.slice(0, 3) + '******' + tc.slice(-2);
  };

  // Hasta bilgilerini getir (TC ile arama)
  const handleFetchPatientInfo = async () => {
    if (!tcSearch || tcSearch.length !== 11) {
      toast.error('Geçerli bir TC Kimlik No giriniz (11 haneli)');
      return;
    }
    
    setTcSearching(true);
    try {
      // TC ile hasta ara
      const response = await patientsAPI.search({ tc_no: tcSearch });
      
      if (response.data && response.data.length > 0) {
        // Hasta bulundu, tam bilgiyi al
        const patient = response.data[0];
        
        try {
          // Tam hasta bilgisini getir
          const fullResponse = await patientsAPI.getById(patient.id);
          const fullPatient = fullResponse.data;
          
          setSelectedPatientCard(fullPatient);
          
          // Doğum tarihinden yaş hesapla
          let age = '';
          if (fullPatient.birth_date) {
            const birthDate = new Date(fullPatient.birth_date);
            const today = new Date();
            age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000)).toString();
          }
          
          // Form alanlarını doldur
          setFormData(prev => ({
            ...prev,
            patientTcNo: fullPatient.tc_no,
            patientName: fullPatient.name || '',
            patientSurname: fullPatient.surname || '',
            patientAge: age,
            patientGender: fullPatient.gender === 'erkek' ? 'erkek' : fullPatient.gender === 'kadin' ? 'kadin' : '',
          }));
          
          toast.success(`Hasta bilgileri yüklendi: ${fullPatient.name} ${fullPatient.surname}`);
        } catch (e) {
          // Tam erişim yoksa temel bilgiyle devam et
          setSelectedPatientCard(patient);
          setFormData(prev => ({
            ...prev,
            patientTcNo: patient.tc_no,
            patientName: patient.name || '',
            patientSurname: patient.surname || '',
          }));
          toast.success('Hasta bilgileri yüklendi (temel bilgi)');
        }
      } else {
        toast.warning('Bu TC ile kayıtlı hasta bulunamadı. Yeni hasta kartı oluşturabilirsiniz.');
      }
    } catch (error) {
      console.error('Hasta bilgisi getirme hatası:', error);
      toast.error(error.response?.data?.detail || 'Hasta bilgisi getirilemedi');
    } finally {
      setTcSearching(false);
    }
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
        gender: formData.patientGender === 'male' ? 'erkek' : formData.patientGender === 'female' ? 'kadin' : 'belirtilmemis'
      });
      
      setSelectedPatientCard(newPatient.data);
      setFormData(prev => ({ ...prev, patientTcNo: tcSearch }));
      toast.success('Yeni hasta kartı oluşturuldu');
    } catch (error) {
      if (error.response?.data?.detail?.includes('zaten mevcut')) {
        toast.info('Bu TC ile kayıtlı hasta kartı zaten var');
        // Zaten varsa bilgilerini getir
        handleFetchPatientInfo();
      } else {
        toast.error(error.response?.data?.detail || 'Hasta kartı oluşturulamadı');
      }
    }
  };

  // Sonraki vaka numarasını oluştur (YYYYMMDD-XXXXXX formatında, 000001'den başlar)
  const generateNextCaseNumber = async () => {
    try {
      // Backend'den son vaka numarasını alıyoruz
      const response = await casesAPI.getNextCaseNumber();
      setNextCaseNumber(response.data.next_case_number);
    } catch (error) {
      // Fallback: Eğer endpoint yoksa local olarak oluştur
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const baseNumber = '000001';
      setNextCaseNumber(`${dateStr}-${baseNumber}`);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll({ status: 'musait' });
      setVehicles(response.data);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Sadece numerik giriş için telefon handler
  const handlePhoneChange = (value) => {
    // Sadece rakamları al
    const numericValue = value.replace(/[^0-9]/g, '');
    // Maksimum 11 karakter (Türkiye telefon formatı)
    const limitedValue = numericValue.slice(0, 11);
    handleChange('callerPhone', limitedValue);
  };

  // Firma arama
  const handleCompanySearch = (value) => {
    setCompanySearch(value);
    setFilteredCompanies(searchCompanies(value));
  };

  // Firma seçimi
  const handleCompanySelect = (companyId) => {
    const company = COMPANIES.find(c => c.id.toString() === companyId);
    if (company) {
      handleChange('companyId', company.id.toString());
      handleChange('companyName', company.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const caseData = {
        caller: {
          name: formData.callerName,
          phone: formData.callerPhone,
          relationship: formData.callerRelationship
        },
        patient: {
          name: formData.patientName,
          surname: formData.patientSurname,
          tc_no: formData.patientTcNo || null,
          age: parseInt(formData.patientAge),
          gender: formData.patientGender,
          complaint: formData.patientComplaint
        },
        company: formData.companyName || null,
        location: {
          address: formData.locationAddress,
          district: formData.locationDistrict || null,
          village_or_neighborhood: formData.locationVillage || null
        },
        priority: formData.priority
      };

      const response = await casesAPI.create(caseData);
      const caseId = response.data.id || response.data._id;
      
      console.log('[CallCenter] Created case:', { caseId, response: response.data });
      
      if (!caseId) {
        toast.error('Vaka oluşturuldu ancak ID alınamadı');
        return;
      }
      
      setCreatedCaseId(caseId);
      toast.success(`Vaka oluşturuldu: ${response.data.case_number}`);
      
      // Don't navigate yet, show notification button
    } catch (error) {
      console.error('Error creating case:', error);
      toast.error(error.response?.data?.detail || 'Vaka oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!createdCaseId) {
      toast.error('Önce vaka oluşturulmalı');
      return;
    }

    setSendingNotification(true);
    try {
      await casesAPI.sendNotification(createdCaseId, formData.vehicleId || null);
      toast.success('Bildirimler gönderildi!');
      
      // Navigate to case detail
      setTimeout(() => {
        navigate(`/dashboard/cases/${createdCaseId}`);
      }, 1500);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error(error.response?.data?.detail || 'Bildirim gönderilemedi');
    } finally {
      setSendingNotification(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="call-center-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Çağrı Merkezi</h1>
          <p className="text-gray-500">Yeni vaka oluştur</p>
        </div>
        {/* Vaka Numarası Önizleme */}
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <div className="flex items-center space-x-2">
            <Hash className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-xs text-red-600 font-medium">Yeni Vaka No</p>
              <p className="text-lg font-bold text-red-700">{nextCaseNumber || 'Yükleniyor...'}</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Arayan Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Phone className="h-5 w-5 text-red-600" />
              <span>Arayan Kişi Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="callerName">Arayan Kişi Ad Soyad *</Label>
              <Input
                id="callerName"
                value={formData.callerName}
                onChange={(e) => handleChange('callerName', e.target.value)}
                placeholder="Arayan kişinin adı soyadı"
                required
                data-testid="caller-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callerPhone">Telefon * (Sadece Rakam)</Label>
              <Input
                id="callerPhone"
                type="tel"
                inputMode="numeric"
                value={formData.callerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="05XXXXXXXXX"
                required
                data-testid="caller-phone"
                maxLength={11}
              />
              <p className="text-xs text-gray-500">Örn: 05301234567</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callerRelationship">Hastaya Yakınlığı *</Label>
              <Select value={formData.callerRelationship} onValueChange={(value) => handleChange('callerRelationship', value)} required>
                <SelectTrigger data-testid="caller-relationship">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kendisi">Kendisi</SelectItem>
                  <SelectItem value="esi">Eşi</SelectItem>
                  <SelectItem value="annesi">Annesi</SelectItem>
                  <SelectItem value="babasi">Babası</SelectItem>
                  <SelectItem value="cocugu">Çocuğu</SelectItem>
                  <SelectItem value="kardesi">Kardeşi</SelectItem>
                  <SelectItem value="arkadasi">Arkadaşı</SelectItem>
                  <SelectItem value="komsusu">Komşusu</SelectItem>
                  <SelectItem value="is_arkadasi">İş Arkadaşı</SelectItem>
                  <SelectItem value="diger">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Firma Seçimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-red-600" />
              <span>Firma Bilgisi *</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="company">Firma Seçin *</Label>
              <Select value={formData.companyId} onValueChange={handleCompanySelect} required>
                <SelectTrigger data-testid="company-select">
                  <SelectValue placeholder="Firma seçin veya arayın..." />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <div className="px-2 py-2 sticky top-0 bg-white border-b">
                    <Input
                      placeholder="Firma ara..."
                      value={companySearch}
                      onChange={(e) => handleCompanySearch(e.target.value)}
                      className="h-8"
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <div className="px-2 py-4 text-center text-gray-500 text-sm">
                      Firma bulunamadı
                    </div>
                  )}
                </SelectContent>
              </Select>
              {formData.companyName && (
                <p className="text-sm text-green-600 font-medium">
                  Seçilen: {formData.companyName}
                </p>
              )}
            </div>
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
                <Label htmlFor="patientName">Hastanın Adı *</Label>
                <Input
                  id="patientName"
                  value={formData.patientName}
                  onChange={(e) => handleChange('patientName', e.target.value)}
                  placeholder="Hastanın adı"
                  required
                  data-testid="patient-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientSurname">Hastanın Soyadı *</Label>
                <Input
                  id="patientSurname"
                  value={formData.patientSurname}
                  onChange={(e) => handleChange('patientSurname', e.target.value)}
                  placeholder="Hastanın soyadı"
                  required
                  data-testid="patient-surname"
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
                    data-testid="patient-tc"
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
                
                {/* Hasta bilgilerini getir ve yeni hasta oluştur butonları */}
                {tcSearch.length === 11 && !selectedPatientCard && !tcSearching && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 mb-3">
                      {tcSuggestions.length === 0 
                        ? 'Bu TC ile kayıtlı hasta bulunamadı' 
                        : 'Hasta kartından bilgileri yüklemek için butona tıklayın'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleFetchPatientInfo}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Hasta Bilgilerini Getir
                      </Button>
                      {tcSuggestions.length === 0 && (
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
                      )}
                    </div>
                  </div>
                )}
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
            
            <div className="grid gap-4 md:grid-cols-2">
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
                  data-testid="patient-age"
                />
                {selectedPatientCard?.birth_date && (
                  <p className="text-xs text-gray-500">
                    Doğum: {new Date(selectedPatientCard.birth_date).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientGender">Cinsiyet *</Label>
                <Select value={formData.patientGender} onValueChange={(value) => handleChange('patientGender', value)} required>
                  <SelectTrigger data-testid="patient-gender">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erkek">Erkek</SelectItem>
                    <SelectItem value="kadin">Kadın</SelectItem>
                    <SelectItem value="diger">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="patientComplaint">Şikayet / Olay Açıklaması *</Label>
              <Textarea
                id="patientComplaint"
                placeholder="Hastanın şikayetini veya olayı detaylı açıklayın"
                value={formData.patientComplaint}
                onChange={(e) => handleChange('patientComplaint', e.target.value)}
                required
                rows={4}
                data-testid="patient-complaint"
              />
            </div>
          </CardContent>
        </Card>

        {/* Konum Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-red-600" />
              <span>Konum Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="locationAddress">Adres *</Label>
              <Textarea
                id="locationAddress"
                placeholder="Olay yerinin detaylı adresi"
                value={formData.locationAddress}
                onChange={(e) => handleChange('locationAddress', e.target.value)}
                required
                rows={3}
                data-testid="location-address"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="locationDistrict">İlçe</Label>
                <Input
                  id="locationDistrict"
                  value={formData.locationDistrict}
                  onChange={(e) => handleChange('locationDistrict', e.target.value)}
                  placeholder="İlçe adı"
                  data-testid="location-district"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationVillage">Köy / Mahalle</Label>
                <Input
                  id="locationVillage"
                  value={formData.locationVillage}
                  onChange={(e) => handleChange('locationVillage', e.target.value)}
                  placeholder="Köy veya mahalle adı"
                  data-testid="location-village"
                />
              </div>
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
              <SelectTrigger data-testid="priority-select">
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
                    <span>Düşük (Yeşil)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Araç Seçimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-red-600" />
              <span>Araç Seçimi (Opsiyonel)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Araç</Label>
                <Select value={formData.vehicleId} onValueChange={(value) => handleChange('vehicleId', value)}>
                  <SelectTrigger data-testid="vehicle-select">
                    <SelectValue placeholder="Araç seçin (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seçilmedi</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate} - {vehicle.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Araç seçerseniz, bildirim o araçtaki ekibe de gönderilir
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!createdCaseId ? (
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              data-testid="cancel-button"
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
              data-testid="create-case-button"
            >
              {loading ? 'Oluşturuluyor...' : 'Vaka Oluştur'}
            </Button>
          </div>
        ) : (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-800 mb-2">✅ Vaka Başarıyla Oluşturuldu!</h3>
                  <p className="text-sm text-green-700 mb-4">
                    Şimdi ilgili ekiplere bildirim gönderebilirsiniz.
                  </p>
                  <p className="text-xs text-gray-600">
                    Bildirim gönderilecek: Merkez Ofis, Operasyon Müdürü, Doktor, Hemşire
                    {formData.vehicleId && formData.vehicleId !== 'none' && ' + Seçilen Araç Ekibi'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/dashboard/cases/${createdCaseId}`)}
                  >
                    Vakaya Git
                  </Button>
                  <Button
                    onClick={handleSendNotification}
                    disabled={sendingNotification}
                    data-testid="send-notification-button"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    {sendingNotification ? 'Gönderiliyor...' : 'Bildirim Gönder'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
};

export default CallCenter;
