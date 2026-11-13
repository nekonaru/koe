/**
 * Media decoding in the browser.
 *
 * Pipeline: File -> decodeAudioData -> AudioBuffer -> OfflineAudioContext
 * rendered down to mono 16 kHz -> Float32Array PCM for Whisper.
 *
 * Limitation: decodeAudioData loads the whole file into memory. That is why
 * the UI warns about very long files instead of pretending it is free.
 */
import { KoeError } from '../lib/errors'

export const SAMPLE_RATE = 16000

export interface DecodedAudio {
  pcm: Float32Array
  durationSec: number
}

type AudioContextConstructor = new () => AudioContext

function getAudioContextConstructor(): AudioContextConstructor {
  const ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  if (!ctor) throw new KoeError('unsupportedBrowser')
  return ctor
}

/** Decode an audio or video file to 16 kHz mono PCM. Throws KoeError on failure. */
export async function decodeToPcm16kMono(file: File): Promise<DecodedAudio> {
  const bytes = await file.arrayBuffer()
  const AudioContextCtor = getAudioContextConstructor()
  const decodeContext = new AudioContextCtor()
  try {
    // decodeAudioData detaches (neuters) the ArrayBuffer, so bytes must not be reused.
    const decoded = await decodeContext.decodeAudioData(bytes)
    const durationSec = decoded.duration

    const targetLength = Math.max(1, Math.ceil(durationSec * SAMPLE_RATE))
    const offline = new OfflineAudioContext(1, targetLength, SAMPLE_RATE)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start(0)
    const rendered = await offline.startRendering()
    // Slice copies the data out of the AudioBuffer's internal storage.
    const pcm = rendered.getChannelData(0).slice()
    return { pcm, durationSec }
  } catch (error) {
    if (error instanceof KoeError) throw error
    throw new KoeError('decodeFailed', error instanceof Error ? error.message : undefined)
  } finally {
    void decodeContext.close().catch(() => undefined)
  }
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
