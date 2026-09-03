import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { badgeCssDeclaration, measureBadgePadding, parseBadgeRules } from './lp-badge-padding.mjs'

const siteRoot = new URL('../../', import.meta.url)
const LOCALIZED_PLAY_BADGES = ['en', 'ko', 'zh-TW']

function readBadge(locale) {
  return readFileSync(new URL(`assets/badges/google-play-${locale}.png`, siteRoot))
}

test('公式 Google Play PNG の透明余白を四辺とも実測する', () => {
  for (const locale of LOCALIZED_PLAY_BADGES) {
    const padding = measureBadgePadding(readBadge(locale))
    assert.equal(padding.width, 646, `${locale}: width`)
    assert.equal(padding.height, 250, `${locale}: height`)
    assert.ok(padding.visibleHeight > 0 && padding.visibleHeight <= padding.height, `${locale}: visible height`)
    assert.equal(padding.top + padding.visibleHeight + padding.bottom, padding.height, `${locale}: vertical sum`)
    assert.equal(padding.left + padding.visibleWidth + padding.right, padding.width, `${locale}: horizontal sum`)
    // 上下・左右が非対称だと margin の shorthand では表せない。素材が変わったらここで気づく
    assert.equal(padding.top, padding.bottom, `${locale}: top/bottom padding differ`)
    assert.equal(padding.left, padding.right, `${locale}: left/right padding differ`)
  }
})

test('index.html の言語別バッジ補正は PNG の実測値から作った宣言と一致する', () => {
  const indexHtml = readFileSync(new URL('index.html', siteRoot), 'utf8')
  const rules = parseBadgeRules(indexHtml)
  assert.deepEqual(Object.keys(rules).sort(), [...LOCALIZED_PLAY_BADGES].sort())

  for (const locale of LOCALIZED_PLAY_BADGES) {
    const expected = badgeCssDeclaration(measureBadgePadding(readBadge(locale)))
    assert.equal(rules[locale], expected, `${locale}: index.html の係数が実測値と違う`)
  }
})

test('宣言は余白ゼロの辺を 0 と書き、余白のある辺だけ負のマージンにする', () => {
  const symmetric = { width: 646, height: 250, visibleWidth: 646, visibleHeight: 192, top: 29, right: 0, bottom: 29, left: 0 }
  assert.equal(
    badgeCssDeclaration(symmetric),
    'height:calc(var(--badge-height) * 250 / 192);margin:calc(var(--badge-height) * -29 / 192) 0;',
  )
  const framed = { ...symmetric, visibleWidth: 564, visibleHeight: 168, top: 41, right: 41, bottom: 41, left: 41 }
  assert.equal(
    badgeCssDeclaration(framed),
    'height:calc(var(--badge-height) * 250 / 168);margin:calc(var(--badge-height) * -41 / 168) calc(var(--badge-height) * -41 / 168);',
  )
  assert.throws(() => badgeCssDeclaration({ ...symmetric, bottom: 30 }), /asymmetric/u)
})
