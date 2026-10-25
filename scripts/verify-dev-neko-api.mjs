import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { readTarget, connectDatabase } from './neko-ops/database.mjs'
import { runOperation } from './neko-ops/run.mjs'

const BASE = 'https://nekokintai-sharing-dev.pages.dev/api/nekos'
const UID = `smoke-${randomUUID()}`
const targetFile = `${homedir()}/.config/nekokintai-sharing/dev-target.json`
const target = await readTarget({ environment: 'dev', 'target-config': targetFile })
assert.equal(target.databaseId, '2b8dfa8e-699b-419b-ac5c-985e72388d32')
const query = await connectDatabase(target)

async function api(path, method = 'GET', body, status = 200) {
  const response = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const result = await response.json()
  assert.equal(response.status, status, JSON.stringify(result))
  return result
}

function payload(overrides = {}) {
  return { operationId: randomUUID(), action: 'publish', slot: 1, generation: 'first',
    expectedGeneration: null, expectedRevision: 0, code: 'AQD_____pEIkIR0AAAAAAAAmytT_rq4',
    name: 'API検証', author: '', locale: 'ja', ...overrides }
}

async function mutate(value) {
  const challenge = await api('/challenge', 'POST', { uid: UID, purpose: 'mutation', payload: value })
  const input = { uid: UID, challengeId: challenge.id, clientData: challenge.clientData }
  const result = await api('/mutation', 'POST', input)
  assert.deepEqual(await api('/mutation', 'POST', input), result)
  return result.publication
}

async function operation(action, id, revision) {
  return runOperation({ command: action, mutation: true, environment: 'dev', 'target-config': targetFile,
    target: id, revision: String(revision), reason: '開発環境の動作確認', actor: 'development-check',
    'operation-id': randomUUID(), apply: true })
}

const published = await mutate(payload())
const { cat } = await api(`/${published.id}`)
assert.equal(cat.name, 'API検証')
assert.equal((await api(`/${published.id}/like`, 'PUT', { liked: true })).likes, 1)
assert.equal((await api(`/${published.id}/like`, 'PUT', { liked: true })).likes, 1)
await api(`/${published.id}/reports`, 'POST', { revision: 1, targetKind: 'owner', reason: '開発環境の通報確認' }, 202)
await operation('hide', published.id, 1)
await api(`/${published.id}`, 'GET', undefined, 404)
await operation('unhide', published.id, 2)
await api(`/${published.id}`)
await operation('suspend', cat.owner, 1)
await api(`/${published.id}`, 'GET', undefined, 404)
await operation('unsuspend', cat.owner, 2)
const [settings] = await query({ sql: 'SELECT revision FROM neko_settings WHERE id = 1', params: [] })
await operation('pause', 'publishing', settings.revision)
const stopped = await api('/challenge', 'POST', { uid: UID, purpose: 'mutation', payload: payload({ slot: 2 }) })
await api('/mutation', 'POST', { uid: UID, challengeId: stopped.id, clientData: stopped.clientData }, 409)
const withdrawn = await mutate(payload({ action: 'withdraw', expectedGeneration: 'first', expectedRevision: 3 }))
assert.ok(withdrawn.withdrawnAt)
await operation('resume', 'publishing', settings.revision + 1)
const returned = await mutate(payload({ expectedGeneration: 'first', expectedRevision: 4 }))
assert.equal(returned.id, published.id)
await operation('remove', published.id, 5)
await api(`/${published.id}`, 'GET', undefined, 404)
const reports = await query({ sql: 'SELECT id, revision FROM neko_reports WHERE publication_id = ?', params: [published.id] })
for (const report of reports) await operation('resolve', String(report.id), report.revision)
console.log(JSON.stringify({ status: 'passed', environment: 'development', publicationId: published.id,
  verified: ['publish', 'retry', 'like', 'report', 'hide', 'unhide', 'suspend', 'unsuspend', 'pause', 'withdraw', 'resume', 'republish', 'remove', 'resolve'] }))
