import { Buffer } from 'node:buffer'
import { ApiError, requireInput } from './errors.mjs'
import { verifyIosAssertion, verifyIosAttestation } from './ios-verification.mjs'
import { digest } from './payload.mjs'
import { googleAccessToken } from './google-auth.mjs'

const IOS_POLICY = { bundleId: 'com.ccya.nekokintai', appIdPrefix: '38KMU5TJWZ' }
const ANDROID_PACKAGE = 'com.ccya.nekokintai'
const ANDROID_CERTIFICATE = Buffer.from('5868493cf67fbe39bdf533d3ff6d1256340e50ff35a529484c03bfa77ea4f8c59', 'hex').toString('base64url')

function proofBytes(value, maximum) {
  requireInput(typeof value === 'string' && value.length <= maximum && /^[A-Za-z0-9+/]+={0,2}$/.test(value))
  const bytes = Buffer.from(value, 'base64')
  requireInput(bytes.toString('base64') === value)
  return bytes
}

export function productionAttestation(input) {
  try {
    return verifyIosAttestation({ attestation: proofBytes(input.attestation, 48_000),
      keyId: input.keyId, challenge: input.clientData }, IOS_POLICY)
  } catch { throw new ApiError(422, 'device_proof_invalid') }
}

export async function productionProof(database, env, challenge, input) {
  if (challenge.platform === 'android') return androidProof(env, challenge, input)
  if (challenge.platform !== 'ios') throw new ApiError(403, 'device_proof_invalid')
  const key = await database.prepare('SELECT * FROM neko_device_keys WHERE id = ? AND owner_hash = ?')
    .bind(challenge.key_id, challenge.owner_hash).first()
  if (!key) throw new ApiError(409, 'device_key_missing')
  try {
    const result = verifyIosAssertion({ assertion: proofBytes(input.assertion, 4096), payload: input.clientData,
      publicKey: key.public_key, signCount: key.counter }, IOS_POLICY)
    return { kind: 'ios', previousCounter: key.counter, counter: result.counter, digest: await digest(input.assertion) }
  } catch { throw new ApiError(422, 'device_proof_invalid') }
}

async function androidProof(env, challenge, input) {
  requireInput(typeof input.token === 'string' && input.token.length > 0 && input.token.length <= 24_000)
  const accessToken = await googleAccessToken(env)
  const response = await fetch(`https://playintegrity.googleapis.com/v1/${ANDROID_PACKAGE}:decodeIntegrityToken`, {
    method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ integrity_token: input.token }),
    signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new ApiError(503, 'unavailable')
  const { tokenPayloadExternal: verdict } = await response.json()
  validateAndroidVerdict(verdict, challenge.client_data_hash, Date.now())
  return { kind: 'android', digest: await digest(input.token) }
}

export function validateAndroidVerdict(verdict, requestHash, now) {
  const details = verdict?.requestDetails
  const app = verdict?.appIntegrity
  const timestamp = Number(details?.timestampMillis)
  if (!details || !Number.isFinite(timestamp) || Math.abs(now - timestamp) > 120_000
    || details.requestPackageName !== ANDROID_PACKAGE || details.requestHash !== requestHash
    || app?.packageName !== ANDROID_PACKAGE || app?.appRecognitionVerdict !== 'PLAY_RECOGNIZED'
    || !app?.certificateSha256Digest?.includes(ANDROID_CERTIFICATE)
    || !verdict.deviceIntegrity?.deviceRecognitionVerdict?.includes('MEETS_DEVICE_INTEGRITY')
    || verdict.accountDetails?.appLicensingVerdict !== 'LICENSED' || verdict.testingDetails?.isTestingResponse === true) {
    throw new ApiError(422, 'device_proof_invalid')
  }
}
