import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const evaluationDirectory = resolve(projectRoot, 'docs/lp-i18n-eval/2026-09-01')
const localeField = { en: 'en', ko: 'ko', 'zh-TW': 'zhTW' }
const adoptedAuditFixes = new Map([
  ['en/goodJobSavingsDescription', 'audit-gpt.json'],
  ['en/catWalksDescription', 'audit-gpt.json'],
  ['en/heroSpeechLeft', 'audit-claude-fable.json'],
  ['ko/goodJobSavingsDescription', 'audit-gpt.json'],
  ['ko/catWalksDescription', 'audit-gpt.json'],
  ['zh-TW/documentTitle', 'audit-gpt.json'],
  ['zh-TW/documentDescription', 'audit-gpt.json'],
  ['zh-TW/ogDescription', 'audit-gpt.json'],
  ['zh-TW/heroTitle', 'audit-gpt.json'],
  ['zh-TW/goodJobSavingsDescription', 'audit-gpt.json'],
  ['zh-TW/makerCopyBeforeLink', 'audit-claude-fable.json'],
])

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function main() {
  const localesPath = resolve(projectRoot, 'assets/lp/locales.json')
  const locales = await readJson(localesPath)
  const draft = await readJson(resolve(evaluationDirectory, 'gemini-initial.json'))
  const audits = Object.fromEntries(await Promise.all(
    ['audit-claude-fable.json', 'audit-gpt.json'].map(async (name) => [name, await readJson(resolve(evaluationDirectory, name))]),
  ))
  const sourceKeys = Object.keys(locales.ja).sort()
  const draftByKey = new Map(draft.translations.map((translation) => [translation.key, translation]))
  if (JSON.stringify([...draftByKey.keys()].sort()) !== JSON.stringify(sourceKeys)) {
    throw new Error('Gemini draft keys do not match the Japanese source')
  }

  const updatedLocales = { ...locales }
  for (const [locale, field] of Object.entries(localeField)) {
    updatedLocales[locale] = Object.fromEntries(sourceKeys.map((key) => [key, draftByKey.get(key)[field]]))
  }

  for (const [identifier, auditName] of adoptedAuditFixes) {
    const [locale, key] = identifier.split('/')
    const issue = audits[auditName].issues.find((candidate) => candidate.locale === locale && candidate.key === key)
    if (!issue) throw new Error(`Missing selected audit fix: ${identifier} from ${auditName}`)
    updatedLocales[locale][key] = issue.replacement
  }

  await writeFile(localesPath, `${JSON.stringify(updatedLocales, null, 2)}\n`)
  console.log(`Applied Gemini draft and ${adoptedAuditFixes.size} reviewed fixes`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
