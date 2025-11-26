const CACHE_NAME = '#chan-v1.111';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/images/logo.png',
  '/manifest.json'
];

// Installazione: cache dei file statici
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Attivazione: pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch: serve i file dalla cache se offline, altrimenti rete
self.addEventListener('fetch', (event) => {
  // Ignora le richieste non GET o verso altri domini (es. socket.io)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
        // Se è in cache, usalo, altrimenti vai in rete
        return cachedResponse || fetch(event.request);
    })
  );
});