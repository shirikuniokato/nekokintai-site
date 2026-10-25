import { nekoPage } from '../../server/nekos/pages.mjs'

export function onRequestGet({ request, env, params, next }) {
  if (params.id === 'rules' || params.id === 'neko') return next()
  return nekoPage(request, env, params.id)
}
