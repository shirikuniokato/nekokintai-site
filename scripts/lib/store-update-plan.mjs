import { FALLBACK_LOCALE } from '../../assets/lp/locale.mjs'
import { renderLocalizedPage } from './localized-pages.mjs'
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

/**
 * 本番の /roadmap/ に出るはずの HTML。公開ファイルの書き出し（build-pages.mjs）は日本語のページにも
 * hreflang などを足すので、リポジトリの roadmap/index.html と本番をそのまま比べると一致しない（2026-11-04〜）。
 * 書き出しと同じ変換を通してから比べる
 */
export function publicRoadmapHtml(roadmapHtml) {
  return renderLocalizedPage(roadmapHtml, {
    htmlPath: 'roadmap/index.html',
    locale: FALLBACK_LOCALE,
    copy: {},
    sitePagePaths: [],
  })
}
