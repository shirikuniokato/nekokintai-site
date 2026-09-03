// 実ブラウザで「開発をおうえんする」「よくあるしつもん」の言語ボタンをクリックし、
// 見出し・タイトル・本文が切り替わること、トップLP用の画面画像を無駄に取りに行かないことを確かめる。
//   npm run test:browser
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile as readFileAsync } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, normalize, resolve, sep } from 'node:path'
import test, { after, before } from 'node:test'
import { chromium } from 'playwright'

const siteRoot = resolve(import.meta.dirname, '../..')
const CLICK_ORDER = ['en', 'ko', 'zh-TW', 'ja']
const PAGES = [
  { path: '/tip/', locales: 'assets/tip/locales.json', bodyKey: 'note3', bodySelector: '[data-i18n="note3"]' },
  { path: '/qa/', locales: 'assets/qa/locales.json', bodyKey: 'howTo1Answer', bodySelector: '[data-i18n="howTo1Answer"]' },
  {
    path: '/roadmap/',
    locales: 'assets/roadmap/locales.json',
    bodyKey: 'ios230Item1',
    // iOS と Android のカードは同じキーを共有するので、iOS 側に限る
    bodySelector: '.rv-pane-ios [data-i18n="ios230Item1"]',
    // JS が組み立てる「もっと見る」ボタンも、言語に合わせて書き換わる
    extra: async (tab, locale, copies) => {
      const label = await tab.locator('.rv-pane-ios .rv-more').first().textContent()
      const hiddenCount = await tab.locator('.rv-pane-ios .rv-more').first().getAttribute('data-hidden-count')
      assert.equal(label, copies[locale].showMore.replace('{{count}}', hiddenCount), `${locale}: もっと見るボタン`)
    },
  },
  {
    path: '/contact/',
    locales: 'assets/contact/locales.json',
    bodyKey: 'doneNoReply',
    bodySelector: '[data-i18n="doneNoReply"]',
    // placeholder と select の表示も切り替わる。value（件名）は日本語のまま
    extra: async (tab, locale, copies) => {
      assert.equal(await tab.locator('input[name="name"]').getAttribute('placeholder'), copies[locale].namePlaceholder, `${locale}: placeholder`)
      assert.equal(await tab.locator('select[name="kind"] option').first().textContent(), copies[locale].kindWish, `${locale}: option`)
      assert.equal(await tab.locator('select[name="kind"] option').first().getAttribute('value'), 'こんなのほしい', `${locale}: option value`)
    },
  },
  { path: '/privacy/', locales: 'assets/privacy/locales.json', bodyKey: 'dataIntro', bodySelector: '[data-i18n="dataIntro"]' },
]
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function serveSite() {
  return createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname
    const filePath = resolve(siteRoot, `.${normalize(relative)}`)
    if (!filePath.startsWith(siteRoot + sep)) {
      response.writeHead(403).end()
      return
    }
    try {
      const body = await readFileAsync(filePath)
      response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' })
      response.end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
}

let server
let baseUrl
let browser

before(async () => {
  server = serveSite()
  await new Promise((resolveListening) => server.listen(0, '127.0.0.1', resolveListening))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch()
})

after(async () => {
  await browser?.close()
  await new Promise((resolveClosed) => server?.close(resolveClosed))
})

test('?lang= 付きのリンクで開いた言語は、ほかのページへ進んでも保たれる', async () => {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })
  await tab.goto(`${baseUrl}/tip/?lang=ko`)
  await tab.waitForSelector('html[lang="ko"]')

  await tab.goto(`${baseUrl}/qa/`)
  await tab.waitForSelector('[data-locale][aria-pressed="true"]')
  assert.equal(await tab.evaluate(() => document.documentElement.lang), 'ko', '/qa/ が端末の言語に戻っている')

  // トップLPでも同じ
  await tab.goto(`${baseUrl}/`)
  await tab.waitForSelector('[data-locale][aria-pressed="true"]')
  assert.equal(await tab.evaluate(() => document.documentElement.lang), 'ko', '/ が端末の言語に戻っている')
  await tab.close()
})

for (const page of PAGES) {
  const copies = JSON.parse(readFileSync(resolve(siteRoot, page.locales), 'utf8'))

  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    test(`${page.path} の言語ボタンで見出し・タイトル・本文が切り替わる（${viewport.width}px）`, async () => {
      const tab = await browser.newPage({ viewport, locale: 'ja-JP' })
      const failures = []
      const lpImageRequests = []
      tab.on('pageerror', (error) => failures.push(error.message))
      tab.on('console', (message) => {
        if (message.type() === 'error') failures.push(message.text())
      })
      tab.on('request', (request) => {
        const pathname = new URL(request.url()).pathname
        if (pathname.startsWith('/assets/lp/screenshots/') || pathname.startsWith('/assets/badges/')) lpImageRequests.push(pathname)
      })

      await tab.goto(`${baseUrl}${page.path}`)
      await tab.waitForSelector('[data-locale="ja"][aria-pressed="true"]')
      await tab.waitForFunction((title) => document.title === title, copies.ja.documentTitle)
      assert.equal(await tab.locator('h1').innerText(), copies.ja.heading)

      for (const locale of CLICK_ORDER) {
        await tab.click(`[data-locale="${locale}"]`)
        await tab.waitForSelector(`html[lang="${locale}"]`)
        await tab.waitForSelector(`[data-locale="${locale}"][aria-pressed="true"]`)

        assert.equal(await tab.locator('h1').innerText(), copies[locale].heading, `${locale}: h1`)
        assert.equal(await tab.title(), copies[locale].documentTitle, `${locale}: title`)
        assert.equal(await tab.locator(page.bodySelector).textContent(), copies[locale][page.bodyKey], `${locale}: ${page.bodyKey}`)
        if (page.extra) await page.extra(tab, locale, copies)
        assert.equal(new URL(tab.url()).searchParams.get('lang'), locale === 'ja' ? null : locale, `${locale}: ?lang=`)
        // 本文が横にはみ出していない（韓国語・繁体字の長い見出しがスマホ幅で崩れていない）
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        assert.ok(overflow <= 0, `${locale}: 横に ${overflow}px はみ出している`)
      }

      // 日本語以外で開いたときも、URL の ?lang= だけで言語が決まる
      await tab.goto(`${baseUrl}${page.path}?lang=ko`)
      await tab.waitForSelector('html[lang="ko"]')
      assert.equal(await tab.locator('h1').innerText(), copies.ko.heading)

      await new Promise((resolveIdle) => setTimeout(resolveIdle, 1500))
      assert.deepEqual(lpImageRequests, [], 'トップLPの画面画像・バッジを取りに行っている')
      assert.deepEqual(failures, [], 'ブラウザでエラーが出た')
      await tab.close()
    })
  }
}
