const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const MAX_NOTES = 3
const MAX_NOTE_LENGTH = 80

function decodeHtml(text) {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function shortenNote(note) {
  const characters = Array.from(note)
  if (characters.length <= MAX_NOTE_LENGTH) return note
  return `${characters.slice(0, MAX_NOTE_LENGTH - 1).join('')}…`
}

export function normalizeReleaseNotes(text) {
  const notes = decodeHtml(text)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[・●▪︎■◆◇◦*-]+\s*/, ''))
    .filter(Boolean)
    .slice(0, MAX_NOTES)
    .map(shortenNote)

  if (notes.length === 0) throw new Error('ストアの更新内容が空です')
  return notes
}

export function parseAppleAppStorePage(html) {
  const serializedDataMatch = html.match(
    /<script[^>]*\bid=["']?serialized-server-data["']?[^>]*>([\s\S]*?)<\/script>/,
  )
  if (!serializedDataMatch) {
    throw new Error('App Store の公開情報を取得できませんでした')
  }

  let payload
  try {
    payload = JSON.parse(serializedDataMatch[1])
  } catch {
    throw new Error('App Store の公開情報を読み取れませんでした')
  }

  const entries = Array.isArray(payload?.data) ? payload.data : []
  const latestRelease = entries
    .map((entry) => entry?.data?.shelfMapping?.mostRecentVersion?.items?.[0])
    .find(Boolean)
  const version =
    typeof latestRelease?.primarySubtitle === 'string'
      ? latestRelease.primarySubtitle.match(/(?:バージョン)?\s*(\d+\.\d+\.\d+)$/)?.[1]
      : undefined
  if (!VERSION_PATTERN.test(version ?? '')) {
    throw new Error('App Store の公開バージョンを取得できませんでした')
  }
  if (typeof latestRelease.text !== 'string') {
    throw new Error('App Store の更新内容を取得できませんでした')
  }
  return { latestVersion: version, notes: normalizeReleaseNotes(latestRelease.text) }
}

export function parseGooglePlayPage(html) {
  const versionMatch = html.match(/\[\[\["(\d+\.\d+\.\d+)"\]\],\[\[\[\d+\]\]/)
  if (!versionMatch) throw new Error('Google Play の公開バージョンを取得できませんでした')

  const headingAt = html.indexOf('>新機能</h2>')
  const descriptionStart = html.indexOf('<div itemprop="description">', headingAt)
  const contentStart = descriptionStart + '<div itemprop="description">'.length
  const descriptionEnd = html.indexOf('</div>', contentStart)
  if (headingAt < 0 || descriptionStart < 0 || descriptionEnd < 0) {
    throw new Error('Google Play の更新内容を取得できませんでした')
  }

  return {
    latestVersion: versionMatch[1],
    notes: normalizeReleaseNotes(html.slice(contentStart, descriptionEnd)),
  }
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)

  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index]
    if (difference !== 0) return difference
  }
  return 0
}

function mergePublishedPlatform(current, published) {
  if (!VERSION_PATTERN.test(current.latestVersion ?? '') || !VERSION_PATTERN.test(published.latestVersion ?? '')) {
    throw new Error('update.json またはストアのバージョン形式が不正です')
  }
  if (compareVersions(published.latestVersion, current.latestVersion) < 0) return current
  return { ...current, ...published }
}

export function mergePublishedUpdates(manifest, published) {
  if (manifest?.schemaVersion !== 1 || !manifest.ios || !manifest.android) {
    throw new Error('update.json の形式が不正です')
  }
  return {
    ...manifest,
    ios: mergePublishedPlatform(manifest.ios, published.ios),
    android: mergePublishedPlatform(manifest.android, published.android),
  }
}

export function formatManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}
