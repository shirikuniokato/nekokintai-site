import { readFile, readdir } from 'node:fs/promises'
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
    author: '', fallbackPlace: 2, now: 100,
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
  await applyMigrations(database)
  await registerOwner(database, { ownerHash: OWNER, publicToken: 'd'.repeat(64), now: 1 })
  await registerOwner(database, { ownerHash: OTHER_OWNER, publicToken: 'e'.repeat(64), now: 1 })
  return database
}

// through を渡すと、その番号の migration までで止める（既存の D1 に新しい migration を当てる検証用）
export async function applyMigrations(database, { from = '', through = '9999' } = {}) {
  const migrations = (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()
    .filter((name) => name.slice(0, 4) > from && name.slice(0, 4) <= through)
  for (const name of migrations) {
    const schema = await readFile(`migrations/${name}`, 'utf8')
    // D1.exec は改行ごとに分割するため、trigger の BEGIN/END を一文のまま渡す。
    await database.exec(schema.replace(/^--.*$/gm, '').replaceAll('\n', ' '))
  }
}
