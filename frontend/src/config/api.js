// Merkezi API yapılandırması
// Tüm API çağrıları bu dosyadan URL'yi almalı

// Production backend URL - Railway'de deploy edilen backend
export const BACKEND_URL = 'https://lockdownsofthbys-backend-production.up.railway.app';
export const API_URL = `${BACKEND_URL}/api`;

// WebSocket URL (gerekirse)
export const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export default {
  BACKEND_URL,
  API_URL,
  WS_URL
};

