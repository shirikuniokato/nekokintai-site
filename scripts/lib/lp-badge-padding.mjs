// Google Play 公式バッジ PNG の透明余白を測る。依存なしで PNG を読む（8bit の RGBA / RGB / グレー / パレット + tRNS）。
// index.html の .store-badges は、この実測値からバッジ本体の見た目の高さを日本語 SVG とそろえている。
import { inflateSync } from 'node:zlib'

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
const ALPHA_THRESHOLD = 16

function readChunks(buffer) {
  const chunks = { idat: [] }
  let offset = 8
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      chunks.width = data.readUInt32BE(0)
      chunks.height = data.readUInt32BE(4)
      chunks.bitDepth = data[8]
      chunks.colorType = data[9]
    } else if (type === 'tRNS') chunks.transparency = data
    else if (type === 'IDAT') chunks.idat.push(data)
    offset += 12 + length
  }
  return chunks
}

function paethPredictor(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function unfilter(raw, width, height, channels) {
  const stride = width * channels
  const pixels = Buffer.alloc(height * stride)
  let previous = Buffer.alloc(stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const current = Buffer.alloc(stride)
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? current[i - channels] : 0
      const up = previous[i]
      const upLeft = i >= channels ? previous[i - channels] : 0
      const predictors = [0, left, up, Math.floor((left + up) / 2), paethPredictor(left, up, upLeft)]
      current[i] = (line[i] + predictors[filter]) & 0xff
    }
    current.copy(pixels, y * stride)
    previous = current
  }
  return pixels
}

export function decodePng(buffer) {
  const chunks = readChunks(buffer)
  if (chunks.bitDepth !== 8) throw new Error(`Unsupported bit depth: ${chunks.bitDepth}`)
  const channels = CHANNELS[chunks.colorType]
  const pixels = unfilter(inflateSync(Buffer.concat(chunks.idat)), chunks.width, chunks.height, channels)
  const alphaAt = (x, y) => {
    const index = (y * chunks.width + x) * channels
    if (chunks.colorType === 6) return pixels[index + 3]
    if (chunks.colorType === 4) return pixels[index + 1]
    if (chunks.colorType === 3) {
      const paletteIndex = pixels[index]
      return chunks.transparency && paletteIndex < chunks.transparency.length ? chunks.transparency[paletteIndex] : 255
    }
    return 255
  }
  return { width: chunks.width, height: chunks.height, alphaAt }
}

function opaqueBounds({ width, height, alphaAt }) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) < ALPHA_THRESHOLD) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) throw new Error('The badge image is fully transparent')
  return { minX, minY, maxX, maxY }
}

/** 画像の寸法、バッジ本体（不透明部分）の寸法、四辺の透明余白（px）。 */
export function measureBadgePadding(pngBuffer) {
  const image = decodePng(pngBuffer)
  const bounds = opaqueBounds(image)
  return {
    width: image.width,
    height: image.height,
    visibleWidth: bounds.maxX - bounds.minX + 1,
    visibleHeight: bounds.maxY - bounds.minY + 1,
    top: bounds.minY,
    right: image.width - 1 - bounds.maxX,
    bottom: image.height - 1 - bounds.maxY,
    left: bounds.minX,
  }
}

/**
 * index.html の .store-badges に書く係数。
 * 本体の高さを --badge-height にそろえるため、表示は height * visibleHeight 分の height 倍にし、
 * 余白ぶんを負のマージンで打ち消す。上下・左右が非対称な素材は shorthand で表せないので拒む。
 */
export function badgeCssCoefficients(padding) {
  if (padding.top !== padding.bottom || padding.left !== padding.right) {
    throw new Error(`Badge padding is asymmetric: ${JSON.stringify(padding)}`)
  }
  return {
    heightNumerator: padding.height,
    denominator: padding.visibleHeight,
    verticalPadding: padding.top,
    horizontalPadding: padding.left,
  }
}

function marginTerm(padding, denominator) {
  return padding === 0 ? '0' : `calc(var(--badge-height) * -${padding} / ${denominator})`
}

export function badgeCssDeclaration(padding) {
  const { heightNumerator, denominator, verticalPadding, horizontalPadding } = badgeCssCoefficients(padding)
  return (
    `height:calc(var(--badge-height) * ${heightNumerator} / ${denominator});` +
    `margin:${marginTerm(verticalPadding, denominator)} ${marginTerm(horizontalPadding, denominator)};`
  )
}

const RULE_PATTERN =
  /html\[lang="([^"]+)"\] \.store-badges img\[data-locale-badge="google-play"\]\{([^}]*)\}/gu

/** index.html から、言語ごとの Google Play バッジ補正ルール（lang → 宣言文字列）を取り出す。 */
export function parseBadgeRules(indexHtml) {
  return Object.fromEntries([...indexHtml.matchAll(RULE_PATTERN)].map(([, lang, declaration]) => [lang, declaration]))
}
