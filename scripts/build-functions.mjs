import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const development = process.argv.includes('--development')
const outputDirectory = resolve(projectRoot, development ? '.pages-dist/development' : '.pages-dist/site')
mkdirSync(outputDirectory, { recursive: true })

execFileSync(process.execPath, [
  resolve(projectRoot, 'node_modules/wrangler/bin/wrangler.js'),
  'pages', 'functions', 'build', development ? 'functions-dev' : 'functions',
  '--outdir', resolve(outputDirectory, '_worker.js'),
  '--output-routes-path', resolve(outputDirectory, '_routes.json'),
  '--build-output-directory', outputDirectory,
  '--compatibility-date', '2026-10-19',
  '--compatibility-flags', 'nodejs_compat',
], { cwd: projectRoot, stdio: 'inherit' })
