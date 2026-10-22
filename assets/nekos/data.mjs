// みんなのねこちゃんの仮のデータ。API（/api/nekos、#249）ができたら、ここを fetch に置きかえる。
// 形は API が返す予定の 1 匹ぶんに寄せている:
//   id      … /nekos/<id> の id
//   name    … ねこちゃんの名前。空で公開されたときはサーバーが「〇〇の野良ねこ」を付けて保存するので、ここには必ず文字が入る
//   author  … 飼い主の名前。空がふつう
//   owner   … 飼い主の印（uid とは別のハッシュ。表示しないに使う）。ここでは仮の文字列
//   breed / colors … じぶんだけのねこの品種と色 7 つ（code を解いたもの）
//   likes   … いいねの数（サーバーが正本）
//   order   … 公開の新しい順（小さいほど新しい）

const SAMPLE_CATS = [
  { id: 'Mk3pQ7aZ', name: 'もち', author: 'たろう', owner: 'ow-taro', breed: 'long', likes: 128, colors: { body: '#FFFFFF', line: '#000000', eyes: '#000000', collar: '#26CAD4' } },
  { id: 'An8xR2kL', name: 'あんこ', author: '', owner: 'ow-a1', breed: 'short', likes: 342, colors: { body: '#3B2A26', line: '#8A6E66', eyes: '#FFD84D', collar: '#FF9FB0' } },
  { id: 'Sd4vT9mQ', name: 'ソーダ', author: 'みずき', owner: 'ow-mizuki', breed: 'short', likes: 87, colors: { body: '#A8DFEC', line: '#0C3A44', eyes: '#0C3A44', collar: '#FFDE59', paws: '#FFB3C1' } },
  { id: 'Kn2bW6pE', name: 'きなこ', author: '', owner: 'ow-a2', breed: 'calico', likes: 51, colors: { body: '#FFF4E0', pattern: '#C8873E', patternSecondary: '#5A3B1E', line: '#5A3B1E', eyes: '#000000', collar: '#2E8E9E' } },
  { id: 'Yz7cH1nR', name: 'ゆず', author: 'はる', owner: 'ow-haru', breed: 'short', likes: 205, colors: { body: '#FFE98A', line: '#6B5A12', eyes: '#000000', collar: '#7FD3E8' } },
  { id: 'Yr5dJ3sT', name: 'よる', author: '', owner: 'ow-a3', breed: 'tuxedo', likes: 19, colors: { body: '#232F34', pattern: '#FFFFFF', line: '#6F8E9B', eyes: '#FFD84D' } },
  { id: 'Sk9eF4uV', name: 'さくら', author: 'なな', owner: 'ow-nana', breed: 'hachi', likes: 166, colors: { body: '#FFD6DE', pattern: '#8C3B4C', line: '#8C3B4C', eyes: '#000000', collar: '#FFFFFF' } },
  { id: 'Nr1gD8wX', name: '路地裏の野良ねこ', author: '', owner: 'ow-a4', breed: 'short', likes: 4, colors: { body: '#B8D89A', line: '#3B5A22', eyes: '#000000', collar: '#FF9FB0' } },
  { id: 'Mt6hS2yA', name: 'みたらし', author: 'みずき', owner: 'ow-mizuki', breed: 'calico', likes: 73, colors: { body: '#FFFFFF', pattern: '#E8B072', patternSecondary: '#5A3B1E', line: '#000000', eyes: '#000000', collar: '#2E8E9E' } },
  { id: 'Hm3jK7zB', name: '屋根の上の野良ねこ', author: '', owner: 'ow-a5', breed: 'hachi', likes: 12, colors: { body: '#FFFFFF', pattern: '#232F34', line: '#000000', eyes: '#E0B900', collar: '#FF9FB0' } },
  { id: 'Cp8kL5qC', name: 'こむぎ', author: 'ゆうき', owner: 'ow-yuki', breed: 'long', likes: 240, colors: { body: '#FDEFC9', line: '#9B6B3F', eyes: '#000000', collar: '#F5A7C5' } },
  { id: 'Gr2mN9rD', name: 'はいいろ', author: '', owner: 'ow-a6', breed: 'short', likes: 33, colors: { body: '#7D7D7D', line: '#3D3D3D', eyes: '#B9FF94', collar: '#FFFFFF' } },
  { id: 'Ms4pQ1tF', name: 'ミント', author: 'みずき', owner: 'ow-mizuki', breed: 'tuxedo', likes: 58, colors: { body: '#3FB4C4', pattern: '#F8FFFC', line: '#0C3A44', eyes: '#FFFFFF' } },
  { id: 'Tk6rS3vG', name: '灯台の野良ねこ', author: '', owner: 'ow-a7', breed: 'calico', likes: 2, colors: { body: '#FFFFFF', pattern: '#FFA442', patternSecondary: '#24211D', line: '#000000', eyes: '#000000', collar: '#F62323' } },
]

const DEFAULT_COLORS = {
  body: '#FFFFFF',
  pattern: '#FFA442',
  patternSecondary: '#24211D',
  line: '#000000',
  eyes: '#000000',
  collar: '#26CAD4',
  paws: '#FFAEAE',
}

/** いま見られないことにしてある id（取り下げ・非表示の見本）。それ以外の知らない id も見られない扱い */
const GONE_IDS = new Set(['gone'])

export const PAGE_SIZE = 8

function withDefaults(cat, index) {
  return { ...cat, order: index + 1, colors: { ...DEFAULT_COLORS, ...cat.colors } }
}

const CATS = SAMPLE_CATS.map(withDefaults)

/** 通信のかわり。本物の読み込みと同じく、少し待ってから返す */
function later(value, delay = 350) {
  return new Promise((resolve) => setTimeout(() => resolve(value), delay))
}

/**
 * 一覧の 1 ページぶん。sort は 'new' か 'popular'。hiddenOwners の飼い主のねこちゃんは除く。
 * 返すのは { cats, hasMore }。件数そのものは返さない（画面に出さない）。
 */
export function fetchNekos({ sort, page, hiddenOwners }) {
  const visible = CATS.filter((cat) => !hiddenOwners.has(cat.owner))
  const sorted = [...visible].sort((a, b) => (sort === 'popular' ? b.likes - a.likes : a.order - b.order))
  const end = (page + 1) * PAGE_SIZE
  return later({ cats: sorted.slice(page * PAGE_SIZE, end), hasMore: end < sorted.length })
}

/** 1 匹ぶん。見られないときは null */
export function fetchNeko(id) {
  if (GONE_IDS.has(id)) return later(null)
  return later(CATS.find((cat) => cat.id === id) ?? null)
}

/** 1 匹のページの下に出す「ほかのねこちゃん」 */
export function fetchOtherNekos({ excludeId, hiddenOwners, count = 4 }) {
  const others = CATS.filter((cat) => cat.id !== excludeId && !hiddenOwners.has(cat.owner))
  return later(others.slice(0, count))
}
