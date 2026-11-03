// 公開ファイルの書き出し（build-pages.mjs）から呼ぶ。I18N_PAGES の全ページ × 全言語を書き出す。
// 日本語のページも hreflang と構造化データを足すため、元の HTML をここで上書きする。
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { SUPPORTED_LOCALES, localizedPathname } from '../../assets/lp/locale.mjs'
import { I18N_PAGES } from './lp-i18n-pages.mjs'
import { homeStructuredData, pagePathFromHtml, renderLocalizedPage, renderSitemap } from './localized-pages.mjs'

function storeUrls(homeHtml) {
  const find = (pattern, label) => {
    const match = homeHtml.match(pattern)
    if (!match) throw new Error(`index.html に ${label} のリンクが見つからない`)
    return match[1].replaceAll('&amp;', '&')
  }
  const appStoreUrl = find(/href="(https:\/\/apps\.apple\.com\/[^"]+)"/u, 'App Store')
  // LP からの流入を数える referrer は構造化データには載せない
  const googlePlayUrl = find(/href="(https:\/\/play\.google\.com\/store\/apps\/details\?id=[^"&]+)/u, 'Google Play')
  return { appStoreUrl, googlePlayUrl }
}

export async function writeLocalizedPages({ projectRoot, outputDirectory }) {
  const pages = Object.values(I18N_PAGES)
  const sitePagePaths = pages.map((page) => pagePathFromHtml(page.html))
  const homeHtml = await readFile(resolve(projectRoot, 'index.html'), 'utf8')
  const stores = storeUrls(homeHtml)

  for (const page of pages) {
    const html = await readFile(resolve(projectRoot, page.html), 'utf8')
    const copies = JSON.parse(await readFile(resolve(projectRoot, page.locales), 'utf8'))
    const pagePath = pagePathFromHtml(page.html)
    for (const locale of SUPPORTED_LOCALES) {
      const copy = copies[locale]
      if (!copy) throw new Error(`${page.locales} に ${locale} の訳がない`)
      const extraHead = pagePath === '/' ? homeStructuredData({ locale, copy, ...stores }) : []
      const rendered = renderLocalizedPage(html, { htmlPath: page.html, locale, copy, sitePagePaths, extraHead })
      const outputPath = resolve(outputDirectory, `.${localizedPathname(pagePath, locale)}index.html`)
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, rendered)
    }
  }
  await writeFile(resolve(outputDirectory, 'sitemap.xml'), renderSitemap(sitePagePaths))
}
