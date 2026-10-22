import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, cpSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const development = process.argv.includes('--development')
const outputDirectory = resolve(projectRoot, development ? '.pages-dist/development' : '.pages-dist/site')
if (development) rmSync(outputDirectory, { recursive: true, force: true })
mkdirSync(outputDirectory, { recursive: true })
if (development) {
  const site = resolve(projectRoot, '.pages-dist/site')
  for (const entry of readdirSync(site).filter((name) => !['_worker.js', '_routes.json'].includes(name))) {
    cpSync(resolve(site, entry), resolve(outputDirectory, entry), { recursive: true })
  }
  writeFileSync(resolve(outputDirectory, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
  writeFileSync(resolve(outputDirectory, '_headers'), '/*\n  X-Robots-Tag: noindex\n')
}

execFileSync(process.execPath, [
  resolve(projectRoot, 'node_modules/wrangler/bin/wrangler.js'),
  'pages', 'functions', 'build', development ? 'functions-dev' : 'functions',
  '--outdir', resolve(outputDirectory, '_worker.js'),
  '--output-routes-path', resolve(outputDirectory, '_routes.json'),
  '--build-output-directory', outputDirectory,
  '--compatibility-date', '2026-10-19',
  '--compatibility-flags', 'nodejs_compat',
], { cwd: projectRoot, stdio: 'inherit' })
