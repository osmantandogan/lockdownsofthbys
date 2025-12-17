/**
 * Platform Detection Utility
 * Web, Android, iOS ve Masaüstü (Electron) platformlarını tespit eder
 */

// Electron ortamında mı?
export const isElectron = () => {
  return typeof window !== 'undefined' && window.isElectron === true;
};

// Masaüstü uygulaması mı?
export const isDesktop = () => {
  return isElectron();
};

// Capacitor/Native ortamında mı?
export const isNative = () => {
  return typeof window !== 'undefined' && 
         typeof window.Capacitor !== 'undefined' && 
         window.Capacitor.isNativePlatform?.();
};

// Android mi?
export const isAndroid = () => {
  if (isNative()) {
    return window.Capacitor?.getPlatform?.() === 'android';
  }
  return /android/i.test(navigator.userAgent);
};

// iOS mu?
export const isIOS = () => {
  if (isNative()) {
    return window.Capacitor?.getPlatform?.() === 'ios';
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Web tarayıcısında mı?
export const isWeb = () => {
  return !isElectron() && !isNative();
};

// Mobil cihaz mı?
export const isMobile = () => {
  return isAndroid() || isIOS() || /Mobi|Android/i.test(navigator.userAgent);
};

// Platform bilgisi al
export const getPlatform = () => {
  if (isElectron()) return 'electron';
  if (isAndroid()) return 'android';
  if (isIOS()) return 'ios';
  if (isMobile()) return 'mobile-web';
  return 'web';
};

// Platform özelliklerini al
export const getPlatformCapabilities = () => {
  const platform = getPlatform();
  
  return {
    platform,
    canShowSystemNotifications: isElectron() || isNative(),
    canMinimizeToTray: isElectron(),
    canAutoUpdate: isElectron(),
    canAccessFileSystem: isElectron() || isNative(),
    canUseCamera: isNative() || isElectron(),
    canUseGPS: isNative() || ('geolocation' in navigator),
    canUsePushNotifications: isNative() || ('Notification' in window),
    canRunInBackground: isElectron() || isNative(),
    canUseBiometrics: isNative(),
    hasNativeUI: isElectron() || isNative(),
  };
};

// Electron API'lerine güvenli erişim
export const getElectronAPI = () => {
  if (isElectron() && typeof window !== 'undefined') {
    return window.electronAPI || null;
  }
  return null;
};

// Masaüstü bildirimi göster
export const showDesktopNotification = async (title, body, options = {}) => {
  const electronAPI = getElectronAPI();
  
  if (electronAPI?.showNotification) {
    return electronAPI.showNotification(title, body);
  }
  
  // Fallback: Web Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    return new Notification(title, { body, ...options });
  }
  
  // İzin iste
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return new Notification(title, { body, ...options });
    }
  }
  
  return null;
};

// Sistem tepsisine küçült (sadece Electron)
export const minimizeToTray = () => {
  const electronAPI = getElectronAPI();
  if (electronAPI?.minimizeToTray) {
    electronAPI.minimizeToTray();
    return true;
  }
  return false;
};

// Uygulama versiyonunu al
export const getAppVersion = async () => {
  const electronAPI = getElectronAPI();
  if (electronAPI?.getAppVersion) {
    return electronAPI.getAppVersion();
  }
  return process.env.REACT_APP_VERSION || '1.0.0';
};

// Platform-specific storage
export const getStorageAdapter = () => {
  if (isElectron()) {
    return {
      type: 'electron-store',
      persistent: true,
      secure: true,
    };
  }
  
  if (isNative()) {
    return {
      type: 'capacitor-preferences',
      persistent: true,
      secure: true,
    };
  }
  
  return {
    type: 'localStorage',
    persistent: true,
    secure: false,
  };
};

export default {
  isElectron,
  isDesktop,
  isNative,
  isAndroid,
  isIOS,
  isWeb,
  isMobile,
  getPlatform,
  getPlatformCapabilities,
  getElectronAPI,
  showDesktopNotification,
  minimizeToTray,
  getAppVersion,
  getStorageAdapter,
};

