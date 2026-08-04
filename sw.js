const CACHE_NAME = 'vaulta-v37';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/index.css',
  './css/animations.css',
  './css/components.css',
  './js/db.js',
  './js/search.js',
  './js/share.js',
  './js/ui.js',
  './js/security.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'vaulta-check-expiries') {
    event.waitUntil(checkExpiriesInBackground());
  }
});

async function checkExpiriesInBackground() {
  try {
    const db = await openDBPromise();
    if (!db) return;
    const tx = db.transaction('documents', 'readonly');
    const store = tx.objectStore('documents');
    const req = store.getAll();
    req.onsuccess = () => {
      const docs = req.result || [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      docs.forEach((doc) => {
        if (doc.expiryDate) {
          const exp = new Date(doc.expiryDate);
          exp.setHours(0, 0, 0, 0);
          const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft === 30 || daysLeft === 7 || daysLeft === 1 || daysLeft <= 0) {
            self.registration.showNotification('Vaulta Document Expiry Alert', {
              body: daysLeft <= 0 ? `🔴 "${doc.name}" has EXPIRED!` : `🟡 "${doc.name}" expires in ${daysLeft} days!`,
              icon: './icons/icon-192.png',
              badge: './icons/icon-192.png',
              tag: `doc-${doc.id}`
            });
          }
        }
      });
    };
  } catch (err) {
    console.error('Background check failed:', err);
  }
}

function openDBPromise() {
  return new Promise((resolve) => {
    const req = indexedDB.open('docvault_db', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
