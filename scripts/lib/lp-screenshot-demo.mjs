const DAY_MS = 86_400_000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

export const LOCALIZED_DEMO_NAMES = {
  ja: {
    catName: '社長',
    categories: ['動画編集', 'お絵描き', '商品梱包', 'サイト作成', '勉強', 'SNS投稿作り'],
  },
  en: {
    catName: 'Boss',
    categories: ['Video editing', 'Drawing', 'Packing orders', 'Website creation', 'Study', 'Social media posts'],
  },
  ko: {
    catName: '사장',
    categories: ['동영상 편집', '그림 그리기', '상품 포장', '웹사이트 제작', '공부', 'SNS 게시물 만들기'],
  },
  'zh-TW': {
    catName: '老闆',
    categories: ['影片剪輯', '繪圖', '商品包裝', '網站製作', '學習', '製作社群貼文'],
  },
}

export const ALIGNMENTS = ['none', 'today', 'week']

function parseDate(iso) {
  if (!DATE_PATTERN.test(iso)) throw new Error(`Invalid date: ${iso}`)
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function shiftDate(iso, days) {
  return new Date(parseDate(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseDate(toIso) - parseDate(fromIso)) / DAY_MS)
}

/** その日を含む週のはじまり。weekStartDow はアプリ設定と同じ 0=日 … 6=土。 */
export function startOfWeek(iso, weekStartDow) {
  const dayOfWeek = new Date(parseDate(iso)).getUTCDay()
  return shiftDate(iso, -((dayOfWeek - weekStartDow + 7) % 7))
}

/** デモの「きょう」。いちばん新しい勤務日で、達成した週の最後の出勤日でもある。 */
export function lastWorkDate(demo) {
  const workDates = demo.punches.map((punch) => punch.workDate).sort()
  const latest = workDates.at(-1)
  if (!latest) throw new Error('Demo data has no punches')
  return latest
}

/**
 * 撮影日に合わせて勤務記録を何日ずらすか。
 * - today: デモの最後の出勤日を撮影日に重ねる。ホーム・月・ねこ屋さん用。
 * - week: デモの達成した週を撮影日を含む週に重ねる。週画面用。週の後半が撮影日より先でも、
 *   閉じた打刻はそのまま集計されるので、曜日にかかわらず目標達成の週が出る。
 * - none: ずらさない。
 */
export function alignmentShiftDays(demo, { align, on }) {
  if (align === 'none') return 0
  if (!ALIGNMENTS.includes(align)) throw new Error(`Unknown alignment: ${align}`)
  if (!on) throw new Error(`--on=YYYY-MM-DD is required for --align=${align}`)

  const demoToday = lastWorkDate(demo)
  if (align === 'today') return daysBetween(demoToday, on)

  const weekStartDow = demo.settings.weekStartDow ?? 1
  return daysBetween(startOfWeek(demoToday, weekStartDow), startOfWeek(on, weekStartDow))
}

export function localizedDemo(demo, locale, shiftDays) {
  const translation = LOCALIZED_DEMO_NAMES[locale]
  if (!translation) throw new Error(`Unsupported locale: ${locale}`)
  if (demo.categories.length !== translation.categories.length) throw new Error('Demo category count changed')

  return {
    ...demo,
    settings: { ...demo.settings, catName: translation.catName },
    categories: demo.categories.map((category, index) => ({ ...category, name: translation.categories[index] })),
    punches: demo.punches.map((punch) => ({
      ...punch,
      occurredAt: new Date(new Date(punch.occurredAt).getTime() + shiftDays * DAY_MS).toISOString(),
      workDate: shiftDate(punch.workDate, shiftDays),
    })),
    adjustments: demo.adjustments.map((adjustment) => ({ ...adjustment, workDate: shiftDate(adjustment.workDate, shiftDays) })),
  }
}

export function parseArguments(argv) {
  const positional = argv.filter((argument) => !argument.startsWith('--'))
  const flags = Object.fromEntries(
    argv
      .filter((argument) => argument.startsWith('--'))
      .map((argument) => {
        const [name, ...rest] = argument.slice(2).split('=')
        return [name, rest.join('=')]
      }),
  )
  const [locale, output] = positional
  if (!locale || !output || positional.length > 2) return null

  const align = flags.align ?? 'none'
  if (!ALIGNMENTS.includes(align)) throw new Error(`Unknown alignment: ${align}`)
  if (flags.on !== undefined) parseDate(flags.on)
  return { locale, output, align, on: flags.on, source: flags.source }
}
