// Copies the ONNX Runtime Web WASM binaries that Transformers.js needs into
// public/ort so they are served from our own origin. This keeps the runtime
// free of third-party CDN requests (see CSP in public/_headers).
// Runs automatically before `vite dev` and `vite build`.
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ortDist = path.join(root, 'node_modules', 'onnxruntime-web', 'dist')
const target = path.join(root, 'public', 'ort')

const files = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']

await mkdir(target, { recursive: true })
for (const file of files) {
  await copyFile(path.join(ortDist, file), path.join(target, file))
}
console.log(`Copied ${files.length} ONNX Runtime WASM files to public/ort/`)
