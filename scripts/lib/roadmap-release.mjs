const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const PUBLISHED_MESSAGE = '公開しました。お手元に届くまで、1日ほどかかることがあります'
// roadmap が多言語化されたあとは、状態チップと公開文に翻訳キーが付く。
// 同期はチップの文言を書き換えるので、キーも一緒に書き、翻訳側（assets/roadmap/locales.json）が拾えるようにする
const PUBLISHED_STATUS_KEY = 'statusPublished'
const PUBLISHED_MESSAGE_KEY = 'whenPublished'
const STATUS_PATTERN = /<span class="rv-chip st-(?:live|review|prep)"(?: data-i18n="[^"]*")?>[^<]*<\/span>/
const TIMING_PATTERN = /<p class="rv-when"(?: data-i18n="[^"]*")?>[^<]*<\/p>/

/** ページが翻訳の仕組みを使っていれば、書き足す要素にも翻訳キーを付ける。古い HTML にはキーを持ち込まない */
function usesTranslations(html) {
  return html.includes('data-i18n-source=')
}

function publishedStatus(localized) {
  return `<span class="rv-chip st-live"${localized ? ` data-i18n="${PUBLISHED_STATUS_KEY}"` : ''}>こうかいずみ</span>`
}

function publishedTiming(localized) {
  return `<p class="rv-when"${localized ? ` data-i18n="${PUBLISHED_MESSAGE_KEY}"` : ''}>${PUBLISHED_MESSAGE}</p>`
}

function publishCard(card, localized) {
  const statusMatch = card.match(STATUS_PATTERN)
  if (!statusMatch) throw new Error('roadmap の更新状態を読み取れませんでした')
  if (statusMatch[0] === publishedStatus(localized)) return card

  const publishedCard = card.replace(STATUS_PATTERN, publishedStatus(localized))
  if (TIMING_PATTERN.test(publishedCard)) {
    return publishedCard.replace(TIMING_PATTERN, publishedTiming(localized))
  }

  return publishedCard.replace(
    /(<div class="rv-head">.*<\/div>)/,
    `$1\n        ${publishedTiming(localized)}`,
  )
}

function publishPlatformSection(section, platform, latestVersion, localized) {
  let foundLatestVersion = false
  const cardPattern = /      <div class="rv-card">\n[\s\S]*?(?=\n      <div class="rv-(?:card|divider)">|\n    <\/section>)/g
  const updatedSection = section.replace(cardPattern, (card) => {
    const version = card.match(/<h2 class="rv-ver">(\d+\.\d+\.\d+)<\/h2>/)?.[1]
    if (!version) throw new Error(`roadmap の ${platform} バージョンを読み取れませんでした`)
    if (version === latestVersion) foundLatestVersion = true
    return version === latestVersion ? publishCard(card, localized) : card
  })

  if (!foundLatestVersion) {
    throw new Error(`roadmap の ${platform} に v${latestVersion} のカードがありません`)
  }
  return updatedSection
}

export function markPublishedRoadmapVersions(html, publishedVersions) {
  let updatedHtml = html
  const localized = usesTranslations(html)

  for (const [platform, latestVersion] of Object.entries(publishedVersions)) {
    if (!VERSION_PATTERN.test(latestVersion ?? '')) {
      throw new Error(`roadmap に反映する ${platform} のバージョン形式が不正です`)
    }

    const sectionPattern = new RegExp(
      `<section class="rv-pane rv-pane-${platform}"[\\s\\S]*?<\\/section>`,
    )
    const section = updatedHtml.match(sectionPattern)?.[0]
    if (!section) throw new Error(`roadmap の ${platform} セクションがありません`)

    updatedHtml = updatedHtml.replace(
      section,
      publishPlatformSection(section, platform, latestVersion, localized),
    )
  }

  return updatedHtml
}
