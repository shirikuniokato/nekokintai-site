const PLATFORM_LABELS = Object.freeze({ ios: 'iOS', android: 'Android' })
const APP_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/
// アプリが想定外の失敗に付けるコード（D14 など）と、その時刻（UTC・秒まで）
const ERROR_CODE_PATTERN = /^[A-Z][0-9]{2}$/
const ERROR_AT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/
const ERROR_DETAIL_MAX_LENGTH = 200

/** 失敗の中身は自由な文なので、制御文字と改行を落として短く切る（表示も送信もこの値だけを使う）。 */
function cleanErrorDetail(raw) {
  const detail = raw.replace(/[\u0000-\u001f\u007f]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  return detail ? detail.slice(0, ERROR_DETAIL_MAX_LENGTH) : null
}

/** アプリで直近に出た想定外の失敗。コードが決まった形でなければ、まるごと受け取らない。 */
function parseFailure(params) {
  const code = params.get('errorCode') ?? ''
  if (!ERROR_CODE_PATTERN.test(code)) return null
  const rawAt = params.get('errorAt') ?? ''
  return {
    code,
    at: ERROR_AT_PATTERN.test(rawAt) ? rawAt : null,
    detail: cleanErrorDetail(params.get('errorDetail') ?? ''),
  }
}

/** アプリから渡された問い合わせ情報を、表示・保存してよい値だけに絞る。 */
export function parseAppContext(search) {
  const params = new URLSearchParams(search)
  const platform = params.get('platform')
  if (!platform || !Object.hasOwn(PLATFORM_LABELS, platform)) return null

  const rawVersion = params.get('appVersion')?.trim() ?? ''
  const appVersion = APP_VERSION_PATTERN.test(rawVersion) ? rawVersion : null
  return { platform, platformLabel: PLATFORM_LABELS[platform], appVersion, failure: parseFailure(params) }
}

/** フォームに見せる 1 行。送る内容と同じものを、そのまま本人に見せる。 */
export function describeFailure(failure) {
  return [failure.code, failure.at, failure.detail].filter(Boolean).join(' · ')
}

/** 問い合わせ管理画面で一緒に読めるよう、本文末尾へ環境情報を付ける。 */
export function appendAppContext(message, context) {
  if (!context) return message
  const lines = ['', '', '---', `利用環境: ${context.platformLabel}`]
  if (context.appVersion) lines.push(`アプリバージョン: ${context.appVersion}`)
  // 既存の 2 行の形は変えず、あとに足す
  if (context.failure) {
    lines.push(`エラーコード: ${context.failure.code}`)
    if (context.failure.at) lines.push(`エラーの時刻: ${context.failure.at}`)
    if (context.failure.detail) lines.push(`エラーの内容: ${context.failure.detail}`)
  }
  return `${message}${lines.join('\n')}`
}
