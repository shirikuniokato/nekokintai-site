// 野良ねこの名前の辞書（#262）。名前を空のまま公開したねこに、サーバーが公開したときにくじで場所の番号を選んで保存する。
// 使うのはサイトのページ・一覧（見る人の言語）・OGP とページの title（日本語）・くじを引くサーバー。アプリの画面は使わない。
// 正本はデザイン（Main / CatPage の places）。辞書の形は assets/<ページ>/locales.json と同じ（言語 → キー → 文字）で、
// npm run check:i18n が 4 言語のキーのそろいと訳の検査を通す。
//
// **場所の番号は placeNN の NN。並び順は変えない・途中を消さない（足すときは 4 言語とも末尾に、次の番号で）。**
// D1 には番号だけを保存しているので、番号がずれると公開済みのねこの名前が別の場所になる（ねこの code の品種と同じ約束）。
// 訳の言いまわしを直すのはよい。番号と場所の意味の結びつきを変えない。
export const STRAY_NAMES = {
  ja: {
    strayName: '{{place}}の野良ねこ',
    place00: '街',
    place01: '海辺',
    place02: '路地裏',
    place03: '公園',
    place04: '屋根の上',
    place05: '塀の上',
    place06: '商店街',
    place07: '駅前',
    place08: '神社',
    place09: '川辺',
    place10: '港',
    place11: '坂道',
    place12: '縁側',
    place13: '橋の下',
    place14: '本屋',
    place15: '喫茶店',
    place16: '銭湯',
    place17: '駄菓子屋',
    place18: '灯台',
    place19: '田んぼ',
  },
  en: {
    strayName: 'The {{place}} stray',
    place00: 'town',
    place01: 'seaside',
    place02: 'back alley',
    place03: 'park',
    place04: 'rooftop',
    place05: 'garden wall',
    place06: 'shopping street',
    place07: 'station',
    place08: 'shrine',
    place09: 'riverside',
    place10: 'harbor',
    place11: 'hillside',
    place12: 'porch',
    place13: 'bridge',
    place14: 'bookshop',
    place15: 'café',
    place16: 'bathhouse',
    place17: 'candy shop',
    place18: 'lighthouse',
    place19: 'rice field',
  },
  ko: {
    strayName: '{{place}}의 길고양이',
    place00: '마을',
    place01: '바닷가',
    place02: '뒷골목',
    place03: '공원',
    place04: '지붕 위',
    place05: '담장 위',
    place06: '상점가',
    place07: '역 앞',
    place08: '신사 경내',
    place09: '강가',
    place10: '항구',
    place11: '언덕길',
    place12: '툇마루',
    place13: '다리 아래',
    place14: '서점',
    place15: '카페',
    place16: '목욕탕',
    place17: '과자 가게',
    place18: '등대',
    place19: '논',
  },
  'zh-TW': {
    strayName: '{{place}}的浪貓',
    place00: '街上',
    place01: '海邊',
    place02: '巷弄',
    place03: '公園',
    place04: '屋頂',
    place05: '圍牆',
    place06: '商店街',
    place07: '車站前',
    place08: '神社',
    place09: '河邊',
    place10: '港口',
    place11: '坡道',
    place12: '緣廊',
    place13: '橋下',
    place14: '書店',
    place15: '咖啡店',
    place16: '澡堂',
    place17: '糖果店',
    place18: '燈塔',
    place19: '稻田',
  },
}

const PLACE_KEY = /^place(\d{2})$/

// 辞書の placeNN を番号順に並べた場所の数。check:i18n とテストが 00 から欠けなく続くことを確かめる
export const STRAY_PLACE_COUNT = Object.keys(STRAY_NAMES.ja).filter((key) => PLACE_KEY.test(key)).length

function placeKey(place) {
  return `place${String(place).padStart(2, '0')}`
}

export function isStrayPlace(place) {
  return Number.isInteger(place) && place >= 0 && place < STRAY_PLACE_COUNT
}

/** 「〇〇の野良ねこ」を見る人の言語で組み立てる。辞書に無い言語は日本語にする */
export function strayCatName(place, locale) {
  if (!isStrayPlace(place)) throw new Error(`野良ねこの場所の番号が正しくありません: ${String(place)}`)
  const copy = Object.hasOwn(STRAY_NAMES, locale) ? STRAY_NAMES[locale] : STRAY_NAMES.ja
  return copy.strayName.replace('{{place}}', copy[placeKey(place)])
}

/** 画面に出す名前。付けた名前があればそれ、空なら野良ねこの名前を見る人の言語で */
export function displayCatName(name, place, locale) {
  return name !== '' ? name : strayCatName(place, locale)
}
