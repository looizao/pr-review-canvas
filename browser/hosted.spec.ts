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

test('requires browser sign-in before a canvas, enforces repository access, and invalidates logout', async ({
  page,
}) => {
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
  const queue = new GenerationQueue(t.dataDir)
  await queue.load()
  let contexts = 0
  let app: ReturnType<typeof createHostedApp>
  const server = serve({ port: 0, hostname: '127.0.0.1', fetch: request => app.fetch(request) })
  try {
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('fixture has no port')
    const base = `http://127.0.0.1:${address.port}`
    // Loopback is a secure cookie context in Chromium. Production config requires HTTPS.
    config.origin = base
    app = createHostedApp({
      config,
      sessions,
      queue,
      log: () => {},
      repositories: {
        forUser: async () => {
          contexts += 1
          return t.ctx
        },
      },
      github: {
        exchangeCode: async (_code, verifier) => {
          if (verifier.length !== 43) throw new Error('missing PKCE verifier')
          return { token: 'fixture-token', expiresIn: 60 }
        },
        request: async () => ({ id: 1, login: 'alice' }),
        userCanRead: async (_token, _owner, repo) => repo !== 'denied',
        installationToken: async () => 'fixture-token',
      },
    })
    const canvas = `${base}/repos/acme/widgets/review/42`
    const api = `${base}/repos/acme/widgets/api/prs`
    expect((await page.request.get(api)).status()).toBe(401)
    await page.goto(canvas)
    await expect(page).toHaveURL(/\/login\?next=/)
    await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible()
    expect(contexts).toBe(0)
    await page.route(`${base}/auth/login**`, async route => {
      const response = await route.fetch({ maxRedirects: 0 })
      const request = new URL(response.headers()['location'] ?? '')
      expect(request.origin).toBe('https://github.com')
      expect(request.searchParams.get('code_challenge_method')).toBe('S256')
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          location: `${base}/auth/callback?state=${request.searchParams.get('state')}&code=fixture-code`,
        },
      })
    })
    await page.getByRole('link', { name: 'Sign in with GitHub' }).click()
    await expect(page).toHaveURL(canvas)
    await expect(page.locator('article.file[data-path="src/app.ts"]').first()).toBeVisible()
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(cookie => cookie.name === '__Host-pr-review')
    expect(sessionCookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    })
    expect(
      await page.evaluate(async url => (await fetch(url)).status, `${base}/repos/acme/denied/api/prs`)
    ).toBe(404)
    await page.goto(base)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(`${base}/login`)
    expect(await sessions.read(sessionCookie?.value)).toBeNull()
    expect((await page.request.get(api)).status()).toBe(401)
    await page.goto(canvas)
    await expect(page).toHaveURL(/\/login\?next=/)
  } finally {
    server.close()
    if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function')
      server.closeAllConnections()
    await t.cleanup()
  }
})
