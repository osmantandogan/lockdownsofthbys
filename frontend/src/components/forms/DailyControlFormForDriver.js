import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Progress } from '../ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { toast } from 'sonner';
import { ChevronDown, CheckCircle, Fuel, MapPin, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { locationsAPI } from '../../api';

/**
 * Şoför için Araç Günlük Kontrol ve Devir Alma Formu
 * Vardiya başlatırken doldurulur
 */
const DailyControlFormForDriver = ({ formData: externalFormData, onChange, vehiclePlate }) => {
  const { user } = useAuth();
  const [localFormData, setLocalFormData] = useState({
    istasyonAdi: '',
    plaka: vehiclePlate || '',
    km: '',
    tarih: new Date().toISOString().split('T')[0],
    aciklama: '',
    teslimAlan: user?.name || ''
  });

  const [checks, setChecks] = useState({});
  
  // Lokasyon autocomplete için state'ler
  const [locations, setLocations] = useState([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState([]);

  const formData = externalFormData || localFormData;
  const setFormData = onChange || setLocalFormData;
  
  // Lokasyonları yükle
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await locationsAPI.getField({ status: 'active' });
        setLocations(response.data || []);
      } catch (error) {
        console.error('Lokasyonlar yüklenemedi:', error);
      }
    };
    fetchLocations();
  }, []);
  
  // Lokasyon arama filtreleme
  useEffect(() => {
    if (locationSearch.trim()) {
      const filtered = locations.filter(loc => 
        loc.name?.toLowerCase().includes(locationSearch.toLowerCase()) ||
        loc.address?.toLowerCase().includes(locationSearch.toLowerCase())
      );
      setFilteredLocations(filtered);
    } else {
      setFilteredLocations(locations);
    }
  }, [locationSearch, locations]);

  // Araç plakasını otomatik doldur
  useEffect(() => {
    if (vehiclePlate && !formData.plaka) {
      if (onChange) {
        onChange({ ...formData, plaka: vehiclePlate });
      } else {
        setLocalFormData(prev => ({ ...prev, plaka: vehiclePlate }));
      }
    }
  }, [vehiclePlate]);

  const handleCheck = (item, value) => {
    const newChecks = { ...checks, [item]: value };
    setChecks(newChecks);
    
    // Parent'a tüm form verisini gönder
    if (onChange) {
      onChange({ ...formData, checks: newChecks });
    }
  };

  const handleInputChange = (field, value) => {
    if (onChange) {
      onChange({ ...formData, [field]: value });
    } else {
      setLocalFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Şoför için kontrol kategorileri
  const categories = [
    {
      id: 1,
      title: 'ARACIN GENEL DURUMU',
      items: [
        { label: 'Aracın Ruhsatı Var mı?', options: ['Var', 'Yok'] },
        { label: 'Aracın Dış Görünüşü', options: ['Temiz', 'Kirli'] },
        { label: 'Kaporta', options: ['Sağlam', 'Hasarlı'] },
        { label: 'Kapılar', options: ['Sağlam', 'Hasarlı'] },
        { label: 'Lastikler', options: ['Sağlam', 'Diş Der.', 'Havası Az', 'Havası Fazla'] }
      ]
    },
    {
      id: 2,
      title: 'ARACIN YAKIT DURUMU',
      items: [
        { label: 'Yakıt Matik', options: ['Var', 'Yok'] }
      ],
      hasFuelGauge: true
    },
    {
      id: 3,
      title: 'ARACIN ALTININ KONTROLÜ',
      items: [
        { label: 'Yağ Damlaması Var mı?', options: ['Var', 'Yok'] },
        { label: 'Hidrolik Kaçağı Var mı?', options: ['Var', 'Yok'] },
        { label: 'Darbe Var mı?', options: ['Var', 'Yok'] },
        { label: 'Su Kaçağı Var mı?', options: ['Var', 'Yok'] },
        { label: 'Yakıt Kaçağı Var mı?', options: ['Var', 'Yok'] }
      ]
    },
    {
      id: 4,
      title: 'ARACIN MOTOR KONTROLÜ',
      items: [
        { label: 'Motor Kaputu Açma Sistemi', options: ['Normal', 'Arızalı'] },
        { label: 'Silecek Suyu Sıvı Seviyesi', options: ['Normal', 'Düşük'] },
        { label: 'Motor Yağ Seviyesi', options: ['Normal', 'Düşük'] },
        { label: 'Motor Temizliği', options: ['Normal', 'Kirli'] },
        { label: 'Yanan Arıza Lambası', options: ['Yok', 'Var'] },
        { label: 'Silecek Lastiği', options: ['Normal', 'Yıpranmış'] },
        { label: 'Radyatör Sıvı Seviyesi', options: ['Normal', 'Düşük'] },
        { label: 'Fren Hidrolik Yağ Seviyesi', options: ['Normal', 'Düşük'] },
        { label: 'Stepne', options: ['Var', 'Yok'] },
        { label: 'Klima', options: ['Normal', 'Arızalı'] }
      ]
    },
    {
      id: 5,
      title: 'ARACI ÇALIŞTIR VE KONTROL ET',
      items: [
        { label: 'GPS', options: ['Sağlam', 'Arızalı'] },
        { label: 'Araç Telsizi', options: ['Sağlam', 'Arızalı'] },
        { label: 'Mayk', options: ['Sağlam', 'Arızalı'] },
        { label: 'Sirenler', options: ['Sağlam', 'Arızalı'] },
        { label: 'Farlar / Sinyal Lambaları', options: ['Sağlam', 'Arızalı'] },
        { label: 'Geri Vites Lambası', options: ['Sağlam', 'Arızalı'] },
        { label: 'Tepe Lambaları', options: ['Sağlam', 'Arızalı'] },
        { label: 'Fren Sistemi', options: ['Sağlam', 'Arızalı'] },
        { label: 'Flaşörler', options: ['Sağlam', 'Arızalı'] },
        { label: 'Arka Kapı Aydınlatması', options: ['Sağlam', 'Arızalı'] },
        { label: 'Fren Lambaları', options: ['Sağlam', 'Arızalı'] },
        { label: 'Vites Sistemi', options: ['Sağlam', 'Arızalı'] },
        { label: 'Ön/Arka Emniyet Kemeri', options: ['Sağlam', 'Arızalı'] },
        { label: 'Motor Çalışması', options: ['Sağlam', 'Arızalı'] },
        { label: 'Direksiyon Sistemi', options: ['Sağlam', 'Arızalı'] },
        { label: 'Gösterge Paneli', options: ['Sağlam', 'Arızalı'] },
        { label: 'Aynalar', options: ['Sağlam', 'Kırık'] },
        { label: 'Egzoz', options: ['Sağlam', 'Arızalı'] },
        { label: 'Merkezi Sistem Kilitleme', options: ['Var', 'Yok'] },
        { label: 'Radyo-Teyp', options: ['Sağlam', 'Arızalı'] }
      ]
    },
    {
      id: 6,
      title: 'ARKA KABİN İÇİ',
      items: [
        { label: 'Temizlik', options: ['Temiz', 'Kirli'] },
        { label: 'Çöp Kutusu', options: ['Boş', 'Dolu'] },
        { label: 'Aydınlatma', options: ['Sağlam', 'Arızalı'] },
        { label: 'Redresör', options: ['Sağlam', 'Arızalı'] }
      ]
    },
    {
      id: 7,
      title: 'AVADANLIK',
      items: [
        { label: 'Kriko', options: ['Var', 'Yok'] },
        { label: 'Bijon Anahtarı', options: ['Var', 'Yok'] },
        { label: 'Patinaj Zinciri', options: ['Var', 'Yok'] },
        { label: 'Yangın Söndürme Tüpü', options: ['Var', 'Yok'] },
        { label: '220 Volt Şarj Kablosu', options: ['Var', 'Yok'] },
        { label: 'İmdat Çekici', options: ['Var', 'Yok'] }
      ]
    }
  ];

  // İlerleme hesaplama
  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0) + 1; // +1 for fuel gauge
  const checkedItems = Object.keys(checks).length;
  const progress = (checkedItems / totalItems) * 100;

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-lg font-bold">AMBULANS GÜNLÜK KONTROL VE DEVİR ALMA FORMU</h1>
        <p className="text-sm text-gray-500">Şoför Vardiya Başlatma Kontrolü</p>
      </div>

      {/* Araç Bilgileri */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 relative">
              <Label className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                İstasyon Adı
              </Label>
              <div className="relative">
                <Input 
                  value={locationSearch || formData.istasyonAdi}
                  onChange={(e) => {
                    setLocationSearch(e.target.value);
                    setShowLocationDropdown(true);
                  }}
                  onFocus={() => setShowLocationDropdown(true)}
                  placeholder="Lokasyon ara veya seç..." 
                  className="pr-8"
                />
                <Search className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              {showLocationDropdown && filteredLocations.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc._id || loc.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                      onClick={() => {
                        handleInputChange('istasyonAdi', loc.name);
                        setLocationSearch(loc.name);
                        setShowLocationDropdown(false);
                      }}
                    >
                      <div className="font-medium">{loc.name}</div>
                      {loc.address && (
                        <div className="text-xs text-gray-500">{loc.address}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Plaka</Label>
              <Input 
                value={formData.plaka || vehiclePlate}
                readOnly
                disabled
                className="bg-gray-100 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label>Devir Aldığım KM *</Label>
              <Input 
                type="number"
                value={formData.km}
                onChange={(e) => handleInputChange('km', e.target.value)}
                placeholder="Güncel kilometre"
                className="font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input 
                type="date"
                value={formData.tarih}
                onChange={(e) => handleInputChange('tarih', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* İlerleme */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Kontrol İlerlemesi</span>
            <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-blue-600 mt-1 text-center">
            {checkedItems}/{totalItems} kontrol tamamlandı
          </p>
        </CardContent>
      </Card>

      {/* Kontrol Kategorileri */}
      {categories.map((category) => (
        <Collapsible key={category.id} defaultOpen={category.id <= 2}>
          <Card className={checks[category.title + '_complete'] ? 'border-green-300' : ''}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-gray-50 py-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {category.id}
                    </span>
                    {category.title}
                    <span className="text-xs text-gray-400">
                      ({category.items.filter(item => checks[item.label]).length}/{category.items.length})
                    </span>
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                {/* Yakıt Göstergesi */}
                {category.hasFuelGauge && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <Label className="flex items-center gap-2 mb-3 font-medium">
                      <Fuel className="h-4 w-4 text-amber-600" />
                      Aracın Yakıt Durumu
                    </Label>
                    <RadioGroup 
                      value={checks['yakitSeviyesi']} 
                      onValueChange={(v) => handleCheck('yakitSeviyesi', v)}
                      className="flex justify-between"
                    >
                      {['0', '25', '50', '75', '100'].map(val => (
                        <div key={val} className="flex flex-col items-center space-y-1">
                          <span className={`text-2xl ${checks['yakitSeviyesi'] === val ? '' : 'grayscale opacity-50'}`}>
                            ⛽
                          </span>
                          <RadioGroupItem value={val} id={`fuel-${val}`} />
                          <Label 
                            htmlFor={`fuel-${val}`} 
                            className={`text-xs ${checks['yakitSeviyesi'] === val ? 'font-bold text-amber-700' : ''}`}
                          >
                            %{val}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                
                {/* Kontrol Maddeleri */}
                {category.items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b last:border-0 gap-2 ${
                      checks[item.label] ? 'bg-green-50/50' : ''
                    }`}
                  >
                    <Label className="text-sm font-medium flex items-center gap-2">
                      {checks[item.label] && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {item.label}
                    </Label>
                    <RadioGroup 
                      value={checks[item.label]} 
                      onValueChange={(v) => handleCheck(item.label, v)}
                      className="flex flex-wrap gap-2"
                    >
                      {item.options.map((option) => (
                        <div key={option} className="flex items-center space-x-1">
                          <RadioGroupItem 
                            value={option.toLowerCase()} 
                            id={`${category.id}-${idx}-${option}`} 
                          />
                          <Label 
                            htmlFor={`${category.id}-${idx}-${option}`} 
                            className="text-xs cursor-pointer"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      {/* Açıklama */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Ek Açıklama / Notlar</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea 
            value={formData.aciklama}
            onChange={(e) => handleInputChange('aciklama', e.target.value)}
            placeholder="Varsa eksiklikler, sorunlar veya notlar..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Özet */}
      {progress >= 80 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">
                Form tamamlanmak üzere! ({Math.round(progress)}%)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyControlFormForDriver;

