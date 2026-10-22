import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { applyMigrations, publication, OWNER } from './server/helpers.mjs'
import { registerOwner, publishPublication } from '../../server/nekos/publications.mjs'
import { operationStatement } from '../../server/nekos/operations.mjs'
import glyphs from '../../server/name-filter/glyph-codepoints.json' with { type: 'json' }

async function setup(context) {
  const worker = new Miniflare(convertV4MiniflareOptions({ modules: true,
    scriptPath: resolve('.pages-dist/site/_worker.js/index.js'), compatibilityDate: '2026-10-19',
    compatibilityFlags: ['nodejs_compat'], bindings: { NEKOS_ENV: 'production',
      OWNER_PEPPER: 'synthetic-owner-pepper'.repeat(3), IP_PEPPER: 'synthetic-ip-pepper'.repeat(3) }, d1Databases: ['NEKOS_DB'],
    serviceBindings: { ASSETS: async (request) => {
      const path = new URL(request.url).pathname
      if (path === '/nekos/neko/') return new Response(await readFile('nekos/neko/index.html'), { headers: { 'Content-Type': 'text/html' } })
      if (path === '/assets/nekos/glyphs.bin') return new Response(await readFile('assets/nekos/glyphs.bin'))
      return new Response('static asset')
    } },
  }))
  context.after(() => worker.dispose())
  const database = await worker.getD1Database('NEKOS_DB')
  await applyMigrations(database)
  await registerOwner(database, { ownerHash: OWNER, publicToken: 'd'.repeat(64), now: 1 })
  return { worker, database }
}

test('Functions が実データのHTMLと1200×630 PNGを返し、名前や色の変更で OGP URL が変わる', async (context) => {
  const { worker, database } = await setup(context)
  const { id } = await publishPublication(database, publication({ name: 'よる' }))
  const response = await worker.dispatchFetch(`https://example.com/nekos/${id}`)
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /<title>よる \|/)
  assert.match(html, /og:title/)
  assert.match(html, /https:\/\/nekokintai.com\/nekos\//)
  const ogpUrl = html.match(/property="og:image" content="([^"]+)"/)[1]
  const image = await worker.dispatchFetch(ogpUrl)
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('Content-Type'), 'image/png')
  const png = Buffer.from(await image.arrayBuffer())
  assert.equal(png.readUInt32BE(16), 1200)
  assert.equal(png.readUInt32BE(20), 630)
  await publishPublication(database, publication({ name: 'ひる', expectedGeneration: 'first', expectedRevision: 1 }))
  const updated = await (await worker.dispatchFetch(`https://example.com/nekos/${id}`)).text()
  assert.notEqual(updated.match(/property="og:image" content="([^"]+)"/)[1], ogpUrl)
  assert.equal((await worker.dispatchFetch(ogpUrl)).status, 404)
})

test('非表示は直リンク・OGPの両方を止め、名前をHTMLとして解釈させない', async (context) => {
  const { worker, database } = await setup(context)
  const { id } = await publishPublication(database, publication({ name: '<script>"&' }))
  const html = await (await worker.dispatchFetch(`https://example.com/nekos/${id}`)).text()
  assert.equal(html.includes('<title><script>'), false)
  assert.match(html, /&lt;script&gt;/)
  const image = html.match(/property="og:image" content="([^"]+)"/)[1]
  const operation = operationStatement({ id: 'hide-for-test', action: 'hide', target: id,
    expectedRevision: 1, reason: 'test', actor: 'test' })
  await database.prepare(operation.sql).bind(...operation.params).run()
  assert.equal((await worker.dispatchFetch(image)).status, 404)
  const gone = await worker.dispatchFetch(`https://example.com/nekos/${id}`)
  assert.equal(gone.status, 200)
  const body = await gone.text()
  assert.match(body, /name="robots" content="noindex"/)
  assert.equal(body.includes('property="og:image"'), false)
  assert.equal(gone.headers.get('Cache-Control'), 'no-store')
})

test('投稿時と画像描画が同じ glyph pack を使い、本番 bundle に dev 書込入口が入らない', async () => {
  const bytes = await readFile('assets/nekos/glyphs.bin')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), glyphs.sha256)
  const bundle = await readFile('.pages-dist/site/_worker.js/index.js', 'utf8')
  assert.equal(bundle.includes('developmentWrite'), false)
  assert.equal(bundle.includes('development:${input.clientData}'), false)
})
