import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GH_PAGES === 'true' ? '/koe/' : '/',
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
  resolve: {
    // onnxruntime-web's webgpu entry hardcodes the Asyncify WASM build
    // (~27 MB, above the Cloudflare Pages 25 MB file limit). Use the lean
    // wasm-only entry instead; WebGPU support (FR-14) is deferred post-v1.
    // The extern-wasm condition stops Vite from copying the library's own
    // .wasm assets into the bundle; our copies live in public/ort/.
    conditions: ['onnxruntime-web-use-extern-wasm', 'module', 'browser', 'development|production'],
    alias: {
      'onnxruntime-web/webgpu': 'onnxruntime-web/wasm',
    },
  },
  // Mirror the production headers from public/_headers so `vite preview`
  // behaves like the deployed site (crossOriginIsolated === true). The dev
  // server is left alone because HMR needs looser script rules.
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://huggingface.co https://*.hf.co https://*.xethub.hf.co; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
