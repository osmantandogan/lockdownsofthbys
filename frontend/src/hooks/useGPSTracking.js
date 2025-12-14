/**
 * useGPSTracking - Gerçek zamanlı GPS takibi hook'u
 * Ambulans konumunu düzenli aralıklarla backend'e gönderir
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import NativeBridge from '../native';
import OfflineStorage from '../services/OfflineStorage';
import { locationsAPI } from '../api';

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  updateInterval: 30000,      // 30 saniye
  minDistance: 50,            // Minimum 50 metre değişiklik
  sendToBackend: true,
  vehicleId: null,
  userId: null
};

const useGPSTracking = (options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [currentPosition, setCurrentPosition] = useState(null);
  const [lastSentPosition, setLastSentPosition] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(null);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const watchCleanupRef = useRef(null);
  const intervalRef = useRef(null);
  const lastPositionRef = useRef(null);
  
  // Haversine formülü ile mesafe hesapla (metre cinsinden)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Dünya yarıçapı (metre)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };
  
  // Konumu backend'e gönder
  const sendLocationToBackend = useCallback(async (position) => {
    if (!opts.vehicleId || !opts.sendToBackend) return;
    
    const locationData = {
      vehicleId: opts.vehicleId,
      userId: opts.userId,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      altitude: position.altitude,
      heading: position.heading,
      speed: position.speed,
      timestamp: new Date().toISOString()
    };
    
    if (isOnline) {
      try {
        await locationsAPI.updateVehicleGPS(opts.vehicleId, locationData);
        setLastSentPosition(position);
        console.log('[GPS] Location sent to backend:', position.latitude, position.longitude);
      } catch (error) {
        console.error('[GPS] Failed to send location:', error);
        // Offline'a kaydet
        await OfflineStorage.savePendingLocation(locationData);
      }
    } else {
      // Offline modda kaydet
      await OfflineStorage.savePendingLocation(locationData);
      console.log('[GPS] Location saved offline:', position.latitude, position.longitude);
    }
  }, [opts.vehicleId, opts.userId, opts.sendToBackend, isOnline]);
  
  // Konum güncellemesini işle
  const handlePositionUpdate = useCallback((position) => {
    setCurrentPosition(position);
    setError(null);
    
    // Minimum mesafe kontrolü
    if (lastPositionRef.current && opts.minDistance > 0) {
      const distance = calculateDistance(
        lastPositionRef.current.latitude,
        lastPositionRef.current.longitude,
        position.latitude,
        position.longitude
      );
      
      if (distance < opts.minDistance) {
        console.log(`[GPS] Position change too small (${distance.toFixed(0)}m < ${opts.minDistance}m), skipping`);
        return;
      }
    }
    
    lastPositionRef.current = position;
    sendLocationToBackend(position);
  }, [opts.minDistance, sendLocationToBackend]);
  
  // İzin kontrolü
  const checkPermission = useCallback(async () => {
    try {
      const permission = await NativeBridge.checkLocationPermission();
      setPermissionGranted(permission.granted);
      return permission.granted;
    } catch (error) {
      console.error('[GPS] Permission check error:', error);
      setPermissionGranted(false);
      return false;
    }
  }, []);
  
  // İzin iste
  const requestPermission = useCallback(async () => {
    try {
      const permission = await NativeBridge.requestLocationPermission();
      setPermissionGranted(permission.granted);
      return permission.granted;
    } catch (error) {
      console.error('[GPS] Permission request error:', error);
      setError('Konum izni alınamadı');
      return false;
    }
  }, []);
  
  // Anlık konum al
  const getCurrentPosition = useCallback(async () => {
    try {
      const position = await NativeBridge.getCurrentPosition({
        enableHighAccuracy: opts.enableHighAccuracy
      });
      setCurrentPosition(position);
      setError(null);
      return position;
    } catch (error) {
      console.error('[GPS] Get position error:', error);
      setError('Konum alınamadı: ' + error.message);
      return null;
    }
  }, [opts.enableHighAccuracy]);
  
  // Takibi başlat
  const startTracking = useCallback(async () => {
    if (isTracking) return;
    
    // İzin kontrolü
    let hasPermission = permissionGranted;
    if (!hasPermission) {
      hasPermission = await requestPermission();
    }
    
    if (!hasPermission) {
      setError('Konum izni verilmedi');
      return false;
    }
    
    setIsTracking(true);
    setError(null);
    
    console.log('[GPS] Starting tracking...');
    
    // İlk konumu al
    const initialPosition = await getCurrentPosition();
    if (initialPosition) {
      handlePositionUpdate(initialPosition);
    }
    
    // Continuous tracking (watchPosition)
    if (NativeBridge.isNativeApp()) {
      watchCleanupRef.current = NativeBridge.watchPosition((position) => {
        handlePositionUpdate(position);
      }, {
        enableHighAccuracy: opts.enableHighAccuracy
      });
    }
    
    // Interval ile periyodik güncelleme (watchPosition'a ek olarak)
    intervalRef.current = setInterval(async () => {
      try {
        const position = await NativeBridge.getCurrentPosition({
          enableHighAccuracy: opts.enableHighAccuracy
        });
        handlePositionUpdate(position);
      } catch (err) {
        console.error('[GPS] Interval update error:', err);
      }
    }, opts.updateInterval);
    
    return true;
  }, [isTracking, permissionGranted, requestPermission, getCurrentPosition, handlePositionUpdate, opts]);
  
  // Takibi durdur
  const stopTracking = useCallback(async () => {
    if (!isTracking) return;
    
    console.log('[GPS] Stopping tracking...');
    
    if (watchCleanupRef.current) {
      if (typeof watchCleanupRef.current === 'function') {
        await watchCleanupRef.current();
      }
      watchCleanupRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsTracking(false);
  }, [isTracking]);
  
  // Network durumunu izle
  useEffect(() => {
    const cleanup = NativeBridge.watchNetworkStatus((status) => {
      setIsOnline(status.connected);
      
      // Online olunca pending lokasyonları senkronize et
      if (status.connected) {
        OfflineStorage.getPendingLocations().then(async (locations) => {
          if (locations.length > 0) {
            console.log(`[GPS] Syncing ${locations.length} pending locations...`);
            for (const loc of locations) {
              try {
                await locationsAPI.updateVehicleGPS(loc.vehicleId, loc);
                await OfflineStorage.removePendingLocation(loc.id);
              } catch (error) {
                console.error('[GPS] Failed to sync location:', error);
              }
            }
          }
        });
      }
    });
    
    // İlk network durumunu al
    NativeBridge.getNetworkStatus().then((status) => {
      setIsOnline(status.connected);
    });
    
    return cleanup;
  }, []);
  
  // Component unmount olduğunda temizle
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);
  
  return {
    // State
    currentPosition,
    lastSentPosition,
    isTracking,
    permissionGranted,
    error,
    isOnline,
    
    // Actions
    checkPermission,
    requestPermission,
    getCurrentPosition,
    startTracking,
    stopTracking
  };
};

export default useGPSTracking;


