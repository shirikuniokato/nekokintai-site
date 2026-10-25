// 野良ねこの場所のくじ。場所の一覧と名前の組み立ては、アプリの src/shared/catName.ts が正本（#262）。
import { STRAY_PLACE_COUNT } from '../vendor/cat-name.mjs'

/** 名前が空のまま公開するときの場所の番号。公開したときに一度だけ決め、あとは変えない */
export function chooseStrayPlace() {
  const [random] = crypto.getRandomValues(new Uint32Array(1))
  return random % STRAY_PLACE_COUNT
}
