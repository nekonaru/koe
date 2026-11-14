import { describe, expect, it } from 'vitest'
import { MODELS, getModel, DEFAULT_MODEL, formatBytes, LANGUAGES } from '../src/lib/models'

describe('MODELS', () => {
  it('tiny and base are bundled with the site, small is not', () => {
    expect(MODELS.find((m) => m.id === 'tiny')?.bundled).toBe(true)
    expect(MODELS.find((m) => m.id === 'base')?.bundled).toBe(true)
    expect(MODELS.find((m) => m.id === 'small')?.bundled).toBe(false)
  })

  it('has unique ids', () => {
    const ids = MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('default model exists and is bundled', () => {
    expect(getModel(DEFAULT_MODEL).bundled).toBe(true)
  })

  it('every model has a Hugging Face repo id', () => {
    for (const model of MODELS) {
      expect(model.hfId).toMatch(/^onnx-community\/whisper-/)
    }
  })

  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 KB')
    expect(formatBytes(43_100_000)).toBe('41 MB')
  })

  it('supports Indonesian and English transcription languages', () => {
    const codes = LANGUAGES.map((l) => l.code)
    expect(codes).toContain('indonesian')
    expect(codes).toContain('english')
  })
})
