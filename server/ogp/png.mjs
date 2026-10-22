// RGB 8bit の PNG を作る。zlib は CompressionStream('deflate')（Workers・node 共通、依存なし）。
// 行フィルタは None 固定。この絵（平らな色の面が多い）では None が最小で、フィルタ計算の CPU もかからない
// （zlib level 6 で None 38KB / Sub 47KB / Up 46KB を実測）。

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes, crc = 0xffffffff) {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8)
  return crc
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, (crc32(out.subarray(4, 8 + data.length)) ^ 0xffffffff) >>> 0)
  return out
}

function filterRows(canvas) {
  const { width, height, pixels } = canvas
  const stride = width * 3
  const raw = new Uint8Array((stride + 1) * height)
  for (let row = 0; row < height; row++) raw.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1)
  return raw
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodePng(canvas) {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, canvas.width)
  view.setUint32(4, canvas.height)
  header[8] = 8 // ビット深度
  header[9] = 2 // RGB
  const idat = await deflate(filterRows(canvas))
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))]
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) { out.set(part, at); at += part.length }
  return out
}
