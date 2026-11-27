/**
 * Transcription worker.
 *
 * Architecture notes (read this before touching the file):
 *
 *  - The main thread decodes media to 16 kHz mono PCM and transfers the
 *    buffer here (an ArrayBuffer is moved, not copied).
 *  - Whisper works on 30 second windows, so we slice the PCM into windows.
 *    Processing window by window gives real progress reporting and lets us
 *    stop cleanly between windows. Windows have no overlap, which is a
 *    deliberate trade-off: overlapping windows need deduplication logic.
 *    Segment timestamps near a window boundary can be slightly off.
 *  - Tiny and Base are bundled in the site and loaded from our own origin.
 *    Small downloads from Hugging Face on demand and is cached by
 *    Transformers.js in the browser Cache Storage API.
 *  - The ONNX Runtime WASM binaries are served from our own origin
 *    (public/ort, copied from onnxruntime-web by scripts/copy-ort.mjs),
 *    never from a third-party CDN.
 *  - Cancellation: Whisper cannot be interrupted mid-window, so "cancel" is
 *    honored between windows. If the user cancels, the UI also terminates
 *    and recreates this worker as a hard stop.
 */
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import type { FromWorker, ToWorker } from '../lib/messages'
import { getModel, type ModelId } from '../lib/models'
import { KoeError, toKoeError } from '../lib/errors'

// Models bundled with the site (Tiny, Base) load from our own origin.
// Small still downloads from Hugging Face on demand. Local models are tried
// first; missing files fall back to the remote repo automatically.
env.allowLocalModels = true
// Serve assets relative to the app base so the project works on GitHub Pages
// (which hosts project sites under /koe/).
env.localModelPath = `${import.meta.env.BASE_URL}models/`
env.allowRemoteModels = true
env.useBrowserCache = true
// The WASM factory cannot be imported from a blob URL in Chromium, which is
// what the pre-load path does. ONNX Runtime imports the .mjs directly from
// our origin instead, and that path is verified to work.
env.useWasmCache = false

// Self-hosted ONNX Runtime WASM binaries (see public/ort/).
// env.backends.onnx.wasm is a shallow copy reference to ONNX Runtime's own
// env object, so mutate it in place. Replacing it would leave ONNX Runtime
// without wasmPaths, and it would fall back to the jsdelivr CDN.
// Assets are served from the app base (for example /koe/ on GitHub Pages), so
// build absolute URLs from the worker's own origin.
const assetBase = `${self.location.origin}${import.meta.env.BASE_URL}ort/`
const currentOrt = env.backends.onnx as { wasm?: Record<string, unknown> } | undefined
if (currentOrt?.wasm) {
  Object.assign(currentOrt.wasm, {
    wasmPaths: {
      mjs: `${assetBase}ort-wasm-simd-threaded.mjs`,
      wasm: `${assetBase}ort-wasm-simd-threaded.wasm`,
    },
  })
}

const SAMPLE_RATE = 16000
const WINDOW_SECONDS = 30
const WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS

// `self` in a module worker is a DedicatedWorkerGlobalScope; the DOM lib types
// it as Window, whose postMessage signature does not accept a transfer list.
console.log('[koe] worker booted')

const workerScope = self as unknown as {
  postMessage(message: FromWorker, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null
}

const transcriberCache = new Map<ModelId, AutomaticSpeechRecognitionPipeline>()
// Coalesce concurrent loadPipeline calls for the same model so the UI can
// auto-load a model while the user is already triggering an action.
const loadingPipelines = new Map<ModelId, Promise<AutomaticSpeechRecognitionPipeline>>()

function post(message: FromWorker, transfer?: Transferable[]) {
  if (transfer) {
    workerScope.postMessage(message, transfer)
  } else {
    workerScope.postMessage(message)
  }
}

function reportError(error: unknown) {
  const koeError = toKoeError(error)
  // Keep the raw message for diagnostics; the UI shows a translated message
  // based on the code instead of this text.
  const raw = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)
  post({ type: 'error', code: koeError.code, message: raw })
}

async function getTranscriber(modelId: ModelId): Promise<AutomaticSpeechRecognitionPipeline> {
  const cached = transcriberCache.get(modelId)
  if (cached) return cached

  return loadPipeline(modelId)
}

function loadPipeline(modelId: ModelId): Promise<AutomaticSpeechRecognitionPipeline> {
  const inflight = loadingPipelines.get(modelId)
  if (inflight) return inflight

  const { hfId, bundled } = getModel(modelId)
  const promise = (async () => {
    // Bundled models must never fall back to the network. If the local files
    // are missing or the cache is stale, fail fast with a clear message.
    // Clear any stale remote cache entries once so a previous interrupted
    // download cannot shadow the bundled copy.
    if (bundled) {
      try {
        const keys = await caches.keys()
        for (const key of keys) {
          const cache = await caches.open(key)
          const requests = await cache.keys()
          const needle = hfId.toLowerCase()
          await Promise.all(
            requests
              .filter((request) => request.url.toLowerCase().includes(needle))
              .map((request) => cache.delete(request)),
          )
        }
      } catch {
        // best effort; a stale entry only affects the first load
      }
      const previous = env.allowRemoteModels
      env.allowRemoteModels = false
      try {
        return await createPipeline(hfId, modelId)
      } finally {
        env.allowRemoteModels = previous
      }
    }

    return createPipeline(hfId, modelId)
  })()

  loadingPipelines.set(modelId, promise)
  promise.finally(() => {
    loadingPipelines.delete(modelId)
  })
  return promise
}

async function createPipeline(hfId: string, modelId: ModelId): Promise<AutomaticSpeechRecognitionPipeline> {
  const transcriber = await pipeline('automatic-speech-recognition', hfId, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (progress: { status?: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
      if (progress?.status === 'progress' || progress?.status === 'download' || progress?.file) {
        post({
          type: 'model-progress',
          file: progress.file ?? '',
          progress: typeof progress.progress === 'number' ? progress.progress : 0,
          loaded: progress.loaded ?? 0,
          total: progress.total ?? 0,
        })
      }
    },
  })
  transcriberCache.set(modelId, transcriber)
  return transcriber
}

let cancelRequested = false

async function handleInit(modelId: ModelId) {
  await getTranscriber(modelId)
  post({ type: 'ready' })
}

async function handleTranscribe(
  pcm: Float32Array,
  modelId: ModelId,
  language: string | null,
  task: 'transcribe' | 'translate',
  granularity: 'segment' | 'word',
) {
  // All three models ship as timestamped exports, so word-level output is
  // always available.
  const effective: 'segment' | 'word' = granularity

  const transcriber = await getTranscriber(modelId)
  const totalWindows = Math.max(1, Math.ceil(pcm.length / WINDOW_SAMPLES))
  const wordsOut: Array<import('../lib/messages').KaraokeWord> = []
  let detectedLanguage: string | null = null

  for (let index = 0; index < totalWindows; index += 1) {
    if (cancelRequested) {
      cancelRequested = false
      throw new KoeError('aborted')
    }
    const windowStartSample = index * WINDOW_SAMPLES
    const windowPcm = pcm.subarray(windowStartSample, Math.min(pcm.length, windowStartSample + WINDOW_SAMPLES))

    // Skip silent windows: Whisper hallucinates text on silence, so emit
    // nothing for stretches with no audible content.
    let peak = 0
    for (let sample = 0; sample < windowPcm.length; sample += 64) {
      const v = Math.abs(windowPcm[sample])
      if (v > peak) peak = v
      // Early exit once a loud enough sample is found
      if (peak >= 0.01) break
    }
    if (peak < 0.01) {
      post({ type: 'progress', percent: Math.round(((index + 1) / totalWindows) * 100), window: index + 1, totalWindows })
      continue
    }

    const options: Record<string, unknown> = {
      return_timestamps: effective === 'word' ? 'word' : true,
      task,
    }
    if (language) options.language = language

    const output = await transcriber(windowPcm, options)
    const detected = (output as { language?: string }).language
    if (!detectedLanguage && typeof detected === 'string' && detected.length > 0) {
      detectedLanguage = detected
      post({ type: 'detected-language', language: detected })
    }
    const rawChunks: Array<{ timestamp?: [number | null, number | null]; text?: string }> =
      (output as { chunks?: Array<{ timestamp?: [number | null, number | null]; text?: string }> }).chunks ?? []

    const winOffsetMs = (windowStartSample / SAMPLE_RATE) * 1000

    if (effective === 'segment') {
      for (const chunk of rawChunks) {
        const text = (chunk.text ?? '').trim()
        if (!text) continue
        const startRaw = chunk.timestamp?.[0]
        const endRaw = chunk.timestamp?.[1]
        const startMs = winOffsetMs + (typeof startRaw === 'number' ? startRaw * 1000 : 0)
        const endMs = winOffsetMs + (typeof endRaw === 'number' ? endRaw * 1000 : WINDOW_SECONDS * 1000)
        post({
          type: 'segment',
          segment: { startMs: Math.round(startMs), endMs: Math.round(endMs), text },
        })
      }
    } else {
      // Group words into readable subtitle chunks (roughly one sentence).
      let current: typeof wordsOut = []
      const flush = () => {
        if (current.length === 0) return
        const text = current.map((w) => w.text).join('').replace(/\s+/g, ' ').trim()
        if (text) {
          post({
            type: 'segment',
            segment: { startMs: current[0].startMs, endMs: current[current.length - 1].endMs, text },
          })
        }
        current = []
      }
      for (const chunk of rawChunks) {
        const wordText = chunk.text ?? ''
        if (!wordText.trim()) continue
        const startRaw = chunk.timestamp?.[0]
        const endRaw = chunk.timestamp?.[1]
        if (typeof startRaw !== 'number' || typeof endRaw !== 'number') continue
        const word = {
          startMs: Math.round(winOffsetMs + startRaw * 1000),
          endMs: Math.round(winOffsetMs + endRaw * 1000),
          text: wordText,
        }
        wordsOut.push(word)
        const gapMs = current.length > 0 ? word.startMs - current[current.length - 1].endMs : 0
        const shouldFlush =
          current.length >= 8 ||
          (current.length > 0 && (word.endMs - current[0].startMs) > 4500) ||
          (gapMs > 700 && current.length > 0) ||
          (/[.!?]["')]?\s*$/.test(word.text.trim()) && current.length >= 4)
        if (shouldFlush) flush()
        current.push(word)
      }
      flush()
    }

    post({ type: 'progress', percent: Math.round(((index + 1) / totalWindows) * 100), window: index + 1, totalWindows })
  }

  if (effective === 'word' && wordsOut.length > 0) {
    post({ type: 'words', words: wordsOut })
  }

  post({ type: 'done' })
}

workerScope.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data
  if (message.type === 'init') {
    handleInit(message.modelId).catch(reportError)
    return
  }
  if (message.type === 'cancel') {
    cancelRequested = true
    return
  }
  if (message.type === 'transcribe') {
    // Any cancel that arrived before this point is stale; do not honor it for
    // the new transcription, or the user would see an instant phantom abort.
    cancelRequested = false
    handleTranscribe(message.pcm, message.modelId, message.language, message.task, message.granularity ?? 'segment').catch(
      reportError,
    )
  }
}

