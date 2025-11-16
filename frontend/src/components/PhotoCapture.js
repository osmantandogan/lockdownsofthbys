import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Camera, X, Check } from 'lucide-react';

const PhotoCapture = ({ title, onPhotoCapture, required = false }) => {
  const [photo, setPhoto] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Camera error:', error);
      alert('Kamera açılamadı. Lütfen izin verin.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const photoData = canvas.toDataURL('image/jpeg', 0.7);
      setPhoto(photoData);
      onPhotoCapture(photoData);
      stopCamera();
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    onPhotoCapture(null);
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
      
      {!photo ? (
        <div>
          {!showCamera ? (
            <Button
              type="button"
              variant="outline"
              onClick={startCamera}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Fotoğraf Çek
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-64 object-cover"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1"
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
