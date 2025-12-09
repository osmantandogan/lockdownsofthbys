import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Phone, MapPin, User, Truck, Calendar } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

const CallCenterSimple = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ lat: 41.578342, lng: 32.078179 }); // Bartın-Zonguldak çalışma sahası merkezi
  const [formData, setFormData] = useState({
    // Otomatik alanlar
    caseNumber: `${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    callTime: new Date().toTimeString().slice(0, 5),
    
    // Zorunlu alanlar
    callerPhone: '',
    callerName: '',
    address: '',
    addressDescription: '',
    complaint: '',
    vehicleId: '',
    
    // Opsiyonel
    callerRelationship: '',
    patientName: '',
    patientAge: '',
    patientGender: ''
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll();
      // TÜM araçları göster (çağrı merkezi durumu görsün ve karar versin)
      setVehicles(response.data);
    } catch (error) {
      console.error('Araçlar yüklenemedi:', error);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'musait': 'Müsait',
      'gorevde': 'Görevde',
      'bakimda': 'Bakımda',
      'arizali': 'Arızalı',
      'kullanim_disi': 'Kullanım Dışı'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'musait': 'text-green-600',
      'gorevde': 'text-blue-600',
      'bakimda': 'text-yellow-600',
      'arizali': 'text-red-600',
      'kullanim_disi': 'text-gray-600'
    };
    return colors[status] || 'text-gray-600';
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.callerPhone || !formData.address || !formData.addressDescription || !formData.complaint || !formData.vehicleId) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      const caseData = {
        caller: {
          name: formData.callerName || 'Bilinmiyor',
          phone: formData.callerPhone,
          relationship: formData.callerRelationship || 'Bilinmiyor'
        },
        patient: {
          name: formData.patientName || formData.callerName || 'Hasta',
          surname: '',
          age: parseInt(formData.patientAge) || 0,
          gender: formData.patientGender || 'diger',
          complaint: formData.complaint
        },
        location: {
          address: formData.address,
          address_description: formData.addressDescription,
          coordinates: position
        },
        priority: 'orta',
        case_details: {
          caseNumber: formData.caseNumber,
          callTime: formData.callTime,
          vehicleId: formData.vehicleId
        }
      };

      const response = await casesAPI.create(caseData);
      
      // Backend'den dönen vaka ID'sini al
      const caseId = response.data.id || response.data._id;
      console.log('Created case:', response.data);
      console.log('Case ID:', caseId);
      
      if (caseId) {
        // Ekip ata
        await casesAPI.assignTeam(caseId, {
          vehicle_id: formData.vehicleId
        });
        
        toast.success(`Vaka başarıyla oluşturuldu: ${formData.caseNumber}`);
        navigate('/dashboard/cases');
      } else {
        toast.error('Vaka oluşturuldu ama ID alınamadı');
      }
    } catch (error) {
      console.error('Vaka oluşturma hatası:', error);
      toast.error(error.response?.data?.detail || 'Vaka oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Yeni Vaka Kaydı</h1>
          <p className="text-gray-500">Hızlı vaka oluşturma formu</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard/cases')}>
          İptal
        </Button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <p className="text-sm text-blue-900">
          <strong>Aşama 1:</strong> Temel vaka bilgilerini girin. Detaylı muayene bilgileri sahada ekip tarafından girilecektir.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sol Taraf - Form */}
        <div className="space-y-6">
          {/* Otomatik Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Vaka Bilgileri (Otomatik)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vaka No</Label>
                  <Input value={formData.caseNumber} disabled className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Tarih</Label>
                  <Input type="date" value={formData.date} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Çağrı Saati</Label>
                  <Input type="time" value={formData.callTime} disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Arayan Bilgileri */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Phone className="h-5 w-5" />
                <span>Arayan Bilgileri</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Telefon Numarası *</Label>
                <Input
                  value={formData.callerPhone}
                  onChange={(e) => setFormData({...formData, callerPhone: e.target.value})}
                  placeholder="5XX XXX XX XX"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Ad Soyad</Label>
                <Input
                  value={formData.callerName}
                  onChange={(e) => setFormData({...formData, callerName: e.target.value})}
                  placeholder="Arayan kişinin adı"
                />
              </div>
            </CardContent>
          </Card>

          {/* Lokasyon */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Lokasyon Bilgileri</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Olay Yeri Adresi *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Cadde, sokak, bina no..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Adres Tarifi *</Label>
                <Textarea
                  value={formData.addressDescription}
                  onChange={(e) => setFormData({...formData, addressDescription: e.target.value})}
                  placeholder="Detaylı adres tarifi, yer tanımları..."
                  rows={3}
                  required
                />
              </div>
              <p className="text-xs text-blue-600">
                💡 Sağdaki haritadan konumu işaretleyin
              </p>
            </CardContent>
          </Card>

          {/* Şikayet ve Araç */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Vaka Detayları</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Şikayet *</Label>
                <Textarea
                  value={formData.complaint}
                  onChange={(e) => setFormData({...formData, complaint: e.target.value})}
                  placeholder="Hastanın şikayetleri..."
                  rows={3}
                  required
                />
              </div>
                <div className="space-y-2">
                  <Label>Araç Seç * (Sadece 1 araç seçin)</Label>
                  <div className="space-y-2 border rounded-lg p-4 max-h-64 overflow-y-auto bg-white">
                    {vehicles.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">Araç bulunmuyor</p>
                    ) : (
                      vehicles.map((vehicle) => (
                        <label
                          key={vehicle.id}
                          className={`flex items-center justify-between p-3 border-2 rounded-lg transition-all cursor-pointer ${
                            formData.vehicleId === vehicle.id 
                              ? 'border-blue-500 bg-blue-50' 
                              : vehicle.status !== 'musait'
                              ? 'bg-gray-100 opacity-50 cursor-not-allowed border-gray-200' 
                              : 'hover:border-blue-300 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="vehicle"
                              value={vehicle.id}
                              checked={formData.vehicleId === vehicle.id}
                              onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                              disabled={vehicle.status !== 'musait'}
                              className="w-5 h-5 text-blue-600"
                            />
                            <Truck className="h-4 w-4" />
                            <span className="font-medium">{vehicle.plate}</span>
                            <span className="text-xs text-gray-500">({vehicle.type})</span>
                          </div>
                          <Badge 
                            className={vehicle.status === 'musait' ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}
                          >
                            {getStatusLabel(vehicle.status)}
                          </Badge>
                        </label>
                      ))
                    )}
                  </div>
                </div>
            </CardContent>
          </Card>

          {/* Aksiyon Butonları */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/cases')}>
              İptal
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Oluşturuluyor...' : 'Vaka Oluştur'}
            </Button>
          </div>
        </div>

        {/* Sağ Taraf - Harita */}
        <div className="space-y-6">
          <Card className="h-[800px]">
            <CardHeader>
              <CardTitle>Olay Yeri Haritası</CardTitle>
              <p className="text-sm text-gray-500">Haritaya tıklayarak konumu işaretleyin</p>
            </CardHeader>
            <CardContent className="h-[700px]">
              <MapContainer 
                center={[41.578342, 32.078179]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                className="rounded-lg"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
                <TileLayer
                  attribution=''
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                />
                <LocationPicker position={position} setPosition={setPosition} />
              </MapContainer>
              
              {position && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-900">
                    ✓ Seçili Konum: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CallCenterSimple;

