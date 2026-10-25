import assert from 'node:assert/strict'
import test from 'node:test'
import { publishPublication, withdrawPublication, retirePublication } from '../../../server/nekos/publications.mjs'
import { getPublicPublication, readCurrentPublication } from '../../../server/nekos/queries.mjs'
import { setPublicationLike } from '../../../server/nekos/likes.mjs'
import { databaseFor, publication, OWNER, OTHER_OWNER, IP, CODE } from './helpers.mjs'

test('取り下げ・再公開と色の変更でページ・いいね・自動名を引き継ぐ', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication({ name: '' }))
  await setPublicationLike(database, { publicationId: id, ipHash: IP, liked: true, now: 101 })
  await withdrawPublication(database, { id: id, ownerHash: OWNER, expectedRevision: 1, now: 102 })
  assert.equal(await getPublicPublication(database, id), null)
  const changedCode = `${CODE.slice(0, -1)}0`
  const result = await publishPublication(database, publication({ expectedGeneration: 'first',
    expectedRevision: 2, name: '', code: changedCode, fallbackPlace: 7, now: 103 }))
  assert.deepEqual(result, { status: 'published', id, revision: 3 })
  const restored = await getPublicPublication(database, id)
  // 付けた名前は空のまま。野良ねこの場所は最初に決めた番号から変わらない
  assert.equal(restored.name, '')
  assert.equal(restored.fallbackPlace, 2)
  assert.equal(restored.likes, 1)
  assert.equal(restored.code, changedCode)
  assert.equal(restored.created_at, 100)
  assert.equal(restored.owner_hash, undefined)
})

test('枠の入れ替えは新しいページになり、古い世代を再公開できない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await setPublicationLike(database, { publicationId: id, ipHash: IP, liked: true, now: 101 })
  const second = publication({ generation: 'second',
    expectedGeneration: 'first', expectedRevision: 1, now: 102 })
  const replacement = await publishPublication(database, second)
  assert.equal(replacement.status, 'published')
  assert.notEqual(replacement.id, id)
  assert.equal(await getPublicPublication(database, id), null)
  assert.equal((await getPublicPublication(database, replacement.id)).likes, 0)
  const stale = await publishPublication(database, publication({
    expectedGeneration: 'second', expectedRevision: 1 }))
  assert.equal(stale.status, 'conflict')
  assert.equal((await readCurrentPublication(database, OWNER, 1)).id, replacement.id)
})

test('同時の新規投稿は1つだけが枠を取り、取り残された行を作らない', async (context) => {
  const database = await databaseFor(context)
  const outcomes = await Promise.all([
    publishPublication(database, publication()),
    publishPublication(database, publication({ generation: 'another' })),
  ])
  assert.equal(outcomes.filter((result) => result.status === 'published').length, 1)
  const count = await database.prepare('SELECT count(*) AS count FROM neko_publications').first()
  assert.equal(count.count, 1)
})

test('同じ版からの並行編集・取り下げは片方だけ通し、別の飼い主には変更させない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  const withdrawal = await withdrawPublication(database, {
    id: id, ownerHash: OTHER_OWNER, expectedRevision: 1, now: 101,
  })
  assert.equal(withdrawal.meta.changes, 0)
  const results = await Promise.all([
    publishPublication(database, publication({ name: 'そら', expectedGeneration: 'first', expectedRevision: 1 })),
    withdrawPublication(database, { id: id, ownerHash: OWNER, expectedRevision: 1, now: 102 }),
  ])
  assert.equal(Number(results[0].status === 'published') + results[1].meta.changes, 1)
})

test('入れ替えだけを通知した枠の古いねこは再公開できない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await retirePublication(database, { id: id, ownerHash: OWNER, expectedRevision: 1, now: 101 })
  assert.equal(await getPublicPublication(database, id), null)
  const result = await publishPublication(database, publication({ expectedGeneration: 'first', expectedRevision: 2 }))
  assert.equal(result.status, 'conflict')
})

test('枠の更新で失敗したら投稿の行も作らずバッチ全体を取り消す', async (context) => {
  const database = await databaseFor(context)
  await database.prepare(`CREATE TRIGGER reject_slot BEFORE INSERT ON neko_slots
    BEGIN SELECT RAISE(ABORT, 'test rejection'); END`).run()
  await assert.rejects(publishPublication(database, publication()), /test rejection/)
  const count = await database.prepare('SELECT count(*) AS count FROM neko_publications').first()
  assert.equal(count.count, 0)
})
