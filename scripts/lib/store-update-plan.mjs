import { markPublishedRoadmapVersions } from './roadmap-release.mjs'
import { formatManifest, mergePublishedUpdates } from './store-update-manifest.mjs'

export function createStoreUpdatePlan(currentManifest, currentRoadmap, published) {
  const nextManifest = mergePublishedUpdates(currentManifest, published)
  const nextRoadmap = markPublishedRoadmapVersions(currentRoadmap, {
    ios: nextManifest.ios.latestVersion,
    android: nextManifest.android.latestVersion,
  })
  const nextManifestText = formatManifest(nextManifest)
  const files = [
    ...(formatManifest(currentManifest) === nextManifestText
      ? []
      : [{ path: 'update.json', content: nextManifestText }]),
    ...(currentRoadmap === nextRoadmap
      ? []
      : [{ path: 'roadmap/index.html', content: nextRoadmap }]),
  ]

  return {
    nextManifest,
    nextRoadmap,
    manifestChanged: files.some(({ path }) => path === 'update.json'),
    roadmapChanged: files.some(({ path }) => path === 'roadmap/index.html'),
    files,
  }
}

export function createAtomicCommitInput({
  repositoryNameWithOwner,
  branchName,
  expectedHeadOid,
  message,
  files,
}) {
  if (!files.length) throw new Error('GitHubへコミットするファイルがありません')

  return {
    branch: { repositoryNameWithOwner, branchName },
    expectedHeadOid,
    message: { headline: message },
    fileChanges: {
      additions: files.map(({ path, content }) => ({
        path,
        contents: Buffer.from(content, 'utf8').toString('base64'),
      })),
    },
  }
}
