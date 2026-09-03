import assert from 'node:assert/strict'
import test from 'node:test'
import {
  alignmentShiftDays,
  daysBetween,
  lastWorkDate,
  localizedDemo,
  parseArguments,
  shiftDate,
  startOfWeek,
} from './lp-screenshot-demo.mjs'

// ストア用デモデータと同じ形。達成した週は 2026-08-03（月）〜 08-09 で、最後の出勤日は 08-07（金）。
const demo = {
  settings: { weeklyTargetMin: 1500, dailyTargetMin: 360, weekStartDow: 1, catName: '社長' },
  categories: [
    { id: 1, name: '動画編集' }, { id: 2, name: 'お絵描き' }, { id: 3, name: '商品梱包' },
    { id: 4, name: 'サイト作成' }, { id: 5, name: '勉強' }, { id: 6, name: 'SNS投稿作り' },
  ],
  punches: [
    { id: 1, kind: 'clock_in', categoryId: 2, occurredAt: '2026-08-03T01:00:00.000Z', workDate: '2026-08-03' },
    { id: 2, kind: 'clock_out', categoryId: null, occurredAt: '2026-08-03T10:29:00.000Z', workDate: '2026-08-03' },
    { id: 3, kind: 'clock_in', categoryId: 3, occurredAt: '2026-08-07T05:05:00.000Z', workDate: '2026-08-07' },
    { id: 4, kind: 'clock_out', categoryId: null, occurredAt: '2026-08-07T09:24:00.000Z', workDate: '2026-08-07' },
    { id: 5, kind: 'clock_in', categoryId: 3, occurredAt: '2026-08-05T01:20:00.000Z', workDate: '2026-08-05' },
    { id: 6, kind: 'clock_out', categoryId: null, occurredAt: '2026-08-05T02:50:00.000Z', workDate: '2026-08-05' },
  ],
  adjustments: [{ workDate: '2026-08-05', kind: 'paid_leave', minutes: 0 }],
  weeks: [],
}

test('日付の足し引きと週のはじまり', () => {
  assert.equal(shiftDate('2026-08-03', 28), '2026-08-31')
  assert.equal(shiftDate('2026-09-02', -26), '2026-08-07')
  assert.equal(daysBetween('2026-08-07', '2026-09-02'), 26)
  assert.equal(startOfWeek('2026-09-02', 1), '2026-08-31')
  assert.equal(startOfWeek('2026-08-31', 1), '2026-08-31')
  assert.equal(startOfWeek('2026-09-06', 1), '2026-08-31')
  assert.equal(startOfWeek('2026-09-02', 0), '2026-08-30')
  assert.equal(lastWorkDate(demo), '2026-08-07')
})

test('today は最後の出勤日を撮影日に重ね、week は達成した週を撮影週に重ねる', () => {
  assert.equal(alignmentShiftDays(demo, { align: 'none' }), 0)
  // 2026-09-02 は水曜。today 合わせでは週の後半が空になり、週画面が未達成になる（2026-09-02 の撮り直し原因）
  assert.equal(alignmentShiftDays(demo, { align: 'today', on: '2026-09-02' }), 26)
  // week 合わせなら撮影日が週のどの曜日でも、達成した週がまるごと今週に入る
  assert.equal(alignmentShiftDays(demo, { align: 'week', on: '2026-08-31' }), 28)
  assert.equal(alignmentShiftDays(demo, { align: 'week', on: '2026-09-02' }), 28)
  assert.equal(alignmentShiftDays(demo, { align: 'week', on: '2026-09-06' }), 28)
  assert.equal(alignmentShiftDays(demo, { align: 'week', on: '2026-09-07' }), 35)
  assert.throws(() => alignmentShiftDays(demo, { align: 'week' }), /--on=YYYY-MM-DD is required/u)
  assert.throws(() => alignmentShiftDays(demo, { align: 'tomorrow', on: '2026-09-02' }), /Unknown alignment/u)
})

test('week 合わせのデモでは達成した週の打刻がすべて撮影週に入る', () => {
  const shifted = localizedDemo(demo, 'en', alignmentShiftDays(demo, { align: 'week', on: '2026-09-02' }))
  const weekStart = startOfWeek('2026-09-02', 1)
  const weekEnd = shiftDate(weekStart, 6)

  for (const punch of shifted.punches) {
    assert.ok(punch.workDate >= weekStart && punch.workDate <= weekEnd, `${punch.workDate} が撮影週の外`)
  }
  assert.equal(shifted.punches[0].occurredAt, '2026-08-31T01:00:00.000Z')
  assert.equal(shifted.adjustments[0].workDate, '2026-09-02')
})

test('カテゴリ名と猫名だけを翻訳し、勤務内容と目標は変えない', () => {
  const localized = localizedDemo(demo, 'zh-TW', 0)

  assert.equal(localized.settings.catName, '老闆')
  assert.equal(localized.settings.weeklyTargetMin, 1500)
  assert.deepEqual(localized.categories.map((category) => category.name), ['影片剪輯', '繪圖', '商品包裝', '網站製作', '學習', '製作社群貼文'])
  assert.deepEqual(localized.punches, demo.punches)
  assert.throws(() => localizedDemo(demo, 'fr', 0), /Unsupported locale/u)
})

test('コマンドライン引数の解釈', () => {
  assert.deepEqual(
    parseArguments(['en', 'docs/lp-screenshots/demo/en-week-2026-09-02.json', '--align=week', '--on=2026-09-02']),
    { locale: 'en', output: 'docs/lp-screenshots/demo/en-week-2026-09-02.json', align: 'week', on: '2026-09-02', source: undefined },
  )
  assert.deepEqual(
    parseArguments(['ko', 'out.json', '--source=/tmp/demo.json']),
    { locale: 'ko', output: 'out.json', align: 'none', on: undefined, source: '/tmp/demo.json' },
  )
  assert.equal(parseArguments(['en']), null)
  assert.throws(() => parseArguments(['en', 'out.json', '--on=9/2']), /Invalid date/u)
  assert.throws(() => parseArguments(['en', 'out.json', '--align=next']), /Unknown alignment/u)
})
