// Merkezi API yapılandırması
// Tüm API çağrıları bu dosyadan URL'yi almalı

// Production backend URL - HARDCODED for reliability
const PRODUCTION_BACKEND_URL = 'https://lockdownsofthbys-backend-production.up.railway.app';

// Backend URL - Environment variable'dan al, yoksa production URL kullan
const getBackendUrl = () => {
  // Environment variable'dan al (REACT_APP_BACKEND_URL)
  if (process.env.REACT_APP_BACKEND_URL) {
    let url = process.env.REACT_APP_BACKEND_URL;
    // Protokol eksikse ekle
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    console.log('[API Config] Using env REACT_APP_BACKEND_URL:', url);
    return url;
  }
  
  // Production ortamında (localhost değilse) production backend URL'ini kullan
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    console.log('[API Config] Hostname:', hostname);
    
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      console.log('[API Config] Using production URL:', PRODUCTION_BACKEND_URL);
      return PRODUCTION_BACKEND_URL;
    }
  }
  
  // Local development için localhost
  console.log('[API Config] Using localhost:8000');
  return 'http://localhost:8000';
};

export const BACKEND_URL = getBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;

// Log the final URL
console.log('[API Config] === FINAL BACKEND_URL:', BACKEND_URL);
console.log('[API Config] === FINAL API_URL:', API_URL);

// WebSocket URL (gerekirse)
export const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export default {
  BACKEND_URL,
  API_URL,
  WS_URL
};

