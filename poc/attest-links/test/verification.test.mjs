import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import cbor from 'cbor'
import { verifyIosAttestation, verifyIosAssertion } from '../src/verification.mjs'

const fixture = JSON.parse(await readFile('node_modules/node-app-attest/test/fixtures/attestation-development.json', 'utf8'))
const input = { attestation: Buffer.from(fixture.attestation, 'base64'),
  challenge: Buffer.from(fixture.challenge, 'base64'), keyId: fixture.keyId }
const policy = { bundleId: 'io.uebelacker.AppAttestExample', appIdPrefix: 'V8H6LQ9448' }
const historicalTime = Date.parse('2024-02-05T00:00:00Z')

test('過去のfixtureは構造検証には使えるが、いまの有効期限検査では拒否する', () => {
  assert.equal(verifyIosAttestation(input, policy, historicalTime).evidence.aaguid, 'appattestdevelop')
  assert.throws(() => verifyIosAttestation(input, policy), /certificate_expired/)
})

test('証明書の順序・nonce・アプリ識別子・余分なCBORを検査する', () => {
  const decoded = cbor.decodeAllSync(input.attestation)[0]
  const reversed = { ...decoded, attStmt: { ...decoded.attStmt, x5c: [...decoded.attStmt.x5c].reverse() } }
  assert.throws(() => verifyIosAttestation({ ...input, attestation: cbor.encode(reversed) }, policy, historicalTime), /certificate_order/)
  assert.throws(() => verifyIosAttestation({ ...input, challenge: 'changed' }, policy, historicalTime), /nonce/)
  assert.throws(() => verifyIosAttestation(input, { ...policy, bundleId: 'changed' }, historicalTime), /appId/)
  assert.throws(() => verifyIosAttestation({ ...input, attestation: Buffer.concat([input.attestation, cbor.encode(0)]) }, policy, historicalTime), /cbor_items/)
})

test('保存済みcounterを省略した呼び出しを許可しない', () => {
  assert.throws(() => verifyIosAssertion({ assertion: Buffer.alloc(0) }, policy), /stored_counter/)
})


test('設定で期限を延ばしても、コンパイル済みの試験期限を過ぎたら停止する', async () => {
  const { authorize } = await import('../src/router.mjs')
  const request = new Request('https://example.com/', { headers: { Authorization: 'Bearer fixture' } })
  const env = { POC_ACCESS_TOKEN: 'fixture', POC_EXPIRES_AT: '2099-01-01T00:00:00Z' }
  authorize(request, env, Date.parse('2026-10-26T14:59:59Z'))
  assert.throws(() => authorize(request, env, Date.parse('2026-10-26T15:00:00Z')), /poc_disabled/)
})
