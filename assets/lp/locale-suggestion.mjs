// 端末の言語とちがう言語のページを開いた人へ、ページの上に「〇〇語で見る」の帯を出す。
// 中身を勝手に切りかえないのは、検索エンジンが英語の端末としてページを読むため（locale.mjs の preferredLocale）。
// 帯の文言は、案内する先の言語で書く（その言語の人が読むので）。

const SUGGESTION_COPY = {
  ja: { link: '日本語で見る', close: 'とじる' },
  en: { link: 'View this page in English', close: 'Close' },
  ko: { link: '이 페이지를 한국어로 보기', close: '닫기' },
  'zh-TW': { link: '以繁體中文瀏覽此頁', close: '關閉' },
  'zh-Hans': { link: '以简体中文查看此页', close: '关闭' },
}

const BAR_STYLE = [
  'display:flex', 'justify-content:center', 'align-items:center', 'gap:10px',
  'padding:10px 44px', 'position:relative',
  'background:var(--paper,#FFFFFF)', 'border-bottom:1px solid var(--border,#DCEDF2)',
  'font-size:13px', 'line-height:1.5', 'text-align:center',
].join(';')
const LINK_STYLE = 'color:var(--deep,#155C69);text-decoration:underline;text-underline-offset:3px;'
const CLOSE_STYLE = [
  'position:absolute', 'right:8px', 'top:50%', 'transform:translateY(-50%)',
  'width:32px', 'height:32px', 'border:0', 'background:transparent',
  'color:var(--muted,#7FA6AF)', 'font:inherit', 'font-size:18px', 'line-height:1', 'cursor:pointer',
].join(';')

export function suggestionCopy(locale) {
  return SUGGESTION_COPY[locale] ?? null
}

/**
 * 帯を body の先頭に差しこむ。リンクを押したら onAccept、× を押したら onDismiss を呼んで帯を消す。
 * href は JavaScript が動かないときと、新しいタブで開くとき用の行き先
 */
export function showLocaleSuggestion({ locale, href, onAccept, onDismiss }) {
  const copy = suggestionCopy(locale)
  if (!copy || typeof document === 'undefined' || !document.body) return null

  const bar = document.createElement('div')
  bar.className = 'locale-suggestion'
  bar.setAttribute('lang', locale)
  bar.setAttribute('style', BAR_STYLE)

  const link = document.createElement('a')
  link.href = href
  link.hreflang = locale
  link.textContent = copy.link
  link.setAttribute('style', LINK_STYLE)
  link.addEventListener('click', (event) => {
    event.preventDefault()
    bar.remove()
    onAccept()
  })

  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '×'
  close.setAttribute('aria-label', copy.close)
  close.setAttribute('style', CLOSE_STYLE)
  close.addEventListener('click', () => {
    bar.remove()
    onDismiss()
  })

  bar.append(link, close)
  document.body.prepend(bar)
  return bar
}
