export function cleanupTranscript(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return ''
  const spaced = text.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?;:])/g, '$1').trim()
  const deduped = spaced.replace(/\b(\p{L}[\p{L}\p{N}']*)(?:\s+\1)+\b/giu, '$1')
  return deduped.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_match, prefix: string, letter: string) =>
    prefix + letter.toUpperCase(),
  )
}

export function detectRepeats(text: string): boolean {
  if (typeof text !== 'string') return false
  const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
  for (let i = 0; i + 5 <= words.length; i++) {
    let wordRun = true
    for (let j = 1; j < 5; j++) {
      if (words[i + j] !== words[i]) {
        wordRun = false
        break
      }
    }
    if (wordRun) return true
    if (i + 10 > words.length) continue
    let pairRun = true
    for (let j = 2; j < 10; j++) {
      if (words[i + j] !== words[i + j - 2]) {
        pairRun = false
        break
      }
    }
    if (pairRun) return true
  }
  return false
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findReplaceSegments<T extends { text: string }>(
  segments: T[],
  needle: string,
  replacement: string,
  opts: { regex?: boolean; caseSensitive?: boolean } = {},
): { segments: T[]; count: number } {
  const unchanged = { segments, count: 0 }
  if (!Array.isArray(segments) || typeof needle !== 'string' || needle.length === 0) return unchanged

  const flags = opts.caseSensitive ? 'g' : 'gi'
  let pattern: RegExp
  try {
    pattern = opts.regex ? new RegExp(needle, flags) : new RegExp(escapeRegExp(needle), flags)
  } catch {
    return unchanged
  }

  // A pattern that matches an empty string can produce misleading counts.
  try {
    const probe = new RegExp(pattern.source, pattern.flags.replace('g', ''))
    if (probe.test('')) return unchanged
  } catch {
    return unchanged
  }

  let count = 0
  const next = segments.map((segment) => {
    if (typeof segment.text !== 'string') return segment
    const matches = segment.text.match(pattern)
    if (!matches || matches.length === 0) return segment
    count += matches.length
    return { ...segment, text: segment.text.replace(pattern, replacement) }
  })
  return { segments: next, count }
}

interface Chapter {
  title: string
  startMs: number
}

function chapterTitle(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 6).join(' ')
  return words || 'Untitled'
}

export function buildChapters<T extends { startMs: number; endMs: number; text: string }>(
  segments: T[],
  gapMs = 4000,
): Chapter[] {
  if (!Array.isArray(segments) || segments.length === 0) return []
  const gap = Number.isFinite(gapMs) && gapMs >= 0 ? gapMs : 4000
  const chapters: Chapter[] = []
  let start = 0
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].startMs - segments[i - 1].endMs > gap) {
      chapters.push({ title: chapterTitle(segments[start].text), startMs: segments[start].startMs })
      start = i
    }
  }
  chapters.push({ title: chapterTitle(segments[start].text), startMs: segments[start].startMs })
  return chapters
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(ms) ? ms / 1000 : 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

function groupParagraphs<T extends { startMs: number; endMs: number; text: string; speaker?: number }>(
  segments: T[],
): string[] {
  const paragraphs: string[] = []
  let current = ''
  let previous: T | null = null
  for (const segment of segments) {
    if (typeof segment.text !== 'string' || segment.text.trim().length === 0) continue
    const speakerChanged = previous !== null && segment.speaker !== previous.speaker
    const longGap = previous !== null && segment.startMs - previous.endMs > 4000
    if (current.length > 0 && (speakerChanged || longGap)) {
      paragraphs.push(current)
      current = ''
    }
    const label =
      current.length === 0 && typeof segment.speaker === 'number'
        ? `**Speaker ${segment.speaker + 1}:** `
        : ''
    current = current.length > 0 ? `${current} ${segment.text.trim()}` : label + segment.text.trim()
    previous = segment
  }
  if (current.length > 0) paragraphs.push(current)
  return paragraphs
}

export function toMarkdown<T extends { startMs: number; endMs: number; text: string; speaker?: number }>(
  segments: T[],
  title: string,
  chapters?: Chapter[],
): string {
  const lines = [`# ${title.trim() || 'Transcript'}`, '']
  const items = Array.isArray(segments) ? segments : []
  const sorted = Array.isArray(chapters) ? [...chapters].sort((a, b) => a.startMs - b.startMs) : []

  if (sorted.length > 0) {
    for (let i = 0; i < sorted.length; i++) {
      const chapter = sorted[i]
      const end = i + 1 < sorted.length ? sorted[i + 1].startMs : Infinity
      const group = items.filter((segment) => segment.startMs >= chapter.startMs && segment.startMs < end)
      lines.push(`## [${formatTime(chapter.startMs)}] ${chapter.title}`, '')
      for (const paragraph of groupParagraphs(group)) lines.push(paragraph, '')
    }
  } else {
    for (const paragraph of groupParagraphs(items)) lines.push(paragraph, '')
  }

  return lines.join('\n').trimEnd() + '\n'
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > width) {
      if (line) {
        lines.push(line)
        line = ''
      }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width))
      continue
    }
    if (!line) line = word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export function toCaptionLines<T extends { startMs: number; endMs: number; text: string }>(
  segments: T[],
  maxChars = 42,
): string {
  const width = Number.isFinite(maxChars) && maxChars > 0 ? Math.max(4, Math.floor(maxChars)) : 42
  const lines: string[] = []
  for (const segment of Array.isArray(segments) ? segments : []) {
    if (typeof segment.text !== 'string' || segment.text.trim().length === 0) continue
    const prefix = `[${formatTime(segment.startMs)}] `
    for (const line of wrapText(segment.text.trim(), width)) lines.push(prefix + line)
  }
  return lines.join('\n')
}

export function toCleanParagraphs<T extends { text: string }>(segments: T[]): string {
  const sentences: string[] = []
  for (const segment of Array.isArray(segments) ? segments : []) {
    const cleaned = cleanupTranscript(typeof segment.text === 'string' ? segment.text : '')
    if (!cleaned) continue
    const parts = cleaned.match(/[^.!?]+[.!?]*\s*/g) ?? [cleaned]
    for (const part of parts) {
      const sentence = part.trim()
      if (sentence) sentences.push(sentence)
    }
  }
  const paragraphs: string[] = []
  for (let i = 0; i < sentences.length; i += 3) paragraphs.push(sentences.slice(i, i + 3).join(' '))
  return paragraphs.join('\n\n')
}
