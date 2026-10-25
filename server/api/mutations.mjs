import { ApiError } from './errors.mjs'
import { readCurrentPublication } from '../nekos/queries.mjs'

export async function storedMutation(database, input) {
  const existing = await database.prepare('SELECT * FROM neko_authenticated_mutations WHERE id = ?')
    .bind(input.id).first()
  if (!existing) return null
  if (existing.owner_hash !== input.ownerHash || existing.payload_digest !== input.payloadDigest
    || existing.proof_digest !== input.proofDigest || existing.challenge_id !== input.challengeId) {
    throw new ApiError(409, 'operation_conflict')
  }
  return mutationResult(existing)
}

export function mutationResult(row) {
  return { operationId: row.id, action: row.action,
    publication: row.result_json ? JSON.parse(row.result_json) : null }
}

export async function commitMutation(database, challenge, proof) {
  const payload = JSON.parse(challenge.payload_json)
  const current = await readCurrentPublication(database, challenge.owner_hash, payload.slot)
  const publicationId = current?.generation === payload.generation ? current.id : crypto.randomUUID()
  try {
    await database.prepare(`INSERT INTO neko_authenticated_mutations
      (id, owner_hash, proof_kind, key_id, previous_counter, new_counter, challenge_id, payload_digest,
       client_data_hash, proof_digest, action, slot, generation, expected_generation, expected_revision,
       publication_id, code, name, author, fallback_place)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      payload.operationId, challenge.owner_hash, proof.kind, challenge.key_id,
      proof.previousCounter ?? null, proof.counter ?? null, challenge.id, challenge.payload_digest,
      challenge.client_data_hash, proof.digest, payload.action, payload.slot, payload.generation,
      payload.expectedGeneration, payload.expectedRevision, publicationId,
      payload.code ?? null, payload.name ?? null, payload.author ?? null, payload.fallbackPlace ?? null,
    ).run()
  } catch (error) {
    if (/conflict|UNIQUE|publishing_unavailable|development_proof_forbidden/.test(error.message)) {
      const existing = await storedMutation(database, { id: payload.operationId, ownerHash: challenge.owner_hash,
        payloadDigest: challenge.payload_digest, proofDigest: proof.digest, challengeId: challenge.id })
      if (existing) return existing
      throw new ApiError(409, 'operation_conflict')
    }
    throw error
  }
  const row = await database.prepare('SELECT * FROM neko_authenticated_mutations WHERE id = ?').bind(payload.operationId).first()
  return mutationResult(row)
}
