// RGB 8bit の画面。描くのは矩形・角丸矩形・被覆率つきの単色だけ（OGP に要る分）。

export function createCanvas(width, height) {
  return { width, height, pixels: new Uint8Array(width * height * 3) }
}

export function cloneCanvas(canvas) {
  return { width: canvas.width, height: canvas.height, pixels: canvas.pixels.slice() }
}

export function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** alpha は 0〜1。1 なら上書き。 */
export function blendPixel(canvas, x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height || alpha <= 0) return
  const at = (y * canvas.width + x) * 3
  const p = canvas.pixels
  if (alpha >= 1) { p[at] = rgb[0]; p[at + 1] = rgb[1]; p[at + 2] = rgb[2]; return }
  p[at] = Math.round(p[at] + (rgb[0] - p[at]) * alpha)
  p[at + 1] = Math.round(p[at + 1] + (rgb[1] - p[at + 1]) * alpha)
  p[at + 2] = Math.round(p[at + 2] + (rgb[2] - p[at + 2]) * alpha)
}

export function fillRect(canvas, x, y, width, height, rgb) {
  const x0 = Math.max(0, Math.round(x))
  const y0 = Math.max(0, Math.round(y))
  const x1 = Math.min(canvas.width, Math.round(x + width))
  const y1 = Math.min(canvas.height, Math.round(y + height))
  const p = canvas.pixels
  for (let row = y0; row < y1; row++) {
    let at = (row * canvas.width + x0) * 3
    for (let col = x0; col < x1; col++) { p[at++] = rgb[0]; p[at++] = rgb[1]; p[at++] = rgb[2] }
  }
}

/** 角丸矩形。角だけ距離で被覆率を出す（CSS の border-radius の見た目に寄せる）。 */
export function fillRoundRect(canvas, x, y, width, height, radius, rgb) {
  fillRect(canvas, x + radius, y, width - radius * 2, height, rgb)
  fillRect(canvas, x, y + radius, radius, height - radius * 2, rgb)
  fillRect(canvas, x + width - radius, y + radius, radius, height - radius * 2, rgb)
  const corners = [[x + radius, y + radius, x, y], [x + width - radius, y + radius, x + width - radius, y],
    [x + radius, y + height - radius, x, y + height - radius], [x + width - radius, y + height - radius, x + width - radius, y + height - radius]]
  for (const [cx, cy, bx, by] of corners) {
    for (let row = by; row < by + radius; row++) {
      for (let col = bx; col < bx + radius; col++) {
        const distance = Math.hypot(col + 0.5 - cx, row + 0.5 - cy)
        blendPixel(canvas, col, row, rgb, Math.min(1, Math.max(0, radius - distance + 0.5)))
      }
    }
  }
}
