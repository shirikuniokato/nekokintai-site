// 野良ねこの場所の番号は D1 に保存している。番号と場所の結びつきが変わらないことを固定する（#262）。
import assert from 'node:assert/strict'
import test from 'node:test'
import { STRAY_NAMES, STRAY_PLACE_COUNT, displayCatName, strayCatName } from '../../assets/nekos/stray-names.mjs'

// 2026-10-23 に決めた 20 か所（デザインの places）。足すのは末尾だけ。ここを書きかえる変更は、公開済みのねこの名前を変える
const FIXED_JA = ['街', '海辺', '路地裏', '公園', '屋根の上', '塀の上', '商店街', '駅前', '神社', '川辺',
  '港', '坂道', '縁側', '橋の下', '本屋', '喫茶店', '銭湯', '駄菓子屋', '灯台', '田んぼ']

test('場所の番号は並び順を変えず、途中を消していない', () => {
  assert.ok(STRAY_PLACE_COUNT >= FIXED_JA.length)
  FIXED_JA.forEach((place, index) => assert.equal(strayCatName(index, 'ja'), `${place}の野良ねこ`))
  for (const copy of Object.values(STRAY_NAMES)) {
    for (let index = 0; index < STRAY_PLACE_COUNT; index += 1) {
      assert.ok(copy[`place${String(index).padStart(2, '0')}`], `place${index}`)
    }
  }
})

test('見る人の言語で組み立て、付けた名前があればそれを出す', () => {
  assert.equal(strayCatName(0, 'ja'), '街の野良ねこ')
  assert.equal(strayCatName(19, 'en'), 'The rice field stray')
  assert.equal(strayCatName(8, 'ko'), '신사 경내의 길고양이')
  assert.equal(strayCatName(12, 'zh-TW'), '緣廊的浪貓')
  assert.equal(strayCatName(2, 'fr'), '路地裏の野良ねこ')
  assert.throws(() => strayCatName(STRAY_PLACE_COUNT, 'ja'))
  assert.throws(() => strayCatName(1.5, 'ja'))
  assert.equal(displayCatName('', 3, 'en'), 'The park stray')
  assert.equal(displayCatName('よる', 3, 'en'), 'よる')
})
