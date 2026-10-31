/**
 * @file sw.js
 * Service Worker for 2048 Deluxe PWA.
 * Enables complete offline gameplay, asset pre-caching, and instant standalone launching.
 * Features Network-First navigation with automatic update and background asset caching.
 */

const CACHE_NAME = '2048-deluxe-v2.5';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css?v=2.5',
  './src/app.js?v=2.5',
  './src/engine/game_engine.js',
  './src/engine/grid.js',
  './src/engine/prng.js',
  './src/engine/types.js',
  './src/ui/view.js',
  './src/ui/input.js?v=2.5',
  './src/ui/theme.js',
  './src/ui/storage.js',
  './src/audio/audio_engine.js',
  './src/effects/juice.js',
  './src/effects/particle_canvas.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-192.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude local launcher API requests (heartbeat / leave) from cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Non-GET requests should bypass cache
  if (event.request.method !== 'GET') {
    return;
  }

  // 1. Navigation requests (HTML document loads): Network-First
  // Ensures online mobile/desktop users always see the latest HTML release immediately.
  // Falls back to cached HTML if offline or network unreachable.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html').then((fallback) => fallback || caches.match('./'));
        })
    );
    return;
  }

  // 2. Static Assets (CSS, JS, Images, Audio): Cache-First with Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline: network error is expected, ignore
      });

      return cachedResponse || fetchPromise;
    })
  );
});
