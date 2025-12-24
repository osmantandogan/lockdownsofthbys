import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, 
  Maximize2, Minimize2, Users, Monitor
} from 'lucide-react';

const VideoCall = ({ 
  roomUrl, 
  userName, 
  onLeave, 
  onError,
  provider = 'daily' // 'daily' veya 'jitsi'
}) => {
  const containerRef = useRef(null);
  const callFrameRef = useRef(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(null);

  // Mikrofon ve kamera izni iste
  const requestMediaPermissions = useCallback(async () => {
    try {
      console.log('Requesting media permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      // İzinler alındıktan sonra stream'i kapat
      stream.getTracks().forEach(track => track.stop());
      console.log('Media permissions granted');
      return true;
    } catch (err) {
      console.error('Media permission error:', err);
      setError('Kamera ve mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.');
      return false;
    }
  }, []);

  // Daily.co frame oluştur
  const createCallFrame = useCallback(async () => {
    if (!containerRef.current || !roomUrl) return;
    
    // Eğer zaten bir frame varsa, yenisini oluşturma
    if (callFrameRef.current) {
      console.log('Frame already exists, skipping creation');
      return;
    }

    try {
      // Önce mikrofon ve kamera izni iste
      const hasPermission = await requestMediaPermissions();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      // Daily.co kullan
      if (provider === 'daily') {
        // Container'ı temizle
        containerRef.current.innerHTML = '';
        
        const callFrame = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '8px'
          },
          showLeaveButton: false,
          showFullscreenButton: true,
          showLocalVideo: true,
          showParticipantsBar: true
        });

        callFrameRef.current = callFrame;

        // Event listeners
        callFrame.on('joined-meeting', () => {
          setIsJoined(true);
          setIsLoading(false);
        });

        callFrame.on('left-meeting', () => {
          console.log('Daily: left-meeting event fired');
          setIsJoined(false);
          // Don't auto-call onLeave - user must click close button
        });

        callFrame.on('participant-joined', () => {
          updateParticipantCount();
        });

        callFrame.on('participant-left', () => {
          updateParticipantCount();
        });

        callFrame.on('error', (e) => {
          console.error('Daily.co error:', e);
          setError(e.errorMsg || 'Bağlantı hatası');
          onError?.(e);
        });

        // Toplantıya katıl
        await callFrame.join({
          url: roomUrl,
          userName: userName || 'Kullanıcı'
        });

      } else {
        // Jitsi fallback - iframe kullan
        setIsLoading(false);
        setIsJoined(true);
      }

    } catch (err) {
      console.error('Video call error:', err);
      setError(err.message || 'Görüntülü görüşme başlatılamadı');
      setIsLoading(false);
      onError?.(err);
    }
  }, [roomUrl, userName, provider, onLeave, onError, requestMediaPermissions]);

  const updateParticipantCount = useCallback(() => {
    if (callFrameRef.current && provider === 'daily') {
      const participants = callFrameRef.current.participants();
      setParticipantCount(Object.keys(participants).length);
    }
  }, [provider]);

  // Mount olduğunda frame oluştur - sadece roomUrl değiştiğinde
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    // Zaten başlatıldıysa tekrar başlatma
    if (hasInitializedRef.current && callFrameRef.current) {
      console.log('Video call already initialized, skipping');
      return;
    }
    
    if (!roomUrl) return;
    
    hasInitializedRef.current = true;
    
    // Kısa gecikme ile frame oluştur
    const timer = setTimeout(() => {
      createCallFrame();
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [roomUrl, createCallFrame]);
  
  // Unmount olduğunda temizle
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try {
          console.log('Destroying call frame on unmount');
          callFrameRef.current.destroy();
        } catch (e) {
          // Ignore
        }
        callFrameRef.current = null;
        hasInitializedRef.current = false;
      }
    };
  }, []);

  // Mikrofon aç/kapat
  const toggleMute = () => {
    if (callFrameRef.current && provider === 'daily') {
      callFrameRef.current.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  // Kamera aç/kapat
  const toggleVideo = () => {
    if (callFrameRef.current && provider === 'daily') {
      callFrameRef.current.setLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  // Görüşmeden ayrıl
  const leaveCall = () => {
    if (callFrameRef.current && provider === 'daily') {
      callFrameRef.current.leave();
    }
    onLeave?.();
  };

  // Tam ekran
  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!isFullscreen) {
        containerRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  // Jitsi için iframe render
  if (provider === 'jitsi') {
    const jitsiConfig = [
      `userInfo.displayName="${encodeURIComponent(userName || 'Kullanıcı')}"`,
      'config.prejoinPageEnabled=false',
      'config.startWithAudioMuted=false',
      'config.startWithVideoMuted=false',
      'config.defaultLanguage="tr"',
      'config.disableLobbyPassword=true',
      'config.requireDisplayName=false',
      'interfaceConfig.SHOW_JITSI_WATERMARK=false'
    ].join('&');

    const fullUrl = `${roomUrl}#${jitsiConfig}`;

    return (
      <Card className="border-2 border-green-500 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span>Görüntülü Görüşme</span>
              <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                Canlı
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                className="h-8"
                onClick={onLeave}
              >
                <PhoneOff className="h-4 w-4 mr-1" />
                Kapat
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0" ref={containerRef}>
          <iframe
            src={fullUrl}
            style={{ width: '100%', height: '400px', border: 'none' }}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            title="Görüntülü Görüşme"
          />
        </CardContent>
      </Card>
    );
  }

  // Daily.co render
  return (
    <Card className="border-2 border-blue-500 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <span>Görüntülü Görüşme</span>
            {isJoined && (
              <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                <Users className="h-3 w-3 mr-1" />
                {participantCount} Kişi
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isJoined && (
              <>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className={`text-white hover:bg-white/20 h-8 w-8 p-0 ${isMuted ? 'bg-red-500/50' : ''}`}
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className={`text-white hover:bg-white/20 h-8 w-8 p-0 ${isVideoOff ? 'bg-red-500/50' : ''}`}
                  onClick={toggleVideo}
                >
                  {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </Button>
              </>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              className="h-8"
              onClick={leaveCall}
            >
              <PhoneOff className="h-4 w-4 mr-1" />
              Kapat
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Görüntülü görüşmeye bağlanılıyor...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
            <div className="text-center text-white p-4">
              <p className="text-red-400 mb-2">Hata: {error}</p>
              <Button onClick={createCallFrame} variant="secondary">
                Tekrar Dene
              </Button>
            </div>
          </div>
        )}
        <div 
          ref={containerRef} 
          style={{ width: '100%', height: '400px', minHeight: '300px' }}
          className="bg-gray-900"
        />
      </CardContent>
    </Card>
  );
};

export default VideoCall;

