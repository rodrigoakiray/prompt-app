/* Prompt Library — service worker. Precaches the app shell + data for full
   offline use; serves cache-first.

   NOTE: we deliberately do NOT cache './index.html'. On hosts with clean URLs
   (Vercel `cleanUrls`), '/index.html' is a redirect, and a *redirected*
   Response is illegal in respondWith() for a navigation (throws ERR_FAILED).
   We cache the non-redirected root './' and rebuild a fresh shell from it. */

const CACHE = 'pl-v4';

const ASSETS = [
  './',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './prompts.json',
  './fonts/geist-400.woff2',
  './fonts/geist-500.woff2',
  './fonts/geist-600.woff2',
  './fonts/geist-mono-400.woff2',
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

// Rebuild a guaranteed non-redirected HTML response for navigations.
async function shell() {
  const cache = await caches.open(CACHE);
  const r = (await cache.match('./')) || (await cache.match('./index.html'));
  if (!r) return null;
  const body = await r.clone().text();
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigations -> always serve the (rebuilt) app shell; hash routing + the
  // cached data make the app work fully offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const s = await shell();
      if (s) return s;
      try { return await fetch(req); } catch (e) { return Response.error(); }
    })());
    return;
  }

  // Other GETs: cache-first, then network (and cache the result).
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
