import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { databaseFor, CODE } from './helpers.mjs'
import { createHandler } from '../../../server/api/handler.mjs'
import { developmentWrite } from '../../../server/development/routes.mjs'
import { productionWrite } from '../../../server/api/production-routes.mjs'
import { issueChallenge } from '../../../server/api/challenges.mjs'
import { commitMutation } from '../../../server/api/mutations.mjs'
import { digest } from '../../../server/api/payload.mjs'
import { validateAndroidVerdict } from '../../../server/api/production-proof.mjs'
// Play Console の「アプリの署名」の SHA-256 をそのまま写した値（実装の定数を写すと、同じ写し間違いでも通ってしまう）
const PLAY_APP_SIGNING_DIGEST = Buffer.from(
  '58:68:49:3C:F6:7F:BE:39:BD:F5:33:D3:FF:6D:12:56:34:0E:50:F3:5A:52:94:84:C0:3B:FA:77:EA:4F:8C:59'.replaceAll(':', ''), 'hex',
).toString('base64url')

const UID = 'test-owner-123456789'
const devHandle = createHandler(developmentWrite, 'development')
const productionHandle = createHandler(productionWrite, 'production')
const basePayload = () => ({ operationId: randomUUID(), action: 'publish', slot: 1,
  generation: 'first', expectedGeneration: null, expectedRevision: 0, code: CODE, name: '', author: '', locale: 'ja' })

async function setup(context, development = true) {
  const database = await databaseFor(context)
  if (development) await database.prepare("UPDATE neko_runtime SET environment = 'development'").run()
  return { NEKOS_DB: database, NEKOS_ENV: development ? 'development' : 'production',
    OWNER_PEPPER: 'test-owner-pepper'.repeat(4), IP_PEPPER: 'test-ip-pepper'.repeat(4) }
}

function post(path, body) {
  return new Request(`https://example.com/api/nekos${path}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify(body) })
}

async function challenge(env, payload) {
  const response = await devHandle(post('/challenge', { uid: UID, purpose: 'mutation', payload }), env)
  const result = await response.json()
  assert.equal(response.status, 200, JSON.stringify(result))
  return { uid: UID, challengeId: result.id, clientData: result.clientData }
}

async function publish(env, payload) {
  const input = await challenge(env, payload)
  const response = await devHandle(post('/mutation', input), env)
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
  return { input, result: await response.json() }
}

test('dev の公開・再送・編集・取り下げ・再公開・世代交換と状態読み直しが一貫する', async (context) => {
  const env = await setup(context)
  const { input, result } = await publish(env, basePayload())
  assert.equal(result.publication.revision, 1)
  // 名前が空なら空のまま返し、野良ねこの場所の番号を添える（#262）
  assert.equal(result.publication.name, '')
  assert.ok(Number.isInteger(result.publication.fallbackPlace) && result.publication.fallbackPlace >= 0
    && result.publication.fallbackPlace < 20)
  assert.deepEqual(await (await devHandle(post('/mutation', input), env)).json(), result)
  const withdraw = { ...basePayload(), action: 'withdraw', expectedGeneration: 'first', expectedRevision: 1 }
  const removed = await publish(env, withdraw)
  assert.ok(removed.result.publication.withdrawnAt)
  const again = await publish(env, { ...basePayload(), expectedGeneration: 'first', expectedRevision: 2 })
  assert.equal(again.result.publication.id, result.publication.id)
  assert.equal(again.result.publication.name, result.publication.name)
  assert.equal(again.result.publication.fallbackPlace, result.publication.fallbackPlace)
  const read = await publish(env, { operationId: randomUUID(), action: 'read', slot: 1 })
  assert.equal(read.result.publication.revision, 3)
  const replaced = await publish(env, { ...basePayload(), generation: 'second', expectedGeneration: 'first', expectedRevision: 3 })
  assert.notEqual(replaced.result.publication.id, result.publication.id)
  const retire = await publish(env, { ...basePayload(), action: 'retire', generation: 'second',
    expectedGeneration: 'second', expectedRevision: 1 })
  assert.ok(retire.result.publication.replacedAt)
  // 古い read の再送は当時の結果だけを返し、新しいデータへの継続認証にはしない。
  assert.equal((await (await devHandle(post('/mutation', read.input), env)).json()).publication.revision, 3)
})

test('同じ版からの競合は片方だけ保存し、失敗した challenge と receipt を消費しない', async (context) => {
  const env = await setup(context)
  const inputs = await Promise.all([challenge(env, basePayload()), challenge(env, basePayload())])
  const responses = await Promise.all(inputs.map((input) => devHandle(post('/mutation', input), env)))
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409])
  assert.equal((await env.NEKOS_DB.prepare('SELECT count(*) AS n FROM neko_authenticated_mutations').first()).n, 1)
  assert.equal((await env.NEKOS_DB.prepare('SELECT count(*) AS n FROM neko_challenges WHERE consumed_by IS NOT NULL').first()).n, 1)
  const winner = responses.findIndex((response) => response.status === 200)
  const wrongUid = { ...inputs[winner], uid: 'another-owner-123456789' }
  assert.equal((await devHandle(post('/mutation', wrongUid), env)).status, 409)
  const tampered = { ...inputs[winner], clientData: inputs[winner].clientData + ' ' }
  assert.equal((await devHandle(post('/mutation', tampered), env)).status, 409)
})

test('完全に同じ操作を並行再送した場合は、同じ成功結果を返して一度だけ保存する', async (context) => {
  const env = await setup(context)
  const input = await challenge(env, basePayload())
  const responses = await Promise.all([devHandle(post('/mutation', input), env), devHandle(post('/mutation', input), env)])
  assert.deepEqual(responses.map((response) => response.status), [200, 200])
  assert.deepEqual(await responses[0].json(), await responses[1].json())
  assert.equal((await env.NEKOS_DB.prepare('SELECT count(*) AS n FROM neko_authenticated_mutations').first()).n, 1)
})

test('失敗時は iOS counter も戻り、別 challenge で同じ counter を使っても二重に適用しない', async (context) => {
  const env = await setup(context, false)
  const keyId = Buffer.alloc(32, 1).toString('base64')
  const keyChallenge = await issueChallenge(env.NEKOS_DB, env, { uid: UID, purpose: 'attest', keyId }, 'ios')
  await env.NEKOS_DB.prepare(`INSERT INTO neko_device_keys(id, owner_hash, public_key, attestation_challenge_id, created_at)
    VALUES (?, ?, 'test-public-key', ?, ?)`).bind(keyId, keyChallenge.payload.ownerHash, keyChallenge.id, Date.now()).run()
  const created = await issueChallenge(env.NEKOS_DB, env, { uid: UID, purpose: 'mutation', keyId, payload: basePayload() }, 'ios')
  const row = await env.NEKOS_DB.prepare('SELECT * FROM neko_challenges WHERE id = ?').bind(created.id).first()
  await env.NEKOS_DB.prepare('UPDATE neko_settings SET publishing_paused = 1').run()
  const proof = { kind: 'ios', previousCounter: 0, counter: 1, digest: await digest('test-proof') }
  await assert.rejects(commitMutation(env.NEKOS_DB, row, proof), /operation_conflict/)
  assert.equal((await env.NEKOS_DB.prepare('SELECT counter FROM neko_device_keys WHERE id = ?').bind(keyId).first()).counter, 0)
  assert.equal((await env.NEKOS_DB.prepare('SELECT consumed_by FROM neko_challenges WHERE id = ?').bind(created.id).first()).consumed_by, null)
  await env.NEKOS_DB.prepare('UPDATE neko_settings SET publishing_paused = 0').run()
  assert.equal((await commitMutation(env.NEKOS_DB, row, proof)).publication.revision, 1)
  const next = await issueChallenge(env.NEKOS_DB, env, { uid: UID, purpose: 'mutation', keyId,
    payload: { ...basePayload(), expectedGeneration: 'first', expectedRevision: 1 } }, 'ios')
  const nextRow = await env.NEKOS_DB.prepare('SELECT * FROM neko_challenges WHERE id = ?').bind(next.id).first()
  await assert.rejects(commitMutation(env.NEKOS_DB, nextRow, { ...proof, digest: await digest('different-proof') }), /operation_conflict/)
})

test('本番 DB は development proof を拒否し、本番入口は任意の設定や fake proof で素通しにならない', async (context) => {
  const env = await setup(context, false)
  const created = await issueChallenge(env.NEKOS_DB, env, { uid: UID, purpose: 'mutation', payload: basePayload() }, 'development')
  const row = await env.NEKOS_DB.prepare('SELECT * FROM neko_challenges WHERE id = ?').bind(created.id).first()
  await assert.rejects(commitMutation(env.NEKOS_DB, row, { kind: 'development', digest: await digest('dev') }), /operation_conflict/)
  assert.equal((await productionHandle(post('/challenge', { uid: UID, purpose: 'mutation', platform: 'development', payload: basePayload() }),
    { ...env, OWNER_WRITES_ENABLED: 'verified', ALLOW_DEV_BYPASS: 'true' })).status, 400)
  assert.equal((await productionHandle(post('/mutation', { uid: UID, platform: 'development',
    challengeId: created.id, clientData: created.clientData }), env)).status, 503)
  assert.equal((await env.NEKOS_DB.prepare('SELECT count(*) AS n FROM neko_publications').first()).n, 0)
  const keyId = Buffer.alloc(32, 2).toString('base64')
  const attestation = await issueChallenge(env.NEKOS_DB, env, { uid: UID, purpose: 'attest', keyId }, 'ios')
  assert.equal((await productionHandle(post('/mutation', { uid: UID, platform: 'ios', assertion: 'fake',
    challengeId: attestation.id, clientData: attestation.clientData }), { ...env, OWNER_WRITES_ENABLED: 'verified' })).status, 409)
})

test('Android の判定は requestHash・署名・package・license・device を全部一致させる', () => {
  const now = Date.now()
  const verdict = { requestDetails: { requestHash: 'hash', requestPackageName: 'com.ccya.nekokintai', timestampMillis: String(now) },
    appIntegrity: { packageName: 'com.ccya.nekokintai', appRecognitionVerdict: 'PLAY_RECOGNIZED',
      certificateSha256Digest: [PLAY_APP_SIGNING_DIGEST] },
    deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] }, accountDetails: { appLicensingVerdict: 'LICENSED' } }
  assert.doesNotThrow(() => validateAndroidVerdict(verdict, 'hash', now))
  for (const override of [{ requestDetails: { ...verdict.requestDetails, requestHash: 'wrong' } },
    { appIntegrity: { ...verdict.appIntegrity, certificateSha256Digest: [] } }, { accountDetails: { appLicensingVerdict: 'UNLICENSED' } },
    { deviceIntegrity: { deviceRecognitionVerdict: [] } }, { testingDetails: { isTestingResponse: true } }]) {
    assert.throws(() => validateAndroidVerdict({ ...verdict, ...override }, 'hash', now), /device_proof_invalid/)
  }
})
