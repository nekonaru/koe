// Generates all raster icons from the source mark in public/icon.svg.
// Usage: npm run icons  (sharp is a dev dependency)
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public', 'icon.svg')
const outDir = path.join(root, 'public', 'icons')
await mkdir(outDir, { recursive: true })

const sizes = [
  { name: 'icon-16.png', size: 16 },
  { name: 'icon-32.png', size: 32 },
  { name: 'icon-180.png', size: 180 }, // apple-touch-icon
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
]

for (const { name, size } of sizes) {
  await sharp(source, { density: 384 }).resize(size, size).png().toFile(path.join(outDir, name))
  console.log('wrote', name)
}

// Maskable: same mark scaled into the safe zone on a full-bleed indigo square.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2B3A67"/>
  <g transform="translate(51.2 51.2) scale(0.8)">
    <rect x="181" y="172" width="150" height="45" rx="22.5" fill="#FF7A59"/>
    <path d="M 168 272 H 318 A 55 55 0 0 1 318 382 H 168" fill="none" stroke="#FAF7F2" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
await sharp(Buffer.from(maskableSvg), { density: 384 }).resize(512, 512).png().toFile(path.join(outDir, 'icon-maskable-512.png'))
console.log('wrote icon-maskable-512.png')
