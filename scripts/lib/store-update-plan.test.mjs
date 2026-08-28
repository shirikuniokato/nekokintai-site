import assert from 'node:assert/strict'
import test from 'node:test'
import { createAtomicCommitInput, createStoreUpdatePlan } from './store-update-plan.mjs'

const currentManifest = {
  schemaVersion: 1,
  ios: { latestVersion: '1.0.0', storeUrl: 'ios', notes: ['前'] },
  android: { latestVersion: '1.0.0', storeUrl: 'android', notes: ['前'] },
}

const currentRoadmap = `
    <section class="rv-pane rv-pane-ios" aria-label="iOS のアップデート">
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">1.1.0</h2><span class="rv-chip st-review">しんさちゅう</span></div>
        <p class="rv-when">審査に出しました</p>
      </div>
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">1.0.0</h2><span class="rv-chip st-live">こうかいずみ</span></div>
      </div>
    </section>
    <section class="rv-pane rv-pane-android" aria-label="Android のアップデート">
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">1.1.0</h2><span class="rv-chip st-review">しんさちゅう</span></div>
        <p class="rv-when">審査に出しました</p>
      </div>
      <div class="rv-card">
        <div class="rv-head"><h2 class="rv-ver">1.0.0</h2><span class="rv-chip st-live">こうかいずみ</span></div>
      </div>
    </section>`

test('ストアとGitHubに差分がなければコミット対象を作らない', () => {
  const plan = createStoreUpdatePlan(currentManifest, currentRoadmap, {
    ios: { latestVersion: '1.0.0', notes: ['前'] },
    android: { latestVersion: '1.0.0', notes: ['前'] },
  })

  assert.equal(plan.manifestChanged, false)
  assert.equal(plan.roadmapChanged, false)
  assert.deepEqual(plan.files, [])
})

test('更新案内とroadmapを1コミットの追加ファイルにまとめる', () => {
  const plan = createStoreUpdatePlan(currentManifest, currentRoadmap, {
    ios: { latestVersion: '1.1.0', notes: ['新'] },
    android: { latestVersion: '1.1.0', notes: ['新'] },
  })
  const input = createAtomicCommitInput({
    repositoryNameWithOwner: 'owner/repository',
    branchName: 'main',
    expectedHeadOid: 'abc123',
    message: '同期する',
    files: plan.files,
  })

  assert.equal(plan.manifestChanged, true)
  assert.equal(plan.roadmapChanged, true)
  assert.deepEqual(
    input.fileChanges.additions.map(({ path }) => path),
    ['update.json', 'roadmap/index.html'],
  )
  assert.equal(
    Buffer.from(input.fileChanges.additions[0].contents, 'base64').toString('utf8'),
    plan.files[0].content,
  )
})

test('差分なしの空コミットは拒否する', () => {
  assert.throws(
    () =>
      createAtomicCommitInput({
        repositoryNameWithOwner: 'owner/repository',
        branchName: 'main',
        expectedHeadOid: 'abc123',
        message: '同期する',
        files: [],
      }),
    /コミットするファイルがありません/,
  )
})
