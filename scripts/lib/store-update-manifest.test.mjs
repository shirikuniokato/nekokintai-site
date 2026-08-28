import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatManifest,
  mergePublishedUpdates,
  normalizeReleaseNotes,
  parseAppleAppStorePage,
  parseGooglePlayPage,
} from './store-update-manifest.mjs'

function appleProductPage(latestRelease) {
  const payload = {
    data: [{ data: { shelfMapping: { mostRecentVersion: { items: [latestRelease] } } } }],
  }
  return `<script type="application/json" id="serialized-server-data">${JSON.stringify(payload)}</script>`
}

test('App Storeの商品ページから公開版と先頭3件の更新内容を読む', () => {
  assert.deepEqual(
    parseAppleAppStorePage(
      appleProductPage({
        primarySubtitle: 'バージョン2.1.0',
        text: '・ひとつめ\n・ふたつめ\n・みっつめ\n・よっつめ',
      }),
    ),
    { latestVersion: '2.1.0', notes: ['ひとつめ', 'ふたつめ', 'みっつめ'] },
  )
})

test('App Storeの商品ページに公開情報がなければ失敗する', () => {
  assert.throws(() => parseAppleAppStorePage('<html></html>'), /公開情報を取得できませんでした/)
  assert.throws(
    () =>
      parseAppleAppStorePage(
        '<script id="serialized-server-data" type="application/json">invalid</script>',
      ),
    /公開情報を読み取れませんでした/,
  )
  assert.throws(
    () => parseAppleAppStorePage(appleProductPage({ primarySubtitle: 'バージョン2.1.0' })),
    /更新内容を取得できませんでした/,
  )
})

test('Google Playの商品ページから公開版と更新内容を読む', () => {
  const html = [
    '[[["2.2.0"]],[[[36]],[[[24,"7.0"]]]]]',
    '<h2 class="XfZNbf">新機能</h2>',
    '<div itemprop="description">・表示を直しました<br>・猫をふやしました &amp; 整えました</div>',
  ].join('')
  assert.deepEqual(parseGooglePlayPage(html), {
    latestVersion: '2.2.0',
    notes: ['表示を直しました', '猫をふやしました & 整えました'],
  })
})

test('更新内容は80文字までに収める', () => {
  const [note] = normalizeReleaseNotes(`・${'猫'.repeat(90)}`)
  assert.equal(Array.from(note).length, 80)
  assert.equal(note.endsWith('…'), true)
})

test('公開されたOSの値だけを既存JSONへ重ねる', () => {
  const current = {
    schemaVersion: 1,
    ios: { latestVersion: '1.2.0', storeUrl: 'ios', notes: ['前'] },
    android: { latestVersion: '1.1.0', storeUrl: 'android', notes: ['前'] },
  }
  const next = mergePublishedUpdates(current, {
    ios: { latestVersion: '2.0.0', notes: ['新'] },
    android: { latestVersion: '1.1.0', notes: ['前'] },
  })
  assert.deepEqual(next.ios, { latestVersion: '2.0.0', storeUrl: 'ios', notes: ['新'] })
  assert.deepEqual(next.android, current.android)
  assert.equal(formatManifest(next).endsWith('\n'), true)
})

test('ストアが古いバージョンを返しても更新案内を後退させない', () => {
  const current = {
    schemaVersion: 1,
    ios: { latestVersion: '2.0.0', storeUrl: 'ios', notes: ['現在'] },
    android: { latestVersion: '2.1.0', storeUrl: 'android', notes: ['現在'] },
  }
  const next = mergePublishedUpdates(current, {
    ios: { latestVersion: '1.2.0', notes: ['古い'] },
    android: { latestVersion: '2.0.9', notes: ['古い'] },
  })

  assert.deepEqual(next.ios, current.ios)
  assert.deepEqual(next.android, current.android)
})

test('同じバージョンの更新内容は同期する', () => {
  const current = {
    schemaVersion: 1,
    ios: { latestVersion: '2.0.0', storeUrl: 'ios', notes: ['前'] },
    android: { latestVersion: '2.0.0', storeUrl: 'android', notes: ['前'] },
  }
  const next = mergePublishedUpdates(current, {
    ios: { latestVersion: '2.0.0', notes: ['新'] },
    android: { latestVersion: '2.0.0', notes: ['新'] },
  })

  assert.deepEqual(next.ios.notes, ['新'])
  assert.deepEqual(next.android.notes, ['新'])
})
