import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'

export interface PaletteAction {
  id: string
  label: string
  hint?: string
  run: () => void
}

export function CommandPalette({
  open,
  actions,
  onClose,
}: {
  open: boolean
  actions: PaletteAction[]
  onClose: () => void
}) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((action) => `${action.label} ${action.hint ?? ''}`.toLowerCase().includes(q))
  }, [actions, query])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // The browser focuses the first autofocus control in the dialog.
      window.setTimeout(() => inputRef.current?.focus(), 0)
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const choose = (action: PaletteAction | undefined) => {
    if (!action) return
    onClose()
    action.run()
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(560px,calc(100vw-2rem))] text-warm"
      aria-labelledby="palette-title"
      onClose={onClose}
    >
      <h2 id="palette-title" className="sr-only">{t('common.commandPalette')}</h2>
      <div className="border-b border-warm/10 p-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((current) => (filtered.length === 0 ? 0 : (current + 1) % filtered.length))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((current) => (filtered.length === 0 ? 0 : (current - 1 + filtered.length) % filtered.length))
            } else if (event.key === 'Home') {
              event.preventDefault()
              setActive(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              setActive(Math.max(0, filtered.length - 1))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              choose(filtered[active])
            }
          }}
          placeholder={t('common.palettePlaceholder')}
          aria-label={t('common.palettePlaceholder')}
          aria-controls="palette-options"
          autoFocus
          data-testid="command-palette-input"
          className="w-full rounded-lg border border-warm/15 bg-white/5 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-coral/50"
        />
      </div>
      <div id="palette-options" className="max-h-80 overflow-auto p-2" role="listbox" aria-label={t('common.commandPalette')}>
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-warm/60">{t('common.noResults')}</p>
        ) : (
          filtered.map((action, index) => (
            <button
              key={action.id}
              ref={(element) => { itemRefs.current[index] = element }}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(action)}
              className={[
                'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold',
                index === active ? 'bg-coral/20 text-coral' : 'text-warm hover:bg-white/5',
              ].join(' ')}
            >
              <span>{action.label}</span>
              {action.hint && <span className="text-[10px] font-black uppercase text-warm/40">{action.hint}</span>}
            </button>
          ))
        )}
      </div>
    </dialog>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}
