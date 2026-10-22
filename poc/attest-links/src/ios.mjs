import { ApiError, requireInput, decodeBase64, validateKeyId, loadChallenge } from './protocol.mjs'
import { digest, verifyIosAttestation, verifyIosAssertion } from './verification.mjs'

export async function attest(database, input, policy) {
  validateKeyId(input.keyId)
  const challenge = await loadChallenge(database, input, 'attest')
  requireInput(challenge.key_id === input.keyId)
  let verification
  try {
    verification = verifyIosAttestation({ attestation: decodeBase64(input.attestation, 48_000),
      keyId: input.keyId, challenge: input.clientData }, policy)
  } catch (error) {
    throw new ApiError(422, ['certificate_expired', 'unexpected_aaguid', 'unsupported_attestation_flags'].includes(error.message)
      ? error.message : 'attestation_verification_failed')
  }
  const result = await database.prepare(`INSERT INTO ios_keys
    (key_id, public_key, attestation_challenge_id, verified_at)
    SELECT ?, ?, id, ? FROM challenges WHERE id = ? AND purpose = 'attest'
    AND key_id = ? AND client_data_hash = ? AND expires_at > ?
    ON CONFLICT DO NOTHING`).bind(input.keyId, verification.publicKey, Date.now(), challenge.id,
    input.keyId, digest(input.clientData), Date.now()).run()
  if (result.meta.changes !== 1) throw new ApiError(409, 'challenge_or_key_already_used')
  return { verified: true, ...verification.evidence }
}

export async function assertKey(database, input, policy) {
  validateKeyId(input.keyId)
  const challenge = await loadChallenge(database, input, 'assert')
  requireInput(challenge.key_id === input.keyId)
  const key = await database.prepare('SELECT public_key FROM ios_keys WHERE key_id = ?').bind(input.keyId).first()
  if (!key) throw new ApiError(409, 'key_not_registered')
  const previous = await database.prepare('SELECT coalesce(max(counter),0) AS counter FROM ios_assertion_receipts WHERE key_id = ?')
    .bind(input.keyId).first()
  let result
  try {
    result = verifyIosAssertion({ assertion: decodeBase64(input.assertion, 4096), payload: input.clientData,
      publicKey: key.public_key, signCount: previous.counter }, policy)
  } catch {
    throw new ApiError(422, 'assertion_verification_failed')
  }
  const stored = await database.prepare(`INSERT INTO ios_assertion_receipts
    (challenge_id, key_id, counter, client_data_hash, verified_at)
    SELECT id, ?, ?, client_data_hash, ? FROM challenges WHERE id = ? AND purpose = 'assert'
    AND key_id = ? AND client_data_hash = ? AND expires_at > ?
    AND ? > (SELECT coalesce(max(counter),0) FROM ios_assertion_receipts WHERE key_id = ?)
    ON CONFLICT DO NOTHING`).bind(input.keyId, result.counter, Date.now(), challenge.id,
    input.keyId, digest(input.clientData), Date.now(), result.counter, input.keyId).run()
  if (stored.meta.changes !== 1) throw new ApiError(409, 'assertion_replayed_or_stale')
  return { verified: true, counter: result.counter }
}
