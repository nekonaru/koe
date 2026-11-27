export type OutputFormat = 'txt' | 'srt' | 'vtt' | 'json' | 'csv'

export const OUTPUT_FORMATS: readonly OutputFormat[] = ['txt', 'srt', 'vtt', 'json', 'csv'] as const

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

/** CSV with per-segment timestamps, quoted where needed. BOM prepended so
 *  Excel opens UTF-8 correctly. */
export function toCsv(segments: readonly TranscriptSegment[]): string {
  const escapeCell = (value: string): string => {
    if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }
  const rows = segments.map((segment) =>
    [formatSrtTime(segment.startMs), formatSrtTime(segment.endMs), escapeCell(segment.text.trim())].join(','),
  )
  const header = '\uFEFF' + 'start,end,text'
  return header + '\r\n' + rows.join('\r\n') + '\r\n'
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
    case 'csv':
      return toCsv(segments)
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
  /** Raw word timestamps for karaoke highlighting */
  words?: ReadonlyArray<{ startMs: number; endMs: number; text: string }>
  /** Detected chapters for quick navigation */
  chapters?: ReadonlyArray<{ title: string; startMs: number }>
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
  const { title, audioDataUri, lang, words, chapters } = options
  const labels = lang === 'id'
    ? { play: 'Putar dari sini', stats: 'segmen', search: 'Cari di transkrip', speed: 'Kecepatan', theme: 'Tema', print: 'Cetak', chapters: 'Bab', karaoke: 'Karaoke' }
    : { play: 'Play from here', stats: 'segments', search: 'Search transcript', speed: 'Speed', theme: 'Theme', print: 'Print', chapters: 'Chapters', karaoke: 'Karaoke' }

  const rows = segments
    .map((segment) => {
      const start = formatSrtTime(segment.startMs).replace(',', '.')
      return `      <li class="row" data-start="${Math.round(segment.startMs / 1000)}">
        <button class="ts" data-start="${Math.round(segment.startMs / 1000)}" title="${labels.play}">${start}</button>
        <span class="text">${escapeHtml(segment.text)}</span>
      </li>`
    })
    .join('\n')

  const wordSpans = words && words.length > 0
    ? words.map((word) => `        <span class="word" data-start="${(word.startMs / 1000).toFixed(2)}" data-end="${(word.endMs / 1000).toFixed(2)}">${escapeHtml(word.text)}</span>`).join('\n')
    : ''

  const chapterRows = chapters && chapters.length > 0
    ? chapters.map((chapter) => `        <button class="chapter" data-start="${Math.round(chapter.startMs / 1000)}">${formatSrtTime(chapter.startMs).slice(0, 5)} ${escapeHtml(chapter.title)}</button>`).join('\n')
    : ''

  const safeTitle = escapeHtml(title)
  const safeAudio = escapeHtml(audioDataUri)

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  :root { color-scheme: dark; }
  :root.light { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #141414; color: #FAF7F2;
    font-family: Georgia, 'Times New Roman', serif; line-height: 1.6;
  }
  :root.light body { background: #FAF7F2; color: #141414; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 32px 20px 80px; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 1.5rem; margin: 0; font-weight: 600; flex: 1; }
  .meta { color: #FAF7F2cc; font-size: 0.85rem; }
  :root.light .meta { color: #14141499; }
  audio { width: 100%; margin: 20px 0; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  input, select, button {
    font: inherit; font-size: 0.85rem; border-radius: 8px;
    border: 1px solid #FAF7F240; background: #ffffff12; color: inherit;
    padding: 6px 10px;
  }
  :root.light input, :root.light select, :root.light button { border-color: #14141430; background: #14141408; }
  button { cursor: pointer; }
  input[type="search"] { flex: 1; min-width: 180px; }
  ol { list-style: none; padding: 0; }
  .row { display: flex; gap: 12px; padding: 6px 10px; border-radius: 10px; border-left: 3px solid transparent; cursor: pointer; }
  .row:hover, .row.current { background: rgba(250,247,242,0.07); border-left-color: #FF7A59; }
  :root.light .row:hover, :root.light .row.current { background: #1414140d; }
  .ts { background: none; border: 0; color: #FF7A59; font-family: ui-monospace, monospace; font-size: 0.8rem; cursor: pointer; padding: 4px 0; }
  .ts:hover { text-decoration: underline; }
  .text { flex: 1; }
  .chapters { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 20px; }
  .chapter { font-size: 0.75rem; }
  .karaoke { font-size: 1.15rem; line-height: 2; margin: 12px 0 24px; }
  .word { padding: 1px 2px; border-radius: 4px; }
  .word.active { background: #FF7A59; color: #1A1207; font-weight: 700; }
  footer { color: #FAF7F266; font-size: 0.75rem; margin-top: 32px; }
  @media (prefers-reduced-motion: no-preference) { .row, .word { transition: background 120ms ease; } }
  @media print {
    audio, .controls, .chapters, .ts, button, input, select { display: none !important; }
    body { background: #fff; color: #000; }
    .wrap { padding: 0; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${safeTitle}</h1>
    <span class="meta">${segments.length} ${labels.stats}</span>
  </header>
  <audio id="a" controls preload="auto" src="${safeAudio}"></audio>
  <div class="controls">
    <input id="q" type="search" placeholder="${labels.search}" aria-label="${labels.search}">
    <select id="rate" aria-label="${labels.speed}">
      <option value="0.75">0.75x</option>
      <option value="1" selected>1x</option>
      <option value="1.25">1.25x</option>
      <option value="1.5">1.5x</option>
      <option value="2">2x</option>
    </select>
    <button id="theme" type="button">${labels.theme}</button>
    <button id="print" type="button">${labels.print}</button>
  </div>
${chapterRows ? `  <div class="chapters">\n${chapterRows}\n  </div>` : ''}
${wordSpans ? `  <section aria-label="${labels.karaoke}"><h2>${labels.karaoke}</h2><p class="karaoke" id="karaoke">\n${wordSpans}\n  </p></section>` : ''}
  <ol id="rows">
${rows}
  </ol>
  <footer>koe Â· ${safeTitle}</footer>
</div>
<script>
  var audio = document.getElementById('a');
  var rows = [].slice.call(document.querySelectorAll('.row'));
  var words = [].slice.call(document.querySelectorAll('.word'));
  var search = document.getElementById('q');
  var rate = document.getElementById('rate');
  function playFrom(seconds) {
    audio.currentTime = seconds;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }
  document.getElementById('rows').addEventListener('click', function (event) {
    var row = event.target.closest('.row');
    if (row) playFrom(Number(row.dataset.start));
  });
  document.querySelectorAll('.chapter').forEach(function (button) {
    button.addEventListener('click', function () { playFrom(Number(button.dataset.start)); });
  });
  search.addEventListener('input', function () {
    var needle = search.value.trim().toLowerCase();
    rows.forEach(function (row) {
      row.style.display = !needle || row.textContent.toLowerCase().indexOf(needle) >= 0 ? '' : 'none';
    });
  });
  rate.addEventListener('change', function () { audio.playbackRate = Number(rate.value); });
  document.getElementById('theme').addEventListener('click', function () {
    document.documentElement.classList.toggle('light');
  });
  document.getElementById('print').addEventListener('click', function () { window.print(); });
  audio.addEventListener('timeupdate', function () {
    rows.forEach(function (row) {
      var start = Number(row.dataset.start);
      row.classList.toggle('current', start <= audio.currentTime && audio.currentTime < start + 4);
    });
    words.forEach(function (word) {
      var start = Number(word.dataset.start);
      var end = Number(word.dataset.end);
      word.classList.toggle('active', start <= audio.currentTime && audio.currentTime < end);
    });
    var current = document.querySelector('.row.current');
    if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  document.addEventListener('keydown', function (event) {
    if (event.target && /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); if (audio.paused) audio.play(); else audio.pause(); }
    if (event.key === '/') { event.preventDefault(); search.focus(); }
  });
</script>
</body>
</html>
`
}
export function toBilingualSrt(
  segments: readonly TranscriptSegment[],
  translations: readonly string[],
): string {
  return segments.map((segment, index) => [
    index + 1,
    `${formatSrtTime(segment.startMs)} --> ${formatSrtTime(segment.endMs)}`,
    segment.text.trim(),
    (translations[index] ?? '').trim(),
    '',
  ].join('\n')).join('\n').trimEnd() + '\n'
}

export function toBilingualVtt(
  segments: readonly TranscriptSegment[],
  translations: readonly string[],
): string {
  return 'WEBVTT\n\n' + segments.map((segment, index) => [
    `${formatVttTime(segment.startMs)} --> ${formatVttTime(segment.endMs)}`,
    segment.text.trim(),
    (translations[index] ?? '').trim(),
    '',
  ].join('\n')).join('\n').trimEnd() + '\n'
}

export function toBilingualCsv(
  segments: readonly TranscriptSegment[],
  translations: readonly string[],
): string {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = ['start,end,original,translated']
  for (const [index, segment] of segments.entries()) {
    lines.push([
      formatSrtTime(segment.startMs).replace(',', '.'),
      formatSrtTime(segment.endMs).replace(',', '.'),
      cell(segment.text),
      cell(translations[index] ?? ''),
    ].join(','))
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

export function toBilingualMarkdown(
  segments: readonly TranscriptSegment[],
  translations: readonly string[],
  title: string,
): string {
  const header = `# ${title}\n\n`
  return header + segments.map((segment, index) => (
    `## ${formatSrtTime(segment.startMs).slice(0, 5)}\n\n${segment.text.trim()}\n\n> ${(translations[index] ?? '').trim()}\n`
  )).join('\n')
}

export const MIME_TYPES: Record<OutputFormat, string> = {
  txt: 'text/plain;charset=utf-8',
  srt: 'application/x-subrip;charset=utf-8',
  vtt: 'text/vtt;charset=utf-8',
  json: 'application/json;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
}

export function outputFileName(inputName: string, format: OutputFormat): string {
  const base = inputName.replace(/\.[^.]+$/, '')
  return `${base}.${format}`
}
