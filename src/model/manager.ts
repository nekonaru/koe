/**
 * Model manager helpers.
 *
 * Models are downloaded by Transformers.js on first use and cached in the
 * browser Cache Storage API (cache name "transformers-cache"). We do not
 * reimplement the download; we only report what is already cached in this
 * browser and let the user delete it.
 */
import { MODELS, getModel, type ModelId } from '../lib/models'

export interface StorageEstimate {
  /** Bytes used across the whole origin */
  usedBytes: number
  /** Bytes the origin is allowed to use, or null when the browser does not report it */
  quotaBytes: number | null
}

export interface ModelCacheStatus {
  id: ModelId
  cached: boolean
}

/** Best effort detection of whether a model's files are present in Cache Storage. */
export async function getModelCacheStatus(): Promise<ModelCacheStatus[]> {
  try {
    const keys = await caches.keys()
    const modelNeedles = MODELS.map((model) => ({
      id: model.id,
      needle: getModel(model.id).hfId.toLowerCase(),
    }))
    const cachedUrls: string[] = []
    for (const key of keys) {
      const cache = await caches.open(key)
      const requests = await cache.keys()
      for (const request of requests) {
        cachedUrls.push(request.url.toLowerCase())
      }
    }
    return modelNeedles.map(({ id, needle }) => ({
      id,
      cached: cachedUrls.some((url) => url.includes(needle)),
    }))
  } catch {
    // Cache Storage unavailable (very old browsers): report unknown, never crash the page.
    return MODELS.map((model) => ({ id: model.id, cached: false }))
  }
}

export async function estimateStorage(): Promise<StorageEstimate> {
  try {
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate()
      return {
        usedBytes: usage ?? 0,
        quotaBytes: quota ?? null,
      }
    }
  } catch {
    // fall through to default
  }
  return { usedBytes: 0, quotaBytes: null }
}

/** Delete every cached file that belongs to one of our models from Cache Storage. */
export async function deleteModel(modelId: ModelId): Promise<void> {
  const needle = getModel(modelId).hfId.toLowerCase()
  const keys = await caches.keys()
  for (const key of keys) {
    const cache = await caches.open(key)
    const requests = await cache.keys()
    await Promise.all(
      requests
        .filter((request) => request.url.toLowerCase().includes(needle))
        .map((request) => cache.delete(request)),
    )
  }
}
