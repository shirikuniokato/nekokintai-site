import { compileNameRules } from './names.mjs'

// LDNOOBW 固定版から露骨な性的表現・差別語・強い侮辱を選別。
// 一般的な身体・属性・人名にもなる短語は採用しない。追加表記は derived として記録する。
const SELECTED = {
  ja: ['オナニー', 'オマンコ', 'クンニリングス', 'セックス', 'ちんこ', 'ニガー', 'ファック',
    'フェラチオ', 'ポルノ', 'まんこ', 'やりまん', 'レイプ', '強姦犯', '児童性虐待', '射精', '獣姦', '輪姦'],
  en: ['blowjob', 'bullshit', 'cocksucker', 'cunt', 'dickhead', 'fuck', 'fucker', 'fucking',
    'motherfucker', 'nigger', 'nigga', 'porn', 'pornography', 'shit', 'slut', 'wanker'],
  ko: ['강간', '개새끼', '개자식', '개좆', '미친새끼', '병신', '보지', '빠구리', '씨발', '씨발놈',
    '씨팔', '씹새끼', '좆', '죽일년', '짱깨', '쪽바리', '창녀', '포르노'],
  'zh-TW': ['操你妈', '操你媽', '肏你妈', '肏你媽', '草泥马', '草泥馬', '傻逼', '傻屄', '鸡巴', '雞巴',
    '妈的', '媽的', '他妈的', '他媽的', '干你娘', '幹你娘', '肏你娘', '强奸', '強姦', '狗娘养的', '狗娘養的'],
}

// 短い語を一律部分一致にすると普通の地名・語尾・所有表現まで拒否する。
const TERM_MODES = {
  ja: { 'セックス': 'whole', 'ファック': 'whole', 'ちんこ': 'whole' },
  ko: { '보지': 'whole' },
  'zh-TW': { '妈的': 'whole', '媽的': 'whole' },
}

export const RULES = compileNameRules(Object.entries(SELECTED).flatMap(([locale, terms]) => terms.map((term) => ({
  locale, term, mode: TERM_MODES[locale]?.[term] || (locale === 'en' ? 'word' : 'substring'),
}))))
