import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', 'src/library-probe.mjs',
  '--config', 'test/probe.wrangler.json', '--dry-run', '--outdir', '.probe-dist', '--compatibility-date', '2026-10-19',
  '--compatibility-flags', 'nodejs_compat'], { stdio: 'pipe' })

test('実際のApple fixtureを厳密なwrapperとworkerdで検証する', async (context) => {
  const worker = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: '.probe-dist/library-probe.js',
    compatibilityDate: '2026-10-19', compatibilityFlags: ['nodejs_compat'],
  }))
  context.after(() => worker.dispose())
  const fixture = await readFile('node_modules/node-app-attest/test/fixtures/attestation-development.json', 'utf8')
  const response = await worker.dispatchFetch('https://example.com/', { method: 'POST', body: fixture })
  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  assert.equal(body.aaguid, 'appattestdevelop')
  const assertion = await readFile('test/fixtures/assertion.json', 'utf8')
  const verified = await worker.dispatchFetch('https://example.com/', { method: 'POST', body: assertion })
  assert.deepEqual(await verified.json(), { counter: 1 })
  assert.equal(verified.status, 200)
})
