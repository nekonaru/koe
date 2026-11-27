import { useCallback, useEffect, useState } from 'react'
import { I18nProvider } from './i18n/I18nProvider'
import { useI18n } from './i18n/useI18n'
import type { Locale } from './i18n/context'
import { Logo } from './components/Logo'
import { TranscribePage } from './pages/TranscribePage'
import { AboutPage } from './pages/AboutPage'
import { HelpPage } from './pages/HelpPage'
import { HomePage } from './components/HomePage'
import { ProjectsPage } from './components/ProjectsPage'
import { CommandPalette, useCommandPaletteHotkey, type PaletteAction } from './components/CommandPalette'
import { OnboardingTip, hasSeenTip } from './components/Onboarding'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { TEMPLATES } from './lib/templates'
import { deleteAudio, deleteProject, estimateStorage, listProjects, saveProject, type Project } from './lib/projects'
import { flushSync } from 'react-dom'

type Page = 'home' | 'transcribe' | 'projects' | 'about' | 'help'
type Theme = 'light' | 'dark' | 'system'
const THEME_STORAGE_KEY = 'koe-theme-v2'

function storedValue(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export interface RestoreRequest {
  project: Project
  token: number
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage unavailable; fall through
  }
  return 'system'
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function ThemeIcon({ theme }: ThemeIconProps) {
  if (theme === 'light') return <SunIcon />
  if (theme === 'dark') return <MoonIcon />
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 21h7M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

interface ThemeIconProps {
  theme: Theme
}

function InstallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12M7 11l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="4.5" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M19.8 4.2 18 6M6 18l1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.7.5.8 5.4.8 11.7c0 5 3.3 9.2 7.9 10.7.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.2-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.9 0C15.6 6 16.6 6.3 17.6 6.6c.7 1.6.3 2.8.2 3.1.8.9 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.1c0 .4.2.7.8.6a11.3 11.3 0 0 0 7.9-10.7C23.2 5.4 18.3.5 12 .5Z" />
    </svg>
  )
}

function Shell() {
  const { t, locale, setLocale } = useI18n()
  const [page, setPage] = useState<Page>('home')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [storage, setStorage] = useState({ usage: 0, quota: 0 })
  const [restore, setRestore] = useState<RestoreRequest | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [contrast, setContrast] = useState(() => storedValue('koe-contrast-v1', '0') === '1')
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => localStorage.getItem('koe-density-v1') === 'compact' ? 'compact' : 'comfortable')
  const [fontScale, setFontScale] = useState(() => Number(storedValue('koe-font-v1', '100')) || 100)
  const [settingsToken, setSettingsToken] = useState(0)
  const [showTip, setShowTip] = useState(() => !hasSeenTip())

  const refresh = useCallback(async () => {
    const [list, estimate] = await Promise.all([listProjects(), estimateStorage()])
    setProjects(list)
    setStorage(estimate)
  }, [])

  useEffect(() => {
    // Hydrate persisted projects on mount.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const navigate = useCallback((next: Page) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (typeof document.startViewTransition === 'function' && !reduce) {
      const transition = document.startViewTransition(() => flushSync(() => setPage(next)))
      void transition.finished.catch(() => undefined)
    } else {
      setPage(next)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.fontSize = `${fontScale}%`
    root.classList.toggle('koe-compact', density === 'compact')
    root.classList.toggle('koe-contrast', contrast)
    try {
      localStorage.setItem('koe-contrast-v1', contrast ? '1' : '0')
      localStorage.setItem('koe-density-v1', density)
      localStorage.setItem('koe-font-v1', String(fontScale))
    } catch {
      // Best effort only.
    }
  }, [contrast, density, fontScale])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === '?' && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Track the system theme while the user selected "system".
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark')
    }
    apply()
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // persist best effort only
    }
    if (theme === 'system' && media) {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
  }, [theme])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as Event & { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const startNew = useCallback(() => {
    setRestore(null)
    navigate('transcribe')
  }, [navigate])

  const openProject = useCallback((project: Project) => {
    setRestore({ project, token: Date.now() })
    navigate('transcribe')
  }, [navigate])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'))
  }, [])

  const toggleLanguage = useCallback(() => setLocale((locale === 'en' ? 'id' : 'en') as Locale), [locale, setLocale])

  const applyTemplate = useCallback((template: (typeof TEMPLATES)[number]) => {
    try {
      const raw = localStorage.getItem('koe-settings-v1')
      const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      localStorage.setItem('koe-settings-v1', JSON.stringify({
        ...current,
        language: template.language,
        model: template.model,
        task: template.task,
        outputFormat: template.format,
        displayMode: template.displayMode,
        translateTarget: 'id',
      }))
    } catch {
      // Settings are optional; the app still opens with defaults.
    }
    setSettingsToken((token) => token + 1)
    navigate('transcribe')
  }, [navigate])

  const paletteActions: PaletteAction[] = [
    { id: 'new', label: t('common.cmdNew'), hint: 'Ctrl K', run: startNew },
    { id: 'home', label: t('app.navHome'), run: () => navigate('home') },
    { id: 'projects', label: t('app.navProjects'), run: () => navigate('projects') },
    { id: 'transcribe', label: t('app.nav.transcribe'), run: () => navigate('transcribe') },
    { id: 'about', label: t('app.nav.about'), run: () => navigate('about') },
    { id: 'help', label: t('app.nav.help'), run: () => navigate('help') },
    { id: 'theme', label: t('common.cmdTheme'), run: toggleTheme },
    { id: 'language', label: t('common.cmdLanguage'), run: toggleLanguage },
    { id: 'search', label: t('common.cmdSearch'), hint: '/', run: () => window.dispatchEvent(new Event('koe:focus-search')) },
    { id: 'copy', label: t('common.cmdCopy'), run: () => window.dispatchEvent(new Event('koe:copy-transcript')) },
    { id: 'download', label: t('common.cmdDownload'), run: () => window.dispatchEvent(new Event('koe:download-transcript')) },
    { id: 'shortcuts', label: t('common.shortcuts'), hint: '?', run: () => setShortcutsOpen(true) },
    { id: 'contrast', label: t('common.cmdContrast'), run: () => setContrast((current) => !current) },
    { id: 'density', label: t('common.cmdDensity'), run: () => setDensity((current) => (current === 'compact' ? 'comfortable' : 'compact')) },
    { id: 'fontUp', label: t('common.cmdFontUp'), run: () => setFontScale((current) => Math.min(125, current + 10)) },
    { id: 'fontDown', label: t('common.cmdFontDown'), run: () => setFontScale((current) => Math.max(90, current - 10)) },
  ]
  useCommandPaletteHotkey(() => setPaletteOpen(true))

  const navItems: Array<{ id: Page; label: string }> = [
    { id: 'home', label: t('app.navHome') },
    { id: 'transcribe', label: t('app.nav.transcribe') },
    { id: 'projects', label: t('app.navProjects') },
    { id: 'about', label: t('app.nav.about') },
    { id: 'help', label: t('app.nav.help') },
  ]

  const handleSaved = useCallback(() => {
    void refresh()
  }, [refresh])

  const updateProject = useCallback(async (patch: Partial<Project> & { id: string }) => {
    const current = projects.find((project) => project.id === patch.id)
    if (!current) return
    await saveProject({ ...current, ...patch, updatedAt: Date.now() })
    await refresh()
  }, [projects, refresh])

  const exportProjects = useCallback(async () => {
    const list = await listProjects()
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: Date.now(), projects: list }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'koe-projects.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const importProjects = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { projects?: Project[] }
      if (!Array.isArray(parsed.projects)) return
      for (const project of parsed.projects) {
        if (project && typeof project.id === 'string') await saveProject(project)
      }
      await refresh()
    } catch {
      // Invalid files are ignored; existing projects stay intact.
    }
  }, [refresh])

  const removeProject = useCallback(async (id: string) => {
    await deleteProject(id)
    await deleteAudio(id)
    await refresh()
  }, [refresh])

  return (
    <div className="flex min-h-screen flex-col bg-warm text-neutral-800 dark:bg-ink dark:text-warm">
      <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
      <header className="sticky top-0 z-20 border-b border-ai/10 bg-warm/80 backdrop-blur dark:border-warm/10 dark:bg-ink/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            aria-label="Koe"
          >
            <Logo size={36} />
            <span className="text-2xl font-black lowercase tracking-tight text-ai dark:text-warm">koe</span>
          </button>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
                className={[
                  'rounded-xl px-3 py-2 text-sm font-extrabold outline-none transition focus-visible:ring-2 focus-visible:ring-coral/50',
                  page === item.id
                    ? 'bg-ai text-warm dark:bg-warm dark:text-ai'
                    : 'text-ai hover:bg-ai/5 dark:text-warm dark:hover:bg-warm/10',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={t('common.commandPalette')}
              title="Ctrl K"
              className="hidden rounded-xl border border-ai/20 px-3 py-2 text-xs font-extrabold text-ai hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 md:block dark:border-warm/20 dark:text-warm"
            >
              Ctrl K
            </button>
            {installPrompt && (
              <button
                type="button"
                onClick={() => {
                  void installPrompt.prompt()
                  setInstallPrompt(null)
                }}
                className="flex items-center gap-1.5 rounded-xl bg-coral px-3 py-2 text-xs font-extrabold text-[#1A1207] outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ai/50"
                aria-label={t('common.install')}
              >
                <InstallIcon />
                <span className="hidden sm:inline">{t('common.install')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setLocale((locale === 'en' ? 'id' : 'en') as Locale)}
              className="rounded-xl px-3 py-2 text-xs font-black uppercase text-ai outline-none hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm dark:hover:bg-warm/10"
              aria-label={t('common.language')}
            >
              {locale === 'en' ? 'ID' : 'EN'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-ai outline-none hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm dark:hover:bg-warm/10"
              aria-label={theme === 'light' ? t('common.themeDark') : theme === 'dark' ? t('common.themeSystem') : t('common.themeLight')}
              title={theme === 'light' ? t('common.themeDark') : theme === 'dark' ? t('common.themeSystem') : t('common.themeLight')}
            >
              <ThemeIcon theme={theme} />
            </button>
            <a
              href="https://github.com/nekonaru/koe"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl p-2 text-ai outline-none hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm dark:hover:bg-warm/10"
              aria-label="Koe on GitHub"
            >
              <GitHubIcon />
            </a>
          </div>
        </div>
        {/* Mobile navigation */}
        <nav className="flex items-center gap-1 border-t border-ai/10 px-2 py-1.5 sm:hidden dark:border-warm/10" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
              className={[
                'min-w-11 flex-1 rounded-lg px-2 py-2 text-[11px] font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-coral/50',
                page === item.id ? 'bg-ai text-warm dark:bg-warm dark:text-ai' : 'text-ai dark:text-warm',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div id="main-content" className="flex-1" tabIndex={-1}>
        {page === 'home' && (
          <HomePage projects={projects} storage={storage} onOpen={openProject} onNew={startNew} onTemplate={applyTemplate} />
        )}
        {page === 'transcribe' && (
          <TranscribePage key={settingsToken} restore={restore} onSaved={handleSaved} />
        )}
        {page === 'projects' && (
          <ProjectsPage
            projects={projects}
            storage={storage}
            onOpen={openProject}
            onRename={(id, name) => void updateProject({ id, name })}
            onNotes={(id, notes) => void updateProject({ id, notes })}
            onFavorite={(id) => {
              const project = projects.find((entry) => entry.id === id)
              if (project) void updateProject({ id, favorite: !project.favorite })
            }}
            onDelete={(id) => void removeProject(id)}
            onExportAll={() => void exportProjects()}
            onImport={(file) => void importProjects(file)}
            onToggleAudio={(id, keepAudio) => {
              void (async () => {
                await updateProject({ id, keepAudio })
                if (!keepAudio) await deleteAudio(id)
                else {
                  const source = projects.find((entry) => entry.id === id)
                  if (source && source.durationSec === null) await saveProject({ ...source, keepAudio: true })
                }
              })()
            }}
          />
        )}
        {page === 'about' && <AboutPage />}
        {page === 'help' && <HelpPage />}
      </div>

      <footer className="border-t border-ai/10 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-warm/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 px-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <span>{t('footer.nothingUploads')}</span>
          <span aria-hidden="true">·</span>
          <span>{t('footer.offlineReady')}</span>
          <span aria-hidden="true">·</span>
          <span>{t('footer.openSource')}</span>
        </div>
      </footer>

      <CommandPalette key={paletteOpen ? 'palette-open' : 'palette-closed'} open={paletteOpen} actions={paletteActions} onClose={() => setPaletteOpen(false)} />
      {shortcutsOpen && <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />}
      {showTip && <OnboardingTip onDismiss={() => setShowTip(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}
