export interface DeviceProfile {
  /** Inference currently runs on WASM in this release. */
  backend: 'wasm'
  /** WebGPU is only reported as available, not used yet. */
  webgpuAvailable: boolean
  threads: number
  memoryGb: number | null
  recommendation: 'tiny' | 'base' | 'small'
  saveData: boolean
}

type NavigatorExtras = Navigator & {
  gpu?: unknown
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

function extras(): NavigatorExtras | null {
  try {
    if (typeof navigator === 'undefined' || !navigator) return null
    return navigator as NavigatorExtras
  } catch {
    return null
  }
}

export function isSaveData(): boolean {
  return extras()?.connection?.saveData === true
}

export async function detectDevice(): Promise<DeviceProfile> {
  let webgpuAvailable = false
  let threads = 1
  let memoryGb: number | null = null
  const nav = extras()

  if (nav) {
    if (nav.gpu !== undefined && nav.gpu !== null) webgpuAvailable = true
    if (
      typeof nav.hardwareConcurrency === 'number' &&
      Number.isFinite(nav.hardwareConcurrency) &&
      nav.hardwareConcurrency > 0
    ) {
      threads = Math.floor(nav.hardwareConcurrency)
    }
    if (typeof nav.deviceMemory === 'number' && Number.isFinite(nav.deviceMemory) && nav.deviceMemory > 0) {
      memoryGb = nav.deviceMemory
    }
  }

  const recommendation = memoryGb === null ? 'tiny' : memoryGb >= 8 ? 'small' : memoryGb >= 4 ? 'base' : 'tiny'
  return { backend: 'wasm', webgpuAvailable, threads, memoryGb, recommendation, saveData: isSaveData() }
}
