import { HELP, parseArguments } from './neko-ops/arguments.mjs'
import { runOperation } from './neko-ops/run.mjs'

try {
  const options = parseArguments(process.argv.slice(2))
  console.log(options.help ? HELP : JSON.stringify(await runOperation(options), null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
