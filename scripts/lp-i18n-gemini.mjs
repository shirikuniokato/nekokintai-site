import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { I18N_PAGES, sharedGlossary, splitPageOption } from './lib/lp-i18n-pages.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const targetLocales = ['en', 'ko', 'zh-TW']
const model = 'gemini-3.1-pro-preview'
// 1回の応答に収まる量。よくあるしつもんのように文言が多いページは分けて頼み、あとで束ねる
const CHUNK_SIZE = 40

function translationSchema(expectedCount) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['translations'],
    properties: {
      translations: {
        type: 'array',
        minItems: expectedCount,
        maxItems: expectedCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'en', 'ko', 'zhTW', 'notes'],
          properties: {
            key: { type: 'string' },
            en: { type: 'string', minLength: 1 },
            ko: { type: 'string', minLength: 1 },
            zhTW: { type: 'string', minLength: 1 },
            notes: { type: 'string' },
          },
        },
      },
    },
  }
}

function buildPrompt(source, pageLabel, glossary) {
  const sharedTerms = glossary.length === 0
    ? []
    : [
        '',
        'サイト共通の固定訳（トップLPで決定済み。同じ key はこの訳をそのまま使い、ほかの文でも同じ言葉で呼ぶ）:',
        ...glossary.map((term) => `- ${term.key}: ${term.ja} → ${term.en} / ${term.ko} / ${term.zhTW}`),
      ]
  return [
    `あなたは「ねこ勤怠」の公式サイトのローカライゼーション担当です。今回のページは「${pageLabel}」です。`,
    '各日本語文言を英語 en、韓国語 ko、台湾向け繁体字中国語 zhTW へ翻訳してください。',
    '',
    '人格:',
    '- ユーザーを責めない、急かさない。かわいいが幼すぎず、必要な意味は省かない。',
    '- 猫の台詞だけに meow / 냥 / 喵 を使い、通常UIへ足さない。',
    '- ねこ勤怠はブランド名なので各言語でも「ねこ勤怠」のままにする。c_cya、ｼﾁｬのねこ屋さん、support@c-cya.com もそのまま。',
    '- 歩くは、ユーザーと猫が日々進む世界観の比喩として残す。',
    '- 個人開発者がユーザーの声にひとつずつ答えている文章。丁寧だが、へりくだりすぎない。',
    '',
    '用語:',
    '- がんばった貯金: Good Job Savings / 수고 저금 / 辛苦撲滿。必ずこの表記を使う。',
    '- アプリの画面名・ボタン名（「月」「時間を直す」「記録を足す」「いま やっていること」「1日のきりかえ時刻」「ねこ屋さん」「作業のカテゴリ」「バックアップはこちら」「けした作業」「休憩にさそう時間」など）は、そのページの中で同じ訳語をくり返し使う。',
    '- 韓国語は 해요체。変数の後ろに 이(가)、을(를)、와(과) の併記を置かない。',
    '- 台湾向け繁体字は台湾華語の語彙を使い、列表・點擊・應援など中国大陸寄りのUI語を避ける。',
    '- 金額（¥100 など）、バージョン番号、メールアドレス、URL は変えない。{{count}} のような波括弧は数値の差し込み口なので、そのまま残す。',
    '- 文体は原文に合わせる。プライバシーポリシーは丁寧な説明文（法的文書）で、猫語は使わない。',
    ...sharedTerms,
    '',
    '構造:',
    '- keyを一字も変えず、全件を1回ずつ返す。',
    '- 改行数を原文と同じにする（各原文の lineCount が行数。訳も同じ行数で、改行は意味の切れ目に置く）。',
    '- 文の前後の半角スペースは、リンクの前後の区切りなので残す（原文の先頭・末尾に空白があれば訳にも同じ位置に置く）。',
    '- notesは翻訳判断が必要な項目だけ日本語で短く書く。',
    '- JSON Schema以外の文章は返さない。',
    '',
    `原文: ${JSON.stringify(source.map(({ key, text }) => ({ key, text, lineCount: text.split('\n').length })))}`,
  ].join('\n')
}

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

/** 改行数が原文と違う・空の翻訳は受け取らず、そのキーだけ頼み直す */
function translationProblem(text, translation) {
  if (!translation) return 'missing'
  for (const locale of targetLocales) {
    const field = locale === 'zh-TW' ? 'zhTW' : locale
    const translated = translation[field]
    if (typeof translated !== 'string' || translated.length === 0) return `empty ${locale}`
    if (translated.split('\n').length !== text.split('\n').length) return `newline mismatch ${locale}`
  }
  return null
}

function partitionTranslations(source, translations) {
  if (!Array.isArray(translations)) throw new Error('Gemini returned no translation list')
  const byKey = new Map(translations.map((translation) => [translation.key, translation]))
  if (byKey.size !== translations.length) throw new Error('Translation keys are not unique')

  const accepted = []
  const rejected = []
  for (const item of source) {
    const translation = byKey.get(item.key)
    const problem = translationProblem(item.text, translation)
    if (problem) {
      console.warn(`retry ${item.key}: ${problem}`)
      rejected.push(item)
    } else {
      accepted.push(translation)
    }
  }
  return { accepted, rejected }
}

const RETRY_LIMIT = 3

async function translateChunk(part, pageLabel, glossary) {
  const acceptedByKey = new Map()
  let remaining = part
  for (let attempt = 0; attempt < RETRY_LIMIT && remaining.length > 0; attempt += 1) {
    const { accepted, rejected } = partitionTranslations(remaining, await generateTranslations(remaining, pageLabel, glossary))
    for (const translation of accepted) acceptedByKey.set(translation.key, translation)
    remaining = rejected
  }
  if (remaining.length > 0) {
    throw new Error(`Could not translate after ${RETRY_LIMIT} attempts: ${remaining.map((item) => item.key).join(', ')}`)
  }
  return part.map((item) => acceptedByKey.get(item.key))
}

async function generateTranslations(source, pageLabel, glossary) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not loaded')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(source, pageLabel, glossary) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseJsonSchema: translationSchema(source.length),
        },
      }),
    },
  )
  const body = await response.json()
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${body.error?.message ?? 'request failed'}`)

  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
  if (!text) throw new Error('Gemini returned no translation')
  return JSON.parse(text).translations
}

async function main() {
  const { page, rest } = splitPageOption(process.argv.slice(2))
  const [outputPathArgument] = rest
  if (!outputPathArgument) throw new Error('Usage: lp-i18n-gemini.mjs [--page lp|tip|qa] <output.json>')

  const copies = JSON.parse(await readFile(resolve(projectRoot, I18N_PAGES[page].locales), 'utf8'))
  const lpCopies = JSON.parse(await readFile(resolve(projectRoot, I18N_PAGES.lp.locales), 'utf8'))
  const glossary = sharedGlossary(page, lpCopies)
  const source = Object.entries(copies.ja).map(([key, text]) => ({ key, text }))
  const translations = []
  for (const part of chunk(source, CHUNK_SIZE)) {
    translations.push(...(await translateChunk(part, I18N_PAGES[page].label, glossary)))
    console.log(`Gemini: ${translations.length}/${source.length}`)
  }
  const outputPath = resolve(projectRoot, outputPathArgument)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), provider: 'gemini', model, page, sourceCount: source.length, translations }, null, 2)}\n`,
  )
  console.log(`Gemini translation draft: ${source.length} keys written to ${outputPathArgument}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
