import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formTemplatesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  FileText, Save, Trash2, Plus, GripVertical, Settings, 
  ArrowLeft, ChevronRight, Eye, X, Move,
  ArrowUp, ArrowDown, User, Clock, Heart, Stethoscope,
  Pill, Truck, MapPin, Phone, AlertCircle, PenTool, Camera,
  Package, Users
} from 'lucide-react';

// A4 boyutları (piksel, 96 DPI)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const SCALE = 0.85;

// Hazır kutucuk tanımları - Tablo editöründeki ile aynı
const BLOCK_DEFINITIONS = [
  // ===== YENİ BLOKLAR =====
  {
    id: 'istasyon',
    name: '⭐ İSTASYON',
    icon: MapPin,
    color: 'bg-indigo-200 text-indigo-800 border-indigo-400',
    fields: [
      { field_id: 'protokol_112', label: 'Protokol No' },
      { field_id: 'tarih', label: 'Tarih' },
      { field_id: 'vaka_kodu', label: 'Kodu' },
      { field_id: 'plaka', label: 'Plaka' }
    ],
    defaultWidth: 280,
    defaultHeight: 80
  },
  {
    id: 'saatler',
    name: '⭐ Saatler',
    icon: Clock,
    color: 'bg-amber-200 text-amber-800 border-amber-400',
    fields: [
      { field_id: 'cagri_saati', label: 'Çağrı Saati' },
      { field_id: 'olay_yerine_varis', label: 'Olay Yerine Varış' },
      { field_id: 'hastaya_varis', label: 'Hastaya Varış' },
      { field_id: 'olay_yerinden_ayrilis', label: 'Olay Yerinden Ayrılış' },
      { field_id: 'hastaneye_varis', label: 'Hastaneye Varış' },
      { field_id: 'istasyona_donus', label: 'İstasyona Dönüş' }
    ],
    defaultWidth: 350,
    defaultHeight: 100
  },
  {
    id: 'hasta_bilgileri_detayli',
    name: '⭐ Hasta Bilgileri (Detaylı)',
    icon: User,
    color: 'bg-blue-200 text-blue-800 border-blue-400',
    fields: [
      { field_id: 'ad_soyad', label: 'Adı Soyadı' },
      { field_id: 'tc_kimlik', label: 'T.C. Kimlik' },
      { field_id: 'dogum_tarihi_yas', label: 'Doğum Tarihi / Yaşı' },
      { field_id: 'cinsiyet', label: 'Cinsiyet' },
      { field_id: 'adres', label: 'Adres' },
      { field_id: 'telefon', label: 'Telefon' }
    ],
    defaultWidth: 300,
    defaultHeight: 120
  },
  {
    id: 'hasta_durumu',
    name: '⭐ Durumu',
    icon: AlertCircle,
    color: 'bg-red-200 text-red-800 border-red-400',
    fields: [
      { field_id: 'durum', label: 'Durumu' }
    ],
    defaultWidth: 200,
    defaultHeight: 50
  },
  {
    id: 'kronik_hastaliklar',
    name: '⭐ Kronik Hastalıklar',
    icon: Heart,
    color: 'bg-pink-200 text-pink-800 border-pink-400',
    fields: [
      { field_id: 'kronik', label: 'Kronik Hastalıklar' }
    ],
    defaultWidth: 250,
    defaultHeight: 60
  },
  {
    id: 'hasta_sikayeti',
    name: '⭐ Hastanın Şikayeti',
    icon: FileText,
    color: 'bg-teal-200 text-teal-800 border-teal-400',
    fields: [
      { field_id: 'sikayet', label: 'Şikayet' }
    ],
    defaultWidth: 280,
    defaultHeight: 80
  },
  // ===== 🆕 YENİ PDF BLOKLARI =====
  {
    id: 'yeni_hasta_bilgileri',
    name: '🆕 3. HASTA BİLGİLERİ',
    icon: User,
    color: 'bg-emerald-200 text-emerald-800 border-emerald-400',
    fields: [
      { field_id: 'ad_soyad', label: 'Adı Soyadı' },
      { field_id: 'adres', label: 'Adresi' },
      { field_id: 'telefon', label: 'Telefon' },
      { field_id: 'tc_no', label: 'T.C. Kimlik No' },
      { field_id: 'yas', label: 'Yaş' },
      { field_id: 'cinsiyet', label: 'Cinsiyet' },
      { field_id: 'durum_kodu', label: 'Durumu (Kırmızı/Sarı/Yeşil/Siyah Kod)' }
    ],
    defaultWidth: 320,
    defaultHeight: 140
  },
  {
    id: 'yeni_alinan_adres',
    name: '🆕 4. HASTANIN ALINDIĞI ADRES',
    icon: MapPin,
    color: 'bg-orange-200 text-orange-800 border-orange-400',
    fields: [
      { field_id: 'alinan_adres', label: 'Alındığı Adres' }
    ],
    defaultWidth: 300,
    defaultHeight: 60
  },
  {
    id: 'yeni_cagri_tipi',
    name: '🆕 5. ÇAĞRI TİPİ',
    icon: Phone,
    color: 'bg-purple-200 text-purple-800 border-purple-400',
    fields: [
      { field_id: 'cagri_tipi', label: 'Çağrı Tipi (Telsiz/Telefon/Diğer)' }
    ],
    defaultWidth: 200,
    defaultHeight: 50
  },
  {
    id: 'yeni_cagri_nedeni',
    name: '🆕 6. ÇAĞRI NEDENİ',
    icon: AlertCircle,
    color: 'bg-red-200 text-red-800 border-red-400',
    fields: [
      { field_id: 'cagri_nedeni', label: 'Çağrı Nedeni' }
    ],
    defaultWidth: 280,
    defaultHeight: 60
  },
  {
    id: 'yeni_olay_yeri',
    name: '🆕 7. OLAY YERİ',
    icon: MapPin,
    color: 'bg-cyan-200 text-cyan-800 border-cyan-400',
    fields: [
      { field_id: 'olay_yeri_tipi', label: 'Olay Yeri Tipi' }
    ],
    defaultWidth: 200,
    defaultHeight: 50
  },
  {
    id: 'yeni_ilk_muayene',
    name: '🆕 8. İLK MUAYENE BULGULARI',
    icon: Stethoscope,
    color: 'bg-violet-200 text-violet-800 border-violet-400',
    fields: [
      { field_id: 'pupiller', label: 'Pupiller' },
      { field_id: 'deri', label: 'Deri' },
      { field_id: 'sistolik', label: 'Sistolik (mmHg)' },
      { field_id: 'diyastolik', label: 'Diyastolik (mmHg)' },
      { field_id: 'spo2', label: 'SPO2 (%)' },
      { field_id: 'nabiz', label: 'Nabız (dk)' },
      { field_id: 'nabiz_ritim', label: 'Nabız Ritmi' },
      { field_id: 'solunum', label: 'Solunum (dk)' },
      { field_id: 'solunum_tipi', label: 'Solunum Tipi' }
    ],
    defaultWidth: 350,
    defaultHeight: 160
  },
  {
    id: 'yeni_glasgow',
    name: '🆕 9. GLASGOW SKALASI (GKS)',
    icon: AlertCircle,
    color: 'bg-orange-200 text-orange-800 border-orange-400',
    fields: [
      { field_id: 'motor', label: 'Motor (1-6)' },
      { field_id: 'verbal', label: 'Verbal (1-5)' },
      { field_id: 'goz', label: 'Göz Açma (1-4)' },
      { field_id: 'toplam', label: 'G.K.S. PUANI' }
    ],
    defaultWidth: 200,
    defaultHeight: 100
  },
  {
    id: 'yeni_kan_sekeri',
    name: '🆕 10. KAN ŞEKERİ',
    icon: Heart,
    color: 'bg-pink-200 text-pink-800 border-pink-400',
    fields: [
      { field_id: 'kan_sekeri_1', label: 'Kan Şekeri 1 (Mg/dL)' },
      { field_id: 'kan_sekeri_2', label: 'Kan Şekeri 2 (Mg/dL)' },
      { field_id: 'kan_sekeri_3', label: 'Kan Şekeri 3 (Mg/dL)' }
    ],
    defaultWidth: 200,
    defaultHeight: 80
  },
  {
    id: 'yeni_on_tani',
    name: '🆕 11. ÖN TANI',
    icon: FileText,
    color: 'bg-teal-200 text-teal-800 border-teal-400',
    fields: [
      { field_id: 'on_tani', label: 'Ön Tanı' }
    ],
    defaultWidth: 280,
    defaultHeight: 80
  },
  {
    id: 'yeni_aciklamalar',
    name: '🆕 12. AÇIKLAMALAR',
    icon: FileText,
    color: 'bg-gray-200 text-gray-800 border-gray-400',
    fields: [
      { field_id: 'aciklamalar', label: 'Açıklamalar' }
    ],
    defaultWidth: 300,
    defaultHeight: 100
  },
  {
    id: 'yeni_vakayi_veren',
    name: '🆕 13. VAKAYI VEREN KURUM',
    icon: Users,
    color: 'bg-indigo-200 text-indigo-800 border-indigo-400',
    fields: [
      { field_id: 'vakayi_veren', label: 'Vakayı Veren Kurum' }
    ],
    defaultWidth: 250,
    defaultHeight: 60
  },
  {
    id: 'yeni_sonuc',
    name: '🆕 14. SONUÇ',
    icon: FileText,
    color: 'bg-green-200 text-green-800 border-green-400',
    fields: [
      { field_id: 'sonuc', label: 'Sonuç' }
    ],
    defaultWidth: 250,
    defaultHeight: 60
  },
  {
    id: 'yeni_nakledilen_hastane',
    name: '🆕 15. NAKLEDİLEN HASTANE',
    icon: MapPin,
    color: 'bg-lime-200 text-lime-800 border-lime-400',
    fields: [
      { field_id: 'hastane_1', label: 'Hastane 1' },
      { field_id: 'hastane_2', label: 'Hastane 2' },
      { field_id: 'hastane_3', label: 'Hastane 3' },
      { field_id: 'hastane_4', label: 'Hastane 4' }
    ],
    defaultWidth: 280,
    defaultHeight: 100
  },
  {
    id: 'yeni_kaza_plakalari',
    name: '🆕 16. KAZAYA KARIŞAN ARAÇ PLAKA',
    icon: Truck,
    color: 'bg-slate-200 text-slate-800 border-slate-400',
    fields: [
      { field_id: 'plaka_1', label: 'Plaka 1' },
      { field_id: 'plaka_2', label: 'Plaka 2' },
      { field_id: 'plaka_3', label: 'Plaka 3' },
      { field_id: 'plaka_4', label: 'Plaka 4' }
    ],
    defaultWidth: 250,
    defaultHeight: 100
  },
  {
    id: 'yeni_cpr',
    name: '🆕 17. CPR YAPILDI İSE',
    icon: Heart,
    color: 'bg-red-200 text-red-800 border-red-400',
    fields: [
      { field_id: 'cpr_baslama', label: 'Başlama Zamanı' },
      { field_id: 'cpr_birakma', label: 'Bırakma Zamanı' },
      { field_id: 'cpr_neden', label: 'Bırakma Nedeni' }
    ],
    defaultWidth: 220,
    defaultHeight: 80
  },
  {
    id: 'yeni_km_bilgileri',
    name: '🆕 18. BAŞLANGIÇ KM – BİTİŞ KM',
    icon: Truck,
    color: 'bg-gray-200 text-gray-800 border-gray-400',
    fields: [
      { field_id: 'atn_no', label: 'ATN No' },
      { field_id: 'baslangic_km', label: 'Başlangıç KM' },
      { field_id: 'bitis_km', label: 'Bitiş KM' }
    ],
    defaultWidth: 220,
    defaultHeight: 80
  },
  {
    id: 'yeni_islemler',
    name: '🆕 21. İŞLEMLER (Tümü)',
    icon: Settings,
    color: 'bg-violet-200 text-violet-800 border-violet-400',
    fields: [
      { field_id: 'genel_mudahale', label: 'Genel Müdahale' },
      { field_id: 'hava_yolu', label: 'Hava Yolu' },
      { field_id: 'diger_islemler', label: 'Diğer İşlemler' },
      { field_id: 'yenidogan', label: 'Yenidoğan İşlemleri' },
      { field_id: 'sivi_tedavisi', label: 'Sıvı Tedavisi' }
    ],
    defaultWidth: 350,
    defaultHeight: 140
  },
  {
    id: 'yeni_kullanilan_ilaclar',
    name: '🆕 22. KULLANILAN İLAÇLAR',
    icon: Pill,
    color: 'bg-green-200 text-green-800 border-green-400',
    fields: [
      { field_id: 'ilaclar', label: 'Kullanılan İlaçlar Listesi' }
    ],
    defaultWidth: 300,
    defaultHeight: 120
  },
  {
    id: 'yeni_kullanilan_malzemeler',
    name: '🆕 23. KULLANILAN MALZEMELER',
    icon: Package,
    color: 'bg-yellow-200 text-yellow-800 border-yellow-400',
    fields: [
      { field_id: 'malzemeler', label: 'Kullanılan Malzemeler Listesi' }
    ],
    defaultWidth: 300,
    defaultHeight: 120
  },
  {
    id: 'yeni_hastane_reddi',
    name: '🆕 24. HASTANENİN HASTA REDDİ',
    icon: AlertCircle,
    color: 'bg-red-200 text-red-800 border-red-400',
    fields: [
      { field_id: 'red_nedeni', label: 'Red Nedeni' },
      { field_id: 'hastane_adi', label: 'Hastane/Kurum Adı' },
      { field_id: 'kase', label: 'Kaşe' },
      { field_id: 'imza', label: 'İmza' }
    ],
    defaultWidth: 300,
    defaultHeight: 100
  },
  {
    id: 'yeni_hasta_hizmet_reddi',
    name: '🆕 25. HASTANIN HİZMET REDDİ',
    icon: AlertCircle,
    color: 'bg-orange-200 text-orange-800 border-orange-400',
    fields: [
      { field_id: 'hasta_adi', label: 'Hasta Adı' },
      { field_id: 'hasta_yakini', label: 'Hasta Yakını Adı' },
      { field_id: 'imza', label: 'İmza' }
    ],
    defaultWidth: 280,
    defaultHeight: 90
  },
  {
    id: 'yeni_teslim_imzalar',
    name: '🆕 26. TESLİM ALAN – TESLİM EDEN',
    icon: PenTool,
    color: 'bg-slate-200 text-slate-800 border-slate-400',
    fields: [
      { field_id: 'teslim_alan_ad', label: 'Teslim Alanın Adı Soyadı' },
      { field_id: 'teslim_alan_unvan', label: 'Unvanı' },
      { field_id: 'teslim_alan_imza', label: 'Teslim Alan İmza' },
      { field_id: 'teslim_alan_kase', label: 'Kaşe' },
      { field_id: 'hekim_imza', label: 'Hekim/PRM İmza' },
      { field_id: 'saglik_per_imza', label: 'Sağlık Per./ATT İmza' },
      { field_id: 'sofor_imza', label: 'Sür./Teknisyen İmza' }
    ],
    defaultWidth: 400,
    defaultHeight: 140
  },
  // ===== DİĞER BLOKLAR =====
  {
    id: 'hasta_bilgileri',
    name: 'Hasta Bilgileri',
    icon: User,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    fields: [
      { field_id: 'tc_no', label: 'TC Kimlik No' },
      { field_id: 'ad', label: 'Ad' },
      { field_id: 'soyad', label: 'Soyad' },
      { field_id: 'yas', label: 'Yaş' },
      { field_id: 'dogum_tarihi', label: 'Doğum Tarihi' },
      { field_id: 'cinsiyet', label: 'Cinsiyet' }
    ],
    defaultWidth: 250,
    defaultHeight: 100
  },
  {
    id: 'cagri_bilgileri',
    name: 'Çağrı Bilgileri',
    icon: Phone,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    fields: [
      { field_id: 'cagri_zamani', label: 'Çağrı Zamanı' },
      { field_id: 'cagri_tipi', label: 'Çağrı Tipi' },
      { field_id: 'cagri_nedeni', label: 'Çağrı Nedeni' },
      { field_id: 'vakayi_veren', label: 'Vakayı Veren Kurum' }
    ],
    defaultWidth: 250,
    defaultHeight: 80
  },
  {
    id: 'zaman_bilgileri',
    name: 'Zaman Bilgileri',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    fields: [
      { field_id: 'cagri_saati', label: 'Çağrı Saati' },
      { field_id: 'olay_yerine_varis', label: 'Olay Yerine Varış' },
      { field_id: 'hastaya_varis', label: 'Hastaya Varış' },
      { field_id: 'ayrilis', label: 'Olay Yerinden Ayrılış' },
      { field_id: 'hastaneye_varis', label: 'Hastaneye Varış' },
      { field_id: 'istasyona_donus', label: 'İstasyona Dönüş' }
    ],
    defaultWidth: 300,
    defaultHeight: 100
  },
  {
    id: 'vital_bulgular_1',
    name: 'Vital Bulgular 1',
    icon: Heart,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: [
      { field_id: 'saat', label: 'Saat' },
      { field_id: 'tansiyon', label: 'Tansiyon' },
      { field_id: 'nabiz', label: 'Nabız' },
      { field_id: 'spo2', label: 'SpO2' },
      { field_id: 'solunum', label: 'Solunum' },
      { field_id: 'ates', label: 'Ateş' }
    ],
    defaultWidth: 280,
    defaultHeight: 60
  },
  {
    id: 'vital_bulgular_2',
    name: 'Vital Bulgular 2',
    icon: Heart,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: [
      { field_id: 'saat', label: 'Saat' },
      { field_id: 'tansiyon', label: 'Tansiyon' },
      { field_id: 'nabiz', label: 'Nabız' },
      { field_id: 'spo2', label: 'SpO2' },
      { field_id: 'solunum', label: 'Solunum' },
      { field_id: 'ates', label: 'Ateş' }
    ],
    defaultWidth: 280,
    defaultHeight: 60
  },
  {
    id: 'vital_bulgular_3',
    name: 'Vital Bulgular 3',
    icon: Heart,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: [
      { field_id: 'saat', label: 'Saat' },
      { field_id: 'tansiyon', label: 'Tansiyon' },
      { field_id: 'nabiz', label: 'Nabız' },
      { field_id: 'spo2', label: 'SpO2' },
      { field_id: 'solunum', label: 'Solunum' },
      { field_id: 'ates', label: 'Ateş' }
    ],
    defaultWidth: 280,
    defaultHeight: 60
  },
  {
    id: 'klinik_gozlemler',
    name: 'Klinik Gözlemler',
    icon: Eye,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    fields: [
      { field_id: 'bilinc', label: 'Bilinç Durumu' },
      { field_id: 'duygu', label: 'Duygu Durumu' },
      { field_id: 'pupil', label: 'Pupil' },
      { field_id: 'cilt', label: 'Cilt' },
      { field_id: 'solunum_tipi', label: 'Solunum Tipi' },
      { field_id: 'nabiz_tipi', label: 'Nabız Tipi' }
    ],
    defaultWidth: 250,
    defaultHeight: 100
  },
  {
    id: 'gks_skorlari',
    name: 'GKS (Glasgow)',
    icon: AlertCircle,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    fields: [
      { field_id: 'motor', label: 'Motor Yanıt' },
      { field_id: 'verbal', label: 'Verbal Yanıt' },
      { field_id: 'goz', label: 'Göz Açma' },
      { field_id: 'toplam', label: 'Toplam Skor' }
    ],
    defaultWidth: 180,
    defaultHeight: 80
  },
  {
    id: 'anamnez',
    name: 'Anamnez/Şikayet',
    icon: FileText,
    color: 'bg-teal-100 text-teal-700 border-teal-300',
    fields: [
      { field_id: 'sikayet', label: 'Başvuru Şikayeti' },
      { field_id: 'oyku', label: 'Öykü' },
      { field_id: 'kronik', label: 'Kronik Hastalıklar' }
    ],
    defaultWidth: 280,
    defaultHeight: 100
  },
  {
    id: 'fizik_muayene',
    name: 'Fizik Muayene',
    icon: Stethoscope,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    fields: [
      { field_id: 'muayene', label: 'Fizik Muayene Bulguları' }
    ],
    defaultWidth: 280,
    defaultHeight: 100
  },
  {
    id: 'uygulanan_islemler',
    name: 'Uygulanan İşlemler',
    icon: Settings,
    color: 'bg-violet-100 text-violet-700 border-violet-300',
    fields: [
      { field_id: 'maske', label: 'Maske ile hava yolu' },
      { field_id: 'airway', label: 'Airway' },
      { field_id: 'entubasyon', label: 'Entübasyon' },
      { field_id: 'lma', label: 'LMA' },
      { field_id: 'cpr', label: 'CPR' },
      { field_id: 'defib', label: 'Defibrilasyon' },
      { field_id: 'diger', label: 'Diğer işlemler' }
    ],
    defaultWidth: 280,
    defaultHeight: 120
  },
  {
    id: 'cpr_bilgileri',
    name: 'CPR Bilgileri',
    icon: Heart,
    color: 'bg-pink-100 text-pink-700 border-pink-300',
    fields: [
      { field_id: 'uygulayan', label: 'CPR Uygulayan' },
      { field_id: 'baslangic', label: 'CPR Başlangıç' },
      { field_id: 'bitis', label: 'CPR Bitiş' },
      { field_id: 'neden', label: 'CPR Nedeni' }
    ],
    defaultWidth: 200,
    defaultHeight: 80
  },
  {
    id: 'nakil_durumu',
    name: 'Nakil Durumu',
    icon: Truck,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    fields: [
      { field_id: 'nakil_tipi', label: 'Nakil Tipi' },
      { field_id: 'transfer_tipi', label: 'Transfer Tipi' }
    ],
    defaultWidth: 180,
    defaultHeight: 60
  },
  {
    id: 'nakil_hastanesi',
    name: 'Nakil Hastanesi',
    icon: MapPin,
    color: 'bg-lime-100 text-lime-700 border-lime-300',
    fields: [
      { field_id: 'hastane', label: 'Hastane Adı' },
      { field_id: 'protokol', label: 'Hastane Protokol No' }
    ],
    defaultWidth: 200,
    defaultHeight: 60
  },
  {
    id: 'healmedy_lokasyonu',
    name: 'Healmedy Lokasyonu',
    icon: MapPin,
    color: 'bg-sky-100 text-sky-700 border-sky-300',
    fields: [
      { field_id: 'lokasyon', label: 'Lokasyon' }
    ],
    defaultWidth: 180,
    defaultHeight: 50
  },
  {
    id: 'arac_bilgileri',
    name: 'Araç Bilgileri',
    icon: Truck,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    fields: [
      { field_id: 'plaka', label: 'Plaka' },
      { field_id: 'baslangic_km', label: 'Başlangıç KM' },
      { field_id: 'bitis_km', label: 'Bitiş KM' },
      { field_id: 'protokol_112', label: '112 Protokol No' }
    ],
    defaultWidth: 200,
    defaultHeight: 80
  },
  {
    id: 'ekip_bilgileri',
    name: 'Ekip Bilgileri',
    icon: Users,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    fields: [
      { field_id: 'sofor', label: 'Şoför' },
      { field_id: 'paramedik', label: 'Paramedik' },
      { field_id: 'att', label: 'ATT' },
      { field_id: 'hemsire', label: 'Hemşire' }
    ],
    defaultWidth: 200,
    defaultHeight: 80
  },
  {
    id: 'kullanilan_ilaclar',
    name: 'Kullanılan İlaçlar',
    icon: Pill,
    color: 'bg-green-100 text-green-700 border-green-300',
    fields: [
      { field_id: 'ilac_adi', label: 'İlaç Adı' },
      { field_id: 'doz', label: 'Doz' },
      { field_id: 'yol', label: 'Uygulama Yolu' },
      { field_id: 'saat', label: 'Saat' }
    ],
    defaultWidth: 280,
    defaultHeight: 100
  },
  {
    id: 'kullanilan_malzemeler',
    name: 'Kullanılan Malzemeler',
    icon: Package,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    fields: [
      { field_id: 'malzeme', label: 'Malzeme Listesi' }
    ],
    defaultWidth: 200,
    defaultHeight: 80
  },
  {
    id: 'tani_icd10',
    name: 'Tanı (ICD-10)',
    icon: FileText,
    color: 'bg-rose-100 text-rose-700 border-rose-300',
    fields: [
      { field_id: 'icd_kod', label: 'ICD-10 Kodu' },
      { field_id: 'tani', label: 'Tanı Açıklaması' }
    ],
    defaultWidth: 200,
    defaultHeight: 60
  },
  {
    id: 'imza_hasta',
    name: 'İmza - Hasta/Yakını',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: [
      { field_id: 'ad_soyad', label: 'Ad Soyad' },
      { field_id: 'imza', label: 'İmza' }
    ],
    defaultWidth: 150,
    defaultHeight: 80
  },
  {
    id: 'imza_doktor',
    name: 'İmza - Doktor/Paramedik',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: [
      { field_id: 'ad_soyad', label: 'Ad Soyad' },
      { field_id: 'imza', label: 'İmza' }
    ],
    defaultWidth: 150,
    defaultHeight: 80
  },
  {
    id: 'imza_saglik_personeli',
    name: 'İmza - Sağlık Personeli',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: [
      { field_id: 'ad_soyad', label: 'Ad Soyad' },
      { field_id: 'imza', label: 'İmza' }
    ],
    defaultWidth: 150,
    defaultHeight: 80
  },
  {
    id: 'imza_sofor',
    name: 'İmza - Şoför/Pilot',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: [
      { field_id: 'ad_soyad', label: 'Ad Soyad' },
      { field_id: 'imza', label: 'İmza' }
    ],
    defaultWidth: 150,
    defaultHeight: 80
  },
  {
    id: 'imza_teslim_alan',
    name: 'İmza - Teslim Alan',
    icon: PenTool,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    fields: [
      { field_id: 'ad_soyad', label: 'Ad Soyad' },
      { field_id: 'imza', label: 'İmza' }
    ],
    defaultWidth: 150,
    defaultHeight: 80
  },
  {
    id: 'adli_vaka',
    name: 'Adli Vaka',
    icon: AlertCircle,
    color: 'bg-red-100 text-red-700 border-red-300',
    fields: [
      { field_id: 'adli', label: 'Adli Vaka mı?' }
    ],
    defaultWidth: 120,
    defaultHeight: 50
  },
  {
    id: 'vaka_sonucu',
    name: 'Vaka Sonucu',
    icon: FileText,
    color: 'bg-green-100 text-green-700 border-green-300',
    fields: [
      { field_id: 'sonuc', label: 'Sonuç Açıklaması' }
    ],
    defaultWidth: 200,
    defaultHeight: 60
  },
  {
    id: 'genel_notlar',
    name: 'Genel Notlar',
    icon: FileText,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    fields: [
      { field_id: 'notlar', label: 'Serbest not alanı' }
    ],
    defaultWidth: 280,
    defaultHeight: 100
  },
  {
    id: 'logo_baslik',
    name: 'Logo/Başlık',
    icon: Camera,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    fields: [
      { field_id: 'logo', label: 'Logo' },
      { field_id: 'baslik', label: 'Form Başlığı' },
      { field_id: 'alt_baslik', label: 'Alt Başlık' }
    ],
    defaultWidth: 300,
    defaultHeight: 60
  }
];

const PdfTemplateEditor = () => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const canvasRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [draggedBlockDef, setDraggedBlockDef] = useState(null);
  
  // Şablon verisi
  const [template, setTemplate] = useState({
    name: 'Yeni PDF Şablonu',
    description: '',
    template_type: 'pdf',
    page_count: 1,
    page_size: 'A4',
    orientation: 'portrait',
    header: { enabled: true, height: 50, text: 'VAKA FORMU' },
    footer: { enabled: true, height: 30, text: 'Healmedy Sağlık Hizmetleri' },
    blocks: [],
    usage_types: ['vaka_formu'],
    is_default: false
  });

  useEffect(() => {
    if (templateId && templateId !== 'new') {
      loadTemplate(templateId);
    } else {
      setLoading(false);
    }
  }, [templateId]);

  const loadTemplate = async (id) => {
    try {
      const response = await formTemplatesAPI.getById(id);
      setTemplate(response.data);
    } catch (error) {
      console.error('Şablon yüklenemedi:', error);
      toast.error('Şablon yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!template.name.trim()) {
      toast.error('Şablon adı gerekli');
      return;
    }

    setSaving(true);
    try {
      if (templateId && templateId !== 'new') {
        await formTemplatesAPI.update(templateId, template);
        toast.success('Şablon güncellendi');
      } else {
        const response = await formTemplatesAPI.create(template);
        toast.success('Şablon oluşturuldu');
        navigate(`/dashboard/form-templates/pdf/${response.data.id}`);
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  // Kutucuk sürükle-bırak
  const handleDragStart = (blockDef) => {
    setDraggedBlockDef(blockDef);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    if (!draggedBlockDef) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / SCALE;
    const y = (e.clientY - rect.top) / SCALE;
    
    const newBlock = {
      id: `block_${Date.now()}`,
      block_type: draggedBlockDef.id,
      title: draggedBlockDef.name,
      color: draggedBlockDef.color,
      x: Math.max(10, Math.min(x - 50, A4_WIDTH - draggedBlockDef.defaultWidth - 10)),
      y: Math.max(10, Math.min(y - 20, A4_HEIGHT - draggedBlockDef.defaultHeight - 10)),
      width: draggedBlockDef.defaultWidth,
      height: draggedBlockDef.defaultHeight,
      page: currentPage,
      fields: draggedBlockDef.fields.map((f, i) => ({ ...f, visible: true, order: i })),
      show_border: true,
      show_title: true,
      font_size: 9
    };
    
    setTemplate(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
    
    setDraggedBlockDef(null);
    toast.success(`${draggedBlockDef.name} eklendi`);
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
  };

  // Kutucuk seçimi
  const handleBlockClick = (e, block) => {
    e.stopPropagation();
    setSelectedBlock(block.id);
  };

  // Kutucuğu sil
  const deleteBlock = (blockId) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId)
    }));
    setSelectedBlock(null);
    toast.success('Kutucuk silindi');
  };

  // Kutucuk taşıma
  const handleBlockDrag = (e, block) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const onMouseMove = (moveEvent) => {
      const x = (moveEvent.clientX - rect.left) / SCALE - block.width / 2;
      const y = (moveEvent.clientY - rect.top) / SCALE - block.height / 2;
      
      setTemplate(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => 
          b.id === block.id ? { 
            ...b, 
            x: Math.max(0, Math.min(x, A4_WIDTH - b.width)),
            y: Math.max(0, Math.min(y, A4_HEIGHT - b.height))
          } : b
        )
      }));
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Kutucuk boyutlandırma
  const handleBlockResize = (e, block, direction) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = block.width;
    const startHeight = block.height;
    
    const onMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / SCALE;
      const deltaY = (moveEvent.clientY - startY) / SCALE;
      
      setTemplate(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => {
          if (b.id !== block.id) return b;
          return {
            ...b,
            width: Math.max(80, startWidth + deltaX),
            height: Math.max(40, startHeight + deltaY)
          };
        })
      }));
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Alan görünürlüğü
  const toggleFieldVisibility = (blockId, fieldId) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          fields: b.fields.map(f => 
            f.field_id === fieldId ? { ...f, visible: !f.visible } : f
          )
        };
      })
    }));
  };

  const moveFieldUp = (blockId, fieldIndex) => {
    if (fieldIndex === 0) return;
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        const fields = [...b.fields];
        [fields[fieldIndex - 1], fields[fieldIndex]] = [fields[fieldIndex], fields[fieldIndex - 1]];
        return { ...b, fields };
      })
    }));
  };

  const moveFieldDown = (blockId, fieldIndex) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        if (fieldIndex >= b.fields.length - 1) return b;
        const fields = [...b.fields];
        [fields[fieldIndex], fields[fieldIndex + 1]] = [fields[fieldIndex + 1], fields[fieldIndex]];
        return { ...b, fields };
      })
    }));
  };

  const selectedBlockData = template.blocks.find(b => b.id === selectedBlock);
  const currentPageBlocks = template.blocks.filter(b => b.page === currentPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard/form-templates')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Geri
          </Button>
          <div>
            <Input
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 p-0 h-auto"
              placeholder="Şablon adı..."
            />
            <p className="text-xs text-gray-500">PDF Şablon Editörü - Serbest Yerleştirme</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-4 w-4 mr-1" /> Ayarlar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sol Panel - Kutucuklar */}
        <div className="w-72 bg-white border-r overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <GripVertical className="h-4 w-4" /> Hazır Kutucuklar
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Kutucukları sayfaya sürükleyin
            </p>
            
            <div className="space-y-2">
              {BLOCK_DEFINITIONS.map((block) => {
                const Icon = block.icon;
                const isUsed = template.blocks.some(b => b.block_type === block.id);
                
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => handleDragStart(block)}
                    className={`p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all ${block.color} ${
                      isUsed ? 'opacity-50' : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 opacity-50" />
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{block.name}</span>
                      {isUsed && <Badge className="ml-auto text-xs">Eklendi</Badge>}
                    </div>
                    <div className="mt-1 text-xs opacity-70">
                      {block.fields.slice(0, 3).map(f => f.label).join(', ')}
                      {block.fields.length > 3 && ` +${block.fields.length - 3}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Merkez - Canvas */}
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center bg-gray-200">
          <div 
            ref={canvasRef}
            className="bg-white shadow-xl relative"
            style={{ 
              width: A4_WIDTH * SCALE,
              height: A4_HEIGHT * SCALE
            }}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onClick={() => setSelectedBlock(null)}
          >
            {/* Header */}
            {template.header.enabled && (
              <div 
                className="bg-gray-800 text-white flex items-center justify-center font-bold absolute top-0 left-0 right-0"
                style={{ height: template.header.height * SCALE }}
              >
                {template.header.text || 'BAŞLIK'}
              </div>
            )}
            
            {/* Blocks */}
            {currentPageBlocks.map((block) => {
              const blockDef = BLOCK_DEFINITIONS.find(b => b.id === block.block_type);
              const Icon = blockDef?.icon || FileText;
              const isSelected = selectedBlock === block.id;
              
              return (
                <div
                  key={block.id}
                  className={`absolute border-2 rounded overflow-hidden cursor-move ${
                    block.color || 'bg-gray-50 border-gray-300'
                  } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  style={{
                    left: block.x * SCALE,
                    top: block.y * SCALE + (template.header.enabled ? template.header.height * SCALE : 0),
                    width: block.width * SCALE,
                    height: block.height * SCALE
                  }}
                  onClick={(e) => handleBlockClick(e, block)}
                  onMouseDown={(e) => handleBlockDrag(e, block)}
                >
                  {/* Block Header */}
                  {block.show_title !== false && (
                    <div className="px-2 py-1 border-b flex items-center gap-1 bg-white/50">
                      <Icon className="h-3 w-3" />
                      <span className="font-semibold text-xs truncate">{block.title}</span>
                    </div>
                  )}
                  
                  {/* Block Content */}
                  <div className="p-1 text-[8px] leading-tight opacity-80 overflow-hidden">
                    {block.fields?.filter(f => f.visible !== false).slice(0, 6).map(f => f.label).join(' | ')}
                  </div>
                  
                  {/* Resize Handle */}
                  <div 
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-blue-500 opacity-0 hover:opacity-100"
                    onMouseDown={(e) => handleBlockResize(e, block, 'se')}
                  />
                  
                  {/* Delete Button */}
                  {isSelected && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute -top-3 -right-3 h-6 w-6 p-0 rounded-full"
                      onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
            
            {/* Footer */}
            {template.footer.enabled && (
              <div 
                className="bg-gray-100 text-gray-600 flex items-center justify-center text-xs absolute bottom-0 left-0 right-0"
                style={{ height: template.footer.height * SCALE }}
              >
                {template.footer.text || 'Alt bilgi'}
              </div>
            )}
            
            {/* Grid Lines */}
            <svg className="absolute inset-0 pointer-events-none opacity-10" width="100%" height="100%">
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="gray" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        {/* Sağ Panel - Seçili Blok Ayarları */}
        <div className="w-64 bg-white border-l p-4 overflow-y-auto">
          {selectedBlockData ? (
            <>
              <h3 className="font-semibold text-gray-700 mb-4">{selectedBlockData.title}</h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Genişlik</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedBlockData.width)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 100;
                      setTemplate(prev => ({
                        ...prev,
                        blocks: prev.blocks.map(b => 
                          b.id === selectedBlockData.id ? { ...b, width: val } : b
                        )
                      }));
                    }}
                    className="h-8"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Yükseklik</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedBlockData.height)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 50;
                      setTemplate(prev => ({
                        ...prev,
                        blocks: prev.blocks.map(b => 
                          b.id === selectedBlockData.id ? { ...b, height: val } : b
                        )
                      }));
                    }}
                    className="h-8"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Başlık Göster</Label>
                  <Switch
                    checked={selectedBlockData.show_title !== false}
                    onCheckedChange={(v) => {
                      setTemplate(prev => ({
                        ...prev,
                        blocks: prev.blocks.map(b => 
                          b.id === selectedBlockData.id ? { ...b, show_title: v } : b
                        )
                      }));
                    }}
                  />
                </div>
                
                <div className="border-t pt-4">
                  <Label className="text-xs mb-2 block">Alanlar</Label>
                  <div className="space-y-1">
                    {selectedBlockData.fields?.map((field, idx) => (
                      <div key={field.field_id} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={field.visible !== false}
                          onChange={() => toggleFieldVisibility(selectedBlockData.id, field.field_id)}
                          className="h-3 w-3"
                        />
                        <span className="flex-1 truncate">{field.label}</span>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => moveFieldUp(selectedBlockData.id, idx)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => moveFieldDown(selectedBlockData.id, idx)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full"
                  onClick={() => deleteBlock(selectedBlockData.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Sil
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <Move className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Düzenlemek için bir kutucuk seçin</p>
            </div>
          )}
          
          <div className="border-t mt-4 pt-4">
            <Label className="text-xs text-gray-500">Eklenen Kutucuklar</Label>
            <div className="mt-2 space-y-1">
              {template.blocks.length === 0 ? (
                <p className="text-xs text-gray-400">Henüz kutucuk eklenmedi</p>
              ) : (
                template.blocks.map(b => (
                  <div 
                    key={b.id} 
                    className={`text-xs px-2 py-1 rounded cursor-pointer ${
                      selectedBlock === b.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-50'
                    }`}
                    onClick={() => setSelectedBlock(b.id)}
                  >
                    {b.title}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ayarlar Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Şablon Ayarları</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Şablon Adı</Label>
              <Input
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea
                value={template.description}
                onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Başlık Metni</Label>
              <Input
                value={template.header.text}
                onChange={(e) => setTemplate({ 
                  ...template, 
                  header: { ...template.header, text: e.target.value } 
                })}
              />
            </div>
            <div>
              <Label>Alt Bilgi</Label>
              <Input
                value={template.footer.text}
                onChange={(e) => setTemplate({ 
                  ...template, 
                  footer: { ...template.footer, text: e.target.value } 
                })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Varsayılan Şablon</Label>
              <Switch
                checked={template.is_default}
                onCheckedChange={(v) => setTemplate({ ...template, is_default: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PdfTemplateEditor;
