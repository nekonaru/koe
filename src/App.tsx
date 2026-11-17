import { useEffect, useState } from 'react'
import { I18nProvider } from './i18n/I18nProvider'
import { useI18n } from './i18n/useI18n'
import type { Locale } from './i18n/context'
import { Logo } from './components/Logo'
import { TranscribePage } from './pages/TranscribePage'
import { AboutPage } from './pages/AboutPage'
import { HelpPage } from './pages/HelpPage'

type Page = 'transcribe' | 'about' | 'help'
type Theme = 'light' | 'dark' | 'system'
const THEME_STORAGE_KEY = 'koe-theme-v2'

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

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') return <SunIcon />
  if (theme === 'dark') return <MoonIcon />
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 21h7M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
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
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M19.8 4.2 18 6M6 18l-1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
  const [page, setPage] = useState<Page>('transcribe')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null)

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

  const navItems: Array<{ id: Page; label: string }> = [
    { id: 'transcribe', label: t('app.nav.transcribe') },
    { id: 'about', label: t('app.nav.about') },
    { id: 'help', label: t('app.nav.help') },
  ]

  const toggleLanguage = () => setLocale((locale === 'en' ? 'id' : 'en') as Locale)
  const cycleTheme = () => setTheme((current) => (current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'))

  return (
    <div className="flex min-h-screen flex-col bg-warm text-neutral-800 dark:bg-ink dark:text-warm">
      <header className="sticky top-0 z-20 border-b border-ai/10 bg-warm/80 backdrop-blur dark:border-warm/10 dark:bg-ink/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => setPage('transcribe')}
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
                onClick={() => setPage(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-extrabold outline-none transition focus-visible:ring-2 focus-visible:ring-coral/50',
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
              onClick={toggleLanguage}
              className="rounded-xl px-3 py-2 text-xs font-black uppercase text-ai outline-none hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm dark:hover:bg-warm/10"
              aria-label={t('common.language')}
            >
              {locale === 'en' ? 'ID' : 'EN'}
            </button>
            <button
              type="button"
              onClick={cycleTheme}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-ai outline-none hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm dark:hover:bg-warm/10"
              aria-label={theme === 'light' ? t('common.themeDark') : theme === 'dark' ? t('common.themeSystem') : t('common.themeLight')}
              title={theme === 'light' ? t('common.themeDark') : theme === 'dark' ? t('common.themeSystem') : t('common.themeLight')}
            >
              <ThemeIcon theme={theme} />
              <span className="hidden text-[10px] font-black uppercase text-neutral-500 dark:text-neutral-400 md:inline">
                {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'}
              </span>
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
        {/* Mobile nav */}
        <nav className="flex items-center gap-1 border-t border-ai/10 px-4 py-1.5 sm:hidden dark:border-warm/10" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-coral/50',
                page === item.id ? 'bg-ai text-warm dark:bg-warm dark:text-ai' : 'text-ai dark:text-warm',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1">
        {page === 'transcribe' && <TranscribePage />}
        {page === 'about' && <AboutPage />}
        {page === 'help' && <HelpPage />}
      </div>

      <footer className="border-t border-ai/10 py-4 dark:border-warm/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 px-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <span>{t('footer.nothingUploads')}</span>
          <span aria-hidden="true">·</span>
          <span>{t('footer.offlineReady')}</span>
          <span aria-hidden="true">·</span>
          <span>{t('footer.openSource')}</span>
        </div>
      </footer>
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
