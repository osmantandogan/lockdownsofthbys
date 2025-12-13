import React, { useState, useEffect, useRef } from 'react';
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
import { Phone, MapPin, User, Truck, Building2, Check, RefreshCw, Clock } from 'lucide-react';
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
  const [position, setPosition] = useState({ lat: 41.578342, lng: 32.078179 });
  const [isOutsideProject, setIsOutsideProject] = useState(false);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companyInputRef = useRef(null);

  const [formData, setFormData] = useState({
    // Arayan kişi bilgileri
    callerName: '',
    callerPhone: '',
    companyName: '',
    
    // Hasta bilgisi
    patientFirstName: '',
    patientLastName: '',
    patientGender: 'erkek',
    complaint: '',
    
    // Konum - Proje içi
    addressDescription: '',
    
    // Konum - Proje dışı
    province: '',
    district: '',
    neighborhood: '',
    streetAddress: ''
  });

  useEffect(() => {
    loadVehicles();
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

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll({});
      const ambulances = (response.data || []).filter(v => v.type === 'ambulans');
      setVehicles(ambulances);
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

    // Validation
    if (!formData.callerName && !formData.patientFirstName) {
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

    // Adres kontrolü
    if (!isOutsideProject && !formData.addressDescription) {
      toast.error('Adres/tarif girilmelidir');
      return;
    }

    if (isOutsideProject && !formData.province) {
      toast.error('Proje dışı için il seçimi zorunludur');
      return;
    }

    setLoading(true);
    
    // Çağrı saatini kaydet
    const callTime = new Date().toISOString();
    
    try {
      // Tam adres oluştur
      let fullAddress = '';
      if (isOutsideProject) {
        const parts = [formData.streetAddress, formData.neighborhood, formData.district, formData.province].filter(Boolean);
        fullAddress = parts.join(', ');
      } else {
        fullAddress = formData.addressDescription;
      }

      const caseData = {
        caller: {
          name: formData.callerName || `${formData.patientFirstName} ${formData.patientLastName}`.trim() || 'Bilinmiyor',
          phone: formData.callerPhone || '',
          relationship: 'Bilinmiyor'
        },
        patient: {
          name: formData.patientFirstName || formData.callerName || 'Hasta',
          surname: formData.patientLastName || '',
          age: 0,
          gender: formData.patientGender,
          complaint: formData.complaint
        },
        location: {
          address: fullAddress,
          address_description: isOutsideProject ? formData.streetAddress : formData.addressDescription,
          coordinates: position,
          province: isOutsideProject ? formData.province : 'Zonguldak',
          district: isOutsideProject ? formData.district : 'Filyos',
          neighborhood: isOutsideProject ? formData.neighborhood : ''
        },
        priority: 'orta',
        case_details: {
          company: formData.companyName,
          is_outside_project: isOutsideProject
        },
        timestamps: {
          call_received: callTime
        }
      };

      const response = await casesAPI.create(caseData);
      const caseId = response.data.id || response.data._id;
      
      if (caseId) {
        // Seçili araçlar varsa otomatik olarak ata
        if (selectedVehicleIds.length > 0) {
          try {
            await casesAPI.assignMultipleTeams(caseId, selectedVehicleIds);
            toast.success(`Vaka oluşturuldu ve ${selectedVehicleIds.length} araç görevlendirildi!`);
          } catch (assignError) {
            console.error('Araç atama hatası:', assignError);
            toast.warning('Vaka oluşturuldu ama araç ataması başarısız');
          }
        } else {
          toast.success('Vaka oluşturuldu!');
        }
        
        // Direkt vakaya yönlendir
        setTimeout(() => navigate(`/dashboard/cases/${caseId}`), 500);
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

  // İlçeler
  const availableDistricts = formData.province ? (DISTRICTS_BY_PROVINCE[formData.province] || []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Çağrı Merkezi</h1>
          <p className="text-gray-500 text-sm">Yeni vaka oluştur</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-100 text-gray-700 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadVehicles}>
            <RefreshCw className="h-4 w-4 mr-1" /> Yenile
          </Button>
        </div>
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
                    <Label className="text-xs">Arayan Adı</Label>
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
                  </div>
                </div>
                
                {/* Firma - Düzeltilmiş dropdown */}
                <div className="relative" ref={companyInputRef}>
                  <Label className="text-xs text-gray-500">Firma (opsiyonel)</Label>
                  <Input 
                    placeholder="Firma ara..."
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      handleChange('companyName', e.target.value);
                      setShowCompanyDropdown(true);
                    }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    className="h-8 text-sm"
                  />
                  {showCompanyDropdown && filteredCompanies.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                      {filteredCompanies.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                          onClick={() => {
                            handleChange('companyName', c.name);
                            setCompanySearch(c.name);
                            setShowCompanyDropdown(false);
                          }}
                        >
                          <Building2 className="h-3 w-3 inline mr-2 text-gray-400" />
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Hasta Bilgisi */}
            <Card>
              <CardHeader className="py-3 bg-amber-50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Hasta Bilgisi
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Hasta Adı</Label>
                    <Input 
                      placeholder="Adı"
                      value={formData.patientFirstName}
                      onChange={(e) => handleChange('patientFirstName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Hasta Soyadı</Label>
                    <Input 
                      placeholder="Soyadı"
                      value={formData.patientLastName}
                      onChange={(e) => handleChange('patientLastName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cinsiyet</Label>
                    <select
                      value={formData.patientGender}
                      onChange={(e) => handleChange('patientGender', e.target.value)}
                      className="w-full h-10 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="erkek">Erkek</option>
                      <option value="kadin">Kadın</option>
                      <option value="diger">Diğer</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Şikayet / Olay Açıklaması *</Label>
                  <Textarea 
                    placeholder="Olay detayı..."
                    value={formData.complaint}
                    onChange={(e) => handleChange('complaint', e.target.value)}
                    rows={2}
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
                {!isOutsideProject ? (
                  /* Proje İçi - Sadece adres tarifi */
                  <div>
                    <Label className="text-xs">Adres / Tarif *</Label>
                    <Textarea 
                      placeholder="Proje içi adres veya tarif..."
                      value={formData.addressDescription}
                      onChange={(e) => handleChange('addressDescription', e.target.value)}
                      rows={2}
                    />
                    <p className="text-xs text-gray-500 mt-1">Filyos / Zonguldak - Proje alanı içi</p>
                  </div>
                ) : (
                  /* Proje Dışı - İl/İlçe/Mahalle seçimi */
                  <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-xs text-orange-700 font-medium">Proje Dışı Konum</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">İl *</Label>
                        <select
                          value={formData.province}
                          onChange={(e) => {
                            handleChange('province', e.target.value);
                            handleChange('district', '');
                          }}
                          className="w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">İl Seçin</option>
                          {TURKEY_PROVINCES.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">İlçe</Label>
                        <select
                          value={formData.district}
                          onChange={(e) => handleChange('district', e.target.value)}
                          className="w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={!formData.province}
                        >
                          <option value="">İlçe Seçin</option>
                          {availableDistricts.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Mahalle</Label>
                      <Input 
                        placeholder="Mahalle adı"
                        value={formData.neighborhood}
                        onChange={(e) => handleChange('neighborhood', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Sokak / Apartman / Detay</Label>
                      <Textarea 
                        placeholder="Sokak, apartman, daire no vb. detaylar..."
                        value={formData.streetAddress}
                        onChange={(e) => handleChange('streetAddress', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500">
                  📍 Haritadan seçilen: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto">
                  {vehicles.map((vehicle) => {
                    const isSelected = selectedVehicleIds.includes(vehicle.id);
                    const locationName = vehicle.healmedy_location_name || vehicle.current_location;
                    
                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => toggleVehicle(vehicle.id)}
                        className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{vehicle.plate}</span>
                          {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                        {locationName && (
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <MapPin className="h-3 w-3" />
                            {locationName}
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
            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg"
              disabled={loading}
            >
              {loading ? 'Oluşturuluyor...' : '🚨 Vaka Oluştur ve Bildir'}
            </Button>
          </form>
        </div>

        {/* SAĞ: Harita - Küçültüldü ve zoom 14 */}
        <Card className="h-[400px]">
          <CardHeader className="py-3 bg-blue-50">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Konum Seçimi (Haritaya tıklayın)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-52px)]">
            <MapContainer
              center={[position.lat, position.lng]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
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
