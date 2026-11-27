import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Dropzone } from '../components/Dropzone'
import { TranscriptView } from '../components/TranscriptView'
import { ModelManager } from '../components/ModelManager'
import { GuideSection } from '../components/GuideSection'
import { useI18n } from '../i18n/useI18n'
import { decodeToPcm16kMono, formatDuration } from '../audio/decode'
import { DEFAULT_MODEL, LANGUAGES, formatBytes, getModel, type ModelId } from '../lib/models'
import { toKoeError, type KoeErrorCode } from '../lib/errors'
import type { FromWorker, Task, ToWorker, KaraokeWord } from '../lib/messages'
import {
  OUTPUT_FORMATS,
  formatTranscript,
  outputFileName,
  toStandaloneHtml,
  MIME_TYPES,
  type OutputFormat,
  type TranscriptSegment,
} from '../format/format'
import { encodeWav, bytesToBase64 } from '../audio/wav'
import { initHistory, commit, undo, redo, canUndo, canRedo, type History } from '../lib/history'
import {
  buildChapters,
  cleanupTranscript,
  detectRepeats,
  findReplaceSegments,
  toCaptionLines,
  toCleanParagraphs,
  toMarkdown,
} from '../lib/textTools'
import { decodeShare, shareUrl, type SharePayload } from '../lib/share'
import { detectDevice, isSaveData, type DeviceProfile } from '../lib/device'
import { getAudio, putAudio, saveProject, type Project } from '../lib/projects'
import type { RestoreRequest } from '../App'
import {
  TRANSLATION_TARGETS,
  floresFor,
  getTranslationTarget,
} from '../lib/translate'
import type { FromTranslateWorker, ToTranslateWorker, TranslationTargetInfo } from '../lib/messages'
import {
  toBilingualCsv,
  toBilingualMarkdown,
  toBilingualSrt,
  toBilingualVtt,
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
  /** Present only when word-level timestamps were requested */
  words?: KaraokeWord[]
  errorCode: KoeErrorCode | null
  detail: string | null
  startedAt: number | null
  notes: string
  keepAudio: boolean
  createdAt: number
  translations?: string[]
  translationLang?: string
  glossary: string
  detectedLanguage?: string
}

interface DownloadState {
  active: boolean
  file: string
  percent: number
  etaSec: number
}

const idleDownload: DownloadState = { active: false, file: '', percent: 0, etaSec: 0 }

const SETTINGS_KEY = 'koe-settings-v1'

interface SavedSettings {
  language?: string
  model?: ModelId
  task?: Task
  displayMode?: 'lines' | 'karaoke'
  outputFormat?: OutputFormat
  keepAudio?: boolean
  translateTarget?: string
}

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? (JSON.parse(raw) as SavedSettings) : {}
  } catch {
    return {}
  }
}

function persistSettings(patch: SavedSettings) {
  try {
    const next = { ...loadSettings(), ...patch }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // Best effort only.
  }
}

function errorText(code: KoeErrorCode | null, t: (key: string) => string): string {
  if (!code) return t('errors.unknown')
  const text = t(`errors.${code}`)
  return text === `errors.${code}` ? t('errors.unknown') : text
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function TranscribePage({ restore, onSaved }: { restore?: RestoreRequest | null; onSaved?: () => void }) {
  const { t, locale } = useI18n()
  const supported = typeof WebAssembly === 'object'
  const crossOriginIsolated = typeof globalThis.crossOriginIsolated !== 'undefined' && globalThis.crossOriginIsolated
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory

  const initial = useMemo(() => loadSettings(), [])
  const [items, setItems] = useState<QueueItem[]>([])
  const [language, setLanguage] = useState(initial.language ?? 'indonesian')
  const [model, setModel] = useState<ModelId>(initial.model ?? DEFAULT_MODEL)
  const [task, setTask] = useState<Task>(initial.task ?? 'transcribe')
  const [translateTarget, setTranslateTarget] = useState<string>(initial.translateTarget ?? 'en')
  const [displayMode, setDisplayMode] = useState<'lines' | 'karaoke'>(initial.displayMode ?? 'lines')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(initial.outputFormat ?? 'txt')
  const [keepAudio, setKeepAudio] = useState(initial.keepAudio ?? false)
  const [modelReady, setModelReady] = useState<Partial<Record<ModelId, boolean>>>({})
  const [download, setDownload] = useState<DownloadState>(idleDownload)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [history, setHistory] = useState<Record<string, History<TranscriptSegment[]>>>({})
  const [device, setDevice] = useState<DeviceProfile | null>(null)
  const [shared, setShared] = useState<SharePayload | null>(null)
  const [shareLink, setShareLink] = useState('')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [preset, setPreset] = useState<'plain' | 'markdown' | 'captions' | 'clean'>('plain')
  const [find, setFind] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [chapterGap, setChapterGap] = useState(4)
  const [clipRange, setClipRange] = useState<{ startMs: number; endMs: number } | null>(null)
  const [trimIndex, setTrimIndex] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [translateProgress, setTranslateProgress] = useState<{ active: boolean; percent: number; label: string }>({ active: false, percent: 0, label: '' })
  const [viewLang, setViewLang] = useState<'original' | 'translated'>('original')
  const [showBoth, setShowBoth] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState('')

  const workerRef = useRef<Worker | null>(null)
  const translateWorkerRef = useRef<Worker | null>(null)
  const translateActiveRef = useRef<string | null>(null)
  const pcmStoreRef = useRef(new Map<string, Float32Array>())
  const fileStoreRef = useRef(new Map<string, File>())
  const [pcmIds, setPcmIds] = useState<Set<string>>(new Set())
  const filePercentsRef = useRef(new Map<string, number>())
  const downloadStartedRef = useRef(new Map<string, number>())
  const activeIdRef = useRef<string | null>(null)
  const pendingAfterReadyRef = useRef<string | null>(null)
  const pendingInitModelRef = useRef<ModelId | null>(null)
  const chainRef = useRef(false)
  const itemsRef = useRef(items)
  const playheadRef = useRef(0)
  const modelRef = useRef(model)
  const translateTargetRef = useRef(translateTarget)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => {
    modelRef.current = model
  }, [model])
  useEffect(() => {
    translateTargetRef.current = translateTarget
  }, [translateTarget])

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
          const key = message.file || 'init'
          const started = downloadStartedRef.current.get(key) ?? Date.now()
          downloadStartedRef.current.set(key, started)
          const elapsed = Date.now() - started
          const etaSec = message.progress > 3 ? Math.max(0, Math.round(((elapsed / message.progress) * (100 - message.progress)) / 1000)) : 0
          setDownload({ active: true, file: message.file, percent, etaSec })
          break
        }
        case 'ready': {
          const inited = pendingInitModelRef.current ?? modelRef.current
          pendingInitModelRef.current = null
          setModelReady((current) => ({ ...current, [inited]: true }))
          setDownload(idleDownload)
          filePercentsRef.current.clear()
          downloadStartedRef.current.clear()
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
        case 'detected-language': {
          setDetectedLanguage(message.language)
          const id = activeIdRef.current
          if (id) setItems((current) => current.map((item) => (item.id === id ? { ...item, detectedLanguage: message.language } : item)))
          break
        }
        case 'words': {
          const id = activeIdRef.current
          if (!id) break
          setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, words: message.words } : item)),
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
          const finished = itemsRef.current.find((item) => item.id === id)
          if (finished && translateTargetRef.current !== 'en') {
            window.setTimeout(() => startTranslationRef.current(finished), 0)
          }
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
            if (koeCode === 'aborted') {
              // User cancel: mark the item as ready again, no error state.
              setItems((current) =>
                current.map((item) =>
                  item.id === id ? { ...item, status: 'ready', segments: [], startedAt: null, percent: 0 } : item,
                ),
              )
              activeIdRef.current = null
              chainRef.current = false
              return
            }
            setItems((current) =>
              current.map((item) =>
                item.id === id ? { ...item, status: 'error', errorCode: koeCode, detail: rawDetail } : item,
              ),
            )
            activeIdRef.current = null
            chainRef.current = false
          } else {
            setDownload(idleDownload)
            const pendingInitModel = pendingInitModelRef.current
            if (pendingInitModel) {
              // A initModel load failed; only that model is affected.
              pendingInitModelRef.current = null
              setModelReady((current) => ({ ...current, [pendingInitModel]: false }))
            }
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
          ? { ...entry, status: 'processing', percent: 0, window: 0, totalWindows: 0, segments: [], words: undefined, errorCode: null, startedAt: Date.now() }
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
      task: translateTargetRef.current !== 'en' ? 'translate' : task,
      granularity: displayMode === 'karaoke' ? 'word' : 'segment',
    }
    worker.postMessage(message, [copy.buffer])
  }, [createWorker, language, task, displayMode])

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

  const createTranslateWorker = useCallback((): Worker => {
    if (translateWorkerRef.current) return translateWorkerRef.current
    const worker = new Worker(new URL('../worker/translate.worker.ts', import.meta.url), {
      type: 'module',
      name: 'koe-translate',
    })
    worker.addEventListener('message', (event: MessageEvent<FromTranslateWorker>) => {
      const message = event.data
      if (message.type === 'progress') {
        setTranslateProgress((current) => ({ ...current, percent: message.percent }))
        return
      }
      if (message.type === 'translated') {
        const id = translateActiveRef.current
        if (id) {
          setItems((current) => current.map((item) => (
            item.id === id ? { ...item, translations: message.texts, translationLang: translateTargetRef.current } : item
          )))
        }
        translateActiveRef.current = null
        setTranslateProgress({ active: false, percent: 100, label: '' })
        return
      }
      if (message.type === 'error') {
        translateActiveRef.current = null
        setTranslateProgress({ active: false, percent: 0, label: message.message })
      }
    })
    translateWorkerRef.current = worker
    return worker
  }, [])

  const startTranslation = useCallback((item: QueueItem) => {
    const target = getTranslationTarget(translateTargetRef.current)
    if (!target) return
    const texts = item.segments.map((segment) => segment.text)
    if (texts.length === 0) return
    translateActiveRef.current = item.id
    setTranslateProgress({ active: true, percent: 0, label: target.label })
    const worker = createTranslateWorker()
    const sourceLang = item.detectedLanguage ?? 'english'
    const message: ToTranslateWorker = {
      type: 'translate',
      texts,
      modelId: target.hfId,
      sourceLang,
      targetLang: translateTargetRef.current,
      glossary: item.glossary.split('\n').map((line) => line.trim()).filter(Boolean),
      flores: target.flores,
      sourceFlores: target.flores ? floresFor(sourceLang) : undefined,
    }
    worker.postMessage(message)
  }, [createTranslateWorker])

  const startTranslationRef = useRef(startTranslation)
  useEffect(() => {
    // oxlint-disable-next-line react/immutability -- latest-callback ref pattern
    startTranslationRef.current = startTranslation
  }, [startTranslation])

  const initModel = useCallback(
    (modelId: ModelId, pcmItemId?: string) => {
      const worker = createWorker()
      pendingAfterReadyRef.current = pcmItemId ?? null
      pendingInitModelRef.current = modelId
      filePercentsRef.current.clear()
          downloadStartedRef.current.clear()
      setDownload({ active: true, file: '', percent: 0, etaSec: 0 })
      worker.postMessage({ type: 'init', modelId } satisfies ToWorker)
    },
    [createWorker],
  )

  const decodeItem = useCallback((id: string, file: File) => {
    decodeToPcm16kMono(file)
      .then(({ pcm, durationSec }) => {
        pcmStoreRef.current.set(id, pcm)
        setPcmIds((current) => new Set(current).add(id))
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, status: 'ready', durationSec } : item)),
        )
      })
      .catch((error: unknown) => {
        const koe = toKoeError(error)
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: 'error', errorCode: koe.code, detail: null } : item,
          ),
        )
      })
  }, [])

  const startItem = useCallback(
    (item: QueueItem) => {
      // Only one transcription may be in flight: segments and progress are
      // routed to a single active item. The rest are auto-started via the
      // queue chain.
      // Re-running a done item with the current settings reuses the in-memory
      // PCM, so the file is not decoded again. Segments reset first.
      if (item.status === 'done') {
        item = { ...item, status: 'ready', segments: [], percent: 0, window: 0, totalWindows: 0, errorCode: null, detail: null, startedAt: null }
      }
      if ((item.status !== 'ready' && item.status !== 'error') || activeIdRef.current !== null) return
      if (item.status === 'error') {
        // Some failures happen before any PCM exists (unreadable file, unsupported
        // codec): retry by decoding the original file again from scratch.
        if (item.errorCode === 'decodeFailed' && fileStoreRef.current.has(item.id)) {
          const file = fileStoreRef.current.get(item.id)
          if (file) {
            setItems((current) =>
              current.map((entry) =>
                entry.id === item.id
                  ? { ...entry, segments: [], percent: 0, window: 0, totalWindows: 0, errorCode: null, detail: null, status: 'decoding' }
                  : entry,
              ),
            )
            decodeItem(item.id, file)
            return
          }
        }
        // Work was partially done: clear it so the UI shows a fresh run.
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
    [decodeItem, initModel, launch, model, modelReady],
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
        notes: '',
        keepAudio,
        createdAt: Date.now(),
        glossary: '',
      }))
      setItems((current) => [...current, ...created])
      for (const [index, file] of files.entries()) {
        const id = created[index].id
        fileStoreRef.current.set(id, file)
        decodeItem(id, file)
      }
    },
    [decodeItem, keepAudio],
  )

  // Paste files directly from the clipboard (for example right after copying
  // a recording or a screenshot of a meeting) into the queue.
  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length === 0) return
      event.preventDefault()
      addFiles(files)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [addFiles])

  // Keyboard shortcuts: Space toggles the first available player, slash
  // focuses the transcript search box. Ignored while typing in a field.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }
      if (event.code === 'Space') {
        const button = document.querySelector('[data-testid="listen-toggle"]')
        if (button instanceof HTMLButtonElement) {
          event.preventDefault()
          button.click()
        }
        return
      }
      if (event.key === '/') {
        const input = document.querySelector('[data-testid="transcript-search"]')
        if (input instanceof HTMLElement) {
          event.preventDefault()
          input.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Settings follow the user between sessions.
  useEffect(() => {
    persistSettings({ language, model, task, displayMode, outputFormat, keepAudio, translateTarget })
  }, [language, model, task, displayMode, outputFormat, keepAudio, translateTarget])

  useEffect(() => {
    void detectDevice().then(setDevice)
  }, [])

  // A shared link opens a read-only view without uploading anything.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#share=')) return
    void decodeShare<SharePayload>(hash.slice(7)).then(setShared)
  }, [])

  // Open a saved project from Home or Projects.
  useEffect(() => {
    if (!restore) return
    const project = restore.project
    const item: QueueItem = {
      id: project.id,
      name: project.name,
      sizeBytes: project.sizeBytes,
      status: project.segments.length > 0 ? 'done' : 'ready',
      durationSec: project.durationSec,
      percent: project.segments.length > 0 ? 100 : 0,
      window: 0,
      totalWindows: 0,
      segments: project.segments,
      words: project.words,
      errorCode: null,
      detail: null,
      startedAt: null,
      notes: project.notes,
      keepAudio: project.keepAudio,
      createdAt: project.createdAt,
      translations: project.translations,
      translationLang: project.translationLang,
      glossary: project.glossary ?? '',
      detectedLanguage: project.detectedLanguage,
    }
    // Restore the saved project into the working queue.
    // oxlint-disable-next-line react/set-state-in-effect
    setItems([item])
    setLanguage(project.language)
    setModel(project.model as ModelId)
    setTask(project.task)
    setOutputFormat(project.format as OutputFormat)
    setDisplayMode(project.displayMode)
    setHistory({ [item.id]: initHistory(project.segments) })
    void getAudio(project.id).then((blob) => {
      if (!blob) return
      void decodeToPcm16kMono(new File([blob], project.name, { type: 'audio/wav' }))
        .then(({ pcm }) => {
          pcmStoreRef.current.set(item.id, pcm)
          setPcmIds((current) => new Set(current).add(item.id))
        })
        .catch(() => undefined)
    })
  }, [restore])

  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  // Debounced autosave of every finished item. Audio is only stored when the
  // project opts in, because a long recording can be large.
  useEffect(() => {
    const done = items.filter((item) => item.status === 'done')
    if (done.length === 0) return
    // Reflect that a save has started.
    // oxlint-disable-next-line react/set-state-in-effect
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      void Promise.all(done.map(async (item) => {
        const project: Project = {
          id: item.id,
          name: item.name,
          createdAt: item.createdAt,
          updatedAt: Date.now(),
          language,
          model,
          task,
          format: outputFormat,
          displayMode,
          segments: item.segments,
          words: item.words,
          notes: item.notes,
          favorite: false,
          durationSec: item.durationSec,
          sizeBytes: item.sizeBytes,
          keepAudio: item.keepAudio,
          translations: item.translations,
          translationLang: item.translationLang,
          glossary: item.glossary,
          detectedLanguage: item.detectedLanguage,
        }
        await saveProject(project)
        if (item.keepAudio) {
          const pcm = pcmStoreRef.current.get(item.id)
          if (pcm) {
            const wav = encodeWav(pcm, 16000)
            const bytes = new Uint8Array(wav.byteLength)
            bytes.set(wav)
            await putAudio(item.id, new Blob([bytes], { type: 'audio/wav' }))
          }
        }
      })).then(() => {
        setSaveState('saved')
        onSavedRef.current?.()
      })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [items, language, model, task, outputFormat, displayMode])

  // Global commands from the palette.
  useEffect(() => {
    const focusSearch = () => document.querySelector<HTMLElement>('[data-testid="transcript-search"]')?.focus()
    const copyFirst = () => document.querySelector<HTMLButtonElement>('[data-testid="copy-transcript"]')?.click()
    const downloadFirst = () => document.querySelector<HTMLButtonElement>('[data-testid="download-transcript"]')?.click()
    window.addEventListener('koe:focus-search', focusSearch)
    window.addEventListener('koe:copy-transcript', copyFirst)
    window.addEventListener('koe:download-transcript', downloadFirst)
    return () => {
      window.removeEventListener('koe:focus-search', focusSearch)
      window.removeEventListener('koe:copy-transcript', copyFirst)
      window.removeEventListener('koe:download-transcript', downloadFirst)
    }
  }, [])

  const cancelItem = useCallback((item: QueueItem) => {
    // Hard stop: terminate the worker. The model stays cached in Cache Storage,
    // so the next run reloads from local cache, not the network.
    workerRef.current?.terminate()
    workerRef.current = null
    translateWorkerRef.current?.terminate()
    translateWorkerRef.current = null
    chainRef.current = false
    activeIdRef.current = null
    translateActiveRef.current = null
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
    fileStoreRef.current.delete(item.id)
    setPcmIds((current) => { const next = new Set(current); next.delete(item.id); return next })
    setItems((current) => current.filter((entry) => entry.id !== item.id))
  }, [])

  const clearDone = useCallback(() => {
    setItems((current) => {
      for (const entry of current) {
        if (entry.status === 'done') {
          pcmStoreRef.current.delete(entry.id)
          fileStoreRef.current.delete(entry.id)
          setPcmIds((currentIds) => { const next = new Set(currentIds); next.delete(entry.id); return next })
        }
      }
      return current.filter((entry) => entry.status !== 'done')
    })
  }, [])

  // Auto-warm bundled models once a file is added so transcription can start
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

  const exportStandalone = useCallback(
    (item: QueueItem) => {
      const pcm = pcmStoreRef.current.get(item.id)
      if (!pcm) return
      const audioDataUri = `data:audio/wav;base64,${bytesToBase64(encodeWav(pcm, 16000))}`
      const html = toStandaloneHtml(item.segments, {
        title: item.name,
        audioDataUri,
        lang: locale === 'id' ? 'id' : 'en',
        words: item.words,
        chapters: buildChapters(item.segments, chapterGap * 1000),
      })
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = outputFileName(item.name, 'txt').replace(/\.txt$/, '.view.html')
      anchor.click()
      URL.revokeObjectURL(url)
    },
    [locale, chapterGap],
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

  const updateSegments = useCallback((id: string, next: TranscriptSegment[]) => {
    setHistory((current) => {
      const base = current[id] ?? initHistory(itemsRef.current.find((entry) => entry.id === id)?.segments ?? [])
      return { ...current, [id]: commit(base, next) }
    })
    setItems((current) => current.map((entry) => (entry.id === id ? { ...entry, segments: next } : entry)))
  }, [])

  const undoSegments = useCallback((id: string) => {
    const next = undo(history[id] ?? initHistory([]))
    setHistory((current) => ({ ...current, [id]: next }))
    setItems((entries) => entries.map((entry) => (entry.id === id ? { ...entry, segments: next.present } : entry)))
  }, [history])

  const redoSegments = useCallback((id: string) => {
    const next = redo(history[id] ?? initHistory([]))
    setHistory((current) => ({ ...current, [id]: next }))
    setItems((entries) => entries.map((entry) => (entry.id === id ? { ...entry, segments: next.present } : entry)))
  }, [history])

  const presetText = useCallback((item: QueueItem): string => {
    if (preset === 'markdown') return toMarkdown(item.segments, item.name, buildChapters(item.segments, chapterGap * 1000))
    if (preset === 'captions') return toCaptionLines(item.segments)
    if (preset === 'clean') return toCleanParagraphs(item.segments)
    return formatTranscript(item.segments, outputFormat)
  }, [preset, chapterGap, outputFormat])

  const downloadBilingual = useCallback((item: QueueItem, format: 'srt' | 'vtt' | 'csv' | 'md') => {
    if (!item.translations || item.translations.length === 0) return
    const content = format === 'srt'
      ? toBilingualSrt(item.segments, item.translations)
      : format === 'vtt'
        ? toBilingualVtt(item.segments, item.translations)
        : format === 'csv'
          ? toBilingualCsv(item.segments, item.translations)
          : toBilingualMarkdown(item.segments, item.translations, item.name)
    const mime = format === 'csv' ? 'text/csv;charset=utf-8' : format === 'md' ? 'text/markdown;charset=utf-8' : format === 'vtt' ? 'text/vtt;charset=utf-8' : 'application/x-subrip;charset=utf-8'
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.name.replace(/\.[^.]+$/, '')}.bilingual.${format}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const shareItem = useCallback(async (item: QueueItem) => {
    const payload: SharePayload = {
      title: item.name,
      language,
      segments: item.segments,
      createdAt: Date.now(),
    }
    const url = await shareUrl(payload)
    if (!url || url.length > 8000) {
      setShareLink(t('share.tooLarge'))
      return
    }
    setShareLink(url)
    try {
      await navigator.clipboard.writeText(url)
      setShareLink(t('share.copied'))
    } catch {
      // The link stays visible for manual copying.
    }
  }, [language, t])

  const exportClip = useCallback((item: QueueItem) => {
    const pcm = pcmStoreRef.current.get(item.id)
    if (!pcm || !clipRange || clipRange.endMs <= clipRange.startMs) return
    const start = Math.floor((clipRange.startMs / 1000) * 16000)
    const end = Math.min(pcm.length, Math.floor((clipRange.endMs / 1000) * 16000))
    const slice = pcm.slice(start, end)
    const wav = encodeWav(slice, 16000)
    const bytes = new Uint8Array(wav.byteLength)
    bytes.set(wav)
    const blob = new Blob([bytes], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.name.replace(/\.[^.]+$/, '')}-clip.wav`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [clipRange])

  const startPlaybackForClip = useCallback((startMs: number, endMs: number, pcm: Float32Array) => {
    try {
      const ctx = new AudioContext()
      const buffer = ctx.createBuffer(1, pcm.length, 16000)
      const samples = new Float32Array(pcm.length)
      samples.set(pcm)
      buffer.copyToChannel(samples, 0)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => { void ctx.close() }
      source.start(0, startMs / 1000, (endMs - startMs) / 1000)
    } catch {
      // Audio output can be blocked until a gesture; controls stay usable.
    }
  }, [])

  const downloadZip = useCallback(async () => {
    const zip = new JSZip()
    for (const item of doneItems) {
      const base = item.name.replace(/\.[^.]+$/, '')
      zip.file(outputFileName(item.name, outputFormat), formatTranscript(item.segments, outputFormat))
      zip.file(`${base}.md`, toMarkdown(item.segments, item.name, buildChapters(item.segments, chapterGap * 1000)))
      zip.file(`${base}.chapters.txt`, buildChapters(item.segments, chapterGap * 1000).map((chapter) => `${chapter.title}`).join('\n'))
      zip.file(`${base}.settings.json`, JSON.stringify({
        version: 2,
        name: item.name,
        language,
        model,
        task,
        outputFormat,
        displayMode,
        durationSec: item.durationSec,
        createdAt: item.createdAt,
        exportedAt: Date.now(),
      }, null, 2))
      // Also bundle a standalone viewer with the embedded audio when available.
      const pcm = pcmStoreRef.current.get(item.id)
      if (pcm) {
        const audioDataUri = `data:audio/wav;base64,${bytesToBase64(encodeWav(pcm, 16000))}`
        const html = toStandaloneHtml(item.segments, {
          title: item.name,
          audioDataUri,
          lang: locale === 'id' ? 'id' : 'en',
          words: item.words,
          chapters: buildChapters(item.segments, chapterGap * 1000),
        })
        zip.file(`${base}.view.html`, html)
      }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `koe-transcripts.zip`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [doneItems, outputFormat, locale, language, model, task, displayMode, chapterGap])

  // Terminate the worker on unmount.
  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
      translateWorkerRef.current?.terminate()
      translateWorkerRef.current = null
      pcmStoreRef.current.clear()
      fileStoreRef.current.clear()
      setPcmIds(new Set())
    },
    [],
  )

  // Auto-warm bundled models once a file is added so transcription can start
  // instantly; Small still requires an explicit download. Devices reporting
  // less than 4 GB RAM are excluded to avoid unnecessary memory pressure.
  const autoWarmRef = useRef(new Set<ModelId>())
  useEffect(() => {
    if (items.length === 0) return
    const info = getModel(model)
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    const lowMemory = typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory < 4
    if (!info.bundled || modelReady[model] || download.active || lowMemory || isSaveData()) return
    if (autoWarmRef.current.has(model)) return
    autoWarmRef.current.add(model)
    initModel(model)
  }, [items.length, model, modelReady, download.active, initModel])

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
      {shared && (
        <section className="mt-6 rounded-xl border border-coral/40 bg-coral/5 p-5" aria-labelledby="shared-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="shared-title" className="text-lg font-black text-ai dark:text-warm">{shared.title || t('share.sharedTitle')}</h2>
              <p className="mt-1 text-xs font-semibold text-neutral-500">{t('share.readOnly')}</p>
            </div>
            <button type="button" onClick={() => { setShared(null); window.history.replaceState(null, '', window.location.pathname + window.location.search) }} className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm">
              {t('projects.close')}
            </button>
          </div>
          <div className="mt-4 space-y-1">
            {shared.segments.map((segment, index) => (
              <p key={index} className="rounded-lg bg-white/70 px-3 py-2 text-sm text-neutral-800 dark:bg-ai/20 dark:text-warm/90">{segment.text}</p>
            ))}
          </div>
        </section>
      )}

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
        {device && (
          <p className="mx-auto mt-2 max-w-xl text-[11px] font-bold text-neutral-500 dark:text-neutral-400" data-testid="device-profile">
            {t('device.backend')}: {t('device.wasm')}{device.webgpuAvailable ? ` (${t('device.webgpu')})` : ''} · {t('device.threads')}: {device.threads} · {t('device.recommendation')}: {device.recommendation.toUpperCase()}
            {isSaveData() && ` · ${t('device.saveData')}`}
          </p>
        )}
        {saveState !== 'idle' && (
          <p className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400" role="status" aria-live="polite">
            {saveState === 'saved' ? t('workspace.saved') : t('workspace.saving')}
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
            {task === 'translate' && (
              <p className="mt-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                {translateTarget === 'en' ? t('translate.nativeNote') : t('translate.twoStageNote')}
              </p>
            )}
          </label>

          {task === 'translate' && (
            <label className="block">
              <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('translate.target')}</span>
              <select
                value={translateTarget}
                onChange={(event) => setTranslateTarget(event.target.value)}
                data-testid="translate-target"
                className="mt-1 w-full rounded-xl border border-ai/20 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
              >
                <option value="en">{t('translate.englishNative')}</option>
                {TRANSLATION_TARGETS.map((target: TranslationTargetInfo) => (
                  <option key={target.code} value={target.code}>
                    {target.label} ({Math.round(target.approxBytes / 1024 / 1024)} MB)
                  </option>
                ))}
              </select>
            </label>
          )}

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

          <label className="block">
            <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('step2.displayMode')}</span>
            <select
              value={displayMode}
              onChange={(event) => setDisplayMode(event.target.value as 'lines' | 'karaoke')}
              className="mt-1 w-full rounded-xl border border-ai/20 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
            >
              <option value="lines">{t('step2.displayLines')}</option>
              <option value="karaoke">{t('step2.displayKaraoke')}</option>
            </select>
          </label>

          <label className="flex items-center gap-2 self-end rounded-xl border border-ai/15 px-3 py-2.5 dark:border-warm/15">
            <input
              type="checkbox"
              checked={keepAudio}
              onChange={(event) => setKeepAudio(event.target.checked)}
              className="h-4 w-4 accent-coral"
              data-testid="keep-audio"
            />
            <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('projects.saveAudio')}</span>
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
                  <span>{download.percent}%{download.etaSec > 0 ? ` · ${download.etaSec}s` : ''}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ai/10 dark:bg-warm/10" role="progressbar" aria-valuenow={download.percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-coral transition-[width] duration-300" style={{ width: `${download.percent}%` }} />
                </div>
              </div>
            )}
              {detectedLanguage && (
                <p className="mt-2 text-xs font-bold text-ai dark:text-warm" data-testid="detected-language">
                  {t('translate.detected')}: {detectedLanguage}
                </p>
              )}
              {translateProgress.label && !translateProgress.active && (
                <p className="mt-2 text-xs font-bold text-red-500" role="alert">{translateProgress.label}</p>
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
            {translateProgress.active && (
              <span className="flex items-center gap-2 text-xs font-bold text-coral" role="status" aria-live="polite">
                {t('translate.working')} · {translateProgress.percent}%
                <span className="inline-block h-2 w-2 animate-ping rounded-full bg-coral" />
              </span>
            )}
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
                  <input
                    type="text"
                    value={item.name}
                    onChange={(event) => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, name: event.target.value } : entry)))}
                    aria-label={t('workspace.rename')}
                    className="max-w-md min-w-40 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-ai outline-none hover:border-ai/20 focus:border-coral/50 dark:text-warm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => undoSegments(item.id)}
                      disabled={!canUndo(history[item.id] ?? initHistory([]))}
                      aria-label={t('workspace.undo')}
                      title={t('workspace.undo')}
                      className="rounded-lg border border-ai/25 px-2.5 py-1.5 text-xs font-extrabold text-ai disabled:opacity-30 dark:border-warm/20 dark:text-warm"
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={() => redoSegments(item.id)}
                      disabled={!canRedo(history[item.id] ?? initHistory([]))}
                      aria-label={t('workspace.redo')}
                      title={t('workspace.redo')}
                      className="rounded-lg border border-ai/25 px-2.5 py-1.5 text-xs font-extrabold text-ai disabled:opacity-30 dark:border-warm/20 dark:text-warm"
                    >
                      Redo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFocusId((current) => (current === item.id ? null : item.id))}
                      aria-pressed={focusId === item.id}
                      className="rounded-lg border border-ai/25 px-2.5 py-1.5 text-xs font-extrabold text-ai hover:bg-ai/5 dark:border-warm/20 dark:text-warm"
                    >
                      {focusId === item.id ? t('editor.exitFocus') : t('editor.focusMode')}
                    </button>
                    <button
                      type="button"
                      onClick={() => startItem(item)}
                      disabled={anyProcessing}
                      className="rounded-lg border border-ai/25 px-3 py-1.5 text-xs font-extrabold text-ai hover:bg-ai/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-warm/20 dark:text-warm"
                    >
                      {t('step3.rerun')}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportStandalone(item)}
                      disabled={!pcmIds.has(item.id)}
                      className="rounded-lg border border-ai/25 px-3 py-1.5 text-xs font-extrabold text-ai hover:bg-ai/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-warm/20 dark:text-warm"
                    >
                      {t('step3.exportView')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyTranscript(item)}
                      data-testid="copy-transcript"
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-ai hover:bg-ai/10 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm"
                    >
                      {copiedId === item.id ? t('step3.copied') : t('step3.copy')}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTranscript(item)}
                      data-testid="download-transcript"
                      className="rounded-lg bg-ai px-3 py-1.5 text-xs font-extrabold text-warm hover:bg-ai-light focus-visible:ring-2 focus-visible:ring-coral/50"
                    >
                      {t('step3.download')} {outputFormat.toUpperCase()}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded-lg border border-ai/25 px-3 py-1.5 text-xs font-extrabold text-ai hover:bg-ai/5 dark:border-warm/20 dark:text-warm"
                    >
                      {t('editor.print')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareItem(item)}
                      className="rounded-lg border border-coral/40 px-3 py-1.5 text-xs font-extrabold text-coral hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-coral/50"
                    >
                      {t('share.button')}
                    </button>
                  </div>
                </header>
                {shareLink && (
                  <p className="border-b border-ai/10 px-4 py-2 text-xs font-semibold text-coral dark:border-warm/10" role="status">
                    {shareLink.startsWith('http') ? <a href={shareLink} className="underline" target="_blank" rel="noreferrer">{shareLink}</a> : shareLink}
                  </p>
                )}
                {item.translations && item.translations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-ai/10 px-4 py-2 dark:border-warm/10" data-testid="bilingual-controls">
                    <span className="text-xs font-extrabold text-ai dark:text-warm">{t('translate.view')}:</span>
                    <button type="button" onClick={() => { setViewLang('original'); setShowBoth(false) }} aria-pressed={viewLang === 'original' && !showBoth} className={['rounded-lg px-3 py-1.5 text-xs font-bold', viewLang === 'original' && !showBoth ? 'bg-ai text-warm' : 'border border-ai/25 text-ai dark:border-warm/20 dark:text-warm'].join(' ')}>{t('translate.viewOriginal')}</button>
                    <button type="button" onClick={() => { setViewLang('translated'); setShowBoth(false) }} aria-pressed={viewLang === 'translated' && !showBoth} className={['rounded-lg px-3 py-1.5 text-xs font-bold', viewLang === 'translated' && !showBoth ? 'bg-ai text-warm' : 'border border-ai/25 text-ai dark:border-warm/20 dark:text-warm'].join(' ')}>{t('translate.viewTranslated')}</button>
                    <button type="button" onClick={() => setShowBoth((current) => !current)} aria-pressed={showBoth} className={['rounded-lg px-3 py-1.5 text-xs font-bold', showBoth ? 'bg-coral text-[#1A1207]' : 'border border-ai/25 text-ai dark:border-warm/20 dark:text-warm'].join(' ')}>{t('translate.viewBoth')}</button>
                    <button type="button" onClick={() => void downloadBilingual(item, 'srt')} className="rounded-lg border border-ai/25 px-3 py-1.5 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm">SRT</button>
                    <button type="button" onClick={() => void downloadBilingual(item, 'vtt')} className="rounded-lg border border-ai/25 px-3 py-1.5 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm">VTT</button>
                    <button type="button" onClick={() => void downloadBilingual(item, 'csv')} className="rounded-lg border border-ai/25 px-3 py-1.5 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm">CSV</button>
                    <button type="button" onClick={() => void downloadBilingual(item, 'md')} className="rounded-lg border border-ai/25 px-3 py-1.5 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm">MD</button>
                  </div>
                )}
                {focusId === item.id && (
                  <div className="space-y-4 border-b border-ai/10 bg-ai/5 p-4 dark:border-warm/10 dark:bg-warm/5" data-testid="editor-tools">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="min-w-48 flex-1">
                        <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('editor.find')}</span>
                        <input
                          type="text"
                          value={find}
                          onChange={(event) => setFind(event.target.value)}
                          data-testid="find-input"
                          className="mt-1 w-full rounded-lg border border-ai/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
                        />
                      </label>
                      <label className="min-w-48 flex-1">
                        <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('editor.replace')}</span>
                        <input
                          type="text"
                          value={replaceText}
                          onChange={(event) => setReplaceText(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-ai/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                        <input type="checkbox" checked={useRegex} onChange={(event) => setUseRegex(event.target.checked)} className="h-4 w-4 accent-coral" /> {t('editor.regex')}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                        <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} className="h-4 w-4 accent-coral" /> {t('editor.caseSensitive')}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const result = findReplaceSegments(item.segments, find, replaceText, { regex: useRegex, caseSensitive })
                          if (result.count > 0) updateSegments(item.id, result.segments)
                        }}
                        className="rounded-lg bg-coral px-3 py-2 text-xs font-extrabold text-[#1A1207] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ai/50"
                      >
                        {t('editor.replaceAll')} · {t('editor.matches', { count: find ? findReplaceSegments(item.segments, find, '', { regex: useRegex, caseSensitive }).count : 0 })}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateSegments(item.id, item.segments.map((segment) => ({ ...segment, text: cleanupTranscript(segment.text) })))}
                        className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai hover:bg-ai/5 dark:border-warm/20 dark:text-warm"
                      >
                        {t('editor.cleanup')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const chapters = buildChapters(item.segments, chapterGap * 1000)
                          updateSegments(item.id, item.segments.map((segment) => {
                            const chapterIndex = Math.max(0, chapters.findIndex((chapter) => chapter.startMs <= segment.startMs))
                            return { ...segment, speaker: (chapterIndex % 2) + 1 }
                          }))
                        }}
                        className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai hover:bg-ai/5 dark:border-warm/20 dark:text-warm"
                      >
                        {t('editor.speakerAdd')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const index = item.segments.findIndex((segment) => segment.endMs - segment.startMs > 6000)
                          if (index < 0) return
                          const segment = item.segments[index]
                          const middle = Math.round((segment.startMs + segment.endMs) / 2)
                          const next = [...item.segments]
                          next.splice(index, 1,
                            { ...segment, endMs: middle },
                            { ...segment, startMs: middle, text: segment.text },
                          )
                          updateSegments(item.id, next)
                        }}
                        className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai hover:bg-ai/5 dark:border-warm/20 dark:text-warm"
                      >
                        {t('editor.split')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const index = item.segments.findIndex((segment, i) => i > 0 && segment.startMs - item.segments[i - 1].endMs < 4000)
                          if (index < 0) return
                          const previous = item.segments[index - 1]
                          const current = item.segments[index]
                          const next = [...item.segments]
                          next.splice(index - 1, 2, { ...previous, endMs: current.endMs, text: `${previous.text} ${current.text}`.trim() })
                          updateSegments(item.id, next)
                        }}
                        className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai hover:bg-ai/5 dark:border-warm/20 dark:text-warm"
                      >
                        {t('editor.merge')}
                      </button>
                      <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                        {t('editor.chapters')}
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={chapterGap}
                          onChange={(event) => setChapterGap(Math.max(1, Math.min(30, Number(event.target.value) || 4)))}
                          className="w-16 rounded-lg border border-ai/20 bg-white px-2 py-1 dark:border-warm/15 dark:bg-ai dark:text-warm"
                        />
                        {t('editor.chapterGap', { seconds: chapterGap })}
                      </label>
                    </div>
                    <div className="flex flex-wrap items-end gap-3 border-t border-ai/10 pt-3 dark:border-warm/10">
                      <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                        {t('editor.trimSegment')}
                        <select
                          value={trimIndex}
                          onChange={(event) => setTrimIndex(Number(event.target.value))}
                          className="ml-2 rounded-lg border border-ai/20 bg-white px-2 py-1 dark:border-warm/15 dark:bg-ai dark:text-warm"
                        >
                          {item.segments.map((_segment, index) => (
                            <option key={index} value={index}>{index + 1}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                        {t('editor.trimStart')}
                        <input
                          type="number"
                          step="0.1"
                          value={(item.segments[Math.min(trimIndex, item.segments.length - 1)]?.startMs ?? 0) / 1000}
                          onChange={(event) => {
                            const index = Math.min(trimIndex, item.segments.length - 1)
                            const next = [...item.segments]
                            if (next[index]) next[index] = { ...next[index], startMs: Math.max(0, Number(event.target.value) * 1000) }
                            updateSegments(item.id, next)
                          }}
                          className="ml-2 w-24 rounded-lg border border-ai/20 bg-white px-2 py-1 dark:border-warm/15 dark:bg-ai dark:text-warm"
                        />
                      </label>
                      <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                        {t('editor.trimEnd')}
                        <input
                          type="number"
                          step="0.1"
                          value={(item.segments[Math.min(trimIndex, item.segments.length - 1)]?.endMs ?? 0) / 1000}
                          onChange={(event) => {
                            const index = Math.min(trimIndex, item.segments.length - 1)
                            const next = [...item.segments]
                            if (next[index]) next[index] = { ...next[index], endMs: Math.max(0, Number(event.target.value) * 1000) }
                            updateSegments(item.id, next)
                          }}
                          className="ml-2 w-24 rounded-lg border border-ai/20 bg-white px-2 py-1 dark:border-warm/15 dark:bg-ai dark:text-warm"
                        />
                      </label>
                    </div>
                    {detectRepeats(item.segments.map((segment) => segment.text).join(' ')) && (
                      <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <p>{t('editor.repeats')}</p>
                        <p className="mt-0.5 font-semibold">{t('editor.repeatsHint')}</p>
                        <button type="button" onClick={() => updateSegments(item.id, item.segments.map((segment) => ({ ...segment, text: cleanupTranscript(segment.text) })))} className="mt-2 rounded-lg border border-amber-500/50 px-3 py-1.5 font-extrabold hover:bg-amber-500/10">
                          {t('editor.removeRepeats')}
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 border-t border-ai/10 pt-3 dark:border-warm/10">
                      <button type="button" onClick={() => setClipRange({ startMs: playheadRef.current, endMs: clipRange?.endMs ?? 0 })} className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm">
                        {t('editor.clipStart')}
                      </button>
                      <button type="button" onClick={() => setClipRange({ startMs: clipRange?.startMs ?? 0, endMs: playheadRef.current })} className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm">
                        {t('editor.clipEnd')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const pcm = pcmStoreRef.current.get(item.id)
                          if (!pcm || !clipRange || clipRange.endMs <= clipRange.startMs) return
                          startPlaybackForClip(clipRange.startMs, clipRange.endMs, pcm)
                        }}
                        className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai dark:border-warm/20 dark:text-warm"
                      >
                        {t('editor.clipPlay')}
                      </button>
                      <button type="button" onClick={() => exportClip(item)} disabled={!clipRange || clipRange.endMs <= clipRange.startMs} className="rounded-lg border border-ai/25 px-3 py-2 text-xs font-extrabold text-ai disabled:opacity-40 dark:border-warm/20 dark:text-warm">
                        {t('editor.clipExport')}
                      </button>
                      {(!clipRange || clipRange.endMs <= clipRange.startMs) && <span className="text-xs text-neutral-500">{t('editor.clipNone')}</span>}
                    </div>
                    <label className="block">
                      <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('translate.glossary')}</span>
                      <textarea
                        value={item.glossary}
                        onChange={(event) => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, glossary: event.target.value } : entry)))}
                        rows={2}
                        placeholder={t('translate.glossaryHint')}
                        className="mt-1 w-full rounded-lg border border-ai/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
                      />
                      <button
                        type="button"
                        onClick={() => startTranslation(item)}
                        disabled={translateProgress.active}
                        className="mt-2 rounded-lg bg-coral px-3 py-2 text-xs font-extrabold text-[#1A1207] disabled:opacity-50"
                      >
                        {t('translate.runAgain')}
                      </button>
                    </label>
                    <label className="block">
                      <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('projects.notes')}</span>
                      <textarea
                        value={item.notes}
                        onChange={(event) => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, notes: event.target.value } : entry)))}
                        rows={2}
                        placeholder={t('projects.notesPlaceholder')}
                        className="mt-1 w-full rounded-lg border border-ai/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('exports.presets')}</span>
                      <select
                        value={preset}
                        onChange={(event) => setPreset(event.target.value as typeof preset)}
                        className="mt-1 w-full rounded-lg border border-ai/20 bg-white px-3 py-2 text-sm font-semibold dark:border-warm/15 dark:bg-ai dark:text-warm"
                      >
                        <option value="plain">{t('exports.presetPlain')}</option>
                        <option value="markdown">{t('exports.presetMarkdown')}</option>
                        <option value="captions">{t('exports.presetCaptions')}</option>
                        <option value="clean">{t('exports.presetClean')}</option>
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([presetText(item)], { type: 'text/plain;charset=utf-8' })
                          const url = URL.createObjectURL(blob)
                          const anchor = document.createElement('a')
                          anchor.href = url
                          anchor.download = `${item.name.replace(/\.[^.]+$/, '')}.${preset === 'markdown' ? 'md' : 'txt'}`
                          anchor.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="rounded-lg bg-ai px-3 py-2 text-xs font-extrabold text-warm hover:bg-ai-light focus-visible:ring-2 focus-visible:ring-coral/50"
                      >
                        {t('step3.download')} {preset.toUpperCase()}
                      </button>
                    </div>
                  </div>
                )}
                <TranscriptView
                  canPlay={pcmIds.has(item.id)}
                  getPcm={() => pcmStoreRef.current.get(item.id) ?? null}
                  segments={item.segments}
                  words={item.words}
                  displayMode={displayMode}
                  translations={item.translations}
                  showTranslation={showBoth}
                  preferTranslation={viewLang === 'translated'}
                  onPlayhead={(ms) => { playheadRef.current = ms }}
                  onShiftSegments={(offsetMs) =>
                    updateSegments(item.id, item.segments.map((segment) => ({
                      ...segment,
                      startMs: segment.startMs + offsetMs,
                      endMs: segment.endMs + offsetMs,
                    })))
                  }
                  onEditSegment={(index, text) =>
                    updateSegments(item.id, item.segments.map((segment, segIndex) => (segIndex === index ? { ...segment, text } : segment)))
                  }
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Guide and FAQ */}
      <GuideSection />

      {/* Model manager */}
      <div className="mt-8">
        <ModelManager />
      </div>
    </main>
  )
}
