// Koe service worker: app shell caching for offline use.
// Model files are handled separately by the browser Cache Storage API
// (via Transformers.js), not by this worker. No requests leave the origin
// except the ones the page itself makes (site assets and model downloads
// explicitly initiated by the user).
const CACHE_NAME = 'koe-shell-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never intercept model downloads or cross-origin requests.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/ort/')) {
    // ONNX Runtime WASM binaries are immutable; serve from cache when present.
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })),
    )
    return
  }

  if (request.mode === 'navigate') {
    // Network first for navigations, fall back to the cached shell when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone))
          }
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? Response.error())),
    )
    return
  }

  // Static assets: cache first, then network with cache fill.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    }),
  )
})
