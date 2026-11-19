import type { ModelId } from './models'
import type { TranscriptSegment } from '../format/format'

export type Task = 'transcribe' | 'translate'

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
  | { type: 'done' }
  | { type: 'error'; code: string; message: string }
