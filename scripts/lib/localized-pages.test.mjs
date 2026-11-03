import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { SUPPORTED_LOCALES } from '../../assets/lp/locale.mjs'
import { I18N_PAGES } from './lp-i18n-pages.mjs'
import { pagePathFromHtml, renderLocalizedPage, renderSitemap } from './localized-pages.mjs'

const siteRoot = resolve(import.meta.dirname, '../..')
const pages = Object.values(I18N_PAGES)
const sitePagePaths = pages.map((page) => pagePathFromHtml(page.html))

function load(page) {
  return {
    html: readFileSync(resolve(siteRoot, page.html), 'utf8'),
    copies: JSON.parse(readFileSync(resolve(siteRoot, page.locales), 'utf8')),
  }
}

function render(page, locale) {
  const { html, copies } = load(page)
  return renderLocalizedPage(html, { htmlPath: page.html, locale, copy: copies[locale], sitePagePaths })
}

const rawBlocks = (html) => [...html.matchAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu)].map((match) => match[0])

test('ページの URL のパスを html の置き場所から出す', () => {
  assert.equal(pagePathFromHtml('index.html'), '/')
  assert.equal(pagePathFromHtml('qa/index.html'), '/qa/')
})

for (const page of pages) {
  const pagePath = pagePathFromHtml(page.html)

  test(`${page.html}: 日本語は本文に手を入れず、head に hreflang だけ足す`, () => {
    const { html } = load(page)
    const rendered = render(page, 'ja')
    assert.equal(rendered.replace(/\n<link rel="alternate"[^\n]*/gu, ''), html)
    assert.match(rendered, new RegExp(`hreflang="x-default" href="https://nekokintai.com${pagePath}"`, 'u'))
  })

  for (const locale of SUPPORTED_LOCALES.filter((value) => value !== 'ja')) {
    test(`${page.html}: ${locale} のページを訳した HTML で作る`, () => {
      const { html, copies } = load(page)
      const copy = copies[locale]
      const rendered = render(page, locale)
      const url = `https://nekokintai.com/${locale}${pagePath}`

      assert.match(rendered, new RegExp(`<html lang="${locale}"`, 'u'))
      assert.ok(rendered.includes(`rel="canonical" href="${url}"`), 'canonical がその言語のページを指していない')
      for (const alternate of SUPPORTED_LOCALES) {
        assert.ok(rendered.includes(`hreflang="${alternate}"`), `hreflang=${alternate} がない`)
      }
      // 見出しと説明文が訳になっている（検索結果に出る部分）
      const title = rendered.match(/<title[^>]*>([^<]*)<\/title>/u)[1]
      assert.equal(title, copy.documentTitle.replaceAll('&', '&amp;'))
      assert.ok(rendered.includes(`content="${copy.documentDescription.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`), 'description が訳になっていない')
      assert.ok(rendered.includes(`data-locale="${locale}" aria-pressed="true"`), '言語ボタンの押された状態')
      // サイト内のリンクは同じ言語のページへ、相対パスは残さない
      for (const [, href] of rendered.matchAll(/\shref="(\/[^"]*)"/gu)) {
        const isPage = sitePagePaths.some((path) => href === path || href.startsWith(`${path}#`) || href.startsWith(`${path}?`))
        assert.ok(!isPage, `${href} が日本語のページを指している`)
      }
      for (const [, value] of rendered.matchAll(/\s(?:src|href)="([^"]*)"/gu)) {
        assert.ok(/^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu.test(value), `相対パス ${value} が残っている`)
      }
      // スクリプトとスタイルは書きかえない
      assert.deepEqual(rawBlocks(rendered), rawBlocks(html))
    })
  }
}

test('辞書にないキーは日本語を残し、文字を HTML として逃がす', () => {
  const html = '<html lang="ja"><head><title data-i18n="documentTitle">ねこ</title></head><body><p data-i18n="a">あ</p><p data-i18n="b">い</p></body></html>'
  const rendered = renderLocalizedPage(html, {
    htmlPath: 'index.html',
    locale: 'en',
    copy: { documentTitle: 'Cat', a: '<b>&</b>' },
    sitePagePaths: ['/'],
  })
  assert.ok(rendered.includes('<p data-i18n="a">&lt;b&gt;&amp;&lt;/b&gt;</p>'))
  assert.ok(rendered.includes('<p data-i18n="b">い</p>'))
})

test('子要素を持つ data-i18n があれば書き出しを止める', () => {
  const html = '<html lang="ja"><head></head><body><p data-i18n="a">あ<b>い</b></p></body></html>'
  assert.throws(
    () => renderLocalizedPage(html, { htmlPath: 'x/index.html', locale: 'en', copy: { a: 'A' }, sitePagePaths: ['/'] }),
    /子要素/u,
  )
})

test('sitemap に全ページ × 全言語と、たがいの言語の対応を載せる', () => {
  const sitemap = renderSitemap(['/', '/qa/'])
  assert.equal([...sitemap.matchAll(/<loc>/gu)].length, 2 * SUPPORTED_LOCALES.length)
  assert.ok(sitemap.includes('<loc>https://nekokintai.com/zh-TW/qa/</loc>'))
  assert.equal([...sitemap.matchAll(/hreflang="x-default" href="https:\/\/nekokintai.com\/qa\/"/gu)].length, SUPPORTED_LOCALES.length)
})
