import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI, vehiclesAPI, approvalsAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { toast } from 'sonner';
import { 
  Clock, 
  CheckCircle, 
  Truck, 
  User, 
  Phone, 
  Send, 
  Shield, 
  Loader2,
  AlertTriangle,
  FileText,
  Camera,
  Sparkles,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  RefreshCw
} from 'lucide-react';
import PhotoCapture from '../components/PhotoCapture';
import SignaturePad from '../components/SignaturePad';
import DailyControlFormNonTimed from '../components/forms/DailyControlFormNonTimed';

const ShiftEnd = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Sonraki vardiya görevlisi
  const [nextShiftUser, setNextShiftUser] = useState(null);
  
  // Devir teslim form verileri
  const [formData, setFormData] = useState({
    teslimEttigimKm: '',
    fosforluYelek: '',
    takviyeKablosu: '',
    cekmeKablosu: '',
    ucgen: '',
    ruhsatVar: '',
    anahtarVar: '',
    teslimEdenNotlar: '',
    hasarBildirimi: '',
    devralanImza: null,
    devralanAdi: ''
  });
  
  // Onay durumları - Buton bazlı sistem (kod yok)
  const [managerApproved, setManagerApproved] = useState(false);
  const [sendingApproval, setSendingApproval] = useState(false);
  const [approvalRequestSent, setApprovalRequestSent] = useState(false);
  const [approvalRequestId, setApprovalRequestId] = useState(null);
  const [checkingApproval, setCheckingApproval] = useState(false);
  
  // Form zamanları (log için)
  const [formOpenedAt] = useState(new Date().toISOString());
  
  // YENİ: Hızlı doldurma ve 4 köşe fotoğraf (ATT/Paramedik için)
  const [quickCheckout, setQuickCheckout] = useState(false);
  const [endPhotos, setEndPhotos] = useState({
    rear_cabin_corner_1: null, // Sol-ön köşe
    rear_cabin_corner_2: null, // Sağ-ön köşe
    rear_cabin_corner_3: null, // Sol-arka köşe
    rear_cabin_corner_4: null  // Sağ-arka köşe
  });
  const [endSignature, setEndSignature] = useState(null);
  
  // Günlük kontrol formu (vardiya bitirme için)
  const [dailyControlData, setDailyControlData] = useState({});
  
  // Rol kontrolü
  const isATTOrParamedik = ['att', 'paramedik'].includes(user?.role?.toLowerCase());
  const isDriver = user?.role?.toLowerCase() === 'sofor';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Aktif vardiya bilgisi
      const shiftRes = await shiftsAPI.getActive();
      
      if (!shiftRes.data) {
        toast.error('Aktif vardiya bulunamadı');
        navigate('/dashboard/shifts');
        return;
      }

      setActiveShift(shiftRes.data);

      // Araç bilgisi - vehicle_id varsa çek
      const vehicleId = shiftRes.data.vehicle_id;
      if (vehicleId) {
        try {
          const vehicleRes = await vehiclesAPI.getById(vehicleId);
          if (vehicleRes.data) {
            setVehicle(vehicleRes.data);
            
            // Form verilerini otomatik doldur
            setFormData(prev => ({
              ...prev,
              teslimAlinanKm: vehicleRes.data?.km || shiftRes.data.start_km || '',
              servisYapilacakKm: vehicleRes.data?.next_maintenance_km || ''
            }));
          }
        } catch (err) {
          console.log('Araç bilgisi yüklenemedi:', err.message);
        }

        // Sonraki vardiya görevlisini bul
        try {
          const nextUserRes = await approvalsAPI.getNextShiftUser(vehicleId);
          if (nextUserRes.data?.found) {
            setNextShiftUser(nextUserRes.data.user);
          }
        } catch (err) {
          console.log('Sonraki vardiya görevlisi bulunamadı:', err.message);
        }
      } else {
        console.log('Vehicle ID bulunamadı, araç bilgisi çekilemedi');
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Vardiya bilgileri yüklenemedi');
      navigate('/dashboard/shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Yönetici onayı iste (buton bazlı sistem - kod yok)
  const requestManagerApproval = async () => {
    if (!activeShift?.id) {
      toast.error('Aktif vardiya bulunamadı');
      return;
    }
    
    setSendingApproval(true);
    try {
      const response = await shiftsAPI.endApprovalRequest({
        shift_id: activeShift.id,
        vehicle_id: activeShift.vehicle_id,
        vehicle_plate: vehicle?.plate,
        end_km: formData.teslimEttigimKm,
        devralan_adi: formData.devralanAdi,
        form_opened_at: formOpenedAt,
        request_sent_at: new Date().toISOString()
      });
      
      setApprovalRequestSent(true);
      setApprovalRequestId(response.data?.request_id);
      toast.success('✅ Vardiya bitirme onayı Baş Şoför/Operasyon Müdürüne gönderildi');
    } catch (error) {
      console.error('Approval request error:', error);
      toast.error(error.response?.data?.detail || 'Onay isteği gönderilemedi');
    } finally {
      setSendingApproval(false);
    }
  };

  // Onay durumunu kontrol et
  const checkApprovalStatus = useCallback(async () => {
    if (!approvalRequestId) return;
    
    setCheckingApproval(true);
    try {
      const response = await shiftsAPI.getPendingShiftApprovals();
      const myRequest = response.data?.find(r => r.id === approvalRequestId);
      
      if (myRequest?.status === 'approved') {
        setManagerApproved(true);
        toast.success('🎉 Yönetici onayı alındı!');
      } else if (myRequest?.status === 'rejected') {
        toast.error('❌ Yönetici onayı reddedildi');
        setApprovalRequestSent(false);
        setApprovalRequestId(null);
      }
    } catch (error) {
      console.error('Onay durumu kontrol hatası:', error);
    } finally {
      setCheckingApproval(false);
    }
  }, [approvalRequestId]);

  // Onay durumunu periyodik kontrol
  useEffect(() => {
    if (approvalRequestSent && !managerApproved) {
      const interval = setInterval(checkApprovalStatus, 5000); // 5 saniyede bir kontrol
      return () => clearInterval(interval);
    }
  }, [approvalRequestSent, managerApproved, checkApprovalStatus]);

  const handleEndShift = async () => {
    if (!activeShift) return;

    // ATT/Paramedik için fotoğraf kontrolü
    if (isATTOrParamedik) {
      const photoCount = Object.values(endPhotos).filter(Boolean).length;
      if (photoCount < 4) {
        toast.error(`Lütfen 4 köşe fotoğrafını çekin (${photoCount}/4)`);
        return;
      }
    }
    
    // Devralan imza kontrolü kaldırıldı - opsiyonel
    // Vardiya devir olmadan da bitirilebilir
    
    // Onay kontrolü kaldırıldı - direkt bitirebilir
    // if (!managerApproved) {
    //   toast.error('Yönetici onayı gerekli. Lütfen önce onay isteyin.');
    //   return;
    // }

    if (!confirm('Vardiyayı bitirmek istediğinizden emin misiniz?')) return;

    setSubmitting(true);
    try {
      // Form açılma ve işlem zamanlarını logla
      const actionTakenAt = new Date().toISOString();
      
      await shiftsAPI.end({
        shift_id: activeShift.id,
        handover_form: {
          ...formData,
          aracPlakasi: vehicle?.plate,
          kayitTarihi: new Date().toISOString().split('T')[0],
          kayitSaati: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          teslimEden: user?.name,
          teslimAlan: formData.devralanAdi || nextShiftUser?.name || 'Bilinmiyor',
          managerApproved,
          form_opened_at: formOpenedAt, // Form açılma zamanı
          action_taken_at: actionTakenAt // İşlem zamanı
        },
        notes: formData.teslimEdenNotlar,
        // Form zamanları (log için)
        form_opened_at: formOpenedAt,
        form_completed_at: new Date().toISOString(),
        // ATT/Paramedik için ek alanlar
        quick_checkout: quickCheckout,
        end_photos: isATTOrParamedik ? endPhotos : null,
        end_signature: isATTOrParamedik ? endSignature : null,
        // Şoför için ek alanlar
        devralan_imza: isDriver ? formData.devralanImza : null
      });

      toast.success('🎉 Vardiya başarıyla sonlandırıldı!');
      navigate('/dashboard/shifts');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Vardiya sonlandırılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const duration = activeShift ? Math.floor((new Date() - new Date(activeShift.start_time)) / 1000 / 60) : 0;

  return (
    <div className="space-y-6" data-testid="shift-end-page">
      <div>
        <h1 className="text-3xl font-bold">Vardiya Bitir</h1>
        <p className="text-gray-500">Devir teslim işlemini tamamlayın</p>
      </div>

      {/* Aktif Vardiya Bilgileri */}
      <Card className="border-blue-500 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span>Aktif Vardiya</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Araç</p>
              <p className="font-bold text-lg">{vehicle?.plate}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Başlangıç</p>
              <p className="font-medium">{new Date(activeShift.start_time).toLocaleString('tr-TR')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Süre</p>
              <p className="font-medium">{Math.floor(duration / 60)} saat {duration % 60} dk</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">KM</p>
              <p className="font-medium">{vehicle?.km?.toLocaleString()} km</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Araç Bilgileri ve KM */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Araç Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teslim Ettiğim KM</Label>
            <Input 
              type="number"
              value={formData.teslimEttigimKm}
              onChange={(e) => handleFormChange('teslimEttigimKm', e.target.value)}
              placeholder="Aracın güncel KM değeri"
              className="text-lg font-medium"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ekipman Kontrol */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ekipman Kontrolü
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'fosforluYelek', label: 'Fosforlu Yelek (3 Adet)' },
            { key: 'takviyeKablosu', label: 'Takviye Kablosu' },
            { key: 'cekmeKablosu', label: 'Çekme Kablosu' },
            { key: 'ucgen', label: 'Üçgen (1 Adet)' }
          ].map(item => (
            <div key={item.key} className="flex justify-between items-center py-2 border-b">
              <Label className="text-sm">{item.label}</Label>
              <RadioGroup 
                value={formData[item.key]} 
                onValueChange={(v) => handleFormChange(item.key, v)}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id={`${item.key}-var`} />
                  <Label htmlFor={`${item.key}-var`} className="text-xs">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id={`${item.key}-yok`} />
                  <Label htmlFor={`${item.key}-yok`} className="text-xs">Yok</Label>
                </div>
              </RadioGroup>
            </div>
          ))}
          
          {/* Ruhsat ve Anahtar Kontrol */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Araç Evrakları</h4>
            {[
              { key: 'ruhsatVar', label: 'Araç Ruhsatı' },
              { key: 'anahtarVar', label: 'Araç Anahtarı' }
            ].map(item => (
              <div key={item.key} className="flex justify-between items-center py-2 border-b">
                <Label className="text-sm font-medium">{item.label}</Label>
                <RadioGroup 
                  value={formData[item.key]} 
                  onValueChange={(v) => handleFormChange(item.key, v)}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="var" id={`${item.key}-var`} />
                    <Label htmlFor={`${item.key}-var`} className="text-xs text-green-700 font-medium">Var ✓</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yok" id={`${item.key}-yok`} />
                    <Label htmlFor={`${item.key}-yok`} className="text-xs text-red-700 font-medium">Yok ✗</Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Devralan Kişi İmzası (Yeni gelen kişi) */}
      {isDriver && (
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" />
              Devralan Kişi Bilgileri
            </CardTitle>
            <CardDescription>
              Aracı teslim alan yeni şoförün bilgileri ve imzası
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Devralan Kişinin Adı Soyadı</Label>
              <Input 
                value={formData.devralanAdi}
                onChange={(e) => handleFormChange('devralanAdi', e.target.value)}
                placeholder="Yeni şoförün adı soyadı"
              />
            </div>
            <div className="space-y-2">
              <Label>Devralan Kişinin İmzası</Label>
              <SignaturePad 
                onSave={(signature) => handleFormChange('devralanImza', signature)}
                label="Devralan imzası"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ATT/Paramedik için Hızlı Doldurma */}
      {isATTOrParamedik && (
        <Card className={`border-2 ${quickCheckout ? 'border-green-500 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className={`h-5 w-5 ${quickCheckout ? 'text-green-600' : 'text-amber-600'}`} />
              Hızlı Doldurma
            </CardTitle>
            <CardDescription>
              Her şey başlangıçtaki gibi temiz ve çalışıyor ise bu seçeneği işaretleyin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant={quickCheckout ? 'default' : 'outline'}
              className={`w-full h-16 text-lg ${quickCheckout ? 'bg-green-600 hover:bg-green-700' : ''}`}
              onClick={() => {
                setQuickCheckout(!quickCheckout);
                if (!quickCheckout) {
                  // Tüm ekipmanları otomatik "var" olarak işaretle
                  setFormData(prev => ({
                    ...prev,
                    fosforluYelek: 'var',
                    takviyeKablosu: 'var',
                    cekmeKablosu: 'var',
                    ucgen: 'var'
                  }));
                  toast.success('✨ Tüm alanlar otomatik dolduruldu!');
                }
              }}
            >
              {quickCheckout ? (
                <>
                  <CheckCircle className="h-6 w-6 mr-2" />
                  ✓ Her şey aldığım gibi çalışıyor ve temiz
                </>
              ) : (
                <>
                  <Sparkles className="h-6 w-6 mr-2" />
                  Her şey aldığım gibi çalışıyor ve temiz
                </>
              )}
            </Button>
            {quickCheckout && (
              <p className="text-sm text-green-600 text-center">
                Ekipman kontrolü ve hasar bildirimi atlandı
              </p>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* ATT/Paramedik için Günlük Kontrol Formu (Timer'sız) */}
      {isATTOrParamedik && !quickCheckout && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ambulans Günlük Kontrol Formu
            </CardTitle>
            <CardDescription>
              Vardiya bitirmeden önce cihaz, malzeme ve ilaç kontrolü yapın
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DailyControlFormNonTimed 
              formData={dailyControlData}
              onChange={setDailyControlData}
              onQuickFill={(data) => {
                setDailyControlData(data);
                setQuickCheckout(true);
              }}
            />
          </CardContent>
        </Card>
      )}
      
      {/* ATT/Paramedik için 4 Köşe Arka Kabin Fotoğrafları */}
      {isATTOrParamedik && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Arka Kabin Fotoğrafları (4 Köşe)
            </CardTitle>
            <CardDescription>
              Arka kabinin 4 köşesinden fotoğraf çekin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <div className="absolute top-2 left-2 z-10 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                  <CornerUpLeft className="h-4 w-4" /> Sol-Ön
                </div>
                <PhotoCapture 
                  title="Sol-Ön Köşe" 
                  onPhotoCapture={(p) => setEndPhotos(prev => ({ ...prev, rear_cabin_corner_1: p }))}
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute top-2 left-2 z-10 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                  <CornerUpRight className="h-4 w-4" /> Sağ-Ön
                </div>
                <PhotoCapture 
                  title="Sağ-Ön Köşe" 
                  onPhotoCapture={(p) => setEndPhotos(prev => ({ ...prev, rear_cabin_corner_2: p }))}
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute top-2 left-2 z-10 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                  <CornerDownLeft className="h-4 w-4" /> Sol-Arka
                </div>
                <PhotoCapture 
                  title="Sol-Arka Köşe" 
                  onPhotoCapture={(p) => setEndPhotos(prev => ({ ...prev, rear_cabin_corner_3: p }))}
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute top-2 left-2 z-10 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                  <CornerDownRight className="h-4 w-4" /> Sağ-Arka
                </div>
                <PhotoCapture 
                  title="Sağ-Arka Köşe" 
                  onPhotoCapture={(p) => setEndPhotos(prev => ({ ...prev, rear_cabin_corner_4: p }))}
                  required
                />
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className={`text-sm ${Object.values(endPhotos).filter(Boolean).length === 4 ? 'text-green-600' : 'text-amber-600'}`}>
                {Object.values(endPhotos).filter(Boolean).length}/4 fotoğraf çekildi
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notlar */}
      <Card>
        <CardHeader>
          <CardTitle>Notlar ve Hasar Bildirimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vardiya Notları</Label>
            <Textarea 
              value={formData.teslimEdenNotlar}
              onChange={(e) => handleFormChange('teslimEdenNotlar', e.target.value)}
              placeholder="Vardiya sırasında yaşanan durumlar..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Hasar Bildirimi</Label>
            <Textarea 
              value={formData.hasarBildirimi}
              onChange={(e) => handleFormChange('hasarBildirimi', e.target.value)}
              placeholder="Tespit edilen hasarlar, arızalar..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Teslim Eden (Mevcut Kullanıcı) + İmza */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="text-green-700">✍️ Teslim Eden (Siz)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profile_photo} />
              <AvatarFallback className="bg-green-100 text-green-700 text-xl">
                {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold text-lg">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.role}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          {/* İmza Alanı */}
          {isATTOrParamedik && (
            <div className="border-t pt-4">
              <SignaturePad 
                label="Vardiya Bitirme İmzası"
                required
                onSignatureChange={(sig) => setEndSignature(sig)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bilgilendirme */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-700">
            <CheckCircle className="h-5 w-5 inline mr-2" />
            Vardiya Bitirme
          </CardTitle>
          <CardDescription>
            Vardiyayı bitirebilirsiniz. Onay kaydı otomatik olarak oluşturulacak ve yöneticiye bildirilecektir.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Özet ve Bitiş */}
      <Card className="border-green-500 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Toplam süre: {Math.floor(duration / 60)} saat {duration % 60} dakika
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard/shifts')}
              >
                İptal
              </Button>
              <Button
                onClick={handleEndShift}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
                data-testid="end-shift-button"
              >
                {submitting ? 'Bitiriliyor...' : 'Vardiyayı Bitir'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftEnd;
