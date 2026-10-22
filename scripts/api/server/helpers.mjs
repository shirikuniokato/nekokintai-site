import { readFile } from 'node:fs/promises'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { registerOwner } from '../../../server/nekos/publications.mjs'

export const OWNER = 'a'.repeat(64)
export const OTHER_OWNER = 'b'.repeat(64)
export const IP = 'c'.repeat(64)
export const CODE = 'AQD_____pEIkIR0AAAAAAAAmytT_rq4'

export function publication(overrides = {}) {
  return {
    ownerHash: OWNER, slot: 1, generation: 'first',
    expectedGeneration: null, expectedRevision: 0, code: CODE, name: 'よる',
    author: '', fallbackName: '路地裏の野良ねこ', now: 100,
    ...overrides,
  }
}

export async function databaseFor(context) {
  const worker = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("test") } }',
    compatibilityDate: '2026-10-19',
    d1Databases: ['NEKOS_DB'],
  }))
  context.after(() => worker.dispose())
  const database = await worker.getD1Database('NEKOS_DB')
  const schema = await readFile('migrations/0001_nekos.sql', 'utf8')
  const statements = schema.replace(/^--.*$/gm, '').split(';').map((sql) => sql.trim()).filter(Boolean)
  await database.batch(statements.map((sql) => database.prepare(sql)))
  await registerOwner(database, { ownerHash: OWNER, publicToken: 'd'.repeat(64), now: 1 })
  await registerOwner(database, { ownerHash: OTHER_OWNER, publicToken: 'e'.repeat(64), now: 1 })
  return database
}
