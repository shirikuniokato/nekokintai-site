import glyphs from './glyph-codepoints.json' with { type: 'json' }
import { decodeCatCode } from '../vendor/cat-code.mjs'
import { validatePublicNames } from './names.mjs'
import { RULES } from './rules.mjs'

const CODEPOINTS = new Set(glyphs.codepoints)

// 描ける字は OGP の字のデータ（assets/nekos/glyphs.bin）と同じ一覧。アプリにも同じ一覧を渡す（#262）。
export function isDrawableCodePoint(codePoint) {
  return CODEPOINTS.has(codePoint)
}

export function validatePublicationInput(input) {
  const decoded = decodeCatCode(input.code)
  if (!decoded.ok) return { ok: false, field: 'code', reason: decoded.reason }
  const names = validatePublicNames(input, RULES, isDrawableCodePoint)
  if (!names.ok) return names
  return { ...names, cat: decoded.cat }
}
