import { readCurrentPublication } from './queries.mjs'

export async function registerOwner(database, input) {
  const { ownerHash, publicToken, now } = input
  if (![ownerHash, publicToken].every((value) => /^[a-f0-9]{64}$/.test(value))) {
    throw new Error('飼い主の識別情報が正しくありません')
  }
  await database.prepare(`INSERT INTO neko_owners (owner_hash, public_token, created_at)
    VALUES (?, ?, ?) ON CONFLICT(owner_hash) DO NOTHING`).bind(ownerHash, publicToken, now).run()
}

function matchesExpected(current, input) {
  return current ? current.generation === input.expectedGeneration && current.revision === input.expectedRevision
    : input.expectedGeneration === null && input.expectedRevision === 0
}

export async function publishPublication(database, input) {
  const current = await readCurrentPublication(database, input.ownerHash, input.slot)
  if (!matchesExpected(current, input)) return { status: 'conflict' }
  if (current?.generation === input.generation) return updatePublication(database, input, current)
  const creation = { ...input, newId: crypto.randomUUID() }
  const results = await database.batch(replacementStatements(database, creation, current))
  return results[0].meta.changes === 1
    ? { status: 'published', id: creation.newId, revision: 1 } : { status: 'conflict' }
}

async function updatePublication(database, input, current) {
  const result = await database.prepare(`UPDATE neko_publications SET code = ?, name = ?,
    author = ?, updated_at = ?, withdrawn_at = NULL, revision = revision + 1
    WHERE id = ? AND revision = ? AND replaced_at IS NULL AND moderated_at IS NULL AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM neko_settings WHERE id = 1 AND publishing_paused = 0)
    AND EXISTS (SELECT 1 FROM neko_owners o WHERE o.owner_hash = ? AND o.suspended_at IS NULL)
    AND EXISTS (SELECT 1 FROM neko_slots s WHERE s.publication_id = ?)`)
    .bind(input.code, input.name || current.fallback_name, input.author, input.now,
      current.id, current.revision, input.ownerHash, current.id).run()
  return result.meta.changes === 1
    ? { status: 'published', id: current.id, revision: current.revision + 1 } : { status: 'conflict' }
}

function currentSlotGuard(input, current) {
  if (!current) return {
    sql: 'NOT EXISTS (SELECT 1 FROM neko_slots WHERE owner_hash = ? AND slot = ?)',
    values: [input.ownerHash, input.slot],
  }
  return {
    sql: `EXISTS (SELECT 1 FROM neko_slots s JOIN neko_publications p ON p.id = s.publication_id
      WHERE s.owner_hash = ? AND s.slot = ? AND p.id = ? AND p.revision = ?)`,
    values: [input.ownerHash, input.slot, current.id, current.revision],
  }
}

function replacementStatements(database, input, current) {
  const guard = currentSlotGuard(input, current)
  const insert = database.prepare(`INSERT INTO neko_publications
    (id, owner_hash, slot, generation, code, name, author, fallback_name, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM neko_owners WHERE owner_hash = ? AND suspended_at IS NULL)
    AND EXISTS (SELECT 1 FROM neko_settings WHERE id = 1 AND publishing_paused = 0)
    AND ${guard.sql} ON CONFLICT(owner_hash, slot, generation) DO NOTHING`).bind(
    input.newId, input.ownerHash, input.slot, input.generation, input.code,
    input.name || input.fallbackName, input.author, input.fallbackName, input.now, input.now,
    input.ownerHash, ...guard.values,
  )
  const claim = database.prepare(`INSERT INTO neko_slots (owner_hash, slot, publication_id)
    SELECT owner_hash, slot, id FROM neko_publications WHERE id = ?
    ON CONFLICT(owner_hash, slot) DO UPDATE SET publication_id = excluded.publication_id`)
    .bind(input.newId)
  const retire = database.prepare(`UPDATE neko_publications SET replaced_at = ?, revision = revision + 1
    WHERE id = ? AND EXISTS (SELECT 1 FROM neko_slots WHERE publication_id = ?)`)
    .bind(input.now, current?.id ?? '', input.newId)
  return [insert, claim, retire]
}

export function withdrawPublication(database, input) {
  return database.prepare(`UPDATE neko_publications SET withdrawn_at = ?, updated_at = ?,
    revision = revision + 1 WHERE id = ? AND owner_hash = ? AND revision = ?
    AND replaced_at IS NULL AND EXISTS (SELECT 1 FROM neko_slots WHERE publication_id = ?)`)
    .bind(input.now, input.now, input.id, input.ownerHash, input.expectedRevision, input.id).run()
}

export function retirePublication(database, input) {
  return database.prepare(`UPDATE neko_publications SET replaced_at = ?, updated_at = ?,
    revision = revision + 1 WHERE id = ? AND owner_hash = ? AND revision = ?
    AND replaced_at IS NULL AND EXISTS (SELECT 1 FROM neko_slots WHERE publication_id = ?)`)
    .bind(input.now, input.now, input.id, input.ownerHash, input.expectedRevision, input.id).run()
}
