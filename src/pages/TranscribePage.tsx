import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Dropzone } from '../components/Dropzone'
import { ModelManager } from '../components/ModelManager'
import { useI18n } from '../i18n/useI18n'
import { decodeToPcm16kMono, formatDuration } from '../audio/decode'
import { DEFAULT_MODEL, LANGUAGES, formatBytes, getModel, type ModelId } from '../lib/models'
import { toKoeError, type KoeErrorCode } from '../lib/errors'
import type { FromWorker, Task, ToWorker } from '../lib/messages'
import {
  OUTPUT_FORMATS,
  formatTranscript,
  outputFileName,
  MIME_TYPES,
  type OutputFormat,
  type TranscriptSegment,
} from '../format/format'

type ItemStatus = 'decoding' | 'ready' | 'processing' | 'done' | 'error'

interface QueueItem {
  id: string
  name: string
  sizeBytes: number
  status: ItemStatus
  durationSec: number | null
  percent: number
  window: number
  totalWindows: number
  segments: TranscriptSegment[]
  errorCode: KoeErrorCode | null
  detail: string | null
  startedAt: number | null
}

interface DownloadState {
  active: boolean
  file: string
  percent: number
}

const idleDownload: DownloadState = { active: false, file: '', percent: 0 }

function errorText(code: KoeErrorCode | null, t: (key: string) => string): string {
  if (!code) return t('errors.unknown')
  const text = t(`errors.${code}`)
  return text === `errors.${code}` ? t('errors.unknown') : text
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function TranscribePage() {
  const { t } = useI18n()
  const supported = typeof WebAssembly === 'object'
  const crossOriginIsolated = typeof globalThis.crossOriginIsolated !== 'undefined' && globalThis.crossOriginIsolated
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory

  const [items, setItems] = useState<QueueItem[]>([])
  const [language, setLanguage] = useState('indonesian')
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL)
  const [task, setTask] = useState<Task>('transcribe')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('txt')
  const [modelReady, setModelReady] = useState<Partial<Record<ModelId, boolean>>>({})
  const [download, setDownload] = useState<DownloadState>(idleDownload)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const workerRef = useRef<Worker | null>(null)
  const pcmStoreRef = useRef(new Map<string, Float32Array>())
  const filePercentsRef = useRef(new Map<string, number>())
  const activeIdRef = useRef<string | null>(null)
  const pendingAfterReadyRef = useRef<string | null>(null)
  const chainRef = useRef(false)
  const itemsRef = useRef(items)
  const modelRef = useRef(model)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => {
    modelRef.current = model
  }, [model])

  const createWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL('../worker/transcribe.worker.ts', import.meta.url), {
      type: 'module',
      name: 'koe-transcribe',
    })
    worker.addEventListener('message', (event: MessageEvent<FromWorker>) => {
      const message = event.data
      switch (message.type) {
        case 'model-progress': {
          filePercentsRef.current.set(message.file, message.progress)
          const values = [...filePercentsRef.current.values()]
          const percent = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
          setDownload({ active: true, file: message.file, percent })
          break
        }
        case 'ready': {
          setModelReady((current) => ({ ...current, [modelRef.current]: true }))
          setDownload(idleDownload)
          filePercentsRef.current.clear()
          const pending = pendingAfterReadyRef.current
          pendingAfterReadyRef.current = null
          if (pending) {
            const item = itemsRef.current.find((entry) => entry.id === pending)
            if (item) launchRef.current(item)
          }
          break
        }
        case 'segment': {
          const id = activeIdRef.current
          if (!id) break
          setItems((current) =>
            current.map((item) =>
              item.id === id ? { ...item, segments: [...item.segments, message.segment] } : item,
            ),
          )
          break
        }
        case 'progress': {
          const id = activeIdRef.current
          if (!id) break
          setItems((current) =>
            current.map((item) =>
              item.id === id
                ? { ...item, percent: message.percent, window: message.window, totalWindows: message.totalWindows }
                : item,
            ),
          )
          break
        }
        case 'done': {
          const id = activeIdRef.current
          if (!id) break
          setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, status: 'done', percent: 100 } : item)),
          )
          activeIdRef.current = null
          startNextRef.current()
          break
        }
        case 'error': {
          const rawDetail = typeof message.message === 'string' ? message.message : ''
          const id = activeIdRef.current
          const koeCode = (['decodeFailed', 'unsupported', 'modelDownload', 'checksum', 'storage', 'outOfMemory', 'aborted', 'unsupportedBrowser', 'noFile', 'modelNotReady'] as KoeErrorCode[]).includes(
            message.code as KoeErrorCode,
          )
            ? (message.code as KoeErrorCode)
            : 'unknown'
          if (id) {
            setItems((current) =>
              current.map((item) =>
                item.id === id ? { ...item, status: 'error', errorCode: koeCode, detail: rawDetail } : item,
              ),
            )
            activeIdRef.current = null
            chainRef.current = false
          } else {
            setDownload(idleDownload)
            setModelReady((current) => ({ ...current, [modelRef.current]: false }))
            const pending = pendingAfterReadyRef.current
            pendingAfterReadyRef.current = null
            if (pending) {
              setItems((current) =>
                current.map((item) =>
                  item.id === pending ? { ...item, status: 'error', errorCode: koeCode, detail: rawDetail } : item,
                ),
              )
            }
          }
          break
        }
      }
    })
    worker.addEventListener('error', (event) => {
      console.error('[koe] worker failed to load or crashed:', event.message)
      setDownload(idleDownload)
      setModelReady((current) => ({ ...current, [modelRef.current]: false }))
    })
    worker.addEventListener('messageerror', () => {
      console.error('[koe] worker posted an unreadable message')
    })
    workerRef.current = worker
    return worker
  }, [])

  const launch = useCallback((item: QueueItem) => {
    const pcm = pcmStoreRef.current.get(item.id)
    if (!pcm) return
    const worker = createWorker()
    activeIdRef.current = item.id
    chainRef.current = true
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, status: 'processing', percent: 0, window: 0, totalWindows: 0, segments: [], errorCode: null, startedAt: Date.now() }
          : entry,
      ),
    )
    // Copy so a cancel never destroys the only copy of the PCM buffer.
    const copy = pcm.slice()
    const message: ToWorker = {
      type: 'transcribe',
      pcm: copy,
      modelId: modelRef.current,
      language: language === 'auto' ? null : language,
      task,
    }
    worker.postMessage(message, [copy.buffer])
  }, [createWorker, language, task])

  const launchRef = useRef(launch)
  useEffect(() => {
    // oxlint-disable-next-line react/immutability -- latest-callback ref pattern
    launchRef.current = launch
  }, [launch])

  const startNext = useCallback(() => {
    if (!chainRef.current) return
    const next = itemsRef.current.find((item) => item.status === 'ready')
    if (next) launchRef.current(next)
    else chainRef.current = false
  }, [])
  const startNextRef = useRef(startNext)
  useEffect(() => {
    // oxlint-disable-next-line react/immutability -- latest-callback ref pattern
    startNextRef.current = startNext
  }, [startNext])

  const initModel = useCallback(
    (modelId: ModelId, pcmItemId?: string) => {
      const worker = createWorker()
      pendingAfterReadyRef.current = pcmItemId ?? null
      filePercentsRef.current.clear()
      setDownload({ active: true, file: '', percent: 0 })
      worker.postMessage({ type: 'init', modelId } satisfies ToWorker)
    },
    [createWorker],
  )

  const startItem = useCallback(
    (item: QueueItem) => {
      // Only one transcription may be in flight: segments and progress are
      // routed to a single active item. The rest are auto-started via the
      // queue chain.
      if ((item.status !== 'ready' && item.status !== 'error') || activeIdRef.current !== null) return
      if (item.status === 'error') {
        // Retry: clear partial output so the UI shows a fresh run.
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, segments: [], percent: 0, window: 0, totalWindows: 0, errorCode: null, detail: null, status: 'ready' }
              : entry,
          ),
        )
      }
      if (modelReady[model]) {
        launch(item)
        return
      }
      // Download the model first; transcription starts automatically once ready.
      initModel(model, item.id)
    },
    [initModel, launch, model, modelReady],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      const created = files.map<QueueItem>((file) => ({
        id: newId(),
        name: file.name,
        sizeBytes: file.size,
        status: 'decoding',
        durationSec: null,
        detail: null,
        percent: 0,
        window: 0,
        totalWindows: 0,
        segments: [],
        errorCode: null,
        startedAt: null,
      }))
      setItems((current) => [...current, ...created])
      for (const [index, file] of files.entries()) {
        const id = created[index].id
        decodeToPcm16kMono(file)
          .then(({ pcm, durationSec }) => {
            pcmStoreRef.current.set(id, pcm)
            setItems((current) =>
              current.map((item) =>
                item.id === id ? { ...item, status: 'ready', durationSec } : item,
              ),
            )
          })
          .catch((error: unknown) => {
            const koe = toKoeError(error)
            setItems((current) =>
              current.map((item) =>
                item.id === id ? { ...item, status: 'error', errorCode: koe.code } : item,
              ),
            )
          })
      }
    },
    [],
  )

  const cancelItem = useCallback((item: QueueItem) => {
    // Hard stop: terminate the worker. The model stays cached in Cache Storage,
    // so the next run reloads from local cache, not the network.
    workerRef.current?.terminate()
    workerRef.current = null
    chainRef.current = false
    activeIdRef.current = null
    pendingAfterReadyRef.current = null
    setDownload(idleDownload)
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, status: 'ready', segments: [], startedAt: null, percent: 0 } : entry,
      ),
    )
  }, [])

  const removeItem = useCallback((item: QueueItem) => {
    pcmStoreRef.current.delete(item.id)
    setItems((current) => current.filter((entry) => entry.id !== item.id))
  }, [])

  const clearDone = useCallback(() => {
    setItems((current) => {
      for (const entry of current) {
        if (entry.status === 'done') pcmStoreRef.current.delete(entry.id)
      }
      return current.filter((entry) => entry.status !== 'done')
    })
  }, [])

  // Elapsed time ticker, only while something is running or downloading.
  const busy = items.some((item) => item.status === 'processing' || item.status === 'decoding') || download.active
  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [busy])

  const doneItems = useMemo(() => items.filter((item) => item.status === 'done'), [items])
  const anyProcessing = items.some((item) => item.status === 'processing')

  const copyTranscript = useCallback(
    async (item: QueueItem) => {
      const text = formatTranscript(item.segments, outputFormat)
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // Clipboard API can be blocked; fall back to a temporary textarea.
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
        } finally {
          document.body.removeChild(textarea)
        }
      }
      setCopiedId(item.id)
      window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 2000)
    },
    [outputFormat],
  )

  const downloadTranscript = useCallback((item: QueueItem) => {
    const text = formatTranscript(item.segments, outputFormat)
    const blob = new Blob([text], { type: MIME_TYPES[outputFormat] })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = outputFileName(item.name, outputFormat)
    anchor.click()
    URL.revokeObjectURL(url)
  }, [outputFormat])

  const downloadZip = useCallback(async () => {
    const zip = new JSZip()
    for (const item of doneItems) {
      zip.file(outputFileName(item.name, outputFormat), formatTranscript(item.segments, outputFormat))
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `koe-transcripts.zip`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [doneItems, outputFormat])

  // Terminate the worker on unmount.
  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
    },
    [],
  )

  if (!supported) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-ai dark:text-warm">{t('errors.unsupportedBrowser')}</h1>
      </main>
    )
  }

  const modelInfo = getModel(model)
  const lowMemory = typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory < 4

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20">
      {/* Hero */}
      <section className="py-8 text-center sm:py-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-coral/40 bg-coral/10 px-4 py-1.5 text-xs font-bold text-coral">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-coral" />
          </span>
          {t('hero.badge')}
        </p>
        <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-ai dark:text-warm sm:text-5xl">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base font-semibold text-neutral-600 dark:text-neutral-300">
          {t('hero.subtitle')}
        </p>
        {!crossOriginIsolated && (
          <p className="mx-auto mt-3 max-w-xl text-xs text-amber-600 dark:text-amber-400">
            Single-thread mode: cross-origin isolation headers are missing, transcription will be slower.
          </p>
        )}
      </section>

      {/* Step 1: file picker */}
      <section aria-labelledby="step1-title" className="mt-2">
        <h2 id="step1-title" className="mb-2 text-xs font-black uppercase tracking-widest text-ai/70 dark:text-warm/70">
          1 · {t('step1.title')}
        </h2>
        <Dropzone onFiles={addFiles} />
      </section>

      {/* Queue */}
      {items.length > 0 && (
        <section aria-labelledby="queue-title" className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="queue-title" className="text-xs font-black uppercase tracking-widest text-ai/70 dark:text-warm/70">
              {t('queue.title')} · {items.length}
            </h2>
            {doneItems.length > 0 && (
              <button
                type="button"
                onClick={clearDone}
                className="rounded-lg px-2 py-1 text-xs font-bold text-ai underline underline-offset-2 hover:text-coral dark:text-warm/90"
              >
                {t('queue.clearDone')}
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-ai/15 bg-white/70 p-4 dark:border-warm/10 dark:bg-ai/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-800 dark:text-warm">{item.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {formatBytes(item.sizeBytes)}
                      {item.durationSec !== null && ` · ${formatDuration(item.durationSec)}`}
                      {item.status === 'processing' && ` · ${t('step3.elapsed')} ${formatDuration((now - (item.startedAt ?? now)) / 1000)}`}
                      {item.status === 'processing' && item.totalWindows > 0 && ` · ${t('step3.windowProgress', { current: item.window, total: item.totalWindows })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'decoding' && (
                      <span className="text-xs font-bold text-neutral-500">{t('common.loading')}…</span>
                    )}
                    {item.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => startItem(item)}
                        disabled={anyProcessing}
                        className="rounded-xl bg-ai px-4 py-2 text-xs font-extrabold text-warm hover:bg-ai-light disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-coral/50"
                      >
                        {t('step3.start')}
                      </button>
                    )}
                    {item.status === 'processing' && (
                      <button
                        type="button"
                        onClick={() => cancelItem(item)}
                        className="rounded-xl border border-coral/50 px-4 py-2 text-xs font-extrabold text-coral hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-coral/50"
                      >
                        {t('step3.cancel')}
                      </button>
                    )}
                    {item.status === 'error' && (
                      <>
                        <span className="max-w-xs text-xs font-semibold text-red-500" title={item.detail ?? undefined}>
                          {errorText(item.errorCode, t)}
                        </span>
                        <button
                          type="button"
                          onClick={() => startItem(item)}
                          className="rounded-xl border border-ai/40 bg-ai/10 px-4 py-2 text-xs font-extrabold text-ai hover:bg-ai/20 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20 dark:bg-warm/10 dark:text-warm"
                        >
                          {t('queue.retry')}
                        </button>
                      </>
                    )}
                    {item.status === 'done' && (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        {t('queue.statusDone')}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(item)}
                      aria-label={t('step1.remove')}
                      className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-coral/50 dark:hover:bg-white/5 dark:hover:text-warm"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 4h10M6 4V2.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V4m2 0-.7 9.1a1 1 0 0 1-1 .9H5.7a1 1 0 0 1-1-.9L4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                {item.status === 'processing' && (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ai/10 dark:bg-warm/10" role="progressbar" aria-valuenow={item.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('step3.processing')}>
                    <div className="h-full rounded-full bg-coral transition-[width] duration-300" style={{ width: `${item.percent}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Step 2: settings */}
      <section aria-labelledby="step2-title" className="mt-8">
        <h2 id="step2-title" className="mb-2 text-xs font-black uppercase tracking-widest text-ai/70 dark:text-warm/70">
          2 · {t('step2.title')}
        </h2>
        <div className="grid gap-4 rounded-2xl border border-ai/15 bg-white/60 p-5 dark:border-warm/10 dark:bg-ai/20 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('step2.language')}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="mt-1 w-full rounded-xl border border-ai/20 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
            >
              {LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code === 'auto' ? t('step2.autoDetect') : option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('step2.model')}</span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value as ModelId)}
              className="mt-1 w-full rounded-xl border border-ai/20 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
            >
              <option value="tiny">{t('step2.modelTiny')}</option>
              <option value="base">{t('step2.modelBase')}</option>
              <option value="small">{t('step2.modelSmall')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('step2.task')}</span>
            <select
              value={task}
              onChange={(event) => setTask(event.target.value as Task)}
              className="mt-1 w-full rounded-xl border border-ai/20 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
            >
              <option value="transcribe">{t('step2.transcribe')}</option>
              <option value="translate">{t('step2.translate')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('step2.outputFormat')}</span>
            <select
              value={outputFormat}
              onChange={(event) => setOutputFormat(event.target.value as OutputFormat)}
              className="mt-1 w-full rounded-xl border border-ai/20 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
            >
              {OUTPUT_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          {/* Model download / bundled notice */}
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ai/10 bg-ai/5 p-4 dark:border-warm/10 dark:bg-warm/5">
              <div>
                <p className="text-sm font-extrabold text-ai dark:text-warm">
                  {modelInfo.bundled ? t('step2.included') : `${t('step2.downloadSize')}: ${formatBytes(modelInfo.approxBytes)}`}
                </p>
                <p className="mt-0.5 max-w-md text-xs text-neutral-500 dark:text-neutral-400">
                  {modelInfo.bundled ? t('step2.includedNote') : t('step2.dataWarning', { size: formatBytes(modelInfo.approxBytes) })}
                </p>
                {lowMemory && (
                  <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">{t('step2.memoryWarning')}</p>
                )}
              </div>
              {modelReady[model] ? (
                <span className="rounded-xl bg-emerald-500/15 px-4 py-2.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {t('step2.ready')}
                </span>
              ) : modelInfo.bundled ? (
                <button
                  type="button"
                  onClick={() => initModel(model)}
                  className="rounded-xl bg-coral px-4 py-2.5 text-xs font-extrabold text-[#1A1207] transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ai/50"
                >
                  {t('step2.loadModel')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => initModel(model)}
                  disabled={download.active}
                  className="rounded-xl bg-coral px-4 py-2.5 text-xs font-extrabold text-[#1A1207] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ai/50"
                >
                  {download.active ? t('step2.downloading') : t('step2.download')}
                </button>
              )}
            </div>
            {download.active && (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  <span className="truncate">{download.file || t('step2.downloading')}</span>
                  <span>{download.percent}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ai/10 dark:bg-warm/10" role="progressbar" aria-valuenow={download.percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-coral transition-[width] duration-300" style={{ width: `${download.percent}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Step 3: results */}
      {doneItems.length > 0 && (
        <section aria-labelledby="step3-title" className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="step3-title" className="text-xs font-black uppercase tracking-widest text-ai/70 dark:text-warm/70">
              3 · {t('step3.title')}
            </h2>
            {doneItems.length > 1 && (
              <button
                type="button"
                onClick={() => void downloadZip()}
                className="rounded-xl border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20 dark:text-warm"
              >
                {t('step3.downloadZip')}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {doneItems.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-ai/15 dark:border-warm/10">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ai/10 bg-ai/5 px-4 py-2.5 dark:border-warm/10 dark:bg-warm/5">
                  <p className="max-w-md truncate text-sm font-bold text-ai dark:text-warm">{item.name}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyTranscript(item)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-ai hover:bg-ai/10 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm"
                    >
                      {copiedId === item.id ? t('step3.copied') : t('step3.copy')}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTranscript(item)}
                      className="rounded-lg bg-ai px-3 py-1.5 text-xs font-extrabold text-warm hover:bg-ai-light focus-visible:ring-2 focus-visible:ring-coral/50"
                    >
                      {t('step3.download')} {outputFormat.toUpperCase()}
                    </button>
                  </div>
                </header>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap bg-white px-4 py-3 font-sans text-sm leading-relaxed text-neutral-800 dark:bg-[#191D29] dark:text-warm/90">
                  {item.segments.length === 0 ? t('step3.empty') : formatTranscript(item.segments, outputFormat)}
                </pre>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Model manager */}
      <div className="mt-8">
        <ModelManager />
      </div>
    </main>
  )
}
