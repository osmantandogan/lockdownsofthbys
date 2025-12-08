import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Camera, X, Check, Upload, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

const PhotoCapture = ({ title, onPhotoCapture, required = false, initialPhoto = null }) => {
  const [photo, setPhoto] = useState(initialPhoto);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null); // Mobil için doğrudan kamera açan input

  // Mobil cihaz kontrolü
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update photo when initialPhoto changes
  useEffect(() => {
    if (initialPhoto) {
      setPhoto(initialPhoto);
    }
  }, [initialPhoto]);

  const checkCameraSupport = () => {
    // Check if we're on HTTPS or localhost
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      return { supported: false, reason: 'Kamera için HTTPS bağlantısı gerekli. Dosya yükleyebilirsiniz.' };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { supported: false, reason: 'Tarayıcınız kamera erişimini desteklemiyor. Dosya yükleyebilirsiniz.' };
    }

    return { supported: true };
  };

  const startCamera = async () => {
    const check = checkCameraSupport();
    if (!check.supported) {
      setCameraError(check.reason);
      toast.error(check.reason);
      return;
    }

    setCameraLoading(true);
    setCameraError(null);

    try {
      // Try back camera first, then any camera
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch {
        // Fallback to any available camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = resolve;
          videoRef.current.onerror = reject;
          setTimeout(reject, 5000); // 5 second timeout
        });
        
        await videoRef.current.play();
      }
      
      setShowCamera(true);
    } catch (error) {
      console.error('Camera error:', error);
      
      let errorMessage = 'Kamera açılamadı. ';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Kamera izni reddedildi. Tarayıcı ayarlarından izin verin veya dosya yükleyin.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'Kamera bulunamadı. Dosya yükleyebilirsiniz.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Kamera gereksinimleri karşılanamadı.';
      } else {
        errorMessage += 'Dosya yükleyerek devam edebilirsiniz.';
      }
      
      setCameraError(errorMessage);
      toast.error(errorMessage);
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Ensure video has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        toast.error('Video henüz hazır değil, lütfen tekrar deneyin');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const photoData = canvas.toDataURL('image/jpeg', 0.7);
      setPhoto(photoData);
      onPhotoCapture(photoData);
      stopCamera();
      toast.success('Fotoğraf çekildi!');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir resim dosyası seçin');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB\'dan küçük olmalıdır');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const photoData = e.target?.result;
      if (photoData) {
        setPhoto(photoData);
        onPhotoCapture(photoData);
        toast.success('Fotoğraf yüklendi!');
      }
    };
    reader.onerror = () => {
      toast.error('Dosya okunamadı');
    };
    reader.readAsDataURL(file);
    
    // Reset input
    event.target.value = '';
  };

  const removePhoto = () => {
    setPhoto(null);
    onPhotoCapture(null);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const openCameraDialog = () => {
    cameraInputRef.current?.click();
  };

  // Mobil için doğrudan kamera açma
  const handleMobileCameraClick = () => {
    if (isMobile) {
      // Mobilde doğrudan kamera input'unu aç
      openCameraDialog();
    } else {
      // Desktop'ta web kamerasını başlat
      startCamera();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {photo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={removePhoto}
            className="text-red-600 hover:text-red-700"
          >
            <X className="h-4 w-4 mr-1" />
            Sil
          </Button>
        )}
      </div>
      
      {/* Hidden file input for gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      {/* Hidden camera input for mobile - directly opens camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      {!photo ? (
        <div>
          {!showCamera ? (
            <div className="space-y-2">
              {cameraError && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
              
              <div className="flex gap-2">
                {/* Ana kamera butonu - mobilde doğrudan kamera açar */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMobileCameraClick}
                  className="flex-1"
                  disabled={cameraLoading}
                >
                  {cameraLoading ? (
                    <>
                      <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Kamera Açılıyor...
                    </>
                  ) : (
                    <>
                      {isMobile ? <Smartphone className="h-4 w-4 mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                      {isMobile ? 'Kamerayla Çek' : 'Fotoğraf Çek'}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openFileDialog}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Yükle
                </Button>
              </div>
              
              {/* Mobil için alternatif butonlar */}
              {isMobile && (
                <p className="text-xs text-gray-500 text-center">
                  📱 Kamera açılmazsa "Yükle" butonuyla galeriden seçebilirsiniz
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={cameraLoading}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Çek
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCamera}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border-2 border-green-500">
          <img src={photo} alt={title} className="w-full h-48 object-cover" />
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center">
            <Check className="h-3 w-3 mr-1" />
            Çekildi
          </div>
        </div>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default PhotoCapture;
