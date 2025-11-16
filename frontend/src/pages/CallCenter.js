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
      toast.success(`Vaka olu\u015fturuldu: ${response.data.case_number}`);
      navigate(`/dashboard/cases/${response.data.id}`);
    } catch (error) {
      console.error('Error creating case:', error);
      toast.error(error.response?.data?.detail || 'Vaka olu\u015fturulamad\u0131');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="call-center-page">
      <div>
        <h1 className="text-3xl font-bold">\u00c7a\u011fr\u0131 Merkezi</h1>
        <p className="text-gray-500">Yeni vaka olu\u015ftur</p>
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
              <Label htmlFor="callerRelationship">Yak\u0131nl\u0131k *</Label>
              <Input
                id="callerRelationship"
                placeholder="\u00d6rn: E\u015fi, Arkada\u015f\u0131, Kom\u015fusu"
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
                <Label htmlFor="patientAge">Ya\u015f *</Label>
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
                    <SelectValue placeholder="Se\u00e7in" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erkek">Erkek</SelectItem>
                    <SelectItem value="kadin">Kad\u0131n</SelectItem>
                    <SelectItem value="diger">Di\u011fer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="patientComplaint">\u015eikayet *</Label>
              <Textarea
                id="patientComplaint"
                placeholder="Hastan\u0131n \u015fikayetini detayl\u0131 a\u00e7\u0131klay\u0131n"
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
                placeholder="Olay yerinin detayl\u0131 adresi"
                value={formData.locationAddress}
                onChange={(e) => handleChange('locationAddress', e.target.value)}
                required
                rows={3}
                data-testid="location-address"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="locationDistrict">\u0130l\u00e7e</Label>
                <Input
                  id="locationDistrict"
                  value={formData.locationDistrict}
                  onChange={(e) => handleChange('locationDistrict', e.target.value)}
                  data-testid="location-district"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationVillage">K\u00f6y / Mahalle</Label>
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

        {/* \u00d6ncelik */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>\u00d6ncelik Seviyesi</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)} required>
              <SelectTrigger data-testid="priority-select">
                <SelectValue placeholder="\u00d6ncelik se\u00e7in" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yuksek">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Y\u00fcksek (K\u0131rm\u0131z\u0131)</span>
                  </div>
                </SelectItem>
                <SelectItem value="orta">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Orta (Sar\u0131)</span>
                  </div>
                </SelectItem>
                <SelectItem value="dusuk">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>D\u00fc\u015f\u00fck (Ye\u015fil)</span>
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
            \u0130ptal
          </Button>
          <Button
            type="submit"
            disabled={loading}
            data-testid="create-case-button"
          >
            {loading ? 'Olu\u015fturuluyor...' : 'Vaka Olu\u015ftur'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CallCenter;
