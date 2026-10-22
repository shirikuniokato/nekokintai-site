import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const origin = 'https://nekokintai-sharing-dev.pages.dev'
const uid = `browser-smoke-${randomUUID()}`
async function post(path, body) {
  const response = await fetch(`${origin}/api/nekos${path}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal(response.status, 200)
  return response.json()
}
async function mutate(payload) {
  const challenge = await post('/challenge', { uid, purpose: 'mutation', payload })
  return post('/mutation', { uid, challengeId: challenge.id, clientData: challenge.clientData })
}
const payload = { operationId: randomUUID(), action: 'publish', slot: 1, generation: 'browser-first',
  expectedGeneration: null, expectedRevision: 0, code: 'AQD_____pEIkIR0AAAAAAAAmytT_rq4',
  name: '連携検証', author: '', locale: 'ja' }
const created = await mutate(payload)
const id = created.publication.id
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${origin}/nekos/${id}`, { waitUntil: 'domcontentloaded' })
  await page.locator('#np-shown').waitFor({ state: 'visible' })
  const imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content')
  const imageResponse = await fetch(imageUrl)
  assert.equal(imageResponse.status, 200)
  const png = Buffer.from(await imageResponse.arrayBuffer())
  assert.equal(png.readUInt32BE(16), 1200)
  assert.equal(png.readUInt32BE(20), 630)
  assert.equal(await page.locator('#np-title').textContent(), '連携検証')
  await page.locator('#np-like').click()
  await page.waitForFunction(() => document.querySelector('#np-like').getAttribute('aria-pressed') === 'true')
  assert.match(await page.locator('#np-like-text').textContent(), /1$/)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('#np-shown').waitFor({ state: 'visible' })
  assert.match(await page.locator('#np-like-text').textContent(), /1$/)
  await page.locator('#np-like').click()
  await page.waitForFunction(() => document.querySelector('#np-like').getAttribute('aria-pressed') === 'false')
  assert.match(await page.locator('#np-like-text').textContent(), /0$/)
  await page.locator('#np-report-open').click()
  const reportResponse = page.waitForResponse((response) => response.url().endsWith(`/api/nekos/${id}/reports`))
  await page.locator('#np-report-form button[type="submit"]').click()
  assert.equal((await reportResponse).status(), 202)
  await page.locator('#np-report-dialog').waitFor({ state: 'hidden' })
  await page.screenshot({ path: '/tmp/nekokintai-api-page-proof.png', fullPage: true })
  await mutate({ ...payload, operationId: randomUUID(), action: 'withdraw', expectedGeneration: 'browser-first', expectedRevision: 1 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('#np-gone').waitFor({ state: 'visible' })
  assert.equal((await fetch(imageUrl)).status, 404)
  console.log(JSON.stringify({ status: 'passed', publicationId: id,
    verified: ['dynamic-page', 'ogp-png', 'withdrawn-ogp', 'like', 'reload-count', 'unlike', 'report', 'withdrawn-page'] }))
} finally {
  await browser.close()
}
