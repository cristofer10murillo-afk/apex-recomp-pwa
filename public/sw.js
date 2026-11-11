const CACHE_NAME = 'apex-recomp-v14-smart-coach';
const SHARE_DB_NAME = 'ApexSharedInbox';
const SHARE_STORE_NAME = 'pending';

function openShareDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storePendingShare(payload) {
  const db = await openShareDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
    tx.objectStore(SHARE_STORE_NAME).put(payload, 'latest');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldKeys = keys.filter((key) => key !== CACHE_NAME);
      await Promise.all(oldKeys.map((key) => caches.delete(key)));
      await self.clients.claim();
      if (oldKeys.length > 0) {
        const windowClients = await self.clients.matchAll({ type: 'window' });
        for (const client of windowClients) {
          try {
            await client.navigate(client.url);
          } catch {
            // ignore navigation errors
          }
        }
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Android Web Share Target receiver (Galaxy S23 Ultra -> Compartir -> ApexRecomp)
  if (
    event.request.method === 'POST' &&
    url.origin === self.location.origin &&
    url.pathname === '/share-target'
  ) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const mediaEntries = formData.getAll('media');
          const media = mediaEntries[0] || formData.get('file');
          const title = String(formData.get('title') || '');
          const text = String(formData.get('text') || '');
          const sharedUrl = String(formData.get('url') || '');

          let fileRecord = null;
          if (media && typeof media === 'object' && 'arrayBuffer' in media) {
            const buffer = await media.arrayBuffer();
            fileRecord = {
              buffer,
              name: media.name || 'shared-capture.png',
              type: media.type || 'image/png',
            };
          }

          await storePendingShare({
            file: fileRecord,
            title,
            text,
            url: sharedUrl,
            receivedAt: Date.now(),
          });
        } catch {
          // ignore malformed share payloads
        }
        return Response.redirect('/?shared=1', 303);
      })()
    );
    return;
  }

  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/')) return;

  // Network-First strategy: always fetch latest from Netlify when online, fallback to cache only offline
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        return caches.match('/index.html');
      })
  );
});
