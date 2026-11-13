export type OutputFormat = 'txt' | 'srt' | 'vtt' | 'json'

export const OUTPUT_FORMATS: readonly OutputFormat[] = ['txt', 'srt', 'vtt', 'json'] as const

export interface TranscriptSegment {
  startMs: number
  endMs: number
  text: string
}

function pad(value: number, length: number): string {
  return String(Math.floor(Math.abs(value))).padStart(length, '0')
}

/** SRT timestamp: HH:MM:SS,mmm */
export function formatSrtTime(ms: number): string {
  const clamped = Math.max(0, Math.round(ms))
  const hours = Math.floor(clamped / 3_600_000)
  const minutes = Math.floor((clamped % 3_600_000) / 60_000)
  const seconds = Math.floor((clamped % 60_000) / 1000)
  const millis = clamped % 1000
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`
}

/** VTT timestamp: HH:MM:SS.mmm */
export function formatVttTime(ms: number): string {
  return formatSrtTime(ms).replace(',', '.')
}

export function toTxt(segments: readonly TranscriptSegment[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter((text) => text.length > 0)
    .join('\n')
}

export function toSrt(segments: readonly TranscriptSegment[]): string {
  return segments
    .map((segment, index) => {
      const lines = [
        String(index + 1),
        `${formatSrtTime(segment.startMs)} --> ${formatSrtTime(segment.endMs)}`,
        segment.text.trim(),
      ]
      return lines.join('\n')
    })
    .join('\n\n')
    .concat(segments.length > 0 ? '\n' : '')
}

export function toVtt(segments: readonly TranscriptSegment[]): string {
  const blocks = segments.map(
    (segment) =>
      `${formatVttTime(segment.startMs)} --> ${formatVttTime(segment.endMs)}\n${segment.text.trim()}`,
  )
  return ['WEBVTT', ...blocks].join('\n\n').concat('\n')
}

export interface JsonTranscript {
  segments: TranscriptSegment[]
}

export function toJson(segments: readonly TranscriptSegment[]): string {
  const payload: JsonTranscript = {
    segments: segments.map((segment) => ({
      startMs: Math.max(0, Math.round(segment.startMs)),
      endMs: Math.max(0, Math.round(segment.endMs)),
      text: segment.text.trim(),
    })),
  }
  return JSON.stringify(payload, null, 2)
}

export function formatTranscript(segments: readonly TranscriptSegment[], format: OutputFormat): string {
  switch (format) {
    case 'txt':
      return toTxt(segments)
    case 'srt':
      return toSrt(segments)
    case 'vtt':
      return toVtt(segments)
    case 'json':
      return toJson(segments)
  }
}

export const MIME_TYPES: Record<OutputFormat, string> = {
  txt: 'text/plain;charset=utf-8',
  srt: 'application/x-subrip;charset=utf-8',
  vtt: 'text/vtt;charset=utf-8',
  json: 'application/json;charset=utf-8',
}

export function outputFileName(inputName: string, format: OutputFormat): string {
  const base = inputName.replace(/\.[^.]+$/, '')
  return `${base}.${format}`
}
