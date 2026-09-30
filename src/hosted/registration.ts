import { randomBytes, timingSafeEqual } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { Hono } from 'hono'
import { html } from 'hono/html'
import { z } from 'zod'

export interface RegistrationOptions {
  origin: string
  organization: string
  callbackOrigin: string
  output: string
  manifest: Record<string, unknown>
  fetchImpl?: typeof fetch
  completed: (installationUrl: string) => void
}

/** A loopback-only manifest handshake keeps bootstrap credentials off the hosted app. */
export function createRegistrationApp(opts: RegistrationOptions): { app: Hono; url: string } {
  const state = randomBytes(32).toString('hex')
  const app = new Hono()
  let exchanged = false
  const manifest = {
    ...opts.manifest,
    url: opts.origin,
    hook_attributes: { url: `${opts.origin}/webhooks/github`, active: true },
    callback_urls: [`${opts.origin}/auth/callback`],
    redirect_url: `${opts.callbackOrigin}/callback`,
  }
  app.use('*', async (c, next) => {
    c.header('cache-control', 'no-store')
    c.header('referrer-policy', 'no-referrer')
    c.header('x-content-type-options', 'nosniff')
    if (c.req.header('host') !== new URL(opts.callbackOrigin).host) return c.text('Forbidden', 403)
    const given = c.req.query('state') ?? ''
    if (given.length !== state.length || !timingSafeEqual(Buffer.from(given), Buffer.from(state)))
      return c.text('Forbidden', 403)
    await next()
    return undefined
  })
  app.get('/', c =>
    c.html(
      html`<!doctype html><html lang="en"><title>Register PR Review Canvas</title><h1>Register PR Review Canvas</h1><form method="post" action="https://github.com/organizations/${opts.organization}/settings/apps/new?state=${state}"><input type="hidden" name="manifest" value="${JSON.stringify(manifest)}"><button>Register GitHub App for ${opts.organization}</button></form></html>`
    )
  )
  app.get('/callback', async c => {
    const code = c.req.query('code')
    if (exchanged || !code || !/^[a-zA-Z0-9_-]+$/.test(code))
      return c.text('Invalid or already used registration code', 400)
    exchanged = true
    const response = await (opts.fetchImpl ?? fetch)(
      `https://api.github.com/app-manifests/${code}/conversions`,
      {
        method: 'POST',
        headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
        signal: AbortSignal.timeout(30_000),
      }
    )
    if (!response.ok) throw new Error('GitHub App registration exchange failed')
    const result = z
      .object({
        id: z.number(),
        client_id: z.string(),
        client_secret: z.string(),
        pem: z.string(),
        webhook_secret: z.string(),
        html_url: z.url(),
      })
      .parse(await response.json())
    const values = {
      PR_REVIEW_PUBLIC_URL: opts.origin,
      GITHUB_ORGANIZATION: opts.organization,
      GITHUB_APP_ID: String(result.id),
      GITHUB_CLIENT_ID: result.client_id,
      GITHUB_CLIENT_SECRET: result.client_secret,
      GITHUB_APP_PRIVATE_KEY: result.pem,
      GITHUB_WEBHOOK_SECRET: result.webhook_secret,
      PR_REVIEW_SESSION_KEY: randomBytes(32).toString('hex'),
    }
    // Node --env-file understands quoted strings. Existing files are never overwritten.
    await writeFile(
      opts.output,
      Object.entries(values)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join('\n') + '\n',
      { mode: 0o600, flag: 'wx' }
    )
    const installationUrl = `${result.html_url}/installations/new`
    opts.completed(installationUrl)
    return c.html(
      html`<!doctype html><html lang="en"><title>GitHub App registered</title><h1>GitHub App registered</h1><p>Credentials saved to the local configuration file. Add them to Render and configure the Claude credential.</p><a href="${installationUrl}">Install on ${opts.organization} repositories</a></html>`
    )
  })
  app.onError((_error, c) =>
    c.text(
      'Registration failed. No credentials are displayed here; inspect the local output file before retrying.',
      500
    )
  )
  return { app, url: `${opts.callbackOrigin}/?state=${state}` }
}
