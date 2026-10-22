import { ApiError, requireInput, loadChallenge } from './protocol.mjs'

function googleAccessToken(env) {
  const expiry = Date.parse(env.GOOGLE_ACCESS_TOKEN_EXPIRES_AT ?? '')
  if (!env.GOOGLE_ACCESS_TOKEN || !Number.isFinite(expiry) || expiry <= Date.now() + 60_000) {
    throw new ApiError(503, 'google_not_configured')
  }
  return env.GOOGLE_ACCESS_TOKEN
}

export async function inspectAndroid(database, input, env) {
  requireInput(typeof input.token === 'string' && input.token.length > 0 && input.token.length <= 24_000)
  const challenge = await loadChallenge(database, input, 'integrity')
  const authorization = googleAccessToken(env)
  const response = await fetch(`https://playintegrity.googleapis.com/v1/${env.ANDROID_PACKAGE}:decodeIntegrityToken`, {
    method: 'POST', headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrity_token: input.token }),
  })
  if (!response.ok) throw new ApiError(502, 'google_decode_failed')
  const { tokenPayloadExternal: verdict } = await response.json()
  const details = verdict?.requestDetails
  const timestamp = Number(details?.timestampMillis)
  if (!details || !Number.isFinite(timestamp) || timestamp <= 0 || details.requestPackageName !== env.ANDROID_PACKAGE || details.requestHash !== challenge.client_data_hash
    || Math.abs(Date.now() - timestamp) > 120_000) throw new ApiError(422, 'google_request_mismatch')
  const receipt = await database.prepare(`INSERT INTO android_receipts(challenge_id, verified_at)
    SELECT id, ? FROM challenges WHERE id = ? AND purpose = 'integrity' AND expires_at > ?
    ON CONFLICT DO NOTHING`).bind(Date.now(), challenge.id, Date.now()).run()
  if (receipt.meta.changes !== 1) throw new ApiError(409, 'integrity_replayed_or_stale')
  // dev APK の判定を観測するだけ。本番のアプリ認証として成功扱いにはしない。
  return { observed: true, app: verdict.appIntegrity?.appRecognitionVerdict ?? 'MISSING',
    device: verdict.deviceIntegrity?.deviceRecognitionVerdict ?? [],
    license: verdict.accountDetails?.appLicensingVerdict ?? 'MISSING',
    testing: verdict.testingDetails?.isTestingResponse === true }
}
