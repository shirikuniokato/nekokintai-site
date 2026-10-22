import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { databaseFor, publication, OWNER, IP } from './helpers.mjs'
import { publishPublication, withdrawPublication } from '../../../server/nekos/publications.mjs'
import { getPublicPublication, listNewestPublications, readCurrentPublication } from '../../../server/nekos/queries.mjs'
import { setPublicationLike } from '../../../server/nekos/likes.mjs'
import { operationStatement, reportsStatement } from '../../../server/nekos/operations.mjs'

function operation(database, action, target, expectedRevision, overrides = {}) {
  const statement = operationStatement({ id: randomUUID(), action, target, expectedRevision,
    reason: '通報を確認', actor: 'test-operator', ...overrides })
  return database.prepare(statement.sql).bind(...statement.params).run()
}

async function assertConflict(database, action, target, revision) {
  const before = await database.prepare('SELECT count(*) AS count FROM neko_operations').first()
  await assert.rejects(operation(database, action, target, revision), /operation_conflict/)
  assert.deepEqual(await database.prepare('SELECT count(*) AS count FROM neko_operations').first(), before)
}

test('非表示・復帰・永久公開終了は監査と同時に確定し、古い版・不正状態では両方を変更しない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await operation(database, 'hide', id, 1)
  assert.equal(await getPublicPublication(database, id), null)
  await assertConflict(database, 'hide', id, 2)
  await assertConflict(database, 'unhide', id, 1)
  assert.equal((await readCurrentPublication(database, OWNER, 1)).revision, 2)
  await operation(database, 'unhide', id, 2)
  assert.ok(await getPublicPublication(database, id))
  await assertConflict(database, 'unhide', id, 3)
  await operation(database, 'remove', id, 3)
  await assertConflict(database, 'remove', id, 4)
  await assertConflict(database, 'unhide', id, 4)
  await assertConflict(database, 'hide', 'missing', 1)
  const row = await readCurrentPublication(database, OWNER, 1)
  assert.equal(row.revision, 4)
  assert.ok(row.deleted_at)
  const audit = await database.prepare('SELECT * FROM neko_operations ORDER BY rowid').all()
  assert.deepEqual(audit.results.map((entry) => entry.action), ['hide', 'unhide', 'remove'])
  assert.ok(audit.results.every((entry) => entry.created_at > 1_000_000_000_000))
})

test('永久公開終了は一覧・直リンク・いいね・同世代の再公開を拒否し、別世代への交換は許す', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await setPublicationLike(database, { publicationId: id, ipHash: IP, liked: true, now: 101 })
  await operation(database, 'remove', id, 1)
  assert.equal(await getPublicPublication(database, id), null)
  assert.deepEqual(await listNewestPublications(database, {}), [])
  assert.equal(await setPublicationLike(database, { publicationId: id, ipHash: IP, liked: true, now: 102 }), null)
  const current = publication({ expectedGeneration: 'first', expectedRevision: 2 })
  assert.equal((await publishPublication(database, current)).status, 'conflict')
  assert.equal((await database.prepare('SELECT count(*) AS count FROM neko_likes').first()).count, 1)
  assert.equal((await publishPublication(database, { ...current, generation: 'second' })).status, 'published')
})

test('全体停止は新規・編集・再公開・交換を拒否し、閲覧・取り下げを妨げない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await assertConflict(database, 'resume', 'publishing', 1)
  const pause = operationStatement({ id: randomUUID(), action: 'pause', target: 'publishing',
    expectedRevision: 1, reason: 'REST と同じ型', actor: 'operator' })
  await database.prepare(pause.sql).bind(...pause.params.map(String)).run()
  await assertConflict(database, 'pause', 'publishing', 2)
  await assertConflict(database, 'resume', 'publishing', 1)
  assert.ok(await getPublicPublication(database, id))
  assert.equal((await publishPublication(database, publication({ slot: 2 }))).status, 'conflict')
  const edit = publication({ expectedGeneration: 'first', expectedRevision: 1 })
  assert.equal((await publishPublication(database, edit)).status, 'conflict')
  assert.equal((await publishPublication(database, { ...edit, generation: 'second' })).status, 'conflict')
  await withdrawPublication(database, { id, ownerHash: OWNER, expectedRevision: 1, now: 102 })
  assert.equal((await publishPublication(database, { ...edit, expectedRevision: 2 })).status, 'conflict')
  await operation(database, 'resume', 'publishing', 2)
  assert.equal((await publishPublication(database, { ...edit, expectedRevision: 2 })).status, 'published')
  await database.prepare('DELETE FROM neko_settings').run()
  assert.equal((await publishPublication(database, publication({ slot: 3 }))).status, 'conflict')
  assert.equal((await publishPublication(database, { ...edit, expectedRevision: 3 })).status, 'conflict')
})

test('飼い主停止は別世代・別枠も止め、解除しても投稿の非表示は独立して残る', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  const owner = 'd'.repeat(64)
  await assertConflict(database, 'unsuspend', owner, 1)
  await operation(database, 'suspend', owner, 1)
  await assertConflict(database, 'suspend', owner, 2)
  await assertConflict(database, 'unsuspend', owner, 1)
  await assertConflict(database, 'suspend', 'f'.repeat(64), 1)
  assert.equal((await publishPublication(database, publication({ slot: 2 }))).status, 'conflict')
  assert.equal((await publishPublication(database, publication({ generation: 'second',
    expectedGeneration: 'first', expectedRevision: 1 }))).status, 'conflict')
  await operation(database, 'hide', id, 1)
  await operation(database, 'unsuspend', owner, 2)
  assert.equal(await getPublicPublication(database, id), null)
  assert.equal((await publishPublication(database, publication({ slot: 2 }))).status, 'published')
})

test('投稿・飼い主の通報一覧は編集差分を検出でき、処理済みは消え、古い操作は記録しない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  for (const kind of ['publication', 'owner']) {
    await database.prepare(`INSERT INTO neko_reports (publication_id, publication_revision, target_kind, reason, created_at)
      VALUES (?, 1, ?, '確認してください', 100)`).bind(id, kind).run()
  }
  await publishPublication(database, publication({ expectedGeneration: 'first', expectedRevision: 1, name: 'ひる' }))
  const statement = reportsStatement({ limit: 1 })
  const first = (await database.prepare(statement.sql).bind(...statement.params).all()).results[0]
  assert.equal(first.publication_revision, 1)
  assert.equal(first.current_publication_revision, 2)
  assert.equal(first.owner, 'd'.repeat(64))
  assert.equal(Object.hasOwn(first, 'owner_hash'), false)
  await assertConflict(database, 'resolve', '1', 2)
  await operation(database, 'resolve', '1', 1)
  await assertConflict(database, 'resolve', '1', 2)
  await assertConflict(database, 'resolve', '999', 1)
  const pending = reportsStatement({ after: 1 })
  const rows = (await database.prepare(pending.sql).bind(...pending.params).all()).results
  assert.deepEqual(rows.map((row) => row.target_kind), ['owner'])
  const all = reportsStatement({ includeResolved: true })
  assert.equal((await database.prepare(all.sql).bind(...all.params).all()).results.length, 2)
  await database.prepare(`INSERT INTO neko_reports (publication_id, publication_revision, target_kind, reason, created_at)
    VALUES (?, 2, 'publication', '未来の受付日時', ?)`).bind(id, Date.now() + 86_400_000).run()
  const before = await database.prepare('SELECT count(*) AS count FROM neko_operations').first()
  await assert.rejects(operation(database, 'resolve', '3', 1), /CHECK/)
  assert.deepEqual(await database.prepare('SELECT count(*) AS count FROM neko_operations').first(), before)
  assert.deepEqual(await database.prepare('SELECT revision, resolved_at FROM neko_reports WHERE id = 3').first(),
    { revision: 1, resolved_at: null })
})

test('並行する編集と非表示は片方だけ通り、同一操作ID・未知操作の再送を成功扱いしない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  const results = await Promise.allSettled([
    operation(database, 'hide', id, 1),
    publishPublication(database, publication({ expectedGeneration: 'first', expectedRevision: 1 })),
  ])
  const hidden = results[0].status === 'fulfilled'
  assert.equal(results[1].value.status === 'published', !hidden)
  assert.equal((await readCurrentPublication(database, OWNER, 1)).revision, 2)
  const operationId = randomUUID()
  await operation(database, 'remove', id, 2, { id: operationId })
  await assert.rejects(operation(database, 'remove', id, 2, { id: operationId }), /UNIQUE/)
  await assert.rejects(database.prepare(`INSERT INTO neko_operations (id, action, target, expected_revision, reason, actor)
    VALUES ('unknown', 'unknown', ?, 1, 'test', 'operator')`).bind(id).run(), /CHECK/)
  assert.equal((await readCurrentPublication(database, OWNER, 1)).revision, 3)
})
