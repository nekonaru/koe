/**
 * Every failure path surfaces one of these codes so the UI can show a
 * translated, human readable message. Never leak raw WASM or DOM errors.
 */
export type KoeErrorCode =
  | 'decodeFailed'
  | 'unsupported'
  | 'modelDownload'
  | 'checksum'
  | 'storage'
  | 'outOfMemory'
  | 'worker'
  | 'unsupportedBrowser'
  | 'noFile'
  | 'modelNotReady'
  | 'aborted'
  | 'unknown'

export class KoeError extends Error {
  readonly code: KoeErrorCode

  constructor(code: KoeErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'KoeError'
    this.code = code
  }
}

/** Best effort translation of an arbitrary caught error into a KoeError. */
export function toKoeError(error: unknown): KoeError {
  if (error instanceof KoeError) return error

  const name =
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
      ? error.name
      : ''
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()

  if (name === 'AbortError') return new KoeError('aborted')
  if (message.includes('out of memory') || message.includes('oom') || message.includes('allocation')) {
    return new KoeError('outOfMemory')
  }
  if (message.includes('quota') || message.includes('storage')) return new KoeError('storage')
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load model') ||
    message.includes('could not locate file')
  ) {
    return new KoeError('modelDownload')
  }
  if (message.includes('decode') || message.includes('unable to determine duration')) {
    return new KoeError('decodeFailed')
  }
  return new KoeError('unknown')
}
