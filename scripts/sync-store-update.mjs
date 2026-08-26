/**
 * 公開ストアの商品ページを確認し、update.json と roadmap を同期する。
 *
 *   npm run sync-store-update:dry-run
 *   npm run sync-store-update
 *
 * GitHub APIで対象ファイルだけを更新するため、ローカル作業ツリーには触れない。
 */
import { execFileSync } from 'node:child_process'
import { postSlack } from './lib/slack.mjs'
import { markPublishedRoadmapVersions } from './lib/roadmap-release.mjs'
import {
  formatManifest,
  mergePublishedUpdates,
  parseAppleLookup,
  parseGooglePlayPage,
} from './lib/store-update-manifest.mjs'

const APPLE_LOOKUP_URL = 'https://itunes.apple.com/lookup?id=6801066427&country=jp'
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.ccya.nekokintai&hl=ja&gl=JP'
const GITHUB_CONTENT_BASE_URL = 'https://api.github.com/repos/shirikuniokato/nekokintai-site/contents'
const CLOUDFLARE_WORKFLOW_URL =
  'https://api.github.com/repos/shirikuniokato/nekokintai-site/actions/workflows/deploy-cloudflare.yml/dispatches'
const PUBLIC_MANIFEST_URL = 'https://nekokintai.com/update.json'
const PUBLIC_ROADMAP_URL = 'https://nekokintai.com/roadmap/'
const PUBLICATION_WAIT_ATTEMPTS = 60
const dryRun = process.argv.includes('--dry-run')

async function fetchOk(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), ...options })
  if (!response.ok) throw new Error(`${url} の取得に失敗しました（HTTP ${response.status}）`)
  return response
}

function githubToken() {
  return execFileSync('/usr/bin/gh', ['auth', 'token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function readRepositoryFile(token, path) {
  const response = await fetchOk(`${GITHUB_CONTENT_BASE_URL}/${path}?ref=main`, {
    headers: githubHeaders(token),
  })
  const file = await response.json()
  const text = Buffer.from(file.content, 'base64').toString('utf8')
  return { text, sha: file.sha }
}

async function readPublishedStores() {
  const [appleResponse, googleResponse] = await Promise.all([
    fetchOk(APPLE_LOOKUP_URL),
    fetchOk(GOOGLE_PLAY_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nekokintai-update-sync/1.0)' },
    }),
  ])
  const [apple, googleHtml] = await Promise.all([appleResponse.json(), googleResponse.text()])
  return { ios: parseAppleLookup(apple), android: parseGooglePlayPage(googleHtml) }
}

async function updateRepositoryFile(token, path, sha, content) {
  await fetchOk(`${GITHUB_CONTENT_BASE_URL}/${path}`, {
    method: 'PUT',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '公開ストアの更新情報を同期する',
      content: Buffer.from(content).toString('base64'),
      sha,
      branch: 'main',
    }),
  })
}

async function triggerCloudflareDeployment(token) {
  await fetchOk(CLOUDFLARE_WORKFLOW_URL, {
    method: 'POST',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  })
}

async function waitForPublicFiles(expectedManifest, expectedRoadmap) {
  for (let attempt = 0; attempt < PUBLICATION_WAIT_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5_000))
    const [manifestResponse, roadmapResponse] = await Promise.all([
      fetchOk(`${PUBLIC_MANIFEST_URL}?sync=${Date.now()}`),
      fetchOk(`${PUBLIC_ROADMAP_URL}?sync=${Date.now()}`),
    ])
    const [actualManifest, actualRoadmap] = await Promise.all([
      manifestResponse.json(),
      roadmapResponse.text(),
    ])
    if (
      formatManifest(actualManifest) === formatManifest(expectedManifest) &&
      actualRoadmap === expectedRoadmap
    ) return
  }
  throw new Error('Cloudflare Pages の update.json と roadmap に5分以内に反映されませんでした')
}

function logPlatformUpdate(label, current, published, next) {
  if (published.latestVersion !== next.latestVersion) {
    console.log(`${label}: ${current.latestVersion}（ストアの古い ${published.latestVersion} は無視）`)
    return
  }
  console.log(`${label}: ${current.latestVersion} → ${next.latestVersion}`)
}

async function main() {
  const token = githubToken()
  const [manifestFile, roadmapFile, published] = await Promise.all([
    readRepositoryFile(token, 'update.json'),
    readRepositoryFile(token, 'roadmap/index.html'),
    readPublishedStores(),
  ])
  const current = JSON.parse(manifestFile.text)
  const next = mergePublishedUpdates(current, published)
  const nextRoadmap = markPublishedRoadmapVersions(roadmapFile.text, {
    ios: next.ios.latestVersion,
    android: next.android.latestVersion,
  })
  const manifestChanged = formatManifest(current) !== formatManifest(next)
  const roadmapChanged = roadmapFile.text !== nextRoadmap

  logPlatformUpdate('App Store', current.ios, published.ios, next.ios)
  logPlatformUpdate('Google Play', current.android, published.android, next.android)
  if (!manifestChanged && !roadmapChanged) {
    if (!dryRun) await waitForPublicFiles(next, nextRoadmap)
    console.log('update.json と roadmap に変更はありません')
    return
  }
  if (dryRun) {
    if (manifestChanged) console.log(formatManifest(next))
    console.log(`roadmap: ${roadmapChanged ? '公開状態を更新します' : '変更はありません'}`)
    console.log('dry-run: GitHubと公開ページは変更していません')
    return
  }

  if (manifestChanged) {
    await updateRepositoryFile(token, 'update.json', manifestFile.sha, formatManifest(next))
  }
  if (roadmapChanged) {
    await updateRepositoryFile(token, 'roadmap/index.html', roadmapFile.sha, nextRoadmap)
  }
  await triggerCloudflareDeployment(token)
  await waitForPublicFiles(next, nextRoadmap)
  const message = [
    '*ねこ勤怠の更新案内とroadmapを同期した*',
    `App Store: ${current.ios.latestVersion} → ${next.ios.latestVersion}`,
    `Google Play: ${current.android.latestVersion} → ${next.android.latestVersion}`,
  ].join('\n')
  await postSlack(message)
  console.log('Cloudflare Pagesのupdate.jsonとroadmapへの反映まで確認しました')
}

main().catch(async (cause) => {
  const message = cause instanceof Error ? cause.message : String(cause)
  console.error(`更新案内の同期に失敗しました: ${message}`)
  if (!dryRun) await postSlack(`*ねこ勤怠の更新案内を同期できなかった*\n${message}`)
  process.exitCode = 1
})
