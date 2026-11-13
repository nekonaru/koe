import { useCallback, useEffect, useState } from 'react'
import { MODELS, formatBytes, type ModelId } from '../lib/models'
import { deleteModel, estimateStorage, getModelCacheStatus, type ModelCacheStatus, type StorageEstimate } from '../model/manager'
import { useI18n } from '../i18n/useI18n'

export function ModelManager() {
  const { t } = useI18n()
  const [status, setStatus] = useState<ModelCacheStatus[] | null>(null)
  const [storage, setStorage] = useState<StorageEstimate | null>(null)
  const [deleting, setDeleting] = useState<ModelId | null>(null)
  const [deleted, setDeleted] = useState<ModelId | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const refresh = useCallback(() => setRefreshTick((current) => current + 1), [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [statusResult, storageResult] = await Promise.all([getModelCacheStatus(), estimateStorage()])
      if (cancelled) return
      setStatus(statusResult)
      setStorage(storageResult)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refreshTick])

  const remove = async (id: ModelId) => {
    setDeleting(id)
    try {
      await deleteModel(id)
      setDeleted(id)
      refresh()
    } finally {
      setDeleting(null)
      window.setTimeout(() => setDeleted((current) => (current === id ? null : current)), 3000)
    }
  }

  return (
    <section aria-labelledby="model-manager-title" className="rounded-2xl border border-ai/15 bg-white/60 p-5 dark:border-warm/10 dark:bg-ai/20">
      <div className="flex items-center justify-between gap-3">
        <h2 id="model-manager-title" className="text-base font-extrabold text-ai dark:text-warm">
          {t('models.title')}
        </h2>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg px-2 py-1 text-xs font-bold text-ai underline underline-offset-2 hover:text-coral focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm/90"
        >
          {t('models.refresh')}
        </button>
      </div>

      {storage && (
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
          {t('models.storageUsed')}:{' '}
          {storage.quotaBytes !== null
            ? t('models.estimate', {
                used: formatBytes(storage.usedBytes),
                quota: formatBytes(storage.quotaBytes),
              })
            : formatBytes(storage.usedBytes)}
        </p>
      )}

      <ul className="mt-3 divide-y divide-ai/10 dark:divide-warm/10">
        {MODELS.map((model) => {
          const cached = status?.find((entry) => entry.id === model.id)?.cached
          return (
            <li key={model.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-bold text-neutral-800 dark:text-warm">
                  {model.id.charAt(0).toUpperCase() + model.id.slice(1)}{' '}
                  <span className="font-semibold text-neutral-500 dark:text-neutral-400">
                    {formatBytes(model.approxBytes)}
                  </span>
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {status === null ? t('models.checking') : cached ? t('models.cached') : t('models.notCached')}
                </p>
              </div>
              {cached && (
                <button
                  type="button"
                  onClick={() => void remove(model.id)}
                  disabled={deleting === model.id}
                  className="rounded-lg border border-coral/40 px-3 py-1.5 text-xs font-bold text-coral hover:bg-coral/10 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-coral/50"
                >
                  {deleted === model.id ? t('models.deleted') : t('models.delete')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
