/* Prompt Library — service worker. Precaches the app shell + data for full
   offline use; serves cache-first and falls back to index.html for navigations. */

const CACHE = 'pl-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './prompts.json',
  './fonts/fraunces-600.woff2',
  './fonts/fraunces-900.woff2',
  './fonts/archivo-400.woff2',
  './fonts/archivo-600.woff2',
  './fonts/archivo-700.woff2',
  './fonts/spline-mono-400.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigations -> serve the app shell (hash routing handles the rest offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req))
    );
    return;
  }

  // Everything else: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
