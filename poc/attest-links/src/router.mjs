import { timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { ApiError, requireInput, validateKeyId, createChallenge } from './protocol.mjs'
import { digest } from './verification.mjs'
import { attest, assertKey } from './ios.mjs'
import { inspectAndroid } from './google.mjs'

export function authorize(request, env, now = Date.now()) {
  const expiry = Math.min(Date.parse(env.POC_EXPIRES_AT ?? ''), Date.parse('2026-10-26T15:00:00Z'))
  if (!Number.isFinite(expiry) || now >= expiry || !env.POC_ACCESS_TOKEN) throw new ApiError(503, 'poc_disabled')
  const header = request.headers.get('Authorization') ?? ''
  if (header.length > 100 || !timingSafeEqual(Buffer.from(digest(header)), Buffer.from(digest(`Bearer ${env.POC_ACCESS_TOKEN}`)))) {
    throw new ApiError(401, 'unauthorized')
  }
}

async function readBody(request) {
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError(400, 'invalid_request')
  const chunks = []
  let size = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.length
    if (size > 64 * 1024) { await reader.cancel(); throw new ApiError(413, 'request_too_large') }
    chunks.push(part.value)
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    requireInput(body !== null && typeof body === 'object' && !Array.isArray(body))
    return body
  } catch { throw new ApiError(400, 'invalid_request') }
}

async function issueChallenge(database, input) {
  requireInput(['attest', 'assert', 'integrity'].includes(input.purpose))
  const keyId = input.purpose === 'integrity' ? null : validateKeyId(input.keyId)
  const challenge = createChallenge(input.purpose, keyId, Date.now())
  await database.prepare('INSERT INTO challenges VALUES (?, ?, ?, ?, ?)')
    .bind(challenge.id, challenge.purpose, challenge.keyId, challenge.requestHash, challenge.expiresAt).run()
  return challenge
}

async function dispatch(request, env) {
  authorize(request, env)
  if (request.method !== 'POST') throw new ApiError(405, 'method_not_allowed')
  if (!env.POC_DB || env.IOS_APP_ID_PREFIX !== '38KMU5TJWZ' || env.IOS_BUNDLE_ID !== 'com.ccya.nekokintai.dev' || env.ANDROID_PACKAGE !== 'com.ccya.nekokintai.dev') {
    throw new ApiError(503, 'poc_misconfigured')
  }
  const count = await env.POC_DB.prepare(`INSERT INTO request_buckets VALUES (?, 1)
    ON CONFLICT(minute) DO UPDATE SET used = used + 1 WHERE used < 30 RETURNING used`)
    .bind(Math.floor(Date.now() / 60_000)).first()
  if (!count) throw new ApiError(429, 'rate_limited')
  const input = await readBody(request)
  const policy = { bundleId: env.IOS_BUNDLE_ID, appIdPrefix: env.IOS_APP_ID_PREFIX }
  const path = new URL(request.url).pathname.replace(/\/$/, '')
  if (path === '/api/poc/challenge') return issueChallenge(env.POC_DB, input)
  if (path === '/api/poc/attest') return attest(env.POC_DB, input, policy)
  if (path === '/api/poc/assert') return assertKey(env.POC_DB, input, policy)
  if (path === '/api/poc/integrity') return inspectAndroid(env.POC_DB, input, env)
  if (path === '/api/poc/status') {
    validateKeyId(input.keyId)
    const key = await env.POC_DB.prepare('SELECT 1 FROM ios_keys WHERE key_id = ?').bind(input.keyId).first()
    return { registered: key !== null }
  }
  throw new ApiError(404, 'not_found')
}

export async function handle(request, env) {
  try {
    return Response.json(await dispatch(request, env), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (!(error instanceof ApiError)) console.error('poc_internal_error', { type: error?.name ?? 'unknown' })
    return Response.json({ error: error instanceof ApiError ? error.message : 'internal_error' }, {
      status: error instanceof ApiError ? error.status : 500, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
