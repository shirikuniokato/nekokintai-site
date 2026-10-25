import { readTarget, connectDatabase } from './neko-ops/database.mjs'
import { deliverNotification } from '../server/nekos/notifications.mjs'

try {
  const [environment, targetFile, mode] = process.argv.slice(2)
  if (!['dev', 'production'].includes(environment) || !targetFile || !['plan', 'apply'].includes(mode)) {
    throw new Error('使い方: node scripts/neko-notifications.mjs dev|production target.json plan|apply')
  }
  const query = await connectDatabase(await readTarget({ environment, 'target-config': targetFile }))
  if (mode === 'plan') {
    console.log(JSON.stringify(await query({ sql: 'SELECT * FROM neko_report_notifications WHERE sent_at IS NULL ORDER BY report_id LIMIT 50', params: [] })))
  } else {
    const webhook = process.env.NEKOS_SLACK_WEBHOOK_URL
    if (!/^https:\/\/hooks[.]slack[.]com\/services\//.test(webhook || '')) throw new Error('NEKOS_SLACK_WEBHOOK_URL が必要です')
    for (let index = 0; index < 20; index += 1) {
      const result = await deliverNotification(query, webhook)
      console.log(JSON.stringify(result))
      if (result.status === 'failed') process.exitCode = 1
      if (result.status !== 'sent') break
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
