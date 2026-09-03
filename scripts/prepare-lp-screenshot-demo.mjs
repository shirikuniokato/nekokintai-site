import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { alignmentShiftDays, localizedDemo, parseArguments } from './lib/lp-screenshot-demo.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const defaultSource = '/home/rikuto/git/nekokintai/docs/store/screenshots/demo-data.json'
const usage = [
  'Usage: prepare-lp-screenshot-demo.mjs <ja|en|ko|zh-TW> <output.json> [--align=none|today|week] [--on=YYYY-MM-DD] [--source=demo-data.json]',
  '  --align=today  デモの最後の出勤日を --on の日に重ねる（ホーム・月・ねこ屋さんの撮影用）',
  '  --align=week   デモの達成した週を --on の日を含む週に重ねる（週画面の撮影用）',
].join('\n')

async function main() {
  const parsed = parseArguments(process.argv.slice(2))
  if (!parsed) throw new Error(usage)

  const source = JSON.parse(await readFile(resolve(parsed.source ?? defaultSource), 'utf8'))
  const shiftDays = alignmentShiftDays(source, parsed)
  const output = localizedDemo(source, parsed.locale, shiftDays)
  const outputPath = resolve(projectRoot, parsed.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output)}\n`)
  const shiftLabel = `${shiftDays >= 0 ? '+' : ''}${shiftDays} days`
  console.log(`Prepared ${parsed.locale} screenshot demo (align=${parsed.align}, ${shiftLabel}): ${parsed.output}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
