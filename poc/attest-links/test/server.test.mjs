import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { createHash, createSign, generateKeyPairSync } from 'node:crypto'
import cbor from 'cbor'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

const policy = { bundleId: 'com.ccya.nekokintai.dev', appIdPrefix: '38KMU5TJWZ' }
const cap = 'test-only-operator-capability'
const keyId = Buffer.alloc(32, 1).toString('base64')

async function setup(context, overrides = {}) {
  const worker = new Miniflare(convertV4MiniflareOptions({ modules: true,
    scriptPath: 'public/_worker.js/index.js', compatibilityDate: '2026-10-19',
    compatibilityFlags: ['nodejs_compat'], d1Databases: ['POC_DB'],
    bindings: { POC_ACCESS_TOKEN: cap, POC_EXPIRES_AT: new Date(Date.now() + 3600_000).toISOString(),
      IOS_BUNDLE_ID: policy.bundleId, IOS_APP_ID_PREFIX: policy.appIdPrefix,
      ANDROID_PACKAGE: policy.bundleId, ...overrides },
    serviceBindings: { ASSETS: () => new Response('static') },
  }))
  context.after(() => worker.dispose())
  const database = await worker.getD1Database('POC_DB')
  const sql = await readFile('schema.sql', 'utf8')
  await database.batch(sql.split(';').map((part) => part.trim()).filter(Boolean).map((part) => database.prepare(part)))
  const post = async (path, body, token = cap) => {
    const response = await worker.dispatchFetch(`https://example.com/api/poc/${path}`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  return { worker, database, post }
}

async function registerFixture(database, post) {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const issued = await post('challenge', { purpose: 'attest', keyId })
  await database.prepare('INSERT INTO ios_keys VALUES (?, ?, ?, ?)')
    .bind(keyId, keys.publicKey.export({ type: 'spki', format: 'pem' }), issued.body.id, Date.now()).run()
  return keys
}

function assertion(privateKey, clientData, counter) {
  const rp = createHash('sha256').update(`${policy.appIdPrefix}.${policy.bundleId}`).digest()
  const count = Buffer.alloc(4); count.writeUInt32BE(counter)
  const authenticatorData = Buffer.concat([rp, Buffer.from([0]), count])
  const clientHash = createHash('sha256').update(clientData).digest()
  const nonce = createHash('sha256').update(Buffer.concat([authenticatorData, clientHash])).digest()
  const signature = createSign('SHA256').update(nonce).sign(privateKey)
  return cbor.encode({ signature, authenticatorData }).toString('base64')
}

async function signedRequest(post, privateKey, counter) {
  const issued = await post('challenge', { purpose: 'assert', keyId })
  return { keyId, challengeId: issued.body.id, clientData: issued.body.clientData,
    assertion: assertion(privateKey, issued.body.clientData, counter) }
}

test('試験用の合言葉・期限・dev用設定がそろわないAPIは停止する', async (context) => {
  const { post } = await setup(context)
  assert.equal((await post('challenge', { purpose: 'attest', keyId }, 'wrong')).status, 401)
  const disabled = await setup(context, { POC_EXPIRES_AT: '2000-01-01T00:00:00Z' })
  assert.equal((await disabled.post('challenge', {})).status, 503)
  const prefix = await setup(context, { IOS_APP_ID_PREFIX: 'WRONGPREFIX' })
  assert.equal((await prefix.post('challenge', {})).status, 503)
  const production = await setup(context, { IOS_BUNDLE_ID: 'com.ccya.nekokintai' })
  assert.equal((await production.post('challenge', {})).status, 503)
})

test('実workerdで署名・counterの増加を検証し、同じ要求の再送は拒否する', async (context) => {
  const { database, post } = await setup(context)
  const keys = await registerFixture(database, post)
  const first = await signedRequest(post, keys.privateKey, 1)
  assert.equal((await post('assert', first)).status, 200)
  assert.equal((await post('assert', first)).status, 409)
  const second = await signedRequest(post, keys.privateKey, 2)
  assert.equal((await post('assert', second)).body.counter, 2)
  const stale = await signedRequest(post, keys.privateKey, 1)
  assert.equal((await post('assert', stale)).status, 422)
})

test('同時に届いた同じchallengeは1つしか受け付けず、改変要求では消費しない', async (context) => {
  const { database, post } = await setup(context)
  const keys = await registerFixture(database, post)
  const input = await signedRequest(post, keys.privateKey, 1)
  assert.equal((await post('assert', { ...input, clientData: `${input.clientData}x` })).status, 409)
  const results = await Promise.all([post('assert', input), post('assert', input)])
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409])
  const count = await database.prepare('SELECT count(*) AS count FROM ios_assertion_receipts').first()
  assert.equal(count.count, 1)
})

test('期限切れchallengeと余分なCBOR・未設定のGoogle解読を成功扱いしない', async (context) => {
  const { database, post } = await setup(context)
  const keys = await registerFixture(database, post)
  const input = await signedRequest(post, keys.privateKey, 1)
  const extra = Buffer.concat([Buffer.from(input.assertion, 'base64'), cbor.encode(0)]).toString('base64')
  assert.equal((await post('assert', { ...input, assertion: extra })).status, 422)
  await database.prepare('UPDATE challenges SET expires_at = 1 WHERE id = ?').bind(input.challengeId).run()
  assert.equal((await post('assert', input)).status, 409)
  const issued = await post('challenge', { purpose: 'integrity' })
  assert.equal((await post('integrity', { challengeId: issued.body.id, clientData: issued.body.clientData, token: 'unconfigured' })).status, 503)
})
