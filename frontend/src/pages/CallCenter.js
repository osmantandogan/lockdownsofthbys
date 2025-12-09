import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Phone, User, MapPin, AlertCircle, Truck, Bell, FileText, Building2, Hash } from 'lucide-react';
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
              <div className="space-y-2">
                <Label htmlFor="patientTcNo">TC Kimlik No</Label>
                <Input
                  id="patientTcNo"
                  type="tel"
                  inputMode="numeric"
                  value={formData.patientTcNo}
                  onChange={(e) => handleChange('patientTcNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                  placeholder="Opsiyonel"
                  maxLength={11}
                  data-testid="patient-tc"
                />
              </div>
            </div>
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
