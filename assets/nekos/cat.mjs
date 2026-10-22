import { CAT_SPRITES } from './sprites.mjs'

const SVG_NS = 'http://www.w3.org/2000/svg'
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/
/** 色の見本に出す順。品種で描かれない色（タキシードの首輪など）は出さない */
const SWATCH_ORDER = ['body', 'pattern', 'patternSecondary', 'line', 'eyes', 'collar', 'paws']

export const POSES = ['sit', 'walkA', 'walkB', 'sleep', 'happy']

function spriteSet(breed) {
  return CAT_SPRITES[breed] ?? CAT_SPRITES.short
}

/** そのポーズのドット数（横 × 縦） */
export function spriteSize(breed, pose) {
  const rows = spriteSet(breed).poses[pose] ?? spriteSet(breed).poses.sit
  return { cols: rows[0].length, rows: rows.length }
}

/** 品種で描かれる色のキー（色の見本に使う） */
export function usedColorKeys(breed) {
  const used = new Set(Object.values(spriteSet(breed).colors))
  return SWATCH_ORDER.filter((key) => used.has(key))
}

function safeColor(value) {
  // API から来る色はサーバーで検査済みの予定だが、属性に入れる前にもう一度形を見る
  return COLOR_PATTERN.test(value ?? '') ? value : '#000000'
}

/** 1 行を同じ色の連なりにまとめる。ドット 1 つずつ rect を置くより要素が少ない */
function rowRuns(row) {
  const runs = []
  for (let x = 0; x < row.length; x += 1) {
    const symbol = row[x]
    const last = runs.at(-1)
    if (last && last.symbol === symbol && last.x + last.width === x) {
      last.width += 1
    } else if (symbol !== '.') {
      runs.push({ symbol, x, width: 1 })
    }
  }
  return runs
}

/**
 * ねこちゃんの SVG。dot は 1 ドットの表示の大きさ（px）。
 * label を渡すと role="img" の名前になる。渡さなければ飾り（aria-hidden）。
 */
export function catSvg({ breed, colors, pose = 'sit', dot = 4, label = '' }) {
  const set = spriteSet(breed)
  const rows = set.poses[pose] ?? set.poses.sit
  const { cols } = spriteSize(breed, pose)
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${cols} ${rows.length}`)
  svg.setAttribute('width', String(cols * dot))
  svg.setAttribute('height', String(rows.length * dot))
  svg.setAttribute('shape-rendering', 'crispEdges')
  svg.classList.add('nk-cat')
  if (label) {
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', label)
  } else {
    svg.setAttribute('aria-hidden', 'true')
  }
  rows.forEach((row, y) => {
    for (const run of rowRuns(row)) {
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', String(run.x))
      rect.setAttribute('y', String(y))
      rect.setAttribute('width', String(run.width))
      rect.setAttribute('height', '1')
      rect.setAttribute('fill', safeColor(colors[set.colors[run.symbol]]))
      svg.append(rect)
    }
  })
  return svg
}
