import test from 'node:test'
import assert from 'node:assert/strict'
import { databaseFor, publication } from './helpers.mjs'
import { publishPublication } from '../../../server/nekos/publications.mjs'
import { submitReport } from '../../../server/nekos/reports.mjs'
import { deliverNotification } from '../../../server/nekos/notifications.mjs'

test('通知を並行処理しても1つだけが lease を取り、本文や IP を Slack へ送らない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await submitReport(database, { id, revision: 1, targetKind: 'owner', reason: '<!channel> private reason', ipHash: 'f'.repeat(64), now: 100 })
  const query = async ({ sql, params }) => (await database.prepare(sql).bind(...params).all()).results
  const fetch = context.mock.fn(async (_url, options) => {
    assert.equal(options.body.includes('private reason'), false)
    assert.equal(options.body.includes('<!channel>'), false)
    assert.equal(options.body.includes('f'.repeat(64)), false)
    return new Response('ok')
  })
  const results = await Promise.all([deliverNotification(query, 'test-webhook', { now: 1000, fetch }),
    deliverNotification(query, 'test-webhook', { now: 1000, fetch })])
  assert.deepEqual(results.map((result) => result.status).sort(), ['empty', 'sent'])
  assert.equal(fetch.mock.callCount(), 1)
})

test('送信失敗は内容を保存せず再送時刻を残し、時刻が来るまで送らない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await submitReport(database, { id, revision: 1, targetKind: 'publication', reason: 'test', ipHash: 'f'.repeat(64), now: 100 })
  const query = async ({ sql, params }) => (await database.prepare(sql).bind(...params).all()).results
  const fetch = context.mock.fn(async () => { throw new Error('secret-webhook-path') })
  assert.equal((await deliverNotification(query, 'test', { now: 1000, fetch })).status, 'failed')
  assert.equal((await deliverNotification(query, 'test', { now: 1001, fetch })).status, 'empty')
  const row = await database.prepare('SELECT * FROM neko_report_notifications').first()
  assert.equal(row.last_error, 'delivery_failed')
  assert.equal(row.attempts, 1)
  const success = context.mock.fn(async () => new Response('ok'))
  assert.equal((await deliverNotification(query, 'test', { now: row.next_attempt_at, fetch: success })).status, 'sent')
})
