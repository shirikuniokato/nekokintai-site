import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  applyLocale,
  bindLocaleSwitcher,
  localizedImageSources,
  resolveLocalesUrl,
  warmLocalizedImages,
} from '../../assets/lp/i18n.mjs'

const copies = JSON.parse(readFileSync(new URL('../../assets/lp/locales.json', import.meta.url), 'utf8'))

function createElement(dataset) {
  return {
    dataset,
    textContent: '',
    alt: '',
    attributes: new Map(),
    listeners: new Map(),
    getAttribute(name) {
      return this.attributes.get(name) ?? null
    },
    setAttribute(name, value) {
      this.attributes.set(name, value)
    },
    addEventListener(type, listener) {
      this.listeners.set(type, listener)
    },
    click() {
      this.listeners.get('click')?.()
    },
  }
}

function createPage() {
  const body = createElement({ i18n: 'heroTitle' })
  const image = createElement({ i18nAlt: 'weekScreenAlt' })
  const navigation = createElement({ i18nAriaLabel: 'languageSelector' })
  const description = createElement({ i18nContent: 'documentDescription' })
  const screenshots = ['home', 'week', 'month', 'shop'].map((name) => {
    const screenshot = createElement({ localeScreenshot: name })
    screenshot.setAttribute('src', `assets/lp/screen-${name}.png`)
    return screenshot
  })
  const appStoreBadge = createElement({ localeBadge: 'app-store' })
  appStoreBadge.setAttribute('src', '/assets/badges/app-store-ja.svg')
  const playBadge = createElement({ localeBadge: 'google-play' })
  playBadge.setAttribute('src', '/assets/badges/google-play-ja.svg')
  const buttons = ['ja', 'en', 'ko', 'zh-TW'].map((locale) => createElement({ locale }))

  globalThis.document = {
    documentElement: { lang: 'ja' },
    title: '',
    querySelectorAll(selector) {
      return {
        '[data-i18n]': [body],
        '[data-i18n-alt]': [image],
        '[data-i18n-aria-label]': [navigation],
        '[data-i18n-content]': [description],
        '[data-locale-screenshot]': screenshots,
        '[data-locale-badge]': [appStoreBadge, playBadge],
        '[data-locale]': buttons,
      }[selector] ?? []
    },
  }

  return { body, image, navigation, description, screenshots, appStoreBadge, playBadge, buttons }
}

test('翻訳リソースを本文、代替文、メタ情報、操作状態へ反映する', () => {
  const page = createPage()

  applyLocale('zh-TW', copies)

  assert.equal(document.documentElement.lang, 'zh-TW')
  assert.equal(document.title, copies['zh-TW'].documentTitle)
  assert.equal(page.body.textContent, copies['zh-TW'].heroTitle)
  assert.equal(page.image.alt, copies['zh-TW'].weekScreenAlt)
  assert.equal(page.navigation.attributes.get('aria-label'), copies['zh-TW'].languageSelector)
  assert.equal(page.description.attributes.get('content'), copies['zh-TW'].documentDescription)
  assert.equal(page.screenshots[0].attributes.get('src'), '/assets/lp/screenshots/zh-TW/screen-home.png')
  assert.equal(page.appStoreBadge.attributes.get('src'), '/assets/badges/app-store-zh-TW.svg')
  assert.equal(page.playBadge.attributes.get('src'), '/assets/badges/google-play-zh-TW.png')
  assert.equal(page.buttons[3].attributes.get('aria-pressed'), 'true')
  assert.equal(page.buttons[0].attributes.get('aria-pressed'), 'false')

  delete globalThis.document
})

test('言語ボタンのクリックで4枚の画面と2つのバッジが本文と同時に切り替わる', () => {
  const page = createPage()
  const selected = []
  applyLocale('ja', copies)
  bindLocaleSwitcher(page.buttons, copies, (locale) => selected.push(locale))

  page.buttons[1].click()

  assert.equal(document.documentElement.lang, 'en')
  assert.equal(page.body.textContent, copies.en.heroTitle)
  assert.deepEqual(
    page.screenshots.map((screenshot) => screenshot.attributes.get('src')),
    ['home', 'week', 'month', 'shop'].map((name) => `/assets/lp/screenshots/en/screen-${name}.png`),
  )
  assert.equal(page.appStoreBadge.attributes.get('src'), '/assets/badges/app-store-en.svg')
  assert.equal(page.playBadge.attributes.get('src'), '/assets/badges/google-play-en.png')
  assert.equal(page.buttons[1].attributes.get('aria-pressed'), 'true')
  assert.deepEqual(selected, ['en'])

  page.buttons[2].click()
  assert.equal(page.screenshots[1].attributes.get('src'), '/assets/lp/screenshots/ko/screen-week.png')
  assert.equal(page.playBadge.attributes.get('src'), '/assets/badges/google-play-ko.png')

  page.buttons[0].click()
  assert.equal(document.documentElement.lang, 'ja')
  assert.equal(page.screenshots[1].attributes.get('src'), 'assets/lp/screen-week.png')
  assert.equal(page.appStoreBadge.attributes.get('src'), '/assets/badges/app-store-ja.svg')
  assert.equal(page.playBadge.attributes.get('src'), '/assets/badges/google-play-ja.svg')
  assert.deepEqual(selected, ['en', 'ko', 'ja'])

  delete globalThis.document
})

test('対応外の言語を持つボタンは何も変えない', () => {
  const page = createPage()
  applyLocale('ja', copies)
  const rogue = createElement({ locale: 'fr' })
  bindLocaleSwitcher([rogue], copies, () => assert.fail('対応外の言語で後処理が呼ばれた'))

  rogue.click()

  assert.equal(document.documentElement.lang, 'ja')
  assert.equal(page.screenshots[0].attributes.get('src'), 'assets/lp/screen-home.png')

  delete globalThis.document
})

test('表示中でない言語の画面とバッジを先読みする', () => {
  const created = []
  const createImage = () => {
    const image = {}
    created.push(image)
    return image
  }
  const defaults = ['assets/lp/screen-home.png', '/assets/badges/google-play-ja.svg']

  const sources = warmLocalizedImages('en', createImage, defaults)

  assert.deepEqual(sources, [...defaults, ...localizedImageSources('ko'), ...localizedImageSources('zh-TW')])
  assert.equal(created.length, 14)
  assert.equal(created[2].src, '/assets/lp/screenshots/ko/screen-home.png')
  assert.equal(created[2].fetchPriority, 'low')
  assert.equal(created[13].src, '/assets/badges/google-play-zh-TW.png')

  // 日本語で開いたときは既定の画像が表示中なので、他の3言語ぶんだけ温める
  assert.equal(warmLocalizedImages('ja', createImage, defaults).length, 18)
  assert.deepEqual(localizedImageSources('ja'), [])
})

test('辞書にないキーは HTML の日本語を残し、placeholder も差し替える', () => {
  const page = createPage()
  const untranslated = createElement({ i18n: 'brandNewKey' })
  untranslated.textContent = 'まだ訳していない文'
  const input = createElement({ i18nPlaceholder: 'heroLead' })
  input.setAttribute('placeholder', 'はたらいた時間を、きろくするにゃ。')
  const original = document.querySelectorAll
  document.querySelectorAll = (selector) => {
    if (selector === '[data-i18n]') return [page.body, untranslated]
    if (selector === '[data-i18n-placeholder]') return [input]
    return original(selector)
  }

  applyLocale('en', copies)

  assert.equal(page.body.textContent, copies.en.heroTitle)
  assert.equal(untranslated.textContent, 'まだ訳していない文')
  assert.equal(input.attributes.get('placeholder'), copies.en.heroLead)

  delete globalThis.document
})

test('ページが宣言した辞書を読み、宣言がなければトップLPの辞書を読む', () => {
  assert.equal(resolveLocalesUrl({}), '/assets/lp/locales.json')
  assert.equal(resolveLocalesUrl(undefined), '/assets/lp/locales.json')
  assert.equal(resolveLocalesUrl({ i18nSource: '' }), '/assets/lp/locales.json')
  assert.equal(resolveLocalesUrl({ i18nSource: '/assets/qa/locales.json' }), '/assets/qa/locales.json')
})
