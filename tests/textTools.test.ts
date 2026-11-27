import { describe, expect, it } from 'vitest'
import {
  buildChapters,
  cleanupTranscript,
  detectRepeats,
  findReplaceSegments,
  toCaptionLines,
  toCleanParagraphs,
  toMarkdown,
} from '../src/lib/textTools'

describe('cleanupTranscript', () => {
  it('capitalizes sentences, removes duplicate words and extra spaces', () => {
    expect(cleanupTranscript('hello hello world. this is  a test! yes yes yes')).toBe(
      'Hello world. This is a test! Yes',
    )
  })

  it('keeps punctuation and handles empty input', () => {
    expect(cleanupTranscript('')).toBe('')
    expect(cleanupTranscript('wait... what? ok.')).toBe('Wait... What? Ok.')
  })
})

describe('detectRepeats', () => {
  it('detects a word repeated five times in a row', () => {
    expect(detectRepeats('no no no no no')).toBe(true)
  })

  it('detects a two word phrase repeated five times', () => {
    expect(detectRepeats('hello world hello world hello world hello world hello world')).toBe(true)
  })

  it('returns false for ordinary text and short runs', () => {
    expect(detectRepeats('this is a normal sentence')).toBe(false)
    expect(detectRepeats('no no no no')).toBe(false)
  })
})

describe('findReplaceSegments', () => {
  const segments = [{ text: 'Hello world, hello WORLD.' }]

  it('replaces all matches case insensitively by default', () => {
    const result = findReplaceSegments(segments, 'hello', 'hi')
    expect(result.count).toBe(2)
    expect(result.segments[0].text).toBe('hi world, hi WORLD.')
  })

  it('honors the case sensitive option', () => {
    const result = findReplaceSegments(segments, 'hello', 'hi', { caseSensitive: true })
    expect(result.count).toBe(1)
    expect(result.segments[0].text).toBe('Hello world, hi WORLD.')
  })

  it('supports regular expressions and preserves other segment fields', () => {
    const input = [{ text: 'a1 b22', speaker: 3 }]
    const result = findReplaceSegments(input, '\\d+', '#', { regex: true })
    expect(result.count).toBe(2)
    expect(result.segments[0]).toEqual({ text: 'a# b#', speaker: 3 })
  })

  it('returns the input untouched for an empty needle or an invalid regex', () => {
    expect(findReplaceSegments(segments, '', 'x')).toEqual({ segments, count: 0 })
    expect(findReplaceSegments(segments, '[', 'x', { regex: true })).toEqual({ segments, count: 0 })
  })
})

describe('buildChapters', () => {
  it('splits on gaps larger than the default 4000 ms', () => {
    const chapters = buildChapters([
      { startMs: 0, endMs: 1000, text: 'First chapter opening words go on and on' },
      { startMs: 1500, endMs: 2500, text: 'More words in the first chapter' },
      { startMs: 10000, endMs: 11000, text: 'Second chapter starts right here now again' },
    ])
    expect(chapters).toEqual([
      { title: 'First chapter opening words go on', startMs: 0 },
      { title: 'Second chapter starts right here now', startMs: 10000 },
    ])
  })

  it('returns an empty array for no segments', () => {
    expect(buildChapters([])).toEqual([])
  })
})

describe('toMarkdown', () => {
  it('adds a heading and speaker labels', () => {
    const markdown = toMarkdown(
      [
        { startMs: 0, endMs: 1000, text: 'Hello there.', speaker: 0 },
        { startMs: 1200, endMs: 2000, text: 'How are you?', speaker: 0 },
        { startMs: 2500, endMs: 3000, text: 'I am fine.', speaker: 1 },
      ],
      'Interview',
    )
    expect(markdown).toContain('# Interview')
    expect(markdown).toContain('**Speaker 1:** Hello there. How are you?')
    expect(markdown).toContain('**Speaker 2:** I am fine.')
  })

  it('groups paragraphs under chapter headings with timestamps', () => {
    const markdown = toMarkdown(
      [
        { startMs: 0, endMs: 1000, text: 'Opening line.' },
        { startMs: 60000, endMs: 61000, text: 'Later line.' },
      ],
      'Talk',
      [
        { title: 'Intro', startMs: 0 },
        { title: 'Later', startMs: 60000 },
      ],
    )
    expect(markdown).toContain('## [00:00] Intro')
    expect(markdown).toContain('## [01:00] Later')
    expect(markdown).toContain('Intro')
    expect(markdown.indexOf('Opening line.')).toBeLessThan(markdown.indexOf('Later line.'))
  })
})

describe('toCaptionLines', () => {
  it('wraps text at the requested width and prefixes each line', () => {
    expect(toCaptionLines([{ startMs: 61000, endMs: 65000, text: 'one two three four' }], 10)).toBe(
      '[01:01] one two\n[01:01] three four',
    )
  })

  it('uses an h:mm:ss timestamp past one hour', () => {
    expect(toCaptionLines([{ startMs: 3_723_004, endMs: 3_724_000, text: 'Done.' }])).toBe('[1:02:03] Done.')
  })
})

describe('toCleanParagraphs', () => {
  it('groups sentences into paragraphs of about three', () => {
    const text =
      'first sentence. second sentence. third sentence. fourth sentence. fifth sentence. sixth sentence.'
    const paragraphs = toCleanParagraphs([{ text }])
    expect(paragraphs).toBe(
      'First sentence. Second sentence. Third sentence.\n\nFourth sentence. Fifth sentence. Sixth sentence.',
    )
  })
})
