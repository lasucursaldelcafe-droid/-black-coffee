/* eslint-disable no-restricted-globals */
const CACHE_VERSION = 'bca-v41';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.html',
  './manifest.webmanifest',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/layout.css',
  './css/mobile.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-512.png',
  './js/storage.js',
  './js/sync-shared.js',
  './js/gas-config.js',
  './js/cloud-sync-config.js',
  './js/firebase-http-config.js',
  './js/firebase-config.js',
  './js/gas-sync.js',
  './js/firebase-http-sync.js',
  './js/firebase-sync.js',
  './js/cloud-sync.js',
  './js/sync-hub.js',
  './js/auth.js',
  './js/auth-biometric.js',
  './js/audit.js',
  './js/data.js',
  './js/setupWizard.js',
  './js/backup.js',
  './js/costs.js',
  './js/coffees.js',
  './js/clients.js',
  './js/suppliers.js',
  './js/inventory.js',
  './js/sales.js',
  './js/ghostCatalog.js',
  './js/import.js',
  './js/quotations.js',
  './js/pdf.js',
  './js/notifications.js',
  './js/email.js',
  './js/costEngine.js',
  './js/pwa.js',
  './js/reports.js',
  './js/app.js'
];

const NETWORK_ONLY = [
  'firestore.googleapis.com',
  'googleapis.com',
  'cdn.sheetjs.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'script.google.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim()).then(() =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'BCA_SW_UPDATED' }));
      })
    )
  );
});

function isNetworkOnly(url) {
  return NETWORK_ONLY.some((host) => url.hostname.includes(host));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && isNetworkOnly(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    const isHtml = url.pathname.endsWith('.html') || request.mode === 'navigate';
    const isVersionedAsset = url.pathname.endsWith('.js')
      || url.pathname.endsWith('.css')
      || url.search.includes('v=');

    if (isHtml || isVersionedAsset) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match(request))
      );
      return;
    }

    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
  }
});
