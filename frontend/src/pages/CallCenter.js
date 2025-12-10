import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Phone, MapPin, User, Truck, Bell, Building2, Check, RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { COMPANIES } from '../constants/companies';

// Fix leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationPicker = ({ position, setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      toast.success('Konum seçildi');
    },
  });

  return position ? <Marker position={[position.lat, position.lng]}><Popup>Seçilen Konum</Popup></Marker> : null;
};

const CallCenter = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [createdCaseId, setCreatedCaseId] = useState(null);
  const [position, setPosition] = useState({ lat: 41.578342, lng: 32.078179 });
  const [isOutsideProject, setIsOutsideProject] = useState(false);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  const [companySearch, setCompanySearch] = useState('');

  const [formData, setFormData] = useState({
    // Arayan kişi bilgileri
    callerName: '',
    callerPhone: '',
    companyName: '',
    
    // Hasta / Olay bilgisi
    patientName: '',
    complaint: '',
    
    // Konum
    address: '',
    addressDescription: '',
    district: '',
    village: '',
    neighborhood: ''
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll({});
      setVehicles(response.data || []);
    } catch (error) {
      console.error('Araçlar yüklenemedi:', error);
      toast.error('Araçlar yüklenemedi');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleVehicle = (vehicleId) => {
    setSelectedVehicleIds(prev => {
      if (prev.includes(vehicleId)) {
        return prev.filter(id => id !== vehicleId);
      } else {
        return [...prev, vehicleId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation - ya arayan adı ya da hasta adı dolu olmalı
    if (!formData.callerName && !formData.patientName) {
      toast.error('Arayan kişi adı veya hasta adı girilmelidir');
      return;
    }

    if (!formData.complaint) {
      toast.error('Şikayet/olay açıklaması girilmelidir');
      return;
    }

    if (!formData.callerPhone) {
      toast.error('Telefon numarası zorunludur');
      return;
    }

    if (!formData.address && !formData.addressDescription) {
      toast.error('Konum bilgisi girilmelidir');
      return;
    }

    setLoading(true);
    try {
      const caseData = {
        caller: {
          name: formData.callerName || formData.patientName || 'Bilinmiyor',
          phone: formData.callerPhone || '',
          relationship: 'Bilinmiyor'
        },
        patient: {
          name: formData.patientName || formData.callerName || 'Hasta',
          surname: '',
          age: 0,
          gender: 'diger',
          complaint: formData.complaint
        },
        location: {
          address: formData.address || formData.addressDescription,
          address_description: formData.addressDescription,
          coordinates: position,
          district: isOutsideProject ? formData.district : '',
          village: isOutsideProject ? formData.village : '',
          neighborhood: isOutsideProject ? formData.neighborhood : ''
        },
        priority: 'orta',
        case_details: {
          company: formData.companyName,
          is_outside_project: isOutsideProject
        }
      };

      const response = await casesAPI.create(caseData);
      const caseId = response.data.id || response.data._id;
      
      if (caseId) {
        setCreatedCaseId(caseId);
        toast.success('Vaka oluşturuldu!');
      } else {
        toast.error('Vaka ID alınamadı');
      }
    } catch (error) {
      console.error('Vaka oluşturma hatası:', error);
      toast.error(error.response?.data?.detail || 'Vaka oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!createdCaseId) return;

    setSendingNotification(true);
    try {
      // Araçları ata
      if (selectedVehicleIds.length > 0) {
        await casesAPI.assignMultipleTeams(createdCaseId, selectedVehicleIds);
        toast.success(`${selectedVehicleIds.length} araç görevlendirildi`);
      }
      
      // Bildirim gönder
      await casesAPI.sendNotification(createdCaseId, selectedVehicleIds[0] || null);
      toast.success('Bildirimler gönderildi!');
      
      setTimeout(() => navigate(`/dashboard/cases/${createdCaseId}`), 1000);
    } catch (error) {
      console.error('Hata:', error);
      toast.error('İşlem sırasında hata oluştu');
    } finally {
      setSendingNotification(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      musait: { bg: 'bg-green-100', text: 'text-green-700', label: 'Müsait' },
      gorevde: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Görevde' },
      bakimda: { bg: 'bg-red-100', text: 'text-red-700', label: 'Bakımda' }
    };
    const c = config[status] || config.bakimda;
    return <Badge className={`${c.bg} ${c.text} border-0`}>{c.label}</Badge>;
  };

  // Firma arama
  const filteredCompanies = companySearch 
    ? COMPANIES.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Çağrı Merkezi</h1>
          <p className="text-gray-500 text-sm">Yeni vaka oluştur</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadVehicles}>
          <RefreshCw className="h-4 w-4 mr-1" /> Yenile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SOL: Form */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Arayan Kişi Bilgileri + Firma */}
            <Card>
              <CardHeader className="py-3 bg-emerald-50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Arayan Kişi
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Arayan Adı *</Label>
                    <Input 
                      placeholder="Arayan kişinin adı"
                      value={formData.callerName}
                      onChange={(e) => handleChange('callerName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Telefon *</Label>
                    <Input 
                      placeholder="05XX XXX XXXX"
                      value={formData.callerPhone}
                      onChange={(e) => handleChange('callerPhone', e.target.value)}
                      required
                      className={!formData.callerPhone ? 'border-red-300' : ''}
                    />
                    {!formData.callerPhone && (
                      <p className="text-xs text-red-500 mt-1">Telefon zorunludur</p>
                    )}
                  </div>
                </div>
                
                {/* Firma - küçük ve opsiyonel */}
                <div className="relative">
                  <Label className="text-xs text-gray-500">Firma (opsiyonel)</Label>
                  <Input 
                    placeholder="Firma ara..."
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      handleChange('companyName', e.target.value);
                    }}
                    className="h-8 text-sm"
                  />
                  {filteredCompanies.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg">
                      {filteredCompanies.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                          onClick={() => {
                            handleChange('companyName', c.name);
                            setCompanySearch(c.name);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Olay/Şikayet */}
            <Card>
              <CardHeader className="py-3 bg-amber-50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Olay Bilgisi
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-xs">Hasta Adı (opsiyonel - arayan adı dolduysa)</Label>
                  <Input 
                    placeholder="Hasta adı"
                    value={formData.patientName}
                    onChange={(e) => handleChange('patientName', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Şikayet / Olay Açıklaması *</Label>
                  <Textarea 
                    placeholder="Olay detayı..."
                    value={formData.complaint}
                    onChange={(e) => handleChange('complaint', e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Konum */}
            <Card>
              <CardHeader className="py-3 bg-purple-50">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Konum Bilgisi
                  </span>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-normal">Proje Dışı?</Label>
                    <Switch 
                      checked={isOutsideProject} 
                      onCheckedChange={setIsOutsideProject}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-xs">Adres / Tarif *</Label>
                  <Textarea 
                    placeholder="Adres veya tarif..."
                    value={formData.addressDescription}
                    onChange={(e) => handleChange('addressDescription', e.target.value)}
                    rows={2}
                  />
                </div>
                
                {isOutsideProject && (
                  <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-xs">İlçe</Label>
                      <Input 
                        placeholder="İlçe"
                        value={formData.district}
                        onChange={(e) => handleChange('district', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Köy/Mahalle</Label>
                      <Input 
                        placeholder="Köy/Mahalle"
                        value={formData.village}
                        onChange={(e) => handleChange('village', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mahalle/Sokak</Label>
                      <Input 
                        placeholder="Detay"
                        value={formData.neighborhood}
                        onChange={(e) => handleChange('neighborhood', e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500">
                  Koordinat: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </p>
              </CardContent>
            </Card>

            {/* Araç Seçimi */}
            <Card>
              <CardHeader className="py-3 bg-red-50">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Araç Seçimi
                  </span>
                  {selectedVehicleIds.length > 0 && (
                    <Badge className="bg-blue-100 text-blue-700">{selectedVehicleIds.length} seçili</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                  {vehicles.map((vehicle) => {
                    const isSelected = selectedVehicleIds.includes(vehicle.id);
                    const locationName = vehicle.healmedy_location_name || vehicle.current_location;
                    
                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => toggleVehicle(vehicle.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{vehicle.plate}</span>
                          {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                        <div className="text-xs text-gray-500">
                          {vehicle.type === 'ambulans' ? 'Ambulans' : 'Araç'}
                        </div>
                        {locationName && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                            <MapPin className="h-3 w-3" />
                            {locationName}'da
                          </div>
                        )}
                        <div className="mt-1">
                          {getStatusBadge(vehicle.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedVehicleIds.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 rounded flex flex-wrap gap-1">
                    {selectedVehicleIds.map(id => {
                      const v = vehicles.find(v => v.id === id);
                      const loc = v?.healmedy_location_name || v?.current_location;
                      return v ? (
                        <Badge key={id} className="bg-blue-100 text-blue-800">
                          {v.plate} {loc && `• ${loc}`}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit */}
            {!createdCaseId ? (
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Oluşturuluyor...' : 'Vaka Oluştur'}
              </Button>
            ) : (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="py-4">
                  <p className="text-green-800 font-medium mb-3">✅ Vaka oluşturuldu!</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/dashboard/cases/${createdCaseId}`)}
                    >
                      Vakaya Git
                    </Button>
                    <Button 
                      onClick={handleSendNotification}
                      disabled={sendingNotification}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Bell className="h-4 w-4 mr-1" />
                      {sendingNotification ? 'Gönderiliyor...' : 'Bildirim Gönder'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </form>
        </div>

        {/* SAĞ: Harita */}
        <Card className="h-[600px]">
          <CardHeader className="py-3 bg-blue-50">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Konum Seçimi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-52px)]">
            <MapContainer
              center={[position.lat, position.lng]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution='&copy; Google Maps'
                maxZoom={20}
              />
              <LocationPicker position={position} setPosition={setPosition} />
            </MapContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CallCenter;
