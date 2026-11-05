import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { I18N_PAGES, SHARED_KEYS } from './lib/lp-i18n-pages.mjs'
import { GOOD_JOB_SAVINGS, TRANSLATED_LOCALES } from './lib/lp-i18n-locales.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const translatedLocales = TRANSLATED_LOCALES
const requiredTerms = GOOD_JOB_SAVINGS
const forbiddenTerms = {
  en: /(?:Hard Work Savings|Effort Savings|Bonus Bank)/u,
  ko: /(?:열심 저금|노력 저금)/u,
  'zh-TW': /(?:努力撲滿|努力存款|列表|點擊|應援)/u,
  // 台湾寄りの語、日本語の中黒、通貨記号（簡体字では「日元」と書く）
  'zh-Hans': /(?:努力存钱罐|辛苦存钱罐|喔|啰|囉|依照|作業|程式|資料|帳號|小舖|・|¥|円)/u,
}
// 簡体字の文に混じりやすい繁体字（よく出る字だけ。見つけたら字体の取りこぼし）
const TRADITIONAL_ONLY_CHARACTERS = /[設記錄時間這們麼為於與會說應檔體讓請選擇開關後點擊畫貓計劃顯資訊訂閱購買過還個來發經變數據務線網頁問題幫擔]/u
// 各言語に残ってよい日本語。ブランド名、そのまま出す固有名（構想中のアプリ名）、画面に実際に出た不具合の文字列
const allowedJapanese = ['くろねこ勤怠', 'ねこ勤怠', 'ｼﾁｬのねこ屋さん', 'ねここここ', '繁體中文', '简体中文']

function hasUnexpectedJapanese(locale, text) {
  const withoutBrand = allowedJapanese.reduce((rest, term) => rest.replaceAll(term, ''), text)
  if (locale.startsWith('zh')) return /[ぁ-んァ-ン]/u.test(withoutBrand)
  return /[ぁ-んァ-ン一-龯]/u.test(withoutBrand)
}

function hasTraditionalCharacters(locale, text) {
  if (locale !== 'zh-Hans') return false
  const withoutAllowed = allowedJapanese.reduce((rest, term) => rest.replaceAll(term, ''), text)
  return TRADITIONAL_ONLY_CHARACTERS.test(withoutAllowed)
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(projectRoot, path), 'utf8'))
}

/** HTML が使っている翻訳キー。data-i18n-source は辞書の場所なのでキーではない */
function htmlKeys(htmlPath) {
  const html = readFileSync(resolve(projectRoot, htmlPath), 'utf8')
  return [...html.matchAll(/\bdata-i18n(?:-(?:alt|aria-label|content|placeholder))?="([^"]+)"/gu)]
    .map(([, key]) => key)
    .sort()
}

function validateLocale(locales, locale, sourceKeys, { requireGoodJobSavings }) {
  const errors = []
  const copy = locales[locale]
  const translatedKeys = Object.keys(copy ?? {}).sort()
  if (JSON.stringify(sourceKeys) !== JSON.stringify(translatedKeys)) {
    errors.push('source and translated keys differ')
    return errors
  }

  for (const key of sourceKeys) {
    const source = locales.ja[key]
    const text = copy[key]
    if (typeof text !== 'string' || text.length === 0) errors.push(`${key}: empty translation`)
    if (typeof text === 'string' && source.split('\n').length !== text.split('\n').length) {
      errors.push(`${key}: newline count differs from Japanese source`)
    }
    if (typeof text === 'string' && hasUnexpectedJapanese(locale, text)) {
      errors.push(`${key}: unexpected Japanese text`)
    }
    if (typeof text === 'string' && hasTraditionalCharacters(locale, text)) {
      errors.push(`${key}: traditional Chinese character in Simplified Chinese text`)
    }
    if (typeof text === 'string' && forbiddenTerms[locale].test(text)) {
      errors.push(`${key}: forbidden term`)
    }
    if (locale === 'ko' && typeof text === 'string' && /(?:은\(는\)|이\(가\)|을\(를\)|와\(과\)|「|」)/u.test(text)) {
      errors.push(`${key}: unsafe Korean particle or punctuation`)
    }
  }

  if (requireGoodJobSavings && copy.goodJobSavings !== requiredTerms[locale]) {
    errors.push(`goodJobSavings: expected ${JSON.stringify(requiredTerms[locale])}`)
  }
  return errors
}

/** トップLPで決めた訳と、ページ側の同じ意味のキーが一致するか */
function validateSharedKeys(pageName, locales, lpLocales) {
  const errors = []
  for (const [pageKey, lpKey] of Object.entries(SHARED_KEYS[pageName] ?? {})) {
    for (const locale of ['ja', ...translatedLocales]) {
      const expected = lpLocales[locale]?.[lpKey]
      const actual = locales[locale]?.[pageKey]
      if (actual !== expected) {
        errors.push(`${locale}: ${pageKey} must equal LP ${lpKey} ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    }
  }
  return errors
}

function checkPage(pageName, page, lpLocales) {
  const locales = readJson(page.locales)
  const sourceKeys = Object.keys(locales.ja).sort()
  const usedKeys = htmlKeys(page.html)
  const missingKeys = usedKeys.filter((key) => !sourceKeys.includes(key))
  const reservedKeys = page.reservedKeys ?? []
  const unusedKeys = sourceKeys.filter((key) => !usedKeys.includes(key) && !reservedKeys.includes(key))
  let errorCount = 0

  if (missingKeys.length > 0) {
    console.error(`${page.html}: unknown translation keys ${missingKeys.join(', ')}`)
    errorCount += missingKeys.length
  }
  if (unusedKeys.length > 0) {
    console.error(`${page.locales}: unused translation keys ${unusedKeys.join(', ')}`)
    errorCount += unusedKeys.length
  }

  for (const locale of translatedLocales) {
    const errors = validateLocale(locales, locale, sourceKeys, { requireGoodJobSavings: pageName === 'lp' })
    if (errors.length === 0) {
      console.log(`${pageName} ${locale}: ${sourceKeys.length}件、キー・用語検査に合格`)
      continue
    }
    for (const error of errors) console.error(`${pageName} ${locale}: ${error}`)
    errorCount += errors.length
  }

  const sharedErrors = validateSharedKeys(pageName, locales, lpLocales)
  for (const error of sharedErrors) console.error(`${pageName} shared: ${error}`)
  errorCount += sharedErrors.length
  return errorCount
}

const lpLocales = readJson(I18N_PAGES.lp.locales)
const requestedPages = process.argv.slice(2)
const pageNames = requestedPages.length > 0 ? requestedPages : Object.keys(I18N_PAGES)
let errorCount = 0
for (const pageName of pageNames) {
  const page = I18N_PAGES[pageName]
  if (!page) {
    console.error(`unknown page: ${pageName}`)
    errorCount += 1
    continue
  }
  errorCount += checkPage(pageName, page, lpLocales)
}

if (errorCount > 0) process.exitCode = 1
