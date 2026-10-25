import { ApiError, requireInput } from './errors.mjs'
import { validatePublicationInput } from '../name-filter/public-input.mjs'

const IDENTIFIER = /^[a-zA-Z0-9_-]{1,100}$/

export function normalizePayload(input) {
  requireInput(input && typeof input === 'object' && !Array.isArray(input))
  requireInput(typeof input.operationId === 'string' && /^[a-f0-9-]{36}$/.test(input.operationId))
  requireInput(['publish', 'withdraw', 'retire', 'read'].includes(input.action))
  requireInput(Number.isInteger(input.slot) && input.slot >= 0 && input.slot <= 10)
  if (input.action === 'read') return { operationId: input.operationId, action: 'read', slot: input.slot,
    generation: 'read', expectedGeneration: null, expectedRevision: 0 }
  requireInput(typeof input.generation === 'string' && IDENTIFIER.test(input.generation))
  requireInput(input.expectedGeneration === null || (typeof input.expectedGeneration === 'string' && IDENTIFIER.test(input.expectedGeneration)))
  requireInput(Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0)
  requireInput((input.expectedGeneration === null) === (input.expectedRevision === 0))
  const payload = { operationId: input.operationId, action: input.action, slot: input.slot,
    generation: input.generation, expectedGeneration: input.expectedGeneration, expectedRevision: input.expectedRevision }
  if (input.action !== 'publish') return payload
  requireInput(['ja', 'en', 'ko', 'zh-TW'].includes(input.locale))
  const checked = validatePublicationInput(input)
  if (!checked.ok) throw new ApiError(400, 'invalid_publication', { field: checked.field, reason: checked.reason })
  return { ...payload, code: input.code, name: checked.name, author: checked.author, locale: input.locale }
}

export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
