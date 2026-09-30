// 実ブラウザで「よくあるしつもん」の絞りこみを確かめる。
// 当たったしつもんだけが残ってひらくこと、0件のときに案内が出ること、言語を変えても効くこと。
//   npm run test:browser
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile as readFileAsync } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, normalize, resolve, sep } from 'node:path'
import test, { after, before } from 'node:test'
import { chromium } from 'playwright'

const siteRoot = resolve(import.meta.dirname, '../..')
const copies = JSON.parse(readFileSync(resolve(siteRoot, 'assets/qa/locales.json'), 'utf8'))
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

/** いま画面に出ているしつもんの見出し。 */
async function visibleQuestions(tab) {
  return tab.$$eval('main details:not([hidden]) .qa-q', (nodes) => nodes.map((node) => node.textContent.trim()))
}

/** いま画面に出ているしつもんの、こたえと補足までふくむ全文。絞りこみは本文も見る。 */
async function visibleItemTexts(tab) {
  return tab.$$eval('main details:not([hidden])', (nodes) => nodes.map((node) => node.textContent))
}

test('ことばを入れると、当たったしつもんだけが残ってひらく', async () => {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })
  const failures = []
  tab.on('pageerror', (error) => failures.push(error.message))
  tab.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text())
  })

  await tab.goto(`${baseUrl}/qa/`)
  await tab.waitForSelector('.qa-search:not([hidden])')
  const all = await visibleQuestions(tab)
  assert.ok(all.length > 20, `絞りこむ前は全部出ている（${all.length}件）`)

  await tab.fill('#qa-search-input', 'ウィジェット')
  const hits = await visibleQuestions(tab)
  assert.ok(hits.length > 0, '当たったしつもんがある')
  assert.ok(hits.length < all.length, '絞りこまれている')
  // 見出しだけでなく、こたえの本文にふくむものも当たる（「打刻」「電池」で引く人がいるため）
  assert.ok(
    (await visibleItemTexts(tab)).every((body) => body.includes('ウィジェット')),
    `当たったのは本文にふくむものだけ: ${hits.join(' / ')}`,
  )
  assert.equal(await tab.locator('main details:not([hidden])').first().evaluate((node) => node.open), true, '当たったしつもんはひらく')
  assert.equal(await tab.locator('.qa-search-empty').isVisible(), false, '0件の案内は出ていない')

  // ひらがなでも当たる（カタカナに寄せている）
  await tab.fill('#qa-search-input', 'うぃじぇっと')
  assert.deepEqual(await visibleQuestions(tab), hits, 'ひらがなでも同じものが当たる')

  assert.deepEqual(failures, [], 'ページのエラー')
  await tab.close()
})

test('当たらないときは案内が出て、けすと元に戻る', async () => {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })
  await tab.goto(`${baseUrl}/qa/`)
  await tab.waitForSelector('.qa-search:not([hidden])')
  const all = await visibleQuestions(tab)

  await tab.fill('#qa-search-input', 'ぜったいにないことば')
  assert.deepEqual(await visibleQuestions(tab), [], '当たらない')
  assert.equal(await tab.locator('.qa-search-empty').isVisible(), true, '0件の案内が出る')
  assert.equal((await tab.locator('.qa-search-empty').textContent()).trim(), copies.ja.searchEmpty, '0件の文言')

  await tab.click('.qa-search-clear')
  assert.deepEqual(await visibleQuestions(tab), all, 'けすと全部もどる')
  assert.equal(await tab.locator('.qa-search-empty').isVisible(), false, '0件の案内は消える')
  assert.equal(await tab.locator('main details').first().evaluate((node) => node.open), false, 'けすと開きっぱなしにしない')
  await tab.close()
})

test('言語を変えても、その言語の文字で絞りこめる', async () => {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })
  await tab.goto(`${baseUrl}/qa/`)
  await tab.waitForSelector('.qa-search:not([hidden])')

  await tab.click('[data-locale="en"]')
  await tab.waitForSelector('html[lang="en"]')
  assert.equal(
    await tab.locator('#qa-search-input').getAttribute('placeholder'),
    copies.en.searchPlaceholder,
    '入力欄の案内も英語になる',
  )

  await tab.fill('#qa-search-input', 'widget')
  const hits = await visibleQuestions(tab)
  assert.ok(hits.length > 0, '英語でも当たる')
  assert.ok(
    (await visibleItemTexts(tab)).every((body) => body.toLowerCase().includes('widget')),
    `当たったのは本文にふくむものだけ: ${hits.join(' / ')}`,
  )
  await tab.close()
})
