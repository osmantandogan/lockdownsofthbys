import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronDown, ChevronUp, CheckCircle, Sparkles } from 'lucide-react';
import { getTurkeyDate } from '../../utils/timezone';

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

/**
 * Timer'sız Günlük Kontrol Formu (Vardiya Bitirme için)
 * Tüm bölümler açık ve düzenlenebilir
 */
const DailyControlFormNonTimed = ({ formData: externalFormData, onChange, onQuickFill }) => {
  const { user } = useAuth();
  
  // Form verileri
  const [checks, setChecks] = useState({});
  const [formInfo, setFormInfo] = useState({
    istasyonAdi: '',
    plaka: '',
    km: '',
    tarih: getTurkeyDate(),
    aciklama: ''
  });
  
  // Bölüm açık/kapalı durumları
  const [openSections, setOpenSections] = useState({});
  
  // Hızlı doldurma
  const [quickFilled, setQuickFilled] = useState(false);
  
  const handleCheck = (item, value) => {
    setChecks(prev => {
      const newChecks = { ...prev, [item]: value };
      if (onChange) {
        onChange({ ...formInfo, checks: newChecks });
      }
      return newChecks;
    });
  };
  
  const handleInfoChange = (key, value) => {
    setFormInfo(prev => {
      const newInfo = { ...prev, [key]: value };
      if (onChange) {
        onChange({ ...newInfo, checks });
      }
      return newInfo;
    });
  };
  
  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };
  
  // Hızlı doldurma - tüm alanları ilk seçenek ile doldur
  const handleQuickFill = () => {
    const allChecks = {};
    CATEGORIES.forEach(category => {
      category.items.forEach(item => {
        // Her item için ilk seçeneği seç (genelde en iyi durum)
        allChecks[item.label] = item.options[0];
      });
    });
    
    setChecks(allChecks);
    setQuickFilled(true);
    
    if (onChange) {
      onChange({ ...formInfo, checks: allChecks });
    }
    if (onQuickFill) {
      onQuickFill(allChecks);
    }
    
    toast.success('✨ Tüm alanlar "Her şey çalışıyor" olarak dolduruldu!');
  };
  
  const filledCount = Object.keys(checks).length;
  const totalItems = CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0);
  
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-lg font-bold">AMBULANS CİHAZ, MALZEME VE İLAÇ GÜNLÜK KONTROL FORMU</h1>
        <p className="text-sm text-gray-500">Vardiya Bitirme - Kontrol Formu</p>
        <p className="text-xs text-gray-400">Doldurma: {filledCount}/{totalItems}</p>
      </div>
      
      {/* Hızlı Doldurma Butonu */}
      <Card className={`border-2 ${quickFilled ? 'border-green-500 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
        <CardContent className="py-4">
          <Button
            variant={quickFilled ? 'default' : 'outline'}
            className={`w-full h-14 text-lg ${quickFilled ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={handleQuickFill}
          >
            {quickFilled ? (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                ✓ Her şey aldığım gibi çalışıyor ve temiz
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Her şey aldığım gibi çalışıyor ve temiz (Hızlı Doldur)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Bölümler */}
      {CATEGORIES.map((category) => (
        <Card key={category.id}>
          <Collapsible open={openSections[category.id]} onOpenChange={() => toggleSection(category.id)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 cursor-pointer hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {category.id}
                    </span>
                    {category.title}
                    <span className="text-xs text-gray-400 ml-2">
                      ({category.items.filter(item => checks[item.label]).length}/{category.items.length})
                    </span>
                  </CardTitle>
                  {openSections[category.id] ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2">
                {category.items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b last:border-0 gap-2 ${
                      checks[item.label] ? 'bg-green-50/50' : ''
                    }`}
                  >
                    <Label className="text-sm font-medium">{item.label}</Label>
                    <RadioGroup 
                      value={checks[item.label] || ''} 
                      onValueChange={(v) => handleCheck(item.label, v)}
                      className="flex flex-wrap gap-2"
                    >
                      {item.options.map((option, optIdx) => (
                        <div key={optIdx} className="flex items-center space-x-1">
                          <RadioGroupItem 
                            value={option} 
                            id={`${category.id}-${idx}-${optIdx}`} 
                          />
                          <Label 
                            htmlFor={`${category.id}-${idx}-${optIdx}`} 
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
          </Collapsible>
        </Card>
      ))}
      
      {/* Açıklama */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Ek Açıklama / Notlar</Label>
            <Textarea 
              value={formInfo.aciklama}
              onChange={(e) => handleInfoChange('aciklama', e.target.value)}
              placeholder="Varsa eksiklikler veya sorunlar hakkında not ekleyin..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyControlFormNonTimed;

