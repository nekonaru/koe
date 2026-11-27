import { describe, expect, it } from 'vitest'
import { decodeShare, encodeShare, shareUrl, type SharePayload } from '../src/lib/share'

const payload: SharePayload = {
  title: 'Interview',
  language: 'en',
  segments: [{ startMs: 0, endMs: 1000, text: 'Halo dunia, áé' }],
  createdAt: 123,
}

function base64Url(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('encodeShare and decodeShare', () => {
  it('round-trips a payload using compression when available', async () => {
    const encoded = await encodeShare(payload)
    expect(typeof CompressionStream === 'function' ? encoded.startsWith('1') : encoded.startsWith('0')).toBe(true)
    expect(encoded).toMatch(/^[01][A-Za-z0-9_-]+$/)
    expect(await decodeShare(encoded)).toEqual(payload)
  })

  it('round-trips non-ASCII text', async () => {
    const encoded = await encodeShare(payload)
    const decoded = await decodeShare<SharePayload>(encoded)
    expect(decoded?.segments[0].text).toBe('Halo dunia, áé')
  })

  it('decodes a plain base64url JSON payload', async () => {
    const body = base64Url(JSON.stringify(payload))
    expect(await decodeShare('0' + body)).toEqual(payload)
  })

  it('decodes a custom generic shape', async () => {
    expect(await decodeShare<{ v: number }>('0' + base64Url('{"v":7}'))).toEqual({ v: 7 })
  })

  it('returns null for malformed input without throwing', async () => {
    expect(await decodeShare('')).toBe(null)
    expect(await decodeShare('abc')).toBe(null)
    expect(await decodeShare('9abcd')).toBe(null)
    expect(await decodeShare('1!!!!')).toBe(null)
    expect(await decodeShare('0bm90IGpzb24')).toBe(null)
    expect(await decodeShare('1abcdef')).toBe(null)
  })
})

describe('shareUrl', () => {
  it('appends the encoded payload as a hash fragment', async () => {
    const url = await shareUrl(payload)
    expect(url).toContain('#share=')
    expect(url).toContain('/')
    const encoded = url.slice(url.indexOf('#share=') + 7)
    expect(await decodeShare(encoded)).toEqual(payload)
  })
})
