import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { formatBytes } from '../lib/models'
import type { Project } from '../lib/projects'
import { StorageMeter } from './HomePage'

function formatDate(timestamp: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}

export function ProjectsPage({
  projects,
  storage,
  onOpen,
  onRename,
  onNotes,
  onFavorite,
  onDelete,
  onToggleAudio,
  onExportAll,
  onImport,
}: {
  projects: Project[]
  storage: { usage: number; quota: number }
  onOpen: (project: Project) => void
  onRename: (id: string, name: string) => void
  onNotes: (id: string, notes: string) => void
  onFavorite: (id: string) => void
  onDelete: (id: string) => void
  onToggleAudio: (id: string, keep: boolean) => void
  onExportAll: () => void
  onImport: (file: File) => void
}) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((project) => {
      if (onlyFavorites && !project.favorite) return false
      if (!q) return true
      return `${project.name} ${project.notes} ${project.segments.map((s) => s.text).join(' ')}`.toLowerCase().includes(q)
    })
  }, [projects, query, onlyFavorites])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ai dark:text-warm">{t('projects.title')}</h1>
          <p className="mt-1 text-sm font-semibold text-neutral-500 dark:text-neutral-400">{t('projects.subtitle')}</p>
        </div>
        <div className="w-full max-w-xs">
          <StorageMeter {...storage} />
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('projects.search')}
          aria-label={t('projects.search')}
          data-testid="projects-search"
          className="min-w-48 flex-1 rounded-xl border border-ai/20 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
        />
        <button
          type="button"
          onClick={() => setOnlyFavorites((current) => !current)}
          aria-pressed={onlyFavorites}
          className={[
            'rounded-xl border px-4 py-2.5 text-xs font-extrabold transition focus-visible:ring-2 focus-visible:ring-coral/50',
            onlyFavorites ? 'border-coral bg-coral/15 text-coral' : 'border-ai/20 text-ai dark:border-warm/20 dark:text-warm',
          ].join(' ')}
        >
          {t('projects.favorites')}
        </button>
        <button type="button" onClick={onExportAll} className="rounded-xl border border-ai/20 px-4 py-2.5 text-xs font-extrabold text-ai hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20 dark:text-warm">
          {t('projects.exportAll')}
        </button>
        <label className="rounded-xl border border-ai/20 px-4 py-2.5 text-xs font-extrabold text-ai hover:bg-ai/5 focus-within:ring-2 focus-within:ring-coral/50 dark:border-warm/20 dark:text-warm">
          {t('projects.import')}
          <input type="file" accept="application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file) }} data-testid="import-projects" />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-ai/25 p-10 text-center dark:border-warm/20">
          <p className="text-sm font-extrabold text-ai dark:text-warm">{t('projects.empty')}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500 dark:text-neutral-400">{t('projects.emptyBody')}</p>
        </div>
      ) : (
        <ul className="koe-stagger mt-6 space-y-3">
          {visible.map((project) => {
            const isOpen = expanded === project.id
            return (
              <li key={project.id} className="rounded-xl border border-ai/15 bg-white/70 p-4 dark:border-warm/10 dark:bg-ai/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-ai dark:text-warm">{project.name}</p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {formatBytes(project.sizeBytes)} · {project.segments.length} · {t('projects.updated', { date: formatDate(project.updatedAt, locale) })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => onOpen(project)} className="rounded-lg bg-ai px-3 py-2 text-xs font-extrabold text-warm hover:bg-ai-light focus-visible:ring-2 focus-visible:ring-coral/50 dark:bg-warm dark:text-ai">
                      {t('projects.open')}
                    </button>
                    <button type="button" onClick={() => onFavorite(project.id)} aria-label={t(project.favorite ? 'projects.unfavorite' : 'projects.favorite')} className="rounded-lg border border-ai/20 px-2.5 py-2 text-xs font-extrabold text-coral hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20">
                      {project.favorite ? '★' : '☆'}
                    </button>
                    <button type="button" onClick={() => setExpanded(isOpen ? null : project.id)} aria-expanded={isOpen} className="rounded-lg border border-ai/20 px-2.5 py-2 text-xs font-extrabold text-ai hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20 dark:text-warm">
                      {isOpen ? t('projects.close') : t('editor.title')}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-4 space-y-3 border-t border-ai/10 pt-4 dark:border-warm/10">
                    <label className="block">
                      <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('workspace.rename')}</span>
                      <input
                        type="text"
                        value={project.name}
                        onChange={(event) => onRename(project.id, event.target.value)}
                        className="mt-1 w-full rounded-lg border border-ai/20 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-300">{t('projects.notes')}</span>
                      <textarea
                        value={project.notes}
                        onChange={(event) => onNotes(project.id, event.target.value)}
                        placeholder={t('projects.notesPlaceholder')}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-ai/20 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-coral/50 dark:border-warm/15 dark:bg-ai dark:text-warm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={project.keepAudio}
                        onChange={(event) => onToggleAudio(project.id, event.target.checked)}
                        className="h-4 w-4 accent-coral"
                      />
                      {t('projects.saveAudio')}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('projects.confirmDelete'))) onDelete(project.id)
                      }}
                      className="rounded-lg border border-red-400/50 px-3 py-2 text-xs font-extrabold text-red-500 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-coral/50"
                    >
                      {t('projects.delete')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
