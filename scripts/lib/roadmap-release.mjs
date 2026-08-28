const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const PUBLISHED_MESSAGE = '公開しました。お手元に届くまで、1日ほどかかることがあります'

function publishCard(card) {
  const statusPattern = /<span class="rv-chip st-(?:live|review|prep)">[^<]*<\/span>/
  const publishedStatus = '<span class="rv-chip st-live">こうかいずみ</span>'
  const statusMatch = card.match(statusPattern)
  if (!statusMatch) throw new Error('roadmap の更新状態を読み取れませんでした')
  if (statusMatch[0] === publishedStatus) return card

  const publishedCard = card.replace(statusPattern, publishedStatus)
  const timingPattern = /<p class="rv-when">[^<]*<\/p>/
  if (timingPattern.test(publishedCard)) {
    return publishedCard.replace(timingPattern, `<p class="rv-when">${PUBLISHED_MESSAGE}</p>`)
  }

  return publishedCard.replace(
    /(<div class="rv-head">.*<\/div>)/,
    `$1\n        <p class="rv-when">${PUBLISHED_MESSAGE}</p>`,
  )
}

function publishPlatformSection(section, platform, latestVersion) {
  let foundLatestVersion = false
  const cardPattern = /      <div class="rv-card">\n[\s\S]*?(?=\n      <div class="rv-(?:card|divider)">|\n    <\/section>)/g
  const updatedSection = section.replace(cardPattern, (card) => {
    const version = card.match(/<h2 class="rv-ver">(\d+\.\d+\.\d+)<\/h2>/)?.[1]
    if (!version) throw new Error(`roadmap の ${platform} バージョンを読み取れませんでした`)
    if (version === latestVersion) foundLatestVersion = true
    return version === latestVersion ? publishCard(card) : card
  })

  if (!foundLatestVersion) {
    throw new Error(`roadmap の ${platform} に v${latestVersion} のカードがありません`)
  }
  return updatedSection
}

export function markPublishedRoadmapVersions(html, publishedVersions) {
  let updatedHtml = html

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
      publishPlatformSection(section, platform, latestVersion),
    )
  }

  return updatedHtml
}
