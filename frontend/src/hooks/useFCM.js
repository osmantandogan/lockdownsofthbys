/**
 * Firebase Cloud Messaging Hook
 * Android push bildirimleri için FCM token yönetimi
 */

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { notificationsAPI } from '../api';

export const useFCM = (user) => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // FCM token'ı backend'e kaydet
  const registerToken = useCallback(async (token) => {
    if (!token || !user) return;

    try {
      await notificationsAPI.registerFCM({
        fcm_token: token,
        device_id: await getDeviceId(),
        device_name: getDeviceName(),
        platform: 'android'
      });
      console.log('[FCM] Token registered with backend');
    } catch (err) {
      console.error('[FCM] Failed to register token:', err);
    }
  }, [user]);

  // FCM başlat
  const initializeFCM = useCallback(async () => {
    // Sadece native platformda çalış
    if (!Capacitor.isNativePlatform()) {
      console.log('[FCM] Not a native platform, skipping');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // İzin kontrolü
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[FCM] Permission status:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('[FCM] Permission not granted');
        setPermissionGranted(false);
        return;
      }

      setPermissionGranted(true);

      // Push notification listener'ları ekle
      await PushNotifications.addListener('registration', (token) => {
        console.log('[FCM] Token received:', token.value);
        setFcmToken(token.value);
        registerToken(token.value);
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM] Registration error:', err);
        setError(err.error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[FCM] Notification received:', notification);
        // Uygulama açıkken gelen bildirimler için event dispatch et
        window.dispatchEvent(new CustomEvent('pushNotification', { 
          detail: notification 
        }));
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[FCM] Notification action:', action);
        // Bildirime tıklandığında navigasyon yap
        const data = action.notification.data;
        if (data?.navigate_to) {
          window.location.href = data.navigate_to;
        }
      });

      // Kaydı başlat
      await PushNotifications.register();
      console.log('[FCM] Registration started');

    } catch (err) {
      console.error('[FCM] Initialization error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [registerToken]);

  // Native event listener (MainActivity'den gelen token)
  useEffect(() => {
    const handleNativeToken = (event) => {
      const token = event.detail;
      console.log('[FCM] Token from native:', token);
      setFcmToken(token);
      if (user) {
        registerToken(token);
      }
    };

    window.addEventListener('fcmToken', handleNativeToken);
    return () => window.removeEventListener('fcmToken', handleNativeToken);
  }, [user, registerToken]);

  // User değiştiğinde FCM'i başlat
  useEffect(() => {
    if (user && Capacitor.isNativePlatform()) {
      initializeFCM();
    }
  }, [user, initializeFCM]);

  return {
    fcmToken,
    permissionGranted,
    loading,
    error,
    reinitialize: initializeFCM
  };
};

// Yardımcı fonksiyonlar
async function getDeviceId() {
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getId();
    return info.identifier;
  } catch {
    return 'unknown';
  }
}

function getDeviceName() {
  try {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Android')) {
      const match = userAgent.match(/Android\s[\d.]+;\s([^;]+)/);
      return match ? match[1].trim() : 'Android Device';
    }
    return 'Unknown Device';
  } catch {
    return 'Unknown Device';
  }
}

export default useFCM;


