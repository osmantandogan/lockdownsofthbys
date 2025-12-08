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
    tarih: new Date().toISOString().split('T')[0],
    aciklama: '',
    teslimEden: '',
    teslimAlan: ''
  });

  const [checks, setChecks] = useState({});

  const formData = externalFormData || localFormData;
  const setFormData = onChange || setLocalFormData;

  // Otomatik araç ve KM bilgisi yükleme
  useEffect(() => {
    const loadVehicleData = async () => {
      try {
        // Aktif vardiya bilgisini çek
        const activeShift = await shiftsAPI.getActive();
        
        if (activeShift) {
          // Araç bilgisini çek
          const vehicle = await vehiclesAPI.getById(activeShift.vehicle_id);
          
          // Form verilerini otomatik doldur (Devir formundan gelen KM)
          const newData = {
            ...formData,
            plaka: vehicle.plate,
            km: vehicle.km, // Mevcut KM (devir formunda güncellenen)
            teslimAlan: user.name
          };
          
          if (onChange) {
            onChange(newData);
          } else {
            setLocalFormData(newData);
          }
          
          toast.success('Araç bilgileri otomatik yüklendi');
        }
      } catch (error) {
        console.error('Araç bilgisi yüklenemedi:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadVehicleData();
  }, []);

  const handleCheck = (item, value) => {
    setChecks({...checks, [item]: value});
  };

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
      title: 'ARACI ÇALIŞTIRINIZ',
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

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0) + 1;
  const checkedItems = Object.keys(checks).length;
  const progress = (checkedItems / totalItems) * 100;

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">AMBULANS GÜNLÜK KONTROL VE DEVİR TESLİM FORMU</h1>
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
            tarih: new Date().toISOString().split('T')[0],
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
