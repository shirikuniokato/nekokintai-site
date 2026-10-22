import { OPERATION_ACTIONS } from '../../server/nekos/operations.mjs'

export const HELP = `ねこ共有の運営操作（JSON 出力）
  npm run neko:ops -- <command> --environment local|dev|production [options]

確認: status / publication --target ID / owner --target 公開識別子
      reports [--after ID] [--limit 1..100] [--include-resolved]
      audit --operation-id ID
操作: hide / unhide / remove / suspend / unsuspend / pause / resume / resolve
      --target ID --revision N --reason 理由 --actor 操作者 [--operation-id ID] [--apply]
      pause/resume の target は publishing（省略可）。remove は永久公開終了でデータを保持。
      省略時は計画のみ。--apply を指定した場合だけ書き込む。
remote: --target-config ファイル（environment/accountId/databaseId/databaseName）必須
        CLOUDFLARE_API_TOKEN を環境変数で渡す。自動再試行しない。
local: npm run db:migrate:local を先に実行。[--persist-to 絶対パス] で保存先を変更可。
       公開先の DB には接続しない。`

const COMMANDS = ['status', 'publication', 'owner', 'reports', 'audit', ...OPERATION_ACTIONS]
const COMMON = ['environment', 'target-config', 'persist-to']
const FLAGS = {
  status: [], publication: ['target'], owner: ['target'], audit: ['operation-id'],
  reports: ['after', 'limit', 'include-resolved'],
}

export function parseArguments(argumentsList) {
  const [command, ...rest] = argumentsList
  if (command === '--help' || command === 'help') return { help: true }
  if (!COMMANDS.includes(command)) throw new Error('command を指定してください。--help で使い方を確認できます')
  const mutation = OPERATION_ACTIONS.includes(command)
  const allowed = [...COMMON, ...(mutation
    ? ['target', 'revision', 'reason', 'actor', 'operation-id', 'apply'] : FLAGS[command])]
  const options = parseOptions(rest, allowed)
  if (!['local', 'dev', 'production'].includes(options.environment)) throw new Error('--environment が必要です')
  if (options.environment === 'local' && options['target-config']) throw new Error('local に target-config は指定できません')
  if (options.environment !== 'local' && !options['target-config']) throw new Error('remote には --target-config が必要です')
  if (options.environment !== 'local' && options['persist-to']) throw new Error('persist-to は local 専用です')
  if (['publication', 'owner'].includes(command) && !options.target) throw new Error('--target が必要です')
  if (command === 'audit' && !options['operation-id']) throw new Error('--operation-id が必要です')
  return { command, mutation, ...options }
}

function parseOptions(argumentsList, allowed) {
  if (!argumentsList.length) return {}
  const [flag, ...rest] = argumentsList
  const name = flag.startsWith('--') ? flag.slice(2) : ''
  if (!allowed.includes(name)) throw new Error(`引数が正しくありません: ${flag}`)
  const boolean = ['apply', 'include-resolved'].includes(name)
  const [value, ...remaining] = rest
  if (!boolean && (!value || value.startsWith('--'))) throw new Error(`${flag} に値が必要です`)
  const tail = parseOptions(boolean ? rest : remaining, allowed)
  if (Object.hasOwn(tail, name)) throw new Error(`引数が重複しています: ${flag}`)
  return { [name]: boolean ? true : value, ...tail }
}
