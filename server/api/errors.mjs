export class ApiError extends Error {
  constructor(status, code, details = {}) {
    super(code)
    this.status = status
    this.details = details
  }
}

export function requireInput(condition, code = 'invalid_request') {
  if (!condition) throw new ApiError(400, code)
}

export function response(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff' } })
}

export async function readJson(request) {
  requireInput(request.headers.get('Content-Type')?.split(';')[0].trim() === 'application/json')
  const reader = request.body?.getReader()
  requireInput(reader)
  const chunks = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.length
    if (length > 64 * 1024) {
      await reader.cancel()
      throw new ApiError(413, 'request_too_large')
    }
    chunks.push(value)
  }
  try {
    const bytes = new Uint8Array(length)
    chunks.reduce((offset, chunk) => { bytes.set(chunk, offset); return offset + chunk.length }, 0)
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    requireInput(body && typeof body === 'object' && !Array.isArray(body))
    return body
  } catch { throw new ApiError(400, 'invalid_request') }
}

export function requireSameOrigin(request) {
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'origin_not_allowed')
}
