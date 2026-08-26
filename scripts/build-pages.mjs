import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, '.pages-dist/site')
const publicEntries = [
  'art',
  'assets',
  'contact',
  'privacy',
  'qa',
  'roadmap',
  'tip',
  'favicon.png',
  'index.html',
  'ogp.png',
  'robots.txt',
  'sitemap.xml',
  'update.json',
]

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })

await Promise.all(
  publicEntries.map((entry) =>
    cp(resolve(projectRoot, entry), resolve(outputDirectory, entry), { recursive: true }),
  ),
)

console.log(`Cloudflare Pagesの公開ファイルを${outputDirectory}へ生成しました`)
