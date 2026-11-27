import { describe, expect, it } from 'vitest'
import {
  OUTPUT_FORMATS,
  formatSrtTime,
  formatVttTime,
  formatTranscript,
  outputFileName,
  toCsv,
  toJson,
  toSrt,
  toStandaloneHtml,
  toTxt,
  toVtt,
  type TranscriptSegment,
} from '../src/format/format'

const segments: TranscriptSegment[] = [
  { startMs: 0, endMs: 2500, text: 'Selamat pagi.' },
  { startMs: 2500, endMs: 61000, text: 'Ini contoh transkrip.' },
  { startMs: 61000, endMs: 3_723_004, text: 'Selesai.' },
]

describe('formatSrtTime', () => {
  it('formats zero', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000')
  })
  it('formats hours, minutes, seconds and millis', () => {
    expect(formatSrtTime(3_723_004)).toBe('01:02:03,004')
    expect(formatSrtTime(61_000)).toBe('00:01:01,000')
  })
  it('clamps negative values', () => {
    expect(formatSrtTime(-500)).toBe('00:00:00,000')
  })
})

describe('formatVttTime', () => {
  it('uses dot separator', () => {
    expect(formatVttTime(3_723_004)).toBe('01:02:03.004')
  })
})

describe('toTxt', () => {
  it('joins trimmed segment texts with newlines', () => {
    expect(toTxt(segments)).toBe('Selamat pagi.\nIni contoh transkrip.\nSelesai.')
  })
  it('skips empty segments', () => {
    expect(toTxt([{ startMs: 0, endMs: 1, text: '   ' }])).toBe('')
  })
})

describe('toSrt', () => {
  it('produces valid numbered blocks', () => {
    const srt = toSrt(segments)
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nSelamat pagi.')
    expect(srt).toContain('2\n00:00:02,500 --> 00:01:01,000\nIni contoh transkrip.')
    expect(srt).toContain('3\n00:01:01,000 --> 01:02:03,004\nSelesai.')
    expect(srt.trimEnd().endsWith('Selesai.')).toBe(true)
  })
  it('returns empty string for no segments', () => {
    expect(toSrt([])).toBe('')
  })
})

describe('toVtt', () => {
  it('starts with WEBVTT header', () => {
    const vtt = toVtt(segments)
    expect(vtt.startsWith('WEBVTT')).toBe(true)
    expect(vtt).toContain('00:00:02.500 --> 00:01:01.000')
  })
})

describe('toJson', () => {
  it('round-trips segment data', () => {
    const parsed = JSON.parse(toJson(segments)) as { segments: TranscriptSegment[] }
    expect(parsed.segments).toHaveLength(3)
    expect(parsed.segments[0]).toEqual({ startMs: 0, endMs: 2500, text: 'Selamat pagi.' })
  })
})

describe('toCsv', () => {
  it('emits a BOM header and one row per segment', () => {
    const csv = toCsv(segments)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const rows = csv.replace(/﻿/, '').trimEnd().split('\r\n')
    expect(rows[0]).toBe('start,end,text')
    expect(rows).toHaveLength(4)
    expect(rows[1]).toBe('00:00:00,000,00:00:02,500,Selamat pagi.')
  })
  it('quotes cells containing commas', () => {
    const csv = toCsv([{ startMs: 0, endMs: 1000, text: 'hello, world' }])
    expect(csv).toContain('"hello, world"')
  })
})

describe('formatTranscript', () => {
  it('dispatches by format', () => {
    expect(formatTranscript(segments, 'txt')).toBe(toTxt(segments))
    expect(formatTranscript(segments, 'srt')).toBe(toSrt(segments))
    expect(formatTranscript(segments, 'vtt')).toBe(toVtt(segments))
    expect(formatTranscript(segments, 'json')).toBe(toJson(segments))
    expect(formatTranscript(segments, 'csv')).toBe(toCsv(segments))
  })

  it('includes csv in the dropdown list', () => {
    expect(OUTPUT_FORMATS).toEqual(['txt', 'srt', 'vtt', 'json', 'csv'])
  })
})

describe('outputFileName', () => {
  it('replaces the extension', () => {
    expect(outputFileName('interview.mp4', 'srt')).toBe('interview.srt')
    expect(outputFileName('no-extension', 'vtt')).toBe('no-extension.vtt')
  })
})

describe('toStandaloneHtml', () => {
  it('embeds audio, words, chapters and offline controls', () => {
    const html = toStandaloneHtml(segments, {
      title: 'Interview <draft>',
      audioDataUri: 'data:audio/wav;base64,AAAA',
      lang: 'en',
      words: [{ startMs: 0, endMs: 500, text: 'Selamat' }],
      chapters: [{ title: 'Opening', startMs: 0 }],
    })
    expect(html).toContain('Interview &lt;draft&gt;')
    expect(html).toContain('id="a"')
    expect(html).toContain('id="q"')
    expect(html).toContain('class="word"')
    expect(html).toContain('class="chapter"')
    expect(html).toContain('window.print()')
    expect(html).not.toContain('https://')
  })
})
