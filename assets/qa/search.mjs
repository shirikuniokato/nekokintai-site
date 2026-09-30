/**
 * よくあるしつもんの絞りこみ。
 *
 * 中身は locales.json から描かれるので、**描かれたあとの文字**を見て絞る。
 * 日本語・中国語は単語の切れ目が無いので、素直に部分一致でさがす。
 * 質問文だけでなく、こたえと補足も対象にする（「打刻」「電池」のような本文の語で引く人がいる）。
 *
 * JS が動かない環境では検索欄そのものを出さない（HTML 側で hidden にしてある）。
 * そのときは今までどおり、しつもんが全部並ぶ。
 */

/** 全角・半角、濁点の分かれかたをそろえ、カタカナはひらがなに寄せる。 */
export function normalizeSearchText(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/gu, (kana) => String.fromCharCode(kana.charCodeAt(0) - 0x60))
    .replace(/\s+/gu, ' ')
    .trim()
}

/** 空白で区切ったことばを全部ふくむか（順番は問わない）。 */
export function matchesQuery(haystack, query) {
  const target = normalizeSearchText(haystack)
  const words = normalizeSearchText(query).split(' ').filter((word) => word.length > 0)
  if (words.length === 0) return true
  return words.every((word) => target.includes(word))
}

function itemText(item) {
  return item.textContent ?? ''
}

/**
 * 当たったしつもんだけを残す。戻り値は当たった件数。
 * 当たったものはひらいて中身を見せ、空になった見出しごと隠す。
 */
export function applySearch(root, query) {
  const searching = normalizeSearchText(query).length > 0
  let hits = 0

  for (const section of root.querySelectorAll('section[data-i18n-aria-label]')) {
    let sectionHits = 0
    for (const item of section.querySelectorAll('details')) {
      const hit = matchesQuery(itemText(item), query)
      item.hidden = searching && !hit
      if (!searching) {
        // 検索をやめたら、開け閉めは利用者の手に戻す（勝手に開いたままにしない）
        item.open = false
      } else if (hit) {
        item.open = true
        sectionHits += 1
      }
    }
    section.hidden = searching && sectionHits === 0
    hits += sectionHits
  }
  return searching ? hits : -1
}

function setup() {
  const form = document.querySelector('.qa-search')
  const input = form?.querySelector('input')
  const clear = form?.querySelector('.qa-search-clear')
  const empty = form?.querySelector('.qa-search-empty')
  const root = document.querySelector('main')
  if (!form || !input || !clear || !empty || !root) return

  // ここまで来たら JS は動いている。検索欄を出す
  form.hidden = false
  // 入力中に Enter で送信されると、ページが再読み込みされて入力が消える
  form.addEventListener('submit', (event) => event.preventDefault())

  const run = () => {
    const hits = applySearch(root, input.value)
    clear.hidden = normalizeSearchText(input.value).length === 0
    empty.hidden = hits !== 0
  }

  input.addEventListener('input', run)
  clear.addEventListener('click', () => {
    input.value = ''
    run()
    input.focus()
  })
  // 言語を変えると文字も変わるので、同じことばで絞り直す
  document.addEventListener('nekokintai:locale', run)
  run()
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup)
  else setup()
}
