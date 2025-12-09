/**
 * OneSignal Konfigürasyonu
 * Tüm push bildirimleri OneSignal üzerinden yönetilir
 */

// OneSignal App ID (public identifier - not a secret)
const ONESIGNAL_APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID || '207f0010-c2d6-4903-9e9d-1e72dfbc3ae2';

// Production domain kontrolü - daha geniş kontrol
const ALLOWED_DOMAINS = ['abro.ldserp.com', 'healmedy.com', 'ldserp.com'];
const isProductionDomain = () => {
  const hostname = window.location.hostname;
  const isProduction = ALLOWED_DOMAINS.some(domain => hostname.includes(domain));
  console.log('[OneSignal] Domain check:', hostname, '- Is production:', isProduction);
  return isProduction;
};

let isInitialized = false;
let initPromise = null;
let initError = null;
let sdkLoadAttempted = false;

/**
 * OneSignal SDK script'ini yükle
 */
const loadOneSignalScript = () => {
  return new Promise((resolve, reject) => {
    console.log('[OneSignal] Loading SDK script...');
    
    // SDK zaten yüklü mü?
    if (window.OneSignal) {
      console.log('[OneSignal] SDK already available (window.OneSignal exists)');
      resolve();
      return;
    }
    
    if (window.OneSignalDeferred && window.OneSignalDeferred.length > 0) {
      console.log('[OneSignal] OneSignalDeferred already exists');
      resolve();
      return;
    }

    // Script tag zaten varsa bekle
    const existingScript = document.getElementById('onesignal-sdk');
    if (existingScript) {
      console.log('[OneSignal] Script tag already exists, waiting for load...');
      const checkLoaded = setInterval(() => {
        if (window.OneSignal || window.OneSignalDeferred) {
          clearInterval(checkLoaded);
          console.log('[OneSignal] SDK loaded after waiting');
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkLoaded);
        console.error('[OneSignal] SDK load timeout');
        reject(new Error('OneSignal SDK load timeout'));
      }, 15000);
      return;
    }

    // OneSignalDeferred array'ini oluştur
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    console.log('[OneSignal] Created OneSignalDeferred array');

    const script = document.createElement('script');
    script.id = 'onesignal-sdk';
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.async = true;
    
    script.onload = () => {
      console.log('[OneSignal] SDK script loaded successfully');
      sdkLoadAttempted = true;
      resolve();
    };
    
    script.onerror = (err) => {
      console.error('[OneSignal] SDK load error:', err);
      sdkLoadAttempted = true;
      reject(new Error('Failed to load OneSignal SDK'));
    };
    
    console.log('[OneSignal] Appending script to head...');
    document.head.appendChild(script);
  });
};

/**
 * OneSignal'i başlat
 * @param {string} userId - Kullanıcı ID'si (external_user_id olarak kaydedilir)
 * @param {object} userTags - Kullanıcı tag'leri (rol, vb.)
 */
export const initOneSignal = async (userId, userTags = {}) => {
  console.log('[OneSignal] initOneSignal called with userId:', userId);
  
  if (!ONESIGNAL_APP_ID) {
    console.warn('[OneSignal] App ID not configured');
    initError = 'App ID yapılandırılmamış';
    return null;
  }
  
  console.log('[OneSignal] App ID:', ONESIGNAL_APP_ID);

  // Localhost kontrolü - OneSignal sadece production domain'de çalışır
  const isProd = isProductionDomain();
  if (!isProd) {
    console.warn('[OneSignal] Not production domain - skipping initialization');
    initError = 'localhost';
    isInitialized = true;
    return { isLocalhost: true };
  }

  // Zaten başlatıldıysa tekrar başlatma
  if (isInitialized && window.OneSignal) {
    console.log('[OneSignal] Already initialized, returning existing instance');
    return window.OneSignal;
  }

  // Eğer şu anda başlatılıyorsa bekle
  if (initPromise) {
    console.log('[OneSignal] Init already in progress, waiting...');
    return initPromise;
  }

  console.log('[OneSignal] Starting initialization...');

  initPromise = (async () => {
    try {
      // SDK'yı yükle
      console.log('[OneSignal] Step 1: Loading SDK...');
      await loadOneSignalScript();
      console.log('[OneSignal] Step 1 complete: SDK loaded');

      // OneSignal'i başlat (v16 API)
      console.log('[OneSignal] Step 2: Initializing OneSignal...');
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('OneSignal init timeout - SDK may not have loaded correctly'));
        }, 20000);
        
        window.OneSignalDeferred.push(async function(OneSignal) {
          try {
            console.log('[OneSignal] Inside OneSignalDeferred callback');
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              allowLocalhostAsSecureOrigin: true, // Development için true
              serviceWorkerPath: '/OneSignalSDKWorker.js',
              notifyButton: {
                enable: false
              },
              welcomeNotification: {
                disable: true
              }
            });
            
            clearTimeout(timeoutId);
            console.log('[OneSignal] Step 2 complete: Initialized successfully');
            isInitialized = true;
            window.OneSignal = OneSignal;
            resolve(OneSignal);
          } catch (err) {
            clearTimeout(timeoutId);
            console.error('[OneSignal] Init error inside callback:', err);
            reject(err);
          }
        });
      });

      // Kullanıcıyı login et
      console.log('[OneSignal] Step 3: Logging in user...');
      if (userId) {
        try {
          await window.OneSignal.login(userId);
          console.log('[OneSignal] Step 3 complete: User logged in:', userId);
        } catch (e) {
          console.warn('[OneSignal] Login error (may be expected):', e);
        }
      }

      // Tag'leri kaydet
      console.log('[OneSignal] Step 4: Setting tags...');
      if (userTags && Object.keys(userTags).length > 0) {
        try {
          await window.OneSignal.User.addTags(userTags);
          console.log('[OneSignal] Step 4 complete: Tags set:', userTags);
        } catch (e) {
          console.warn('[OneSignal] Add tags error:', e);
        }
      }

      console.log('[OneSignal] Initialization complete!');
      initError = null;
      return window.OneSignal;

    } catch (error) {
      console.error('[OneSignal] Initialization failed:', error);
      initError = error.message || 'Başlatma hatası';
      initPromise = null;
      isInitialized = false;
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

