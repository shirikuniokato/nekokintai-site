export async function deliverNotification(query, webhook, options = {}) {
  const now = options.now ?? Date.now()
  const lease = crypto.randomUUID()
  const [item] = await query({ sql: `UPDATE neko_report_notifications SET lease_token = ?, lease_until = ?, attempts = attempts + 1
    WHERE report_id = (SELECT report_id FROM neko_report_notifications WHERE sent_at IS NULL
      AND attempts < 10 AND next_attempt_at <= ? AND lease_until <= ? ORDER BY report_id LIMIT 1)
    AND sent_at IS NULL AND lease_until <= ? RETURNING report_id, attempts`, params: [lease, now + 120_000, now, now, now] })
  if (!item) return { status: 'empty' }
  const [report] = await query({ sql: 'SELECT publication_id, target_kind FROM neko_reports WHERE id = ?', params: [item.report_id] })
  try {
    const fetcher = options.fetch || fetch
    const response = await fetcher(webhook, { method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ text: `ねこ共有に${report.target_kind === 'owner' ? '飼い主' : '投稿'}の通報があります。\nhttps://nekokintai.com/nekos/${encodeURIComponent(report.publication_id)}\n通報ID: ${item.report_id}` }) })
    if (!response.ok) throw new Error(`http_${response.status}`)
    await query({ sql: `UPDATE neko_report_notifications SET sent_at = ?, lease_token = NULL, lease_until = 0,
      last_error = NULL WHERE report_id = ? AND lease_token = ?`, params: [now, item.report_id, lease] })
    return { status: 'sent', reportId: item.report_id }
  } catch (error) {
    const code = /^http_[0-9]{3}$/.test(error.message) ? error.message : 'delivery_failed'
    await query({ sql: `UPDATE neko_report_notifications SET next_attempt_at = ?, lease_token = NULL,
      lease_until = 0, last_error = ? WHERE report_id = ? AND lease_token = ?`,
    params: [now + Math.min(3_600_000, 60_000 * 2 ** item.attempts), code, item.report_id, lease] })
    return { status: 'failed', reportId: item.report_id, error: code }
  }
}
