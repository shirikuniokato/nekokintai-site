import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
mkdirSync('public', { recursive: true })
execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'functions', 'build',
  '--compatibility-date', '2026-10-19', '--compatibility-flags', 'nodejs_compat',
  '--outdir', 'public/_worker.js', '--output-routes-path', 'public/_routes.json'], { stdio: 'inherit' })
