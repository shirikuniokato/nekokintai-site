import { FALLBACK_LOCALE, SUPPORTED_LOCALES, isSupportedLocale, preferredLocale } from './locale.mjs'

const LANGUAGE_STORAGE_KEY = 'nekokintai.lp.locale'
/** トップLPの辞書。ほかのページは <html data-i18n-source="..."> で自分の辞書を指す */
const DEFAULT_LOCALES_URL = '/assets/lp/locales.json'
const LOCALIZED_SCREENSHOTS = ['home', 'week', 'month', 'shop']
const LOCALIZED_BADGE_EXTENSIONS = { 'app-store': 'svg', 'google-play': 'png' }

function readStoredLocale() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveLocale(locale) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
  } catch {
    // A private browsing setting can block storage. The selected language still works for this visit.
  }
}

function requestedLocale() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  return preferredLocale({
    urlLocale: fromUrl,
    storedLocale: readStoredLocale(),
    deviceLocales: navigator.languages ?? [navigator.language],
  })
}

function updateLocaleInUrl(locale) {
  const url = new URL(window.location.href)
  if (locale === FALLBACK_LOCALE) {
    url.searchParams.delete('lang')
  } else {
    url.searchParams.set('lang', locale)
  }
  window.history.replaceState(null, '', url)
}

/** ページが自分の辞書を宣言していればそれを、なければトップLPの辞書を読む */
export function resolveLocalesUrl(dataset = {}) {
  const declared = dataset.i18nSource
  return typeof declared === 'string' && declared.length > 0 ? declared : DEFAULT_LOCALES_URL
}

export function localizedScreenshotPath(locale, screenshot) {
  return locale === FALLBACK_LOCALE
    ? null
    : `/assets/lp/screenshots/${locale}/screen-${screenshot}.png`
}

export function localizedBadgePath(locale, badge) {
  if (locale === FALLBACK_LOCALE) return null
  const extension = LOCALIZED_BADGE_EXTENSIONS[badge]
  if (!extension) return null
  return `/assets/badges/${badge}-${locale}.${extension}`
}

/** 日本語以外の言語で差し替える画像。日本語は HTML に書かれた既定の画像を使う。 */
export function localizedImageSources(locale) {
  if (locale === FALLBACK_LOCALE) return []
  return [
    ...LOCALIZED_SCREENSHOTS.map((screenshot) => localizedScreenshotPath(locale, screenshot)),
    ...Object.keys(LOCALIZED_BADGE_EXTENSIONS).map((badge) => localizedBadgePath(locale, badge)),
  ]
}

function swapImageSource(image, defaultKey, localizedSource) {
  const defaultSource = image.dataset[defaultKey] ?? image.getAttribute('src')
  image.dataset[defaultKey] = defaultSource
  image.setAttribute('src', localizedSource ?? defaultSource)
}

function applyLocalizedScreenshots(locale) {
  for (const image of document.querySelectorAll('[data-locale-screenshot]')) {
    swapImageSource(image, 'localeScreenshotDefault', localizedScreenshotPath(locale, image.dataset.localeScreenshot))
  }
}

function applyLocalizedBadges(locale) {
  for (const image of document.querySelectorAll('[data-locale-badge]')) {
    swapImageSource(image, 'localeBadgeDefault', localizedBadgePath(locale, image.dataset.localeBadge))
  }
}

/** 辞書にないキーは、HTML に書かれた日本語をそのまま残す（空白にしない）。訳し忘れた項目が消えて見えるのを防ぐ */
function localizedText(copy, key, current) {
  const text = copy[key]
  return typeof text === 'string' ? text : current
}

/** 言語が変わったことをページ側のスクリプトへ知らせる（ロードマップの「もっと見る」ボタンなど、JS が組み立てる文言の差し替え用） */
function announceLocale(locale, copy) {
  if (typeof document.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return
  document.dispatchEvent(new CustomEvent('nekokintai:locale', { detail: { locale, copy } }))
}

export function applyLocale(locale, copies) {
  const copy = copies[locale]
  if (!copy) return

  document.documentElement.lang = locale
  document.title = localizedText(copy, 'documentTitle', document.title)

  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = localizedText(copy, element.dataset.i18n, element.textContent)
  }
  for (const element of document.querySelectorAll('[data-i18n-alt]')) {
    element.alt = localizedText(copy, element.dataset.i18nAlt, element.alt)
  }
  for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', localizedText(copy, element.dataset.i18nAriaLabel, element.getAttribute('aria-label')))
  }
  for (const element of document.querySelectorAll('[data-i18n-content]')) {
    element.setAttribute('content', localizedText(copy, element.dataset.i18nContent, element.getAttribute('content')))
  }
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
    element.setAttribute('placeholder', localizedText(copy, element.dataset.i18nPlaceholder, element.getAttribute('placeholder')))
  }
  applyLocalizedScreenshots(locale)
  applyLocalizedBadges(locale)
  for (const button of document.querySelectorAll('[data-locale]')) {
    button.setAttribute('aria-pressed', String(button.dataset.locale === locale))
  }
  announceLocale(locale, copy)
}

/**
 * 言語ボタンのクリックで本文・画面・バッジを同じ applyLocale で切り替える。
 * onSelect は切り替え後の保存や URL 更新など、画面に関係ない後処理に使う。
 */
export function bindLocaleSwitcher(buttons, copies, onSelect = () => {}) {
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const locale = button.dataset.locale
      if (!isSupportedLocale(locale)) return

      applyLocale(locale, copies)
      onSelect(locale)
    })
  }
}

/**
 * いま表示していない言語の画面とバッジを先に読み込んでおく。
 * クリックで src を差し替えた瞬間に、読み込み待ちの間だけ前の言語の画像が残るのを防ぐ。
 */
export function warmLocalizedImages(currentLocale, createImage, defaultSources = []) {
  // 日本語以外で開いたときは、HTML に書かれた日本語の画像も読み込み途中で差し替えられている
  const sources = [
    ...(currentLocale === FALLBACK_LOCALE ? [] : defaultSources),
    ...SUPPORTED_LOCALES
      .filter((locale) => locale !== currentLocale)
      .flatMap((locale) => localizedImageSources(locale)),
  ]
  for (const source of sources) {
    const image = createImage()
    image.decoding = 'async'
    image.fetchPriority = 'low'
    image.src = source
  }
  return sources
}

function defaultImageSources() {
  return [...document.querySelectorAll('[data-locale-screenshot], [data-locale-badge]')]
    .map((image) => image.dataset.localeScreenshotDefault ?? image.dataset.localeBadgeDefault)
    .filter(Boolean)
}

function afterPageLoad(task) {
  const runWhenIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: 3000 })
    } else {
      window.setTimeout(task, 1000)
    }
  }
  if (document.readyState === 'complete') {
    runWhenIdle()
  } else {
    window.addEventListener('load', runWhenIdle, { once: true })
  }
}

async function initializeLocalization() {
  try {
    const localesUrl = resolveLocalesUrl(document.documentElement.dataset)
    const response = await fetch(localesUrl)
    if (!response.ok) throw new Error(`Could not load translations ${localesUrl}: ${response.status}`)

    const copies = await response.json()
    const initialLocale = requestedLocale()
    applyLocale(initialLocale, copies)
    // ?lang= 付きの共有リンクで開いたときも言語を覚えておく。ほかのページへ進んでも同じ言語のままにする
    if (new URLSearchParams(window.location.search).has('lang')) saveLocale(initialLocale)

    bindLocaleSwitcher(document.querySelectorAll('[data-locale]'), copies, (locale) => {
      saveLocale(locale)
      updateLocaleInUrl(locale)
    })
    // 本文用の画像を先に読み終えてから、他の言語の画像を低優先度で温める。
    // 言語で差し替える画像のないページ（お布施・よくあるしつもん）では、LP の画像を無駄に取りに行かない
    const defaultSources = defaultImageSources()
    if (defaultSources.length > 0) {
      afterPageLoad(() => warmLocalizedImages(initialLocale, () => new Image(), defaultSources))
    }
  } catch (error) {
    console.error('LP localization could not be initialized.', error)
  }
}

if (typeof window !== 'undefined') void initializeLocalization()
