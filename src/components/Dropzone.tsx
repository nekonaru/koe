import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n/useI18n'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

const ACCEPT = 'audio/*,video/*,.wav,.mp3,.m4a,.flac,.ogg,.mp4,.mov,.webm,.mkv'

export function Dropzone({ onFiles, disabled = false }: DropzoneProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) onFiles(files)
    },
    [disabled, onFiles],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-label={t('step1.drop')}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={[
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        'border-ai/30 bg-ai/5 outline-none focus-visible:ring-4 focus-visible:ring-coral/40',
        isDragging ? 'border-coral bg-coral/10' : '',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-ai/60 hover:bg-ai/10',
      ].join(' ')}
    >
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M24 6v24M14 18l10-10 10 10" stroke="#FF7A59" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 32v6a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-6" stroke="#2B3A67" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-lg font-bold text-ai dark:text-warm">{t('step1.drop')}</p>
      <p className="text-sm font-semibold text-coral">{t('step1.browse')}</p>
      <p className="max-w-md text-xs text-neutral-500 dark:text-neutral-400">{t('step1.formats')}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) onFiles(files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
