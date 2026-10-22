import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, '.pages-dist/site')

execFileSync(process.execPath, [
  resolve(projectRoot, 'node_modules/wrangler/bin/wrangler.js'),
  'pages', 'functions', 'build', 'functions',
  '--outdir', resolve(outputDirectory, '_worker.js'),
  '--output-routes-path', resolve(outputDirectory, '_routes.json'),
  '--build-output-directory', outputDirectory,
  '--compatibility-date', '2026-10-19',
], { cwd: projectRoot, stdio: 'inherit' })
