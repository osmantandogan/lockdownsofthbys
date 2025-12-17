const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, Notification } = require('electron');
const path = require('path');

// electron-is-dev yerine basit kontrol
const isDev = !app.isPackaged;

let mainWindow;
let tray = null;

// Tek instance kontrolü
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  // Ana pencereyi oluştur
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false, // Hazır olunca göster
    backgroundColor: '#dc2626',
  });

  // Yükleme URL'si
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Hazır olunca göster (splash effect)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // DevTools (sadece development'ta)
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Harici linkleri tarayıcıda aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Kapatma davranışı - sistem tepsisine küçült
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // İlk kez küçültüldüğünde bildirim göster
      if (tray && !app.trayNotificationShown) {
        new Notification({
          title: 'Healmedy Ambulans',
          body: 'Uygulama arka planda çalışmaya devam ediyor',
          icon: path.join(__dirname, '../public/favicon.ico')
        }).show();
        app.trayNotificationShown = true;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Sistem tepsisi oluştur
  createTray();
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/favicon.ico');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Healmedy Ambulans',
      enabled: false,
      icon: trayIcon.resize({ width: 16, height: 16 })
    },
    { type: 'separator' },
    {
      label: 'Uygulamayı Aç',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Yeniden Başlat',
      click: () => {
        app.isQuitting = true;
        app.relaunch();
        app.quit();
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Healmedy Ambulans');
  tray.setContextMenu(contextMenu);
  
  // Tray'e tıklayınca pencereyi aç
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Uygulama hazır
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Tüm pencereler kapatıldığında
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Çıkış öncesi temizlik
app.on('before-quit', () => {
  app.isQuitting = true;
});

// IPC Handlers - Renderer process ile iletişim
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-notification', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

ipcMain.handle('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Otomatik güncelleme (production'da)
if (!isDev) {
  try {
    const { autoUpdater } = require('electron-updater');
    
    autoUpdater.checkForUpdatesAndNotify();
    
    autoUpdater.on('update-available', () => {
      new Notification({
        title: 'Güncelleme Mevcut',
        body: 'Yeni bir güncelleme indiriliyor...'
      }).show();
    });
    
    autoUpdater.on('update-downloaded', () => {
      new Notification({
        title: 'Güncelleme Hazır',
        body: 'Uygulama yeniden başlatıldığında güncelleme yüklenecek.'
      }).show();
    });
  } catch (error) {
    console.log('Auto-updater yüklenemedi:', error.message);
  }
}

console.log('Healmedy Ambulans Masaüstü başlatıldı!');

