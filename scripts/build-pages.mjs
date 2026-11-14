import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeLocalizedPages } from './lib/build-localized-pages.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, '.pages-dist/site')
const publicEntries = [
  'art',
  'assets',
  'contact',
  'icons',
  'privacy',
  'qa',
  'roadmap',
  'tip',
  '404.html',
  'favicon.png',
  'index.html',
  'ogp.png',
  'robots.txt',
  'update.json',
]

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })

await Promise.all(
  publicEntries.map((entry) =>
    cp(resolve(projectRoot, entry), resolve(outputDirectory, entry), { recursive: true }),
  ),
)

// 言語ごとのページ（/en/ など）と、全言語を載せた sitemap.xml を書き出す
await writeLocalizedPages({ projectRoot, outputDirectory })

console.log(`Cloudflare Pagesの公開ファイルを${outputDirectory}へ生成しました`)
