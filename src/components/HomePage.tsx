import { useMemo } from 'react'
import { useI18n } from '../i18n/useI18n'
import { formatBytes } from '../lib/models'
import type { Project } from '../lib/projects'
import type { TranscriptTemplate } from '../lib/templates'
import { TEMPLATES } from '../lib/templates'

function formatDate(timestamp: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toDateString()
  }
}

export function StorageMeter({ usage, quota }: { usage: number; quota: number }) {
  const { t } = useI18n()
  if (quota <= 0) return <p className="text-xs text-neutral-500">{t('projects.noStorage')}</p>
  const percent = Math.min(100, Math.round((usage / quota) * 100))
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 text-xs font-bold text-neutral-500 dark:text-neutral-400">
        <span>{t('projects.storage')}</span>
        <span>{formatBytes(usage)} / {formatBytes(quota)} ({percent}%)</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ai/10 dark:bg-warm/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-coral transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function HomePage({
  projects,
  storage,
  onOpen,
  onNew,
  onTemplate,
}: {
  projects: Project[]
  storage: { usage: number; quota: number }
  onOpen: (project: Project) => void
  onNew: () => void
  onTemplate: (template: TranscriptTemplate) => void
}) {
  const { t, locale } = useI18n()
  const recent = useMemo(() => projects.slice(0, 6), [projects])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
      <section className="relative overflow-hidden rounded-xl border border-ai/15 bg-white/70 p-6 dark:border-warm/10 dark:bg-ai/20 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-coral">{t('home.tipTitle')}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-ai dark:text-warm sm:text-4xl">{t('home.title')}</h1>
          <p className="mt-3 text-sm font-semibold text-neutral-600 dark:text-neutral-300">{t('home.subtitle')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onNew}
              data-testid="home-new"
              className="rounded-xl bg-coral px-5 py-3 text-sm font-extrabold text-[#1A1207] transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ai/50"
            >
              {t('home.new')}
            </button>
            {projects.length > 0 && (
              <button
                type="button"
                onClick={() => onOpen(projects[0])}
                className="rounded-xl border border-ai/25 px-5 py-3 text-sm font-extrabold text-ai transition hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/20 dark:text-warm"
              >
                {t('home.resume')}
              </button>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-coral/10 blur-2xl dark:bg-coral/5" />
      </section>

      <section className="mt-8" aria-labelledby="templates-title">
        <h2 id="templates-title" className="mb-3 text-xs font-black uppercase tracking-widest text-ai/70 dark:text-warm/70">{t('home.templates')}</h2>
        <ul className="koe-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => onTemplate(template)}
                className="h-full w-full rounded-xl border border-ai/15 bg-white/70 p-4 text-left transition hover:border-coral/60 hover:bg-white focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/10 dark:bg-ai/20 dark:hover:bg-ai/30"
              >
                <p className="text-sm font-extrabold text-ai dark:text-warm">{t(`templates.${template.id}`)}</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t(`templates.${template.id}Desc`)}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="recent-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-title" className="text-xs font-black uppercase tracking-widest text-ai/70 dark:text-warm/70">
            {t('home.recent')}
          </h2>
          <span className="text-xs font-bold text-neutral-500">{t('home.count', { count: projects.length })}</span>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ai/25 p-8 text-center dark:border-warm/20">
            <p className="text-sm font-extrabold text-ai dark:text-warm">{t('home.empty')}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500 dark:text-neutral-400">{t('home.emptyBody')}</p>
          </div>
        ) : (
          <ul className="koe-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onOpen(project)}
                  className="h-full w-full rounded-xl border border-ai/15 bg-white/70 p-4 text-left transition hover:border-coral/60 hover:bg-white focus-visible:ring-2 focus-visible:ring-coral/50 dark:border-warm/10 dark:bg-ai/20 dark:hover:bg-ai/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-extrabold text-ai dark:text-warm">{project.name}</p>
                    {project.favorite && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-coral" aria-label={t('projects.favorite')}>
                        <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8-6.1-3.4-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
                      </svg>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
                    {project.segments.map((segment) => segment.text).join(' ').slice(0, 120)}
                  </p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                    {formatDate(project.updatedAt, locale)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-ai/10 bg-ai/5 p-4 dark:border-warm/10 dark:bg-warm/5">
        <StorageMeter {...storage} />
      </section>
    </main>
  )
}
