import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDeployableGitState, parseRemoteMainHead } from './deploy-guard.mjs'

const cleanMain = {
  branch: 'main',
  status: '',
  head: 'abc123',
  remoteHead: 'abc123',
}

test('クリーンでorigin/mainと一致するmainだけデプロイを許可する', () => {
  assert.doesNotThrow(() => assertDeployableGitState(cleanMain))
})

test('未コミットの変更があればデプロイを拒否する', () => {
  assert.throws(
    () => assertDeployableGitState({ ...cleanMain, status: ' M roadmap/index.html' }),
    /未コミットの変更/,
  )
})

test('main以外のブランチからのデプロイを拒否する', () => {
  assert.throws(
    () => assertDeployableGitState({ ...cleanMain, branch: 'feature' }),
    /main ブランチ/,
  )
})

test('origin/mainと一致しなければデプロイを拒否する', () => {
  assert.throws(
    () => assertDeployableGitState({ ...cleanMain, remoteHead: 'def456' }),
    /origin\/mainが一致しない/,
  )
})

test('git ls-remoteの出力からmainのHEADを読む', () => {
  assert.equal(parseRemoteMainHead('abc123\trefs/heads/main\n'), 'abc123')
  assert.throws(() => parseRemoteMainHead(''), /現在位置を取得できませんでした/)
})
