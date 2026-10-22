// OGP 1200×630 を組み立てる。数値はデザインの Ogp.dc.html（renderVals）をそのまま写す。
// ねこに依らない部分（背景・きらきら・カード・ロゴ）は 1 回だけ焼いて使い回す。
import { createCanvas, cloneCanvas, fillRect, fillRoundRect, hexToRgb, blendPixel } from './canvas.mjs'
import { layoutText, drawText } from './glyphs.mjs'
import { customCatSkin, paletteOf, spriteOf } from '../vendor/ogp-shared.mjs'

const W = 1200
const H = 630
const SAFE = Math.min(W, H)
const SAFE_X = (W - SAFE) / 2
const px = (n) => Math.round(n)
const INK = hexToRgb('#0C3A44')

function geometry(hasName) {
  const cardW = SAFE * 0.8
  const cardH = SAFE * 0.6
  const cardX = (W - cardW) / 2
  const cardY = SAFE * (hasName ? 0.1 : 0.15) + (H - SAFE) / 2
  return {
    cardX: px(cardX), cardY: px(cardY), cardW: px(cardW), cardH: px(cardH),
    border: px(SAFE * 0.0065), radius: px(SAFE * 0.032), shadow: px(SAFE * 0.016),
    cardPad: px(SAFE * 0.09), floorH: px(SAFE * 0.01),
    catDot: Math.max(4, Math.floor((cardW * 0.62) / 26)),
    nameY: px(cardY + cardH + SAFE * 0.03),
  }
}

const STOPS = [[0, '#FFFFFF'], [0.28, '#F4FBFD'], [0.62, '#EAF4F7'], [1, '#D7EDF4']].map(([t, c]) => [t, hexToRgb(c)])

// radial-gradient(circle at 50% 46%, …)。大きさの指定なし＝farthest-corner。
// 色は距離の 1/1024 刻みの表から引く（Math.hypot を 75 万回呼ぶと初回が 50ms を超えたため）
const LUT_STEPS = 1024

function gradientTable() {
  const table = new Uint8Array((LUT_STEPS + 1) * 3)
  for (let step = 0; step <= LUT_STEPS; step++) {
    const t = step / LUT_STEPS
    let i = 1
    while (i < STOPS.length - 1 && STOPS[i][0] < t) i++
    const [t0, c0] = STOPS[i - 1]
    const [t1, c1] = STOPS[i]
    const f = (t - t0) / (t1 - t0)
    for (let k = 0; k < 3; k++) table[step * 3 + k] = Math.round(c0[k] + (c1[k] - c0[k]) * f)
  }
  return table
}

function paintBackground(canvas) {
  const cx = W * 0.5
  const cy = H * 0.46
  const radius = Math.sqrt(Math.max(cx, W - cx) ** 2 + Math.max(cy, H - cy) ** 2)
  const table = gradientTable()
  const scale = LUT_STEPS / radius
  const p = canvas.pixels
  let at = 0
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx
      const step = Math.min(LUT_STEPS, Math.round(Math.sqrt(dx * dx + dy * dy) * scale)) * 3
      p[at++] = table[step]
      p[at++] = table[step + 1]
      p[at++] = table[step + 2]
    }
  }
}

function paintDots(canvas) {
  for (let i = 0; i < 40; i++) {
    const size = px(((i % 3) + 1) * SAFE * 0.006)
    fillRect(canvas, px((((i * 37) % 100) / 100) * W), px((((i * 61 + 17) % 100) / 100) * H), size, size, hexToRgb(i % 4 === 0 ? '#FFDE59' : '#FFFFFF'))
  }
}

// viewBox 0 0 9 9 の十字（＋中心の 3×3）を crispEdges で s px に広げる
function paintStar(canvas, x, y, size, color, core) {
  const rgb = hexToRgb(color)
  const coreRgb = core ? hexToRgb(core) : null
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const u = Math.floor(((col + 0.5) * 9) / size)
      const v = Math.floor(((row + 0.5) * 9) / size)
      if (coreRgb && u >= 3 && u < 6 && v >= 3 && v < 6) blendPixel(canvas, x + col, y + row, coreRgb, 1)
      else if (u === 4 || v === 4) blendPixel(canvas, x + col, y + row, rgb, 1)
    }
  }
}

const STAR_SEEDS = [
  [0.06, 0.12, 0.09, '#FFDE59'], [0.16, 0.30, 0.05, '#7FD3E8'], [0.04, 0.58, 0.06, '#FFFFFF'],
  [0.13, 0.78, 0.08, '#FFDE59'], [0.24, 0.10, 0.04, '#FF9FB0'], [0.22, 0.62, 0.035, '#FFDE59'],
  [0.88, 0.10, 0.08, '#FFDE59'], [0.79, 0.26, 0.045, '#FF9FB0'], [0.93, 0.44, 0.05, '#7FD3E8'],
  [0.84, 0.70, 0.09, '#FFDE59'], [0.74, 0.86, 0.04, '#FFFFFF'], [0.95, 0.84, 0.035, '#FF9FB0'],
  [0.30, 0.86, 0.05, '#7FD3E8'], [0.66, 0.06, 0.045, '#7FD3E8'], [0.36, 0.04, 0.03, '#FFDE59'],
  [0.60, 0.92, 0.03, '#FFDE59'], [0.02, 0.92, 0.04, '#7FD3E8'], [0.70, 0.48, 0.03, '#FFFFFF'],
]

function paintCard(canvas, g) {
  fillRoundRect(canvas, g.cardX + g.shadow, g.cardY + g.shadow, g.cardW, g.cardH, g.radius, hexToRgb('#C3E4EE'))
  fillRoundRect(canvas, g.cardX, g.cardY, g.cardW, g.cardH, g.radius, INK)
  fillRoundRect(canvas, g.cardX + g.border, g.cardY + g.border, g.cardW - g.border * 2, g.cardH - g.border * 2, g.radius - g.border, hexToRgb('#FFFFFF'))
  // カードの中のきらきらは padding box（枠の内側）が基準
  const inner = [g.cardX + g.border, g.cardY + g.border]
  for (const [fx, fy, fs, c] of [[0.08, 0.08, 0.05, '#FFDE59'], [0.84, 0.12, 0.035, '#7FD3E8'], [0.78, 0.30, 0.025, '#FF9FB0']]) {
    paintStar(canvas, inner[0] + px(g.cardW * fx), inner[1] + px(g.cardH * fy), px(SAFE * fs), c, null)
  }
  // 床: 中身の幅（枠の内側）の 80%、下の余白 cardPad の上
  const contentW = g.cardW - g.border * 2
  const floorW = contentW * 0.8
  const floorBottom = g.cardY + g.cardH - g.border - g.cardPad
  fillRoundRect(canvas, Math.round(W / 2 - floorW / 2), floorBottom - g.floorH, Math.round(floorW), g.floorH, 3, hexToRgb('#CFE4EA'))
}

// line-height:normal の DotGothic16 は ascender+descender（1.16em + 0.288em）。baseline は上から 1.16em
function paintLogo(canvas, pack) {
  const right = W - px(SAFE_X + SAFE * 0.05)
  const bottom = H - px((H - SAFE) / 2 + SAFE * 0.05)
  const big = px(SAFE * 0.054)
  const small = px(SAFE * 0.024)
  const baseline = bottom - big * 0.288
  const bigLayout = layoutText(pack, 'ねこ勤怠', big)
  const smallLayout = layoutText(pack, 'NEKO KINTAI', small, small * 0.4)
  const bigLeft = right - bigLayout.width
  drawText(canvas, pack, bigLayout, bigLeft, baseline, INK)
  drawText(canvas, pack, smallLayout, bigLeft - px(SAFE * 0.02) - smallLayout.width, baseline, hexToRgb('#155C69'))
}

const baseCache = new Map()

/** ねこに依らない絵。名前の有無でカードの位置が変わるので 2 通り */
export function baseImage(pack, hasName) {
  const cached = baseCache.get(hasName)
  if (cached) return cached
  const canvas = createCanvas(W, H)
  const g = geometry(hasName)
  paintBackground(canvas)
  paintDots(canvas)
  STAR_SEEDS.forEach(([x, y, s, c], i) => paintStar(canvas, px(x * W), px(y * H), px(s * SAFE), c, i % 2 === 0 ? '#FFFFFF' : c))
  paintCard(canvas, g)
  paintLogo(canvas, pack)
  baseCache.set(hasName, canvas)
  return canvas
}

function paintCat(canvas, cat, g) {
  const skin = customCatSkin(cat)
  const palette = paletteOf(skin)
  const rows = spriteOf(skin, 'sit')
  const dot = g.catDot
  const floorTop = g.cardY + g.cardH - g.border - g.cardPad - g.floorH
  const left = Math.round(W / 2 - (rows[0].length * dot) / 2)
  const top = floorTop - rows.length * dot
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]]
      if (color) fillRect(canvas, left + x * dot, top + y * dot, dot, dot, hexToRgb(color))
    }
  })
}

// font-size: min(safe*0.07, cardW*0.95/文字数)、line-height 1.3、中央寄せ
function paintName(canvas, pack, name, g) {
  // #250 / #260 で採用された固定サイズ。
  const size = 48
  const lineHeight = size * 1.3
  const contentHeight = size * 1.448
  const baseline = g.nameY + (lineHeight - contentHeight) / 2 + size * 1.16
  const layout = layoutText(pack, name, size)
  drawText(canvas, pack, layout, W / 2 - layout.width / 2, baseline, INK)
}

export function renderOgp(pack, cat, name) {
  const hasName = name.length > 0
  const g = geometry(hasName)
  const canvas = cloneCanvas(baseImage(pack, hasName))
  paintCat(canvas, cat, g)
  if (hasName) paintName(canvas, pack, name, g)
  return canvas
}
