import { PUBLIC_COLUMNS, VISIBLE_PUBLICATION } from './queries.mjs'
import { decodeCatCode } from '../vendor/cat-code.mjs'

export function publicCat(row) {
  if (!row) return null
  const result = decodeCatCode(row.code)
  if (!result.ok) throw new Error('保存した code が正しくありません')
  return { ...row, ...result.cat }
}

export async function gallery(database, { sort, page, limit, hiddenOwners, excludeId = '' }) {
  const blocking = hiddenOwners.map(() => '?').join(',')
  const result = await database.prepare(`SELECT ${PUBLIC_COLUMNS}
    FROM neko_publications p JOIN neko_owners o ON o.owner_hash = p.owner_hash
    WHERE ${VISIBLE_PUBLICATION} AND p.id != ?
    ${blocking ? `AND o.public_token NOT IN (${blocking})` : ''}
    ORDER BY ${sort === 'popular' ? 'likes DESC,' : ''} p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`)
    .bind(excludeId, ...hiddenOwners, limit + 1, page * limit).all()
  return { cats: result.results.slice(0, limit).map(publicCat), hasMore: result.results.length > limit }
}
