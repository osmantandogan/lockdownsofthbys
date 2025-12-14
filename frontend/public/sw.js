/**
 * HEALMEDY Service Worker
 * Web Push Notifications + Offline Cache + Background Sync
 */

const CACHE_NAME = 'healmedy-cache-v1';
const STATIC_CACHE_NAME = 'healmedy-static-v1';
const DYNAMIC_CACHE_NAME = 'healmedy-dynamic-v1';

// Statik dosyalar - her zaman cache'le
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/favicon.svg',
  '/manifest.json'
];

// API endpoint'leri için cache stratejileri
const API_CACHE_RULES = {
  // Her zaman network-first (güncel veri gerekli)
  networkFirst: [
    '/api/cases',
    '/api/notifications',
    '/api/shifts'
  ],
  // Cache-first (nadiren değişen veriler)
  cacheFirst: [
    '/api/medications',
    '/api/reference-data',
    '/api/locations/healmedy'
  ],
  // Stale-while-revalidate (orta sıklıkta güncellenen)
  staleWhileRevalidate: [
    '/api/vehicles',
    '/api/users',
    '/api/firms'
  ]
};

// Service Worker Installation
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => clients.claim())
  );
});

// Fetch Event Handler - Cache Stratejileri
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Sadece GET isteklerini cache'le
  if (request.method !== 'GET') {
    return;
  }
  
  // API istekleri
  if (url.pathname.startsWith('/api/')) {
    // Network-first stratejisi
    if (API_CACHE_RULES.networkFirst.some(path => url.pathname.includes(path))) {
      event.respondWith(networkFirst(request));
      return;
    }
    
    // Cache-first stratejisi
    if (API_CACHE_RULES.cacheFirst.some(path => url.pathname.includes(path))) {
      event.respondWith(cacheFirst(request));
      return;
    }
    
    // Stale-while-revalidate stratejisi
    if (API_CACHE_RULES.staleWhileRevalidate.some(path => url.pathname.includes(path))) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }
    
    // Diğer API istekleri için network-first
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Statik dosyalar için cache-first
  if (STATIC_ASSETS.includes(url.pathname) || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff2')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Navigation istekleri için network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // Diğer istekler için stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Cache Stratejileri

// Network-first: Önce ağdan dene, başarısız olursa cache'den
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Offline fallback
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    
    throw error;
  }
}

// Cache-first: Önce cache'den dene, yoksa ağdan al
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed:', request.url);
    throw error;
  }
}

// Stale-while-revalidate: Cache'den döndür, arka planda güncelle
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        caches.open(DYNAMIC_CACHE_NAME)
          .then(cache => cache.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch(error => {
      console.log('[SW] Revalidation failed:', request.url);
      return cachedResponse;
    });
  
  return cachedResponse || fetchPromise;
}

// Push Event Handler (FCM ve VAPID destekler)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'HEALMEDY Bildirimi',
    body: 'Yeni bildiriminiz var',
    icon: '/logo192.png',
    badge: '/badge.png',
    url: '/dashboard',
    tag: 'healmedy-notification'
  };
  
  try {
    if (event.data) {
      const payload = event.data.json();
      
      // FCM formatı
      if (payload.notification) {
        data = {
          title: payload.notification.title || data.title,
          body: payload.notification.body || data.body,
          icon: payload.notification.icon || data.icon,
          badge: payload.notification.badge || data.badge,
          url: payload.data?.url || payload.fcmOptions?.link || data.url,
          tag: payload.data?.tag || data.tag,
          data: payload.data || {}
        };
      } 
      // VAPID formatı (eski)
      else {
        data = { ...data, ...payload };
      }
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    if (event.data && event.data.text) {
      try {
        const textData = JSON.parse(event.data.text());
        data = { ...data, ...textData };
      } catch (parseError) {
        console.error('[SW] Error parsing text data:', parseError);
      }
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard',
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Görüntüle'
      },
      {
        action: 'close',
        title: 'Kapat'
      }
    ],
    tag: data.tag || 'healmedy-notification',
    renotify: true,
    requireInteraction: data.priority === 'high' || data.priority === 'critical'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Mevcut pencerede aç
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        
        // Yeni pencere aç
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Background Sync - Offline veri senkronizasyonu
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncForms());
  }
  
  if (event.tag === 'sync-locations') {
    event.waitUntil(syncLocations());
  }
  
  if (event.tag === 'sync-all') {
    event.waitUntil(
      Promise.all([
        syncForms(),
        syncLocations()
      ])
    );
  }
});

// Form senkronizasyonu
async function syncForms() {
  console.log('[SW] Syncing forms...');
  
  try {
    // IndexedDB'den pending formları al
    const db = await openDatabase();
    const forms = await getAllFromStore(db, 'pending_forms');
    
    for (const form of forms) {
      try {
        const response = await fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form.data)
        });
        
        if (response.ok) {
          await deleteFromStore(db, 'pending_forms', form.id);
          console.log('[SW] Form synced:', form.id);
        }
      } catch (error) {
        console.error('[SW] Form sync failed:', form.id, error);
      }
    }
    
    console.log('[SW] Forms sync completed');
  } catch (error) {
    console.error('[SW] Forms sync error:', error);
  }
}

// Lokasyon senkronizasyonu
async function syncLocations() {
  console.log('[SW] Syncing locations...');
  
  try {
    const db = await openDatabase();
    const locations = await getAllFromStore(db, 'pending_locations');
    
    if (locations.length === 0) {
      return;
    }
    
    // Batch olarak gönder
    const response = await fetch('/api/locations/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations })
    });
    
    if (response.ok) {
      for (const loc of locations) {
        await deleteFromStore(db, 'pending_locations', loc.id);
      }
      console.log('[SW] Locations synced:', locations.length);
    }
  } catch (error) {
    console.error('[SW] Locations sync error:', error);
  }
}

// IndexedDB Helper Fonksiyonları
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('healmedy_offline_db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    } catch (e) {
      resolve([]);
    }
  });
}

function deleteFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    } catch (e) {
      resolve(false);
    }
  });
}

// Periodic Background Sync (destekleniyorsa)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(
      Promise.all([
        syncForms(),
        syncLocations()
      ])
    );
  }
});

// Message handler (from main thread)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SYNC_NOW') {
    Promise.all([
      syncForms(),
      syncLocations()
    ]).then(() => {
      event.ports[0]?.postMessage({ success: true });
    }).catch(error => {
      event.ports[0]?.postMessage({ success: false, error: error.message });
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      return Promise.all(names.map(name => caches.delete(name)));
    }).then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
});
