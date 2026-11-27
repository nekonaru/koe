import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'

const STORAGE_KEY = 'koe-tip-v1'

// oxlint-disable-next-line react/only-export-components
export function hasSeenTip(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function OnboardingTip({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Best effort only.
    }
    dialogRef.current?.close()
    onDismiss()
  }

  return (
    <dialog ref={dialogRef} className="w-[min(440px,calc(100vw-2rem))] p-6 text-warm" aria-labelledby="tip-title">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-coral/15">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-coral">
          <path d="M7 10V8a5 5 0 0 1 10 0v2M5 10h14v10H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 id="tip-title" className="text-center text-lg font-black">{t('home.tipTitle')}</h2>
      <p className="mt-2 text-center text-sm font-semibold text-warm/70">{t('home.tipBody')}</p>
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={close}
          autoFocus
          data-testid="tip-dismiss"
          className="rounded-xl bg-coral px-5 py-2.5 text-sm font-extrabold text-[#1A1207] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-warm/50"
        >
          {t('home.tipDismiss')}
        </button>
      </div>
    </dialog>
  )
}
