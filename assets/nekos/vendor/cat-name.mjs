// 生成物。正本: shirikuniokato/nekokintai 00ca22240b7124804b208b83ff22f182f5172d7b src/shared/catName.ts。手で直さない。

// ../../nekokintai/feat-neko-name-rules/src/shared/catName.ts
var STRAY_PLACES = {
  ja: [
    "\u8857",
    "\u6D77\u8FBA",
    "\u8DEF\u5730\u88CF",
    "\u516C\u5712",
    "\u5C4B\u6839\u306E\u4E0A",
    "\u5840\u306E\u4E0A",
    "\u5546\u5E97\u8857",
    "\u99C5\u524D",
    "\u795E\u793E",
    "\u5DDD\u8FBA",
    "\u6E2F",
    "\u5742\u9053",
    "\u7E01\u5074",
    "\u6A4B\u306E\u4E0B",
    "\u672C\u5C4B",
    "\u55AB\u8336\u5E97",
    "\u92AD\u6E6F",
    "\u99C4\u83D3\u5B50\u5C4B",
    "\u706F\u53F0",
    "\u7530\u3093\u307C"
  ],
  en: [
    "town",
    "seaside",
    "back alley",
    "park",
    "rooftop",
    "garden wall",
    "shopping street",
    "station",
    "shrine",
    "riverside",
    "harbor",
    "hillside",
    "porch",
    "bridge",
    "bookshop",
    "caf\xE9",
    "bathhouse",
    "candy shop",
    "lighthouse",
    "rice field"
  ],
  ko: [
    "\uB9C8\uC744",
    "\uBC14\uB2F7\uAC00",
    "\uB4B7\uACE8\uBAA9",
    "\uACF5\uC6D0",
    "\uC9C0\uBD95 \uC704",
    "\uB2F4\uC7A5 \uC704",
    "\uC0C1\uC810\uAC00",
    "\uC5ED \uC55E",
    "\uC2E0\uC0AC \uACBD\uB0B4",
    "\uAC15\uAC00",
    "\uD56D\uAD6C",
    "\uC5B8\uB355\uAE38",
    "\uD207\uB9C8\uB8E8",
    "\uB2E4\uB9AC \uC544\uB798",
    "\uC11C\uC810",
    "\uCE74\uD398",
    "\uBAA9\uC695\uD0D5",
    "\uACFC\uC790 \uAC00\uAC8C",
    "\uB4F1\uB300",
    "\uB17C"
  ],
  "zh-TW": [
    "\u8857\u4E0A",
    "\u6D77\u908A",
    "\u5DF7\u5F04",
    "\u516C\u5712",
    "\u5C4B\u9802",
    "\u570D\u7246",
    "\u5546\u5E97\u8857",
    "\u8ECA\u7AD9\u524D",
    "\u795E\u793E",
    "\u6CB3\u908A",
    "\u6E2F\u53E3",
    "\u5761\u9053",
    "\u7DE3\u5ECA",
    "\u6A4B\u4E0B",
    "\u66F8\u5E97",
    "\u5496\u5561\u5E97",
    "\u6FA1\u5802",
    "\u7CD6\u679C\u5E97",
    "\u71C8\u5854",
    "\u7A3B\u7530"
  ]
};
var STRAY_PLACE_COUNT = STRAY_PLACES.ja.length;
var CAT_NAME_LOCALES = ["ja", "en", "ko", "zh-TW"];
var STRAY_TEMPLATES = {
  ja: (place) => `${place}\u306E\u91CE\u826F\u306D\u3053`,
  en: (place) => `The ${place} stray`,
  ko: (place) => `${place}\uC758 \uAE38\uACE0\uC591\uC774`,
  "zh-TW": (place) => `${place}\u7684\u6D6A\u8C93`
};
function isStrayPlace(place) {
  return Number.isInteger(place) && place >= 0 && place < STRAY_PLACE_COUNT;
}
function strayCatName(place, locale) {
  const language = CAT_NAME_LOCALES.includes(locale) ? locale : "ja";
  const label = isStrayPlace(place) ? STRAY_PLACES[language][place] : void 0;
  if (label === void 0) throw new Error(`catName: unknown stray place ${String(place)}`);
  return STRAY_TEMPLATES[language](label);
}
function displayCatName(name, place, locale) {
  return name !== "" ? name : strayCatName(place, locale);
}
export {
  displayCatName,
  strayCatName
};
