import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, Phone, MapPin, User, FileText, Clock, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Acil Durum Vaka Bildirimi Overlay'i
 * Vaka atandığında tam ekran kırmızı arka planlı bildirim gösterir
 * "Vakaya Git" butonuna basılana kadar siren sesi döngüde çalar
 */
const EmergencyCaseAlert = ({ 
  isOpen, 
  onClose, 
  caseData,
  onGoToCase,
  onExcuse 
}) => {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Siren sesini başlat
  useEffect(() => {
    if (isOpen && !isMuted) {
      try {
        // Web'de siren sesi çal
        audioRef.current = new Audio('/alarm-siren.mp3');
        audioRef.current.loop = true;
        audioRef.current.volume = 1.0;
        audioRef.current.play().catch(err => {
          console.log('[EmergencyAlert] Audio play error:', err);
        });
      } catch (err) {
        console.error('[EmergencyAlert] Audio error:', err);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen, isMuted]);

  // Geçen süreyi hesapla
  useEffect(() => {
    let interval;
    if (isOpen) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen]);

  // Sesi kapat/aç
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (audioRef.current) {
        audioRef.current.muted = !prev;
      }
      return !prev;
    });
  }, []);

  // Vakaya git
  const handleGoToCase = useCallback(() => {
    // Sesi durdur
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Callback'i çağır
    if (onGoToCase) {
      onGoToCase(caseData);
    }
    
    // Vaka sayfasına yönlendir
    if (caseData?.case_id) {
      navigate(`/dashboard/cases/${caseData.case_id}`);
    }
    
    onClose();
  }, [caseData, onGoToCase, onClose, navigate]);

  // Mazeret bildir
  const handleExcuse = useCallback(() => {
    // Sesi durdur
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (onExcuse) {
      onExcuse(caseData);
    }
    
    onClose();
  }, [caseData, onExcuse, onClose]);

  // Zamanı formatla
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-red-600 flex flex-col items-center justify-center p-4 overflow-auto">
      {/* Animasyonlu arka plan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500 to-red-700 animate-pulse" />
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-red-400 rounded-full opacity-20 animate-ping" />
          <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-red-300 rounded-full opacity-20 animate-ping animation-delay-500" />
        </div>
      </div>

      {/* İçerik */}
      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Başlık */}
        <div className="text-center animate-bounce">
          <div className="text-6xl mb-2">🚨</div>
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            ACİL DURUM
          </h1>
          <p className="text-red-100 mt-2 text-lg">
            Yeni vaka atandı!
          </p>
        </div>

        {/* Vaka Bilgileri */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-4 border border-white/20">
          {/* Vaka No */}
          {caseData?.case_number && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-red-200 text-sm">Vaka No</p>
                <p className="text-white font-bold text-xl">{caseData.case_number}</p>
              </div>
            </div>
          )}

          {/* Hasta Adı */}
          {caseData?.patient_name && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-red-200 text-sm">Hasta</p>
                <p className="text-white font-bold text-xl">{caseData.patient_name}</p>
              </div>
            </div>
          )}

          {/* Telefon */}
          {caseData?.patient_phone && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-red-200 text-sm">Telefon</p>
                <p className="text-white font-bold text-lg">{caseData.patient_phone}</p>
              </div>
            </div>
          )}

          {/* Şikayet */}
          {caseData?.patient_complaint && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-red-200 text-sm">Şikayet</p>
                <p className="text-white font-bold">{caseData.patient_complaint}</p>
              </div>
            </div>
          )}

          {/* Adres */}
          {caseData?.address && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-red-200 text-sm">Adres</p>
                <p className="text-white font-bold">{caseData.address}</p>
              </div>
            </div>
          )}
        </div>

        {/* Süre göstergesi */}
        <div className="flex items-center justify-center gap-2 text-white/80">
          <Clock className="w-4 h-4" />
          <span>Geçen süre: {formatTime(elapsedTime)}</span>
        </div>

        {/* Butonlar */}
        <div className="flex gap-4">
          <Button
            onClick={handleGoToCase}
            className="flex-1 h-16 text-xl font-bold bg-green-500 hover:bg-green-600 text-white border-2 border-white/30 shadow-lg"
          >
            ✓ VAKAYA GİT
          </Button>
          <Button
            onClick={handleExcuse}
            className="flex-1 h-16 text-xl font-bold bg-orange-500 hover:bg-orange-600 text-white border-2 border-white/30 shadow-lg"
          >
            ⚠ MAZERET
          </Button>
        </div>

        {/* Ses kontrol */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 mr-2" />
                Sesi Aç
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Sesi Kapat
              </>
            )}
          </Button>
        </div>

        {/* Alt bilgi */}
        <p className="text-center text-white/60 text-sm">
          Ekrana dokunarak sesi kapatabilirsiniz
        </p>
      </div>
    </div>
  );
};

export default EmergencyCaseAlert;

