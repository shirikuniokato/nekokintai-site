// 野良ねこの場所のくじと、OGP・ページの title に使う日本語の名前（#262）。
// 場所の一覧はサイトの辞書 assets/nekos/stray-names.mjs（ブラウザと同じもの）。
import { STRAY_PLACE_COUNT, strayCatName } from '../../assets/nekos/stray-names.mjs'
import { ogpCatName } from '../vendor/cat-name.mjs'

/** 名前が空のまま公開するときの場所の番号。公開したときに一度だけ決め、あとは変えない */
export function chooseStrayPlace() {
  const [random] = crypto.getRandomValues(new Uint32Array(1))
  return random % STRAY_PLACE_COUNT
}

/** OGP の絵とサーバーが組む title の名前。野良ねこは日本語で描く。og:image の名前のハッシュもこの文字から作る */
export function ogpNameOf(cat) {
  return ogpCatName(cat.name, cat.name === '' ? strayCatName(cat.fallbackPlace, 'ja') : '')
}
