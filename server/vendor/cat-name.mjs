// 生成物。正本: shirikuniokato/nekokintai 1449247dc6710209994d923b17c7d942515559f7 src/shared/catName.ts。手で直さない。

// ../../nekokintai/feat-neko-name-rules/src/shared/catName.ts
var CAT_NAME_MAX_LENGTH = 12;
var MAX_INPUT_LENGTH = 256;
var URL_PATTERN = /(?:https?:|www[.]|[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?[.。．｡](?:[\p{L}]{2,63}|xn--[a-z0-9-]+)(?:\b|$|[/\s]))/iu;
var INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;
function normalizeCatName(value) {
  return value.normalize("NFKC").replace(INVISIBLE_CHARACTERS, "").trim();
}
function catNameLength(normalized) {
  return normalized.length;
}
function looksLikeUrl(normalized) {
  return URL_PATTERN.test(normalized);
}
function undrawableCharacters(normalized, isDrawable) {
  const found = /* @__PURE__ */ new Set();
  for (const character of normalized) {
    if (!isDrawable(character.codePointAt(0) ?? 0)) found.add(character);
  }
  return [...found];
}
function checkCatName(value, isDrawable) {
  if (typeof value !== "string" || value.length > MAX_INPUT_LENGTH) return { ok: false, reason: "invalid" };
  const normalized = normalizeCatName(value);
  if (catNameLength(normalized) > CAT_NAME_MAX_LENGTH) return { ok: false, reason: "too_long" };
  if (looksLikeUrl(normalized)) return { ok: false, reason: "url" };
  const characters = undrawableCharacters(normalized, isDrawable);
  if (characters.length > 0) return { ok: false, reason: "unsupported_character", characters };
  return { ok: true, value: normalized };
}
function ogpCatName(name, japaneseStrayName) {
  return name !== "" ? name : japaneseStrayName;
}
export {
  CAT_NAME_MAX_LENGTH,
  catNameLength,
  checkCatName,
  looksLikeUrl,
  normalizeCatName,
  ogpCatName,
  undrawableCharacters
};
