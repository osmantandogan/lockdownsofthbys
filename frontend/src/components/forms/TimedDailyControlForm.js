import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Progress } from '../ui/progress';
import SignaturePad from '../SignaturePad';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { shiftsAPI, locationsAPI } from '../../api';
import { Clock, Lock, CheckCircle, Timer, MapPin, Search } from 'lucide-react';

// Bölüm süreleri (saniye cinsinden)
const SECTION_TIMES = {
  1: 5 * 60,   // 5 dakika
  2: 1 * 60,   // 1 dakika
  3: 2 * 60,   // 2 dakika
  4: 1 * 60,   // 1 dakika
  5: 1 * 60,   // 1 dakika
  6: 1 * 60,   // 1 dakika
  7: 2 * 60    // 2 dakika
};

// ATT/Paramedik için Cihaz, Malzeme ve İlaç Kontrol Kategorileri
const CATEGORIES = [
  {
    id: 1,
    title: 'TIBBİ CİHAZLAR',
    items: [
      { label: 'Defibrilatör', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] },
      { label: 'Monitör', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] },
      { label: 'Aspiratör', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] },
      { label: 'Oksijen Tüpü (Ana)', options: ['Dolu', 'Yarı Dolu', 'Boş'] },
      { label: 'Oksijen Tüpü (Yedek)', options: ['Dolu', 'Yarı Dolu', 'Boş'] },
      { label: 'Pulse Oksimetre', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] },
      { label: 'Tansiyon Aleti', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] },
      { label: 'Steteskop', options: ['Var', 'Yok'] },
      { label: 'Glukoz Ölçüm Cihazı', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] },
      { label: 'Laringoskop Seti', options: ['Tam', 'Eksik', 'Yok'] },
      { label: 'Ambu (Yetişkin)', options: ['Var', 'Yok'] },
      { label: 'Ambu (Çocuk)', options: ['Var', 'Yok'] },
      { label: 'Nebulizatör', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] }
    ]
  },
  {
    id: 2,
    title: 'SOLUNUM EKİPMANLARI',
    items: [
      { label: 'Oksijen Maskesi (Yetişkin)', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Oksijen Maskesi (Çocuk)', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Nazal Kanül', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Endotrakeal Tüpler', options: ['Tam Set', 'Eksik', 'Yok'] },
      { label: 'Airway (Orofarengeal)', options: ['Tam Set', 'Eksik', 'Yok'] },
      { label: 'Balon Valf Maske', options: ['Var', 'Yok'] }
    ]
  },
  {
    id: 3,
    title: 'DAMAR YOLU MALZEMELERİ',
    items: [
      { label: 'Branül (18G-22G)', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Serum Seti', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'SF %0.9 500ml', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Dextrose %5 500ml', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Ringer Laktat 500ml', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Üç Yollu Musluk', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Turnike', options: ['Var', 'Yok'] },
      { label: 'Flaster/Sargı Bezi', options: ['Yeterli', 'Az', 'Yok'] }
    ]
  },
  {
    id: 4,
    title: 'ACİL İLAÇLAR',
    items: [
      { label: 'Adrenalin', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Atropin', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Diazepam', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Furosemid', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Metilprednizolon', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Metoklopramid', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Ondansetron', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Parasetamol IV', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Diklofenak', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Salbutamol (Nebül)', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'NTG Spray', options: ['Var', 'Yok'] },
      { label: 'Aspirin 300mg', options: ['Yeterli', 'Az', 'Yok'] }
    ]
  },
  {
    id: 5,
    title: 'İMMOBİLİZASYON MALZEMELERİ',
    items: [
      { label: 'Boyunluk (S-M-L)', options: ['Tam Set', 'Eksik', 'Yok'] },
      { label: 'Kısa Sırt Tahtası (KED)', options: ['Var', 'Yok'] },
      { label: 'Uzun Sırt Tahtası', options: ['Var', 'Yok'] },
      { label: 'Scoop Sedye', options: ['Var', 'Yok'] },
      { label: 'Vakum Atel', options: ['Var', 'Yok'] },
      { label: 'Baş Hareketsizleştirici', options: ['Var', 'Yok'] },
      { label: 'Sabitleyici Kemerler', options: ['Tam', 'Eksik', 'Yok'] }
    ]
  },
  {
    id: 6,
    title: 'PANSUMAN VE SARF MALZEMELERİ',
    items: [
      { label: 'Steril Gazlı Bez', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Elastik Bandaj', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Steril Eldiven', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Eldiven (Nitril/Latex)', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Kesici-Delici Atık Kutusu', options: ['Var/Boş', 'Var/Dolu', 'Yok'] },
      { label: 'Enfekte Atık Torbası', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Dezenfektan (El)', options: ['Var', 'Yok'] },
      { label: 'Yüzey Dezenfektanı', options: ['Var', 'Yok'] }
    ]
  },
  {
    id: 7,
    title: 'DİĞER EKİPMANLAR',
    items: [
      { label: 'El Feneri', options: ['Var/Çalışıyor', 'Var/Arızalı', 'Yok'] },
      { label: 'Battaniye', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Çarşaf', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Kusma Torbası', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'İdrar Torbası', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Sonda (Nazogastrik)', options: ['Yeterli', 'Az', 'Yok'] },
      { label: 'Foley Kateter', options: ['Yeterli', 'Az', 'Yok'] }
    ]
  }
];

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Zaman Kısıtlamalı Günlük Kontrol Formu (ATT/Paramedik için)
 */
const TimedDailyControlForm = ({ formData: externalFormData, onChange, vehicleId, vehiclePlate, onComplete, onAlreadyFilled }) => {
  const { user } = useAuth();
  
  // Bölüm durumları
  const [currentSection, setCurrentSection] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(SECTION_TIMES[1]);
  const [allCompleted, setAllCompleted] = useState(false);
  const [sectionStartTimes, setSectionStartTimes] = useState({ 1: new Date() });
  
  // Form verileri
  const [checks, setChecks] = useState({});
  const [formInfo, setFormInfo] = useState({
    istasyonAdi: '',
    plaka: vehiclePlate || '',
    tarih: new Date().toISOString().split('T')[0],
    aciklama: ''
  });
  
  // Lokasyon autocomplete için state'ler
  const [locations, setLocations] = useState([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState([]);
  
  // Form zaten doldurulmuş mu
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [filledBy, setFilledBy] = useState(null);
  
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
    if (vehiclePlate && !formInfo.plaka) {
      setFormInfo(prev => ({ ...prev, plaka: vehiclePlate }));
    }
  }, [vehiclePlate]);
  
  // Başlangıçta form durumunu kontrol et
  useEffect(() => {
    const checkFormStatus = async () => {
      if (!vehicleId) return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await shiftsAPI.checkDailyForm(vehicleId, today);
        
        if (response.data?.filled) {
          setAlreadyFilled(true);
          setFilledBy(response.data.filled_by_name);
          toast.info(`Bu form bugün ${response.data.filled_by_name} tarafından doldurulmuş.`);
          // Parent'a bildir ki buton aktif olsun
          if (onAlreadyFilled) {
            onAlreadyFilled(response.data.filled_by_name);
          }
        }
      } catch (error) {
        console.log('Form durumu kontrol edilemedi:', error.message);
      }
    };
    
    checkFormStatus();
  }, [vehicleId]);
  
  // Timer yönetimi
  useEffect(() => {
    if (allCompleted || alreadyFilled) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (currentSection < 7) {
            const nextSection = currentSection + 1;
            setCurrentSection(nextSection);
            setSectionStartTimes(prev => ({ ...prev, [nextSection]: new Date() }));
            toast.info(`⏰ Bölüm ${nextSection} açıldı!`);
            return SECTION_TIMES[nextSection];
          } else {
            setAllCompleted(true);
            toast.success('🎉 Tüm bölümler tamamlandı! Artık düzenleyebilirsiniz.');
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentSection, allCompleted, alreadyFilled]);
  
  const handleCheck = (item, value) => {
    setChecks(prev => ({ ...prev, [item]: value }));
    if (onChange) {
      onChange({ ...formInfo, checks: { ...checks, [item]: value }, section_times: sectionStartTimes });
    }
  };
  
  const handleInfoChange = (key, value) => {
    setFormInfo(prev => {
      const newInfo = { ...prev, [key]: value };
      if (onChange) {
        onChange({ ...newInfo, checks, section_times: sectionStartTimes });
      }
      return newInfo;
    });
  };
  
  // Timer dolana kadar geçiş yapılamaz - bu fonksiyon artık çağrılmayacak
  // Timer otomatik olarak bölümleri açacak
  const handleSectionComplete = () => {
    // Sadece timer bittiğinde veya allCompleted olduğunda kullanılır
    if (allCompleted) {
      if (onComplete) {
        onComplete({ ...formInfo, checks, section_times: sectionStartTimes, form_completed_at: new Date() });
      }
    }
  };
  
  const isSectionEditable = (sectionId) => {
    if (alreadyFilled) return false;
    if (allCompleted) return true;
    return sectionId === currentSection;
  };
  
  const getSectionStatus = (sectionId) => {
    if (alreadyFilled) return 'filled';
    if (allCompleted) return 'completed';
    if (sectionId < currentSection) return 'locked';
    if (sectionId === currentSection) return 'active';
    return 'upcoming';
  };
  
  if (alreadyFilled) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="text-center">
              <p className="text-green-800 font-medium text-lg">Form Zaten Dolduruldu</p>
              <p className="text-green-600 mt-1">
                Bu vardiya için günlük kontrol formu bugün <strong>{filledBy}</strong> tarafından doldurulmuş.
              </p>
              <p className="text-sm text-green-500 mt-2">Tekrar doldurmanıza gerek yok.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-xl font-bold">AMBULANS CİHAZ, MALZEME VE İLAÇ GÜNLÜK KONTROL FORMU</h1>
        <p className="text-sm text-gray-500">ATT/Paramedik - Zaman Kısıtlamalı Form</p>
      </div>
      
      {!allCompleted && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-blue-600 animate-pulse" />
                <span className="font-medium text-blue-800">
                  Bölüm {currentSection}/7 - {CATEGORIES[currentSection - 1]?.title}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-mono font-bold ${timeRemaining <= 30 ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                  {formatTime(timeRemaining)}
                </span>
                <div className="text-xs text-gray-500 text-right">
                  <p>Süre dolunca</p>
                  <p>sonraki bölüm açılır</p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={(currentSection / 7) * 100} className="h-2" />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                {CATEGORIES.map((cat, idx) => (
                  <span key={cat.id} className={currentSection > idx + 1 ? 'text-green-600' : currentSection === idx + 1 ? 'text-blue-600 font-medium' : ''}>
                    {idx + 1}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-blue-700">
              ⏳ Her bölümü dikkatlice kontrol edin. Süre dolmadan sonraki bölüme geçemezsiniz.
            </p>
          </CardContent>
        </Card>
      )}
      
      {allCompleted && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <span className="font-medium text-green-800">
                Tüm bölümler tamamlandı! Artık tüm alanları düzenleyebilirsiniz.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 relative">
              <Label className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                İstasyon Adı
              </Label>
              <div className="relative">
                <Input 
                  value={locationSearch || formInfo.istasyonAdi}
                  onChange={(e) => {
                    setLocationSearch(e.target.value);
                    setShowLocationDropdown(true);
                  }}
                  onFocus={() => setShowLocationDropdown(true)}
                  placeholder="Lokasyon ara veya seç..."
                  className="pr-8"
                  disabled={!allCompleted && currentSection !== 1}
                />
                <Search className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              {showLocationDropdown && filteredLocations.length > 0 && (allCompleted || currentSection === 1) && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc._id || loc.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                      onClick={() => {
                        handleInfoChange('istasyonAdi', loc.name);
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
                value={formInfo.plaka || vehiclePlate}
                readOnly
                disabled
                className="bg-gray-100 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input 
                type="date"
                value={formInfo.tarih}
                onChange={(e) => handleInfoChange('tarih', e.target.value)}
                disabled={!allCompleted && currentSection !== 1}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {CATEGORIES.map((category) => {
        const status = getSectionStatus(category.id);
        const isEditable = isSectionEditable(category.id);
        
        return (
          <Card 
            key={category.id} 
            className={`transition-all duration-300 ${
              status === 'active' ? 'border-blue-400 ring-2 ring-blue-200' :
              status === 'completed' || allCompleted ? 'border-green-300 bg-green-50/30' :
              status === 'locked' ? 'border-gray-200 opacity-60' :
              'border-gray-200'
            }`}
          >
            <CardHeader className="py-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2">
                  {status === 'locked' && <Lock className="h-4 w-4 text-gray-400" />}
                  {status === 'active' && <Timer className="h-4 w-4 text-blue-500 animate-pulse" />}
                  {(status === 'completed' || allCompleted) && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {status === 'upcoming' && <Clock className="h-4 w-4 text-gray-400" />}
                  <span>{category.id}. {category.title}</span>
                </CardTitle>
                {status === 'active' && !allCompleted && (
                  <span className="text-sm text-blue-600 font-mono">{formatTime(timeRemaining)}</span>
                )}
              </div>
            </CardHeader>
            
            {(isEditable || allCompleted) && (
              <CardContent className="space-y-3">
                {category.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                    <Label className="text-sm">{item.label}</Label>
                    <RadioGroup 
                      value={checks[item.label] || ''} 
                      onValueChange={(v) => handleCheck(item.label, v)}
                      className="flex flex-wrap gap-2"
                      disabled={!isEditable}
                    >
                      {item.options.map((option) => (
                        <div key={option} className="flex items-center space-x-1">
                          <RadioGroupItem 
                            value={option.toLowerCase()} 
                            id={`${category.id}-${item.label}-${option}`}
                            disabled={!isEditable}
                          />
                          <Label 
                            htmlFor={`${category.id}-${item.label}-${option}`} 
                            className={`text-xs font-normal ${!isEditable ? 'text-gray-400' : ''}`}
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
            )}
            
            {!isEditable && !allCompleted && status === 'locked' && (
              <CardContent>
                <div className="text-center py-4 text-gray-400">
                  <Lock className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">Bu bölüm kilitli - önceki bölümler tamamlanmalı</p>
                </div>
              </CardContent>
            )}
            
            {!isEditable && !allCompleted && status === 'upcoming' && (
              <CardContent>
                <div className="text-center py-4 text-gray-400">
                  <Clock className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">Sıra bu bölüme geldiğinde açılacak</p>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
      
      {allCompleted && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Açıklama</CardTitle></CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Varsa ekstra notlar, sorunlar veya açıklamalar..."
                value={formInfo.aciklama}
                onChange={(e) => handleInfoChange('aciklama', e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Kontrol Eden</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Adı Soyadı</Label>
                  <Input value={user?.name || ''} disabled />
                </div>
                <SignaturePad label="İmza" required />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default TimedDailyControlForm;
