export interface SharePayload {
  title: string
  language: string
  segments: Array<{ startMs: number; endMs: number; text: string; speaker?: number }>
  createdAt: number
}

const COMPRESSED = '1'
const PLAIN = '0'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function transformBytes(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const read = new Response(transform.readable).arrayBuffer()
  const input = new Uint8Array(bytes.byteLength)
  input.set(bytes)
  const writer = transform.writable.getWriter()
  const write = (async () => {
    await writer.write(input)
    await writer.close()
  })()
  const [buffer] = await Promise.all([read, write])
  return new Uint8Array(buffer)
}

export async function encodeShare(payload: SharePayload): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    if (typeof CompressionStream === 'function') {
      try {
        const packed = await transformBytes(bytes, new CompressionStream('deflate'))
        return COMPRESSED + bytesToBase64Url(packed)
      } catch {
        // Compression can fail on some platforms, fall back to plain JSON.
      }
    }
    return PLAIN + bytesToBase64Url(bytes)
  } catch {
    return ''
  }
}

export async function decodeShare<T = SharePayload>(value: string): Promise<T | null> {
  try {
    if (typeof value !== 'string' || value.length < 2) return null
    const marker = value[0]
    if (marker !== COMPRESSED && marker !== PLAIN) return null
    const body = value.slice(1)
    if (!/^[A-Za-z0-9_-]+$/.test(body)) return null

    let bytes = base64UrlToBytes(body)
    if (marker === COMPRESSED) {
      if (typeof DecompressionStream === 'function') {
        bytes = await transformBytes(bytes, new DecompressionStream('deflate'))
      } else {
        return null
      }
    }

    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const parsed = JSON.parse(json) as T
    if (parsed === null || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function shareUrl(payload: SharePayload): Promise<string> {
  return encodeShare(payload).then((encoded) => {
    const base = typeof import.meta.env.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/'
    const origin = typeof location !== 'undefined' && location.origin ? location.origin : ''
    return `${origin}${base}#share=${encoded}`
  })
}
