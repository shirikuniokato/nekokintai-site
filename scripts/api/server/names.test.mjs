import assert from 'node:assert/strict'
import test from 'node:test'
import { compileNameRules, normalizePublicName, validatePublicNames } from '../../../server/name-filter/names.mjs'

// 実際の語の選別と独立して、全言語・照合方式の挙動を合成語で検証する。
const rules = compileNameRules([
  { locale: 'ja', term: '禁止例', mode: 'substring' },
  { locale: 'en', term: 'badword', mode: 'word' },
  { locale: 'ko', term: '금지예', mode: 'whole' },
  { locale: 'zh-TW', term: '禁用範例', mode: 'substring' },
])

test('NFKC・制御文字・前後空白を整理し、任意の空欄を許す', () => {
  assert.deepEqual(normalizePublicName('　ｶﾅ\u200b\n　'), { ok: true, value: 'カナ' })
  assert.deepEqual(validatePublicNames({ name: '', author: '' }, rules), { ok: true, name: '', author: '' })
})

test('アプリに合わせた12文字境界を検査し、黙って切り詰めない', () => {
  assert.equal(normalizePublicName('あ'.repeat(12)).ok, true)
  assert.equal(normalizePublicName('あ'.repeat(13)).reason, 'too_long')
  assert.equal(normalizePublicName('😺'.repeat(6)).ok, true)
  assert.equal(normalizePublicName('😺'.repeat(7)).ok, false)
  assert.equal(normalizePublicName(123).reason, 'invalid')
})

test('全角・不可視文字で隠したURLと、http・www・ドメイン形を断る', () => {
  for (const name of ['https://a.co', 'www.a.co', 'a.jp', 'ａ．ｊｐ', 'a\u200b.jp', 'ねこ.jp']) {
    assert.equal(normalizePublicName(name).reason, 'url', name)
  }
})

test('言語指定に依存せず、両方の名前に全言語のルールを通す', () => {
  for (const value of ['禁止例ねこ', 'ＢＡＤＷＯＲＤ', '금지예', '禁用範例', 'badwordねこ', 'ねこbadword', 'badword고양이']) {
    assert.equal(validatePublicNames({ name: value, author: '' }, rules).reason, 'blocked', value)
    assert.equal(validatePublicNames({ name: '', author: value }, rules).reason, 'blocked', value)
  }
})

test('全体一致と単語境界一致では、普通の名前に含まれる部分を弾かない', () => {
  assert.equal(validatePublicNames({ name: 'badwordcat', author: '' }, rules).ok, true)
  assert.equal(validatePublicNames({ name: '금지예고양이', author: '' }, rules).ok, true)
  assert.equal(validatePublicNames({ name: 'my badword', author: '' }, rules).ok, false)
})

test('未確認・欠けた言語の辞書を受付可能な設定として扱わない', () => {
  assert.throws(() => compileNameRules([]), /4言語/)
  assert.throws(() => validatePublicNames({ name: 'よる', author: '' }, []), /4言語/)
  assert.throws(() => compileNameRules(rules.slice(1)), /4言語/)
})
