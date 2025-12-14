/**
 * GPSContext - Uygulama genelinde GPS tracking yönetimi
 * Ambulans konumunu otomatik olarak backend'e gönderir
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import useGPSTracking from '../hooks/useGPSTracking';
import { shiftsAPI } from '../api';
import { toast } from 'sonner';

const GPSContext = createContext(null);

export const GPSProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [vehicleId, setVehicleId] = useState(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState('idle'); // 'idle', 'starting', 'active', 'error'
  
  // GPS tracking hook
  const {
    currentPosition,
    lastSentPosition,
    isTracking,
    permissionGranted,
    error,
    isOnline,
    checkPermission,
    requestPermission,
    getCurrentPosition,
    startTracking,
    stopTracking
  } = useGPSTracking({
    vehicleId,
    userId: user?.id,
    updateInterval: 30000, // 30 saniye
    minDistance: 50,       // 50 metre
    sendToBackend: true
  });
  
  // Kullanıcının aktif vardiyasındaki aracı bul
  const loadActiveVehicle = useCallback(async () => {
    if (!isAuthenticated || !user) return null;
    
    try {
      // Bugünün vardiya atamasını kontrol et
      const response = await shiftsAPI.getTodayAssignments();
      const assignments = response.data || [];
      
      // Kullanıcının atamasını bul
      const myAssignment = assignments.find(a => 
        a.user_id === user.id || 
        a.personnel?.some(p => p.id === user.id || p._id === user.id)
      );
      
      if (myAssignment?.vehicle?.id || myAssignment?.vehicle_id) {
        const vId = myAssignment.vehicle?.id || myAssignment.vehicle_id;
        setVehicleId(vId);
        console.log('[GPS Context] Active vehicle found:', vId);
        return vId;
      }
      
      console.log('[GPS Context] No active vehicle assignment found');
      return null;
    } catch (error) {
      console.error('[GPS Context] Failed to load active vehicle:', error);
      return null;
    }
  }, [isAuthenticated, user]);
  
  // Tracking'i başlat
  const enableTracking = useCallback(async () => {
    if (!vehicleId) {
      const vId = await loadActiveVehicle();
      if (!vId) {
        toast.error('Aktif araç ataması bulunamadı');
        return false;
      }
    }
    
    setTrackingStatus('starting');
    
    const success = await startTracking();
    
    if (success) {
      setIsEnabled(true);
      setTrackingStatus('active');
      toast.success('GPS takibi başlatıldı');
    } else {
      setTrackingStatus('error');
      toast.error('GPS takibi başlatılamadı');
    }
    
    return success;
  }, [vehicleId, loadActiveVehicle, startTracking]);
  
  // Tracking'i durdur
  const disableTracking = useCallback(async () => {
    await stopTracking();
    setIsEnabled(false);
    setTrackingStatus('idle');
    toast.info('GPS takibi durduruldu');
  }, [stopTracking]);
  
  // Kullanıcı giriş yaptığında ve saha personeli ise otomatik başlat
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setVehicleId(null);
      setTrackingStatus('idle');
      return;
    }
    
    // Sadece saha personeli için otomatik tracking
    const fieldRoles = ['sofor', 'att', 'paramedik', 'hemsire'];
    if (!fieldRoles.includes(user.role)) {
      console.log('[GPS Context] User is not field personnel, skipping auto-tracking');
      return;
    }
    
    // Araç atamasını kontrol et ve tracking'i başlat
    const initTracking = async () => {
      const vId = await loadActiveVehicle();
      if (vId && isEnabled) {
        // İzin kontrolü
        const hasPermission = await checkPermission();
        if (!hasPermission) {
          console.log('[GPS Context] No permission, requesting...');
          const granted = await requestPermission();
          if (!granted) {
            console.log('[GPS Context] Permission denied');
            setTrackingStatus('error');
            return;
          }
        }
        
        // Tracking'i başlat
        setTrackingStatus('starting');
        const success = await startTracking();
        if (success) {
          setTrackingStatus('active');
          console.log('[GPS Context] Auto-tracking started');
        } else {
          setTrackingStatus('error');
        }
      }
    };
    
    // Kısa gecikme ile başlat (uygulama tam yüklenmesini bekle)
    const timer = setTimeout(initTracking, 2000);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, user, isEnabled, loadActiveVehicle, checkPermission, requestPermission, startTracking]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);
  
  const value = {
    // State
    vehicleId,
    currentPosition,
    lastSentPosition,
    isTracking,
    isEnabled,
    trackingStatus,
    permissionGranted,
    error,
    isOnline,
    
    // Actions
    enableTracking,
    disableTracking,
    getCurrentPosition,
    checkPermission,
    requestPermission,
    setVehicleId
  };
  
  return (
    <GPSContext.Provider value={value}>
      {children}
    </GPSContext.Provider>
  );
};

export const useGPS = () => {
  const context = useContext(GPSContext);
  if (!context) {
    throw new Error('useGPS must be used within a GPSProvider');
  }
  return context;
};

export default GPSContext;

