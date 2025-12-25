/**
 * PhotoCapture - Fotoğraf Çekme Bileşeni
 * Capacitor Camera plugin ile native kamera desteği
 * Web fallback ile tam uyumluluk
 */

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Camera, X, Check, Upload, AlertCircle, Smartphone, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import NativeBridge from '../native';

const PhotoCapture = ({ 
  title, 
  onPhotoCapture, 
  required = false, 
  initialPhoto = null,
  quality = 80,
  maxWidth = 1280,
  maxHeight = 1280
}) => {
  const [photo, setPhoto] = useState(initialPhoto);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Platform kontrolü
  const isNative = NativeBridge.isNativeApp();
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

  // İzin durumunu kontrol et
  useEffect(() => {
    const checkPermission = async () => {
      const status = await NativeBridge.checkCameraPermission();
      setPermissionStatus(status);
    };
    checkPermission();
  }, []);

  // Native kamera ile fotoğraf çek (Capacitor)
  const takeNativePhoto = async () => {
    setCameraLoading(true);
    setCameraError(null);

    try {
      // İzin kontrolü
      let permission = await NativeBridge.checkCameraPermission();
      
      if (!permission.granted) {
        permission = await NativeBridge.requestCameraPermission();
        if (!permission.granted) {
          setCameraError('Kamera izni verilmedi. Lütfen ayarlardan izin verin.');
          toast.error('Kamera izni gerekli');
          return;
        }
      }

      // Native kamera ile fotoğraf çek
      const result = await NativeBridge.takePhoto({
        quality,
        allowEditing: false,
        saveToGallery: false
      });

      if (result && result.dataUrl) {
        // Resmi yeniden boyutlandır
        const resizedImage = await resizeImage(result.dataUrl, maxWidth, maxHeight, quality);
        setPhoto(resizedImage);
        onPhotoCapture(resizedImage);
        toast.success('Fotoğraf çekildi!');
      }
    } catch (error) {
      console.error('Native camera error:', error);
      
      if (error.message?.includes('cancelled') || error.message?.includes('User cancelled')) {
        // Kullanıcı iptal etti, hata gösterme
        return;
      }
      
      setCameraError('Kamera açılamadı. Dosya yükleyebilirsiniz.');
      toast.error('Kamera hatası: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setCameraLoading(false);
    }
  };

  // Galeriden fotoğraf seç (Native)
  const pickNativeImage = async () => {
    setCameraLoading(true);
    setCameraError(null);

    try {
      const result = await NativeBridge.pickImage({
        quality
      });

      if (result && result.dataUrl) {
        const resizedImage = await resizeImage(result.dataUrl, maxWidth, maxHeight, quality);
        setPhoto(resizedImage);
        onPhotoCapture(resizedImage);
        toast.success('Fotoğraf seçildi!');
      }
    } catch (error) {
      console.error('Pick image error:', error);
      
      if (error.message?.includes('cancelled') || error.message?.includes('User cancelled')) {
        return;
      }
      
      // Fallback to file input
      fileInputRef.current?.click();
    } finally {
      setCameraLoading(false);
    }
  };

  // Resmi yeniden boyutlandır
  const resizeImage = (dataUrl, maxW, maxH, q) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Oranı koru
        if (width > maxW) {
          height = (height * maxW) / width;
          width = maxW;
        }
        if (height > maxH) {
          width = (width * maxH) / height;
          height = maxH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', q / 100));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Web kamera desteği (fallback)
  const checkCameraSupport = () => {
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      return { supported: false, reason: 'Kamera için HTTPS bağlantısı gerekli.' };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { supported: false, reason: 'Tarayıcınız kamera erişimini desteklemiyor.' };
    }

    return { supported: true };
  };

  const startWebCamera = async () => {
    const check = checkCameraSupport();
    if (!check.supported) {
      setCameraError(check.reason);
      toast.error(check.reason);
      return;
    }

    setCameraLoading(true);
    setCameraError(null);
    setShowCamera(true);

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      
      if (!videoRef.current) {
        throw new Error('Video element bulunamadı');
      }
      
      videoRef.current.srcObject = stream;
      
      await new Promise((resolve, reject) => {
        const video = videoRef.current;
        if (!video) {
          reject(new Error('Video element kayboldu'));
          return;
        }
        
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = (e) => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
          reject(e);
        };
        
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onError);
        
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
          reject(new Error('Video yüklenme zaman aşımı'));
        }, 10000);
      });
      
      await videoRef.current.play();
      
    } catch (error) {
      console.error('Web camera error:', error);
      
      let errorMessage = 'Kamera açılamadı. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Kamera izni reddedildi.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'Kamera bulunamadı.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Kamera başka uygulama tarafından kullanılıyor.';
      } else {
        errorMessage += error.message || 'Dosya yükleyebilirsiniz.';
      }
      
      setCameraError(errorMessage);
      toast.error(errorMessage);
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
    } catch (e) {
      console.error('Error stopping camera:', e);
    }
    setShowCamera(false);
    setCameraLoading(false);
  };

  const captureFromVideo = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        toast.error('Video henüz hazır değil, lütfen tekrar deneyin');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const photoData = canvas.toDataURL('image/jpeg', quality / 100);
      
      resizeImage(photoData, maxWidth, maxHeight, quality).then((resized) => {
        setPhoto(resized);
        onPhotoCapture(resized);
        stopCamera();
        toast.success('Fotoğraf çekildi!');
      });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir resim dosyası seçin');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Dosya boyutu 15MB\'dan küçük olmalıdır');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const photoData = e.target?.result;
      if (photoData) {
        const resized = await resizeImage(photoData, maxWidth, maxHeight, quality);
        setPhoto(resized);
        onPhotoCapture(resized);
        toast.success('Fotoğraf yüklendi!');
      }
    };
    reader.onerror = () => {
      toast.error('Dosya okunamadı');
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
  };

  const removePhoto = () => {
    setPhoto(null);
    onPhotoCapture(null);
  };

  // Ana kamera butonuna tıklama
  const handleCameraClick = () => {
    if (isNative) {
      // Native platformda Capacitor Camera kullan
      takeNativePhoto();
    } else if (isMobile) {
      // Mobil web'de doğrudan kamera input'unu aç
      cameraInputRef.current?.click();
    } else {
      // Desktop'ta web kamerasını başlat
      startWebCamera();
    }
  };

  // Galeri butonuna tıklama
  const handleGalleryClick = () => {
    if (isNative) {
      pickNativeImage();
    } else {
      fileInputRef.current?.click();
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
      
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCameraClick}
                  className="flex-1"
                  disabled={cameraLoading}
                >
                  {cameraLoading ? (
                    <>
                      <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Açılıyor...
                    </>
                  ) : (
                    <>
                      {isNative || isMobile ? (
                        <Smartphone className="h-4 w-4 mr-2" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      Fotoğraf Çek
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGalleryClick}
                  disabled={cameraLoading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Galeri
                </Button>
              </div>
              
              {/* Platform bilgisi */}
              {isNative && (
                <p className="text-xs text-green-600 text-center">
                  📱 Native kamera kullanılıyor
                </p>
              )}
            </div>
          ) : (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
              {/* Büyük kamera görüntüsü */}
              <div className="flex-1 relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {/* Üst başlık */}
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4">
                  <p className="text-white font-medium text-center">{title}</p>
                </div>
              </div>
              {/* Alt butonlar */}
              <div className="bg-black p-4 pb-8 flex items-center justify-center gap-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCamera}
                  className="h-14 px-6 bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                >
                  <X className="h-5 w-5 mr-2" />
                  İptal
                </Button>
                <Button
                  type="button"
                  onClick={captureFromVideo}
                  className="h-16 w-16 rounded-full bg-white hover:bg-gray-200 text-black p-0"
                  disabled={cameraLoading}
                >
                  <Camera className="h-8 w-8" />
                </Button>
                <div className="w-24" /> {/* Spacer for centering */}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border-2 border-green-500">
          <img src={photo} alt={title} className="w-full h-48 object-cover" />
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center">
            <Check className="h-3 w-3 mr-1" />
            Hazır
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => { setPhoto(null); handleCameraClick(); }}
            className="absolute bottom-2 right-2"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Yeniden Çek
          </Button>
        </div>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default PhotoCapture;
