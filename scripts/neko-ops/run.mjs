import { randomUUID } from 'node:crypto'
import { operationStatement, settingsStatement, publicationStatement, ownerStatement,
  reportsStatement, auditStatement } from '../../server/nekos/operations.mjs'
import { connectDatabase, readTarget } from './database.mjs'

function readStatement(options) {
  switch (options.command) {
    case 'status': return settingsStatement()
    case 'publication': return publicationStatement(options.target)
    case 'owner': return ownerStatement(options.target)
    case 'reports': return reportsStatement({ after: Number(options.after || 0),
      limit: Number(options.limit || 50), includeResolved: !!options['include-resolved'] })
    case 'audit': return auditStatement(options['operation-id'])
    default: throw new Error('確認コマンドが正しくありません')
  }
}

export async function runOperation(options, dependencies = {}) {
  const target = await (dependencies.readTarget || readTarget)(options)
  if (!options.mutation) {
    const statement = readStatement(options)
    const query = await (dependencies.connectDatabase || connectDatabase)(target)
    return { target, results: await query(statement) }
  }
  const id = options['operation-id'] || randomUUID()
  const statement = operationStatement({ id, action: options.command,
    target: options.target || (['pause', 'resume'].includes(options.command) ? 'publishing' : ''),
    expectedRevision: Number(options.revision), reason: options.reason, actor: options.actor })
  if (!options.apply) return { status: 'plan', target, operationId: id, statement }
  const query = await (dependencies.connectDatabase || connectDatabase)(target)
  return applyOperation(query, { id, statement, target })
}

async function applyOperation(query, { id, statement, target }) {
  const existing = await query(auditStatement(id))
  if (existing.length) {
    if (!matchesOperation(existing[0], statement.params)) throw new Error('操作IDが別の操作に使われています')
    return { status: 'already-applied', target, operation: existing[0] }
  }
  try {
    await query(statement)
    const [operation] = await query(auditStatement(id))
    if (!operation) throw new Error('操作記録を確認できません')
    return { status: 'applied', target, operation }
  } catch (error) {
    throw new Error(`${error.message}\n操作ID: ${id}。自動再試行はしません。audit で反映を確認してください。`, { cause: error })
  }
}

function matchesOperation(operation, parameters) {
  const values = [operation.id, operation.action, operation.target,
    operation.expected_revision, operation.reason, operation.actor]
  return values.every((value, index) => value === parameters[index])
}
