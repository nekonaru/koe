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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface StandaloneHtmlOptions {
  /** Document title (usually the original file name) */
  title: string
  /** WAV data URI embedded as the audio source */
  audioDataUri: string
  /** UI language for the page labels */
  lang: 'en' | 'id'
}

/**
 * Build a fully self-contained HTML page with the transcript and the
 * embedded audio. Open it offline in any browser; it has no scripts,
 * styles or fonts from elsewhere, and no dependencies.
 */
export function toStandaloneHtml(
  segments: readonly TranscriptSegment[],
  options: StandaloneHtmlOptions,
): string {
  const { title, audioDataUri, lang } = options
  const labels = lang === 'id'
    ? { play: 'Putar dari sini', stats: 'segmen' }
    : { play: 'Play from here', stats: 'segments' }

  const rows = segments
    .map((segment) => {
      const start = formatSrtTime(segment.startMs).replace(',', '.')
      return `      <li class="row" data-start="${Math.round(segment.startMs / 1000)}">
        <button class="ts" data-start="${Math.round(segment.startMs / 1000)}" title="${labels.play}">${start}</button>
        <span class="text">${escapeHtml(segment.text)}</span>
      </li>`
    })
    .join('\n')

  const safeTitle = escapeHtml(title)

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #141414; color: #FAF7F2;
    font-family: Georgia, 'Times New Roman', serif; line-height: 1.6;
  }
  .wrap { max-width: 860px; margin: 0 auto; padding: 32px 20px 80px; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 1.5rem; margin: 0; font-weight: 600; }
  .meta { color: #FAF7F2cc; font-size: 0.85rem; }
  audio { width: 100%; margin: 20px 0; }
  ol { list-style: none; padding: 0; }
  .row { display: flex; gap: 12px; padding: 6px 10px; border-radius: 10px; border-left: 3px solid transparent; cursor: pointer; }
  .row:hover, .row.current { background: rgba(250,247,242,0.07); border-left-color: #FF7A59; }
  .ts { background: none; border: 0; color: #FF7A59; font-family: ui-monospace, monospace; font-size: 0.8rem; cursor: pointer; padding: 4px 0; }
  .ts:hover { text-decoration: underline; }
  .text { flex: 1; }
  footer { color: #FAF7F266; font-size: 0.75rem; margin-top: 32px; }
  @media (prefers-reduced-motion: no-preference) { .row { transition: background 120ms ease; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${safeTitle}</h1>
    <span class="meta">${segments.length} ${labels.stats}</span>
  </header>
  <audio id="a" controls preload="auto" src="${audioDataUri}"></audio>
  <ol id="rows">
${rows}
  </ol>
  <footer>koe · ${safeTitle}</footer>
</div>
<script>
  const audio = document.getElementById('a');
  const rows = [...document.querySelectorAll('.row')];
  function playFrom(seconds) {
    audio.currentTime = seconds;
    audio.play();
  }
  document.getElementById('rows').addEventListener('click', (event) => {
    const row = event.target.closest('.row');
    if (!row) return;
    playFrom(Number(row.dataset.start));
  });
  audio.addEventListener('timeupdate', () => {
    rows.forEach((row) => row.classList.toggle('current', Number(row.dataset.start) <= audio.currentTime && audio.currentTime < Number(row.dataset.start) + 4));
    const current = document.querySelector('.row.current');
    if (current) current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
</script>
</body>
</html>
`
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
