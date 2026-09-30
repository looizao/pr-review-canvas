import { serve } from '@hono/node-server'
import { expect, test } from '@playwright/test'
import { createHostedApp } from '../src/hosted/app.js'
import { GenerationQueue } from '../src/hosted/queue.js'
import { Sessions } from '../src/hosted/sessions.js'
import { resolveVendorRoots } from '../src/server/context.js'
import { testHostedConfig } from '../src/testing/hosted.js'
import { makeTestContext } from '../src/testing/fakes.js'
import { ghFor42, gitFor42, syntheticArtifact } from '../src/testing/synthetic.js'

test('hydrates the unchanged canvas under a hosted repository prefix with matching CSP', async ({ page }) => {
  const t = await makeTestContext({
    git: gitFor42(),
    gh: ghFor42(),
    fixtureArtifact: syntheticArtifact(),
    vendorRoots: resolveVendorRoots(),
  })
  t.ctx.projectConfig = structuredClone(t.ctx.projectConfig)
  t.ctx.projectConfig.config.chat.enabled = false
  const config = testHostedConfig(t.dataDir)
  const sessions = new Sessions(t.dataDir, config.sessionKey)
  const id = await sessions.create({
    userId: 1,
    login: 'alice',
    token: 'fixture-token',
    expires: Date.now() + 60_000,
  })
  const queue = new GenerationQueue(t.dataDir)
  await queue.load()
  let app: ReturnType<typeof createHostedApp>
  const server = serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: request => {
      // The loopback fixture authenticates a synthetic user without external GitHub accounts.
      const headers = new Headers(request.headers)
      headers.set('cookie', `__Host-pr-review=${id}`)
      return app.fetch(new Request(request, { headers }))
    },
  })
  try {
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('fixture has no port')
    const base = `http://127.0.0.1:${address.port}`
    config.origin = `https://127.0.0.1:${address.port}`
    app = createHostedApp({
      config,
      sessions,
      queue,
      log: () => {},
      repositories: { forUser: async () => t.ctx },
      github: {
        exchangeCode: async () => ({ token: 'fixture-token', expiresIn: 60 }),
        request: async () => ({}),
        userCanRead: async () => true,
        installationToken: async () => 'fixture-token',
      },
    })
    const errors: string[] = []
    const apiPaths: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (new URL(request.url()).pathname.includes('/api/')) apiPaths.push(new URL(request.url()).pathname)
    })
    await page.goto(`${base}/repos/acme/widgets/review/42`)
    const file = page.locator('article.file[data-path="src/app.ts"]').first()
    await expect(file).toBeVisible()
    await file.scrollIntoViewIfNeeded()
    await expect(page.locator('tr.ifind[data-fingerprint="fp-1"]')).toHaveCount(1)
    expect(errors).toEqual([])
    expect(apiPaths.length).toBeGreaterThan(0)
    expect(apiPaths.every(path => path.startsWith('/repos/acme/widgets/api/'))).toBe(true)
  } finally {
    server.close()
    if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function')
      server.closeAllConnections()
    await t.cleanup()
  }
})
