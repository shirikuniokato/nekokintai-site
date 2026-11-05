// 翻訳する言語の一覧と、初稿 JSON でのフィールド名（'zh-TW' → zhTW のように、JSON のキーに使える形）。
// 翻訳・監査・逆翻訳・反映のスクリプトは、この表と --locales で対象の言語を決める。
// 省略時は全言語なので、--locales を付けない従来の呼びかたはそのまま動く。

export const TRANSLATED_LOCALES = ['en', 'ko', 'zh-TW', 'zh-Hans']

export const LOCALE_FIELDS = { en: 'en', ko: 'ko', 'zh-TW': 'zhTW', 'zh-Hans': 'zhHans' }

export const LOCALE_LABELS = {
  en: '英語',
  ko: '韓国語',
  'zh-TW': '台湾向け繁体字中国語',
  'zh-Hans': '中国本土向け簡体字中国語',
}

/** がんばった貯金の固定訳。アプリの実際のラベルと同じ */
export const GOOD_JOB_SAVINGS = {
  en: 'Good Job Savings',
  ko: '수고 저금',
  'zh-TW': '辛苦撲滿',
  'zh-Hans': '时间存钱罐',
}

export function localeField(locale) {
  const field = LOCALE_FIELDS[locale]
  if (!field) throw new Error(`Unknown locale: ${locale}`)
  return field
}

/**
 * argv から --locales <a,b>（または --locales=<a,b>）を取り出し、残りの引数と分けて返す。
 * 言語を 1 つだけ足すとき、公開ずみの他言語を初稿で上書きしないために使う
 */
export function splitLocalesOption(argv) {
  const rest = []
  let locales = TRANSLATED_LOCALES
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--locales') {
      locales = parseLocales(argv[index + 1])
      index += 1
      continue
    }
    if (argument.startsWith('--locales=')) {
      locales = parseLocales(argument.slice('--locales='.length))
      continue
    }
    rest.push(argument)
  }
  return { locales, rest }
}

function parseLocales(value) {
  const locales = (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  if (locales.length === 0) throw new Error('--locales needs at least one locale')
  for (const locale of locales) {
    if (!TRANSLATED_LOCALES.includes(locale)) {
      throw new Error(`Unknown locale: ${locale}. Use one of ${TRANSLATED_LOCALES.join(', ')}`)
    }
  }
  return locales
}
