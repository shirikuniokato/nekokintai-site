import { VISIBLE_PUBLICATION } from './queries.mjs'
import { ApiError, requireInput } from '../api/errors.mjs'

export async function submitReport(database, input) {
  requireInput(['publication', 'owner'].includes(input.targetKind))
  requireInput(Number.isSafeInteger(input.revision) && input.revision > 0)
  requireInput(typeof input.reason === 'string' && input.reason.length <= 500)
  const reason = input.reason.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim()
  requireInput(reason.length > 0 && reason.length <= 500)
  const result = await database.prepare(`INSERT INTO neko_reports
    (publication_id, publication_revision, target_kind, reason, created_at, reporter_hash)
    SELECT p.id, p.revision, ?, ?, ?, ? FROM neko_publications p
    JOIN neko_owners o ON o.owner_hash = p.owner_hash
    WHERE p.id = ? AND p.revision = ? AND ${VISIBLE_PUBLICATION}
    ON CONFLICT DO NOTHING RETURNING id`)
    .bind(input.targetKind, reason, input.now, input.ipHash, input.id, input.revision).all()
  if (result.results.length) return { accepted: true }
  const previous = await database.prepare(`SELECT 1 FROM neko_reports WHERE publication_id = ?
    AND publication_revision = ? AND target_kind = ? AND reporter_hash = ?`)
    .bind(input.id, input.revision, input.targetKind, input.ipHash).first()
  if (!previous) throw new ApiError(409, 'publication_changed')
  return { accepted: true }
}
