import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArguments } from '../../neko-ops/arguments.mjs'
import { runOperation } from '../../neko-ops/run.mjs'
import { localSql, connectDatabase, readTarget } from '../../neko-ops/database.mjs'
import { operationStatement, reportsStatement } from '../../../server/nekos/operations.mjs'
import { databaseFor } from './helpers.mjs'

const TARGET = { environment: 'local' }
const PAUSE = ['pause', '--environment', 'local', '--revision', '1', '--reason', '緊急停止', '--actor', 'operator']

function useTestToken(context) {
  const previous = process.env.CLOUDFLARE_API_TOKEN
  context.after(() => {
    if (previous === undefined) delete process.env.CLOUDFLARE_API_TOKEN
    else process.env.CLOUDFLARE_API_TOKEN = previous
  })
  process.env.CLOUDFLARE_API_TOKEN = 'test-token'
}

test('環境・対象設定・版・理由・操作者を必須にし、誤った引数で書き込まない', () => {
  for (const values of [[], ['status'], ['status', '--environment', 'prod'],
    ['status', '--environment', 'production'], ['publication', '--environment', 'local'],
    ['status', '--environment', 'local', '--apply'], [...PAUSE, '--unknown'],
    [...PAUSE, '--revision', '2']]) assert.throws(() => parseArguments(values))
  assert.equal(parseArguments(['status', '--environment', 'production', '--target-config', 'prod.json']).environment, 'production')
  const valid = { id: 'op-1', action: 'hide', target: 'post', expectedRevision: 1, reason: '理由', actor: 'operator' }
  for (const override of [{ expectedRevision: 0 }, { expectedRevision: NaN }, { reason: '' },
    { actor: '' }, { reason: '長'.repeat(501) }, { action: 'other' },
    { action: 'resolve', target: '01' }, { action: 'suspend', target: 'private-id' }]) {
    assert.throws(() => operationStatement({ ...valid, ...override }))
  }
  assert.throws(() => reportsStatement({ limit: 101 }))
  assert.throws(() => reportsStatement({ after: -1 }))
})

test('計画は接続・書き込みを行わず、local の引用符付き理由も SQL へ安全に渡す', async (context) => {
  const options = parseArguments(PAUSE)
  const result = await runOperation(options, { readTarget: async () => TARGET,
    connectDatabase: async () => { throw new Error('plan must not connect') } })
  assert.equal(result.status, 'plan')
  assert.ok(result.operationId)
  const database = await databaseFor(context)
  const reason = "理由'); DELETE FROM neko_settings; -- ?\n次の行"
  const statement = operationStatement({ id: 'quote-test', action: 'pause', target: 'publishing',
    expectedRevision: 1, reason, actor: 'operator' })
  await database.prepare(localSql(statement)).run()
  assert.equal((await database.prepare('SELECT reason FROM neko_operations').first()).reason, reason)
  assert.equal((await database.prepare('SELECT count(*) AS count FROM neko_settings').first()).count, 1)
})

test('適用と同じ操作IDでの再確認は同じ監査を返し、異なる payload を再実行しない', async (context) => {
  const database = await databaseFor(context)
  const query = async ({ sql, params }) => (await database.prepare(sql).bind(...params).all()).results
  const dependencies = { readTarget: async () => TARGET, connectDatabase: async () => query }
  const options = parseArguments([...PAUSE, '--operation-id', 'pause-once', '--apply'])
  assert.equal((await runOperation(options, dependencies)).status, 'applied')
  assert.equal((await runOperation(options, dependencies)).status, 'already-applied')
  await assert.rejects(runOperation({ ...options, reason: '別の理由' }, dependencies), /別の操作/)
  assert.equal((await database.prepare('SELECT revision FROM neko_settings').first()).revision, 2)
  assert.equal((await database.prepare('SELECT count(*) AS count FROM neko_operations').first()).count, 1)
})

test('応答を失ったら操作IDを返して停止し、監査を確認してから同じIDで回復できる', async (context) => {
  const database = await databaseFor(context)
  const query = async ({ sql, params }) => (await database.prepare(sql).bind(...params).all()).results
  const dependencies = { readTarget: async () => TARGET, connectDatabase: async () => async (statement) => {
    const result = await query(statement)
    if (statement.sql.startsWith('INSERT')) throw new Error('接続が切れました')
    return result
  } }
  const options = parseArguments([...PAUSE, '--operation-id', 'lost-response', '--apply'])
  await assert.rejects(runOperation(options, dependencies), /lost-response.*自動再試行/s)
  const recovered = await runOperation(options, { ...dependencies, connectDatabase: async () => query })
  assert.equal(recovered.status, 'already-applied')
  assert.equal((await database.prepare('SELECT revision FROM neko_settings').first()).revision, 2)
})

test('remote は実 DB の名前・ID を確認し、単一 SQL と bind パラメータを送る', async (context) => {
  useTestToken(context)
  const target = { environment: 'dev', accountId: 'a'.repeat(32),
    databaseId: '11111111-1111-1111-1111-111111111111', databaseName: 'nekos-dev' }
  const mock = context.mock.method(globalThis, 'fetch', async (_url, options) => {
    return Response.json({ success: true, result: options.method === 'POST'
      ? [{ success: true, results: [{ revision: 1 }] }] : { name: target.databaseName, uuid: target.databaseId } })
  })
  const query = await connectDatabase(target)
  assert.deepEqual(await query({ sql: 'SELECT ? AS revision', params: [1] }), [{ revision: 1 }])
  const requests = mock.mock.calls.map((call) => ({ url: call.arguments[0], options: call.arguments[1] }))
  assert.equal(requests.length, 2)
  assert.deepEqual(JSON.parse(requests[1].options.body), { sql: 'SELECT ? AS revision', params: ['1'] })
  assert.equal(requests[1].options.headers.Authorization, 'Bearer test-token')
  context.mock.method(globalThis, 'fetch', async () => Response.json({ success: true,
    result: { name: 'wrong-database', uuid: target.databaseId } }))
  await assert.rejects(connectDatabase(target), /一致しません/)
})

test('remote の失敗を再試行せず、API エラーに含まれる SQL や本文を出力しない', async (context) => {
  useTestToken(context)
  const target = { environment: 'dev', accountId: 'a'.repeat(32),
    databaseId: '11111111-1111-1111-1111-111111111111', databaseName: 'nekos-dev' }
  const mock = context.mock.method(globalThis, 'fetch', async (_url, options) => Response.json(options.method === 'POST'
    ? { success: false, errors: [{ message: 'secret SQL reason' }] }
    : { success: true, result: { name: target.databaseName, uuid: target.databaseId } }))
  const query = await connectDatabase(target)
  await assert.rejects(query({ sql: 'SELECT 1', params: [] }), (error) => !error.message.includes('secret SQL'))
  assert.equal(mock.mock.callCount(), 2)
  assert.equal((await readTarget({ environment: 'local' })).databaseName, 'nekokintai-nekos-local')
})
