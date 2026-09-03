// 初稿（Gemini）に、採用した監査の指摘と手直しを重ねて、ページの辞書へ書き出す。
// 何を採用したかは docs/lp-i18n-eval/YYYY-MM-DD/<page>-adopted.json に残し、この script はそれを機械的に適用するだけ。
//   node scripts/apply-lp-i18n-draft.mjs --page tip docs/lp-i18n-eval/2026-09-04/tip-adopted.json
//
// adopted.json の形:
//   { "draft": "tip-gemini-initial.json",
//     "audits": { "claude-fable": "tip-audit-claude-fable.json", "gpt": "tip-audit-gpt.json" },
//     "adopt": [ { "locale": "ko", "key": "note2", "from": "gpt" } ],
//     "manual": [ { "locale": "en", "key": "note4", "text": "..." } ],
//     "replace": [ { "locale": "en", "from": "\"Edit Time\"", "to": "\"Edit time\"" } ] }
// replace は全キーに対する文字列の置換。画面名・ボタン名をアプリの実際の文言にそろえるために使う（上から順に適用）。
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { I18N_PAGES, applySharedTranslations, splitPageOption } from './lib/lp-i18n-pages.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const localeField = { en: 'en', ko: 'ko', 'zh-TW': 'zhTW' }

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function assertSameNewlines(source, text, label) {
  if (source.split('\n').length !== text.split('\n').length) {
    throw new Error(`${label}: newline count differs from Japanese source`)
  }
}

async function main() {
  const { page, rest } = splitPageOption(process.argv.slice(2))
  const [adoptedPathArgument] = rest
  if (!adoptedPathArgument) throw new Error('Usage: apply-lp-i18n-draft.mjs [--page lp|tip|qa] <adopted.json>')

  const adoptedPath = resolve(projectRoot, adoptedPathArgument)
  const evaluationDirectory = dirname(adoptedPath)
  const adopted = await readJson(adoptedPath)
  const localesPath = resolve(projectRoot, I18N_PAGES[page].locales)
  const locales = await readJson(localesPath)
  const lpLocales = await readJson(resolve(projectRoot, I18N_PAGES.lp.locales))
  const draft = await readJson(resolve(evaluationDirectory, adopted.draft))
  const audits = Object.fromEntries(
    await Promise.all(Object.entries(adopted.audits ?? {}).map(async ([name, file]) => [name, await readJson(resolve(evaluationDirectory, file))])),
  )

  const sourceKeys = Object.keys(locales.ja)
  const draftByKey = new Map(draft.translations.map((translation) => [translation.key, translation]))
  const missing = sourceKeys.filter((key) => !draftByKey.has(key))
  if (missing.length > 0) throw new Error(`Draft is missing keys: ${missing.join(', ')}`)

  const updated = { ja: locales.ja }
  for (const [locale, field] of Object.entries(localeField)) {
    updated[locale] = Object.fromEntries(sourceKeys.map((key) => [key, draftByKey.get(key)[field]]))
  }

  for (const { locale, key, from } of adopted.adopt ?? []) {
    const audit = audits[from]
    if (!audit) throw new Error(`Unknown audit: ${from}`)
    const issue = audit.issues.find((candidate) => candidate.locale === locale && candidate.key === key)
    if (!issue) throw new Error(`Missing audit issue: ${from} ${locale}/${key}`)
    updated[locale][key] = issue.replacement
  }
  for (const { locale, key, text } of adopted.manual ?? []) {
    if (!(key in locales.ja)) throw new Error(`Unknown key for manual fix: ${key}`)
    updated[locale][key] = text
  }
  let replacedCount = 0
  for (const { locale, from, to } of adopted.replace ?? []) {
    if (!(locale in updated)) throw new Error(`Unknown locale for replace: ${locale}`)
    for (const key of sourceKeys) {
      if (!updated[locale][key].includes(from)) continue
      updated[locale][key] = updated[locale][key].replaceAll(from, to)
      replacedCount += 1
    }
  }

  const merged = applySharedTranslations(page, updated, lpLocales)
  for (const locale of Object.keys(localeField)) {
    for (const key of sourceKeys) assertSameNewlines(locales.ja[key], merged[locale][key], `${locale}/${key}`)
  }

  await writeFile(localesPath, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`${page}: ${sourceKeys.length} keys × 3 locales written to ${I18N_PAGES[page].locales}（採用 ${adopted.adopt?.length ?? 0} 件、手直し ${adopted.manual?.length ?? 0} 件、用語置換 ${replacedCount} 箇所）`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
