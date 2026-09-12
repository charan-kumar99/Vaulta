const CACHE_NAME = 'vaulta-v64';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './css/index.css?v=64',
  './css/animations.css?v=64',
  './css/components.css?v=64',
  './js/db.js?v=64',
  './js/search.js?v=64',
  './js/share.js?v=64',
  './js/ui.js?v=64',
  './js/security.js?v=64',
  './js/app.js?v=64',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon.ico'
];

// ── Temporary IndexedDB store for share-target files ──
const SHARE_DB_NAME = 'vaulta_share_target';
const SHARE_DB_VERSION = 1;
const SHARE_STORE_NAME = 'pending_files';

function openShareDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storeSharedFile(file, title, text) {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const db = await openShareDB();
      const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SHARE_STORE_NAME);
      store.put({
        id: 'latest',
        name: file.name || 'Shared File',
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: arrayBuffer,
        title: title || '',
        text: text || '',
        timestamp: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// When the app tells us to activate or skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── Handle Share Target POST ──
  if (event.request.method === 'POST' && url.searchParams.has('share-target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('file');
          const title = formData.get('title') || '';
          const text = formData.get('text') || '';

          if (file && file.size > 0) {
            await storeSharedFile(file, title, text);
          }
        } catch (err) {
          console.error('[Vaulta SW] Share target error:', err);
        }

        // Redirect to the app with the share-target flag
        const redirectUrl = new URL('./', self.location.origin + self.location.pathname.replace(/sw\.js.*$/, ''));
        redirectUrl.searchParams.set('share-target', 'true');
        return Response.redirect(redirectUrl.href, 303);
      })()
    );
    return;
  }

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
