import { createHash, createHmac } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { makeTestContext, type TestContext } from '../testing/fakes.js'
import { createHostedApp, type HostedAppOptions } from './app.js'
import { hostedConfig } from './config.js'
import { GenerationQueue } from './queue.js'
import { Sessions } from './sessions.js'
import { mountResponse } from './security.js'
import { testHostedConfig } from '../testing/hosted.js'

let root: string
let t: TestContext
let opts: HostedAppOptions
let cookie: string
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'hosted-app-'))
  t = await makeTestContext()
  const config = testHostedConfig(root)
  const sessions = new Sessions(root, config.sessionKey)
  cookie = `__Host-pr-review=${await sessions.create({ userId: 1, login: 'alice', token: 'user-token', expires: Date.now() + 100_000 })}`
  const queue = new GenerationQueue(root)
  await queue.load()
  opts = {
    config,
    sessions,
    queue,
    log: vi.fn(),
    repositories: { forUser: vi.fn(async () => t.ctx) },
    github: {
      exchangeCode: vi.fn(async () => ({ token: 'new-token', expiresIn: 3600 })),
      request: vi.fn(async () => ({ id: 1, login: 'alice' })),
      userCanRead: vi.fn(async () => true),
      installationToken: vi.fn(async () => 'installation-token'),
    },
  }
})
afterEach(async () => {
  await t.cleanup()
  await rm(root, { recursive: true, force: true })
})
function req(route: string, init: RequestInit = {}, signedIn = true) {
  return createHostedApp(opts).request(`https://canvas.example.com${route}`, {
    ...init,
    headers: { host: 'canvas.example.com', ...(signedIn ? { cookie } : {}), ...init.headers },
  })
}

it('offers sign-in, protects all repository routes and rejects unrecognized hosts', async () => {
  expect((await req('/', {}, false)).headers.get('location')).toBe('/login')
  expect(await (await req('/login', {}, false)).text()).toContain('Sign in with GitHub')
  const canvas = await req('/repos/acme/widgets/review/42', {}, false)
  expect(canvas.status).toBe(302)
  expect(canvas.headers.get('location')).toBe('/login?next=%2Frepos%2Facme%2Fwidgets%2Freview%2F42')
  for (const route of [
    '/repos/acme/widgets/api/prs',
    '/repos/acme/widgets/static/js/api.js',
    '/repos/acme/widgets/vendor/diff/index.js',
    '/jobs/retry',
  ]) {
    expect((await req(route, {}, false)).status).toBe(401)
  }
  expect((await req('/healthz')).status).toBe(200)
  expect((await req('/', { headers: { host: 'evil.example' } })).status).toBe(403)
  expect((await req('/repos/other/widgets/review/42')).status).toBe(404)
  expect((await req('/repos/acme/../review/42')).status).toBe(404)
  expect(opts.repositories.forUser).not.toHaveBeenCalled()
})

it('checks each collaborator repository access before creating a repository context', async () => {
  opts.github.userCanRead = vi.fn(async () => false)
  expect((await req('/repos/acme/widgets/review/42')).status).toBe(404)
  expect(opts.repositories.forUser).not.toHaveBeenCalled()
  expect(opts.github.installationToken).not.toHaveBeenCalled()
})

it('mounts canvas pages, modules, redirects and POST bodies in the repository URL', async () => {
  const response = await req('/repos/acme/widgets/review/42')
  expect(response.status).toBe(200)
  const body = await response.text()
  expect(body).toContain('src="/repos/acme/widgets/static/js/app.js"')
  expect(body).toContain('"/repos/acme/widgets/vendor/diff/index.js"')
  expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
  const nonce = /nonce="([^"]+)"/.exec(body)?.[1]
  expect(nonce).toBeTruthy()
  expect(response.headers.get('content-security-policy')).toContain(`'nonce-${nonce}'`)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('referrer-policy')).toBe('same-origin')
  const redirect = await req('/repos/acme/widgets/review?n=42')
  expect(redirect.headers.get('location')).toBe('/repos/acme/widgets/review/42')
  const setting = await req('/repos/acme/widgets/api/appearance', {
    method: 'PUT',
    headers: { origin: opts.config.origin, 'content-type': 'application/json' },
    body: JSON.stringify({ theme: 'dark', skin: 'github' }),
  })
  expect(setting.status).toBe(200)
  expect((await t.ctx.settings.read()).theme).toBe('dark')
  expect((await req('/repos/acme/widgets/static/js/api.js')).status).toBe(200)
  expect((await req('/repos/acme/widgets/api/health')).status).toBe(404)
  expect((await req('/repos/acme/widgets/review/branch')).status).toBe(404)
  expect((await req('/repos/acme/widgets/api/prs/uncommitted')).status).toBe(404)
})

it('rejects cross-site writes including logout, even with a valid session', async () => {
  for (const headers of [
    {},
    { origin: 'https://evil.example' },
    { origin: opts.config.origin, 'sec-fetch-site': 'cross-site' },
  ]) {
    expect((await req('/auth/logout', { method: 'POST', headers })).status).toBe(403)
  }
  expect(
    (
      await req('/auth/logout', {
        method: 'POST',
        headers: { origin: opts.config.origin, 'sec-fetch-site': 'same-origin' },
      })
    ).status
  ).toBe(303)
  expect((await req('/')).headers.get('location')).toBe('/login')
})

it('binds OAuth to a browser cookie and saves an encrypted expiring session', async () => {
  const returnTo = '/repos/acme/widgets/review/42'
  const login = await req(`/auth/login?next=${encodeURIComponent(returnTo)}`, {}, false)
  const location = new URL(login.headers.get('location') ?? '')
  const state = location.searchParams.get('state') ?? ''
  expect(location.origin).toBe('https://github.com')
  expect(location.searchParams.get('redirect_uri')).toBe(`${opts.config.origin}/auth/callback`)
  expect(login.headers.get('set-cookie')).toContain('Secure')
  expect(login.headers.get('set-cookie')).toContain('HttpOnly')
  expect(login.headers.get('set-cookie')).toContain('SameSite=Lax')
  expect(location.searchParams.get('code_challenge_method')).toBe('S256')
  const stateCookie = `__Host-pr-review-oauth=${state}`
  const callback = await req(
    `/auth/callback?state=${state}&code=test-code`,
    { headers: { cookie: `${stateCookie}; ${cookie}` } },
    false
  )
  expect(callback.status).toBe(302)
  expect(callback.headers.get('referrer-policy')).toBe('no-referrer')
  const calls = vi.mocked(opts.github.exchangeCode).mock.calls
  const verifier = calls[0]?.[1] ?? ''
  expect(calls[0]?.[0]).toBe('test-code')
  expect(createHash('sha256').update(verifier).digest('base64url')).toBe(
    location.searchParams.get('code_challenge')
  )
  expect(callback.headers.get('location')).toBe(returnTo)
  const id = /__Host-pr-review=([a-f0-9]{64})/.exec(callback.headers.get('set-cookie') ?? '')?.[1]
  expect((await opts.sessions.read(id))?.login).toBe('alice')
  expect(await opts.sessions.read(cookie.split('=')[1])).toBeNull()
  expect((await req(`/auth/callback?state=${state}&code=stolen`, {}, false)).status).toBe(403)
  expect(
    (await req(`/auth/callback?state=${state}&code=replay`, { headers: { cookie: stateCookie } }, false))
      .status
  ).toBe(403)
  const fresh = new URL((await req('/auth/login', {}, false)).headers.get('location') ?? '')
  const freshState = fresh.searchParams.get('state') ?? ''
  expect(
    (
      await req(
        `/auth/callback?state=${freshState}`,
        { headers: { cookie: `__Host-pr-review-oauth=${freshState}` } },
        false
      )
    ).status
  ).toBe(400)
})

it('rejects a forged callback even when the cookie matches, and never exposes provider error details', async () => {
  const state = 'a'.repeat(64)
  const forged = await req(
    `/auth/callback?state=${state}&code=forged`,
    { headers: { cookie: `__Host-pr-review-oauth=${state}` } },
    false
  )
  expect(forged.status).toBe(403)
  expect(opts.github.exchangeCode).not.toHaveBeenCalled()
  const login = new URL((await req('/auth/login', {}, false)).headers.get('location') ?? '')
  const realState = login.searchParams.get('state') ?? ''
  opts.github.exchangeCode = vi.fn(async () => {
    throw new Error('secret provider error')
  })
  const failed = await req(
    `/auth/callback?state=${realState}&code=valid`,
    { headers: { cookie: `__Host-pr-review-oauth=${realState}` } },
    false
  )
  expect(failed.status).toBe(500)
  expect(await failed.text()).not.toContain('secret provider error')
  expect((await req('/', {}, false)).headers.get('location')).toBe('/login')
})

it('redirects authenticated users from the login page and rejects expired or forged sessions', async () => {
  expect((await req('/login?next=%2Frepos%2Facme%2Fwidgets%2Freview%2F42')).headers.get('location')).toBe(
    '/repos/acme/widgets/review/42'
  )
  const expired = await opts.sessions.create({ userId: 1, login: 'alice', token: 'old-token', expires: 0 })
  for (const id of [expired, 'f'.repeat(64), '../escape']) {
    const response = await req('/repos/acme/widgets/api/prs', {
      headers: { cookie: `__Host-pr-review=${id}` },
    })
    expect(response.status).toBe(401)
  }
  expect(opts.repositories.forUser).not.toHaveBeenCalled()
})

it('lets browser users retry a cancelled or invalid sign-in without exposing callback details', async () => {
  const response = await req(
    '/auth/callback?error=access_denied',
    { headers: { accept: 'text/html' } },
    false
  )
  expect(response.status).toBe(403)
  expect(await response.text()).toContain('Sign-in could not be completed. Please try again.')
  expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
  expect(opts.github.exchangeCode).not.toHaveBeenCalled()
})

it('lists only authorized jobs, exposes status and retries failed jobs with repository authorization', async () => {
  const input = { owner: 'acme', repo: 'widgets', number: 42, headSha: 'a'.repeat(40) }
  const job = await opts.queue.enqueue(input)
  for (let i = 0; i < 3; i += 1) {
    await opts.queue.fail(job.id, 'failure')
    await opts.queue.retry(job.id)
  }
  // Persist a terminal failure without waiting for backoff.
  const jobs = await opts.queue.list()
  const { writeJsonAtomic } = await import('../store/atomic-json.js')
  jobs[0]!.status = 'failed'
  await writeJsonAtomic(path.join(root, 'jobs.json'), jobs)
  await opts.queue.load()
  await opts.queue.enqueue({ ...input, repo: 'hidden' })
  opts.github.userCanRead = vi.fn(async (_token, _owner, repo) => repo !== 'hidden')
  const home = await (await req('/')).text()
  expect(home).toContain('widgets #42')
  expect(home).toContain('Retry generation')
  expect(home).not.toContain('acme/hidden')
  const retry = await req('/jobs/retry', {
    method: 'POST',
    headers: { origin: opts.config.origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id: job.id }),
  })
  expect(retry.status).toBe(303)
  expect((await opts.queue.list())[0]?.status).toBe('queued')
  expect((await req('/jobs/retry', { method: 'POST', headers: { origin: opts.config.origin } })).status).toBe(
    404
  )
})

it('acknowledges signed webhooks without requiring browser login', async () => {
  const body = '{}'
  const response = await req(
    '/webhooks/github',
    {
      method: 'POST',
      body,
      headers: {
        'x-github-event': 'ping',
        'x-hub-signature-256': `sha256=${createHmac('sha256', opts.config.webhookSecret).update(body).digest('hex')}`,
      },
    },
    false
  )
  expect(response.status).toBe(202)
  expect(await response.json()).toEqual({ accepted: true, queued: false })
})

it('preserves non-HTML streams and external redirects', async () => {
  const response = await mountResponse(
    new Response('event: token\n', { headers: { 'content-type': 'text/event-stream' } }),
    '/repos/acme/widgets'
  )
  expect(await response.text()).toBe('event: token\n')
  const redirect = await mountResponse(
    new Response(null, { status: 302, headers: { location: 'https://github.com' } }),
    '/repos/acme/widgets'
  )
  expect(redirect.headers.get('location')).toBe('https://github.com')
})

it('validates hosted configuration without weakening the localhost configuration', () => {
  const base = {
    PR_REVIEW_PUBLIC_URL: 'https://canvas.example.com',
    GITHUB_ORGANIZATION: 'acme',
    GITHUB_APP_ID: '123',
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'secret',
    GITHUB_APP_PRIVATE_KEY: 'key\\nline',
    GITHUB_WEBHOOK_SECRET: 's'.repeat(32),
    PR_REVIEW_SESSION_KEY: 'f'.repeat(64),
  }
  expect(hostedConfig(base)).toMatchObject({ port: 10000, privateKey: 'key\nline' })
  for (const url of [
    'http://canvas.example.com',
    'https://canvas.example.com/path',
    'https://user@canvas.example.com',
    'https://canvas.example.com/?q=1',
    'https://canvas.example.com/#hash',
  ]) {
    expect(() => hostedConfig({ ...base, PR_REVIEW_PUBLIC_URL: url })).toThrow()
  }
})
