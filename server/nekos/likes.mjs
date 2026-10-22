import { VISIBLE_PUBLICATION } from './queries.mjs'

export async function setPublicationLike(database, input) {
  const { publicationId, ipHash, liked, now } = input
  if (!/^[a-f0-9]{64}$/.test(ipHash) || typeof liked !== 'boolean') {
    throw new Error('いいねの識別情報が正しくありません')
  }
  const change = liked
    ? database.prepare(`INSERT INTO neko_likes (publication_id, ip_hash, created_at)
      SELECT p.id, ?, ? FROM neko_publications p
      JOIN neko_owners o ON o.owner_hash = p.owner_hash WHERE p.id = ? AND ${VISIBLE_PUBLICATION}
      ON CONFLICT(publication_id, ip_hash) DO NOTHING`).bind(ipHash, now, publicationId)
    : database.prepare('DELETE FROM neko_likes WHERE publication_id = ? AND ip_hash = ?')
      .bind(publicationId, ipHash)
  const count = database.prepare(`SELECT (SELECT count(*) FROM neko_likes l
    WHERE l.publication_id = p.id) AS likes FROM neko_publications p
    JOIN neko_owners o ON o.owner_hash = p.owner_hash WHERE p.id = ? AND ${VISIBLE_PUBLICATION}`)
    .bind(publicationId)
  const results = await database.batch([change, count])
  return results[1].results[0]?.likes ?? null
}
