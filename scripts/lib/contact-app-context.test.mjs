import assert from 'node:assert/strict'
import test from 'node:test'
import { appendAppContext, describeFailure, parseAppContext } from '../../contact/app-context.mjs'

test('iOSとアプリバージョンを表示用の値へ変換する', () => {
  assert.deepEqual(parseAppContext('?platform=ios&appVersion=2.1.0'), {
    platform: 'ios',
    platformLabel: 'iOS',
    appVersion: '2.1.0',
    failure: null,
  })
})

test('Androidはバージョンなしでも受け付ける', () => {
  assert.deepEqual(parseAppContext('?platform=android'), {
    platform: 'android',
    platformLabel: 'Android',
    appVersion: null,
    failure: null,
  })
})

test('対応外のOSと不正なバージョンを表示しない', () => {
  assert.equal(parseAppContext('?platform=web&appVersion=2.1.0'), null)
  assert.equal(parseAppContext('?platform=toString&appVersion=2.1.0'), null)
  assert.deepEqual(parseAppContext('?platform=ios&appVersion=%3Cscript%3E'), {
    platform: 'ios',
    platformLabel: 'iOS',
    appVersion: null,
    failure: null,
  })
})

test('問い合わせ本文の末尾へ環境情報を付ける', () => {
  const context = parseAppContext('?platform=android&appVersion=2.1.0')
  assert.equal(
    appendAppContext('記録が保存されません', context),
    '記録が保存されません\n\n---\n利用環境: Android\nアプリバージョン: 2.1.0',
  )
})

test('アプリ外からのお問い合わせ本文は変えない', () => {
  assert.equal(appendAppContext('ねこの話', null), 'ねこの話')
})

const FAILURE_QUERY =
  '?platform=ios&appVersion=2.6.1&errorCode=D14&errorAt=2026-11-19T12%3A34%3A56Z' +
  '&errorDetail=%5Bop-sqlite%5D%20statement%20execution%20error%3A%20unable%20to%20open%20database%20file'

test('アプリで出た想定外の失敗を、コード・時刻・内容として受け取る', () => {
  assert.deepEqual(parseAppContext(FAILURE_QUERY).failure, {
    code: 'D14',
    at: '2026-11-19T12:34:56Z',
    detail: '[op-sqlite] statement execution error: unable to open database file',
  })
})

test('形の違うコードは、時刻と内容ごと受け取らない', () => {
  assert.equal(parseAppContext('?platform=ios&errorCode=%3Cb%3E&errorDetail=x').failure, null)
  assert.equal(parseAppContext('?platform=ios&errorCode=d14').failure, null)
  assert.equal(parseAppContext('?platform=ios&errorDetail=x').failure, null)
})

test('時刻の形が違えば時刻だけ落とし、内容は改行と制御文字を除いて短く切る', () => {
  const failure = parseAppContext(
    `?platform=ios&errorCode=X00&errorAt=yesterday&errorDetail=${encodeURIComponent(`a\n\tb\u0000${'x'.repeat(400)}`)}`,
  ).failure
  assert.equal(failure.at, null)
  assert.equal(failure.detail.startsWith('a b x'), true)
  assert.equal(failure.detail.length, 200)
})

test('フォームに見せる 1 行は、送る内容と同じ', () => {
  assert.equal(
    describeFailure(parseAppContext(FAILURE_QUERY).failure),
    'D14 · 2026-11-19T12:34:56Z · [op-sqlite] statement execution error: unable to open database file',
  )
  assert.equal(describeFailure({ code: 'X00', at: null, detail: null }), 'X00')
})

test('失敗の情報は、既存の 2 行のあとに足す', () => {
  assert.equal(
    appendAppContext('打刻できません', parseAppContext(FAILURE_QUERY)),
    '打刻できません\n\n---\n利用環境: iOS\nアプリバージョン: 2.6.1\nエラーコード: D14\nエラーの時刻: 2026-11-19T12:34:56Z' +
      '\nエラーの内容: [op-sqlite] statement execution error: unable to open database file',
  )
})
