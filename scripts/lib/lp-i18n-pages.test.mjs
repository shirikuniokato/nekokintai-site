import assert from 'node:assert/strict'
import test from 'node:test'
import {
  I18N_PAGES,
  SHARED_KEYS,
  applySharedTranslations,
  sharedGlossary,
  splitPageOption,
} from './lp-i18n-pages.mjs'

const lpCopies = {
  ja: { languageSelector: '言語', faqLink: 'よくあるしつもん', supportLink: '開発をおうえんする', contactLink: 'ごようぼう', privacyLink: 'プライバシーポリシー', roadmapLink: 'アップデートのよてい' },
  en: { languageSelector: 'Language', faqLink: 'FAQ', supportLink: 'Support the development', contactLink: 'Requests', privacyLink: 'Privacy Policy', roadmapLink: 'Update Roadmap' },
}

test('--page を引数から取り出し、省略時はトップLPにする', () => {
  assert.deepEqual(splitPageOption(['out.json']), { page: 'lp', rest: ['out.json'] })
  assert.deepEqual(splitPageOption(['--page', 'qa', 'gpt', 'draft.json']), { page: 'qa', rest: ['gpt', 'draft.json'] })
  assert.deepEqual(splitPageOption(['--page=tip', 'out.json']), { page: 'tip', rest: ['out.json'] })
  assert.throws(() => splitPageOption(['--page', 'shop']), /Unknown page: shop/u)
})

test('ページ一覧の HTML と辞書のパスは対になっている', () => {
  for (const [name, page] of Object.entries(I18N_PAGES)) {
    assert.match(page.html, /index\.html$/u, name)
    assert.match(page.locales, /locales\.json$/u, name)
    assert.ok(Object.hasOwn(SHARED_KEYS, name), `${name} の共通キー表がない`)
  }
})

test('トップLPで決めた訳をページ側の同じ意味のキーへ写す', () => {
  const tip = {
    ja: { heading: '開発をおうえんする', lead: 'ねこ勤怠は、個人で作っています。', faqLink: 'よくあるしつもん', contactLink: 'ごようぼう', privacyLink: 'プライバシーポリシー', languageSelector: '言語' },
    en: { heading: 'Support development', lead: 'Made by one person.', faqLink: 'Questions', contactLink: 'Contact', privacyLink: 'Privacy', languageSelector: 'Lang' },
  }

  const merged = applySharedTranslations('tip', tip, lpCopies)

  assert.equal(merged.en.heading, 'Support the development')
  assert.equal(merged.en.faqLink, 'FAQ')
  assert.equal(merged.en.contactLink, 'Requests')
  assert.equal(merged.en.privacyLink, 'Privacy Policy')
  assert.equal(merged.en.languageSelector, 'Language')
  assert.equal(merged.en.lead, 'Made by one person.', 'ページ固有の文は変えない')
  assert.equal(merged.ja.heading, '開発をおうえんする')
  assert.notEqual(merged.en, tip.en, '元の辞書は書き換えない')
})

test('初稿を頼むときの固定訳の一覧は、ページ側のキー名で並ぶ', () => {
  const glossary = sharedGlossary('qa', { ...lpCopies, ko: lpCopies.en, 'zh-TW': lpCopies.en })

  assert.deepEqual(glossary.map((term) => term.key).sort(), ['contactLink', 'heading', 'languageSelector', 'privacyLink', 'roadmapLink'])
  assert.deepEqual(glossary.find((term) => term.key === 'heading'), { key: 'heading', ja: 'よくあるしつもん', en: 'FAQ', ko: 'FAQ', zhTW: 'FAQ' })
  assert.deepEqual(sharedGlossary('lp', lpCopies), [])
})
