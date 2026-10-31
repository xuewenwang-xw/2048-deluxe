/**
 * @file sw.js
 * Service Worker for 2048 Deluxe PWA.
 * Enables complete offline gameplay, asset pre-caching, and instant standalone launching.
 */

const CACHE_NAME = '2048-deluxe-v2.4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css?v=2.2',
  './src/app.js?v=2.2',
  './src/engine/game_engine.js',
  './src/engine/grid.js',
  './src/engine/prng.js',
  './src/engine/types.js',
  './src/ui/view.js',
  './src/ui/input.js?v=2.2',
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset immediately; optionally refresh in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Ignore network errors when offline
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store for offline use
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
