// 書き出した言語ごとのページ（/en/ など）と、端末の言語の案内の帯を実ブラウザで確かめる。
//   npm run test:browser
// 書き出しは一時ディレクトリへ行い、そこに無いファイル（画像・スクリプト）はリポジトリから配る。
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import test, { after, before } from 'node:test'
import { chromium } from 'playwright'
import { writeLocalizedPages } from '../lib/build-localized-pages.mjs'

const siteRoot = resolve(import.meta.dirname, '../..')
const lpCopies = JSON.parse(readFileSync(resolve(siteRoot, 'assets/lp/locales.json'), 'utf8'))
const contactCopies = JSON.parse(readFileSync(resolve(siteRoot, 'assets/contact/locales.json'), 'utf8'))
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

async function readFirst(roots, relative) {
  for (const root of roots) {
    const filePath = resolve(root, `.${normalize(relative)}`)
    if (!filePath.startsWith(root + sep)) return null
    try {
      return { filePath, body: await readFile(filePath) }
    } catch {
      // 次の置き場所を見る
    }
  }
  return null
}

function serve(roots) {
  return createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname
    const found = await readFirst(roots, relative)
    if (!found) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(found.filePath)] ?? 'application/octet-stream' })
    response.end(found.body)
  })
}

let outputDirectory
let server
let baseUrl
let browser

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'nekokintai-localized-'))
  await writeLocalizedPages({ projectRoot: siteRoot, outputDirectory })
  server = serve([outputDirectory, siteRoot])
  await new Promise((resolveListening) => server.listen(0, '127.0.0.1', resolveListening))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch()
})

after(async () => {
  await browser?.close()
  await new Promise((resolveClose) => server?.close(resolveClose))
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true })
})

async function openTab(locale, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale, ...options })
  const tab = await context.newPage()
  const failures = []
  tab.on('pageerror', (error) => failures.push(error.message))
  return { context, tab, failures }
}

test('JavaScript を動かさなくても、/en/ は英語・/ は日本語で読める（検索エンジンが読む形）', async () => {
  const { context, tab } = await openTab('en-US', { javaScriptEnabled: false })
  await tab.goto(`${baseUrl}/en/`)
  assert.equal(await tab.locator('h1').innerText(), lpCopies.en.heroTitle)
  assert.equal(await tab.title(), lpCopies.en.documentTitle)
  await tab.goto(`${baseUrl}/`)
  assert.equal(await tab.locator('h1').innerText(), lpCopies.ja.heroTitle)
  await context.close()
})

test('英語の端末で / を開くと日本語のままで、帯から英語のページへ進める', async () => {
  const { context, tab, failures } = await openTab('en-US')
  await tab.goto(`${baseUrl}/`)
  const banner = tab.locator('.locale-suggestion')
  await banner.waitFor()
  assert.equal(await tab.evaluate(() => document.documentElement.lang), 'ja')
  assert.equal(await tab.locator('h1').innerText(), lpCopies.ja.heroTitle)
  assert.equal(await banner.locator('a').innerText(), 'View this page in English')
  assert.equal(await banner.locator('a').getAttribute('href'), '/en/')

  await banner.locator('a').click()
  await tab.waitForSelector('html[lang="en"]')
  assert.equal(await tab.locator('h1').innerText(), lpCopies.en.heroTitle)
  assert.equal(new URL(tab.url()).pathname, '/en/')
  assert.equal(await banner.count(), 0)

  // 選んだ言語は覚えていて、次に / を開いても英語になり、帯も出ない
  await tab.goto(`${baseUrl}/`)
  await tab.waitForSelector('html[lang="en"]')
  assert.equal(new URL(tab.url()).pathname, '/en/')
  assert.equal(await tab.locator('.locale-suggestion').count(), 0)
  assert.deepEqual(failures, [])
  await context.close()
})

test('帯を × でとじると、いまの言語を選んだものとして次から出さない', async () => {
  const { context, tab } = await openTab('ja-JP')
  await tab.goto(`${baseUrl}/en/qa/`)
  const banner = tab.locator('.locale-suggestion')
  await banner.waitFor()
  assert.equal(await banner.locator('a').innerText(), '日本語で見る')
  await banner.locator('button').click()
  assert.equal(await banner.count(), 0)
  assert.equal(await tab.evaluate(() => document.documentElement.lang), 'en')

  await tab.goto(`${baseUrl}/en/tip/`)
  await tab.waitForSelector('[data-locale="en"][aria-pressed="true"]')
  await tab.waitForTimeout(300)
  assert.equal(await tab.locator('.locale-suggestion').count(), 0)
  await context.close()
})

test('日本語の端末で日本語のページを開いたときは帯を出さない', async () => {
  const { context, tab } = await openTab('ja-JP')
  await tab.goto(`${baseUrl}/`)
  await tab.waitForSelector('[data-locale="ja"][aria-pressed="true"]')
  await tab.waitForTimeout(300)
  assert.equal(await tab.locator('.locale-suggestion').count(), 0)
  await context.close()
})

test('/en/ で日本語のボタンを押すと、本文も画面の画像も日本語に戻る', async () => {
  const { context, tab } = await openTab('en-US')
  await tab.goto(`${baseUrl}/en/`)
  await tab.waitForSelector('[data-locale="en"][aria-pressed="true"]')
  await tab.click('[data-locale="ja"]')
  await tab.waitForSelector('html[lang="ja"]')
  assert.equal(await tab.locator('h1').innerText(), lpCopies.ja.heroTitle)
  assert.equal(new URL(tab.url()).pathname, '/')
  const sources = await tab.evaluate(() =>
    [...document.querySelectorAll('[data-locale-screenshot], [data-locale-badge]')].map((image) => new URL(image.src).pathname),
  )
  assert.deepEqual([...sources].sort(), [
    ...['home', 'week', 'month', 'shop'].map((name) => `/assets/lp/screen-${name}.png`),
    '/assets/badges/app-store-ja.svg',
    '/assets/badges/google-play-ja.svg',
  ].sort())
  await context.close()
})

for (const locale of ['en', 'ko', 'zh-TW']) {
  test(`/${locale}/contact/ を直接開いても、アプリの情報が出て送信できる`, async () => {
    const { context, tab, failures } = await openTab(`${locale}-XX`)
    const sent = []
    // 本番の受付へは送らず、ここで受けて中身だけ確かめる
    await tab.route('https://api.c-cya.com/contact', async (route) => {
      sent.push(JSON.parse(route.request().postData()))
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })
    await tab.goto(`${baseUrl}/${locale}/contact/?platform=ios&appVersion=2.5.1`)
    await tab.locator('#nk-app-context').waitFor()
    assert.equal(await tab.locator('#nk-app-version').innerText(), '2.5.1')
    await tab.fill('input[name="name"]', 'テスト')
    await tab.fill('textarea[name="message"]', 'テストです')
    await tab.click('#nk-send')
    await tab.locator('#nk-done').waitFor()
    assert.equal(sent.length, 1)
    assert.match(sent[0].message, /2\.5\.1/u)
    assert.deepEqual(failures, [])
    await context.close()
  })
}

test('アプリから開いたお問い合わせは、言語を切りかえてもアプリの情報を手放さない', async () => {
  const { context, tab } = await openTab('ko-KR')
  await tab.goto(`${baseUrl}/contact/?platform=ios&appVersion=2.5.1`)
  const banner = tab.locator('.locale-suggestion')
  await banner.waitFor()
  await banner.locator('a').click()
  await tab.waitForSelector('html[lang="ko"]')
  const url = new URL(tab.url())
  assert.equal(url.pathname, '/ko/contact/')
  assert.equal(url.searchParams.get('platform'), 'ios')
  assert.equal(url.searchParams.get('appVersion'), '2.5.1')
  assert.equal(await tab.locator('h1').innerText(), contactCopies.ko.heading)
  await context.close()
})
