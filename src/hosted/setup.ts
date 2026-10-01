import { Hono } from 'hono'
import { applyResponseHeaders, createNonce } from '../server/security.js'
import { loginPage } from './auth.js'

const required = [
  'PR_REVIEW_PUBLIC_URL',
  'GITHUB_ORGANIZATION',
  'GITHUB_APP_ID',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_WEBHOOK_SECRET',
  'PR_REVIEW_SESSION_KEY',
] as const

export function missingHostedEnvironment(env: NodeJS.ProcessEnv): string[] {
  return required.filter(key => !env[key]?.trim())
}

/** An explicitly enabled bootstrap deployment exposes no repository routes or credentials. */
export function createSetupApp(organization = 'Your team'): Hono {
  const app = new Hono()
  app.use('*', async (c, next) => {
    await next()
    applyResponseHeaders(c.res, c.req.path, createNonce())
    c.header('cache-control', 'no-store')
    c.header('strict-transport-security', 'max-age=31536000')
  })
  app.get('/healthz', c => c.json({ ok: true, ready: false, status: 'awaiting_configuration' }))
  app.get('/', c => c.html(loginPage(organization, '/', false), 503))
  app.get('/login', c => c.html(loginPage(organization, '/', false), 503))
  app.all('*', c =>
    c.json({ error: { code: 'SERVICE_NOT_CONFIGURED', message: 'Awaiting configuration' } }, 503)
  )
  return app
}
