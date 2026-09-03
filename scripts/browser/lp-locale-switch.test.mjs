// 実ブラウザで LP の言語ボタンをクリックし、本文・4枚のアプリ画面・2つのストアバッジが同時に切り替わることを確かめる。
//   npm run test:browser
// 静的サーバーをこのプロセス内で立て、Playwright の Chromium で ja → en → ko → zh-TW → ja の順にクリックする。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile as readFileAsync } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, normalize, resolve, sep } from 'node:path'
import test, { after, before } from 'node:test'
import { chromium } from 'playwright'
import { measureBadgePadding } from '../lib/lp-badge-padding.mjs'

const siteRoot = resolve(import.meta.dirname, '../..')
const copies = JSON.parse(readFileSync(resolve(siteRoot, 'assets/lp/locales.json'), 'utf8'))
const CLICK_ORDER = ['en', 'ko', 'zh-TW', 'ja']
const SCREENSHOTS = ['home', 'week', 'month', 'shop']
const SCREENSHOT_SIZE = { width: 720, height: 1205 }
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

function svgNaturalWidth(locale) {
  const svg = readFileSync(resolve(siteRoot, `assets/badges/app-store-${locale}.svg`), 'utf8')
  return Number(svg.match(/\bwidth="([\d.]+)"/u)[1])
}

function playBadgeNaturalSize(locale) {
  if (locale === 'ja') return { naturalWidth: 180, naturalHeight: 53 }
  const padding = measureBadgePadding(readFileSync(resolve(siteRoot, `assets/badges/google-play-${locale}.png`)))
  return { naturalWidth: padding.width, naturalHeight: padding.height }
}

function playBadgeFilePadding(locale) {
  return measureBadgePadding(readFileSync(resolve(siteRoot, `assets/badges/google-play-${locale}.png`)))
}

function expectedScreenshotPath(locale, name) {
  return locale === 'ja' ? `/assets/lp/screen-${name}.png` : `/assets/lp/screenshots/${locale}/screen-${name}.png`
}

function expectedBadgePath(locale, badge) {
  if (locale === 'ja') return `/assets/badges/${badge}-ja.svg`
  return badge === 'app-store' ? `/assets/badges/app-store-${locale}.svg` : `/assets/badges/google-play-${locale}.png`
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

/**
 * 表示中の画像を読み込み完了まで待ってから、src・原寸・描画位置・縮小サムネイルの指紋を取る。
 * バッジは原寸で描いて不透明部分の範囲も測り、SVG / PNG を問わず「本体」の位置と大きさをブラウザ側で確かめる。
 */
async function readImages(page) {
  return page.evaluate(async () => {
    const ALPHA_THRESHOLD = 16
    const opaqueBounds = (image) => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let minX = canvas.width
      let minY = canvas.height
      let maxX = -1
      let maxY = -1
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (data[(y * canvas.width + x) * 4 + 3] < ALPHA_THRESHOLD) continue
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
      return {
        top: minY,
        left: minX,
        right: canvas.width - 1 - maxX,
        bottom: canvas.height - 1 - maxY,
        visibleWidth: maxX - minX + 1,
        visibleHeight: maxY - minY + 1,
      }
    }
    const images = [...document.querySelectorAll('[data-locale-screenshot], [data-locale-badge]')]
    return Promise.all(
      images.map(async (image) => {
        await image.decode()
        const rect = image.getBoundingClientRect()
        const canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 24
        canvas.getContext('2d').drawImage(image, 0, 0, 24, 24)
        return {
          key: image.dataset.localeScreenshot ?? image.dataset.localeBadge,
          currentSrc: new URL(image.currentSrc).pathname,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          rect: { left: rect.left, right: rect.right, top: rect.top, height: rect.height, width: rect.width },
          fingerprint: canvas.toDataURL(),
          padding: image.dataset.localeBadge ? opaqueBounds(image) : null,
        }
      }),
    )
  })
}

function byKey(images) {
  return Object.fromEntries(images.map((image) => [image.key, image]))
}

/** 描画枠のうち不透明な本体が占める高さと左端。ブラウザで測った余白から求めるので、SVG でも PNG でも同じ式になる。 */
function badgeBody(image) {
  const { rect, padding, naturalWidth, naturalHeight } = image
  return {
    height: rect.height * (padding.visibleHeight / naturalHeight),
    left: rect.left + rect.width * (padding.left / naturalWidth),
    right: rect.right - rect.width * (padding.right / naturalWidth),
  }
}

function badgeBodyMetrics(images) {
  const appStore = badgeBody(images['app-store'])
  const play = badgeBody(images['google-play'])
  return { appStoreHeight: appStore.height, playBodyHeight: play.height, gap: play.left - appStore.right }
}

function assertLocaleImages(images, locale, jaImages) {
  for (const name of SCREENSHOTS) {
    const image = images[name]
    assert.equal(image.currentSrc, expectedScreenshotPath(locale, name), `${locale}/${name}: src`)
    assert.equal(image.naturalWidth, SCREENSHOT_SIZE.width, `${locale}/${name}: naturalWidth`)
    assert.equal(image.naturalHeight, SCREENSHOT_SIZE.height, `${locale}/${name}: naturalHeight`)
    if (locale !== 'ja') {
      // 4枚とも 720×1205 なので寸法では差し替えを証明できない。画素の指紋で日本語と別の画像になったことを見る
      assert.notEqual(image.fingerprint, jaImages[name].fingerprint, `${locale}/${name}: 画像が日本語のまま`)
    }
  }

  const appStore = images['app-store']
  assert.equal(appStore.currentSrc, expectedBadgePath(locale, 'app-store'))
  assert.ok(Math.abs(appStore.naturalWidth - svgNaturalWidth(locale)) <= 1, `${locale}: App Store naturalWidth ${appStore.naturalWidth}`)
  assert.equal(appStore.naturalHeight, 40, `${locale}: App Store naturalHeight`)

  const play = images['google-play']
  const naturalSize = playBadgeNaturalSize(locale)
  assert.equal(play.currentSrc, expectedBadgePath(locale, 'google-play'))
  assert.equal(play.naturalWidth, naturalSize.naturalWidth, `${locale}: Google Play naturalWidth`)
  assert.ok(Math.abs(play.naturalHeight - naturalSize.naturalHeight) <= 1, `${locale}: Google Play naturalHeight ${play.naturalHeight}`)

  if (locale === 'ja') {
    // 日本語の SVG 2枚は余白なし。ここが崩れると他の言語をそろえる基準そのものがずれる
    for (const badge of ['app-store', 'google-play']) {
      const { padding } = images[badge]
      assert.deepEqual([padding.top, padding.right, padding.bottom, padding.left], [0, 0, 0, 0], `ja ${badge}: SVG に余白がある`)
    }
    return
  }
  // ブラウザで測った PNG の余白は、index.html の係数の元になった Node 側の実測と一致する
  const filePadding = playBadgeFilePadding(locale)
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert.equal(play.padding[side], filePadding[side], `${locale}: Google Play PNG の ${side} 余白がファイル実測と違う`)
  }
}

function assertBadgeParity(images, locale, jaImages) {
  const metrics = badgeBodyMetrics(images)
  const jaMetrics = badgeBodyMetrics(jaImages)
  assert.ok(
    Math.abs(metrics.playBodyHeight - metrics.appStoreHeight) <= 1,
    `${locale}: Google Play 本体の高さ ${metrics.playBodyHeight.toFixed(2)} が App Store ${metrics.appStoreHeight.toFixed(2)} と違う`,
  )
  assert.ok(
    Math.abs(metrics.appStoreHeight - jaMetrics.appStoreHeight) <= 1,
    `${locale}: App Store バッジの高さが日本語と違う`,
  )
  assert.ok(
    Math.abs(metrics.gap - jaMetrics.gap) <= 1,
    `${locale}: バッジの間隔 ${metrics.gap.toFixed(2)} が日本語 ${jaMetrics.gap.toFixed(2)} と違う`,
  )
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

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`言語ボタンのクリックで本文・4枚の画面・2つのバッジが同時に切り替わる（${viewport.width}px）`, async () => {
    const page = await browser.newPage({ viewport, locale: 'ja-JP' })
    const failures = []
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text())
    })

    await page.goto(`${baseUrl}/`)
    await page.waitForSelector('[data-locale="ja"][aria-pressed="true"]')
    await page.waitForFunction((title) => document.title === title, copies.ja.documentTitle)
    const jaImages = byKey(await readImages(page))
    assertLocaleImages(jaImages, 'ja', jaImages)
    assert.equal(await page.locator('h1').innerText(), copies.ja.heroTitle)

    for (const locale of CLICK_ORDER) {
      await page.click(`[data-locale="${locale}"]`)
      await page.waitForSelector(`html[lang="${locale}"]`)
      await page.waitForSelector(`[data-locale="${locale}"][aria-pressed="true"]`)

      const images = byKey(await readImages(page))
      assertLocaleImages(images, locale, jaImages)
      assertBadgeParity(images, locale, jaImages)
      // Google Play は日本のみ配信中。日本語以外では「準備中」を出し、リンクを外す。バッジの画像そのものは変えない
      // App Store は言語に合わせた国のストアフロントへ
      const appStoreHref = await page.locator('[data-store="app-store"]').getAttribute('href')
      assert.equal(appStoreHref, `https://apps.apple.com/${{ ja: 'jp', en: 'us', ko: 'kr', 'zh-TW': 'tw' }[locale]}/app/id6801066427`, `${locale}: App Store のリンク`)
      const play = await page.evaluate(() => {
        const anchor = document.querySelector('[data-store="google-play"]')
        const chip = document.querySelector('.store-soon')
        const note = document.querySelector('.store-note')
        return {
          href: anchor.getAttribute('href'),
          disabled: anchor.getAttribute('aria-disabled'),
          chipVisible: getComputedStyle(chip).display !== 'none',
          noteVisible: getComputedStyle(note).display !== 'none',
          chipText: chip.textContent,
          noteText: note.textContent,
        }
      })
      if (locale === 'ja') {
        assert.match(play.href ?? '', /^https:\/\/play\.google\.com\//u, 'ja: Google Play のリンクが戻っていない')
        assert.equal(play.disabled, null, 'ja: aria-disabled が残っている')
        assert.equal(play.chipVisible, false, 'ja: 準備中が出ている')
        assert.equal(play.noteVisible, false, 'ja: 準備中の注が出ている')
      } else {
        assert.equal(play.href, null, `${locale}: Google Play のリンクが外れていない`)
        assert.equal(play.disabled, 'true', `${locale}: aria-disabled がない`)
        assert.equal(play.chipVisible, true, `${locale}: 準備中が出ていない`)
        assert.equal(play.chipText, copies[locale].playStoreSoonChip, `${locale}: 準備中の文言`)
        assert.equal(play.noteVisible, true, `${locale}: 準備中の注が出ていない`)
        assert.equal(play.noteText, copies[locale].playStoreSoonNote, `${locale}: 準備中の注の文言`)
      }
      assert.equal(await page.locator('h1').innerText(), copies[locale].heroTitle, `${locale}: h1`)
      assert.equal(await page.title(), copies[locale].documentTitle, `${locale}: title`)
      assert.equal(new URL(page.url()).searchParams.get('lang'), locale === 'ja' ? null : locale, `${locale}: ?lang=`)
    }

    // 最後の日本語クリックで、HTML に書かれた既定の画像へ戻っている
    const restored = byKey(await readImages(page))
    for (const key of Object.keys(jaImages)) {
      assert.equal(restored[key].currentSrc, jaImages[key].currentSrc, `${key}: 日本語へ戻っていない`)
    }
    assert.deepEqual(failures, [], 'ブラウザでエラーが出た')
    await page.close()
  })
}
