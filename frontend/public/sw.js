/**
 * HEALMEDY Service Worker
 * Web Push Notifications
 */

// Service Worker Activation
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(clients.claim());
});

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
    // FCM text formatı
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

// Background Sync (offline queue)
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  // Offline iken birikmiş bildirimleri senkronize et
  console.log('[SW] Syncing notifications...');
}

// Message handler (from main thread)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

