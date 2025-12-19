// Merkezi API yapılandırması
// Tüm API çağrıları bu dosyadan URL'yi almalı

// Backend URL - Environment variable'dan al, yoksa localhost kullan
const getBackendUrl = () => {
  // Environment variable'dan al (REACT_APP_BACKEND_URL)
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  // Local development için localhost
  return 'http://localhost:8001';
};

export const BACKEND_URL = getBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;

// WebSocket URL (gerekirse)
export const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export default {
  BACKEND_URL,
  API_URL,
  WS_URL
};

