export const VISIBLE_PUBLICATION = `p.withdrawn_at IS NULL AND p.replaced_at IS NULL
  AND p.moderated_at IS NULL AND p.deleted_at IS NULL AND o.suspended_at IS NULL
  AND EXISTS (SELECT 1 FROM neko_slots s WHERE s.publication_id = p.id)`

// private な owner_hash を公開用の戻り値に含めない。
const PUBLIC_COLUMNS = `p.id, p.code, p.name, p.author, p.revision, o.public_token AS owner,
  p.created_at, p.updated_at,
  (SELECT count(*) FROM neko_likes l WHERE l.publication_id = p.id) AS likes`

export function getPublicPublication(database, publicationId, blockedOwners = []) {
  if (!Array.isArray(blockedOwners) || blockedOwners.length > 100) throw new Error('ブロックの一覧が正しくありません')
  const blocking = blockedOwners.map(() => '?').join(',')
  return database.prepare(`SELECT ${PUBLIC_COLUMNS} FROM neko_publications p
    JOIN neko_owners o ON o.owner_hash = p.owner_hash
    WHERE p.id = ? AND ${VISIBLE_PUBLICATION}
    ${blocking ? `AND o.public_token NOT IN (${blocking})` : ''}`).bind(publicationId, ...blockedOwners).first()
}

export async function listNewestPublications(database, options) {
  const { limit = 20, before = null, blockedOwners = [] } = options
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || blockedOwners.length > 100) {
    throw new Error('一覧の取得条件が正しくありません')
  }
  const blocking = blockedOwners.map(() => '?').join(',')
  const result = await database.prepare(`SELECT ${PUBLIC_COLUMNS} FROM neko_publications p
    JOIN neko_owners o ON o.owner_hash = p.owner_hash WHERE ${VISIBLE_PUBLICATION}
    ${before ? 'AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))' : ''}
    ${blocking ? `AND o.public_token NOT IN (${blocking})` : ''}
    ORDER BY p.created_at DESC, p.id DESC LIMIT ?`).bind(
    ...(before ? [before.createdAt, before.createdAt, before.id] : []), ...blockedOwners, limit,
  ).all()
  return result.results
}

export function readCurrentPublication(database, ownerHash, slot) {
  return database.prepare(`SELECT p.* FROM neko_slots s
    JOIN neko_publications p ON p.id = s.publication_id
    WHERE s.owner_hash = ? AND s.slot = ?`).bind(ownerHash, slot).first()
}
