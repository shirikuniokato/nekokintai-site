import assert from 'node:assert/strict'
import test from 'node:test'
import { appendAppContext, parseAppContext } from '../../contact/app-context.mjs'

test('iOSとアプリバージョンを表示用の値へ変換する', () => {
  assert.deepEqual(parseAppContext('?platform=ios&appVersion=2.1.0'), {
    platform: 'ios',
    platformLabel: 'iOS',
    appVersion: '2.1.0',
  })
})

test('Androidはバージョンなしでも受け付ける', () => {
  assert.deepEqual(parseAppContext('?platform=android'), {
    platform: 'android',
    platformLabel: 'Android',
    appVersion: null,
  })
})

test('対応外のOSと不正なバージョンを表示しない', () => {
  assert.equal(parseAppContext('?platform=web&appVersion=2.1.0'), null)
  assert.equal(parseAppContext('?platform=toString&appVersion=2.1.0'), null)
  assert.deepEqual(parseAppContext('?platform=ios&appVersion=%3Cscript%3E'), {
    platform: 'ios',
    platformLabel: 'iOS',
    appVersion: null,
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
