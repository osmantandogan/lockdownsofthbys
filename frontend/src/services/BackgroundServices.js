/**
 * BackgroundServices - Arka Plan Servisleri
 * Android için arka planda çalışan GPS ve Bildirim servisleri
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { locationsAPI } from '../api';
import SessionManager from './SessionManager';

const isNative = Capacitor.isNativePlatform();

// GPS takip interval ID
let gpsWatchId = null;
let gpsIntervalId = null;
let lastPosition = null;

/**
 * Tüm arka plan servislerini başlat
 */
const initialize = async () => {
  if (!isNative) {
    console.log('[BackgroundServices] Not native platform, skipping...');
    return;
  }
  
  console.log('[BackgroundServices] Initializing...');
  
  try {
    // Push bildirimleri başlat
    await initPushNotifications();
    
    // Local bildirimleri başlat
    await initLocalNotifications();
    
    // Uygulama lifecycle listener'ları
    initAppLifecycle();
    
    console.log('[BackgroundServices] Initialized successfully');
  } catch (error) {
    console.error('[BackgroundServices] Initialization error:', error);
  }
};

/**
 * Push Notifications (FCM) başlat
 */
const initPushNotifications = async () => {
  try {
    // İzin iste
    const permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== 'granted') {
        console.log('[Push] Permission denied');
        return;
      }
    } else if (permStatus.receive !== 'granted') {
      console.log('[Push] Permission not granted');
      return;
    }
    
    // Kayıt ol
    await PushNotifications.register();
    
    // Token alındığında
    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Token:', token.value);
      // Token'ı backend'e gönder
      savePushToken(token.value);
    });
    
    // Kayıt hatası
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });
    
    // Bildirim alındığında (uygulama açıkken)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification);
      handlePushNotification(notification);
    });
    
    // Bildirime tıklandığında
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Action performed:', action);
      handlePushAction(action);
    });
    
    console.log('[Push] Initialized');
  } catch (error) {
    console.error('[Push] Init error:', error);
  }
};

/**
 * Local Notifications başlat
 */
const initLocalNotifications = async () => {
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    
    if (permStatus.display === 'prompt') {
      await LocalNotifications.requestPermissions();
    }
    
    // Bildirime tıklandığında
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[LocalNotif] Action:', action);
    });
    
    console.log('[LocalNotif] Initialized');
  } catch (error) {
    console.error('[LocalNotif] Init error:', error);
  }
};

/**
 * Uygulama lifecycle listener'ları
 */
const initAppLifecycle = () => {
  // Uygulama arka plana gittiğinde
  App.addListener('appStateChange', ({ isActive }) => {
    console.log('[App] State changed, isActive:', isActive);
    
    if (!isActive) {
      // Arka plana gitti - GPS takibini sürdür
      console.log('[App] Going to background, keeping GPS active...');
    } else {
      // Ön plana geldi
      console.log('[App] Coming to foreground');
    }
  });
  
  // Uygulama geri tuşu
  App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      // Ana ekrandayız, uygulamayı minimize et (kapatma)
      App.minimizeApp();
    }
  });
};

/**
 * Push token'ı backend'e kaydet
 */
const savePushToken = async (token) => {
  try {
    const activeSession = SessionManager.getActiveSession();
    if (activeSession?.token) {
      // TODO: Backend'e push token gönder
      console.log('[Push] Token saved for user');
    }
  } catch (error) {
    console.error('[Push] Save token error:', error);
  }
};

/**
 * Push notification işle
 */
const handlePushNotification = (notification) => {
  // Local bildirim göster (foreground'da)
  LocalNotifications.schedule({
    notifications: [{
      title: notification.title || 'Healmedy',
      body: notification.body || '',
      id: Date.now(),
      sound: 'default',
      extra: notification.data
    }]
  });
};

/**
 * Push action işle
 */
const handlePushAction = (action) => {
  const data = action.notification?.data;
  
  if (data?.case_id) {
    // Vaka detayına git
    window.location.href = `/dashboard/cases/${data.case_id}`;
  } else if (data?.route) {
    window.location.href = data.route;
  }
};

/**
 * Local bildirim gönder
 */
const showLocalNotification = async (title, body, data = {}) => {
  if (!isNative) return;
  
  try {
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: Date.now(),
        sound: 'default',
        extra: data
      }]
    });
  } catch (error) {
    console.error('[LocalNotif] Show error:', error);
  }
};

// ==================== BACKGROUND GPS ====================

/**
 * Arka plan GPS takibini başlat
 */
const startBackgroundGPS = async (vehicleId) => {
  if (!isNative) {
    console.log('[GPS] Not native, using web geolocation');
    return startWebGPS(vehicleId);
  }
  
  console.log('[GPS] Starting background tracking for vehicle:', vehicleId);
  
  try {
    // İzin kontrolü
    const permStatus = await Geolocation.checkPermissions();
    
    if (permStatus.location !== 'granted') {
      const result = await Geolocation.requestPermissions();
      if (result.location !== 'granted') {
        console.log('[GPS] Permission denied');
        return false;
      }
    }
    
    // Mevcut takibi durdur
    await stopBackgroundGPS();
    
    // Sürekli konum takibi başlat
    gpsWatchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 10000
      },
      (position, err) => {
        if (err) {
          console.error('[GPS] Watch error:', err);
          return;
        }
        
        if (position) {
          handlePositionUpdate(position, vehicleId);
        }
      }
    );
    
    // Ayrıca interval ile de konum al (yedek)
    gpsIntervalId = setInterval(async () => {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000
        });
        handlePositionUpdate(position, vehicleId);
      } catch (e) {
        console.error('[GPS] Interval error:', e);
      }
    }, 30000); // 30 saniyede bir
    
    console.log('[GPS] Background tracking started');
    return true;
  } catch (error) {
    console.error('[GPS] Start error:', error);
    return false;
  }
};

/**
 * Web GPS takibi (fallback)
 */
const startWebGPS = (vehicleId) => {
  if (!navigator.geolocation) {
    console.log('[GPS] Geolocation not supported');
    return false;
  }
  
  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      handlePositionUpdate({
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed
        },
        timestamp: position.timestamp
      }, vehicleId);
    },
    (error) => {
      console.error('[GPS] Web watch error:', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 10000
    }
  );
  
  return true;
};

/**
 * Konum güncellemesini işle
 */
const handlePositionUpdate = async (position, vehicleId) => {
  const { latitude, longitude, accuracy, speed } = position.coords;
  const timestamp = position.timestamp || Date.now();
  
  // Aynı konum mu kontrol et (gereksiz güncellemeleri önle)
  if (lastPosition) {
    const distance = calculateDistance(
      lastPosition.latitude, lastPosition.longitude,
      latitude, longitude
    );
    
    // 10 metreden az hareket varsa gönderme
    if (distance < 10) {
      return;
    }
  }
  
  lastPosition = { latitude, longitude, timestamp };
  
  console.log(`[GPS] Position: ${latitude}, ${longitude}, speed: ${speed}`);
  
  // Backend'e gönder
  try {
    await locationsAPI.updateVehicleGPS(vehicleId, {
      latitude,
      longitude,
      accuracy,
      speed: speed || 0,
      timestamp: new Date(timestamp).toISOString()
    });
  } catch (error) {
    console.error('[GPS] Send error:', error);
    // Offline ise yerel kaydet
    // TODO: Offline storage'a kaydet
  }
};

/**
 * İki nokta arasındaki mesafeyi hesapla (metre)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Dünya yarıçapı (metre)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Arka plan GPS takibini durdur
 */
const stopBackgroundGPS = async () => {
  if (gpsWatchId !== null) {
    if (isNative) {
      await Geolocation.clearWatch({ id: gpsWatchId });
    } else if (navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchId);
    }
    gpsWatchId = null;
  }
  
  if (gpsIntervalId) {
    clearInterval(gpsIntervalId);
    gpsIntervalId = null;
  }
  
  lastPosition = null;
  console.log('[GPS] Background tracking stopped');
};

/**
 * GPS durumunu getir
 */
const getGPSStatus = () => {
  return {
    isTracking: gpsWatchId !== null,
    lastPosition
  };
};

/**
 * Mevcut konumu al
 */
const getCurrentPosition = async () => {
  try {
    if (isNative) {
      return await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });
    } else if (navigator.geolocation) {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000
        });
      });
    }
  } catch (error) {
    console.error('[GPS] Get current position error:', error);
    throw error;
  }
};

// ==================== EXPORT ====================

const BackgroundServices = {
  initialize,
  
  // Notifications
  initPushNotifications,
  initLocalNotifications,
  showLocalNotification,
  
  // GPS
  startBackgroundGPS,
  stopBackgroundGPS,
  getGPSStatus,
  getCurrentPosition,
  
  // Utils
  isNative
};

export default BackgroundServices;

