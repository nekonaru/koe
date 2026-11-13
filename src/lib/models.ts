export type ModelId = 'tiny' | 'base' | 'small'

export interface ModelInfo {
  id: ModelId
  /** Hugging Face repository id used by Transformers.js */
  hfId: string
  /** Approximate download size in bytes (quantized ONNX files + tokenizer), measured via the HF API on 2026-11-14 */
  approxBytes: number
}

export const MODELS: readonly ModelInfo[] = [
  { id: 'tiny', hfId: 'onnx-community/whisper-tiny', approxBytes: 43_100_000 },
  { id: 'base', hfId: 'onnx-community/whisper-base', approxBytes: 77_500_000 },
  { id: 'small', hfId: 'onnx-community/whisper-small', approxBytes: 241_700_000 },
] as const

export const DEFAULT_MODEL: ModelId = 'base'

export function getModel(id: ModelId): ModelInfo {
  const model = MODELS.find((m) => m.id === id)
  if (!model) throw new Error(`Unknown model: ${id}`)
  return model
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 MB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

export interface LanguageOption {
  /** ISO 639-1 code accepted by Whisper, or 'auto' for detection */
  code: string
  /** English display name */
  label: string
}

/** Subset of languages Whisper supports well, bilingual UI shows the same names. */
export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'indonesian', label: 'Indonesian' },
  { code: 'english', label: 'English' },
  { code: 'malay', label: 'Malay' },
  { code: 'javanese', label: 'Javanese' },
  { code: 'sundanese', label: 'Sundanese' },
  { code: 'chinese', label: 'Chinese' },
  { code: 'japanese', label: 'Japanese' },
  { code: 'korean', label: 'Korean' },
  { code: 'thai', label: 'Thai' },
  { code: 'vietnamese', label: 'Vietnamese' },
  { code: 'tagalog', label: 'Tagalog' },
  { code: 'arabic', label: 'Arabic' },
  { code: 'hindi', label: 'Hindi' },
  { code: 'french', label: 'French' },
  { code: 'german', label: 'German' },
  { code: 'spanish', label: 'Spanish' },
  { code: 'portuguese', label: 'Portuguese' },
  { code: 'italian', label: 'Italian' },
  { code: 'dutch', label: 'Dutch' },
] as const
