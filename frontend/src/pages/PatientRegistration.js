import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { User, MapPin, AlertCircle, Hash, Building2, UserPlus, Stethoscope } from 'lucide-react';
import { COMPANIES, searchCompanies } from '../constants/companies';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hasta Kayıt Ekranı
 * ATT, Paramedik ve Hemşireler için ayaktan gelen hasta kayıtları
 */
const PatientRegistration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [nextCaseNumber, setNextCaseNumber] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [filteredCompanies, setFilteredCompanies] = useState(COMPANIES);
  
  const [formData, setFormData] = useState({
    // Patient Info
    patientName: '',
    patientSurname: '',
    patientTcNo: '',
    patientAge: '',
    patientGender: '',
    patientPhone: '',
    patientComplaint: '',
    // Company
    companyId: '',
    companyName: '',
    // Location (optional for walk-in)
    locationAddress: '',
    locationNote: '',
    // Priority
    priority: 'dusuk' // Ayaktan gelenlerde varsayılan düşük
  });

  useEffect(() => {
    generateNextCaseNumber();
  }, []);

  const generateNextCaseNumber = async () => {
    try {
      const response = await casesAPI.getNextCaseNumber();
      setNextCaseNumber(response.data.next_case_number);
    } catch (error) {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      setNextCaseNumber(`${dateStr}-10001`);
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
      // Ayaktan gelen hasta için vaka oluştur
      const caseData = {
        caller: {
          name: `${formData.patientName} ${formData.patientSurname}`,
          phone: formData.patientPhone || 'Belirtilmedi',
          relationship: 'kendisi'
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
          address: formData.locationAddress || 'Sağlık Merkezi - Ayaktan Başvuru',
          district: null,
          village_or_neighborhood: formData.locationNote || null
        },
        priority: formData.priority,
        case_details: {
          type: 'ayaktan_basvuru',
          registered_by: user?.name || 'Bilinmeyen',
          registered_role: user?.role || 'att'
        }
      };

      const response = await casesAPI.create(caseData);
      const caseId = response.data.id || response.data._id;
      const caseNumber = response.data.case_number;
      
      console.log('[PatientRegistration] Created case:', { caseId, caseNumber, response: response.data });
      
      if (!caseId) {
        toast.error('Kayıt oluşturuldu ancak ID alınamadı. Vakalar listesinden erişebilirsiniz.');
        navigate('/dashboard/cases');
        return;
      }
      
      toast.success(`Hasta kaydı oluşturuldu: ${caseNumber}`);
      
      // Vaka detayına git
      navigate(`/dashboard/cases/${caseId}`);
      
    } catch (error) {
      console.error('Error creating patient registration:', error);
      toast.error(error.response?.data?.detail || 'Hasta kaydı oluşturulamadı');
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
        {/* Kayıt Numarası Önizleme */}
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

      {/* Bilgilendirme */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Stethoscope className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Ayaktan Başvuru Kaydı</p>
            <p className="text-sm text-blue-700">
              Bu ekran sağlık merkezine ayaktan gelen hastaların kaydı içindir. 
              Acil vakalar için Çağrı Merkezi ekranını kullanın.
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
                <Label htmlFor="patientName">Ad *</Label>
                <Input
                  id="patientName"
                  value={formData.patientName}
                  onChange={(e) => handleChange('patientName', e.target.value)}
                  placeholder="Hastanın adı"
                  required
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientTcNo">TC Kimlik No</Label>
                <Input
                  id="patientTcNo"
                  type="tel"
                  inputMode="numeric"
                  value={formData.patientTcNo}
                  onChange={(e) => handleNumericChange('patientTcNo', e.target.value)}
                  placeholder="TC Kimlik (opsiyonel)"
                  maxLength={11}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientGender">Cinsiyet *</Label>
                <Select value={formData.patientGender} onValueChange={(value) => handleChange('patientGender', value)} required>
                  <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="patientComplaint">Şikayet / Başvuru Nedeni *</Label>
              <Textarea
                id="patientComplaint"
                placeholder="Hastanın şikayetini veya başvuru nedenini açıklayın"
                value={formData.patientComplaint}
                onChange={(e) => handleChange('patientComplaint', e.target.value)}
                required
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ek Bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-red-600" />
              <span>Ek Bilgiler</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="locationAddress">Çalışma Lokasyonu</Label>
                <Input
                  id="locationAddress"
                  value={formData.locationAddress}
                  onChange={(e) => handleChange('locationAddress', e.target.value)}
                  placeholder="Hastanın çalıştığı lokasyon (opsiyonel)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationNote">Not</Label>
                <Input
                  id="locationNote"
                  value={formData.locationNote}
                  onChange={(e) => handleChange('locationNote', e.target.value)}
                  placeholder="Ek not (opsiyonel)"
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

