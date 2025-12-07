/**
 * OneSignal Konfigürasyonu
 * Tüm push bildirimleri OneSignal üzerinden yönetilir
 */

// OneSignal App ID (public identifier - not a secret)
// Environment variable veya hardcoded değer kullan
const ONESIGNAL_APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID || '207f0010-c2d6-4903-9e9d-1e72dfbc3ae2';

// Production domain kontrolü
const ALLOWED_DOMAINS = ['abro.ldserp.com', 'healmedy.com'];
const isProductionDomain = () => {
  return ALLOWED_DOMAINS.some(domain => window.location.hostname.includes(domain));
};

let isInitialized = false;
let initPromise = null;
let initError = null;

/**
 * OneSignal SDK script'ini yükle
 */
const loadOneSignalScript = () => {
  return new Promise((resolve, reject) => {
    // SDK zaten yüklü mü?
    if (window.OneSignalDeferred) {
      console.log('[OneSignal] SDK already loaded');
      resolve();
      return;
    }

    if (document.getElementById('onesignal-sdk')) {
      // Script tag var ama henüz yüklenmemiş olabilir
      const checkLoaded = setInterval(() => {
        if (window.OneSignalDeferred) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkLoaded);
        reject(new Error('OneSignal SDK load timeout'));
      }, 10000);
      return;
    }

    // OneSignalDeferred array'ini oluştur
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const script = document.createElement('script');
    script.id = 'onesignal-sdk';
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('[OneSignal] SDK script loaded');
      resolve();
    };
    
    script.onerror = (err) => {
      console.error('[OneSignal] SDK load error:', err);
      reject(err);
    };
    
    document.head.appendChild(script);
  });
};

/**
 * OneSignal'i başlat
 * @param {string} userId - Kullanıcı ID'si (external_user_id olarak kaydedilir)
 * @param {object} userTags - Kullanıcı tag'leri (rol, vb.)
 */
export const initOneSignal = async (userId, userTags = {}) => {
  if (!ONESIGNAL_APP_ID) {
    console.warn('[OneSignal] App ID not configured');
    initError = 'App ID yapılandırılmamış';
    return null;
  }

  // Localhost kontrolü - OneSignal sadece production domain'de çalışır
  if (!isProductionDomain()) {
    console.warn('[OneSignal] OneSignal sadece production domaininde çalışır (abro.ldserp.com)');
    initError = 'localhost';
    // Localhost'ta çalışmıyor, simüle edelim
    isInitialized = true;
    return { isLocalhost: true };
  }

  // Zaten başlatıldıysa tekrar başlatma
  if (isInitialized && window.OneSignal) {
    console.log('[OneSignal] Already initialized');
    return window.OneSignal;
  }

  // Eğer şu anda başlatılıyorsa bekle
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // SDK'yı yükle
      await loadOneSignalScript();

      // OneSignal'i başlat (v16 API)
      await new Promise((resolve, reject) => {
        window.OneSignalDeferred.push(async function(OneSignal) {
          try {
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              allowLocalhostAsSecureOrigin: false,
              serviceWorkerPath: '/OneSignalSDKWorker.js',
              notifyButton: {
                enable: false
              },
              welcomeNotification: {
                disable: true
              }
            });
            
            console.log('[OneSignal] Initialized successfully');
            isInitialized = true;
            window.OneSignal = OneSignal;
            resolve(OneSignal);
          } catch (err) {
            reject(err);
          }
        });
      });

      // Kullanıcıyı login et
      if (userId) {
        try {
          await window.OneSignal.login(userId);
          console.log('[OneSignal] User logged in:', userId);
        } catch (e) {
          console.warn('[OneSignal] Login error (may be expected):', e);
        }
      }

      // Tag'leri kaydet
      if (userTags && Object.keys(userTags).length > 0) {
        try {
          await window.OneSignal.User.addTags(userTags);
          console.log('[OneSignal] Tags set:', userTags);
        } catch (e) {
          console.warn('[OneSignal] Add tags error:', e);
        }
      }

      return window.OneSignal;

    } catch (error) {
      console.error('[OneSignal] Initialization error:', error);
      initError = error.message || 'Başlatma hatası';
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
};

/**
 * OneSignal hata durumunu al
 */
export const getInitError = () => initError;

/**
 * Production domain'de mi kontrol et
 */
export const isProduction = () => isProductionDomain();

/**
 * Push bildirim izni iste
 */
export const requestNotificationPermission = async () => {
  if (!window.OneSignal) {
    console.warn('[OneSignal] SDK not loaded');
    return false;
  }

  try {
    // v16 API - Notifications.requestPermission()
    const result = await window.OneSignal.Notifications.requestPermission();
    console.log('[OneSignal] Permission result:', result);
    return result;
  } catch (error) {
    console.error('[OneSignal] Permission request error:', error);
    return false;
  }
};

/**
 * Push bildirimleri aktif mi kontrol et
 */
export const isPushEnabled = async () => {
  if (!window.OneSignal) {
    return false;
  }

  try {
    // v16 API - permission doğrudan bir boolean döner
    const permission = window.OneSignal.Notifications.permission;
    const optedIn = window.OneSignal.User?.PushSubscription?.optedIn;
    console.log('[OneSignal] Permission:', permission, 'OptedIn:', optedIn);
    return permission === true && optedIn === true;
  } catch (error) {
    console.error('[OneSignal] isPushEnabled error:', error);
    return false;
  }
};

/**
 * Player ID (subscription ID) al
 */
export const getPlayerId = async () => {
  if (!window.OneSignal) {
    return null;
  }

  try {
    // v16 API - User.PushSubscription.id
    const playerId = window.OneSignal.User?.PushSubscription?.id;
    console.log('[OneSignal] Player ID:', playerId);
    return playerId || null;
  } catch (error) {
    console.error('[OneSignal] Get player ID error:', error);
    return null;
  }
};

/**
 * Push bildirimleri kapat
 */
export const optOutPushNotifications = async () => {
  if (!window.OneSignal) {
    return false;
  }

  try {
    await window.OneSignal.User.PushSubscription.optOut();
    console.log('[OneSignal] Opted out of push notifications');
    return true;
  } catch (error) {
    console.error('[OneSignal] Opt out error:', error);
    return false;
  }
};

/**
 * Push bildirimleri aç
 */
export const optInPushNotifications = async () => {
  if (!window.OneSignal) {
    return false;
  }

  try {
    await window.OneSignal.User.PushSubscription.optIn();
    console.log('[OneSignal] Opted in to push notifications');
    return true;
  } catch (error) {
    console.error('[OneSignal] Opt in error:', error);
    return false;
  }
};

/**
 * Kullanıcı tag'lerini güncelle
 */
export const setUserTags = async (tags) => {
  if (!window.OneSignal) {
    return false;
  }

  try {
    // v16 API - User.addTags
    await window.OneSignal.User.addTags(tags);
    console.log('[OneSignal] Tags updated:', tags);
    return true;
  } catch (error) {
    console.error('[OneSignal] Set tags error:', error);
    return false;
  }
};

/**
 * Kullanıcı çıkışı (logout'ta kullanılır)
 */
export const removeExternalUserId = async () => {
  if (!window.OneSignal) {
    return false;
  }

  try {
    // v16 API - logout
    await window.OneSignal.logout();
    console.log('[OneSignal] User logged out');
    return true;
  } catch (error) {
    console.error('[OneSignal] Logout error:', error);
    return false;
  }
};

/**
 * Bildirim event listener ekle
 */
export const addNotificationListener = (callback) => {
  if (!window.OneSignal) {
    return () => {};
  }

  try {
    // Foreground bildirimleri
    const foregroundHandler = (event) => {
      console.log('[OneSignal] Foreground notification:', event.notification);
      if (callback) {
        callback(event.notification);
      }
    };

    // Tıklama eventi
    const clickHandler = (event) => {
      console.log('[OneSignal] Notification clicked:', event);
      // URL varsa yönlendir
      if (event.notification?.data?.url) {
        window.location.href = event.notification.data.url;
      }
    };

    window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', foregroundHandler);
    window.OneSignal.Notifications.addEventListener('click', clickHandler);

    // Cleanup fonksiyonu
    return () => {
      try {
        window.OneSignal.Notifications.removeEventListener('foregroundWillDisplay', foregroundHandler);
        window.OneSignal.Notifications.removeEventListener('click', clickHandler);
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  } catch (error) {
    console.error('[OneSignal] Add listener error:', error);
    return () => {};
  }
};

export default {
  initOneSignal,
  requestNotificationPermission,
  isPushEnabled,
  getPlayerId,
  optOutPushNotifications,
  optInPushNotifications,
  setUserTags,
  removeExternalUserId,
  addNotificationListener,
  getInitError,
  isProduction
};

