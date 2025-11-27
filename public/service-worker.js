const CACHE_NAME = 'chan-v1.4.1'; 
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
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          // Non blocchiamo l'installazione se manca un'immagine non critica
          console.warn("[Service Worker] Risorsa mancante durante il caching:", err);
      });
    })
  );
  // Forza l'attivazione immediata del nuovo SW
  self.skipWaiting();
});

// Attivazione: pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Rimozione vecchia cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Prendi il controllo della pagina immediatamente
  return self.clients.claim();
});

// Fetch: serve i file dalla cache se offline, altrimenti rete
self.addEventListener('fetch', (event) => {
  // Ignora le richieste non GET o verso altri domini (es. socket.io)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
        // Se è in cache, usalo, altrimenti vai in rete
        return cachedResponse || fetch(event.request).catch(() => {
            // Se sei offline e la risorsa non è in cache, non fare nulla (o mostra pagina offline custom)
            // console.log("Offline e risorsa non in cache:", event.request.url);
        });
    })
  );
});