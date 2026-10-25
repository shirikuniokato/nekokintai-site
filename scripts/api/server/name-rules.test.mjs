// #262 野良ねこの名前を場所の番号で持つことと、名前の決まりをアプリの src/shared/catName.ts にそろえたことの検証。
// 野良ねこの場所の辞書はサイトの assets/nekos/stray-names.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { applyMigrations, databaseFor, publication, OWNER, CODE } from './helpers.mjs'
import { publishPublication } from '../../../server/nekos/publications.mjs'
import { getPublicPublication } from '../../../server/nekos/queries.mjs'
import { ogpVersion } from '../../../server/nekos/pages.mjs'
import { digest } from '../../../server/api/payload.mjs'
import { chooseStrayPlace, ogpNameOf } from '../../../server/nekos/stray-places.mjs'
import { validatePublicationInput } from '../../../server/name-filter/public-input.mjs'
import { STRAY_PLACE_COUNT, displayCatName } from '../../../assets/nekos/stray-names.mjs'

async function emptyDatabase(context) {
  const worker = new Miniflare(convertV4MiniflareOptions({ modules: true,
    script: 'export default { fetch() { return new Response("test") } }',
    compatibilityDate: '2026-10-19', d1Databases: ['NEKOS_DB'] }))
  context.after(() => worker.dispose())
  return worker.getD1Database('NEKOS_DB')
}

// 0005 までの D1 に、自動名を文字で持った行を入れておく（dev の D1 がこの形）
async function legacyDatabase(context, rows) {
  const database = await emptyDatabase(context)
  await applyMigrations(database, { through: '0005' })
  await database.prepare(`INSERT INTO neko_owners (owner_hash, public_token, created_at) VALUES (?, ?, 1)`)
    .bind(OWNER, 'd'.repeat(64)).run()
  for (const [id, slot, name, fallbackName] of rows) {
    await database.prepare(`INSERT INTO neko_publications
      (id, owner_hash, slot, generation, code, name, author, fallback_name, created_at, updated_at)
      VALUES (?, ?, ?, 'first', ?, ?, '', ?, 1, 1)`).bind(id, OWNER, slot, CODE, name, fallbackName).run()
    await database.prepare('INSERT INTO neko_slots (owner_hash, slot, publication_id) VALUES (?, ?, ?)')
      .bind(OWNER, slot, id).run()
  }
  return database
}

test('0006 は文字で持っていた自動名を 4 言語とも場所の番号にもどし、付けた名前とページは残す', async (context) => {
  const database = await legacyDatabase(context, [
    ['stray-ja', 1, '路地裏の野良ねこ', '路地裏の野良ねこ'],
    ['named', 2, 'よる', 'The rice field stray'],
    ['stray-ko', 3, '신사 경내의 길고양이', '신사 경내의 길고양이'],
  ])
  await database.prepare('INSERT INTO neko_likes VALUES (?, ?, 2)').bind('stray-ja', 'c'.repeat(64)).run()
  await applyMigrations(database, { from: '0005' })
  const rows = await database.prepare('SELECT id, name, fallback_place FROM neko_publications ORDER BY id').all()
  assert.deepEqual(rows.results, [
    { id: 'named', name: 'よる', fallback_place: 19 },
    { id: 'stray-ja', name: '', fallback_place: 2 },
    { id: 'stray-ko', name: '', fallback_place: 8 },
  ])
  assert.equal((await getPublicPublication(database, 'stray-ja')).likes, 1)
  const columns = await database.prepare("SELECT name FROM pragma_table_info('neko_publications')").all()
  assert.equal(columns.results.some((column) => column.name === 'fallback_name'), false)
})

test('0006 は番号にもどせない自動名があれば止まり、別の場所の名前にしない', async (context) => {
  const database = await legacyDatabase(context, [['unknown', 1, 'x', '知らない場所の野良ねこ']])
  await assert.rejects(applyMigrations(database, { from: '0005' }), /CHECK constraint failed/)
})

test('場所の番号は公開したときに必ず入り、あとから変えられない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication({ name: '' }))
  await assert.rejects(database.prepare('UPDATE neko_publications SET fallback_place = 5 WHERE id = ?').bind(id).run(),
    /fallback_place_fixed/)
  await assert.rejects(publishPublication(database, publication({ slot: 2, fallbackPlace: null })),
    /fallback_place_required/)
  for (let index = 0; index < 200; index += 1) {
    const place = chooseStrayPlace()
    assert.ok(Number.isInteger(place) && place >= 0 && place < STRAY_PLACE_COUNT)
  }
})

test('OGP は野良ねこを日本語で描き、名前のハッシュはその描く名前から作る', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication({ name: '' }))
  const cat = await getPublicPublication(database, id)
  assert.equal(ogpNameOf(cat), '路地裏の野良ねこ')
  assert.equal(ogpNameOf({ ...cat, name: 'よる' }), 'よる')
  assert.equal(await ogpVersion(cat), `${CODE}.${await digest('路地裏の野良ねこ')}`)
  assert.equal(await ogpVersion({ ...cat, name: 'よる' }), `${CODE}.${await digest('よる')}`)
  // 画面は見る人の言語で組み立てる
  assert.equal(displayCatName(cat.name, cat.fallbackPlace, 'en'), 'The back alley stray')
  assert.equal(displayCatName('よる', cat.fallbackPlace, 'en'), 'よる')
})

test('投稿の検査はアプリと同じ決まりでそろえた名前を返し、描けない字を断る', () => {
  assert.equal(validatePublicationInput({ code: CODE, name: '　ｶﾅ​' }).name, 'カナ')
  assert.deepEqual(validatePublicationInput({ code: CODE, name: 'よる😺' }),
    { ok: false, reason: 'unsupported_character', field: 'name' })
  assert.equal(validatePublicationInput({ code: CODE, name: 'あ'.repeat(13) }).reason, 'too_long')
})

test('名前の決まりはアプリの正本を bundle したもので、野良ねこの場所の文字は持ちこまない', async () => {
  const vendored = await readFile('server/vendor/cat-name.mjs', 'utf8')
  assert.match(vendored.split('\n')[0], /正本: shirikuniokato\/nekokintai [0-9a-f]{40} src\/shared\/catName\.ts/)
  assert.equal(vendored.includes('野良ねこ\''), false)
  assert.equal(/STRAY_PLACES|strayCatName/.test(vendored), false)
})
