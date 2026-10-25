export const OPERATION_ACTIONS = ['hide', 'unhide', 'remove', 'suspend', 'unsuspend', 'pause', 'resume', 'resolve']

function boundedText(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || value.includes('\0')) {
    throw new Error(`${label}が正しくありません`)
  }
  return value.trim()
}

export function operationStatement(input) {
  if (!OPERATION_ACTIONS.includes(input.action)) throw new Error('運営操作が正しくありません')
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new Error('確認した版番号を指定してください')
  }
  const id = boundedText(input.id, 100, '操作ID')
  const target = boundedText(input.target, 100, '対象')
  if (['pause', 'resume'].includes(input.action) && target !== 'publishing') throw new Error('対象が正しくありません')
  if (['suspend', 'unsuspend'].includes(input.action) && !/^[a-f0-9]{64}$/.test(target)) {
    throw new Error('飼い主の公開識別子が正しくありません')
  }
  if (input.action === 'resolve' && !/^[1-9][0-9]*$/.test(target)) throw new Error('通報IDが正しくありません')
  return {
    sql: `INSERT INTO neko_operations (id, action, target, expected_revision, reason, actor)
      VALUES (?, ?, ?, ?, ?, ?)`,
    params: [id, input.action, target, input.expectedRevision,
      boundedText(input.reason, 500, '理由'), boundedText(input.actor, 100, '操作者')],
  }
}

export function settingsStatement() {
  return { sql: 'SELECT publishing_paused, revision, updated_at FROM neko_settings WHERE id = 1', params: [] }
}

export function publicationStatement(target) {
  return {
    sql: `SELECT p.id, p.code, p.name, p.fallback_place, p.author, p.generation, p.slot, p.revision,
      p.withdrawn_at, p.replaced_at, p.moderated_at, p.deleted_at, p.updated_at,
      o.public_token AS owner, o.suspended_at, o.moderation_revision AS owner_revision
      FROM neko_publications p JOIN neko_owners o ON o.owner_hash = p.owner_hash WHERE p.id = ?`,
    params: [target],
  }
}

export function ownerStatement(target) {
  return { sql: `SELECT public_token AS owner, suspended_at, moderation_revision AS revision
    FROM neko_owners WHERE public_token = ?`, params: [target] }
}

export function reportsStatement({ after = 0, limit = 50, includeResolved = false } = {}) {
  if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('通報一覧の取得条件が正しくありません')
  }
  return {
    sql: `SELECT r.*, p.name, p.fallback_place, p.author, p.revision AS current_publication_revision,
      o.public_token AS owner, o.moderation_revision AS owner_revision,
      p.moderated_at, p.deleted_at, o.suspended_at
      FROM neko_reports r JOIN neko_publications p ON p.id = r.publication_id
      JOIN neko_owners o ON o.owner_hash = p.owner_hash
      WHERE r.id > ? ${includeResolved ? '' : 'AND r.resolved_at IS NULL'} ORDER BY r.id LIMIT ?`,
    params: [after, limit],
  }
}

export function auditStatement(id) {
  return { sql: 'SELECT * FROM neko_operations WHERE id = ?', params: [boundedText(id, 100, '操作ID')] }
}
