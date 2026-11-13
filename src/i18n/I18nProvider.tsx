import { useEffect, useState, type ReactNode } from 'react'
import en from './en.json'
import id from './id.json'
import { I18nContext, type Locale, type MessageKey } from './context'

const dictionaries = { en, id } as const
type Messages = typeof en

function resolveKey(messages: Messages, key: string): string | undefined {
  let current: unknown = messages
  for (const part of key.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem('koe-locale')
    if (stored === 'en' || stored === 'id') return stored
  } catch {
    // localStorage can be unavailable (private mode); fall through
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
  return nav.startsWith('id') ? 'id' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem('koe-locale', next)
    } catch {
      // ignore: locale just won't persist
    }
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = (key: MessageKey, params?: Record<string, string | number>): string => {
    const raw = resolveKey(dictionaries[locale], key) ?? resolveKey(dictionaries.en, key) ?? key
    if (!params) return raw
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      raw,
    )
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}
