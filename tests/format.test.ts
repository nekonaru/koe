import { describe, expect, it } from 'vitest'
import {
  formatSrtTime,
  formatVttTime,
  formatTranscript,
  outputFileName,
  toJson,
  toSrt,
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

describe('formatTranscript', () => {
  it('dispatches by format', () => {
    expect(formatTranscript(segments, 'txt')).toBe(toTxt(segments))
    expect(formatTranscript(segments, 'srt')).toBe(toSrt(segments))
    expect(formatTranscript(segments, 'vtt')).toBe(toVtt(segments))
    expect(formatTranscript(segments, 'json')).toBe(toJson(segments))
  })
})

describe('outputFileName', () => {
  it('replaces the extension', () => {
    expect(outputFileName('interview.mp4', 'srt')).toBe('interview.srt')
    expect(outputFileName('no-extension', 'vtt')).toBe('no-extension.vtt')
  })
})
