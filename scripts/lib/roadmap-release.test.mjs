import assert from 'node:assert/strict'
import test from 'node:test'
import { markPublishedRoadmapVersions } from './roadmap-release.mjs'

function roadmapFixture({ iosStatus = 'review', androidStatus = 'prep' } = {}) {
  return `
    <section class="rv-pane rv-pane-ios" aria-label="iOS のアップデート">
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">2.1.0</h2><span class="rv-chip st-prep">じゅんびちゅう</span></div>
        <ul class="rv-list"><li>この先の予定</li></ul>
      </div>
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">2.0.0</h2><span class="rv-chip st-${iosStatus}">しんさちゅう</span></div>
        <p class="rv-when">審査に出しました</p>
        <ul class="rv-list"><li>今回の更新</li></ul>
      </div>
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">1.9.0</h2><span class="rv-chip st-prep">こうかいみおくり</span></div>
        <p class="rv-when">この版は公開しません</p>
      </div>
    </section>
    <section class="rv-pane rv-pane-android" aria-label="Android のアップデート">
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">2.0.0</h2><span class="rv-chip st-${androidStatus}">じゅんびちゅう</span></div>
        <ul class="rv-list"><li>今回の更新</li></ul>
      </div>
      <div class="rv-divider"><img src="cat.png" alt=""></div>
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">1.0.0</h2><span class="rv-chip st-live">こうかいずみ</span></div>
        <ul class="rv-list"><li>最初の更新</li></ul>
      </div>
    </section>`
}

test('公開されたOSの同じバージョンを公開済みにする', () => {
  const updated = markPublishedRoadmapVersions(roadmapFixture(), {
    ios: '2.0.0',
    android: '2.0.0',
  })

  assert.match(updated, /<h2 class="rv-ver">2\.0\.0<\/h2><span class="rv-chip st-live">こうかいずみ<\/span>/)
  assert.equal(
    updated.match(/公開しました。お手元に届くまで、1日ほどかかることがあります/g)?.length,
    2,
  )
  assert.match(updated, /<h2 class="rv-ver">2\.1\.0<\/h2><span class="rv-chip st-prep">じゅんびちゅう<\/span>/)
  assert.match(updated, /<h2 class="rv-ver">1\.9\.0<\/h2><span class="rv-chip st-prep">こうかいみおくり<\/span>/)
  assert.match(updated, /<p class="rv-when">この版は公開しません<\/p>/)
})

test('公開済みカードには変更を加えない', () => {
  const current = roadmapFixture({ iosStatus: 'live', androidStatus: 'live' })
    .replaceAll('しんさちゅう', 'こうかいずみ')
    .replaceAll('じゅんびちゅう', 'こうかいずみ')
  const updated = markPublishedRoadmapVersions(current, {
    ios: '2.0.0',
    android: '2.0.0',
  })

  assert.equal(updated, current)
})

function localizedRoadmapFixture() {
  return `<html lang="ja" data-i18n-source="/assets/roadmap/locales.json">
    <section class="rv-pane rv-pane-ios" aria-label="iOS のアップデート">
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">2.0.0</h2><span class="rv-chip st-review" data-i18n="statusInReview">しんさちゅう</span></div>
        <p class="rv-when" data-i18n="whenInReview">審査に出しました</p>
        <ul class="rv-list"><li data-i18n="ios200Item1">今回の更新</li></ul>
      </div>
    </section>
    <section class="rv-pane rv-pane-android" aria-label="Android のアップデート">
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">2.0.0</h2><span class="rv-chip st-prep" data-i18n="statusPreparing">じゅんびちゅう</span></div>
        <ul class="rv-list"><li data-i18n="ios200Item1">今回の更新</li></ul>
      </div>
    </section>`
}

test('多言語化した roadmap では、チップと公開文に翻訳キーを付けて公開済みにする', () => {
  const updated = markPublishedRoadmapVersions(localizedRoadmapFixture(), { ios: '2.0.0', android: '2.0.0' })

  assert.equal(
    updated.match(/<span class="rv-chip st-live" data-i18n="statusPublished">こうかいずみ<\/span>/g)?.length,
    2,
  )
  assert.equal(
    updated.match(/<p class="rv-when" data-i18n="whenPublished">公開しました。お手元に届くまで、1日ほどかかることがあります<\/p>/g)?.length,
    2,
    '既存の公開文の置き換えと、公開文のないカードへの追加の両方にキーが付く',
  )
  assert.doesNotMatch(updated, /statusInReview|whenInReview/)
  // 2回目は何も変えない
  assert.equal(markPublishedRoadmapVersions(updated, { ios: '2.0.0', android: '2.0.0' }), updated)
})

test('翻訳の仕組みがない古い roadmap には翻訳キーを持ち込まない', () => {
  const updated = markPublishedRoadmapVersions(roadmapFixture(), { ios: '2.0.0', android: '2.0.0' })

  assert.doesNotMatch(updated, /data-i18n/)
})

test('公開版のカードがなければ失敗する', () => {
  assert.throws(
    () => markPublishedRoadmapVersions(roadmapFixture(), { ios: '3.0.0' }),
    /roadmap の ios に v3\.0\.0 のカードがありません/,
  )
})
