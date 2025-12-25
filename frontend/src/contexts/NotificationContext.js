import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { notificationsAPI } from '../api';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import EmergencyCaseAlert from '../components/EmergencyCaseAlert';

// FCM (Firebase Cloud Messaging) ile push bildirimleri

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated, isSwitchingRole } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [fcmEnabled, setFcmEnabled] = useState(false);
  
  // Acil durum ekranı state'i
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);

  // FCM başlat (Android için)
  useEffect(() => {
    const initializeFCM = async () => {
      if (!Capacitor.isNativePlatform()) return;
      if (!isAuthenticated || !user) return;
      
      // Rol değişikliği sırasında bekle
      if (isSwitchingRole) {
        console.log('[FCM] Role switching in progress, waiting...');
        return;
      }

      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        // İzin kontrolü
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('[FCM] Permission not granted');
          return;
        }

        // Token listener
        await PushNotifications.addListener('registration', async (token) => {
          console.log('[FCM] Token:', token.value);
          setFcmToken(token.value);
          setFcmEnabled(true);
          
          // Token'ı localStorage'a kaydet (logout sırasında kullanmak için)
          try {
            localStorage.setItem('healmedy_fcm_token', token.value);
          } catch (e) {
            console.warn('[FCM] Failed to save token to localStorage:', e);
          }

          // Backend'e kaydet
          try {
            await notificationsAPI.registerFCM({
              fcm_token: token.value,
              platform: 'android'
            });
            console.log('[FCM] Token registered with backend');
          } catch (err) {
            console.error('[FCM] Failed to register token:', err);
          }
        });

        // Bildirim listener'ları
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[FCM] Notification received:', notification);
          
          // Acil vaka bildirimi kontrolü
          const data = notification.data || {};
          const type = data.type || '';
          
          if (type === 'new_case' || type === 'case_assigned' || type === 'emergency') {
            // Acil durum ekranını göster
            // Native'de EmergencyPopupActivity zaten tetikleniyor olabilir,
            // ama yedek olarak web popup'ını da göster (data-only mesajlar için)
            console.log('[FCM] 🚨 Emergency notification - showing alert');
            setEmergencyAlert({
              caseId: data.case_id,
              caseNumber: data.case_number,
              patientName: data.patient_name,
              patientPhone: data.patient_phone,
              patientComplaint: data.patient_complaint,
              address: data.address
            });
            setShowEmergencyAlert(true);
          } else {
            toast.info(notification.title, { description: notification.body });
          }
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[FCM] Notification action:', action);
          const data = action.notification.data;
          if (data?.navigate_to) {
            window.location.href = data.navigate_to;
          }
        });

        // Kaydı başlat
        await PushNotifications.register();
        console.log('[FCM] Registration started');

      } catch (err) {
        console.error('[FCM] Init error:', err);
      }
    };

    initializeFCM();
  }, [isAuthenticated, user, isSwitchingRole]);

  // Native event listener (MainActivity'den gelen token)
  useEffect(() => {
    const handleNativeToken = async (event) => {
      const token = event.detail;
      console.log('[FCM] Token from native:', token);
      setFcmToken(token);
      setFcmEnabled(true);
      
      // Token'ı localStorage'a kaydet (logout sırasında kullanmak için)
      try {
        localStorage.setItem('healmedy_fcm_token', token);
        console.log('[FCM] Token saved to localStorage');
      } catch (e) {
        console.warn('[FCM] Failed to save token to localStorage:', e);
      }

      if (user) {
        try {
          await notificationsAPI.registerFCM({
            fcm_token: token,
            platform: 'android'
          });
        } catch (err) {
          console.error('[FCM] Failed to register native token:', err);
        }
      }
    };

    window.addEventListener('fcmToken', handleNativeToken);
    return () => window.removeEventListener('fcmToken', handleNativeToken);
  }, [user]);

  // Push desteğini kontrol et
  useEffect(() => {
    const checkPushSupport = () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setPushSupported(supported);
    };
    
    checkPushSupport();
  }, []);

  // FCM durumuna göre push'u güncelle
  useEffect(() => {
    setPushEnabled(fcmEnabled);
  }, [fcmEnabled]);

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

  // Push bildirimleri etkinleştir (FCM için)
  const enablePushNotifications = async () => {
    // Native platformda FCM otomatik olarak etkin
    if (Capacitor.isNativePlatform()) {
      if (fcmEnabled) {
        toast.success('Push bildirimleri zaten etkin (FCM)');
        return true;
      }
      toast.info('Push bildirimleri FCM ile yönetiliyor');
      return true;
    }
    
    // Web'de tarayıcı bildirimlerini kullan
    if (!pushSupported) {
      toast.error('Tarayıcınız push bildirimleri desteklemiyor');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        toast.success('Bildirim izni verildi');
        return true;
      } else {
        toast.error('Bildirim izni reddedildi');
        return false;
      }
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      toast.error('Push bildirimleri etkinleştirilemedi');
      return false;
    }
  };

  // Push bildirimleri devre dışı bırak
  const disablePushNotifications = async () => {
    try {
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

  // Acil durum ekranını göster (dışarıdan çağrılabilir)
  const showEmergencyCase = useCallback((caseData) => {
    setEmergencyAlert(caseData);
    setShowEmergencyAlert(true);
  }, []);

  // Acil durum ekranını kapat
  const closeEmergencyAlert = useCallback(() => {
    setShowEmergencyAlert(false);
    setEmergencyAlert(null);
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    pushEnabled,
    pushSupported,
    fcmToken,
    fcmEnabled,
    loadNotifications,
    enablePushNotifications,
    disablePushNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendTestNotification,
    // Acil durum ekranı
    showEmergencyCase,
    closeEmergencyAlert,
    emergencyAlert,
    showEmergencyAlert
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Acil Durum Ekranı - Web için fallback */}
      <EmergencyCaseAlert
        isOpen={showEmergencyAlert}
        onClose={closeEmergencyAlert}
        caseData={emergencyAlert}
        onGoToCase={() => {
          closeEmergencyAlert();
        }}
        onExcuse={() => {
          toast.info('Mazeret bildirimi özelliği yakında eklenecek');
          closeEmergencyAlert();
        }}
      />
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
