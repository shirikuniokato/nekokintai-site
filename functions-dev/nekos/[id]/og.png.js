import { nekoOgp } from '../../../server/nekos/pages.mjs'

export function onRequestGet({ request, env, params }) {
  return nekoOgp(request, env, params.id)
}
