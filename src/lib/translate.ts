import type { TranslationTargetInfo } from './messages'

/**
 * Translation targets that need a separate model. English stays on Whisper's
 * native translate task and is therefore not listed here as a download.
 */
export const TRANSLATION_TARGETS: readonly TranslationTargetInfo[] = [
  { code: 'id', label: 'Indonesian', hfId: 'Xenova/opus-mt-en-id', approxBytes: 102_621_804, license: 'CC BY 4.0' },
  { code: 'fr', label: 'French', hfId: 'Xenova/opus-mt-en-fr', approxBytes: 107_471_910, license: 'CC BY 4.0' },
  { code: 'es', label: 'Spanish', hfId: 'Xenova/opus-mt-en-es', approxBytes: 113_112_546, license: 'CC BY 4.0' },
  { code: 'de', label: 'German', hfId: 'Xenova/opus-mt-en-de', approxBytes: 106_019_346, license: 'CC BY 4.0' },
  {
    code: 'nllb-id',
    label: 'Indonesian (multilingual, large)',
    hfId: 'Xenova/nllb-200-distilled-600M',
    approxBytes: 894_626_254,
    license: 'CC BY-NC 4.0',
    heavy: true,
    flores: 'ind_Latn',
  },
] as const

const FLORES: Record<string, string> = {
  english: 'eng_Latn',
  indonesian: 'ind_Latn',
  malay: 'zsm_Latn',
  javanese: 'jav_Latn',
  sundanese: 'sun_Latn',
  chinese: 'zho_Hans',
  japanese: 'jpn_Jpan',
  korean: 'kor_Hang',
  thai: 'tha_Thai',
  vietnamese: 'vie_Latn',
  french: 'fra_Latn',
  german: 'deu_Latn',
  spanish: 'spa_Latn',
  portuguese: 'por_Latn',
  italian: 'ita_Latn',
  dutch: 'nld_Latn',
  arabic: 'arb_Arab',
  hindi: 'hin_Deva',
}

export function floresFor(language: string | null | undefined): string | undefined {
  if (!language) return undefined
  return FLORES[language.toLowerCase()]
}

export function getTranslationTarget(code: string): TranslationTargetInfo | null {
  return TRANSLATION_TARGETS.find((target) => target.code === code) ?? null
}

/** Split long text so it fits the 512-token limit of the translation models. */
export function chunkForTranslation(text: string, maxChars = 400): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= maxChars) return [trimmed]
  const sentences = trimmed.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > maxChars) {
      chunks.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/** Protect project terms from being translated, then restore them. */
export function applyGlossary(_source: string, translated: string, terms: string[]): string {
  const cleaned = terms.map((term) => term.trim()).filter((term) => term.length > 0)
  if (cleaned.length === 0) return translated
  let result = translated
  cleaned.forEach((term, index) => {
    const pattern = new RegExp(`KOETERM${index}END`, 'gi')
    result = result.replace(pattern, term)
  })
  return result
}

/** Build the text actually sent to the model with protected terms. */
export function protectTerms(text: string, terms: string[]): string {
  let protectedText = text
  terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .forEach((term, index) => {
      protectedText = protectedText.split(term).join(`KOETERM${index}END`)
    })
  return protectedText
}

const CACHE_KEY = 'koe-translate-cache-v1'
const CACHE_LIMIT = 2000
let memoryCache: Record<string, string> | null = null

function loadCache(): Record<string, string> {
  if (memoryCache) return memoryCache
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    memoryCache = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    memoryCache = {}
  }
  return memoryCache
}

function cacheKey(modelId: string, source: string, text: string): string {
  let hash = 0
  const value = `${modelId}|${source}|${text}`
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return `${hash.toString(36)}:${text.length}`
}

export function cachedTranslation(modelId: string, source: string, text: string): string | null {
  return loadCache()[cacheKey(modelId, source, text)] ?? null
}

export function rememberTranslation(modelId: string, source: string, text: string, translated: string): void {
  const cache = loadCache()
  cache[cacheKey(modelId, source, text)] = translated
  const keys = Object.keys(cache)
  if (keys.length > CACHE_LIMIT) {
    for (const key of keys.slice(0, keys.length - CACHE_LIMIT)) delete cache[key]
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage pressure must not break translation.
  }
}
