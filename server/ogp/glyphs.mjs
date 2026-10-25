// glyph pack（scripts/build-glyph-pack.mjs が作る）を読み、文字列を被覆率つきで描く。
// 輪郭は直線だけ（3 本とも曲線の制御点 0 を確認済み）なので、多角形の面積積算で AA する（font-rs と同じ方式）。
import { blendPixel } from './canvas.mjs'

/** 描けない字の代わりに置く字。pack に必ずあるもの */
export const REPLACEMENT = '・'

export function parseGlyphPack(buffer) {
  const view = new DataView(buffer)
  let at = 4
  if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'NKGP') throw new Error('glyph pack ではありません')
  at += 2
  const fontCount = view.getUint8(at++)
  const fonts = []
  for (let i = 0; i < fontCount; i++) {
    fonts.push({ unitsPerEm: view.getUint16(at, true), ascender: view.getInt16(at + 2, true), descender: view.getInt16(at + 4, true) })
    at += 6
  }
  const count = view.getUint32(at, true); at += 4
  const codePoints = new Uint32Array(buffer.slice(at, at + count * 4)); at += count * 4
  const fontOf = new Uint8Array(buffer, at, count); at += count
  const advances = new Uint16Array(buffer.slice(at, at + count * 2)); at += count * 2
  const offsets = new Uint32Array(buffer.slice(at, at + (count + 1) * 4)); at += (count + 1) * 4
  const words = new Int16Array(buffer.slice(at))
  return { fonts, codePoints, fontOf, advances, offsets, words }
}

function indexOf(pack, codePoint) {
  let low = 0
  let high = pack.codePoints.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const value = pack.codePoints[mid]
    if (value === codePoint) return mid
    if (value < codePoint) low = mid + 1
    else high = mid - 1
  }
  return -1
}

/**
 * 字ごとの大きさ。fusion-pixel（12px 格子）は整数倍にしてにじませない。
 * DotGothic16 は格子に乗っていないので指定の大きさのまま描く。
 */
function sizeFor(pack, fontIndex, size) {
  if (fontIndex === 0) return size
  const grid = 12
  return Math.max(1, Math.round(size / grid)) * grid
}

/**
 * 字の並び（左上を 0 とした送り位置）。無い字は REPLACEMENT に置き換える。
 * 描ける字かどうかの判定と名前のそろえかたは src/shared/catName.ts（server/vendor/cat-name.mjs）が正本で、
 * 名前は投稿のときにそろえて描ける字だけにしてある。ここの NFC と置き換えは、ロゴなど固定の字も含めた描くときの守り
 */
export function layoutText(pack, text, size, letterSpacing = 0) {
  const items = []
  let x = 0
  for (const ch of text.normalize('NFC')) {
    let index = indexOf(pack, ch.codePointAt(0))
    if (index < 0) index = indexOf(pack, REPLACEMENT.codePointAt(0))
    const fontIndex = pack.fontOf[index]
    const font = pack.fonts[fontIndex]
    const glyphSize = sizeFor(pack, fontIndex, size)
    const scale = glyphSize / font.unitsPerEm
    items.push({ index, x: Math.round(x), scale })
    x += pack.advances[index] * scale + letterSpacing
  }
  return { items, width: x }
}

/** baseline の y と、左端の x を与えて描く */
export function drawText(canvas, pack, layout, left, baseline, rgb) {
  const top = Math.floor(baseline - layout.items.reduce((max, item) => Math.max(max, pack.fonts[pack.fontOf[item.index]].ascender * item.scale), 0)) - 1
  const bottom = Math.ceil(baseline + layout.items.reduce((max, item) => Math.max(max, -pack.fonts[pack.fontOf[item.index]].descender * item.scale), 0)) + 1
  const width = Math.ceil(layout.width) + 4
  const height = bottom - top
  const coverage = new Float32Array(width * height + width + 4)
  const originX = Math.round(left)
  const baseY = Math.round(baseline) - top
  for (const item of layout.items) addGlyph(pack, item, coverage, width, height, item.x + 1, baseY)
  composite(canvas, coverage, width, height, originX - 1, top, rgb)
}

function addGlyph(pack, item, coverage, width, height, originX, baseY) {
  const { words, offsets } = pack
  let at = offsets[item.index]
  const contourCount = words[at++]
  for (let c = 0; c < contourCount; c++) {
    const pointCount = words[at++]
    let fx = 0
    let fy = 0
    const points = []
    for (let i = 0; i < pointCount; i++) {
      fx += words[at++]
      fy += words[at++]
      points.push(originX + fx * item.scale, baseY - fy * item.scale)
    }
    for (let i = 0; i < pointCount; i++) {
      const next = (i + 1) % pointCount
      accumulateLine(coverage, width, height, points[i * 2], points[i * 2 + 1], points[next * 2], points[next * 2 + 1])
    }
  }
}

// 線分 1 本が各画素に与える符号つき面積を足し込む。あとで行ごとに累積すると被覆率になる。
function accumulateLine(acc, width, height, x0, y0, x1, y1) {
  if (y0 === y1) return
  let direction = 1
  if (y0 > y1) { direction = -1; [x0, y0, x1, y1] = [x1, y1, x0, y0] }
  const dxdy = (x1 - x0) / (y1 - y0)
  let x = x0
  if (y0 < 0) { x -= y0 * dxdy; y0 = 0 }
  const yEnd = Math.min(height, Math.ceil(y1))
  for (let y = Math.floor(y0); y < yEnd; y++) {
    const lineStart = y * width
    const dy = Math.min(y + 1, y1) - Math.max(y, y0)
    const xNext = x + dxdy * dy
    const d = dy * direction
    const left = Math.min(x, xNext)
    const right = Math.max(x, xNext)
    accumulateSpan(acc, lineStart, left, right, x, xNext, d)
    x = xNext
  }
}

function accumulateSpan(acc, lineStart, left, right, x, xNext, d) {
  const leftFloor = Math.floor(left)
  const leftIndex = leftFloor
  const rightCeil = Math.ceil(right)
  const rightIndex = rightCeil
  if (rightIndex <= leftIndex + 1) {
    const middle = 0.5 * (x + xNext) - leftFloor
    acc[lineStart + leftIndex] += d - d * middle
    acc[lineStart + leftIndex + 1] += d * middle
    return
  }
  const s = 1 / (right - left)
  const leftFraction = left - leftFloor
  const a0 = 0.5 * s * (1 - leftFraction) ** 2
  const rightFraction = right - rightCeil + 1
  const am = 0.5 * s * rightFraction ** 2
  acc[lineStart + leftIndex] += d * a0
  if (rightIndex === leftIndex + 2) {
    acc[lineStart + leftIndex + 1] += d * (1 - a0 - am)
  } else {
    const a1 = s * (1.5 - leftFraction)
    acc[lineStart + leftIndex + 1] += d * (a1 - a0)
    for (let xi = leftIndex + 2; xi < rightIndex - 1; xi++) acc[lineStart + xi] += d * s
    const a2 = a1 + (rightIndex - leftIndex - 3) * s
    acc[lineStart + rightIndex - 1] += d * (1 - a2 - am)
  }
  acc[lineStart + rightIndex] += d * am
}

function composite(canvas, coverage, width, height, left, top, rgb) {
  for (let row = 0; row < height; row++) {
    let sum = 0
    for (let col = 0; col < width; col++) {
      sum += coverage[row * width + col]
      const alpha = Math.min(1, Math.abs(sum))
      if (alpha > 0.002) blendPixel(canvas, left + col, top + row, rgb, alpha)
    }
  }
}
