/**
 * Encode a mono Float32 PCM buffer as a 16-bit PCM WAV file.
 * Used by the standalone transcript page export so the page can embed the
 * original audio as a data URI.
 */
export function encodeWav(pcm: Float32Array, sampleRate: number): Uint8Array {
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const numChannels = 1
  const dataSize = pcm.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format tag
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < pcm.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[i]))
    const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff)
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return new Uint8Array(buffer)
}

/** Base64 encode bytes without blowing the call stack on large payloads. */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, offset + CHUNK)))
  }
  return btoa(binary)
}
