import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Phone, User, MapPin, AlertCircle } from 'lucide-react';

const CallCenter = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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
    // Location
    locationAddress: '',
    locationDistrict: '',
    locationVillage: '',
    // Priority
    priority: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        location: {
          address: formData.locationAddress,
          district: formData.locationDistrict || null,
          village_or_neighborhood: formData.locationVillage || null
        },
        priority: formData.priority
      };

      const response = await casesAPI.create(caseData);
      toast.success(`Vaka oluşturuldu: ${response.data.case_number}`);
      navigate(`/dashboard/cases/${response.data.id}`);
    } catch (error) {
      console.error('Error creating case:', error);
      toast.error(error.response?.data?.detail || 'Vaka oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="call-center-page">
      <div>
        <h1 className="text-3xl font-bold">Çağrı Merkezi</h1>
        <p className="text-gray-500">Yeni vaka oluştur</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Arayan Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Phone className="h-5 w-5" />
              <span>Arayan Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="callerName">Ad Soyad *</Label>
              <Input
                id="callerName"
                value={formData.callerName}
                onChange={(e) => handleChange('callerName', e.target.value)}
                required
                data-testid="caller-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callerPhone">Telefon *</Label>
              <Input
                id="callerPhone"
                value={formData.callerPhone}
                onChange={(e) => handleChange('callerPhone', e.target.value)}
                required
                data-testid="caller-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callerRelationship">Yakınlık *</Label>
              <Input
                id="callerRelationship"
                placeholder="Örn: Eşi, Arkadaşı, Komşusu"
                value={formData.callerRelationship}
                onChange={(e) => handleChange('callerRelationship', e.target.value)}
                required
                data-testid="caller-relationship"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hasta Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
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
                  required
                  data-testid="patient-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientSurname">Soyad *</Label>
                <Input
                  id="patientSurname"
                  value={formData.patientSurname}
                  onChange={(e) => handleChange('patientSurname', e.target.value)}
                  required
                  data-testid="patient-surname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientTcNo">TC Kimlik No</Label>
                <Input
                  id="patientTcNo"
                  value={formData.patientTcNo}
                  onChange={(e) => handleChange('patientTcNo', e.target.value)}
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
                  value={formData.patientAge}
                  onChange={(e) => handleChange('patientAge', e.target.value)}
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
              <Label htmlFor="patientComplaint">Şikayet *</Label>
              <Textarea
                id="patientComplaint"
                placeholder="Hastanın şikayetini detaylı açıklayın"
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
              <MapPin className="h-5 w-5" />
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
                  data-testid="location-district"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationVillage">Köy / Mahalle</Label>
                <Input
                  id="locationVillage"
                  value={formData.locationVillage}
                  onChange={(e) => handleChange('locationVillage', e.target.value)}
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
              <AlertCircle className="h-5 w-5" />
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
                    <span>Yüksek (Kırmızı)</span>
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
            data-testid="create-case-button"
          >
            {loading ? 'Oluşturuluyor...' : 'Vaka Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CallCenter;
