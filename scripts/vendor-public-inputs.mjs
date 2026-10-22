// 正本の code 実装と OGP の glyph pack から投稿検査用データを作る。
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'

const [appDirectory, glyphFile] = process.argv.slice(2)
if (!appDirectory || !glyphFile) throw new Error('app repo と glyph pack のパスを指定してください')
const app = resolve(appDirectory)
const revision = execFileSync('git', ['-C', app, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['-C', app, 'status', '--porcelain', '--', 'src/shared'], { encoding: 'utf8' }).trim()
if (dirty) throw new Error('正本の shared に未コミットの変更があります')
await mkdir('server/vendor', { recursive: true })
await build({ stdin: { contents: "export { decodeCatCode, encodeCatCode, CAT_CODE_VERSION, CAT_CODE_LENGTH } from './catCode.ts'",
  resolveDir: `${app}/src/shared`, loader: 'ts' }, bundle: true, format: 'esm', platform: 'neutral',
  outfile: 'server/vendor/cat-code.mjs', tsconfigRaw: {},
  banner: { js: `// 生成物。正本: shirikuniokato/nekokintai ${revision} src/shared/catCode.ts。手で直さない。` } })
await build({ stdin: { contents: "export { customCatSkin } from './customCats.ts'; export { paletteOf, spriteOf } from './skins.ts'",
  resolveDir: `${app}/src/shared`, loader: 'ts' }, bundle: true, format: 'esm', platform: 'neutral',
  outfile: 'server/vendor/ogp-shared.mjs', tsconfigRaw: {}, minifyWhitespace: true,
  banner: { js: `// 生成物。正本: shirikuniokato/nekokintai ${revision} src/shared。手で直さない。` } })

const bytes = await readFile(glyphFile)
if (bytes.subarray(0, 4).toString() !== 'NKGP' || bytes.readUInt16LE(4) !== 1) throw new Error('glyph pack の形式が違います')
const offset = 7 + bytes.readUInt8(6) * 6
const count = bytes.readUInt32LE(offset)
if (count < 1 || offset + 4 + count * 4 > bytes.length) throw new Error('glyph pack の字数が正しくありません')
const codepoints = Array.from({ length: count }, (_, index) => bytes.readUInt32LE(offset + 4 + index * 4))
const manifest = { source: '#260 build-glyph-pack --hant=big5',
  sha256: createHash('sha256').update(bytes).digest('hex'), codepoints }
await writeFile('server/name-filter/glyph-codepoints.json', JSON.stringify(manifest) + '\n')
console.log(`正本 ${revision.slice(0, 7)} / glyph ${count} 字から生成しました`)
