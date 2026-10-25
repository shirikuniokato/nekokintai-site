import { createHandler } from '../../../server/api/handler.mjs'
import { productionWrite } from '../../../server/api/production-routes.mjs'

const handle = createHandler(productionWrite, 'production')
export function onRequest({ request, env }) {
  return handle(request, env)
}
