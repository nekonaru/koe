import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  const shortcuts = [
    ['Ctrl K', t('common.commandPalette')],
    ['?', t('common.shortcuts')],
    ['/', t('common.cmdSearch')],
    ['Space', t('common.cmdPlayback')],
    ['Ctrl Z', t('workspace.undo')],
    ['Ctrl Shift Z', t('workspace.redo')],
  ]

  return (
    <dialog ref={ref} className="w-[min(440px,calc(100vw-2rem))] p-6 text-warm" aria-labelledby="shortcuts-title" onClose={onClose}>
      <h2 id="shortcuts-title" className="text-lg font-black">{t('common.shortcuts')}</h2>
      <ul className="mt-4 space-y-2">
        {shortcuts.map(([key, label]) => (
          <li key={key} className="flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold text-warm/80">{label}</span>
            <kbd className="rounded-md border border-warm/20 bg-white/10 px-2 py-1 font-mono text-xs font-bold">{key}</kbd>
          </li>
        ))}
      </ul>
      <div className="mt-6 text-right">
        <button type="button" onClick={onClose} autoFocus className="rounded-xl bg-coral px-4 py-2 text-sm font-extrabold text-[#1A1207]">
          {t('common.close')}
        </button>
      </div>
    </dialog>
  )
}
