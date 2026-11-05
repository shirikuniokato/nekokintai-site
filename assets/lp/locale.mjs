export const FALLBACK_LOCALE = 'ja'
export const SUPPORTED_LOCALES = ['ja', 'en', 'ko', 'zh-TW', 'zh-Hans']

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(value)
}

/**
 * 言語ごとの URL。日本語は接頭辞なし（/qa/）、ほかは /en/qa/ のように言語を前に付ける。
 * 検索エンジンが言語ごとに別のページとして登録できるよう、言語は URL で決める
 */
export function splitLocalePath(pathname) {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === FALLBACK_LOCALE) continue
    if (pathname === `/${locale}`) return { locale, basePath: '/' }
    if (pathname.startsWith(`/${locale}/`)) return { locale, basePath: pathname.slice(locale.length + 1) }
  }
  return { locale: FALLBACK_LOCALE, basePath: pathname }
}

export function localizedPathname(basePath, locale) {
  return locale === FALLBACK_LOCALE ? basePath : `/${locale}${basePath}`
}

export function resolveSupportedLocale(languageTags, fallback = FALLBACK_LOCALE) {
  for (const languageTag of languageTags) {
    const normalized = languageTag.replaceAll('_', '-').toLowerCase()
    const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === normalized)
    if (exact) return exact

    const [language, ...subtags] = normalized.split('-')
    // 中国語は、明示された文字種（Hant / Hans）を地域より優先する。アプリの locale.ts と同じ順
    if (language === 'zh') {
      if (subtags.includes('hant')) return 'zh-TW'
      if (subtags.includes('hans')) return 'zh-Hans'
      return subtags.some((subtag) => ['tw', 'hk', 'mo'].includes(subtag)) ? 'zh-TW' : 'zh-Hans'
    }

    const baseLanguage = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === language)
    if (baseLanguage) return baseLanguage
  }

  return fallback
}

/**
 * 表示する言語。?lang= → 前に選んだ言語 → いま開いている URL の言語 の順。
 * 端末の言語では切りかえない。検索エンジンは英語の端末として読むので、
 * 端末の言語で中身を変えると日本語のページが英語として登録されてしまう
 */
export function preferredLocale({ urlLocale, storedLocale, pageLocale }) {
  if (urlLocale) return resolveSupportedLocale([urlLocale], pageLocale)
  if (storedLocale && isSupportedLocale(storedLocale)) return storedLocale
  return pageLocale
}

/** 言語を選んだことがない人に「〇〇語でも見られます」と案内する言語。案内しないときは null */
export function suggestedLocale({ urlLocale, storedLocale, deviceLocales, pageLocale }) {
  if (urlLocale || (storedLocale && isSupportedLocale(storedLocale))) return null
  const deviceLocale = resolveSupportedLocale(deviceLocales, null)
  return deviceLocale && deviceLocale !== pageLocale ? deviceLocale : null
}
