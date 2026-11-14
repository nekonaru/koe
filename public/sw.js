// Koe service worker: app shell caching for offline use.
// Model files are handled separately by the browser Cache Storage API
// (via Transformers.js), not by this worker. No requests leave the origin
// except the ones the page itself makes (site assets and model downloads
// explicitly initiated by the user).
// Resolve the app base from the service worker's own scope so the app works
// both at / (custom domain or Cloudflare Pages) and /koe/ (GitHub Pages).
const BASE = new URL(self.registration.scope).pathname
const CACHE_NAME = 'koe-shell-v3'
const APP_SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icon.svg']

// On install, precaching the bundled models happens in the background after
// the app shell is ready. It fails silently if the connection is slow or the
// quota is tight; the runtime cache fills on first use either way.
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
const MODELS = ['whisper-tiny', 'whisper-base']

function modelPrecacheUrls() {
  const urls = []
  for (const model of MODELS) {
    for (const file of MODEL_FILES) {
      urls.push(`${BASE}models/onnx-community/${model}/${file}`)
    }
  }
  return urls
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
  // Precache the models without blocking activation or the page.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          modelPrecacheUrls().map(async (url) => {
            try {
              const cached = await cache.match(url)
              if (cached) return
              const response = await fetch(url, { credentials: 'same-origin' })
              if (response.ok) {
                await cache.put(url, response)
              }
            } catch {
              // A failed precache is not fatal; runtime caching picks it up later.
            }
          }),
        ),
      )
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
