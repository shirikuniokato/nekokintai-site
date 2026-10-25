import test from 'node:test'
import assert from 'node:assert/strict'
import glyphs from '../../../server/name-filter/glyph-codepoints.json' with { type: 'json' }
import { databaseFor, publication, CODE, OWNER, OTHER_OWNER, IP } from './helpers.mjs'
import { publishPublication } from '../../../server/nekos/publications.mjs'
import { setPublicationLike } from '../../../server/nekos/likes.mjs'
import { validatePublicationInput } from '../../../server/name-filter/public-input.mjs'
import { STRAY_NAMES, STRAY_PLACE_COUNT, strayCatName } from '../../../assets/nekos/stray-names.mjs'
import { validatePublicNames } from '../../../server/name-filter/names.mjs'
import { RULES } from '../../../server/name-filter/rules.mjs'
import { createHandler } from '../../../server/api/handler.mjs'
import { hashIdentifier, ownerIdentity } from '../../../server/api/identity.mjs'

const handle = createHandler(async () => null, 'test')
const headers = { 'CF-Connecting-IP': '192.0.2.1', 'Content-Type': 'application/json' }
function environment(database) {
  return { NEKOS_DB: database, NEKOS_ENV: 'test', IP_PEPPER: 'test-pepper'.repeat(4), OWNER_PEPPER: 'other-pepper'.repeat(4) }
}
function request(path, method = 'GET', body, extraHeaders = {}) {
  return new Request(`https://example.com/api/nekos${path}`, { method, headers: { ...headers, ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}

test('正本の code、NFKC、4言語の禁止語、OGP 未収録字を公開前に検査する', () => {
  for (const name of ['', 'もち', 'Mochi', 'class', 'Scunthorpe', 'ナビ', '나비', '小貓咪糰子',
    'サセックス', 'ファックス', 'ちんころ', '보지마', '媽媽的貓', 'Pussy']) {
    assert.equal(validatePublicationInput({ code: CODE, name }).ok, true, name)
  }
  assert.equal(validatePublicNames({ name: '妈妈的猫' }, RULES).ok, true)
  for (const name of ['セックス', 'fucking', '씨발', '幹你娘', '草泥馬']) {
    assert.equal(validatePublicationInput({ code: CODE, name }).reason, 'blocked', name)
  }
  assert.equal(validatePublicationInput({ code: CODE, author: '😀' }).reason, 'unsupported_character')
  assert.equal(validatePublicationInput({ code: CODE.slice(0, -1) + '5' }).ok, false)
  assert.equal(validatePublicationInput({ code: CODE, name: 'Ｍｏｃｈｉ' }).name, 'Mochi')
  assert.equal(validatePublicationInput({ code: CODE, author: 'example.com' }).ok, false)
})

test('自動名は正本の20か所で、全4言語の80候補が辞書と OGP の文字集合に通る', () => {
  const supported = new Set(glyphs.codepoints)
  assert.equal(strayCatName(0, 'ja'), '街の野良ねこ')
  assert.equal(strayCatName(19, 'en'), 'The rice field stray')
  assert.equal(strayCatName(8, 'ko'), '신사 경내의 길고양이')
  assert.equal(strayCatName(12, 'zh-TW'), '緣廊的浪貓')
  assert.equal(STRAY_PLACE_COUNT, 20)
  for (const locale of Object.keys(STRAY_NAMES)) {
    for (let index = 0; index < STRAY_PLACE_COUNT; index += 1) {
      const name = strayCatName(index, locale)
      assert.ok([...name].every((letter) => supported.has(letter.codePointAt(0))), name)
      // 自動名は入力欄の12文字制限と分ける。禁止語の照合は候補の各単語でも確認する。
      for (const word of name.split(' ')) assert.equal(validatePublicNames({ name: word }, RULES).ok, true, word)
    }
  }
})

test('にんき順は期間によらない累計いいねで、同数なら新しい投稿を先にする', async (context) => {
  const database = await databaseFor(context)
  const first = await publishPublication(database, publication({ now: 1 }))
  const second = await publishPublication(database, publication({ ownerHash: OTHER_OWNER, now: 2 }))
  await setPublicationLike(database, { publicationId: first.id, ipHash: IP, liked: true, now: 1 })
  const env = environment(database)
  const popular = await handle(request('?sort=popular&limit=1'), env)
  const result = await popular.json()
  assert.equal(result.cats[0].id, first.id)
  assert.equal(result.hasMore, true)
  assert.equal(result.cats[0].breed, 'short')
  const newest = await handle(request('?sort=new'), env)
  assert.deepEqual((await newest.json()).cats.map((cat) => cat.id), [second.id, first.id])
  await setPublicationLike(database, { publicationId: second.id, ipHash: IP, liked: true, now: 3 })
  const tied = await handle(request('?sort=popular'), env)
  assert.deepEqual((await tied.json()).cats.map((cat) => cat.id), [second.id, first.id])
  const hidden = await handle(request(`?hide=${'d'.repeat(64)}`), env)
  assert.deepEqual((await hidden.json()).cats.map((cat) => cat.id), [second.id])
  assert.equal((await handle(request('?limit=999'), env)).status, 400)
})

test('いいねは IP の秘密つきハッシュで冪等になり、公開レスポンスに private 識別子を含めない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  const env = environment(database)
  for (let index = 0; index < 2; index += 1) {
    const response = await handle(request(`/${id}/like`, 'PUT', { liked: true }), env)
    assert.deepEqual(await response.json(), { liked: true, likes: 1 })
  }
  const deleted = await handle(request(`/${id}/like`, 'PUT', { liked: false }), env)
  assert.deepEqual(await deleted.json(), { liked: false, likes: 0 })
  const data = JSON.stringify(await (await handle(request(`/${id}`), env)).json())
  assert.equal(data.includes(OWNER), false)
  assert.equal(data.includes('192.0.2.1'), false)
  assert.equal((await handle(request(`/${id}/like`, 'PUT', { liked: true }, { Origin: 'https://evil.example' }), env)).status, 403)
})

test('通報と通知待ちを一緒に保存し、重複は増やさず、古い版・異常入力は記録しない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  const env = environment(database)
  const report = { targetKind: 'owner', reason: '確認してください', revision: 1 }
  for (let index = 0; index < 2; index += 1) {
    assert.equal((await handle(request(`/${id}/reports`, 'POST', report), env)).status, 202)
  }
  assert.equal((await database.prepare('SELECT count(*) AS n FROM neko_reports').first()).n, 1)
  assert.equal((await database.prepare('SELECT count(*) AS n FROM neko_report_notifications').first()).n, 1)
  const stale = { ...report, revision: 2 }
  assert.equal((await handle(request(`/${id}/reports`, 'POST', stale), env)).status, 409)
  const limited = await handle(request(`/${id}/reports`, 'POST', report), env)
  assert.equal(limited.status, 429)
  assert.equal((await database.prepare('SELECT count(*) AS n FROM neko_reports').first()).n, 1)
  const row = await database.prepare('SELECT reporter_hash FROM neko_reports').first()
  assert.match(row.reporter_hash, /^[a-f0-9]{64}$/)
})

test('通知待ちへの記録が失敗したら通報も保存せず、HMAC の用途・秘密を混同しない', async (context) => {
  const database = await databaseFor(context)
  const { id } = await publishPublication(database, publication())
  await database.exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON neko_report_notifications BEGIN SELECT RAISE(ABORT, 'test_error'); END;")
  const response = await handle(request(`/${id}/reports`, 'POST', { targetKind: 'publication', reason: 'test', revision: 1 }), environment(database))
  assert.equal(response.status, 500)
  assert.equal((await database.prepare('SELECT count(*) AS n FROM neko_reports').first()).n, 0)
  const identity = await ownerIdentity(environment(database), 'synthetic-user-123456')
  assert.notEqual(identity.ownerHash, identity.publicToken)
  assert.notEqual(await hashIdentifier('x'.repeat(32), 'ip', 'test'), await hashIdentifier('y'.repeat(32), 'ip', 'test'))
})
