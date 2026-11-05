import assert from 'node:assert/strict'
import test from 'node:test'
import {
  localizedPathname,
  preferredLocale,
  resolveSupportedLocale,
  splitLocalePath,
  suggestedLocale,
} from '../../assets/lp/locale.mjs'

test('アプリと同じ優先順で対応言語を決める', () => {
  assert.equal(resolveSupportedLocale(['ja-JP']), 'ja')
  assert.equal(resolveSupportedLocale(['en-US']), 'en')
  assert.equal(resolveSupportedLocale(['ko-KR']), 'ko')
  assert.equal(resolveSupportedLocale(['zh-Hant-HK']), 'zh-TW')
  assert.equal(resolveSupportedLocale(['zh-CN']), 'zh-Hans')
  assert.equal(resolveSupportedLocale(['zh-SG']), 'zh-Hans')
  assert.equal(resolveSupportedLocale(['zh']), 'zh-Hans')
  assert.equal(resolveSupportedLocale(['zh-Hans-TW']), 'zh-Hans', '文字種は地域より優先')
  assert.equal(resolveSupportedLocale(['zh-HK']), 'zh-TW')
  assert.equal(resolveSupportedLocale(['zh-MO']), 'zh-TW')
  assert.equal(resolveSupportedLocale(['zh-Hant-CN']), 'zh-TW', '文字種は地域より優先')
})

test('URL指定、保存済み、開いているページの言語の順に言語を決める', () => {
  assert.equal(preferredLocale({ urlLocale: 'ko-KR', storedLocale: 'en', pageLocale: 'ja' }), 'ko')
  assert.equal(preferredLocale({ urlLocale: null, storedLocale: 'zh-TW', pageLocale: 'ja' }), 'zh-TW')
  assert.equal(preferredLocale({ urlLocale: null, storedLocale: 'fr', pageLocale: 'en' }), 'en')
  // 対応していない ?lang= は、開いているページの言語のまま
  assert.equal(preferredLocale({ urlLocale: 'fr', storedLocale: null, pageLocale: 'ko' }), 'ko')
})

test('端末の言語だけでは中身を切りかえない（検索エンジンは英語の端末として読む）', () => {
  assert.equal(preferredLocale({ urlLocale: null, storedLocale: null, pageLocale: 'ja' }), 'ja')
})

test('言語を選んだことがない人にだけ、端末の言語のページを案内する', () => {
  const base = { urlLocale: null, storedLocale: null, pageLocale: 'ja' }
  assert.equal(suggestedLocale({ ...base, deviceLocales: ['en-US'] }), 'en')
  assert.equal(suggestedLocale({ ...base, deviceLocales: ['ja-JP'] }), null)
  assert.equal(suggestedLocale({ ...base, deviceLocales: ['fr-FR'] }), null)
  assert.equal(suggestedLocale({ ...base, pageLocale: 'en', deviceLocales: ['fr-FR', 'ja'] }), 'ja')
  assert.equal(suggestedLocale({ ...base, storedLocale: 'ja', deviceLocales: ['en-US'] }), null)
  assert.equal(suggestedLocale({ ...base, urlLocale: 'ja', deviceLocales: ['en-US'] }), null)
})

test('言語ごとの URL のパスを行き来する', () => {
  assert.deepEqual(splitLocalePath('/'), { locale: 'ja', basePath: '/' })
  assert.deepEqual(splitLocalePath('/qa/'), { locale: 'ja', basePath: '/qa/' })
  assert.deepEqual(splitLocalePath('/en/'), { locale: 'en', basePath: '/' })
  assert.deepEqual(splitLocalePath('/en'), { locale: 'en', basePath: '/' })
  assert.deepEqual(splitLocalePath('/zh-TW/qa/'), { locale: 'zh-TW', basePath: '/qa/' })
  // /english/ のような、言語で始まるだけの別のパスは日本語のページとして扱う
  assert.deepEqual(splitLocalePath('/english/'), { locale: 'ja', basePath: '/english/' })
  assert.equal(localizedPathname('/qa/', 'ja'), '/qa/')
  assert.equal(localizedPathname('/qa/', 'ko'), '/ko/qa/')
})
