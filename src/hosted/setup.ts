import { Hono } from 'hono'
import { html } from 'hono/html'
import { applyResponseHeaders, createNonce } from '../server/security.js'

const required = [
  'PR_REVIEW_PUBLIC_URL',
  'GITHUB_ORGANIZATION',
  'GITHUB_APP_ID',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_WEBHOOK_SECRET',
  'PR_REVIEW_SESSION_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
] as const

export function missingHostedEnvironment(env: NodeJS.ProcessEnv): string[] {
  return required.filter(key => !env[key]?.trim())
}

/** An explicitly enabled bootstrap deployment exposes no repository routes or credentials. */
export function createSetupApp(): Hono {
  const app = new Hono()
  app.use('*', async (c, next) => {
    await next()
    applyResponseHeaders(c.res, c.req.path, createNonce())
    c.header('cache-control', 'no-store')
    c.header('strict-transport-security', 'max-age=31536000')
  })
  app.get('/healthz', c => c.json({ ok: true, ready: false, status: 'awaiting_configuration' }))
  app.get('/', c =>
    c.html(
      html`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PR Review Canvas: awaiting configuration</title><h1>PR Review Canvas</h1><h2>Awaiting configuration</h2><p>The server is deployed. GitHub App registration and Claude Code authentication are required before sign-in, PR monitoring, and canvas generation can start.</p></html>`,
      503
    )
  )
  app.all('*', c =>
    c.json({ error: { code: 'SERVICE_NOT_CONFIGURED', message: 'Awaiting configuration' } }, 503)
  )
  return app
}
