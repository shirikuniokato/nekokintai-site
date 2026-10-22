import { ApiError, readJson } from './errors.mjs'
import { ownerIdentity, requestIpHash } from './identity.mjs'
import { issueChallenge, loadChallenge } from './challenges.mjs'
import { rateLimit } from './rate-limit.mjs'
import { digest } from './payload.mjs'
import { commitMutation, storedMutation } from './mutations.mjs'
import { productionProof, productionAttestation } from './production-proof.mjs'

export async function productionWrite(request, env, path) {
  if (request.method !== 'POST' || !['/challenge', '/attest', '/mutation'].includes(path)) return null
  // #259 の実機証拠と #252 の公開条件がそろうまで本番の受付を開けない。
  if (env.OWNER_WRITES_ENABLED !== 'verified') throw new ApiError(503, 'unavailable')
  const ipHash = await requestIpHash(request, env)
  await rateLimit(env.NEKOS_DB, ipHash, 'owner-mutation')
  const input = await readJson(request)
  if (path === '/challenge') {
    if (!['ios', 'android'].includes(input.platform)) throw new ApiError(400, 'invalid_request')
    return issueChallenge(env.NEKOS_DB, env, input, input.platform)
  }
  const identity = await ownerIdentity(env, input.uid)
  const challenge = await loadChallenge(env.NEKOS_DB, identity, input, input.platform)
  if (path === '/attest') return registerDevice(env.NEKOS_DB, challenge, input)
  if (!['mutation', 'read'].includes(challenge.purpose)) throw new ApiError(409, 'challenge_mismatch')
  const payload = JSON.parse(challenge.payload_json)
  const rawProof = challenge.platform === 'ios' ? input.assertion : input.token
  if (typeof rawProof !== 'string') throw new ApiError(400, 'invalid_request')
  const existing = await storedMutation(env.NEKOS_DB, { id: payload.operationId, ownerHash: identity.ownerHash,
    payloadDigest: challenge.payload_digest, proofDigest: await digest(rawProof), challengeId: challenge.id })
  if (existing) return existing
  if (challenge.consumed_by || challenge.expires_at <= Date.now()) throw new ApiError(409, 'challenge_expired')
  try {
    return await commitMutation(env.NEKOS_DB, challenge, await productionProof(env.NEKOS_DB, env, challenge, input))
  } catch (error) {
    const recovered = await storedMutation(env.NEKOS_DB, { id: payload.operationId, ownerHash: identity.ownerHash,
      payloadDigest: challenge.payload_digest, proofDigest: await digest(rawProof), challengeId: challenge.id })
    if (recovered) return recovered
    throw error
  }
}

async function registerDevice(database, challenge, input) {
  if (challenge.platform !== 'ios' || challenge.purpose !== 'attest'
    || challenge.key_id !== input.keyId || typeof input.attestation !== 'string' || input.attestation.length > 48_000) {
    throw new ApiError(409, 'challenge_mismatch')
  }
  const proofDigest = await digest(input.attestation)
  if (await alreadyRegistered(database, challenge, proofDigest)) return { registered: true }
  if (challenge.consumed_by || challenge.expires_at <= Date.now()) throw new ApiError(409, 'challenge_expired')
  const result = productionAttestation(input)
  try {
    await database.prepare(`INSERT INTO neko_device_keys
      (id, owner_hash, public_key, attestation_challenge_id, created_at, attestation_digest)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(input.keyId, challenge.owner_hash, result.publicKey,
      challenge.id, Date.now(), proofDigest).run()
  } catch (error) {
    if (/UNIQUE|conflict/.test(error.message)) {
      if (await alreadyRegistered(database, challenge, proofDigest)) return { registered: true }
      throw new ApiError(409, 'operation_conflict')
    }
    throw error
  }
  return { registered: true }
}

async function alreadyRegistered(database, challenge, proofDigest) {
  const row = await database.prepare('SELECT * FROM neko_device_keys WHERE id = ?').bind(challenge.key_id).first()
  if (!row) return false
  if (row.owner_hash !== challenge.owner_hash || row.attestation_challenge_id !== challenge.id
    || row.attestation_digest !== proofDigest) throw new ApiError(409, 'operation_conflict')
  return true
}
