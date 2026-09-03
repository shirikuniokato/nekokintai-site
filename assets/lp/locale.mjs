export const FALLBACK_LOCALE = 'ja'
export const SUPPORTED_LOCALES = ['ja', 'en', 'ko', 'zh-TW']

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(value)
}

export function resolveSupportedLocale(languageTags) {
  for (const languageTag of languageTags) {
    const normalized = languageTag.replaceAll('_', '-').toLowerCase()
    const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === normalized)
    if (exact) return exact

    const [language, ...subtags] = normalized.split('-')
    if (language === 'zh') {
      if (subtags.includes('hant') || subtags.includes('tw')) return 'zh-TW'
      continue
    }

    const baseLanguage = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === language)
    if (baseLanguage) return baseLanguage
  }

  return FALLBACK_LOCALE
}

export function preferredLocale({ urlLocale, storedLocale, deviceLocales }) {
  if (urlLocale) return resolveSupportedLocale([urlLocale])
  if (storedLocale && isSupportedLocale(storedLocale)) return storedLocale
  return resolveSupportedLocale(deviceLocales)
}
