import type { ModelId } from './models'
import type { TranscriptSegment } from '../format/format'

export type Task = 'transcribe' | 'translate'

/** Target language for a translation pass after transcription. */
export interface TranslationTargetInfo {
  code: string
  label: string
  /** Empty when Whisper performs the translation natively to English */
  hfId: string
  approxBytes: number
  license: string
  heavy?: boolean
  /** FLORES-200 code, only used by the multilingual model */
  flores?: string
}

/** Messages sent to the translation worker. */
export type ToTranslateWorker =
  | {
      type: 'translate'
      texts: string[]
      modelId: string
      sourceLang: string
      targetLang: string
      glossary: string[]
      flores?: string
      sourceFlores?: string
    }
  | { type: 'cancel' }

/** Messages sent from the translation worker. */
export type FromTranslateWorker =
  | { type: 'progress'; percent: number }
  | { type: 'translated'; texts: string[] }
  | { type: 'error'; code: string; message: string }

/** Messages sent from the UI thread to the transcription worker. */
export type ToWorker =
  | { type: 'init'; modelId: ModelId }
  | {
      type: 'transcribe'
      pcm: Float32Array
      modelId: ModelId
      language: string | null
      task: Task
      /** 'segment' keeps grouped subtitles; 'word' emits word-level timestamps */
      granularity?: 'segment' | 'word'
    }
  | { type: 'cancel' }

export interface KaraokeWord {
  startMs: number
  endMs: number
  text: string
}

/** Messages sent from the worker back to the UI thread. */
export type FromWorker =
  | { type: 'model-progress'; file: string; progress: number; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'progress'; percent: number; window: number; totalWindows: number }
  | { type: 'segment'; segment: TranscriptSegment }
  | { type: 'words'; words: KaraokeWord[] }
  | { type: 'detected-language'; language: string }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string }
