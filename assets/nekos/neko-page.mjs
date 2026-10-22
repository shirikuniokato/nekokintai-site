// /nekos/<id> 1 匹のページ。
import { catSvg, usedColorKeys } from './cat.mjs'
import {
  appContext, applyAppVisibility, copyOf, createLikeStore, heartSvg, onLocaleChange, rewriteInternalLinks, showToast, withAppParams,
} from './common.mjs'
import { fetchNeko, fetchOtherNekos } from './data.mjs'
import { placeholderQrSvg } from './qr-placeholder.mjs'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const TEMPLATE_SEGMENT = 'neko'
const POSE_LIST = ['sit', 'walk', 'sleep', 'happy']
const COLOR_LABEL_KEYS = {
  body: 'colorBody',
  pattern: 'colorPattern',
  patternSecondary: 'colorPatternSecondary',
  line: 'colorLine',
  eyes: 'colorEyes',
  collar: 'colorCollar',
  paws: 'colorPaws',
}

const context = appContext()
const likes = createLikeStore()
const view = { cat: null, others: [], pose: 'sit', status: 'loading' }
const $ = (id) => document.getElementById(id)
// スマホ幅ではねこを小さめに描く（デザインの PC 12px・スマホ 7px）
const narrowScreen = window.matchMedia('(max-width: 600px)')
// 指で触る端末か。反映の案内文と、押したときに QR を出すかどうかだけに使い、行き先の分岐には使わない
const touchDevice = window.matchMedia('(pointer: coarse)')

function catIdFromLocation() {
  const match = /^\/nekos\/([^/]+)\/?$/.exec(window.location.pathname)
  const fromPath = match && match[1] !== TEMPLATE_SEGMENT ? decodeURIComponent(match[1]) : null
  const id = fromPath ?? new URLSearchParams(window.location.search).get('id') ?? ''
  return ID_PATTERN.test(id) ? id : null
}

/** 共有する URL。アプリから開いた印（from・hide）は付けない */
function shareUrl(cat) {
  return `${window.location.origin}/nekos/${encodeURIComponent(cat.id)}`
}

/**
 * 「アプリに反映する」の行き先。まだつながない（#258・#259 の結果待ち）。
 * つなぐときの形: アプリのシートの中は nekokintai://neko?code=<code>（from=app-dev は nekokintaidev://neko）、
 * ふつうのブラウザは https://go.nekokintai.com/neko?code=<code>。分けるのは from=app の有無だけ。
 */
function applyHref() {
  return '#'
}

function stageDot() {
  return narrowScreen.matches ? 7 : 12
}

function renderStage(cat) {
  const dot = stageDot()
  const stage = $('np-stage')
  stage.style.height = `${dot * 18}px`
  if (view.pose !== 'walk') {
    stage.replaceChildren(catSvg({ breed: cat.breed, colors: cat.colors, pose: view.pose, dot, label: cat.name }))
    return
  }
  const walk = document.createElement('div')
  walk.className = 'np-walk'
  const stepA = catSvg({ breed: cat.breed, colors: cat.colors, pose: 'walkA', dot, label: cat.name })
  const stepB = catSvg({ breed: cat.breed, colors: cat.colors, pose: 'walkB', dot })
  stepA.classList.add('np-walk-a')
  stepB.classList.add('np-walk-b')
  walk.append(stepA, stepB)
  stage.replaceChildren(walk)
}

function poseButton(cat, pose) {
  const thumbDot = stageDot() >= 10 ? 4 : 2
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'np-pose'
  button.setAttribute('role', 'radio')
  button.setAttribute('aria-checked', String(view.pose === pose))
  const art = document.createElement('span')
  art.className = 'np-pose-art'
  art.style.height = `${thumbDot * 18}px`
  // あるくは一覧では片足の絵で見せる
  art.append(catSvg({ breed: cat.breed, colors: cat.colors, pose: pose === 'walk' ? 'walkA' : pose, dot: thumbDot }))
  const label = document.createElement('span')
  label.className = 'np-pose-label'
  label.textContent = copyOf(pose)
  button.append(art, label)
  button.addEventListener('click', () => {
    view.pose = pose
    renderFigure()
  })
  return button
}

function renderFigure() {
  const cat = view.cat
  renderStage(cat)
  $('np-caption').textContent = copyOf(`${view.pose}Caption`)
  $('np-poses').replaceChildren(...POSE_LIST.map((pose) => poseButton(cat, pose)))
}

function renderLike(cat) {
  const liked = likes.has(cat.id)
  const count = cat.likes + (liked ? 1 : 0)
  const button = $('np-like')
  button.setAttribute('aria-pressed', String(liked))
  button.setAttribute('aria-label', `${copyOf(liked ? 'unlike' : 'like')} ${count}`)
  $('np-like-text').textContent = `${copyOf('like')} ${count}`
}

function renderSwatches(cat) {
  const items = usedColorKeys(cat.breed).map((key) => {
    const item = document.createElement('li')
    const chip = document.createElement('span')
    chip.className = 'np-chip'
    chip.setAttribute('aria-hidden', 'true')
    chip.style.background = cat.colors[key]
    item.append(chip, copyOf(COLOR_LABEL_KEYS[key]))
    return item
  })
  $('np-swatches').replaceChildren(...items)
}

function otherCard(cat) {
  const link = document.createElement('a')
  link.className = 'np-other'
  link.href = withAppParams(`/nekos/${encodeURIComponent(cat.id)}`, context)
  const line = document.createElement('span')
  line.className = 'np-other-line'
  line.setAttribute('aria-hidden', 'true')
  const name = document.createElement('span')
  name.className = 'np-other-name'
  name.textContent = cat.name
  // 品種で絵の高さがちがうので、足元をそろえる台に載せる
  const art = document.createElement('span')
  art.className = 'np-other-art'
  art.append(catSvg({ breed: cat.breed, colors: cat.colors, pose: 'sit', dot: 4 }))
  link.append(art, line, name)
  return link
}

function renderOthers() {
  const visible = view.others.filter((cat) => !context.hiddenOwners.has(cat.owner))
  $('np-others').replaceChildren(...visible.map(otherCard))
}

function renderInfo(cat) {
  document.title = copyOf('catTitle', { name: cat.name })
  $('np-title').textContent = cat.name
  $('np-byline').textContent = cat.author ? copyOf('byline', { name: cat.author }) : ''
  $('np-byline').hidden = !cat.author
  $('np-apply').setAttribute('href', applyHref())
  $('np-apply-note').textContent = copyOf(touchDevice.matches || context.fromApp ? 'applyPhone' : 'applyPc')
  $('np-block-title').textContent = cat.author ? copyOf('blockNamed', { name: cat.author }) : copyOf('block')
  renderLike(cat)
  renderSwatches(cat)
}

function render() {
  $('np-gone').hidden = view.status !== 'gone'
  $('np-error').hidden = view.status !== 'error'
  $('np-shown').hidden = view.status !== 'shown'
  if (view.status !== 'shown') return
  renderInfo(view.cat)
  renderFigure()
  renderOthers()
}

async function load() {
  view.status = 'loading'
  render()
  const id = catIdFromLocation()
  try {
    const cat = id ? await fetchNeko(id) : null
    view.cat = cat
    view.others = await fetchOtherNekos({ excludeId: cat?.id ?? '', hiddenOwners: context.hiddenOwners })
    view.status = cat ? 'shown' : 'gone'
  } catch (error) {
    console.error('ねこちゃんを読みこめませんでした', error)
    view.status = 'error'
  }
  render()
}

function bindDialogs() {
  for (const dialog of document.querySelectorAll('dialog')) {
    for (const closer of dialog.querySelectorAll('[data-close]')) {
      closer.addEventListener('click', () => dialog.close())
    }
    // 外側（背景）を押したら閉じる
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() })
  }
}

function onApplyClick(event) {
  if (event.currentTarget.getAttribute('href') !== '#') return
  event.preventDefault()
  // パソコンではアプリが開けないので、スマホで読みこむ QR を出す（デザインどおり）
  if (!touchDevice.matches && !context.fromApp) {
    $('np-qr').replaceChildren(placeholderQrSvg(copyOf('qrLabel')))
    $('np-qr-dialog').showModal()
    return
  }
  // スマホのブラウザでは、開きに行ってもどってきたときのために案内を出しておく
  if (!context.fromApp) $('np-tried').hidden = false
}

async function onShareClick() {
  const cat = view.cat
  const url = shareUrl(cat)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: cat.name, url })
      return
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    showToast(copyOf('linkCopied'))
  } catch (error) {
    console.error('リンクをコピーできませんでした', error)
  }
}

function onBlockConfirm(event) {
  // 行き先（nekokintai://block?owner=…&label=…）はまだつながない。押した直後の絞りこみは、このページの中だけで済ませる
  if (event.currentTarget.getAttribute('href') === '#') event.preventDefault()
  context.hiddenOwners = new Set([...context.hiddenOwners, view.cat.owner])
  $('np-block-dialog').close()
  $('np-block-open').hidden = true
  rewriteInternalLinks(context)
  renderOthers()
  showToast(copyOf('blocked'))
}

function bindActions() {
  $('np-like').querySelector('[data-slot="heart"]').append(heartSvg(22))
  $('np-like').addEventListener('click', () => {
    likes.toggle(view.cat.id)
    renderLike(view.cat)
  })
  $('np-share').addEventListener('click', () => void onShareClick())
  $('np-apply').addEventListener('click', onApplyClick)
  $('np-report-open').addEventListener('click', () => $('np-report-dialog').showModal())
  // 通報の送り先（API・Slack）はまだつながない
  $('np-report-form').addEventListener('submit', () => showToast(copyOf('reported')))
  $('np-block-open').addEventListener('click', () => $('np-block-dialog').showModal())
  $('np-block-ok').addEventListener('click', onBlockConfirm)
  $('np-retry').addEventListener('click', () => void load())
  narrowScreen.addEventListener('change', render)
}

function init() {
  applyAppVisibility(context)
  rewriteInternalLinks(context)
  bindDialogs()
  bindActions()
  onLocaleChange(render)
  void load()
}

init()
