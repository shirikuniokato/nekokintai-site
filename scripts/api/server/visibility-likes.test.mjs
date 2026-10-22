import assert from 'node:assert/strict'
import test from 'node:test'
import { publishPublication, registerOwner } from '../../../server/nekos/publications.mjs'
import { getPublicPublication, listNewestPublications } from '../../../server/nekos/queries.mjs'
import { setPublicationLike } from '../../../server/nekos/likes.mjs'
import { databaseFor, publication, OWNER, OTHER_OWNER, IP } from './helpers.mjs'

test('並行する同じIPのいいねは1つで、追加・取消を繰り返しても増減しすぎない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  const input = { publicationId: id, ipHash: IP, liked: true, now: 101 }
  await Promise.all(Array.from({ length: 8 }, () => setPublicationLike(database, input)))
  assert.equal((await getPublicPublication(database, id)).likes, 1)
  await setPublicationLike(database, { ...input, ipHash: 'f'.repeat(64) })
  assert.equal((await getPublicPublication(database, id)).likes, 2)
  await Promise.all(Array.from({ length: 8 }, () => setPublicationLike(database, { ...input, liked: false })))
  assert.equal((await getPublicPublication(database, id)).likes, 1)
})

test('運営の非表示・飼い主の停止は直リンク・一覧・新しいいいねにも適用する', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await database.prepare('UPDATE neko_owners SET suspended_at = 101 WHERE owner_hash = ?').bind(OWNER).run()
  assert.equal(await getPublicPublication(database, id), null)
  assert.deepEqual(await listNewestPublications(database, {}), [])
  assert.equal(await setPublicationLike(database, { publicationId: id, ipHash: IP, liked: true, now: 102 }), null)
  await registerOwner(database, { ownerHash: OWNER, publicToken: 'f'.repeat(64), now: 103 })
  assert.equal((await publishPublication(database, publication({ expectedGeneration: 'first', expectedRevision: 1 }))).status, 'conflict')
  assert.equal((await database.prepare('SELECT public_token FROM neko_owners WHERE owner_hash = ?').bind(OWNER).first()).public_token, 'd'.repeat(64))
  await database.prepare('UPDATE neko_owners SET suspended_at = NULL WHERE owner_hash = ?').bind(OWNER).run()
  await database.prepare('UPDATE neko_publications SET moderated_at = 104 WHERE id = ?').bind(id).run()
  assert.equal(await getPublicPublication(database, id), null)
  assert.equal((await publishPublication(database, publication({ expectedGeneration: 'first', expectedRevision: 1 }))).status, 'conflict')
})

test('ブロックは一覧と直リンクに適用し、新しい順の次ページで重複させない', async (context) => {
  const database = await databaseFor(context)
  await publishPublication(database, publication())
  await publishPublication(database, publication({ slot: 2 }))
  await publishPublication(database, publication({ ownerHash: OTHER_OWNER, now: 99 }))
  const first = await listNewestPublications(database, { limit: 1 })
  const second = await listNewestPublications(database, { limit: 2,
    before: { createdAt: first[0].created_at, id: first[0].id } })
  assert.equal(second.length, 2)
  assert.ok(second.every((row) => row.id !== first[0].id))
  const blocked = await listNewestPublications(database, { blockedOwners: ['d'.repeat(64)] })
  assert.equal(blocked.length, 1)
  assert.equal(blocked[0].owner, 'e'.repeat(64))
  assert.equal(await getPublicPublication(database, first[0].id, ['d'.repeat(64)]), null)
})
