// みんなのねこちゃんの 3 ページで共通に使うもの。

const LIKED_STORAGE_KEY = 'nekokintai.nekos.liked'
const OWNER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/**
 * アプリのシートから開かれたときの印。アプリは /nekos/?from=app（dev は from=app-dev）で開く。
 * 表示しない飼い主の印は hide=<印>,<印> で渡す想定（パラメータ名は仮。#246・#247 のアプリ側と合わせて決める）。
 */
export function appContext(search = window.location.search) {
  const params = new URLSearchParams(search)
  const from = params.get('from')
  const fromApp = from === 'app' || from === 'app-dev'
  const hiddenOwners = new Set(
    (params.get('hide') ?? '').split(',').filter((owner) => OWNER_PATTERN.test(owner)),
  )
  return { fromApp, isDev: from === 'app-dev', from: fromApp ? from : null, hiddenOwners }
}

/**
 * サイトの中のリンクに、アプリから開いた印を引きつぐ。落とすとシートの中で反映・表示しないのボタンが消える。
 * 表示しないにした飼い主は、このページで押したぶんも足して渡す。
 */
export function withAppParams(path, context) {
  if (!context.fromApp) return path
  const url = new URL(path, window.location.origin)
  url.searchParams.set('from', context.from)
  if (context.hiddenOwners.size > 0) url.searchParams.set('hide', [...context.hiddenOwners].join(','))
  return url.pathname + url.search
}

/** ページ内の a[data-nekos-link] の href に、アプリから開いた印を付けなおす */
export function rewriteInternalLinks(context, root = document) {
  for (const link of root.querySelectorAll('a[data-nekos-link]')) {
    link.setAttribute('href', withAppParams(link.dataset.nekosLink, context))
  }
}

/** アプリから開いたときは、ストアへの案内を消す（アプリはもう入っている） */
export function applyAppVisibility(context, root = document) {
  for (const element of root.querySelectorAll('[data-outside-app]')) element.hidden = context.fromApp
  for (const element of root.querySelectorAll('[data-in-app]')) element.hidden = !context.fromApp
}

/**
 * JS が組み立てる文言。#nk-copy の中に data-i18n 付きで置いた日本語を、i18n.mjs が言語に合わせて書きかえる。
 * {{name}} のような差しこみは vars で埋める。
 */
export function copyOf(key, vars = {}) {
  const element = document.querySelector(`#nk-copy [data-i18n="${key}"]`)
  const text = element?.textContent ?? key
  return Object.entries(vars).reduce((result, [name, value]) => result.replaceAll(`{{${name}}}`, value), text)
}

/** 言語が変わったら描きなおす（i18n.mjs が nekokintai:locale を出す） */
export function onLocaleChange(render) {
  document.addEventListener('nekokintai:locale', render)
}

/**
 * この端末でいいねを押したか。数そのものはサーバーが正本で、ここは二度押しを防ぐためだけに覚える。
 * localStorage が使えない（プライベートブラウズなど）ときは、このページを開いているあいだだけ覚える。
 */
export function createLikeStore() {
  let liked = new Set()
  try {
    const saved = JSON.parse(window.localStorage.getItem(LIKED_STORAGE_KEY) ?? '[]')
    if (Array.isArray(saved)) liked = new Set(saved.filter((id) => typeof id === 'string'))
  } catch {
    // 読めなければ、押していないものとして始める
  }
  const save = () => {
    try {
      window.localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify([...liked]))
    } catch {
      // 保存できなくても、このページのあいだは押した状態を保つ
    }
  }
  return {
    has: (id) => liked.has(id),
    toggle(id) {
      liked = new Set(liked)
      if (liked.has(id)) liked.delete(id)
      else liked.add(id)
      save()
      return liked.has(id)
    },
  }
}

/** 画面の下に少しだけ出すお知らせ */
export function showToast(text) {
  const toast = document.getElementById('nk-toast')
  if (!toast) return
  toast.textContent = text
  toast.hidden = false
  window.clearTimeout(Number(toast.dataset.timer))
  toast.dataset.timer = String(window.setTimeout(() => { toast.hidden = true }, 2600))
}

/** 仮データの見た目の確認用。?state=empty|loading|error で一覧をその状態に止める */
export function previewState(search = window.location.search) {
  const state = new URLSearchParams(search).get('state')
  return ['empty', 'loading', 'error'].includes(state) ? state : null
}

const HEART_PATH = 'M1 0h2v1h1v1h1V1h1V0h2v1h1v3H8v1H7v1H6v1H5v1H4V7H3V6H2V5H1V4H0V1h1z'

/** ドット絵のハート。liked で塗りが変わる */
export function heartSvg(size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 9 8')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(Math.round((size * 8) / 9)))
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('shape-rendering', 'crispEdges')
  svg.classList.add('nk-heart')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', HEART_PATH)
  svg.append(path)
  return svg
}
