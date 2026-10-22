import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

const outputDirectory = resolve('.pages-dist/site')

// 証明の実装前に、公開ビルドへ投稿を通す経路を紛れ込ませない。
test('ビルド済み Functions は認証を装った投稿も受け付けない', async (context) => {
  const worker = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    scriptPath: resolve(outputDirectory, '_worker.js/index.js'),
    compatibilityDate: '2026-10-19',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['NEKOS_DB'],
    serviceBindings: { ASSETS: () => new Response('static asset') },
  }))
  context.after(() => worker.dispose())
  for (const path of ['/api/nekos', '/api/nekos/', '/api/nekos/test?from=app-dev']) {
    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      const response = await worker.dispatchFetch(`https://example.com${path}`, {
        method,
        headers: { Authorization: 'Bearer pretend-device-proof' },
      })
      assert.equal(response.status, 503, `${method} ${path}`)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
      if (method !== 'HEAD') assert.deepEqual(await response.json(), { error: 'unavailable' })
    }
  }
  const response = await worker.dispatchFetch('https://example.com/privacy/')
  assert.equal(await response.text(), 'static asset')
})

test('静的な公開物にサーバーのソース・設定・開発ファイルを混ぜない', async () => {
  const routes = JSON.parse(await readFile(resolve(outputDirectory, '_routes.json'), 'utf8'))
  assert.deepEqual([...routes.include].sort(), ['/api/nekos/*', '/nekos/*'])
  for (const privateEntry of ['server', 'functions', 'scripts', 'docs', 'migrations', 'cloudflare', 'node_modules', '.git', '.dev.vars']) {
    await assert.rejects(access(resolve(outputDirectory, privateEntry)), { code: 'ENOENT' })
  }
  await access(resolve(outputDirectory, 'privacy/index.html'))
  await access(resolve(outputDirectory, 'update.json'))
})
