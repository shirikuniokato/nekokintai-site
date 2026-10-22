import glyphs from './glyph-codepoints.json' with { type: 'json' }
import { decodeCatCode } from '../vendor/cat-code.mjs'
import { validatePublicNames } from './names.mjs'
import { RULES } from './rules.mjs'

const CODEPOINTS = new Set(glyphs.codepoints)

export function validatePublicationInput(input) {
  const decoded = decodeCatCode(input.code)
  if (!decoded.ok) return { ok: false, field: 'code', reason: decoded.reason }
  const names = validatePublicNames(input, RULES)
  if (!names.ok) return names
  for (const [field, text] of [['name', names.name], ['author', names.author]]) {
    if ([...text].some((letter) => !CODEPOINTS.has(letter.codePointAt(0)))) {
      return { ok: false, field, reason: 'unsupported_character' }
    }
  }
  return { ...names, cat: decoded.cat }
}
