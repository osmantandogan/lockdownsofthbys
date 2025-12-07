import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationsAPI } from '../api';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { getFCMToken, onMessageListener } from '../config/firebase';

const NotificationContext = createContext(null);

// URL-safe base64 encode
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  // Push desteğini kontrol et
  useEffect(() => {
    const checkPushSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setPushSupported(supported);
      
      if (supported) {
        // Mevcut izin durumunu kontrol et
        if (Notification.permission === 'granted') {
          checkExistingSubscription();
        }
      }
    };
    
    checkPushSupport();
  }, []);

  // Mevcut subscription'ı kontrol et
  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(!!subscription);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  // Bildirimleri yükle
  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const [notifRes, countRes] = await Promise.all([
        notificationsAPI.getAll({ limit: 50 }),
        notificationsAPI.getUnreadCount()
      ]);
      
      setNotifications(notifRes.data);
      setUnreadCount(countRes.data.count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // İlk yükleme ve periyodik güncelleme
  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      
      // Her 30 saniyede bir güncelle
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loadNotifications]);

  // Push bildirimleri etkinleştir (FCM veya VAPID)
  const enablePushNotifications = async () => {
    if (!pushSupported) {
      toast.error('Tarayıcınız push bildirimleri desteklemiyor');
      return false;
    }

    try {
      // İzin iste
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error('Bildirim izni reddedildi');
        return false;
      }

      // Önce FCM token'ı dene
      let fcmToken = null;
      try {
        fcmToken = await getFCMToken();
        if (fcmToken) {
          // FCM token'ı backend'e kaydet
          await notificationsAPI.subscribeFCM(fcmToken);
          setPushEnabled(true);
          toast.success('FCM push bildirimleri etkinleştirildi');
          
          // Foreground mesajları dinle
          onMessageListener().then((payload) => {
            if (payload) {
              toast.info(payload.notification?.title || 'Yeni bildirim', {
                description: payload.notification?.body
              });
            }
          });
          
          return true;
        }
      } catch (fcmError) {
        console.warn('FCM not available, falling back to VAPID:', fcmError);
      }

      // FCM yoksa VAPID kullan
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // VAPID public key'i al
      let vapidPublicKey;
      try {
        const keyRes = await notificationsAPI.getVapidPublicKey();
        vapidPublicKey = keyRes.data.publicKey;
      } catch (e) {
        console.warn('VAPID key not configured');
        toast.warning('Push bildirimleri henüz yapılandırılmamış');
        return false;
      }

      // Push subscription oluştur
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Subscription'ı backend'e gönder
      await notificationsAPI.subscribePush(subscription.toJSON());
      
      setPushEnabled(true);
      toast.success('Push bildirimleri etkinleştirildi');
      return true;

    } catch (error) {
      console.error('Error enabling push notifications:', error);
      toast.error('Push bildirimleri etkinleştirilemedi');
      return false;
    }
  };

  // Push bildirimleri devre dışı bırak
  const disablePushNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await notificationsAPI.unsubscribePush(subscription.toJSON());
      }
      
      setPushEnabled(false);
      toast.success('Push bildirimleri devre dışı bırakıldı');
      return true;
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      toast.error('Push bildirimleri devre dışı bırakılamadı');
      return false;
    }
  };

  // Bildirimi okundu olarak işaretle
  const markAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Tüm bildirimleri okundu olarak işaretle
  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      toast.success('Tüm bildirimler okundu olarak işaretlendi');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('İşlem başarısız');
    }
  };

  // Bildirimi sil
  const deleteNotification = async (notificationId) => {
    try {
      await notificationsAPI.delete(notificationId);
      
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Test bildirimi gönder
  const sendTestNotification = async (type, channel, phone) => {
    try {
      const result = await notificationsAPI.sendTest({ type, channel, phone });
      toast.success('Test bildirimi gönderildi');
      return result.data;
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error(error.response?.data?.detail || 'Test bildirimi gönderilemedi');
      return null;
    }
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    pushEnabled,
    pushSupported,
    loadNotifications,
    enablePushNotifications,
    disablePushNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendTestNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;

