// 翻訳するページの一覧。翻訳・監査・検査のスクリプトは、この表と --page で対象を決める。
// トップLPが既定なので、--page を付けない従来の呼びかたはそのまま動く。

export const I18N_PAGES = {
  lp: { html: 'index.html', locales: 'assets/lp/locales.json', label: 'トップLP' },
  tip: { html: 'tip/index.html', locales: 'assets/tip/locales.json', label: '開発をおうえんする' },
  qa: { html: 'qa/index.html', locales: 'assets/qa/locales.json', label: 'よくあるしつもん' },
  roadmap: { html: 'roadmap/index.html', locales: 'assets/roadmap/locales.json', label: 'アップデートのよてい' },
  contact: { html: 'contact/index.html', locales: 'assets/contact/locales.json', label: 'ごようぼう' },
  privacy: { html: 'privacy/index.html', locales: 'assets/privacy/locales.json', label: 'プライバシーポリシー' },
}

export const DEFAULT_PAGE = 'lp'

/**
 * トップLPで決めた訳をほかのページでも同じにするキー。
 * 値はトップLPの辞書のキー。ページ側のキー → LP のキー。
 * 同じリンクが、ページによって違う言葉で出ないようにする。
 */
export const SHARED_KEYS = {
  lp: {},
  tip: {
    languageSelector: 'languageSelector',
    heading: 'supportLink',
    faqLink: 'faqLink',
    contactLink: 'contactLink',
    privacyLink: 'privacyLink',
  },
  qa: {
    languageSelector: 'languageSelector',
    heading: 'faqLink',
    roadmapLink: 'roadmapLink',
    contactLink: 'contactLink',
    privacyLink: 'privacyLink',
  },
  roadmap: {
    languageSelector: 'languageSelector',
    heading: 'roadmapLink',
    faqLink: 'faqLink',
    contactLink: 'contactLink',
    privacyLink: 'privacyLink',
  },
  contact: {
    languageSelector: 'languageSelector',
    heading: 'contactLink',
    faqLink: 'faqLink',
    privacyLink: 'privacyLink',
  },
  privacy: {
    languageSelector: 'languageSelector',
  },
}

export function isKnownPage(name) {
  return Object.hasOwn(I18N_PAGES, name)
}

/** argv から --page <name>（または --page=<name>）を取り出し、残りの引数と分けて返す */
export function splitPageOption(argv) {
  const rest = []
  let page = DEFAULT_PAGE
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--page') {
      page = argv[index + 1]
      index += 1
      continue
    }
    if (argument.startsWith('--page=')) {
      page = argument.slice('--page='.length)
      continue
    }
    rest.push(argument)
  }
  if (!isKnownPage(page)) {
    throw new Error(`Unknown page: ${page}. Use one of ${Object.keys(I18N_PAGES).join(', ')}`)
  }
  return { page, rest }
}

/** トップLPで固定した訳を、ページ側のキーへ写す。ページ側の翻訳がどうであれ LP の訳が勝つ */
export function applySharedTranslations(page, copies, lpCopies) {
  const shared = SHARED_KEYS[page] ?? {}
  const merged = {}
  for (const [locale, copy] of Object.entries(copies)) {
    const overrides = Object.fromEntries(
      Object.entries(shared).map(([pageKey, lpKey]) => [pageKey, lpCopies[locale][lpKey]]),
    )
    merged[locale] = { ...copy, ...overrides }
  }
  return merged
}

/** 翻訳の初稿を作るときに Gemini へ渡す、サイト共通の固定訳（LP で決めたもの） */
export function sharedGlossary(page, lpCopies) {
  const shared = SHARED_KEYS[page] ?? {}
  return Object.entries(shared).map(([pageKey, lpKey]) => ({
    key: pageKey,
    ja: lpCopies.ja[lpKey],
    en: lpCopies.en[lpKey],
    ko: lpCopies.ko[lpKey],
    zhTW: lpCopies['zh-TW'][lpKey],
  }))
}
