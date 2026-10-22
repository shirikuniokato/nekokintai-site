import { Buffer } from 'node:buffer'
import { ApiError } from './errors.mjs'

const ACCOUNT = 'nekokintai-integrity@playconsole-505815.iam.gserviceaccount.com'

export async function googleAccessToken(env, options = {}) {
  let account
  try { account = JSON.parse(env.PLAY_INTEGRITY_SA_JSON || '') } catch { throw new ApiError(503, 'unavailable') }
  if (account.client_email !== ACCOUNT || account.token_uri !== 'https://oauth2.googleapis.com/token'
    || typeof account.private_key !== 'string' || !/^[a-f0-9]+$/.test(account.private_key_id || '')) {
    throw new ApiError(503, 'unavailable')
  }
  const now = Math.floor((options.now ?? Date.now()) / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: account.private_key_id })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({ iss: ACCOUNT, scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: account.token_uri, iat: now, exp: now + 600 })).toString('base64url')
  const body = `${header}.${claims}`
  const der = Buffer.from(account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64')
  const key = await crypto.subtle.importKey('pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body))
  const response = await (options.fetch || fetch)(account.token_uri, { method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${body}.${Buffer.from(signature).toString('base64url')}` }) })
  if (!response.ok) throw new ApiError(503, 'unavailable')
  const token = await response.json()
  if (typeof token.access_token !== 'string' || token.token_type !== 'Bearer') throw new ApiError(503, 'unavailable')
  return token.access_token
}
