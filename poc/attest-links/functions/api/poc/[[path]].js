import { handle } from '../../../src/router.mjs'
export const onRequest = ({ request, env }) => handle(request, env)
