import { pipeline, env, type TranslationPipeline } from '@huggingface/transformers'
import type { FromTranslateWorker, ToTranslateWorker } from '../lib/messages'
import { applyGlossary, cachedTranslation, chunkForTranslation, protectTerms, rememberTranslation } from '../lib/translate'

const scope = self as unknown as {
  postMessage: (message: FromTranslateWorker) => void
  onmessage: ((event: MessageEvent<ToTranslateWorker>) => void) | null
}

env.allowLocalModels = false
env.allowRemoteModels = true
env.useBrowserCache = true
env.useWasmCache = false

// Self-hosted ONNX Runtime files, matching the transcription worker.
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

let translator: TranslationPipeline | null = null
let loadedModel = ''
let cancelled = false

function post(message: FromTranslateWorker) {
  scope.postMessage(message)
}

async function load(modelId: string) {
  if (translator && loadedModel === modelId) return translator
  const next = await pipeline('translation', modelId, {
    dtype: 'q8',
    progress_callback: (progress: { status?: string; progress?: number }) => {
      if (progress.status === 'progress' && typeof progress.progress === 'number') {
        post({ type: 'progress', percent: Math.round(progress.progress) })
      }
    },
  })
  translator = next as TranslationPipeline
  loadedModel = modelId
  return translator
}

async function handle(message: Extract<ToTranslateWorker, { type: 'translate' }>) {
  const model = await load(message.modelId)
  const output: string[] = []
  const total = message.texts.length

  for (let index = 0; index < total; index += 1) {
    if (cancelled) throw new Error('aborted')
    const original = message.texts[index]
    const cacheKey = protectTerms(original, message.glossary)
    const cached = cachedTranslation(message.modelId, message.sourceLang, cacheKey)
    let translated: string

    if (cached !== null) {
      translated = cached
    } else {
      const chunks = chunkForTranslation(cacheKey)
      const pieces: string[] = []
      for (const chunk of chunks) {
        const options: Record<string, unknown> = { max_new_tokens: 256 }
        if (message.flores && message.sourceFlores) {
          options.src_lang = message.sourceFlores
          options.tgt_lang = message.flores
        }
        const result = await model(chunk, options)
        const first = Array.isArray(result) ? result[0] : result
        const text = (first as { translation_text?: string })?.translation_text ?? ''
        pieces.push(text.trim())
      }
      translated = pieces.join(' ')
      rememberTranslation(message.modelId, message.sourceLang, cacheKey, translated)
    }

    output.push(applyGlossary(original, translated, message.glossary))
    post({ type: 'progress', percent: Math.round(((index + 1) / total) * 100) })
  }

  post({ type: 'translated', texts: output })
}

scope.onmessage = (event: MessageEvent<ToTranslateWorker>) => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelled = true
    return
  }
  if (message.type === 'translate') {
    cancelled = false
    handle(message).catch((error: unknown) => {
      post({ type: 'error', code: 'translation', message: error instanceof Error ? error.message : String(error) })
    })
  }
}
