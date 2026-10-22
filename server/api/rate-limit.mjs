import { ApiError } from './errors.mjs'

export async function rateLimit(database, ipHash, scope, options = {}) {
  const { maximum = 60, period = 60_000, now = Date.now() } = options
  const result = await database.batch([
    database.prepare(`INSERT INTO neko_rate_limits(scope, ip_hash, bucket, used, expires_at) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(scope, ip_hash, bucket) DO UPDATE SET used = used + 1 WHERE used < ? RETURNING used`)
      .bind(scope, ipHash, Math.floor(now / period), now + period * 2, maximum),
    database.prepare('DELETE FROM neko_rate_limits WHERE expires_at < ?').bind(now),
  ])
  if (!result[0].results.length) throw new ApiError(429, 'rate_limited')
}
