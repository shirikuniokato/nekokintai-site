import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const GA4_ENV_PATH = `${homedir()}/git/c-cya/scripts/ga4-report/.env`

export function webhookUrl() {
  if (process.env.NEKOKINTAI_SLACK_WEBHOOK_URL) {
    return process.env.NEKOKINTAI_SLACK_WEBHOOK_URL
  }
  if (process.env.CAT_ROOM_SLACK_WEBHOOK_URL) return process.env.CAT_ROOM_SLACK_WEBHOOK_URL
  if (!existsSync(GA4_ENV_PATH)) return null

  const webhookLine = readFileSync(GA4_ENV_PATH, 'utf8')
    .split('\n')
    .find((line) => line.startsWith('GA4_SLACK_WEBHOOK_URL='))
  return webhookLine
    ? webhookLine.slice('GA4_SLACK_WEBHOOK_URL='.length).trim().replace(/^["']|["']$/g, '')
    : null
}

export async function postSlack(text) {
  const url = webhookUrl()
  if (!url) {
    console.warn('WARN: Slack webhook が見つからないので通知を飛ばす')
    return false
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    console.warn(`WARN: Slack 通知に失敗 ${response.status}: ${await response.text()}`)
    return false
  }
  return true
}
