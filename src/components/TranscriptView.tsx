import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { SAMPLE_RATE } from '../audio/decode'
import type { TranscriptSegment } from '../format/format'
import type { KaraokeWord } from '../lib/messages'

interface TranscriptViewProps {
  /** Lazy access to the 16 kHz mono PCM buffer, used by playback only */
  getPcm: () => Float32Array | null
  /** Whether the audio is available for playback (avoids reading refs during render) */
  canPlay: boolean
  segments: TranscriptSegment[]
  /** Word-level timestamps, when the user asked for karaoke output */
  words?: KaraokeWord[]
  /** How to render the transcript: lines (default) or flowing karaoke text */
  displayMode: 'lines' | 'karaoke'
  onEditSegment: (index: number, text: string) => void
  /** Shift every segment's timestamps by offsetMs */
  onShiftSegments: (offsetMs: number) => void
  /** Reports the current playback position to the parent, for editing tools */
  onPlayhead?: (ms: number) => void
  /** Translated text aligned by segment index */
  translations?: string[]
  /** Show both source and translation under each timestamp */
  showTranslation?: boolean
  /** Make the translation the primary reading text */
  preferTranslation?: boolean
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, query: string) {
  if (!query) return text
  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'ig')
  const parts = text.split(pattern)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded bg-coral/30 px-0.5">{part}</mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

function countWords(segments: readonly TranscriptSegment[]): number {
  return segments.reduce((total, segment) => {
    const segWords = segment.text.trim().split(/\s+/).filter(Boolean)
    return total + segWords.length
  }, 0)
}

const PEAK_BUCKETS = 200

/** A compact canvas waveform that doubles as a seek bar and progress display. */
function Waveform({ getPcm, playheadMs, onSeek, canPlay, t }: {
  getPcm: () => Float32Array | null
  playheadMs: number
  onSeek: (ms: number) => void
  canPlay: boolean
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const pcm = getPcm()
    const dark = document.documentElement.classList.contains('dark')

    const W = canvas.width
    const H = canvas.height
    ctx2d.clearRect(0, 0, W, H)

    // Bar baseline and colors
    ctx2d.fillStyle = dark ? 'rgba(250,247,242,0.08)' : 'rgba(43,58,103,0.08)'
    ctx2d.fillRect(0, H / 2 - 1, W, 2)
    const base = dark ? 'rgba(250,247,242,0.55)' : '#2B3A67'
    const accent = '#FF7A59'

    const durationMs = pcm ? (pcm.length / SAMPLE_RATE) * 1000 : 0
    const progressFraction =
      durationMs > 0 ? Math.min(1, Math.max(0, playheadMs / durationMs)) : 0

    // Precompute peaks
    const peaks: Array<{ min: number; max: number }> = []
    if (pcm) {
      const samplesPerBucket = Math.max(1, Math.floor(pcm.length / PEAK_BUCKETS))
      for (let i = 0; i < PEAK_BUCKETS; i += 1) {
        const start = i * samplesPerBucket
        const end = Math.min(pcm.length, start + samplesPerBucket)
        let min = 1
        let max = -1
        for (let j = start; j < end; j += 1) {
          const v = pcm[j]
          if (v < min) min = v
          if (v > max) max = v
        }
        if (min === 1 && max === -1) { min = 0; max = 0 }
        peaks.push({ min, max })
      }
    }

    const bucketWidth = W / PEAK_BUCKETS
    for (let i = 0; i < PEAK_BUCKETS; i += 1) {
      const { min, max } = peaks[i]
      const top = H / 2 - Math.max(Math.abs(max), Math.abs(min)) * (H / 2 - 2)
      const bottom = H / 2 + Math.max(Math.abs(max), Math.abs(min)) * (H / 2 - 2)
      const x = i * bucketWidth + 1
      const highlight = i < progressFraction * PEAK_BUCKETS
      ctx2d.fillStyle = highlight ? accent : base
      ctx2d.fillRect(x, top, Math.max(1, bucketWidth - 2), Math.max(2, bottom - top))
    }

    // Playhead marker
    const px = progressFraction * W
    ctx2d.fillStyle = accent
    ctx2d.fillRect(px - 1, 0, 2, H)
  }, [getPcm, playheadMs])

  const handleSeek = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const pcm = getPcm()
      if (!canvas || !pcm) return
      const rect = canvas.getBoundingClientRect()
      const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const durationMs = (pcm.length / SAMPLE_RATE) * 1000
      onSeek(fraction * durationMs)
    },
    [getPcm, onSeek],
  )

  return (
    <div className="border-b border-ai/10 bg-ai/5 px-2 py-2 dark:border-warm/10 dark:bg-warm/5">
      <canvas
        ref={canvasRef}
        width={640}
        height={56}
        className="h-14 w-full cursor-crosshair rounded-lg"
        onClick={handleSeek}
        role="button"
        aria-label={t('results.waveformSeek')}
        aria-disabled={!canPlay}
        tabIndex={canPlay ? 0 : -1}
      />
    </div>
  )
}

/** Karaoke view: a flowing paragraph whose words highlight during playback. */
function KaraokeView({
  words,
  playheadMs,
  query,
  t,
}: {
  words: KaraokeWord[]
  playheadMs: number
  query: string
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const containerRef = useRef<HTMLParagraphElement | null>(null)

  // Auto-scroll the active word into view while playing
  useEffect(() => {
    if (!containerRef.current) return
    const active = containerRef.current.querySelector<HTMLElement>('[data-active="true"]')
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [playheadMs])

  const lowerQuery = query.trim().toLowerCase()

  return (
    <div className="max-w-none px-2 py-3">
      <p ref={containerRef} className="text-base leading-loose text-neutral-800 dark:text-warm/90">
        {words.map((word, index) => {
          const active = playheadMs >= word.startMs && playheadMs < word.endMs
          const dim = lowerQuery.length > 0 && !word.text.toLowerCase().includes(lowerQuery)
          return (
            <span
              key={index}
              data-active={active ? 'true' : 'false'}
              className={[
                'rounded px-0.5 transition-colors',
                active ? 'bg-coral font-extrabold text-[#1A1207]' : '',
                dim ? 'opacity-30' : '',
              ].join(' ')}
            >
              {word.text}
            </span>
          )
        })}
      </p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {t('results.karaokeHint')}
      </p>
    </div>
  )
}

export function TranscriptView({ getPcm, canPlay, segments, words, displayMode, onEditSegment, onShiftSegments, onPlayhead, translations, showTranslation, preferTranslation }: TranscriptViewProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [playState, setPlayState] = useState<'stopped' | 'playing' | 'paused'>('stopped')
  const [playheadMs, setPlayheadMs] = useState(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const startedAtRef = useRef(0)
  const pausedOffsetRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const onPlayheadRef = useRef(onPlayhead)
  useEffect(() => {
    onPlayheadRef.current = onPlayhead
  }, [onPlayhead])

  const matchCount = useMemo(() => {
    if (!query) return 0
    const q = query.toLowerCase()
    return segments.reduce((total, segment) => {
      const matches = segment.text.toLowerCase().split(q).length - 1
      return total + matches
    }, 0)
  }, [query, segments])

  const currentSegmentIndex = useMemo(() => {
    if (playState === 'stopped') return -1
    return segments.findIndex((segment) => playheadMs >= segment.startMs && playheadMs < segment.endMs)
  }, [playheadMs, playState, segments])

  const listRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Array<HTMLLIElement | null>>([])

  useEffect(() => {
    if (playState === 'stopped' || currentSegmentIndex < 0) return
    rowRefs.current[currentSegmentIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentSegmentIndex, playState])

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    sourceRef.current?.stop()
    sourceRef.current?.disconnect()
    sourceRef.current = null
    gainRef.current?.disconnect()
    gainRef.current = null
    startedAtRef.current = 0
    pausedOffsetRef.current = 0
    setPlayheadMs(0)
    setPlayState('stopped')
  }, [])

  const tickPlayhead = useCallback(function tick() {
    const ctx = ctxRef.current
    if (!ctx || ctx.state !== 'running') {
      rafRef.current = null
      return
    }
    const elapsed = (ctx.currentTime - startedAtRef.current) * 1000
    const position = pausedOffsetRef.current + elapsed
    setPlayheadMs(position)
    onPlayheadRef.current?.(position)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const startPlayback = useCallback(
    (offsetMs: number) => {
      const pcm = getPcm()
      if (!pcm) {
        console.warn('[koe] playback requested but PCM buffer is empty for this item')
        return
      }
      const AudioContextCtor = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) return
      if (ctxRef.current) void ctxRef.current.close()
      const ctx = new AudioContextCtor()
      ctxRef.current = ctx

      const buffer = bufferRef.current ?? ctx.createBuffer(1, pcm.length, SAMPLE_RATE)
      // Copy the PCM into the AudioBuffer's channel data.
      buffer.copyToChannel(new Float32Array(pcm), 0)
      bufferRef.current = buffer

      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gainRef.current = gain

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(gain)
      source.onended = () => {
        if (sourceRef.current === source) stopPlayback()
      }

      sourceRef.current = source
      pausedOffsetRef.current = offsetMs
      startedAtRef.current = ctx.currentTime - offsetMs / 1000
      void ctx.resume().then(() => {
        source.start(0, offsetMs / 1000)
        setPlayState('playing')
        if (rafRef.current === null) rafRef.current = requestAnimationFrame(tickPlayhead)
      })
    },
    [getPcm, stopPlayback, tickPlayhead],
  )

  const togglePlay = useCallback(() => {
    if (playState === 'playing') {
      void ctxRef.current?.suspend()
      setPlayState('paused')
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }
    if (playState === 'paused') {
      void ctxRef.current?.resume()
      setPlayState('playing')
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tickPlayhead)
      return
    }
    startPlayback(0)
  }, [playState, startPlayback, tickPlayhead])

  const seekTo = useCallback(
    (ms: number) => {
      startPlayback(Math.max(0, ms))
      onPlayheadRef.current?.(Math.max(0, ms))
    },
    [startPlayback],
  )

  useEffect(
    () => () => {
      stopPlayback()
      if (ctxRef.current) void ctxRef.current.close()
      ctxRef.current = null
    },
    [stopPlayback],
  )

  const totalWords = countWords(segments)

  // Footer: words per minute computed from the last segment end.
  const lastEndMs = segments.length > 0 ? segments[segments.length - 1].endMs : 0
  const wpm = lastEndMs > 0 ? Math.round((totalWords / lastEndMs) * 60000) : 0

  return (
    <div className="flex max-h-80 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ai/10 px-4 py-2 dark:border-warm/10">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('results.searchPlaceholder')}
          aria-label={t('results.searchPlaceholder')}
          data-testid="transcript-search"
          className="min-w-40 flex-1 rounded-lg border border-ai/20 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
        />
        {query && (
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {matchCount > 0 ? t('results.searchMatches', { count: matchCount }) : t('results.searchNoMatches')}
          </span>
        )}
        {canPlay && (
          <button
            type="button"
            onClick={togglePlay}
            aria-pressed={playState !== 'stopped'}
            aria-label={playState === 'playing' ? t('results.pause') : t('results.listen')}
            data-testid="listen-toggle"
            className="flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-xs font-extrabold text-warm hover:bg-ai-light focus-visible:ring-2 focus-visible:ring-coral/50"
          >
            {playState === 'playing' ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect width="4" height="12" /><rect x="8" width="4" height="12" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5L3 1.5Z" /></svg>
            )}
            {playState === 'playing' ? t('results.pause') : t('results.listen')}
          </button>
        )}
        {playState !== 'stopped' && (
          <button
            type="button"
            onClick={stopPlayback}
            className="rounded-lg border border-coral/50 px-3 py-1.5 text-xs font-extrabold text-coral hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-coral/50"
          >
            {t('results.stop')}
          </button>
        )}
      </div>

      {/* Waveform with seek */}
      {canPlay && (
        <Waveform getPcm={getPcm} playheadMs={playheadMs} onSeek={seekTo} canPlay={canPlay} t={t} />
      )}

      {/* Segments */}
      <div ref={listRef} className="overflow-auto bg-white px-2 py-2 dark:bg-[#191D29]">
        {segments.length === 0 ? (
          <p className="px-2 py-3 text-sm text-neutral-500">{t('results.emptyTranscript')}</p>
        ) : displayMode === 'karaoke' && words && words.length > 0 ? (
          <KaraokeView words={words} playheadMs={playheadMs} query={query} t={t} />
        ) : (
          <ol className="space-y-1">
            {segments.map((segment, index) => {
              const isCurrent = index === currentSegmentIndex
              const translated = translations?.[index] ?? ''
              const editable = !(translated && (showTranslation || preferTranslation))
              const primary = preferTranslation && translated ? translated : segment.text
              const secondary = showTranslation && translated ? (preferTranslation ? segment.text : translated) : ''
              const noHit = query.length > 0 && !`${segment.text} ${translated}`.toLowerCase().includes(query.toLowerCase())
              return (
                <li
                  key={index}
                  ref={(el) => { rowRefs.current[index] = el }}
                  className={[
                    'flex items-start gap-2 rounded-xl border-l-4 px-2 py-1 transition-colors',
                    isCurrent ? 'border-coral bg-coral/10' : 'border-transparent',
                    noHit ? 'opacity-35' : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => seekTo(segment.startMs)}
                    disabled={!canPlay}
                    className="w-14 shrink-0 pt-0.5 text-right font-mono text-[10px] font-bold text-ai/70 hover:text-coral disabled:opacity-40 dark:text-warm/70"
                    aria-label={`${formatTime(segment.startMs)} - ${formatTime(segment.endMs)}`}
                  >
                    {formatTime(segment.startMs)}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editingIndex === index && editable ? (
                      <textarea
                        autoFocus
                        rows={1}
                        value={segment.text}
                        aria-label={t('results.editHint')}
                        onChange={(event) => {
                          onEditSegment(index, event.target.value)
                          event.target.style.height = 'auto'
                          event.target.style.height = `${event.target.scrollHeight}px`
                        }}
                        onBlur={() => setEditingIndex(null)}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                          }
                        }}
                        className="min-h-6 w-full resize-none overflow-hidden bg-transparent text-sm leading-snug text-neutral-800 outline-none focus:rounded-md focus:ring-2 focus:ring-coral/30 dark:text-warm/90"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => { if (editable) setEditingIndex(index) }}
                        className="min-h-6 w-full text-left text-sm leading-snug text-neutral-800 outline-none focus:rounded-md focus:ring-2 focus:ring-coral/30 dark:text-warm/90"
                        aria-label={editable ? t('results.editHint') : undefined}
                      >
                        {highlight(primary, query)}
                      </button>
                    )}
                    {secondary && (
                      <p className="mt-0.5 text-xs leading-snug text-neutral-500 dark:text-neutral-400">
                        {highlight(secondary, query)}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ai/10 px-4 py-1.5 text-[10px] font-semibold text-neutral-500 dark:border-warm/10 dark:text-neutral-400">
        <span>
          {t('results.stats', { words: totalWords, segments: segments.length })}
          {wpm > 0 && ` · ${t('results.wpm', { wpm })}`}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{t('results.editHint')}</span>
          <button
            type="button"
            onClick={() => onShiftSegments(-1000)}
            aria-label={t('results.shiftBack')}
            title={t('results.shiftBack')}
            className="rounded border border-ai/20 px-1.5 py-0.5 text-[10px] font-bold hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20"
          >
            -1s
          </button>
          <button
            type="button"
            onClick={() => onShiftSegments(1000)}
            aria-label={t('results.shiftForward')}
            title={t('results.shiftForward')}
            className="rounded border border-ai/20 px-1.5 py-0.5 text-[10px] font-bold hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20"
          >
            +1s
          </button>
        </span>
      </div>
    </div>
  )
}
