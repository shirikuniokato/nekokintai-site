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
import {
  formatManifest,
  parseAppleAppStorePage,
  parseGooglePlayPage,
} from './lib/store-update-manifest.mjs'
import { createAtomicCommitInput, createStoreUpdatePlan } from './lib/store-update-plan.mjs'

const APPLE_APP_STORE_URL = 'https://apps.apple.com/jp/app/id6801066427'
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.ccya.nekokintai&hl=ja&gl=JP'
const GITHUB_CONTENT_BASE_URL = 'https://api.github.com/repos/shirikuniokato/nekokintai-site/contents'
const GITHUB_REF_URL =
  'https://api.github.com/repos/shirikuniokato/nekokintai-site/git/ref/heads/main'
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'
const GITHUB_REPOSITORY = 'shirikuniokato/nekokintai-site'
const GITHUB_BRANCH = 'main'
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

async function readRepositoryHead(token) {
  const response = await fetchOk(GITHUB_REF_URL, { headers: githubHeaders(token) })
  const ref = await response.json()
  if (typeof ref?.object?.sha !== 'string') {
    throw new Error('GitHub main の現在位置を取得できませんでした')
  }
  return ref.object.sha
}

async function readRepositoryFile(token, path, ref) {
  const response = await fetchOk(`${GITHUB_CONTENT_BASE_URL}/${path}?ref=${ref}`, {
    headers: githubHeaders(token),
  })
  const file = await response.json()
  if (file?.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new Error(`GitHubの ${path} を読み取れませんでした`)
  }
  return Buffer.from(file.content, 'base64').toString('utf8')
}

async function readPublishedStores() {
  const [appleResponse, googleResponse] = await Promise.all([
    fetchOk(APPLE_APP_STORE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nekokintai-update-sync/1.0)' },
    }),
    fetchOk(GOOGLE_PLAY_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nekokintai-update-sync/1.0)' },
    }),
  ])
  const [appleHtml, googleHtml] = await Promise.all([appleResponse.text(), googleResponse.text()])
  return { ios: parseAppleAppStorePage(appleHtml), android: parseGooglePlayPage(googleHtml) }
}

async function commitRepositoryFiles(token, expectedHeadOid, files) {
  const query = `
    mutation CommitStoreUpdate($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) { commit { oid } }
    }
  `
  const input = createAtomicCommitInput({
    repositoryNameWithOwner: GITHUB_REPOSITORY,
    branchName: GITHUB_BRANCH,
    expectedHeadOid,
    message: '公開ストアの更新情報を同期する',
    files,
  })
  const response = await fetchOk(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { input } }),
  })
  const payload = await response.json()
  const commitOid = payload.data?.createCommitOnBranch?.commit?.oid
  if (typeof commitOid === 'string') return commitOid

  const detail = payload.errors?.map(({ message }) => message).join('; ')
  throw new Error(`GitHubの同期コミットを作成できませんでした${detail ? `: ${detail}` : ''}`)
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
  const expectedHeadOid = await readRepositoryHead(token)
  const [manifestText, roadmapText, published] = await Promise.all([
    readRepositoryFile(token, 'update.json', expectedHeadOid),
    readRepositoryFile(token, 'roadmap/index.html', expectedHeadOid),
    readPublishedStores(),
  ])
  const current = JSON.parse(manifestText)
  const plan = createStoreUpdatePlan(current, roadmapText, published)

  logPlatformUpdate('App Store', current.ios, published.ios, plan.nextManifest.ios)
  logPlatformUpdate('Google Play', current.android, published.android, plan.nextManifest.android)
  if (!plan.files.length) {
    console.log('update.json と roadmap に変更はありません')
    return
  }
  if (dryRun) {
    if (plan.manifestChanged) console.log(formatManifest(plan.nextManifest))
    console.log(`roadmap: ${plan.roadmapChanged ? '公開状態を更新します' : '変更はありません'}`)
    console.log('dry-run: GitHubと公開ページは変更していません')
    return
  }

  await commitRepositoryFiles(token, expectedHeadOid, plan.files)
  await waitForPublicFiles(plan.nextManifest, plan.nextRoadmap)
  const message = [
    '*ねこ勤怠の更新案内とroadmapを同期した*',
    `App Store: ${current.ios.latestVersion} → ${plan.nextManifest.ios.latestVersion}`,
    `Google Play: ${current.android.latestVersion} → ${plan.nextManifest.android.latestVersion}`,
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
