export function parseRemoteMainHead(output) {
  const [head, ref, ...rest] = output.trim().split(/\s+/)
  if (!head || ref !== 'refs/heads/main' || rest.length > 0) {
    throw new Error('origin/main の現在位置を取得できませんでした')
  }
  return head
}

export function assertDeployableGitState({ branch, status, head, remoteHead }) {
  if (branch !== 'main') throw new Error('本番の再デプロイは main ブランチからだけ実行できます')
  if (status.trim()) throw new Error('未コミットの変更があるため、本番へデプロイできません')
  if (head !== remoteHead) {
    throw new Error('ローカルHEADとorigin/mainが一致しないため、本番へデプロイできません')
  }
}
