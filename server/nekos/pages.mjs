import { getPublicPublication } from './queries.mjs'
import { decodeCatCode } from '../vendor/cat-code.mjs'
import { digest } from '../api/payload.mjs'
import { parseGlyphPack } from '../ogp/glyphs.mjs'
import { renderOgp } from '../ogp/ogp.mjs'
import { encodePng } from '../ogp/png.mjs'
import { ogpCatName } from '../vendor/cat-name.mjs'

// og:image の URL の版。名前のハッシュは OGP に描く名前（野良ねこは日本語）の SHA-256。決まりは src/shared/catName.ts
export async function ogpVersion(cat) {
  return `${cat.code}.${await digest(ogpCatName(cat.name, cat.fallbackPlace))}`
}

function blockedOwners(request) {
  return (new URL(request.url).searchParams.get('hide') || '').split(',')
    .filter((value) => /^[a-f0-9]{64}$/.test(value)).slice(0, 100)
}

function attribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export async function nekoPage(request, env, id) {
  if (!env.NEKOS_DB) return new Response('Unavailable', { status: 503 })
  const cat = await getPublicPublication(env.NEKOS_DB, id, blockedOwners(request))
  const template = await env.ASSETS.fetch(new Request(new URL('/nekos/neko/', request.url)))
  if (!template.ok) return new Response('Unavailable', { status: 503 })
  const origin = env.NEKOS_ENV === 'production' ? 'https://nekokintai.com' : new URL(request.url).origin
  const canonical = `${origin}/nekos/${encodeURIComponent(id)}`
  // サーバーが組む title・og:title は日本語。野良ねこも OGP の絵と同じ日本語の名前にする（画面の title は見る人の言語で組みなおす）
  const title = cat ? `${ogpCatName(cat.name, cat.fallbackPlace)} | みんなのねこちゃん | ねこ勤怠` : 'このねこちゃんは、いまは見られません | ねこ勤怠'
  const ogp = cat ? `${canonical}/og.png?v=${await ogpVersion(cat)}` : null
  const rewritten = new HTMLRewriter().on('title', { element(element) {
    element.removeAttribute('data-i18n')
    element.setInnerContent(title)
  } }).on('head', { element(element) {
    element.append(`<meta property="og:title" content="${attribute(title)}">`, { html: true })
    element.append(`<link rel="canonical" href="${canonical}"><meta property="og:type" content="website">`, { html: true })
    element.append(`<meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary_large_image">`, { html: true })
    if (ogp) element.append(`<meta property="og:image" content="${ogp}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`, { html: true })
    if (!cat) element.append('<meta name="robots" content="noindex">', { html: true })
  } }).on('meta[name="description"]', { element(element) {
    element.after(`<meta property="og:description" content="${attribute(element.getAttribute('content') || '')}">`, { html: true })
  } }).on('#np-gone', { element(element) { if (!cat) element.removeAttribute('hidden') } })
    .transform(template)
  const headers = new Headers(rewritten.headers)
  headers.set('Cache-Control', 'no-store')
  if (env.NEKOS_ENV === 'development') headers.set('X-Robots-Tag', 'noindex')
  return new Response(rewritten.body, { status: 200, headers })
}

export async function nekoOgp(request, env, id) {
  if (!env.NEKOS_DB) return new Response('Unavailable', { status: 503 })
  const cat = await getPublicPublication(env.NEKOS_DB, id)
  if (!cat || new URL(request.url).searchParams.get('v') !== await ogpVersion(cat)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  const decoded = decodeCatCode(cat.code)
  if (!decoded.ok) return new Response('Unavailable', { status: 503 })
  const asset = await env.ASSETS.fetch(new Request(new URL('/assets/nekos/glyphs.bin', request.url)))
  if (!asset.ok) return new Response('Unavailable', { status: 503 })
  const pack = parseGlyphPack(await asset.arrayBuffer())
  const png = await encodePng(renderOgp(pack, { ...decoded.cat, slot: 1 }, ogpCatName(cat.name, cat.fallbackPlace)))
  return new Response(png, { headers: { 'Content-Type': 'image/png',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
