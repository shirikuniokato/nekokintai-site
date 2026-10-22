// パソコンで「アプリに反映する」を押したときに出す QR の、見た目だけの見本（デザインの見本と同じ並び）。
// 本物は反映の行き先（go.nekokintai.com の URL）が決まってから、その URL で作る。読みこんでも何も起きない。

const SIZE = 25
const FINDER_ORIGINS = [[0, 0], [18, 0], [0, 18]]

function finderCell(x, y) {
  for (const [originX, originY] of FINDER_ORIGINS) {
    const dx = x - originX
    const dy = y - originY
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) continue
    const ring = dx === 0 || dy === 0 || dx === 6 || dy === 6
    const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
    return ring || core
  }
  return null
}

function isDark(x, y) {
  const finder = finderCell(x, y)
  return finder ?? ((x * 7 + y * 13 + x * y) % 5) < 2
}

export function placeholderQrSvg(label) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`)
  svg.setAttribute('width', String(SIZE * 7))
  svg.setAttribute('height', String(SIZE * 7))
  svg.setAttribute('shape-rendering', 'crispEdges')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', label)
  svg.style.display = 'block'
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!isDark(x, y)) continue
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', String(x))
      rect.setAttribute('y', String(y))
      rect.setAttribute('width', '1')
      rect.setAttribute('height', '1')
      rect.setAttribute('fill', '#0C3A44')
      svg.append(rect)
    }
  }
  return svg
}
