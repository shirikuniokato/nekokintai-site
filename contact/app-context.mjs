const PLATFORM_LABELS = Object.freeze({ ios: 'iOS', android: 'Android' })
const APP_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/

/** アプリから渡された問い合わせ情報を、表示・保存してよい値だけに絞る。 */
export function parseAppContext(search) {
  const params = new URLSearchParams(search)
  const platform = params.get('platform')
  if (!platform || !Object.hasOwn(PLATFORM_LABELS, platform)) return null

  const rawVersion = params.get('appVersion')?.trim() ?? ''
  const appVersion = APP_VERSION_PATTERN.test(rawVersion) ? rawVersion : null
  return { platform, platformLabel: PLATFORM_LABELS[platform], appVersion }
}

/** 問い合わせ管理画面で一緒に読めるよう、本文末尾へ環境情報を付ける。 */
export function appendAppContext(message, context) {
  if (!context) return message
  const lines = ['', '', '---', `利用環境: ${context.platformLabel}`]
  if (context.appVersion) lines.push(`アプリバージョン: ${context.appVersion}`)
  return `${message}${lines.join('\n')}`
}
