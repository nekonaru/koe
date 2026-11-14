// Koe service worker: app shell caching for offline use.
// Model files are handled separately by the browser Cache Storage API
// (via Transformers.js), not by this worker. No requests leave the origin
// except the ones the page itself makes (site assets and model downloads
// explicitly initiated by the user).
// Resolve the app base from the service worker's own scope so the app works
// both at / (custom domain or Cloudflare Pages) and /koe/ (GitHub Pages).
const BASE = new URL(self.registration.scope).pathname
const CACHE_NAME = 'koe-shell-v4'
const APP_SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icon.svg']

// On install, precaching model files happens in the background after the app
// shell is ready. Only Tiny is precached, one file at a time, so the browser
// never has to hold the whole download in memory at once. Failures are
// tolerated; the runtime cache picks up the rest on first use.
const MODEL_FILES = [
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.json',
  'merges.txt',
  'normalizer.json',
  'special_tokens_map.json',
  'added_tokens.json',
]
const PRECACHE_MODEL = 'whisper-tiny'

function modelPrecacheUrls() {
  return MODEL_FILES.map((file) => `${BASE}models/onnx-community/${PRECACHE_MODEL}/${file}`)
}

async function precacheModel(cache) {
  for (const url of modelPrecacheUrls()) {
    try {
      const cached = await cache.match(url)
      if (cached) continue
      const response = await fetch(url, { credentials: 'same-origin' })
      if (response.ok) {
        await cache.put(url, response)
      }
    } catch {
      // A slow network or quota pressure must not affect the install.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
  // Precache the model serially in the background without blocking install.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheModel(cache))
      .catch(() => undefined),
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
  if (url.pathname.startsWith(BASE + 'ort/')) {
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
            caches.open(CACHE_NAME).then((cache) => cache.put(BASE + 'index.html', clone))
          }
          return response
        })
        .catch(() => caches.match(BASE + 'index.html').then((cached) => cached ?? Response.error())),
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
