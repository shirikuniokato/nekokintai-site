// よくあるしつもんの絞りこみの、文字合わせだけを確かめる（DOM は browser のテスト側）。
//   node --test scripts/lib/*.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesQuery, normalizeSearchText } from '../../assets/qa/search.mjs'

test('全角・半角とカタカナ・ひらがなの違いを吸収する', () => {
  assert.equal(normalizeSearchText('ウィジェット'), normalizeSearchText('うぃじぇっと'))
  assert.equal(normalizeSearchText('ｉＯＳ　１７'), 'ios 17')
  assert.equal(normalizeSearchText('  Widget  '), 'widget')
})

test('部分一致でさがす（日本語は単語の切れ目が無いため）', () => {
  const body = 'ウィジェットのボタンが効かない・時間が0分のまま（Android）'
  assert.equal(matchesQuery(body, 'ウィジェット'), true)
  assert.equal(matchesQuery(body, 'うぃじぇっと'), true)
  assert.equal(matchesQuery(body, 'ボタン'), true)
  assert.equal(matchesQuery(body, 'android'), true)
  assert.equal(matchesQuery(body, 'バックアップ'), false)
})

test('空白で区切ったことばは、順番を問わず全部ふくむものだけ当てる', () => {
  const body = 'ロック画面のねこが消えてしまった（iPhone）'
  assert.equal(matchesQuery(body, 'ロック ねこ'), true)
  assert.equal(matchesQuery(body, 'ねこ ロック'), true)
  assert.equal(matchesQuery(body, 'ねこ 通知'), false)
})

test('空の検索語はすべてに当たる（絞りこみをやめた状態）', () => {
  assert.equal(matchesQuery('なんでも', ''), true)
  assert.equal(matchesQuery('なんでも', '   '), true)
})
