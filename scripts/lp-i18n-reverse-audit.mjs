import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { I18N_PAGES, splitPageOption } from './lib/lp-i18n-pages.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const locales = ['en', 'ko', 'zh-TW']
const schemaPath = resolve(projectRoot, 'scripts/schemas/lp-i18n-reverse-audit.schema.json')

function run(input) {
  return new Promise((resolveOutput, reject) => {
    const child = spawn('codex', [
      'exec', '--ephemeral', '--sandbox', 'read-only', '--model', 'gpt-5.6-sol',
      '--config', 'model_reasoning_effort="high"', '--output-schema', schemaPath, '--color', 'never', '-',
    ], { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolveOutput(Buffer.concat(stdout).toString('utf8'))
      reject(new Error(`codex exited with ${code}: ${Buffer.concat(stderr).toString('utf8')}`))
    })
    child.stdin.end(input)
  })
}

function buildCases(copies) {
  return locales.flatMap((locale) => Object.entries(copies.ja).map(([key, source]) => ({
    locale, key, sourceJapanese: source, finalTranslation: copies[locale][key],
  })))
}

function prompt(cases, pageLabel) {
  return [
    `ねこ勤怠の公式サイト「${pageLabel}」ページの最終翻訳を、日本語への逆翻訳で品質確認してください。`,
    '各 finalTranslation を自然な日本語に頭の中で戻し、sourceJapanese と比較します。',
    '意味の欠落・追加・反転・世界観の変化だけを critical / high / medium で返してください。',
    '語順や直訳としての不自然さだけでは指摘せず、意味が等価なら issues は空にします。',
    'ブランド名「ねこ勤怠」と固定用語 Good Job Savings / 수고 저금 / 辛苦撲滿 は正しいものとして扱います。',
    'backTranslationJapanese と reasonJapanese は日本語で、JSON以外を返さないでください。',
    `確認対象: ${JSON.stringify(cases)}`,
  ].join('\n')
}

function validate(copies, issues) {
  const keys = new Set(Object.keys(copies.ja))
  for (const issue of issues) {
    if (!locales.includes(issue.locale)) throw new Error(`Unknown locale: ${issue.locale}`)
    if (!keys.has(issue.key)) throw new Error(`Unknown key: ${issue.key}`)
  }
}

async function main() {
  const { page, rest } = splitPageOption(process.argv.slice(2))
  const [outputPathArgument] = rest
  if (!outputPathArgument) throw new Error('Usage: lp-i18n-reverse-audit.mjs [--page lp|tip|qa] <output.json>')

  const copies = JSON.parse(await readFile(resolve(projectRoot, I18N_PAGES[page].locales), 'utf8'))
  const result = JSON.parse((await run(prompt(buildCases(copies), I18N_PAGES[page].label))).trim())
  validate(copies, result.issues)

  const outputPath = resolve(projectRoot, outputPathArgument)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(), reviewer: 'gpt', model: 'gpt-5.6-sol', ...result,
  }, null, 2)}\n`)
  console.log(`Reverse Japanese audit: ${result.issues.length} issues written to ${outputPathArgument}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
