import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI, vehiclesAPI, approvalsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import PhotoCapture from '../components/PhotoCapture';
import DailyControlFormFull from '../components/forms/DailyControlFormFull';
import DailyControlFormForDriver from '../components/forms/DailyControlFormForDriver';
import TimedDailyControlForm from '../components/forms/TimedDailyControlForm';
import HandoverFormFull from '../components/forms/HandoverFormFull';
import { useAuth } from '../contexts/AuthContext';
import { QrCode, Camera, CheckCircle, AlertCircle, Truck, Keyboard, XCircle, Loader2, Shield, Send, Clock, User } from 'lucide-react';

// Türkiye saati yardımcı fonksiyonu (UTC+3)
const getTurkeyTime = () => {
  const now = new Date();
  // Türkiye saatini hesapla (UTC+3)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3 * 60 * 60 * 1000));
};

const formatTurkeyDate = (date) => {
  const d = date || getTurkeyTime();
  // YYYY-MM-DD formatında döndür (toISOString yerine manuel)
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTurkeyTime = (date) => {
  const d = date || getTurkeyTime();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const formatTurkeyDateTime = (date) => {
  const d = date || getTurkeyTime();
  return `${formatTurkeyDate(d)} ${formatTurkeyTime(d)}`;
};

const ShiftStartNew = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  const scannerRef = useRef(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualQrInput, setManualQrInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [validating, setValidating] = useState(false);
  const [photos, setPhotos] = useState({
    front: null,           // Ön Taraf
    back: null,            // Arka Taraf
    left: null,            // Sol Taraf
    right: null,           // Sağ Taraf
    rear_cabin_open: null, // Arka kapılar açık - Arka kabin (eski trunk)
    interior: null,        // İç Kabin
    engine: null,          // Kaput içi motor
    left_door_open: null,  // Sol kapı açık
    right_door_open: null, // Sağ kapı açık
    front_cabin: null,     // Ön kabin
    front_cabin_seats_back: null, // Ön kabin koltuk arkası
    damages: []
  });
  const [controlForm, setControlForm] = useState({});
  const [handoverForm, setHandoverForm] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Devir teslim için önceki vardiya bilgileri
  const [previousShiftInfo, setPreviousShiftInfo] = useState(null);
  
  // Form doldurma kontrolü
  const [isFirstPersonInShift, setIsFirstPersonInShift] = useState(true); // İlk giren mi?
  const [isDriverDuty, setIsDriverDuty] = useState(false); // Şoför görevi var mı?
  const [formAlreadyFilled, setFormAlreadyFilled] = useState(false); // Form zaten doldurulmuş mu?
  
  // Baş Şoför Onay Sistemi (Yeni - Sayfa Bazlı)
  const [approvalId, setApprovalId] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState(null); // null, 'pending', 'approved', 'rejected'
  const [sendingApproval, setSendingApproval] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  
  // Form açılma zamanı (log için)
  const [formOpenedAt] = useState(new Date().toISOString());
  
  // Türkiye saati (UTC+3)
  const [turkeyNow, setTurkeyNow] = useState(getTurkeyTime());

  // QR okutunca araç ve atama kontrolü yap
  const validateVehicleAssignment = async (qr) => {
    setValidating(true);
    try {
      // 1. Araç bilgisini bul
      const vehiclesRes = await vehiclesAPI.getAll();
      const vehicle = vehiclesRes.data?.find(v => v.qr_code === qr);
      
      if (!vehicle) {
        toast.error('Bu QR koduna ait araç bulunamadı');
        setValidating(false);
        return null;
      }

      // 2. Kullanıcının bugün bu araca atanmış mı kontrol et - Backend'den direkt kontrol
      // Shift başlatmayı dene - backend kontrol edecek
      // Ama önce sadece kontrol için bir "dry-run" yapalım
      
      // Kullanıcının atamalarını kontrol et
      const myAssignments = await shiftsAPI.getMyAssignments();
      
      // Türkiye saatine göre bugünün tarihi (UTC+3)
      const turkeyTime = getTurkeyTime();
      const today = formatTurkeyDate(turkeyTime);
      
      // Dün (tolerans için)
      const yesterdayTime = new Date(turkeyTime.getTime() - 24 * 60 * 60 * 1000);
      const yesterday = formatTurkeyDate(yesterdayTime);
      
      // State'i güncelle
      setTurkeyNow(turkeyTime);
      
      const vehicleId = vehicle._id || vehicle.id;
      
      console.log('=== VARDİYA ATAMA KONTROLÜ ===');
      console.log('Bugün (TR):', today);
      console.log('Dün (TR):', yesterday);
      console.log('Şu an (TR):', formatTurkeyDateTime(turkeyTime));
      console.log('Aranan araç ID:', vehicleId);
      console.log('Tüm atamalar:', myAssignments.data);
      
      // Bugün VEYA dün için geçerli atama var mı? (vardiya gece yarısını geçebilir)
      const todayAssignment = myAssignments.data?.find(assignment => {
        const shiftDate = assignment.shift_date?.split('T')[0];
        const endDate = assignment.end_date?.split('T')[0] || shiftDate;
        
        // Atama bugün için mi veya dün başlayıp bugüne sarkan mı?
        const isValidForToday = shiftDate <= today && endDate >= today;
        const isValidForYesterday = shiftDate <= yesterday && endDate >= yesterday;
        
        // Araç ID karşılaştırması - farklı formatları destekle
        const vehicleId = vehicle._id || vehicle.id;
        const assignmentVehicleId = assignment.vehicle_id;
        const isMatchingVehicle = 
          assignmentVehicleId === vehicleId || 
          String(assignmentVehicleId) === String(vehicleId);
        
        const isPending = assignment.status === 'pending';
        
        console.log(`Atama kontrolü: ${shiftDate} - ${endDate}`);
        console.log(`  Araç ID (araç): ${vehicleId}`);
        console.log(`  Araç ID (atama): ${assignmentVehicleId}`);
        console.log(`  Araç eşleşme: ${isMatchingVehicle}`);
        console.log(`  Bugün geçerli: ${isValidForToday}`);
        console.log(`  Dün geçerli: ${isValidForYesterday}`);
        console.log(`  Durum: ${assignment.status} (pending: ${isPending})`);
        
        return isMatchingVehicle && (isValidForToday || isValidForYesterday) && isPending;
      });

      if (!todayAssignment) {
        // Debug: Neden eşleşmedi?
        console.log('=== ATAMA BULUNAMADI - DEBUG ===');
        console.log('Aranan araç:', vehicle);
        console.log('Tüm atamalar:', myAssignments.data);
        
        const vehicleId = vehicle._id || vehicle.id;
        
        // 1. Bu araç için STARTED (zaten başlatılmış) atama var mı?
        const startedAssignment = myAssignments.data?.find(a => {
          const aVehicleId = a.vehicle_id;
          const shiftDate = a.shift_date?.split('T')[0];
          const endDate = a.end_date?.split('T')[0] || shiftDate;
          const isValidDate = (shiftDate <= today && endDate >= today) || 
                              (shiftDate <= yesterday && endDate >= yesterday);
          return (aVehicleId === vehicleId || String(aVehicleId) === String(vehicleId)) && 
                 a.status === 'started' && isValidDate;
        });
        
        if (startedAssignment) {
          console.log('BU ARAÇ İÇİN ZATEN AKTİF VARDİYA VAR:', startedAssignment);
          toast.error(
            `⚠️ Bu araç için zaten aktif bir vardiya var!\n\n` +
            `Önce mevcut vardiyayı bitirin, sonra yeni vardiya başlatabilirsiniz.`,
            { duration: 8000 }
          );
          setValidating(false);
          return null;
        }
        
        // 2. Bu araç için COMPLETED (tamamlanmış) atama var mı?
        const completedAssignment = myAssignments.data?.find(a => {
          const aVehicleId = a.vehicle_id;
          const shiftDate = a.shift_date?.split('T')[0];
          const endDate = a.end_date?.split('T')[0] || shiftDate;
          const isValidDate = (shiftDate <= today && endDate >= today);
          return (aVehicleId === vehicleId || String(aVehicleId) === String(vehicleId)) && 
                 a.status === 'completed' && isValidDate;
        });
        
        if (completedAssignment) {
          console.log('BU ARAÇ İÇİN ATAMA TAMAMLANMIŞ:', completedAssignment);
          toast.error(
            `✓ Bugünkü vardiyanız tamamlanmış!\n\n` +
            `Yeni vardiya için yöneticinizden yeni atama alın.`,
            { duration: 8000 }
          );
          setValidating(false);
          return null;
        }
        
        // 3. Tarihe bakmadan sadece araç ve pending status kontrolü yap
        const sameVehicleAssignment = myAssignments.data?.find(a => {
          const aVehicleId = a.vehicle_id;
          return (aVehicleId === vehicleId || String(aVehicleId) === String(vehicleId)) && 
                 a.status === 'pending';
        });
        
        if (sameVehicleAssignment) {
          // Aynı araç için atama var ama tarih uymuyor
          console.log('AYNI ARAÇ İÇİN ATAMA VAR AMA TARİH UYMUYOR:', sameVehicleAssignment);
          const shiftDate = sameVehicleAssignment.shift_date?.split('T')[0];
          const endDate = sameVehicleAssignment.end_date?.split('T')[0] || shiftDate;
          toast.error(
            `❌ Bu araç için atamanız var ama tarih uymuyor!\n\n` +
            `Atama tarihi: ${shiftDate} - ${endDate}\n` +
            `Bugün (TR): ${today}`,
            { duration: 8000 }
          );
          setValidating(false);
          return null;
        }
        
        // 4. Bu araca atanmamış, hangi araca atanmış göster
        const userTodayAssignment = myAssignments.data?.find(assignment => {
          const shiftDate = assignment.shift_date?.split('T')[0];
          const endDate = assignment.end_date?.split('T')[0] || shiftDate;
          const isValidDate = (shiftDate <= today && endDate >= today) || 
                              (shiftDate <= yesterday && endDate >= yesterday);
          return isValidDate && assignment.status === 'pending';
        });

        if (userTodayAssignment) {
          toast.error(
            `❌ Bu araç (${vehicle.plate}) size atanmamış!\n\n` +
            `Bugün için atanan aracınız: ${userTodayAssignment.vehicle_plate || 'Bilinmiyor'}`,
            { duration: 5000 }
          );
        } else {
          toast.error('Bugün için vardiya atamanız bulunmuyor. Lütfen yöneticinizle iletişime geçin.');
        }
        setValidating(false);
        return null;
      }

      // 3. Her şey OK
      setVehicleInfo(vehicle);
      setAssignmentInfo(todayAssignment);
      
      // Şoför görevi kontrolü (atamadan al)
      setIsDriverDuty(todayAssignment.is_driver_duty || false);
      
      // TODO: İlk giren kontrolü yapılacak (backend'den form durumu sorgulanacak)
      // Şimdilik her zaman form doldurtuyoruz
      setIsFirstPersonInShift(true);
      setFormAlreadyFilled(false);
      
      setValidating(false);
      return { vehicle, assignment: todayAssignment };

    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Araç kontrolü yapılamadı');
      setValidating(false);
      return null;
    }
  };

  const startQRScanner = async () => {
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      toast.error('QR tarayıcı için HTTPS bağlantısı gerekli. Manuel giriş yapabilirsiniz.');
      setShowManualInput(true);
      return;
    }

    await stopQRScanner();

    try {
      const qrReaderElement = document.getElementById('qr-reader');
      if (!qrReaderElement) {
        console.error('QR reader element not found');
        toast.error('QR okuyucu elementi bulunamadı');
        return;
      }

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;
      setScannerActive(true);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          try {
            if (scannerRef.current) {
              await scannerRef.current.stop();
              scannerRef.current = null;
            }
          } catch (e) {
            console.log('Scanner stop in callback:', e);
          }
          setScannerActive(false);
          setQrCode(decodedText);
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Araç ve atama kontrolü yap
          const result = await validateVehicleAssignment(decodedText);
          if (result) {
            const userRole = user?.role?.toLowerCase();
            const hasDriverDuty = result.assignment?.is_driver_duty || false;
            
            // Şoför veya şoför görevi olan ATT/Paramedik: Fotoğraf çekecek
            // Şoför görevi olmayan ATT/Paramedik/Hemşire: Direkt forma geçecek
            if (userRole === 'sofor' || hasDriverDuty) {
              setStep(2); // Fotoğraf çekme adımı
              toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Fotoğraf çekin.`);
            } else if (['att', 'paramedik', 'hemsire'].includes(userRole)) {
              setStep(3); // Direkt günlük kontrol formuna
              toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Formu doldurun.`);
            } else {
              setStep(2); // Diğer roller için fotoğraf
              toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Devam edebilirsiniz.`);
            }
          }
        }
      );
    } catch (err) {
      console.error('QR error:', err);
      setScannerActive(false);
      scannerRef.current = null;
      
      let errorMsg = 'Kamera açılamadı. ';
      if (err.name === 'NotAllowedError') {
        errorMsg += 'Kamera izni verilmedi.';
      } else if (err.name === 'NotFoundError') {
        errorMsg += 'Kamera bulunamadı.';
      } else {
        errorMsg += 'Manuel giriş yapabilirsiniz.';
      }
      
      toast.error(errorMsg);
      setShowManualInput(true);
    }
  };

  const handleManualQrSubmit = async () => {
    if (!manualQrInput.trim()) {
      toast.error('QR kodu girin');
      return;
    }
    
    setQrCode(manualQrInput.trim());
    const result = await validateVehicleAssignment(manualQrInput.trim());
    if (result) {
      const userRole = user?.role?.toLowerCase();
      const hasDriverDuty = result.assignment?.is_driver_duty || false;
      
      // Şoför veya şoför görevi olan: Fotoğraf çekecek
      // Şoför görevi olmayan ATT/Paramedik/Hemşire: Direkt forma geçecek
      if (userRole === 'sofor' || hasDriverDuty) {
        setStep(2);
        toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Fotoğraf çekin.`);
      } else if (['att', 'paramedik', 'hemsire'].includes(userRole)) {
        setStep(3);
        toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Formu doldurun.`);
      } else {
        setStep(2);
        toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Devam edebilirsiniz.`);
      }
    }
  };

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
          console.log('Scanner stopped successfully');
        }
      } catch (err) {
        console.log('Stop scanner (may be already stopped):', err.message);
      } finally {
        scannerRef.current = null;
        setScannerActive(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {}
        scannerRef.current = null;
      }
    };
  }, []);
  
  // Önceki vardiya bilgilerini çek (araç seçildiğinde)
  useEffect(() => {
    const fetchPreviousShift = async () => {
      if (!vehicleInfo?._id) return;
      
      try {
        // Bu araç için son aktif/tamamlanmış vardiyayı getir
        const response = await approvalsAPI.getHandoverInfo(vehicleInfo._id || vehicleInfo.id);
        if (response.data?.giver) {
          setPreviousShiftInfo({
            user_name: response.data.giver.name,
            phone: response.data.giver.phone,
            email: response.data.giver.email
          });
        }
      } catch (error) {
        console.log('Önceki vardiya bilgisi bulunamadı (normal olabilir)');
      }
    };
    
    fetchPreviousShift();
  }, [vehicleInfo]);
  
  // Türkiye saatini her saniye güncelle
  useEffect(() => {
    const timer = setInterval(() => {
      setTurkeyNow(getTurkeyTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePhotoUpdate = (key, value) => {
    setPhotos(prev => ({ ...prev, [key]: value }));
  };

  const addDamagePhoto = (photo) => {
    setPhotos(prev => ({
      ...prev,
      damages: [...prev.damages, photo]
    }));
  };

  const removeDamagePhoto = (index) => {
    setPhotos(prev => ({
      ...prev,
      damages: prev.damages.filter((_, i) => i !== index)
    }));
  };

  const photosComplete = () => {
    // 11 zorunlu fotoğraf kontrolü
    return photos.front && 
           photos.back && 
           photos.left && 
           photos.right && 
           photos.rear_cabin_open &&  // Arka kapılar açık - arka kabin
           photos.interior &&         // İç kabin
           photos.engine &&           // Kaput içi motor
           photos.left_door_open &&   // Sol kapı açık
           photos.right_door_open &&  // Sağ kapı açık
           photos.front_cabin &&      // Ön kabin
           photos.front_cabin_seats_back;  // Ön kabin koltuk arkası
  };

  // Vardiya başlatma onayı iste (Sayfa bazlı - shift-approvals'a düşer)
  const handleRequestApproval = async () => {
    const vehicleId = vehicleInfo?._id || vehicleInfo?.id;
    if (!vehicleId) {
      console.error('Vehicle info:', vehicleInfo);
      toast.error('Araç bilgisi bulunamadı - lütfen QR kodunu tekrar okutun');
      return;
    }
    
    setSendingApproval(true);
    try {
      // Rol tipini belirle
      const roleType = ['att', 'paramedik', 'hemsire'].includes(user?.role?.toLowerCase()) ? 'medical' : 'driver';
      
      const response = await shiftsAPI.requestStartApproval({
        vehicle_id: vehicleId,
        role_type: roleType,
        daily_control_data: controlForm,
        photos: photos
      });
      
      setApprovalId(response.data.id);
      setApprovalStatus('pending');
      toast.success('✅ Onay talebi gönderildi! Yönetici onayı bekleniyor...');
    } catch (error) {
      console.error('Approval request error:', error);
      toast.error(error.response?.data?.detail || 'Onay talebi gönderilemedi');
    } finally {
      setSendingApproval(false);
    }
  };
  
  // Onay durumunu kontrol et
  const handleCheckApproval = async () => {
    if (!approvalId) return;
    
    setCheckingApproval(true);
    try {
      const response = await shiftsAPI.checkStartApproval(approvalId);
      
      if (response.data?.status === 'approved') {
        setApprovalStatus('approved');
        toast.success('✅ Vardiya onaylandı! Şimdi başlatabilirsiniz.');
      } else if (response.data?.status === 'rejected') {
        setApprovalStatus('rejected');
        toast.error(`❌ Onay reddedildi: ${response.data?.rejection_reason || 'Sebep belirtilmedi'}`);
      } else {
        toast.info('⏳ Onay henüz beklemede...');
      }
    } catch (error) {
      console.error('Check approval error:', error);
      toast.error('Onay durumu kontrol edilemedi');
    } finally {
      setCheckingApproval(false);
    }
  };
  
  // Onay durumunu periyodik kontrol et
  useEffect(() => {
    if (approvalId && approvalStatus === 'pending') {
      const interval = setInterval(handleCheckApproval, 5000); // 5 saniyede bir kontrol
      return () => clearInterval(interval);
    }
  }, [approvalId, approvalStatus]);

  const handleStartShift = async () => {
    // ATT/Paramedik/Hemşire (şoför görevi yoksa) fotoğraf çekmiyor
    const userRole = user?.role?.toLowerCase();
    const requiresPhotos = userRole === 'sofor' || isDriverDuty || !['att', 'paramedik', 'hemsire'].includes(userRole);
    
    if (requiresPhotos && !photosComplete()) {
      toast.error('Lütfen tüm zorunlu fotoğrafları çekin');
      return;
    }
    
    // Onay kontrolü kaldırıldı - direkt başlatabilir
    // if (approvalStatus !== 'approved') {
    //   toast.error('Yönetici onayı gerekli');
    //   return;
    // }

    setLoading(true);
    try {
      // Form açılma zamanını logla
      const formOpenedAt = new Date().toISOString();
      
      await shiftsAPI.start({
        vehicle_qr: qrCode,
        photos: photos,
        daily_control: controlForm,
        approval_id: approvalId, // Onay ID'sini gönder (varsa)
        form_opened_at: formOpenedAt, // Form açılma zamanı
        action_taken_at: new Date().toISOString() // İşlem zamanı
      });
      toast.success('🎉 Vardiya başarıyla başlatıldı!');
      navigate('/dashboard/shifts');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Vardiya başlatılamadı');
    } finally {
      setLoading(false);
    }
  };

  const progress = step === 1 ? 0 : step === 2 ? 33 : step === 3 ? 66 : 100;

  // ATT/Paramedik/Hemşire (şoför görevi yoksa): 3 adım, diğerleri 4 adım
  const userRole = user?.role?.toLowerCase();
  const needsPhotos = userRole === 'sofor' || isDriverDuty || !['att', 'paramedik', 'hemsire'].includes(userRole);
  const totalSteps = needsPhotos ? 4 : 3;
  const currentStepDisplay = needsPhotos ? step : (step === 1 ? 1 : step === 3 ? 2 : 3);

  return (
    <div className="space-y-6" data-testid="shift-start-page">
      <div>
        <h1 className="text-3xl font-bold">Vardiya Başlat</h1>
        <p className="text-gray-500">Adım {currentStepDisplay}/{totalSteps}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Progress value={progress} className="mb-2" />
          <p className="text-sm text-gray-500 text-center">
            {step === 1 && 'QR Kod Okutun'}
            {step === 2 && 'Araç Fotoğrafları (11 Zorunlu)'}
            {step === 3 && (userRole === 'sofor' || isDriverDuty ? 'Araç Devir + Günlük Kontrol Formu' : 'Ambulans Günlük Kontrol Formu')}
            {step === 4 && 'Onay ve Başlat'}
          </p>
        </CardContent>
      </Card>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Araç QR Kodunu Okutun
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {validating && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-blue-800">Araç ve atama kontrolü yapılıyor...</span>
              </div>
            )}

            {!showManualInput ? (
              <>
                <div className="w-full min-h-[300px] bg-gray-900 rounded-lg overflow-hidden relative">
                  <div 
                    id="qr-reader" 
                    className="w-full h-full"
                    style={{ 
                      minHeight: '300px',
                      display: scannerActive ? 'block' : 'none' 
                    }} 
                  />
                  
                  {!scannerActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <p className="text-gray-500 text-center p-4">
                        QR okuyucuyu başlatmak için aşağıdaki butona tıklayın
                      </p>
                    </div>
                  )}
                  
                  {scannerActive && (
                    <div className="absolute bottom-2 left-0 right-0 text-center">
                      <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                        📷 QR kodu çerçeveye getirin
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={startQRScanner} 
                    className="flex-1"
                    disabled={scannerActive || validating}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    {scannerActive ? 'Taranıyor...' : 'QR Okuyucuyu Başlat'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowManualInput(true)}
                    disabled={validating}
                  >
                    <Keyboard className="h-4 w-4 mr-2" />
                    Manuel
                  </Button>
                </div>
                {scannerActive && (
                  <Button variant="outline" onClick={stopQRScanner} className="w-full">
                    İptal
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    Kamera kullanılamıyorsa, araç üzerindeki QR kodunu manuel olarak girebilirsiniz.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>QR Kod</Label>
                  <Input
                    value={manualQrInput}
                    onChange={(e) => setManualQrInput(e.target.value)}
                    placeholder="QR kodunu girin..."
                    disabled={validating}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleManualQrSubmit} 
                    className="flex-1"
                    disabled={validating}
                  >
                    {validating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Kontrol ediliyor...</>
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-2" /> Onayla</>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowManualInput(false)}
                    disabled={validating}
                  >
                    QR Tara
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {step !== 1 && <div id="qr-reader" style={{ display: 'none' }} />}

      {step === 2 && (
        <div className="space-y-4">
          {vehicleInfo && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-lg text-green-900">{vehicleInfo.plate}</p>
                    <p className="text-sm text-green-700">{vehicleInfo.type} - Atama doğrulandı ✓</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Camera className="h-5 w-5" />
                <span>Araç Fotoğrafları</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-gray-600 mb-4">Toplam 11 zorunlu fotoğraf çekilmesi gerekmektedir.</p>
              
              {/* Dış Görünüm Fotoğrafları */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Dış Görünüm (4 Fotoğraf)</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <PhotoCapture title="Ön Taraf" onPhotoCapture={(p) => handlePhotoUpdate('front', p)} required />
                  <PhotoCapture title="Arka Taraf" onPhotoCapture={(p) => handlePhotoUpdate('back', p)} required />
                  <PhotoCapture title="Sol Taraf" onPhotoCapture={(p) => handlePhotoUpdate('left', p)} required />
                  <PhotoCapture title="Sağ Taraf" onPhotoCapture={(p) => handlePhotoUpdate('right', p)} required />
                </div>
              </div>

              {/* Kapı Fotoğrafları */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Kapılar Açık Halde (2 Fotoğraf)</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <PhotoCapture title="Sol Kapı Açık" onPhotoCapture={(p) => handlePhotoUpdate('left_door_open', p)} required />
                  <PhotoCapture title="Sağ Kapı Açık" onPhotoCapture={(p) => handlePhotoUpdate('right_door_open', p)} required />
                </div>
              </div>

              {/* Kabin Fotoğrafları */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Kabin Fotoğrafları (4 Fotoğraf)</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <PhotoCapture title="Ön Kabin" onPhotoCapture={(p) => handlePhotoUpdate('front_cabin', p)} required />
                  <PhotoCapture title="Ön Kabin Koltuk Arkası" onPhotoCapture={(p) => handlePhotoUpdate('front_cabin_seats_back', p)} required />
                  <PhotoCapture title="İç Kabin (Hasta Kabini)" onPhotoCapture={(p) => handlePhotoUpdate('interior', p)} required />
                  <PhotoCapture title="Arka Kapılar Açık - Arka Kabin" onPhotoCapture={(p) => handlePhotoUpdate('rear_cabin_open', p)} required />
                </div>
              </div>

              {/* Motor Fotoğrafı */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Motor (1 Fotoğraf)</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <PhotoCapture title="Kaput İçi Motor" onPhotoCapture={(p) => handlePhotoUpdate('engine', p)} required />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Hasar Fotoğrafları (Opsiyonel)</h3>
                <div className="space-y-4">
                  {photos.damages.map((photo, index) => (
                    <div key={index} className="relative">
                      <img src={photo} alt={`Hasar ${index + 1}`} className="w-full h-48 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => removeDamagePhoto(index)}
                      >
                        Sil
                      </Button>
                    </div>
                  ))}
                  <PhotoCapture title={`Hasar Fotoğrafı ${photos.damages.length + 1}`} onPhotoCapture={addDamagePhoto} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Geri</Button>
            <Button onClick={() => setStep(3)} disabled={!photosComplete()}>
              {photosComplete() ? 'Devam' : 'Tüm Fotoğrafları Çekin'}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {/* Debug: Kullanıcı rolü */}
          {console.log('Step 3 - User role:', user?.role, 'Is driver:', user?.role?.toLowerCase() === 'sofor')}
          
          {vehicleInfo && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-lg text-green-900">{vehicleInfo.plate}</p>
                    <p className="text-sm text-green-700">{vehicleInfo.type}</p>
                    <p className="text-xs text-green-600">Rol: {user?.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* ŞOFÖR İSE: Araç Günlük Kontrol ve Devir Alma Formu */}
          {user?.role?.toLowerCase() === 'sofor' && (
            <>
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-3">
                  <p className="text-amber-800 font-medium">
                    🚗 Şoför Vardiya Başlatma - Araç Kontrol ve Devir Alma
                  </p>
                  <p className="text-sm text-amber-600">
                    Aracı kontrol edin ve devir alın. Devir teslim işlemi vardiya bitişinde yapılacaktır.
                  </p>
                </CardContent>
              </Card>
              
              {/* Şoför için Araç Kontrol ve Devir Alma Formu */}
              <DailyControlFormForDriver 
                formData={controlForm} 
                onChange={setControlForm} 
                vehiclePlate={vehicleInfo?.plate}
              />
            </>
          )}
          
          {/* ATT / PARAMEDİK / HEMŞİRE İSE */}
          {['att', 'paramedik', 'hemsire'].includes(user?.role?.toLowerCase()) && (
            <>
              {/* Form zaten doldurulmuşsa bypass et */}
              {formAlreadyFilled ? (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <p className="text-green-800 font-medium">
                        Bu vardiya için formlar zaten doldurulmuş
                      </p>
                    </div>
                    <p className="text-sm text-green-600 mt-1">
                      Aynı vardiyada başka bir personel formu doldurduğu için direkt devam edebilirsiniz.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Şoför görevi varsa: Önce Devir Formu, sonra Günlük Kontrol */}
                  {isDriverDuty && (
                    <>
                      <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="py-3">
                          <p className="text-yellow-800 font-medium">
                            🚗 Şoför görevi atanmış - Araç Devir Formu
                          </p>
                          <p className="text-sm text-yellow-600">
                            Bu vardiyada şoför görevi de size verildiği için önce araç devir formunu doldurun.
                          </p>
                        </CardContent>
                      </Card>
                      <HandoverFormFull formData={handoverForm} onChange={setHandoverForm} vehiclePlate={vehicleInfo?.plate} />
                    </>
                  )}
                  
                  {/* Günlük Kontrol Formu (ATT/Paramedik için zaman kısıtlamalı) */}
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="py-3">
                      <p className="text-blue-800 font-medium">
                        🩺 Ambulans Cihaz, Malzeme ve İlaç Günlük Kontrol Formu
                      </p>
                      <p className="text-sm text-blue-600">
                        Her bölüm sırayla açılacak. Bölüm süreleri: 5dk, 1dk, 2dk, 1dk, 1dk, 1dk, 2dk
                      </p>
                    </CardContent>
                  </Card>
                  <TimedDailyControlForm 
                    formData={controlForm} 
                    onChange={setControlForm}
                    vehicleId={vehicleInfo?._id || vehicleInfo?.id}
                    onComplete={(data) => {
                      setControlForm(data);
                      toast.success('✅ Günlük kontrol formu tamamlandı!');
                    }}
                  />
                </>
              )}
            </>
          )}
          
          {/* Diğer roller için (merkez_ofis, operasyon_muduru vb.) - sadece basit form */}
          {!['sofor', 'att', 'paramedik', 'hemsire'].includes(user?.role?.toLowerCase()) && (
            <DailyControlFormFull formData={controlForm} onChange={setControlForm} />
          )}
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(needsPhotos ? 2 : 1)}>Geri</Button>
            {(() => {
              // Rol bazlı minimum kontrol sayısı
              const isDriver = user?.role?.toLowerCase() === 'sofor';
              const minChecks = isDriver ? 45 : 55; // Şoför: 52 madde, diğerleri: 60+ madde
              const checkCount = Object.keys(controlForm?.checks || {}).length;
              const isFormComplete = formAlreadyFilled || checkCount >= minChecks;
              
              return (
                <Button 
                  onClick={() => setStep(4)}
                  disabled={!isFormComplete}
                >
                  {!isFormComplete 
                    ? `Form tamamlanıyor... (${checkCount}/${minChecks}+)` 
                    : 'Devam'}
                </Button>
              );
            })()}
          </div>
        </div>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Vardiyayı Başlat - Baş Şoför Onayı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Özet Bilgiler */}
            <div className="space-y-3 pb-4 border-b">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">
                    Araç: {vehicleInfo?.plate || 'Bilinmiyor'}
                  </span>
                  {vehicleInfo?.type && (
                    <span className="text-sm text-gray-500">({vehicleInfo.type})</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Fotoğraflar: 6 zorunlu + {photos.damages.length} hasar</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Günlük kontrol formu dolduruldu</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <span>Tarih/Saat (TR): {formatTurkeyDateTime()}</span>
              </div>
            </div>

            {/* Bilgilendirme */}
            <Card className="border-2 border-blue-300 bg-blue-50">
              <CardHeader className="py-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  Vardiya Başlatma Onayı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">
                    ✅ Vardiyayı başlatabilirsiniz. Onay kaydı otomatik olarak oluşturulacak ve yöneticiye bildirilecektir.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(3)}>Geri</Button>
              <Button
                onClick={handleStartShift}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
                data-testid="confirm-start-button"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Başlatılıyor...</>
                ) : (
                  'Vardiyayı Başlat'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShiftStartNew;
