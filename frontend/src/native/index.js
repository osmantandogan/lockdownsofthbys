/**
 * NativeBridge - Capacitor Native API Wrapper
 * GPS, Kamera, Network, Storage ve diğer native API'ler için merkezi yönetim
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// ==================== PLATFORM DETECTION ====================

const isNativeApp = () => Capacitor.isNativePlatform();
const getPlatform = () => Capacitor.getPlatform(); // 'web', 'android', 'ios'

// ==================== NETWORK ====================

let networkStatusCallback = null;
let networkListener = null;

const getNetworkStatus = async () => {
  try {
    if (!isNativeApp()) {
      return { connected: navigator.onLine, connectionType: 'unknown' };
    }
    const status = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType // 'wifi', 'cellular', 'none', 'unknown'
    };
  } catch (error) {
    console.error('[NativeBridge] Network status error:', error);
    return { connected: true, connectionType: 'unknown' };
  }
};

const watchNetworkStatus = (callback) => {
  networkStatusCallback = callback;
  
  if (!isNativeApp()) {
    // Web fallback
    const handleOnline = () => callback({ connected: true, connectionType: 'unknown' });
    const handleOffline = () => callback({ connected: false, connectionType: 'none' });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
  
  // Native listener
  networkListener = Network.addListener('networkStatusChange', (status) => {
    callback({
      connected: status.connected,
      connectionType: status.connectionType
    });
  });
  
  return () => {
    if (networkListener) {
      networkListener.remove();
    }
  };
};

// ==================== GEOLOCATION ====================

let watchId = null;

const checkLocationPermission = async () => {
  try {
    if (!isNativeApp()) {
      // Web'de izin kontrolü
      if (!navigator.permissions) return { granted: false };
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return { granted: result.state === 'granted', state: result.state };
    }
    
    const permission = await Geolocation.checkPermissions();
    return {
      granted: permission.location === 'granted',
      coarseGranted: permission.coarseLocation === 'granted',
      state: permission.location
    };
  } catch (error) {
    console.error('[NativeBridge] Location permission check error:', error);
    return { granted: false, state: 'denied' };
  }
};

const requestLocationPermission = async () => {
  try {
    if (!isNativeApp()) {
      // Web'de izin isteme - getCurrentPosition ile tetiklenir
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve({ granted: true }),
          () => resolve({ granted: false }),
          { timeout: 5000 }
        );
      });
    }
    
    const permission = await Geolocation.requestPermissions();
    return {
      granted: permission.location === 'granted',
      coarseGranted: permission.coarseLocation === 'granted'
    };
  } catch (error) {
    console.error('[NativeBridge] Location permission request error:', error);
    return { granted: false };
  }
};

const getCurrentPosition = async (options = {}) => {
  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 60000
  };
  
  const opts = { ...defaultOptions, ...options };
  
  try {
    if (!isNativeApp()) {
      // Web fallback
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp
            });
          },
          reject,
          opts
        );
      });
    }
    
    const position = await Geolocation.getCurrentPosition(opts);
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp
    };
  } catch (error) {
    console.error('[NativeBridge] Get position error:', error);
    throw error;
  }
};

const watchPosition = (callback, options = {}) => {
  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 10000
  };
  
  const opts = { ...defaultOptions, ...options };
  
  if (!isNativeApp()) {
    // Web fallback
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        });
      },
      (error) => {
        console.error('[NativeBridge] Watch position error:', error);
      },
      opts
    );
    
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };
  }
  
  // Native watch
  const startWatch = async () => {
    try {
      watchId = await Geolocation.watchPosition(opts, (position, err) => {
        if (err) {
          console.error('[NativeBridge] Watch position error:', err);
          return;
        }
        
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        });
      });
    } catch (error) {
      console.error('[NativeBridge] Start watch error:', error);
    }
  };
  
  startWatch();
  
  return async () => {
    if (watchId !== null) {
      await Geolocation.clearWatch({ id: watchId });
      watchId = null;
    }
  };
};

const stopWatchingPosition = async () => {
  if (watchId !== null) {
    if (isNativeApp()) {
      await Geolocation.clearWatch({ id: watchId });
    } else {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  }
};

// ==================== CAMERA ====================

const checkCameraPermission = async () => {
  try {
    if (!isNativeApp()) {
      // Web'de izin kontrolü
      if (!navigator.permissions) return { granted: false };
      const result = await navigator.permissions.query({ name: 'camera' });
      return { granted: result.state === 'granted', state: result.state };
    }
    
    const permission = await Camera.checkPermissions();
    return {
      granted: permission.camera === 'granted',
      photos: permission.photos === 'granted',
      state: permission.camera
    };
  } catch (error) {
    console.error('[NativeBridge] Camera permission check error:', error);
    return { granted: false, state: 'denied' };
  }
};

const requestCameraPermission = async () => {
  try {
    if (!isNativeApp()) {
      // Web'de kamera izni getUserMedia ile alınır
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return { granted: true };
      } catch {
        return { granted: false };
      }
    }
    
    const permission = await Camera.requestPermissions();
    return {
      granted: permission.camera === 'granted',
      photos: permission.photos === 'granted'
    };
  } catch (error) {
    console.error('[NativeBridge] Camera permission request error:', error);
    return { granted: false };
  }
};

const takePhoto = async (options = {}) => {
  const defaultOptions = {
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    saveToGallery: false,
    correctOrientation: true
  };
  
  const opts = { ...defaultOptions, ...options };
  
  try {
    if (!isNativeApp()) {
      // Web fallback - file input kullan
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        
        input.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            reject(new Error('No file selected'));
            return;
          }
          
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve({
              base64,
              format: file.type.split('/')[1],
              dataUrl: reader.result
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        };
        
        input.click();
      });
    }
    
    const photo = await Camera.getPhoto(opts);
    return {
      base64: photo.base64String,
      format: photo.format,
      dataUrl: `data:image/${photo.format};base64,${photo.base64String}`,
      webPath: photo.webPath,
      path: photo.path
    };
  } catch (error) {
    console.error('[NativeBridge] Take photo error:', error);
    throw error;
  }
};

const pickImage = async (options = {}) => {
  const opts = {
    quality: 80,
    resultType: CameraResultType.Base64,
    source: CameraSource.Photos,
    ...options
  };
  
  return takePhoto(opts);
};

// ==================== STORAGE (Preferences) ====================

const setItem = async (key, value) => {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await Preferences.set({ key, value: stringValue });
    return true;
  } catch (error) {
    console.error('[NativeBridge] Set item error:', error);
    // Fallback to localStorage
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};

const getItem = async (key, parseJson = true) => {
  try {
    const { value } = await Preferences.get({ key });
    if (value === null) return null;
    if (parseJson) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  } catch (error) {
    console.error('[NativeBridge] Get item error:', error);
    // Fallback to localStorage
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    } catch {
      return null;
    }
  }
};

const removeItem = async (key) => {
  try {
    await Preferences.remove({ key });
    return true;
  } catch (error) {
    console.error('[NativeBridge] Remove item error:', error);
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};

const clearStorage = async () => {
  try {
    await Preferences.clear();
    return true;
  } catch (error) {
    console.error('[NativeBridge] Clear storage error:', error);
    return false;
  }
};

// ==================== SESSION MANAGEMENT ====================

const SESSIONS_KEY = 'healmedy_sessions';
const MAX_SESSIONS = 3;

const getSessions = async () => {
  const sessions = await getItem(SESSIONS_KEY) || { activeSessionId: null, sessions: [] };
  
  // Ensure we have 3 session slots
  while (sessions.sessions.length < MAX_SESSIONS) {
    sessions.sessions.push({
      id: `slot_${sessions.sessions.length + 1}`,
      status: 'empty',
      userName: null,
      role: null,
      token: null,
      lastActive: null
    });
  }
  
  return sessions;
};

const addSession = async (sessionData) => {
  const sessions = await getSessions();
  
  // Find empty slot
  const emptySlotIndex = sessions.sessions.findIndex(s => s.status === 'empty');
  if (emptySlotIndex === -1) {
    throw new Error('Tüm oturum slotları dolu. Önce bir oturumu kapatın.');
  }
  
  const newSession = {
    id: `session_${Date.now()}`,
    status: 'active',
    userId: sessionData.userId,
    userName: sessionData.userName,
    role: sessionData.role,
    avatar: sessionData.avatar,
    token: sessionData.token,
    refreshToken: sessionData.refreshToken,
    shiftId: sessionData.shiftId,
    lastActive: new Date().toISOString()
  };
  
  // Mark other sessions as idle
  sessions.sessions = sessions.sessions.map(s => 
    s.status === 'active' ? { ...s, status: 'idle' } : s
  );
  
  sessions.sessions[emptySlotIndex] = newSession;
  sessions.activeSessionId = newSession.id;
  
  await setItem(SESSIONS_KEY, sessions);
  return newSession;
};

const switchSession = async (sessionId) => {
  const sessions = await getSessions();
  
  const session = sessions.sessions.find(s => s.id === sessionId);
  if (!session || session.status === 'empty') {
    throw new Error('Geçersiz oturum');
  }
  
  // Mark current active as idle, new one as active
  sessions.sessions = sessions.sessions.map(s => ({
    ...s,
    status: s.id === sessionId ? 'active' : (s.status === 'active' ? 'idle' : s.status)
  }));
  
  sessions.activeSessionId = sessionId;
  session.lastActive = new Date().toISOString();
  
  await setItem(SESSIONS_KEY, sessions);
  return session;
};

const logoutSession = async (sessionId) => {
  const sessions = await getSessions();
  
  const sessionIndex = sessions.sessions.findIndex(s => s.id === sessionId);
  if (sessionIndex === -1) {
    throw new Error('Oturum bulunamadı');
  }
  
  // Clear the session slot
  sessions.sessions[sessionIndex] = {
    id: `slot_${sessionIndex + 1}`,
    status: 'empty',
    userName: null,
    role: null,
    token: null,
    lastActive: null
  };
  
  if (sessions.activeSessionId === sessionId) {
    // Find another active session
    const activeSession = sessions.sessions.find(s => s.status !== 'empty');
    sessions.activeSessionId = activeSession?.id || null;
  }
  
  await setItem(SESSIONS_KEY, sessions);
  return true;
};

const getActiveSession = async () => {
  const sessions = await getSessions();
  return sessions.sessions.find(s => s.id === sessions.activeSessionId) || null;
};

// ==================== FILE SYSTEM ====================

const writeFile = async (path, data, directory = Directory.Data) => {
  try {
    await Filesystem.writeFile({
      path,
      data,
      directory,
      encoding: Encoding.UTF8
    });
    return true;
  } catch (error) {
    console.error('[NativeBridge] Write file error:', error);
    return false;
  }
};

const readFile = async (path, directory = Directory.Data) => {
  try {
    const result = await Filesystem.readFile({
      path,
      directory,
      encoding: Encoding.UTF8
    });
    return result.data;
  } catch (error) {
    console.error('[NativeBridge] Read file error:', error);
    return null;
  }
};

const deleteFile = async (path, directory = Directory.Data) => {
  try {
    await Filesystem.deleteFile({ path, directory });
    return true;
  } catch (error) {
    console.error('[NativeBridge] Delete file error:', error);
    return false;
  }
};

// ==================== EXPORT ====================

const NativeBridge = {
  // Platform
  isNativeApp,
  getPlatform,
  
  // Network
  getNetworkStatus,
  watchNetworkStatus,
  
  // Geolocation
  checkLocationPermission,
  requestLocationPermission,
  getCurrentPosition,
  watchPosition,
  stopWatchingPosition,
  
  // Camera
  checkCameraPermission,
  requestCameraPermission,
  takePhoto,
  pickImage,
  
  // Storage
  setItem,
  getItem,
  removeItem,
  clearStorage,
  
  // Sessions
  getSessions,
  addSession,
  switchSession,
  logoutSession,
  getActiveSession,
  
  // File System
  writeFile,
  readFile,
  deleteFile
};

export default NativeBridge;






