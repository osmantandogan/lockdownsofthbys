import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import PhotoCapture from '../components/PhotoCapture';
import DailyControlFormFull from '../components/forms/DailyControlFormFull';
import { QrCode, Camera, CheckCircle, AlertCircle, Truck, Keyboard, XCircle, Loader2 } from 'lucide-react';

const ShiftStartNew = () => {
  const navigate = useNavigate();
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
    front: null,
    back: null,
    left: null,
    right: null,
    trunk: null,
    interior: null,
    damages: []
  });
  const [controlForm, setControlForm] = useState({});
  const [loading, setLoading] = useState(false);

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
      const now = new Date();
      const turkeyOffset = 3 * 60; // UTC+3 dakika cinsinden
      const turkeyTime = new Date(now.getTime() + (turkeyOffset + now.getTimezoneOffset()) * 60000);
      const today = turkeyTime.toISOString().split('T')[0];
      
      // Dün (tolerans için)
      const yesterdayTime = new Date(turkeyTime.getTime() - 24 * 60 * 60 * 1000);
      const yesterday = yesterdayTime.toISOString().split('T')[0];
      
      console.log('=== VARDİYA ATAMA KONTROLÜ ===');
      console.log('Bugün (TR):', today);
      console.log('Dün (TR):', yesterday);
      console.log('Şu an (TR):', turkeyTime.toLocaleString('tr-TR'));
      console.log('Aranan araç ID:', vehicle._id);
      console.log('Tüm atamalar:', myAssignments.data);
      
      // Bugün VEYA dün için geçerli atama var mı? (vardiya gece yarısını geçebilir)
      const todayAssignment = myAssignments.data?.find(assignment => {
        const shiftDate = assignment.shift_date?.split('T')[0];
        const endDate = assignment.end_date?.split('T')[0] || shiftDate;
        
        // Atama bugün için mi veya dün başlayıp bugüne sarkan mı?
        const isValidForToday = shiftDate <= today && endDate >= today;
        const isValidForYesterday = shiftDate <= yesterday && endDate >= yesterday;
        const isMatchingVehicle = assignment.vehicle_id === vehicle._id;
        const isPending = assignment.status === 'pending';
        
        console.log(`Atama kontrolü: ${shiftDate} - ${endDate}`);
        console.log(`  Araç eşleşme: ${isMatchingVehicle} (${assignment.vehicle_id} === ${vehicle._id})`);
        console.log(`  Bugün geçerli: ${isValidForToday}`);
        console.log(`  Dün geçerli: ${isValidForYesterday}`);
        console.log(`  Durum: ${assignment.status} (pending: ${isPending})`);
        
        return isMatchingVehicle && (isValidForToday || isValidForYesterday) && isPending;
      });

      if (!todayAssignment) {
        // Bu araca atanmamış, hangi araca atanmış göster
        const userTodayAssignment = myAssignments.data?.find(assignment => {
          const shiftDate = assignment.shift_date?.split('T')[0];
          const endDate = assignment.end_date?.split('T')[0] || shiftDate;
          return shiftDate <= today && endDate >= today && assignment.status === 'pending';
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
            setStep(2);
            toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Devam edebilirsiniz.`);
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
      setStep(2);
      toast.success(`✅ ${result.vehicle.plate} aracı doğrulandı! Devam edebilirsiniz.`);
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
    return photos.front && photos.back && photos.left && photos.right && photos.trunk && photos.interior;
  };

  const handleStartShift = async () => {
    if (!photosComplete()) {
      toast.error('Lütfen tüm zorunlu fotoğrafları çekin');
      return;
    }

    setLoading(true);
    try {
      await shiftsAPI.start({
        vehicle_qr: qrCode,
        photos: photos,
        daily_control: controlForm
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

  return (
    <div className="space-y-6" data-testid="shift-start-page">
      <div>
        <h1 className="text-3xl font-bold">Vardiya Başlat</h1>
        <p className="text-gray-500">Adım {step}/4</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Progress value={progress} className="mb-2" />
          <p className="text-sm text-gray-500 text-center">
            {step === 1 && 'QR Kod Okutun'}
            {step === 2 && 'Araç Fotoğrafları (6 Zorunlu)'}
            {step === 3 && 'Günlük Kontrol Formu'}
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
              <div className="grid gap-6 md:grid-cols-2">
                <PhotoCapture title="Ön Taraf" onPhotoCapture={(p) => handlePhotoUpdate('front', p)} required />
                <PhotoCapture title="Arka Taraf" onPhotoCapture={(p) => handlePhotoUpdate('back', p)} required />
                <PhotoCapture title="Sol Taraf" onPhotoCapture={(p) => handlePhotoUpdate('left', p)} required />
                <PhotoCapture title="Sağ Taraf" onPhotoCapture={(p) => handlePhotoUpdate('right', p)} required />
                <PhotoCapture title="Arka Bagaj" onPhotoCapture={(p) => handlePhotoUpdate('trunk', p)} required />
                <PhotoCapture title="İç Kabin" onPhotoCapture={(p) => handlePhotoUpdate('interior', p)} required />
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
          {vehicleInfo && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-lg text-green-900">{vehicleInfo.plate}</p>
                    <p className="text-sm text-green-700">{vehicleInfo.type}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <DailyControlFormFull formData={controlForm} onChange={setControlForm} />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Geri</Button>
            <Button onClick={() => setStep(4)}>Devam</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Vardiyayı Başlat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
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
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-start space-x-2 bg-yellow-50 p-4 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">Vardiyayı başlatmak üzeresiniz</p>
                  <p className="text-yellow-700">Tüm kontrollerin tamamlandığından emin olun.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Geri</Button>
              <Button
                onClick={handleStartShift}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
                data-testid="confirm-start-button"
              >
                {loading ? 'Başlatılıyor...' : 'Vardiyayı Başlat'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShiftStartNew;
