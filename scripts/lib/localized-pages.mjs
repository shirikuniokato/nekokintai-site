// 言語ごとの静的なページを作る。/ は日本語のまま、/en/ /ko/ /zh-TW/ に訳した HTML を置き、
// 検索エンジンが言語ごとに別のページとして読めるようにする（hreflang・canonical・sitemap もここで揃える）。
// 訳の差し替えはブラウザの applyLocale（assets/lp/i18n.mjs）と同じ規則で、HTML の文字列に対して行う。
import { FALLBACK_LOCALE, SUPPORTED_LOCALES, localizedPathname } from '../../assets/lp/locale.mjs'
import { localizedBadgePath, localizedScreenshotPath } from '../../assets/lp/i18n.mjs'

export const SITE_ORIGIN = 'https://nekokintai.com'

/** I18N_PAGES の html（'qa/index.html'）から、そのページの URL のパス（'/qa/'）を出す */
export function pagePathFromHtml(htmlPath) {
  const directory = htmlPath.replace(/index\.html$/u, '')
  return `/${directory}`
}

export function escapeText(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', '&quot;')
}

/** script と style の中身は HTML ではないので、置きかえの対象から外す */
function splitByRawText(html) {
  const pattern = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu
  const segments = []
  let last = 0
  for (const match of html.matchAll(pattern)) {
    segments.push({ raw: false, text: html.slice(last, match.index) })
    segments.push({ raw: true, text: match[0] })
    last = match.index + match[0].length
  }
  segments.push({ raw: false, text: html.slice(last) })
  return segments
}

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'u'))
  return match ? match[1] : null
}

/** 属性があれば値を置きかえ、なければ足す */
function writeAttribute(tag, name, value) {
  const escaped = escapeAttribute(value)
  const pattern = new RegExp(`(\\s${name}=)"[^"]*"`, 'u')
  if (pattern.test(tag)) return tag.replace(pattern, (_, head) => `${head}"${escaped}"`)
  return tag.replace(/\s*(\/?)>$/u, (_, slash) => ` ${name}="${escaped}"${slash ? ' /' : ''}>`)
}

const TRANSLATED_ATTRIBUTES = [
  ['data-i18n-alt', 'alt'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-content', 'content'],
  ['data-i18n-placeholder', 'placeholder'],
]

/** 辞書にないキーは HTML の日本語を残す（ブラウザの localizedText と同じ） */
function lookup(copy, key) {
  const text = copy[key]
  return typeof text === 'string' ? text : null
}

function isRelativeUrl(value) {
  return value !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/iu.test(value)
}

/**
 * サイト内のページへのリンクを同じ言語のページへ向け、相対パスを絶対パスに直す。
 * /en/qa/ に置くと、元の 'assets/lp/x.png' のような相対パスは別の場所を指してしまうため
 */
function localizeUrl(value, { locale, pagePath, sitePagePaths }) {
  if (isRelativeUrl(value)) return new URL(value, `${SITE_ORIGIN}${pagePath}`).pathname
  if (!value.startsWith('/') || value.startsWith('//')) return value
  const url = new URL(value, SITE_ORIGIN)
  if (!sitePagePaths.includes(url.pathname)) return value
  return `${localizedPathname(url.pathname, locale)}${url.search}${url.hash}`
}

function localizeImage(tag, locale) {
  const screenshot = readAttribute(tag, 'data-locale-screenshot')
  const badge = readAttribute(tag, 'data-locale-badge')
  const source = screenshot ? localizedScreenshotPath(locale, screenshot) : badge ? localizedBadgePath(locale, badge) : null
  if (!source) return tag
  // 元の日本語の画像を覚えておく。このページで日本語に切りかえたとき、ブラウザはここへ戻す
  const defaultName = screenshot ? 'data-locale-screenshot-default' : 'data-locale-badge-default'
  return writeAttribute(writeAttribute(tag, defaultName, readAttribute(tag, 'src')), 'src', source)
}

function localizeStartTag(tag, context) {
  const { locale, copy } = context
  let result = tag
  for (const [keyAttribute, targetAttribute] of TRANSLATED_ATTRIBUTES) {
    const key = readAttribute(result, keyAttribute)
    const text = key ? lookup(copy, key) : null
    if (text !== null) result = writeAttribute(result, targetAttribute, text)
  }
  const buttonLocale = readAttribute(result, 'data-locale')
  if (buttonLocale) result = writeAttribute(result, 'aria-pressed', String(buttonLocale === locale))
  const localizedImage = localizeImage(result, locale)
  if (localizedImage !== result) return localizedImage
  for (const name of ['href', 'src', 'action']) {
    const value = readAttribute(result, name)
    if (value === null) continue
    const localized = localizeUrl(value, context)
    if (localized !== value) result = writeAttribute(result, name, localized)
  }
  return result
}

function localizeMarkup(markup, context) {
  const { copy } = context
  const withText = markup.replace(
    /(<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/gu,
    (whole, open, _tag, key, _inner, close) => {
      const text = lookup(copy, key)
      return text === null ? whole : `${open}${escapeText(text)}${close}`
    },
  )
  return withText.replace(/<[a-zA-Z][^>]*>/gu, (tag) => localizeStartTag(tag, context))
}

/** 子要素を持つ data-i18n はブラウザ側でも中身が消えるので、作る前に止める */
function assertTextOnlyTranslations(html, htmlPath) {
  const total = [...html.matchAll(/\sdata-i18n="/gu)].length
  const textOnly = [...html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\sdata-i18n="[^"]+"[^>]*>[^<]*<\/\1>/gu)].length
  if (total !== textOnly) {
    throw new Error(`${htmlPath}: data-i18n の要素に子要素がある（${total - textOnly} 件）。文字だけにする`)
  }
}

export function alternateLinks(pagePath) {
  const links = SUPPORTED_LOCALES.map(
    (locale) => `<link rel="alternate" hreflang="${locale}" href="${SITE_ORIGIN}${localizedPathname(pagePath, locale)}">`,
  )
  links.push(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${pagePath}">`)
  return links
}

function replaceHeadUrls(html, url) {
  return html
    .replace(/(<link\s+rel="canonical"\s+href=)"[^"]*"/u, `$1"${url}"`)
    .replace(/(<meta\s+property="og:url"\s+content=)"[^"]*"/u, `$1"${url}"`)
}

/**
 * 1 ページ・1 言語ぶんの HTML を作る。日本語でも hreflang と構造化データを足すために通す。
 * extraHead は </head> の直前に足す行（構造化データなど）
 */
export function renderLocalizedPage(html, { htmlPath, locale, copy, sitePagePaths, extraHead = [] }) {
  assertTextOnlyTranslations(html, htmlPath)
  const pagePath = pagePathFromHtml(htmlPath)
  const context = { locale, copy, pagePath, sitePagePaths }
  // 日本語は元の HTML がそのまま正本なので、本文には手を入れない
  const body = locale === FALLBACK_LOCALE
    ? html
    : splitByRawText(html)
      .map((segment) => (segment.raw ? segment.text : localizeMarkup(segment.text, context)))
      .join('')
  const withLang = body.replace(/<html\s+lang="[^"]*"/u, `<html lang="${locale}"`)
  const withHeadUrls = replaceHeadUrls(withLang, `${SITE_ORIGIN}${localizedPathname(pagePath, locale)}`)
  const headLines = [...alternateLinks(pagePath), ...extraHead].join('\n')
  return withHeadUrls.replace('</head>', `${headLines}\n</head>`)
}

/** トップページの構造化データ。サイト名（検索結果の見出しに出る名前）とアプリの情報 */
export function homeStructuredData({ locale, copy, appStoreUrl, googlePlayUrl }) {
  const url = `${SITE_ORIGIN}${localizedPathname('/', locale)}`
  const data = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'ねこ勤怠', url: `${SITE_ORIGIN}/`, inLanguage: locale },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'ねこ勤怠',
      description: copy.documentDescription,
      url,
      image: `${SITE_ORIGIN}/ogp.png`,
      operatingSystem: 'iOS, Android',
      applicationCategory: 'ProductivityApplication',
      inLanguage: locale,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
      sameAs: [appStoreUrl, googlePlayUrl],
    },
  ]
  // </script> を文字列の中に書かれても閉じないよう < を逃がす
  return data.map((entry) => `<script type="application/ld+json">${JSON.stringify(entry).replaceAll('<', '\\u003c')}</script>`)
}

export function renderSitemap(pagePaths) {
  const entries = pagePaths.flatMap((pagePath) =>
    SUPPORTED_LOCALES.map((locale) => {
      const alternates = SUPPORTED_LOCALES.map(
        (alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate}" href="${SITE_ORIGIN}${localizedPathname(pagePath, alternate)}"/>`,
      )
      alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${pagePath}"/>`)
      return [`  <url>`, `    <loc>${SITE_ORIGIN}${localizedPathname(pagePath, locale)}</loc>`, ...alternates, `  </url>`].join('\n')
    }),
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}
