import { Buffer } from 'node:buffer'
import { digest } from './verification.mjs'

export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status }
}

export function requireInput(condition, code = 'invalid_request') {
  if (!condition) throw new ApiError(400, code)
}

export function decodeBase64(value, maximum) {
  requireInput(typeof value === 'string' && value.length <= maximum && /^[A-Za-z0-9+/]+={0,2}$/.test(value))
  const bytes = Buffer.from(value, 'base64')
  requireInput(bytes.toString('base64') === value)
  return bytes
}

export function validateKeyId(value) {
  requireInput(decodeBase64(value, 44).length === 32)
  return value
}

export function createChallenge(purpose, keyId, now) {
  const id = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  const clientData = JSON.stringify({ v: 1, purpose, challenge: id, keyId,
    payloadDigest: digest('{"action":"poc-noop"}') })
  return { id, purpose, keyId, clientData, requestHash: digest(clientData), expiresAt: now + 120_000 }
}

export async function loadChallenge(database, input, purpose) {
  requireInput(typeof input.challengeId === 'string' && /^[A-Za-z0-9_-]{43}$/.test(input.challengeId))
  requireInput(typeof input.clientData === 'string' && input.clientData.length <= 2048)
  const row = await database.prepare('SELECT * FROM challenges WHERE id = ? AND purpose = ?')
    .bind(input.challengeId, purpose).first()
  if (!row || row.expires_at <= Date.now() || row.client_data_hash !== digest(input.clientData)) {
    throw new ApiError(409, 'challenge_expired_or_mismatched')
  }
  const used = await database.prepare(`SELECT 1 FROM ios_keys WHERE attestation_challenge_id = ?
    UNION ALL SELECT 1 FROM ios_assertion_receipts WHERE challenge_id = ?
    UNION ALL SELECT 1 FROM android_receipts WHERE challenge_id = ? LIMIT 1`)
    .bind(row.id, row.id, row.id).first()
  if (used) throw new ApiError(409, 'challenge_already_used')
  return row
}
