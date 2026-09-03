import assert from 'node:assert/strict'
import test from 'node:test'
import { preferredLocale, resolveSupportedLocale } from '../../assets/lp/locale.mjs'

test('アプリと同じ優先順で対応言語を決める', () => {
  assert.equal(resolveSupportedLocale(['ja-JP']), 'ja')
  assert.equal(resolveSupportedLocale(['en-US']), 'en')
  assert.equal(resolveSupportedLocale(['ko-KR']), 'ko')
  assert.equal(resolveSupportedLocale(['zh-Hant-HK']), 'zh-TW')
  assert.equal(resolveSupportedLocale(['zh-CN']), 'ja')
})

test('URL指定、保存済み、端末言語の順に言語を決める', () => {
  assert.equal(
    preferredLocale({ urlLocale: 'ko-KR', storedLocale: 'en', deviceLocales: ['zh-TW'] }),
    'ko',
  )
  assert.equal(
    preferredLocale({ urlLocale: null, storedLocale: 'zh-TW', deviceLocales: ['en-US'] }),
    'zh-TW',
  )
  assert.equal(
    preferredLocale({ urlLocale: null, storedLocale: 'fr', deviceLocales: ['ko-KR'] }),
    'ko',
  )
})
