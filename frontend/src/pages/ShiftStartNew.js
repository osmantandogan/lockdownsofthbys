import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import PhotoCapture from '../components/PhotoCapture';
import DailyControlFormFull from '../components/forms/DailyControlFormFull';
import { QrCode, Camera, CheckCircle, AlertCircle } from 'lucide-react';

const ShiftStartNew = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState('');
  const [scanner, setScanner] = useState(null);
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

  const startQRScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await html5QrCode.stop();
          setQrCode(decodedText);
          setStep(2);
          toast.success('QR kod okundu!');
        }
      );
    } catch (err) {
      console.error('QR error:', err);
      toast.error('Kamera açılamadı');
    }
  };

  const stopQRScanner = async () => {
    if (scanner) {
      try {
        await scanner.stop();
      } catch (err) {
        console.error('Stop error:', err);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopQRScanner();
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
            <CardTitle>Araç QR Kodunu Okutun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div id="qr-reader" className="w-full"></div>
            <Button onClick={startQRScanner} className="w-full">
              <QrCode className="h-4 w-4 mr-2" />
              QR Okuyucuyu Başlat
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
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
                <span>QR Kod: {qrCode.substring(0, 20)}...</span>
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
