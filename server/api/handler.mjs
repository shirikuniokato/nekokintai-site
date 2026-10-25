import { ApiError, response } from './errors.mjs'
import { publicRoute } from './public-routes.mjs'

export function createHandler(writeRoute, environment) {
  return async (request, env) => {
    try {
      if (!env.NEKOS_DB || env.NEKOS_ENV !== environment) throw new ApiError(503, 'unavailable')
      const path = new URL(request.url).pathname.replace(/^\/api\/nekos/, '').replace(/\/$/, '')
      const publicResult = await publicRoute(request, env, path)
      if (publicResult !== null) return response(publicResult, path.endsWith('/reports') ? 202 : 200)
      const writeResult = await writeRoute(request, env, path)
      if (writeResult !== null) return response(writeResult)
      throw new ApiError(404, 'not_found')
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('neko_api_failed', { type: error?.name || 'unknown' })
      return response({ error: error instanceof ApiError ? error.message : 'internal_error',
        ...(error instanceof ApiError ? error.details : {}) }, error instanceof ApiError ? error.status : 500)
    }
  }
}
