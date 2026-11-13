import { describe, expect, it } from 'vitest'
import { KoeError, toKoeError } from '../src/lib/errors'

describe('KoeError', () => {
  it('keeps the code', () => {
    expect(new KoeError('storage').code).toBe('storage')
  })
})

describe('toKoeError', () => {
  it('passes through existing KoeError', () => {
    const original = new KoeError('checksum')
    expect(toKoeError(original)).toBe(original)
  })
  it('maps quota errors to storage', () => {
    expect(toKoeError(new Error('The quota has been exceeded')).code).toBe('storage')
  })
  it('maps memory errors to outOfMemory', () => {
    expect(toKoeError(new Error('out of memory allocating')).code).toBe('outOfMemory')
  })
  it('maps network failures to modelDownload', () => {
    expect(toKoeError(new TypeError('Failed to fetch')).code).toBe('modelDownload')
  })
  it('maps decode failures to decodeFailed', () => {
    expect(toKoeError(new Error('Unable to decode audio data')).code).toBe('decodeFailed')
  })
  it('maps AbortError to aborted', () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(toKoeError(abort).code).toBe('aborted')
  })
  it('falls back to unknown', () => {
    expect(toKoeError(new Error('something odd')).code).toBe('unknown')
    expect(toKoeError(undefined).code).toBe('unknown')
  })
})
