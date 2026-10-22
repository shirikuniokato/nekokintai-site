import { ApiError, requireInput, readJson, requireSameOrigin } from './errors.mjs'
import { requestIpHash } from './identity.mjs'
import { rateLimit } from './rate-limit.mjs'
import { gallery, publicCat } from '../nekos/gallery.mjs'
import { getPublicPublication } from '../nekos/queries.mjs'
import { setPublicationLike } from '../nekos/likes.mjs'
import { submitReport } from '../nekos/reports.mjs'

function hiddenOwners(url) {
  const values = (url.searchParams.get('hide') || '').split(',').filter(Boolean)
  requireInput(values.length <= 100 && values.every((value) => /^[a-f0-9]{64}$/.test(value)))
  return values
}

function galleryOptions(url) {
  const page = Number(url.searchParams.get('page') || 0)
  const limit = Number(url.searchParams.get('limit') || 8)
  const sort = url.searchParams.get('sort') || 'new'
  requireInput(Number.isSafeInteger(page) && page >= 0 && page <= 1000)
  requireInput(Number.isSafeInteger(limit) && limit >= 1 && limit <= 50)
  requireInput(['new', 'popular'].includes(sort))
  return { page, limit, sort, hiddenOwners: hiddenOwners(url), excludeId: url.searchParams.get('exclude') || '' }
}

export async function publicRoute(request, env, path) {
  const url = new URL(request.url)
  if (request.method === 'GET' && path === '') return gallery(env.NEKOS_DB, galleryOptions(url))
  const match = /^\/([a-zA-Z0-9_-]{1,100})(?:\/(like|reports))?$/.exec(path)
  if (!match) return null
  const [, id, action] = match
  if (request.method === 'GET' && !action) {
    const cat = publicCat(await getPublicPublication(env.NEKOS_DB, id, hiddenOwners(url)))
    if (!cat) throw new ApiError(404, 'not_found')
    return { cat }
  }
  if ((request.method === 'PUT' && action === 'like') || (request.method === 'POST' && action === 'reports')) {
    return publicWrite(request, env, { id, action })
  }
  return null
}

async function publicWrite(request, env, { id, action }) {
  requireSameOrigin(request)
  const ipHash = await requestIpHash(request, env)
  await rateLimit(env.NEKOS_DB, ipHash, action,
    action === 'reports' ? { maximum: 3, period: 600_000 } : { maximum: 60, period: 60_000 })
  const body = await readJson(request)
  if (action === 'reports') return submitReport(env.NEKOS_DB, { ...body, id, ipHash, now: Date.now() })
  requireInput(typeof body.liked === 'boolean')
  const likes = await setPublicationLike(env.NEKOS_DB, { publicationId: id, ipHash, liked: body.liked, now: Date.now() })
  if (likes === null) throw new ApiError(404, 'not_found')
  return { likes, liked: body.liked }
}
