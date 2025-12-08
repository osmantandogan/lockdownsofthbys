import React, { useState, useEffect } from 'react';
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
import { QrCode, Camera, CheckCircle, AlertCircle, Truck, Keyboard } from 'lucide-react';

const ShiftStartNew = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const scannerRef = React.useRef(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualQrInput, setManualQrInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
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

  // Fetch vehicle info when QR code is scanned
  const fetchVehicleInfo = async (qr) => {
    try {
      const vehicles = await vehiclesAPI.getAll();
      const vehicle = vehicles.data?.find(v => v.qr_code === qr);
      if (vehicle) {
        setVehicleInfo(vehicle);
        return vehicle;
      } else {
        toast.error('Bu QR koduna ait araç bulunamadı');
        return null;
      }
    } catch (error) {
      console.error('Vehicle fetch error:', error);
      return null;
    }
  };

  const startQRScanner = async () => {
    // Check if HTTPS or localhost
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      toast.error('QR tarayıcı için HTTPS bağlantısı gerekli. Manuel giriş yapabilirsiniz.');
      setShowManualInput(true);
      return;
    }

    // Önce mevcut scanner'ı durdur
    await stopQRScanner();

    try {
      // DOM elementi var mı kontrol et
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
          // Scanner'ı durdur
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
          
          // Fetch vehicle info
          const vehicle = await fetchVehicleInfo(decodedText);
          if (vehicle) {
            setStep(2);
            toast.success(`${vehicle.plate} aracı bulundu!`);
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
    const vehicle = await fetchVehicleInfo(manualQrInput.trim());
    if (vehicle) {
      setStep(2);
      toast.success(`${vehicle.plate} aracı bulundu!`);
    }
  };

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // State: NOT_STARTED = 1, SCANNING = 2, PAUSED = 3
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
          console.log('Scanner stopped successfully');
        }
      } catch (err) {
        // Scanner zaten durmuş olabilir, ignore
        console.log('Stop scanner (may be already stopped):', err.message);
      } finally {
        scannerRef.current = null;
        setScannerActive(false);
      }
    }
  };

  // Component unmount olduğunda scanner'ı durdur
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {
          // Ignore
        }
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
      toast.success('Vardiya başlatıldı!');
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
            {!showManualInput ? (
              <>
                <div id="qr-reader" className="w-full min-h-[250px] bg-gray-100 rounded-lg flex items-center justify-center">
                  {!scannerActive && (
                    <p className="text-gray-500 text-center p-4">
                      QR okuyucuyu başlatmak için aşağıdaki butona tıklayın
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={startQRScanner} 
                    className="flex-1"
                    disabled={scannerActive}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    {scannerActive ? 'Taranıyor...' : 'QR Okuyucuyu Başlat'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowManualInput(true)}
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
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleManualQrSubmit} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Onayla
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowManualInput(false)}
                  >
                    QR Tara
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {/* Vehicle Info Banner */}
          {vehicleInfo && (
            <Card className="border-blue-500 bg-blue-50">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-bold text-lg text-blue-900">{vehicleInfo.plate}</p>
                    <p className="text-sm text-blue-700">{vehicleInfo.type}</p>
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
