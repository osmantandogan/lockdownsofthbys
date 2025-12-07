/**
 * Firebase Configuration
 * FCM (Firebase Cloud Messaging) için yapılandırma
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAnalytics } from 'firebase/analytics';

// Firebase config - .env dosyasından alınacak
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || ""
};

// Firebase'i initialize et
let app = null;
let messaging = null;

try {
  app = initializeApp(firebaseConfig);
  
  // Analytics (sadece production'da)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    try {
      getAnalytics(app);
    } catch (e) {
      console.warn('Analytics initialization failed:', e);
    }
  }
  
  // Messaging sadece browser'da çalışır
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
  
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

/**
 * FCM Token al
 */
export const getFCMToken = async () => {
  if (!messaging) {
    console.warn('FCM messaging not available');
    return null;
  }

  try {
    // VAPID key backend'den alınacak (Firebase Console'dan)
    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY || "";
    
    if (!vapidKey) {
      console.warn('FCM VAPID key not configured');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    
    if (token) {
      console.log('FCM Token:', token);
      return token;
    } else {
      console.warn('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Foreground mesajları dinle (sayfa açıkken)
 */
export const onMessageListener = () => {
  if (!messaging) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log('FCM message received:', payload);
      resolve(payload);
    });
  });
};

export { app, messaging };
export default app;

