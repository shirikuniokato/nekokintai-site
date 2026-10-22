import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { isAbsolute } from 'node:path'

const executeFile = promisify(execFile)
const ROOT = fileURLToPath(new URL('../../', import.meta.url))

export async function readTarget(options) {
  if (options.environment === 'local') {
    if (options['persist-to'] && !isAbsolute(options['persist-to'])) throw new Error('persist-to は絶対パスで指定してください')
    return { environment: 'local', databaseName: 'nekokintai-nekos-local',
      ...(options['persist-to'] ? { persistTo: options['persist-to'] } : {}) }
  }
  const target = JSON.parse(await readFile(options['target-config'], 'utf8'))
  if (target.environment !== options.environment || !/^[a-f0-9]{32}$/.test(target.accountId)
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(target.databaseId)
    || typeof target.databaseName !== 'string' || !target.databaseName.trim()) {
    throw new Error('target-config の環境・accountId・databaseId・databaseName が正しくありません')
  }
  return { environment: target.environment, accountId: target.accountId,
    databaseId: target.databaseId, databaseName: target.databaseName }
}

export function localSql({ sql, params }) {
  if ((sql.match(/\?/g) || []).length !== params.length) throw new Error('SQL のパラメータ数が一致しません')
  const parts = sql.split('?')
  return parts.map((part, index) => index === params.length ? part : part + sqlLiteral(params[index])).join('')
}

function sqlLiteral(value) {
  if (value === null) return 'NULL'
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  if (typeof value === 'string' && !value.includes('\0')) return `'${value.replaceAll("'", "''")}'`
  throw new Error('SQL のパラメータが正しくありません')
}

async function localQuery(target, statement) {
  try {
    const { stdout } = await executeFile(process.execPath, [
      'node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'NEKOS_DB',
      '--config', 'cloudflare/local/wrangler.json', '--local', '--json', '--yes', '--command', localSql(statement),
      ...(target.persistTo ? ['--persist-to', target.persistTo] : []),
    ], { cwd: ROOT, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 })
    return queryResults(JSON.parse(stdout))
  } catch (error) {
    if (`${error.stderr || ''}${error.stdout || ''}`.includes('operation_conflict')) {
      throw new Error('operation_conflict: 対象の版・状態を読み直してください')
    }
    throw new Error('local D1 の実行に失敗しました。migration と DB の状態を確認してください', { cause: error })
  }
}

function queryResults(results) {
  if (!Array.isArray(results) || results.some((result) => result.success !== true)) {
    throw new Error('D1 の処理が成功していません')
  }
  return results.flatMap((result) => result.results || [])
}

async function remoteRequest(target, suffix, request = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN が必要です')
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}${suffix}`, {
    ...request, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  const body = await response.json()
  if (!response.ok || body.success !== true) {
    if (JSON.stringify(body.errors || []).includes('operation_conflict')) {
      throw new Error('operation_conflict: 対象の版・状態を読み直してください')
    }
    throw new Error(`Cloudflare D1 の要求に失敗しました（HTTP ${response.status}）`)
  }
  return body.result
}

export async function connectDatabase(target) {
  if (target.environment === 'local') return (statement) => localQuery(target, statement)
  const metadata = await remoteRequest(target, '')
  if (metadata.name !== target.databaseName || metadata.uuid !== target.databaseId) {
    throw new Error('D1 の実際の名前・ID が target-config と一致しません')
  }
  return async (statement) => queryResults(await remoteRequest(target, '/query', {
    method: 'POST', body: JSON.stringify({ sql: statement.sql, params: statement.params.map(restParameter) }),
  }))
}

function restParameter(value) {
  // REST は文字列配列。SQLite の INTEGER affinity で版・件数を照合する。
  if (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) return String(value)
  throw new Error('REST SQL のパラメータが正しくありません')
}
