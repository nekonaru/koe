import { describe, it, expect } from 'vitest'
import {
  applyGlossary,
  chunkForTranslation,
  floresFor,
  getTranslationTarget,
  protectTerms,
  TRANSLATION_TARGETS,
} from '../src/lib/translate'
import {
  toBilingualCsv,
  toBilingualMarkdown,
  toBilingualSrt,
  toBilingualVtt,
} from '../src/format/format'

describe('translation targets', () => {
  it('offers Indonesian and a large multilingual option', () => {
    expect(getTranslationTarget('id')?.hfId).toBe('Xenova/opus-mt-en-id')
    expect(getTranslationTarget('nllb-id')?.heavy).toBe(true)
    expect(TRANSLATION_TARGETS.length).toBeGreaterThanOrEqual(5)
  })

  it('maps source languages to FLORES codes', () => {
    expect(floresFor('indonesian')).toBe('ind_Latn')
    expect(floresFor('english')).toBe('eng_Latn')
    expect(floresFor('unknown')).toBeUndefined()
  })
})

describe('translation helpers', () => {
  it('splits long text into readable chunks', () => {
    const text = 'First sentence. Second sentence. Third sentence.'
    const chunks = chunkForTranslation(text, 20)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ')).toContain('Third sentence.')
  })

  it('protects and restores glossary terms', () => {
    const source = 'koe is great and koe is fast.'
    const protectedText = protectTerms(source, ['koe'])
    expect(protectedText).toContain('KOETERM0END')
    expect(applyGlossary(source, protectedText, ['koe'])).toContain('koe')
  })
})

describe('bilingual export', () => {
  const segments = [
    { startMs: 0, endMs: 2000, text: 'Hello world.' },
    { startMs: 2000, endMs: 4000, text: 'Second line.' },
  ]
  const translations = ['Halo dunia.', 'Baris kedua.']

  it('writes SRT and VTT with both languages', () => {
    const srt = toBilingualSrt(segments, translations)
    expect(srt).toContain('Hello world.')
    expect(srt).toContain('Halo dunia.')
    const vtt = toBilingualVtt(segments, translations)
    expect(vtt.startsWith('WEBVTT')).toBe(true)
    expect(vtt).toContain('Baris kedua.')
  })

  it('writes CSV with original and translated columns', () => {
    const csv = toBilingualCsv(segments, translations)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('start,end,original,translated')
    expect(csv).toContain('"Halo dunia."')
  })

  it('writes Markdown with quoted translations', () => {
    const md = toBilingualMarkdown(segments, translations, 'Demo')
    expect(md.startsWith('# Demo')).toBe(true)
    expect(md).toContain('> Halo dunia.')
  })
})
