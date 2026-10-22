import { ApiError, requireInput } from './errors.mjs'

export async function hashIdentifier(secret, purpose, value) {
  if (typeof secret !== 'string' || secret.length < 32) throw new ApiError(503, 'unavailable')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${purpose}\0${value}`))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function requireUid(value) {
  requireInput(typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value))
  return value
}

export async function ownerIdentity(env, uid) {
  requireUid(uid)
  return { ownerHash: await hashIdentifier(env.OWNER_PEPPER, 'private-owner-v1', uid),
    publicToken: await hashIdentifier(env.OWNER_PEPPER, 'public-owner-v1', uid) }
}

export async function requestIpHash(request, env) {
  const address = request.headers.get('CF-Connecting-IP')
  if (!address || address.length > 45 || !/^[a-fA-F0-9:.]+$/.test(address)) throw new ApiError(503, 'unavailable')
  return hashIdentifier(env.IP_PEPPER, 'request-ip-v1', address)
}
