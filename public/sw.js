const CACHE = 'inventory-v2';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Navigation requests (HTML pages) - always network
  if (e.request.mode === 'navigate') return;
  // API calls - always network
  if (e.request.url.includes('/api/')) return;
  // Everything else - network first, no caching
  return;
});
