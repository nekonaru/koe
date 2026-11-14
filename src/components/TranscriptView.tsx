import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { SAMPLE_RATE } from '../audio/decode'
import type { TranscriptSegment } from '../format/format'

interface TranscriptViewProps {
  /** Lazy access to the 16 kHz mono PCM buffer, used by playback only */
  getPcm: () => Float32Array | null
  /** Whether the audio is available for playback (avoids reading refs during render) */
  canPlay: boolean
  segments: TranscriptSegment[]
  onEditSegment: (index: number, text: string) => void
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
    const words = segment.text.trim().split(/\s+/).filter(Boolean)
    return total + words.length
  }, 0)
}

export function TranscriptView({ getPcm, canPlay, segments, onEditSegment }: TranscriptViewProps) {
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
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const startPlayback = useCallback(
    (offsetMs: number) => {
      const pcm = getPcm()
      if (!pcm) return
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

  const words = countWords(segments)

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

      {/* Segments */}
      <div ref={listRef} className="overflow-auto bg-white px-2 py-2 dark:bg-[#191D29]">
        {segments.length === 0 ? (
          <p className="px-2 py-3 text-sm text-neutral-500">{t('results.emptyTranscript')}</p>
        ) : (
          <ol className="space-y-1">
            {segments.map((segment, index) => {
              const isCurrent = index === currentSegmentIndex
              const noHit = query.length > 0 && !segment.text.toLowerCase().includes(query.toLowerCase())
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
                  {editingIndex === index ? (
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
                      className="min-h-6 flex-1 resize-none overflow-hidden bg-transparent text-sm leading-snug text-neutral-800 outline-none focus:rounded-md focus:ring-2 focus:ring-coral/30 dark:text-warm/90"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingIndex(index)}
                      className="min-h-6 flex-1 text-left text-sm leading-snug text-neutral-800 outline-none focus:rounded-md focus:ring-2 focus:ring-coral/30 dark:text-warm/90"
                      aria-label={t('results.editHint')}
                    >
                      {highlight(segment.text, query)}
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between gap-2 border-t border-ai/10 px-4 py-1.5 text-[10px] font-semibold text-neutral-500 dark:border-warm/10 dark:text-neutral-400">
        <span>{t('results.stats', { words, segments: segments.length })}</span>
        <span>{t('results.editHint')}</span>
      </div>
    </div>
  )
}
