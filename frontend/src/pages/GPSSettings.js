/**
 * GPSSettings - GPS ve Konum Ayarları Sayfası
 * GPS tracking ayarları, izinler ve durum kontrolü
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { 
  MapPin, Navigation, Settings, Shield, 
  RefreshCw, Power, AlertTriangle, Check,
  Smartphone, Wifi, WifiOff, Battery, Clock
} from 'lucide-react';
import { useGPS } from '../contexts/GPSContext';
import { useOffline } from '../contexts/OfflineContext';
import NativeBridge from '../native';

const GPSSettings = () => {
  const {
    vehicleId,
    currentPosition,
    isTracking,
    isEnabled,
    trackingStatus,
    permissionGranted,
    error,
    isOnline,
    enableTracking,
    disableTracking,
    getCurrentPosition,
    checkPermission,
    requestPermission
  } = useGPS();
  
  const { pendingCount, isSyncing, syncNow } = useOffline();
  
  const [platform, setPlatform] = useState('web');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [trackingInterval, setTrackingInterval] = useState(30);
  const [minDistance, setMinDistance] = useState(50);
  
  // Platform bilgisi
  useEffect(() => {
    setPlatform(NativeBridge.getPlatform());
    
    // Batarya durumu (destekleniyorsa)
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);
  
  // İzin durumu badge rengi
  const getPermissionBadge = () => {
    if (permissionGranted === null) {
      return <Badge variant="outline">Kontrol ediliyor...</Badge>;
    }
    if (permissionGranted) {
      return <Badge className="bg-green-100 text-green-700"><Check className="h-3 w-3 mr-1" />İzin Verildi</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />İzin Yok</Badge>;
  };
  
  // Tracking durumu badge
  const getTrackingBadge = () => {
    switch (trackingStatus) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 animate-pulse"><Navigation className="h-3 w-3 mr-1" />Aktif</Badge>;
      case 'starting':
        return <Badge className="bg-yellow-100 text-yellow-700"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Başlatılıyor</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Hata</Badge>;
      default:
        return <Badge variant="outline"><Power className="h-3 w-3 mr-1" />Kapalı</Badge>;
    }
  };
  
  // Konum formatı
  const formatCoordinate = (coord) => {
    return coord ? coord.toFixed(6) : '-';
  };
  
  // Hız formatı
  const formatSpeed = (speed) => {
    if (!speed || speed < 0) return '0 km/s';
    return `${Math.round(speed * 3.6)} km/s`;
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GPS ve Konum Ayarları</h1>
          <p className="text-gray-500">Konum takibi ve GPS ayarlarını yönetin</p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge variant="outline" className="text-green-600">
              <Wifi className="h-3 w-3 mr-1" />Çevrimiçi
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-600">
              <WifiOff className="h-3 w-3 mr-1" />Çevrimdışı
            </Badge>
          )}
          <Badge variant="outline">
            <Smartphone className="h-3 w-3 mr-1" />
            {platform === 'android' ? 'Android' : platform === 'ios' ? 'iOS' : 'Web'}
          </Badge>
        </div>
      </div>
      
      {/* GPS Durumu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-blue-600" />
            GPS Durumu
          </CardTitle>
          <CardDescription>
            Mevcut konum ve tracking durumu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">İzin Durumu</p>
              {getPermissionBadge()}
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Tracking</p>
              {getTrackingBadge()}
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Araç ID</p>
              <p className="font-mono text-sm">{vehicleId || '-'}</p>
            </div>
            {batteryLevel !== null && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Batarya</p>
                <div className="flex items-center gap-1">
                  <Battery className="h-4 w-4" />
                  <span className={batteryLevel < 20 ? 'text-red-600' : ''}>{batteryLevel}%</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Güncel Konum */}
          {currentPosition && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Güncel Konum
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Enlem:</span>
                  <p className="font-mono">{formatCoordinate(currentPosition.latitude)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Boylam:</span>
                  <p className="font-mono">{formatCoordinate(currentPosition.longitude)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Doğruluk:</span>
                  <p>±{Math.round(currentPosition.accuracy || 0)}m</p>
                </div>
                <div>
                  <span className="text-gray-500">Hız:</span>
                  <p>{formatSpeed(currentPosition.speed)}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Hata mesajı */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          {/* Aksiyon butonları */}
          <div className="flex flex-wrap gap-2">
            {!permissionGranted && (
              <Button onClick={requestPermission}>
                <Shield className="h-4 w-4 mr-2" />
                İzin İste
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={getCurrentPosition}
              disabled={!permissionGranted}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Konumu Al
            </Button>
            
            {isTracking ? (
              <Button variant="destructive" onClick={disableTracking}>
                <Power className="h-4 w-4 mr-2" />
                Tracking'i Durdur
              </Button>
            ) : (
              <Button onClick={enableTracking} disabled={!permissionGranted}>
                <Navigation className="h-4 w-4 mr-2" />
                Tracking Başlat
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Tracking Ayarları */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tracking Ayarları
          </CardTitle>
          <CardDescription>
            GPS takip parametrelerini ayarlayın
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Otomatik GPS Tracking</Label>
              <p className="text-sm text-gray-500">Vardiya başladığında otomatik başlat</p>
            </div>
            <Switch 
              checked={isEnabled} 
              onCheckedChange={(checked) => checked ? enableTracking() : disableTracking()}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Güncelleme Aralığı</Label>
              <span className="text-sm font-medium">{trackingInterval} saniye</span>
            </div>
            <Slider
              value={[trackingInterval]}
              onValueChange={([value]) => setTrackingInterval(value)}
              min={10}
              max={120}
              step={10}
              disabled
            />
            <p className="text-xs text-gray-500">
              Konum güncellemeleri arasındaki süre (varsayılan: 30sn)
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Minimum Mesafe</Label>
              <span className="text-sm font-medium">{minDistance} metre</span>
            </div>
            <Slider
              value={[minDistance]}
              onValueChange={([value]) => setMinDistance(value)}
              min={10}
              max={200}
              step={10}
              disabled
            />
            <p className="text-xs text-gray-500">
              Konum göndermek için gereken minimum hareket mesafesi
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Offline Sync Durumu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Offline Senkronizasyon
          </CardTitle>
          <CardDescription>
            Çevrimdışı kaydedilen verilerin durumu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>Bekleyen Veri</span>
            </div>
            <Badge variant={pendingCount > 0 ? 'destructive' : 'outline'}>
              {pendingCount} öğe
            </Badge>
          </div>
          
          {pendingCount > 0 && (
            <Button 
              onClick={syncNow} 
              disabled={isSyncing || !isOnline}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Senkronize ediliyor...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Şimdi Senkronize Et
                </>
              )}
            </Button>
          )}
          
          {!isOnline && pendingCount > 0 && (
            <p className="text-sm text-yellow-600 flex items-center gap-2">
              <WifiOff className="h-4 w-4" />
              İnternet bağlantısı sağlandığında otomatik senkronize edilecek
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Bilgi */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">GPS Tracking Hakkında</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>GPS tracking sadece aktif vardiya sırasında çalışır</li>
                <li>Konum bilgileri güvenli şekilde şifreli olarak gönderilir</li>
                <li>Batarya tasarrufu için minimum mesafe filtresi uygulanır</li>
                <li>Çevrimdışı konum verileri internet geldiğinde otomatik senkronize edilir</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPSSettings;






