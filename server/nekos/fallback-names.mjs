// 正本: nekokintai #250「文言とデザインの決めごと（2026-10-23）」の20か所。
export const PLACES = {
  ja: ['街', '海辺', '路地裏', '公園', '屋根の上', '塀の上', '商店街', '駅前', '神社', '川辺',
    '港', '坂道', '縁側', '橋の下', '本屋', '喫茶店', '銭湯', '駄菓子屋', '灯台', '田んぼ'],
  en: ['town', 'seaside', 'back alley', 'park', 'rooftop', 'garden wall', 'shopping street', 'station', 'shrine', 'riverside',
    'harbor', 'hillside', 'porch', 'bridge', 'bookshop', 'café', 'bathhouse', 'candy shop', 'lighthouse', 'rice field'],
  ko: ['마을', '바닷가', '뒷골목', '공원', '지붕 위', '담장 위', '상점가', '역 앞', '신사 경내', '강가',
    '항구', '언덕길', '툇마루', '다리 아래', '서점', '카페', '목욕탕', '과자 가게', '등대', '논'],
  'zh-TW': ['街上', '海邊', '巷弄', '公園', '屋頂', '圍牆', '商店街', '車站前', '神社', '河邊',
    '港口', '坡道', '緣廊', '橋下', '書店', '咖啡店', '澡堂', '糖果店', '燈塔', '稻田'],
}

export function fallbackName(locale, place) {
  if (!Object.hasOwn(PLACES, locale) || !Number.isInteger(place) || place < 0 || place >= 20) {
    throw new Error('自動名の言語・場所が正しくありません')
  }
  const value = PLACES[locale][place]
  return { ja: `${value}の野良ねこ`, en: `The ${value} stray`,
    ko: `${value}의 길고양이`, 'zh-TW': `${value}的浪貓` }[locale]
}

export function chooseFallbackName(locale) {
  const [random] = crypto.getRandomValues(new Uint32Array(1))
  return fallbackName(locale, random % 20)
}
