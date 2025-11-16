import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import PhotoCapture from '../components/PhotoCapture';
import DailyControlForm from '../components/DailyControlForm';
import { QrCode, Camera, CheckCircle, AlertCircle } from 'lucide-react';

const ShiftStartNew = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: QR, 2: Photos, 3: Form, 4: Confirm
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

  const photosComplete = () => {\n    return photos.front && photos.back && photos.left && \n           photos.right && photos.trunk && photos.interior;\n  };

  const handleStartShift = async () => {\n    if (!photosComplete()) {\n      toast.error('Lütfen tüm zorunlu fotoğrafları çekin');\n      return;\n    }\n\n    setLoading(true);\n    try {\n      await shiftsAPI.start({\n        vehicle_qr: qrCode,\n        photos: photos,\n        daily_control: controlForm\n      });\n      toast.success('Vardiya başlatıldı!');\n      navigate('/dashboard/shifts');\n    } catch (error) {\n      console.error('Error:', error);\n      toast.error(error.response?.data?.detail || 'Vardiya başlatılamadı');\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const progress = step === 1 ? 0 : step === 2 ? 33 : step === 3 ? 66 : 100;\n\n  return (\n    <div className=\"space-y-6\" data-testid=\"shift-start-page\">\n      <div>\n        <h1 className=\"text-3xl font-bold\">Vardiya Başlat</h1>\n        <p className=\"text-gray-500\">Adım {step}/4</p>\n      </div>\n\n      <Card>\n        <CardContent className=\"pt-6\">\n          <Progress value={progress} className=\"mb-2\" />\n          <p className=\"text-sm text-gray-500 text-center\">\n            {step === 1 && 'QR Kod Okutun'}\n            {step === 2 && 'Araç Fotoğrafları (6 Zorunlu)'}\n            {step === 3 && 'Günlük Kontrol Formu'}\n            {step === 4 && 'Onay ve Başlat'}\n          </p>\n        </CardContent>\n      </Card>\n\n      {/* Step 1: QR Code */}\n      {step === 1 && (\n        <Card>\n          <CardHeader>\n            <CardTitle>Araç QR Kodunu Okutun</CardTitle>\n          </CardHeader>\n          <CardContent className=\"space-y-4\">\n            <div id=\"qr-reader\" className=\"w-full\"></div>\n            <Button onClick={startQRScanner} className=\"w-full\">\n              <QrCode className=\"h-4 w-4 mr-2\" />\n              QR Okuyucuyu Başlat\n            </Button>\n          </CardContent>\n        </Card>\n      )}\n\n      {/* Step 2: Photos */}\n      {step === 2 && (\n        <div className=\"space-y-4\">\n          <Card>\n            <CardHeader>\n              <CardTitle className=\"flex items-center space-x-2\">\n                <Camera className=\"h-5 w-5\" />\n                <span>Araç Fotoğrafları</span>\n              </CardTitle>\n            </CardHeader>\n            <CardContent className=\"space-y-6\">\n              <div className=\"grid gap-6 md:grid-cols-2\">\n                <PhotoCapture\n                  title=\"Ön Taraf\"\n                  onPhotoCapture={(p) => handlePhotoUpdate('front', p)}\n                  required\n                />\n                <PhotoCapture\n                  title=\"Arka Taraf\"\n                  onPhotoCapture={(p) => handlePhotoUpdate('back', p)}\n                  required\n                />\n                <PhotoCapture\n                  title=\"Sol Taraf\"\n                  onPhotoCapture={(p) => handlePhotoUpdate('left', p)}\n                  required\n                />\n                <PhotoCapture\n                  title=\"Sağ Taraf\"\n                  onPhotoCapture={(p) => handlePhotoUpdate('right', p)}\n                  required\n                />\n                <PhotoCapture\n                  title=\"Arka Bagaj\"\n                  onPhotoCapture={(p) => handlePhotoUpdate('trunk', p)}\n                  required\n                />\n                <PhotoCapture\n                  title=\"İç Kabin\"\n                  onPhotoCapture={(p) => handlePhotoUpdate('interior', p)}\n                  required\n                />\n              </div>\n\n              {/* Damage Photos */}\n              <div className=\"border-t pt-6\">\n                <h3 className=\"font-semibold mb-4\">Hasar Fotoğrafları (Opsiyonel)</h3>\n                <div className=\"space-y-4\">\n                  {photos.damages.map((photo, index) => (\n                    <div key={index} className=\"relative\">\n                      <img src={photo} alt={`Hasar ${index + 1}`} className=\"w-full h-48 object-cover rounded-lg\" />\n                      <Button\n                        type=\"button\"\n                        variant=\"destructive\"\n                        size=\"sm\"\n                        className=\"absolute top-2 right-2\"\n                        onClick={() => removeDamagePhoto(index)}\n                      >\n                        Sil\n                      </Button>\n                    </div>\n                  ))}\n                  <PhotoCapture\n                    title={`Hasar Fotoğrafı ${photos.damages.length + 1}`}\n                    onPhotoCapture={addDamagePhoto}\n                  />\n                </div>\n              </div>\n            </CardContent>\n          </Card>\n\n          <div className=\"flex justify-between\">\n            <Button variant=\"outline\" onClick={() => setStep(1)}>Geri</Button>\n            <Button onClick={() => setStep(3)} disabled={!photosComplete()}>\n              {photosComplete() ? 'Devam' : 'Tüm Fotoğrafları Çekin'}\n            </Button>\n          </div>\n        </div>\n      )}\n\n      {/* Step 3: Daily Control Form */}\n      {step === 3 && (\n        <div className=\"space-y-4\">\n          <DailyControlForm formData={controlForm} onChange={setControlForm} />\n          <div className=\"flex justify-between\">\n            <Button variant=\"outline\" onClick={() => setStep(2)}>Geri</Button>\n            <Button onClick={() => setStep(4)}>Devam</Button>\n          </div>\n        </div>\n      )}\n\n      {/* Step 4: Confirm */}\n      {step === 4 && (\n        <Card>\n          <CardHeader>\n            <CardTitle>Vardiyayı Başlat</CardTitle>\n          </CardHeader>\n          <CardContent className=\"space-y-4\">\n            <div className=\"space-y-3\">\n              <div className=\"flex items-center space-x-2\">\n                <CheckCircle className=\"h-5 w-5 text-green-600\" />\n                <span>QR Kod: {qrCode.substring(0, 20)}...</span>\n              </div>\n              <div className=\"flex items-center space-x-2\">\n                <CheckCircle className=\"h-5 w-5 text-green-600\" />\n                <span>Fotoğraflar: 6 zorunlu + {photos.damages.length} hasar</span>\n              </div>\n              <div className=\"flex items-center space-x-2\">\n                <CheckCircle className=\"h-5 w-5 text-green-600\" />\n                <span>Günlük kontrol formu dolduruldu</span>\n              </div>\n            </div>\n\n            <div className=\"border-t pt-4 space-y-2\">\n              <div className=\"flex items-start space-x-2 bg-yellow-50 p-4 rounded-lg\">\n                <AlertCircle className=\"h-5 w-5 text-yellow-600 mt-0.5\" />\n                <div className=\"text-sm\">\n                  <p className=\"font-medium text-yellow-900\">Vardiyayı başlatmak üzeresiniz</p>\n                  <p className=\"text-yellow-700\">Tüm kontrollerin tamamlandığından emin olun.</p>\n                </div>\n              </div>\n            </div>\n\n            <div className=\"flex justify-between\">\n              <Button variant=\"outline\" onClick={() => setStep(3)}>Geri</Button>\n              <Button\n                onClick={handleStartShift}\n                disabled={loading}\n                className=\"bg-green-600 hover:bg-green-700\"\n                data-testid=\"confirm-start-button\"\n              >\n                {loading ? 'Başlatılıyor...' : 'Vardiyayı Başlat'}\n              </Button>\n            </div>\n          </CardContent>\n        </Card>\n      )}\n    </div>\n  );\n};\n\nexport default ShiftStartNew;
