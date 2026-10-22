// /nekos/ みんなのねこちゃん（一覧）。
import { catSvg } from './cat.mjs'
import {
  appContext, applyAppVisibility, copyOf, createLikeStore, heartSvg, onLocaleChange, previewState, rewriteInternalLinks, withAppParams, showToast,
} from './common.mjs'
import { fetchNekos, setLike } from './data.mjs'

const context = appContext()
const likes = createLikeStore()
const forcedState = previewState()
const view = { sort: 'new', page: 0, cats: [], hasMore: false, status: 'loading' }

const $ = (id) => document.getElementById(id)

function likeCount(cat) {
  return cat.likes
}

function likeButton(cat) {
  let current = cat
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nk-like-sm'
  const count = document.createElement('span')
  const refresh = () => {
    const liked = likes.has(cat.id)
    button.setAttribute('aria-pressed', String(liked))
    button.setAttribute('aria-label', `${copyOf(liked ? 'unlike' : 'like')} ${likeCount(current)}`)
    count.textContent = String(likeCount(current))
  }
  button.append(heartSvg(18), count)
  button.addEventListener('click', async () => {
    button.disabled = true
    try {
      const result = await setLike(cat.id, !likes.has(cat.id))
      likes.set(cat.id, result.liked)
      current = { ...current, likes: result.likes }
      view.cats = view.cats.map((item) => item.id === cat.id ? current : item)
      refresh()
    } catch {
      showToast(copyOf('errorBody'))
    } finally {
      button.disabled = false
    }
  })
  refresh()
  return button
}

function card(cat) {
  const item = document.createElement('li')
  item.className = 'nk-card'
  const link = document.createElement('a')
  link.className = 'nk-cardlink'
  link.href = withAppParams(`/nekos/${encodeURIComponent(cat.id)}`, context)
  const stage = document.createElement('div')
  stage.className = 'nk-stage-sm'
  stage.append(catSvg({ breed: cat.breed, colors: cat.colors, pose: 'sit', dot: 5 }))
  const name = document.createElement('span')
  name.className = 'nk-cardname'
  name.textContent = cat.name
  const byline = document.createElement('span')
  byline.className = 'nk-byline'
  byline.textContent = cat.author ? copyOf('byline', { name: cat.author }) : ''
  link.append(stage, name, byline)
  const foot = document.createElement('div')
  foot.className = 'nk-cardfoot'
  foot.append(likeButton(cat))
  item.append(link, foot)
  return item
}

function render() {
  const status = view.status
  $('gl-loading').hidden = status !== 'loading'
  $('gl-error').hidden = status !== 'error'
  $('gl-empty').hidden = status !== 'empty'
  $('gl-list').hidden = status !== 'list'
  $('gl-more-area').hidden = status !== 'list'
  if (status !== 'list') return
  $('gl-cards').replaceChildren(...view.cats.map(card))
  $('gl-more').hidden = !view.hasMore
  $('gl-end').hidden = view.hasMore
}

async function load({ reset }) {
  if (reset) {
    view.page = 0
    view.cats = []
    view.status = 'loading'
    render()
  }
  if (forcedState) {
    view.status = forcedState
    render()
    return
  }
  try {
    const result = await fetchNekos({ sort: view.sort, page: view.page, hiddenOwners: context.hiddenOwners })
    view.cats = [...view.cats, ...result.cats]
    view.hasMore = result.hasMore
    view.status = view.cats.length === 0 ? 'empty' : 'list'
  } catch (error) {
    console.error('みんなのねこちゃんを読みこめませんでした', error)
    view.status = 'error'
  }
  render()
}

function bindSortTabs() {
  for (const tab of document.querySelectorAll('[data-sort]')) {
    tab.addEventListener('click', () => {
      if (view.sort === tab.dataset.sort) return
      view.sort = tab.dataset.sort
      for (const other of document.querySelectorAll('[data-sort]')) {
        other.setAttribute('aria-pressed', String(other === tab))
      }
      void load({ reset: true })
    })
  }
}

function init() {
  applyAppVisibility(context)
  rewriteInternalLinks(context)
  $('gl-empty-cat').append(catSvg({
    breed: 'short',
    colors: { body: '#FFFFFF', line: '#000000', eyes: '#000000', collar: '#26CAD4', paws: '#FFAEAE' },
    pose: 'sleep',
    dot: 6,
  }))
  bindSortTabs()
  $('gl-more').addEventListener('click', async () => {
    // 読みこみ中に二度押しされて同じページを重ねないよう、終わるまで押せなくする
    $('gl-more').disabled = true
    view.page += 1
    await load({ reset: false })
    $('gl-more').disabled = false
  })
  $('gl-retry').addEventListener('click', () => void load({ reset: true }))
  onLocaleChange(render)
  void load({ reset: true })
}

init()
