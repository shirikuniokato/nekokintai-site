import assert from 'node:assert/strict'
import test from 'node:test'
import { publishPublication, retirePublication } from '../../../server/nekos/publications.mjs'
import { readCurrentPublication } from '../../../server/nekos/queries.mjs'
import { databaseFor, publication, OWNER, OTHER_OWNER } from './helpers.mjs'

test('同じ版からの並行入れ替えは1つだけが勝ち、負けた行を残さない', async (context) => {
  const database = await databaseFor(context)
  const original = await publishPublication(database, publication())
  const outcomes = await Promise.all(['second', 'third'].map((generation) =>
    publishPublication(database, publication({ generation, expectedGeneration: 'first', expectedRevision: 1 }))))
  const winners = outcomes.filter((result) => result.status === 'published')
  assert.equal(winners.length, 1)
  const current = await readCurrentPublication(database, OWNER, 1)
  assert.equal(current.id, winners[0].id)
  assert.notEqual(current.id, original.id)
  const count = await database.prepare('SELECT count(*) AS count FROM neko_publications').first()
  assert.equal(count.count, 2)
})

test('他の飼い主の現在の世代・版を指定しても、編集・終了・入れ替えはできない', async (context) => {
  const database = await databaseFor(context)
  const original = await publishPublication(database, publication())
  const outcome = await publishPublication(database, publication({ ownerHash: OTHER_OWNER,
    expectedGeneration: 'first', expectedRevision: 1 }))
  assert.equal(outcome.status, 'conflict')
  const replacement = await publishPublication(database, publication({ ownerHash: OTHER_OWNER,
    generation: 'second', expectedGeneration: 'first', expectedRevision: 1 }))
  assert.equal(replacement.status, 'conflict')
  const retired = await retirePublication(database, {
    id: original.id, ownerHash: OTHER_OWNER, expectedRevision: 1, now: 101,
  })
  assert.equal(retired.meta.changes, 0)
  assert.equal((await readCurrentPublication(database, OWNER, 1)).revision, 1)
  assert.equal(await readCurrentPublication(database, OTHER_OWNER, 1), null)
})

test('投稿者の停止と1投稿の非表示を区別し、停止中は新しい世代にも入れ替えられない', async (context) => {
  const database = await databaseFor(context)
  const original = await publishPublication(database, publication())
  await database.prepare('UPDATE neko_publications SET moderated_at = 101 WHERE id = ?').bind(original.id).run()
  const allowed = await publishPublication(database, publication({ generation: 'second',
    expectedGeneration: 'first', expectedRevision: 1 }))
  assert.equal(allowed.status, 'published')
  await database.prepare('UPDATE neko_owners SET suspended_at = 102 WHERE owner_hash = ?').bind(OWNER).run()
  const rejected = await publishPublication(database, publication({ generation: 'third',
    expectedGeneration: 'second', expectedRevision: 1 }))
  assert.equal(rejected.status, 'conflict')
  assert.equal((await readCurrentPublication(database, OWNER, 1)).id, allowed.id)
})

test('編集・入れ替えの応答を失ったときは上書きせず現在の世代と版を読み直せる', async (context) => {
  const database = await databaseFor(context)
  await publishPublication(database, publication())
  const edit = publication({ name: 'そら', expectedGeneration: 'first', expectedRevision: 1 })
  await publishPublication(database, edit)
  assert.equal((await publishPublication(database, edit)).status, 'conflict')
  const edited = await readCurrentPublication(database, OWNER, 1)
  assert.equal(edited.name, 'そら')
  assert.equal(edited.revision, 2)
  const replacement = publication({ generation: 'second', expectedGeneration: 'first', expectedRevision: 2 })
  const replaced = await publishPublication(database, replacement)
  assert.equal((await publishPublication(database, replacement)).status, 'conflict')
  const current = await readCurrentPublication(database, OWNER, 1)
  assert.equal(current.id, replaced.id)
  assert.equal(current.generation, 'second')
})
