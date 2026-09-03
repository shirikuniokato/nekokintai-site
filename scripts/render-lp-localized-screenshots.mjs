import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
// 使い方: node scripts/render-lp-localized-screenshots.mjs [en ko zh-TW] [--screens=home,week,month,shop]
const siteRoot = resolve(import.meta.dirname, '..')
const appRoot = '/home/rikuto/git/nekokintai'
const harikoUrl = process.env.HARIKO_URL ?? 'http://localhost:3014'
const template = 'nekokintai-store-screenshot'
const locales = ['en', 'ko', 'zh-TW']
const screenshots = [
  { name: 'home', position: 1 },
  { name: 'week', position: 2 },
  { name: 'month', position: 3 },
  { name: 'shop', position: 4 },
]
const existingFrameAssets = {
  1: 'd2b77b22-d97b-4ef1-a4b1-437b99b1a81e',
  4: '6f00f7b8-8593-401c-9360-adc0ffeecbc9',
}

function appPath(...parts) {
  return resolve(appRoot, ...parts)
}

function sitePath(...parts) {
  return resolve(siteRoot, ...parts)
}

async function run(command, arguments_) {
  await execFile(command, arguments_, { maxBuffer: 10 * 1024 * 1024 })
}

async function assertDimensions(filePath, expected) {
  const { stdout } = await execFile('identify', ['-format', '%wx%h', filePath])
  if (stdout !== expected) throw new Error(`${filePath} is ${stdout}; expected ${expected}`)
}

async function uploadAsset(name, filePath, tags) {
  const data = await readFile(filePath)
  const response = await fetch(`${harikoUrl}/api/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mime: 'image/png',
      source: 'screenshot',
      tags,
      data_base64: data.toString('base64'),
    }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) throw new Error(`Unable to upload ${filePath}: ${JSON.stringify(payload)}`)
  return payload.data.id
}

async function render(frameAssetId, screenAssetId) {
  const response = await fetch(`${harikoUrl}/api/renders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template, canvas_keys: ['play'], slots: { frame: frameAssetId, screen: screenAssetId } }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) throw new Error(`Hariko render failed: ${JSON.stringify(payload)}`)
  const play = payload.data.items.find((item) => item.canvas_key === 'play')
  if (!play) throw new Error('Hariko did not return the Google Play canvas')
  return { renderGroup: payload.data.render_group, renderId: play.id }
}

async function downloadRender(renderId, outputPath) {
  const response = await fetch(`${harikoUrl}/api/renders/${renderId}.png`)
  if (!response.ok) throw new Error(`Unable to download Hariko render ${renderId}`)
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
}

async function verifyOuterFrame(templatePath, renderedPath, workPath) {
  const templateOuter = resolve(workPath, 'template-outer.png')
  const renderedOuter = resolve(workPath, 'rendered-outer.png')
  const inner = ['-fill', 'white', '-draw', 'rectangle 171,551 1122,2176']
  await run('magick', [templatePath, ...inner, templateOuter])
  await run('magick', [renderedPath, ...inner, renderedOuter])

  try {
    await run('compare', ['-metric', 'AE', templateOuter, renderedOuter, 'null:'])
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    if (output !== '0') throw new Error(`Outer frame changed by ${output} pixels: ${renderedPath}`)
  }
}

async function buildLpImage(renderedPath, destinationPath, workPath) {
  const cropped = resolve(workPath, 'cropped.png')
  const mask = resolve(workPath, 'mask.png')
  const masked = resolve(workPath, 'masked.png')
  const frame = sitePath('assets/lp/screen-month.png')

  await run('magick', [renderedPath, '-crop', '952x1626+171+551', '+repage', '-resize', '684x1164!', cropped])
  await run('magick', ['-size', '684x1164', 'xc:black', '-fill', 'white', '-draw', 'roundrectangle 0,0,683,1163,17,17', mask])
  await run('magick', [cropped, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', masked])
  await run('magick', [frame, masked, '-geometry', '+12+20', '-compose', 'over', '-composite', destinationPath])
  await assertDimensions(destinationPath, '720x1205')
}

function parseArguments(argv) {
  const requestedLocales = argv.filter((argument) => !argument.startsWith('--'))
  const screenFlag = argv.find((argument) => argument.startsWith('--screens='))
  const requestedScreens = screenFlag ? screenFlag.slice('--screens='.length).split(',') : screenshots.map((screenshot) => screenshot.name)
  for (const locale of requestedLocales) {
    if (!locales.includes(locale)) throw new Error(`Unsupported locale: ${locale}`)
  }
  for (const name of requestedScreens) {
    if (!screenshots.some((screenshot) => screenshot.name === name)) throw new Error(`Unsupported screen: ${name}`)
  }
  return {
    requestedLocales: requestedLocales.length === 0 ? locales : requestedLocales,
    requestedScreens: screenshots.filter((screenshot) => requestedScreens.includes(screenshot.name)),
  }
}

async function readManifest(manifestPath) {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return { template, frameAssets: {}, locales: {} }
    throw error
  }
}

async function uploadFrameAssets(previous) {
  // 1・4 は登録済みの固定アセット。2・3 はまだ登録がなければこの実行で登録し、あれば前回の ID を使い回す
  const frameAssets = { ...existingFrameAssets, ...previous }
  for (const position of [2, 3]) {
    if (frameAssets[position]) continue
    const framePath = appPath('docs/store/screenshots/templates', `final-${position}.png`)
    await assertDimensions(framePath, '1290x2796')
    frameAssets[position] = await uploadAsset(
      `nekokintai store frame ${position} v2.3.0`,
      framePath,
      ['nekokintai', 'store-frame', 'v2.3.0'],
    )
  }
  return frameAssets
}

async function renderScreenshot(locale, screenshot, frameAssetId, destinationDirectory) {
  const sourcePath = sitePath('docs/lp-screenshots/sources', locale, `screen-${screenshot.name}.png`)
  const outerTemplate = appPath('docs/store/screenshots/templates', `final-${screenshot.position}.png`)
  const destinationPath = resolve(destinationDirectory, `screen-${screenshot.name}.png`)
  const workPath = await mkdtemp(resolve(tmpdir(), 'nekokintai-lp-render-'))

  try {
    await assertDimensions(sourcePath, '960x1634')
    await assertDimensions(outerTemplate, '1290x2796')
    const screenAssetId = await uploadAsset(
      `nekokintai LP ${locale} ${screenshot.name} v2.3.0 dev`,
      sourcePath,
      ['nekokintai', 'lp', 'v2.3.0', locale, screenshot.name, 'dev'],
    )
    const { renderGroup, renderId } = await render(frameAssetId, screenAssetId)
    const renderedPath = resolve(workPath, 'store.png')
    await downloadRender(renderId, renderedPath)
    await assertDimensions(renderedPath, '1290x2796')
    await verifyOuterFrame(outerTemplate, renderedPath, workPath)
    await buildLpImage(renderedPath, destinationPath, workPath)
    console.log(`Rendered ${locale}/${screenshot.name}: ${destinationPath}`)
    return { screenAssetId, renderGroup, renderId }
  } finally {
    await rm(workPath, { recursive: true, force: true })
  }
}

async function main() {
  const { requestedLocales, requestedScreens } = parseArguments(process.argv.slice(2))
  const manifestPath = sitePath('docs/lp-screenshots/hariko-renders-v2.3.0-dev.json')
  // 一部の言語・画面だけを撮り直しても、他の言語のレンダー記録を落とさないよう既存の記録に重ねる
  const previous = await readManifest(manifestPath)
  const frameAssets = await uploadFrameAssets(previous.frameAssets)
  const manifest = { template, frameAssets, locales: { ...previous.locales } }

  for (const locale of requestedLocales) {
    const destinationDirectory = sitePath('assets/lp/screenshots', locale)
    await mkdir(destinationDirectory, { recursive: true })
    const entries = { ...(previous.locales[locale] ?? {}) }
    for (const screenshot of requestedScreens) {
      entries[screenshot.name] = await renderScreenshot(locale, screenshot, frameAssets[screenshot.position], destinationDirectory)
    }
    manifest.locales[locale] = entries
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${manifestPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
