const { contextBridge, ipcRenderer } = require('electron');

// Renderer process'e güvenli API'ler expose et
contextBridge.exposeInMainWorld('electronAPI', {
  // Uygulama bilgileri
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Bildirimler
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  
  // Pencere kontrolü
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  
  // Platform kontrolü
  isElectron: true,
  isDesktop: true,
  
  // Güncelleme olayları
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
});

// Global olarak electron var mı kontrolü için
contextBridge.exposeInMainWorld('isElectron', true);

console.log('Healmedy Ambulans Preload yüklendi');



