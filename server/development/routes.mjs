// production の Functions entrypoint からは import しない。
import { ApiError, readJson } from '../api/errors.mjs'
import { ownerIdentity, requestIpHash } from '../api/identity.mjs'
import { issueChallenge, loadChallenge } from '../api/challenges.mjs'
import { rateLimit } from '../api/rate-limit.mjs'
import { digest } from '../api/payload.mjs'
import { commitMutation, storedMutation } from '../api/mutations.mjs'

export async function developmentWrite(request, env, path) {
  if (request.method !== 'POST' || !['/challenge', '/mutation'].includes(path)) return null
  const ipHash = await requestIpHash(request, env)
  await rateLimit(env.NEKOS_DB, ipHash, 'owner-mutation')
  const input = await readJson(request)
  if (path === '/challenge') return issueChallenge(env.NEKOS_DB, env, input, 'development')
  const identity = await ownerIdentity(env, input.uid)
  const challenge = await loadChallenge(env.NEKOS_DB, identity, input, 'development')
  if (!['mutation', 'read'].includes(challenge.purpose)) throw new ApiError(409, 'challenge_mismatch')
  const proofDigest = await digest(`development:${input.clientData}`)
  const payload = JSON.parse(challenge.payload_json)
  const existing = await storedMutation(env.NEKOS_DB, { id: payload.operationId, ownerHash: identity.ownerHash,
    payloadDigest: challenge.payload_digest, proofDigest, challengeId: challenge.id })
  if (existing) return existing
  if (challenge.consumed_by || challenge.expires_at <= Date.now()) throw new ApiError(409, 'challenge_expired')
  return commitMutation(env.NEKOS_DB, challenge, { kind: 'development', digest: proofDigest })
}
