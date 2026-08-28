/**
 * GitHub main と同じ内容だけを、GitHub Actions 経由で本番へ再デプロイする。
 * 通常のデプロイは main への push で自動実行されるため、このスクリプトは再実行用。
 */
import { execFileSync } from 'node:child_process'
import { assertDeployableGitState, parseRemoteMainHead } from './lib/deploy-guard.mjs'

function git(args) {
  return execFileSync('/usr/bin/git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim()
}

function main() {
  const branch = git(['branch', '--show-current'])
  const status = git(['status', '--porcelain'])
  const head = git(['rev-parse', 'HEAD'])
  const remoteHead = parseRemoteMainHead(git(['ls-remote', 'origin', 'refs/heads/main']))

  assertDeployableGitState({ branch, status, head, remoteHead })
  execFileSync('/usr/bin/gh', ['workflow', 'run', 'deploy-cloudflare.yml', '--ref', 'main'], {
    stdio: 'inherit',
  })
  console.log('GitHub Actions の本番再デプロイを開始しました')
}

try {
  main()
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause)
  console.error(`本番を再デプロイできませんでした: ${message}`)
  process.exitCode = 1
}
