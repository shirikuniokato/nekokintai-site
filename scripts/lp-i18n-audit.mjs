import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { I18N_PAGES, splitPageOption } from './lib/lp-i18n-pages.mjs'
import { GOOD_JOB_SAVINGS, LOCALE_FIELDS, TRANSLATED_LOCALES, splitLocalesOption } from './lib/lp-i18n-locales.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const models = { 'claude-fable': 'claude-fable-5', gpt: 'gpt-5.6-sol' }
const schemaPath = resolve(projectRoot, 'scripts/schemas/lp-i18n-audit.schema.json')

const schema = {
  type: 'object', additionalProperties: false, required: ['summaryJapanese', 'issues'], properties: {
    summaryJapanese: { type: 'string' },
    issues: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['locale', 'key', 'severity', 'replacement', 'reasonJapanese'],
        properties: {
          locale: { type: 'string', enum: TRANSLATED_LOCALES }, key: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium'] },
          replacement: { type: 'string' }, reasonJapanese: { type: 'string' },
        },
      },
    },
  },
}

function run(command, args, input) {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolveOutput(Buffer.concat(stdout).toString('utf8'))
      reject(new Error(`${command} exited with ${code}: ${Buffer.concat(stderr).toString('utf8')}`))
    })
    child.stdin.end(input)
  })
}

/** 言語ごとに見てほしい観点。頼む言語の行だけをプロンプトに入れる */
const LOCALE_FOCUS = {
  en: [],
  ko: ['韓国語の助詞問題'],
  'zh-TW': ['台湾向け繁体字の地域語彙（中国大陸寄りのUI語の混入）'],
  'zh-Hans': [
    '簡体字中国語への繁体字の混入、台湾寄りの語彙（喔・啰・依照・作業・程式・資料・帳號 など）の混入、中国本土で不自然なUI語',
    '日本語の中黒「・」の持ち込み、通貨を「日元」でなく「¥」「円」と書いている箇所',
    '「行」「列」を中国大陸の意味（横が行・縦が列）で使っていない箇所',
  ],
}

function prompt(cases, pageLabel, locales) {
  const goodJobSavings = locales.map((locale) => GOOD_JOB_SAVINGS[locale]).join(' / ')
  const focus = ['意味の欠落', '責める表現', '通常UIへの猫語混入', '用語揺れ', ...locales.flatMap((locale) => LOCALE_FOCUS[locale]), 'UIとして不自然な長さ']
  return [
    `ねこ勤怠の公式サイト「${pageLabel}」ページの翻訳を、翻訳を生成していない独立した母語編集者として監査してください。`,
    `${focus.join('、')}だけを指摘してください。`,
    `ブランド名は各言語でも「ねこ勤怠」のまま。がんばった貯金は ${goodJobSavings}。`,
    '問題がある場合だけcritical/high/mediumで、同じキー・改行数を守った完成置換文を返してください。reasonJapaneseとsummaryJapaneseは日本語で、JSON以外を返さないでください。',
    `監査対象: ${JSON.stringify(cases)}`,
  ].join('\n')
}

async function audit(reviewer, input) {
  if (reviewer === 'claude-fable') {
    return run('claude', ['--print', '--model', 'fable', '--effort', 'high', '--safe-mode', '--tools', '', '--no-session-persistence', '--output-format', 'text', '--json-schema', JSON.stringify(schema), '--max-budget-usd', '5'], input)
  }
  return run('codex', ['exec', '--ephemeral', '--sandbox', 'read-only', '--model', models.gpt, '--config', 'model_reasoning_effort="high"', '--output-schema', schemaPath, '--color', 'never', '-'], input)
}

function validate(source, issues, locales) {
  const sourceByKey = new Map(source.map(({ key, text }) => [key, text]))
  for (const issue of issues) {
    if (!locales.includes(issue.locale)) throw new Error(`Audit issue for a locale not requested: ${issue.locale}/${issue.key}`)
    const original = sourceByKey.get(issue.key)
    if (!original) throw new Error(`Unknown audit key: ${issue.key}`)
    if (original.split('\n').length !== issue.replacement.split('\n').length) {
      throw new Error(`Newline mismatch in audit replacement: ${issue.key}`)
    }
  }
}

async function main() {
  const { page, rest: afterPage } = splitPageOption(process.argv.slice(2))
  const { locales, rest } = splitLocalesOption(afterPage)
  const [reviewer, draftPathArgument, outputPathArgument] = rest
  if (!models[reviewer] || !draftPathArgument || !outputPathArgument) {
    throw new Error('Usage: lp-i18n-audit.mjs [--page lp|tip|qa] [--locales zh-Hans] <claude-fable|gpt> <draft.json> <output.json>')
  }
  const copies = JSON.parse(await readFile(resolve(projectRoot, I18N_PAGES[page].locales), 'utf8'))
  const source = Object.entries(copies.ja).map(([key, text]) => ({ key, text }))
  const draft = JSON.parse(await readFile(resolve(projectRoot, draftPathArgument), 'utf8'))
  const draftsByKey = new Map(draft.translations.map((item) => [item.key, item]))
  const cases = locales.flatMap((locale) => source.map(({ key, text }) => ({
    locale, key, source: text, translation: draftsByKey.get(key)?.[LOCALE_FIELDS[locale]],
  })))
  const raw = await audit(reviewer, prompt(cases, I18N_PAGES[page].label, locales))
  const result = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, ''))
  validate(source, result.issues, locales)
  const outputPath = resolve(projectRoot, outputPathArgument)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), reviewer, model: models[reviewer], locales, ...result }, null, 2)}\n`)
  console.log(`${reviewer}: ${result.issues.length} translation issues written to ${outputPathArgument}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
