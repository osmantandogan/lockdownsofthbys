import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Progress } from '../ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { shiftsAPI, vehiclesAPI } from '../../api';
import PDFExportButton from '../PDFExportButton';
import { exportDailyControlForm } from '../../utils/pdfExport';
import { getTurkeyDate } from '../../utils/timezone';

const DailyControlFormFull = ({ formData: externalFormData, onChange }) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    setSaving(true);
    const saveFunc = handleFormSave('daily_control', localFormData, {
      validateFields: [],
      validateSignature: false,
      onSuccess: () => {
        // Form saved successfully
      }
    });
    await saveFunc();
    setSaving(false);
  };
  const [loading, setLoading] = useState(true);
  const [localFormData, setLocalFormData] = useState({
    istasyonAdi: '',
    plaka: '',
    km: '',
    tarih: getTurkeyDate(),
    aciklama: '',
    teslimEden: '',
    teslimAlan: ''
  });

  // Initial checks with default values to prevent controlled/uncontrolled warning
  const [checks, setChecks] = useState(externalFormData?.checks || {});

  const formData = externalFormData || localFormData;
  const setFormData = onChange || setLocalFormData;

  // External formData'dan checks'i yükle (FormHistory'den görüntüleme için)
  useEffect(() => {
    if (externalFormData && externalFormData.checks) {
      setChecks(externalFormData.checks);
    }
  }, [externalFormData]);

  // Otomatik araç ve KM bilgisi yükleme
  useEffect(() => {
    const loadVehicleData = async () => {
      try {
        // Aktif vardiya bilgisini çek
        const response = await shiftsAPI.getActive();
        const activeShift = response?.data;
        
        // Aktif vardiya ve araç ID'si varsa
        const vehicleId = activeShift?.vehicle_id;
        if (activeShift && vehicleId) {
          // Araç bilgisini çek
          const vehicleRes = await vehiclesAPI.getById(vehicleId);
          const vehicle = vehicleRes?.data;
          
          if (vehicle) {
            // Form verilerini otomatik doldur (Devir formundan gelen KM)
            const newData = {
              ...formData,
              plaka: vehicle.plate || '',
              km: vehicle.km || '', // Mevcut KM (devir formunda güncellenen)
              teslimAlan: user?.name || ''
            };
            
            if (onChange) {
              onChange(newData);
            } else {
              setLocalFormData(newData);
            }
            
            toast.success('Araç bilgileri otomatik yüklendi');
          }
        }
      } catch (error) {
        console.log('Araç bilgisi yüklenemedi (aktif vardiya yok olabilir):', error.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadVehicleData();
  }, []);

  const handleCheck = (item, value) => {
    setChecks({...checks, [item]: value});
  };

  // ATT/Paramedik/Hemşire için Cihaz, Malzeme ve İlaç Kontrol Kategorileri
  const categories = [
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

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0) + 1;
  const checkedItems = Object.keys(checks).length;
  const progress = (checkedItems / totalItems) * 100;

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">AMBULANS CİHAZ, MALZEME VE İLAÇ GÜNLÜK KONTROL FORMU</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>İstasyon Adı</Label>
              <Input placeholder="İstasyon adını giriniz" />
            </div>
            <div className="space-y-2">
              <Label>Plaka</Label>
              <Input placeholder="34 ABC 123" />
            </div>
            <div className="space-y-2">
              <Label>KM</Label>
              <Input type="number" placeholder="125000" />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Kontrol İlerlemesi</CardTitle></CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-2" />
          <p className="text-xs text-center text-gray-500">{Math.round(progress)}%</p>
        </CardContent>
      </Card>

      {categories.map((category) => (
        <Collapsible key={category.id} defaultOpen>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">{category.id}. {category.title}</CardTitle>
                  <ChevronDown className="h-5 w-5" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {category.hasFuelGauge && (
                  <div className="space-y-2">
                    <Label>Aracın Yakıt Durumu</Label>
                    <RadioGroup value={checks['yakitSeviyesi']} onValueChange={(v) => handleCheck('yakitSeviyesi', v)}>
                      <div className="flex justify-between">
                        {['0', '25', '50', '75', '100'].map(val => (
                          <div key={val} className="flex flex-col items-center space-y-1">
                            <span className="text-2xl">⛽</span>
                            <RadioGroupItem value={val} id={`fuel-${val}`} />
                            <Label htmlFor={`fuel-${val}`} className="text-xs">%{val}</Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                )}
                {category.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                    <Label className="text-sm">{item.label}</Label>
                    <RadioGroup 
                      value={checks[item.label]} 
                      onValueChange={(v) => handleCheck(item.label, v)}
                      className="flex space-x-2"
                    >
                      {item.options.map((option) => (
                        <div key={option} className="flex items-center space-x-1">
                          <RadioGroupItem value={option.toLowerCase()} id={`${item.label}-${option}`} />
                          <Label htmlFor={`${item.label}-${option}`} className="text-xs font-normal">{option}</Label>
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

      <Card>
        <CardHeader><CardTitle className="text-sm">Açıklama</CardTitle></CardHeader>
        <CardContent>
          <Textarea placeholder="Varsa ekstra notlar, sorunlar veya açıklamalar..." rows={4} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Teslim Eden</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adı Soyadı</Label>
              <Input placeholder="Adı Soyadı" />
            </div>
            <SignaturePad label="İmza" required />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Teslim Alan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adı Soyadı</Label>
              <Input placeholder="Adı Soyadı" />
            </div>
            <SignaturePad label="İmza" required />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={() => {
          const initialData = {
            istasyonAdi: '',
            plaka: '',
            km: '',
            tarih: getTurkeyDate(),
            aciklama: '',
            teslimEden: '',
            teslimAlan: ''
          };
          if (onChange) onChange(initialData);
          else setLocalFormData(initialData);
          setChecks({});
          toast.success('Form temizlendi');
        }}>🗑 Temizle</Button>
        <PDFExportButton 
          formType="daily_control"
          formData={{...formData, ...checks}}
          filename={`gunluk_kontrol_${formData.plaka || 'form'}`}
          variant="outline"
        >
          📄 PDF İndir
        </PDFExportButton>
        <Button variant="outline" onClick={() => {
          const doc = exportDailyControlForm({...formData, ...checks});
          const blob = doc.output('blob');
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }}>🔍 PDF Önizleme</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "💾 Kaydet"}</Button>
      </div>
    </div>
  );
};

export default DailyControlFormFull;
