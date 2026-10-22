import { ApiError, requireInput } from './errors.mjs'
import { normalizePayload, digest } from './payload.mjs'
import { ownerIdentity } from './identity.mjs'
import { registerOwner } from '../nekos/publications.mjs'
import { chooseFallbackName } from '../nekos/fallback-names.mjs'

export async function issueChallenge(database, env, input, platform) {
  const identity = await ownerIdentity(env, input.uid)
  const keyId = platform === 'ios' ? input.keyId : null
  requireInput(platform !== 'ios' || (typeof keyId === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(keyId)))
  const purpose = input.purpose === 'attest' ? 'attest' : input.payload?.action === 'read' ? 'read' : 'mutation'
  requireInput(input.purpose === 'attest' || input.purpose === 'mutation' || input.purpose === 'read')
  requireInput(purpose !== 'attest' || platform === 'ios')
  const normalized = purpose === 'attest' ? { action: 'attest', keyId } : normalizePayload(input.payload)
  const payload = normalized.action === 'publish'
    ? { ...normalized, fallbackName: chooseFallbackName(normalized.locale) } : normalized
  const id = crypto.randomUUID()
  const payloadJson = JSON.stringify({ v: 1, ownerHash: identity.ownerHash, ...payload })
  const payloadDigest = await digest(payloadJson)
  const clientData = JSON.stringify({ v: 1, challenge: id, purpose, platform, keyId, payloadDigest })
  const requestHash = await digest(clientData)
  const expiresAt = Date.now() + 120_000
  await registerOwner(database, { ...identity, now: Date.now() })
  await database.prepare(`INSERT INTO neko_challenges
    (id, purpose, platform, owner_hash, key_id, payload_digest, payload_json, client_data_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, purpose, platform, identity.ownerHash,
    keyId, payloadDigest, payloadJson, requestHash, expiresAt).run()
  return { id, clientData, requestHash, expiresAt, payload: JSON.parse(payloadJson) }
}

export async function loadChallenge(database, identity, input, platform) {
  requireInput(typeof input.challengeId === 'string' && /^[a-f0-9-]{36}$/.test(input.challengeId))
  requireInput(typeof input.clientData === 'string' && input.clientData.length < 2048)
  const row = await database.prepare('SELECT * FROM neko_challenges WHERE id = ? AND owner_hash = ?')
    .bind(input.challengeId, identity.ownerHash).first()
  if (!row || row.platform !== platform || row.client_data_hash !== await digest(input.clientData)) {
    throw new ApiError(409, 'challenge_mismatch')
  }
  return row
}
