import { checkCatName, normalizeCatName } from '../vendor/cat-name.mjs'

const WORD_CHARACTER = /[\p{L}\p{N}_]/u
const LATIN_WORD_CHARACTER = /[\p{Script=Latin}\p{N}_]/u
const LOCALES = ['ja', 'en', 'ko', 'zh-TW']

const EVERY_CHARACTER = () => true

// そろえかた（NFKC・制御文字）・数えかた（UTF-16 で 12）・URL・描ける字は、アプリの src/shared/catName.ts が正本（#262）。
// 描ける字の一覧を渡さないときは、その検査だけを省く。
export function normalizePublicName(value = '', isDrawable = EVERY_CHARACTER) {
  const checked = checkCatName(value, isDrawable)
  return checked.ok ? { ok: true, value: checked.value } : { ok: false, reason: checked.reason }
}

export function compileNameRules(rules) {
  assertLanguageCoverage(rules)
  return rules.map((rule) => {
    const modes = ['whole', 'word', 'substring']
    if (!LOCALES.includes(rule.locale) || typeof rule.term !== 'string' || !modes.includes(rule.mode)) {
      throw new Error('公開名の辞書の形式が正しくありません')
    }
    const term = foldForMatch(rule.term)
    if (!term) throw new Error('公開名の辞書に空の語は使えません')
    return { locale: rule.locale, term, mode: rule.mode }
  })
}

function foldForMatch(value) {
  return normalizeCatName(value).toLowerCase()
}

function hasWord(text, term) {
  // 英語の禁止語にかな等を付けるだけで、単語境界の検査をすり抜けさせない。
  const boundary = /^[\p{Script=Latin}\p{N}_]+$/u.test(term) ? LATIN_WORD_CHARACTER : WORD_CHARACTER
  for (let offset = text.indexOf(term); offset !== -1; offset = text.indexOf(term, offset + 1)) {
    const before = Array.from(text.slice(0, offset)).at(-1) ?? ''
    const after = Array.from(text.slice(offset + term.length))[0] ?? ''
    if (!boundary.test(before) && !boundary.test(after)) return true
  }
  return false
}

function assertLanguageCoverage(rules) {
  if (!Array.isArray(rules) || !LOCALES.every((locale) => rules.some((rule) => rule?.locale === locale))) {
    throw new Error('公開名の辞書には4言語の確認済みルールが必要です')
  }
}

export function validatePublicNames(input, rules, isDrawable = EVERY_CHARACTER) {
  assertLanguageCoverage(rules)
  const name = normalizePublicName(input.name, isDrawable)
  const author = normalizePublicName(input.author, isDrawable)
  if (!name.ok) return { ...name, field: 'name' }
  if (!author.ok) return { ...author, field: 'author' }
  for (const [field, value] of [['name', name.value], ['author', author.value]]) {
    const text = foldForMatch(value)
    const rejected = rules.some(({ term, mode }) => mode === 'whole' ? text === term
      : mode === 'word' ? hasWord(text, term) : text.includes(term))
    if (rejected) return { ok: false, reason: 'blocked', field }
  }
  return { ok: true, name: name.value, author: author.value }
}
