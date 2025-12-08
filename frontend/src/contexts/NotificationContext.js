import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationsAPI } from '../api';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import {
  initOneSignal,
  requestNotificationPermission,
  isPushEnabled,
  getPlayerId,
  optInPushNotifications,
  optOutPushNotifications,
  removeExternalUserId,
  addNotificationListener,
  setUserTags,
  getInitError,
  isProduction
} from '../config/onesignal';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [oneSignalReady, setOneSignalReady] = useState(false);
  const [oneSignalError, setOneSignalError] = useState(null);
  const [isLocalhost, setIsLocalhost] = useState(!isProduction());

  // Push desteğini kontrol et
  useEffect(() => {
    const checkPushSupport = () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setPushSupported(supported);
    };
    
    checkPushSupport();
  }, []);

  // OneSignal'i başlat (kullanıcı login olduğunda)
  useEffect(() => {
    const initializeOneSignal = async () => {
      if (!isAuthenticated || !user) {
        console.log('[NotificationContext] User not authenticated, skipping OneSignal init');
        return;
      }

      console.log('[NotificationContext] Starting OneSignal initialization for user:', user.id);

      try {
        // OneSignal'i başlat
        const onesignal = await initOneSignal(user.id, {
          role: user.role,
          name: user.name
        });

        console.log('[NotificationContext] initOneSignal returned:', onesignal ? 'success' : 'null');

        // Hata durumunu kontrol et
        const error = getInitError();
        if (error) {
          console.log('[NotificationContext] Init error:', error);
          setOneSignalError(error);
          if (error === 'localhost') {
            // Localhost'ta simüle et - ready olarak işaretle
            setOneSignalReady(true);
            setIsLocalhost(true);
            console.log('[NotificationContext] Localhost mode - simulating ready state');
          }
          return;
        }

        if (onesignal && !onesignal.isLocalhost) {
          console.log('[NotificationContext] OneSignal ready, checking push status...');
          setOneSignalReady(true);
          
          // Mevcut push durumunu kontrol et
          const enabled = await isPushEnabled();
          console.log('[NotificationContext] Push enabled:', enabled);
          setPushEnabled(enabled);

          // Player ID'yi backend'e kaydet
          if (enabled) {
            const playerId = await getPlayerId();
            console.log('[NotificationContext] Player ID:', playerId);
            if (playerId) {
              try {
                await notificationsAPI.subscribe({ player_id: playerId });
                console.log('[NotificationContext] Player ID saved to backend');
              } catch (e) {
                console.warn('[NotificationContext] Player ID backend kayıt hatası:', e);
              }
            }
          }

          // Foreground bildirimleri dinle
          addNotificationListener((notification) => {
            toast.info(notification.title, {
              description: notification.body
            });
            // In-app bildirimleri yenile
            loadNotifications();
          });
          
          console.log('[NotificationContext] OneSignal fully initialized');
        } else if (onesignal?.isLocalhost) {
          // Localhost simülasyonu
          console.log('[NotificationContext] Localhost simulation mode');
          setOneSignalReady(true);
          setIsLocalhost(true);
        } else {
          console.warn('[NotificationContext] OneSignal initialization returned null or invalid');
          setOneSignalError('Başlatma başarısız');
        }
      } catch (error) {
        console.error('[NotificationContext] OneSignal initialization error:', error);
        setOneSignalError(error.message);
      }
    };

    initializeOneSignal();
  }, [isAuthenticated, user]);

  // Kullanıcı logout olduğunda OneSignal'den çıkış yap
  useEffect(() => {
    if (!isAuthenticated && oneSignalReady) {
      removeExternalUserId();
    }
  }, [isAuthenticated, oneSignalReady]);

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

  // Push bildirimleri etkinleştir
  const enablePushNotifications = async () => {
    if (!pushSupported) {
      toast.error('Tarayıcınız push bildirimleri desteklemiyor');
      return false;
    }

    if (!oneSignalReady) {
      toast.error('Bildirim sistemi henüz hazır değil');
      return false;
    }

    // Localhost kontrolü
    if (isLocalhost) {
      toast.warning('Push bildirimleri sadece production ortamında (abro.ldserp.com) aktif olur');
      return false;
    }

    try {
      // İzin iste
      const granted = await requestNotificationPermission();
      
      if (!granted) {
        toast.error('Bildirim izni reddedildi');
        return false;
      }

      // Push bildirimleri aç
      await optInPushNotifications();
      
      // Player ID'yi backend'e kaydet
      const playerId = await getPlayerId();
      if (playerId) {
        await notificationsAPI.subscribe({ player_id: playerId });
      }

      // Kullanıcı tag'lerini güncelle
      if (user) {
        await setUserTags({
          role: user.role,
          name: user.name
        });
      }
      
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
      await optOutPushNotifications();
      
      // Backend'den subscription'ı kaldır
      try {
        await notificationsAPI.unsubscribe();
      } catch (e) {
        console.warn('Backend unsubscribe error:', e);
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
  const sendTestNotification = async (type, message) => {
    try {
      const result = await notificationsAPI.sendTest({ type, message });
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
    oneSignalReady,
    oneSignalError,
    isLocalhost,
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
