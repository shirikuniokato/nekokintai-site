// Google Play 公式バッジ PNG の透明余白を測り、index.html の .store-badges に書く宣言を出す。
//   npm run measure:lp-badges
// 係数が index.html と一致することは scripts/lib/lp-badge-padding.test.mjs が検査する。
import { readFileSync } from 'node:fs'
import { badgeCssDeclaration, measureBadgePadding } from './lib/lp-badge-padding.mjs'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Usage: measure-lp-badge-padding.mjs <badge.png>...')
  process.exitCode = 1
}
for (const file of files) {
  const padding = measureBadgePadding(readFileSync(file))
  console.log(`${file}: ${padding.width}x${padding.height}, visible ${padding.visibleWidth}x${padding.visibleHeight}`)
  console.log(`  padding top=${padding.top} right=${padding.right} bottom=${padding.bottom} left=${padding.left}`)
  console.log(`  index.html: ${badgeCssDeclaration(padding)}`)
}
