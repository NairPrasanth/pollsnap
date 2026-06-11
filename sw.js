// ============================================================
// PollSnap — Service Worker (PWA offline support)
// ============================================================

const CACHE_NAME  = 'pollsnap-v3';
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/firebase-config.js',
  './js/app.js',
  './js/create.js',
  './js/admin.js',
  './js/participate.js',
  './js/raffle-create.js',
  './js/raffle-admin.js',
  './js/raffle-ticket.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install — pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, ignore failures for CDN resources
      return Promise.allSettled(SHELL_FILES.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for Firebase/API, cache-first for shell
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network for Firebase, Google APIs
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for shell/static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
