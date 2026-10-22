import { createHandler } from '../../../server/api/handler.mjs'
import { developmentWrite } from '../../../server/development/routes.mjs'

const handle = createHandler(developmentWrite, 'development')
export function onRequest({ request, env }) {
  return handle(request, env)
}
