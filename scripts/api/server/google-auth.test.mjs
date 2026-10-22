import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { googleAccessToken } from '../../../server/api/google-auth.mjs'

test('専用SAで Play Integrity だけの10分JWTを署名し、鍵やtokenを戻り値以外へ出さない', async (context) => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const account = { client_email: 'nekokintai-integrity@playconsole-505815.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), private_key_id: '1'.repeat(40),
    token_uri: 'https://oauth2.googleapis.com/token' }
  const now = Date.now()
  const fetch = context.mock.fn(async (url, options) => {
    assert.equal(url, account.token_uri)
    const assertion = options.body.get('assertion')
    const [header, body, signature] = assertion.split('.')
    assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256')
    const payload = JSON.parse(Buffer.from(body, 'base64url'))
    assert.equal(payload.scope, 'https://www.googleapis.com/auth/playintegrity')
    assert.equal(payload.iss, account.client_email)
    assert.equal(payload.exp - payload.iat, 600)
    assert.equal(verify('sha256', Buffer.from(`${header}.${body}`), publicKey, Buffer.from(signature, 'base64url')), true)
    return Response.json({ token_type: 'Bearer', access_token: 'synthetic-access-token' })
  })
  assert.equal(await googleAccessToken({ PLAY_INTEGRITY_SA_JSON: JSON.stringify(account) }, { now, fetch }), 'synthetic-access-token')
})

test('未設定・別のSA・外部token_uriは外部へ鍵を送らず停止する', async (context) => {
  const fetch = context.mock.fn(async () => { throw new Error('must not run') })
  for (const account of ['', '{}', JSON.stringify({ client_email: 'publisher@example.com' }),
    JSON.stringify({ client_email: 'nekokintai-integrity@playconsole-505815.iam.gserviceaccount.com', token_uri: 'https://evil.example/token' })]) {
    await assert.rejects(googleAccessToken({ PLAY_INTEGRITY_SA_JSON: account }, { fetch }), /unavailable/)
  }
  assert.equal(fetch.mock.callCount(), 0)
})
