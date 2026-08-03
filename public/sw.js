const CACHE_NAME = 'goals-tracker-shell-v1';
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/storage.js',
  'js/models.js',
  'js/streaks.js',
  'js/celebrate.js',
  'js/render.js',
  'js/firebase-config.js',
  'js/sync.js',
  'js/app.js',
  'icons/icon-48.png',
  'icons/icon-72.png',
  'icons/icon-96.png',
  'icons/icon-144.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first for the app shell: a fresh deploy is always picked up
// immediately when online (so the TWA needs no Play Store re-submission
// for content/logic changes), falling back to the cache only when offline.
// Firebase/Firestore requests are cross-origin and pass straight through.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('index.html')))
  );
});
