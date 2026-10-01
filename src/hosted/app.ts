import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { html } from 'hono/html'
import { z } from 'zod'
import { createApp } from '../server/app.js'
import type { AppContext } from '../server/context.js'
import type { AppEnv } from '../server/env.js'
import { AppError, toAppError } from '../server/errors.js'
import { applyResponseHeaders, createNonce } from '../server/security.js'
import type { HostedConfig } from './config.js'
import type { GithubApp } from './github.js'
import { JobInputSchema, jobId, type GenerationQueue } from './queue.js'
import { hostedSecurity, mountResponse } from './security.js'
import type { Session, Sessions } from './sessions.js'
import { receiveWebhook } from './webhook.js'
import { canvasReturnPath, loginPage } from './auth.js'

const SESSION_COOKIE = '__Host-pr-review'
const STATE_COOKIE = '__Host-pr-review-oauth'
const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const
interface HostedEnv extends AppEnv {
  Variables: AppEnv['Variables'] & { session: Session }
}

export interface HostedAppOptions {
  config: HostedConfig
  github: Pick<GithubApp, 'exchangeCode' | 'request' | 'userCanRead' | 'installationToken'>
  sessions: Sessions
  queue: GenerationQueue
  repositories: { forUser(owner: string, repo: string, session: Session): Promise<AppContext> }
  log: (line: string) => void
}

export function createHostedApp(opts: HostedAppOptions): Hono<HostedEnv> {
  const { config, github, sessions, queue, repositories } = opts
  const app = new Hono<HostedEnv>()
  const access = new Map<string, number>()
  app.use('*', async (c, next) => {
    c.set('cspNonce', createNonce())
    await next()
    if (!c.res.headers.has('content-security-policy')) {
      applyResponseHeaders(c.res, c.req.path, c.get('cspNonce'))
    }
    c.header('cache-control', 'no-store')
    c.header('strict-transport-security', 'max-age=31536000')
    // Keep canvas URLs off other sites while preserving Origin on same-origin form POSTs.
    c.header('referrer-policy', c.req.path.startsWith('/auth/') ? 'no-referrer' : 'same-origin')
  })
  // Render's health probe can use an internal hostname; this exposes no repository data.
  app.get('/healthz', c => c.json({ ok: true }))
  app.use('*', hostedSecurity(config.origin))
  app.onError((error, c) => {
    const err = toAppError(error)
    // Avoid logging request bodies, OAuth codes, user tokens, or CLI stderr.
    opts.log(`hosted request failed: ${c.req.method} ${c.req.path} ${err.code}`)
    if (c.req.path === '/auth/callback' && c.req.header('accept')?.includes('text/html')) {
      return c.html(loginPage(config.organization, '/', true, true), err.status)
    }
    const response = c.json(
      err.status >= 500
        ? { error: { code: 'INTERNAL', message: 'Request failed. Please try again.' } }
        : err.toEnvelope(),
      err.status
    )
    applyResponseHeaders(response, '/api/', c.get('cspNonce'))
    return response
  })

  app.post('/webhooks/github', async c => {
    const queued = await receiveWebhook(c.req.raw, {
      secret: config.webhookSecret,
      organization: config.organization,
      queue,
    })
    return c.json({ accepted: true, queued }, 202)
  })

  app.get('/login', async c => {
    const returnTo = canvasReturnPath(c.req.query('next'), config.origin)
    if (await sessions.read(getCookie(c, SESSION_COOKIE))) return c.redirect(returnTo)
    return c.html(loginPage(config.organization, returnTo))
  })

  app.get('/auth/login', c => {
    const attempt = sessions.logins.begin(canvasReturnPath(c.req.query('next'), config.origin))
    if (attempt === null) {
      c.header('retry-after', '600')
      throw new AppError('BAD_REQUEST', 'Too many sign-in attempts. Please try again shortly.', 429)
    }
    const { state, challenge } = attempt
    setCookie(c, STATE_COOKIE, state, { ...COOKIE_OPTIONS, maxAge: 600 })
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('redirect_uri', `${config.origin}/auth/callback`)
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('allow_signup', 'false')
    return c.redirect(url.href)
  })

  app.get('/auth/callback', async c => {
    const state = c.req.query('state') ?? ''
    const expected = getCookie(c, STATE_COOKIE) ?? ''
    deleteCookie(c, STATE_COOKIE, COOKIE_OPTIONS)
    if (
      !/^[a-f0-9]{64}$/.test(state) ||
      expected.length !== state.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
    ) {
      throw new AppError('CROSS_ORIGIN', 'invalid sign-in state', 403)
    }
    const attempt = sessions.logins.consume(state)
    if (attempt === null) throw new AppError('CROSS_ORIGIN', 'expired or already used sign-in state', 403)
    const code = c.req.query('code')
    if (!code) throw new AppError('BAD_REQUEST', 'missing GitHub authorization code', 400)
    const { token, expiresIn } = await github.exchangeCode(code, attempt.verifier)
    const user = z
      .object({ id: z.number().int().positive(), login: z.string() })
      .parse(await github.request(token, 'user'))
    const id = await sessions.create({
      userId: user.id,
      login: user.login,
      token,
      expires: Date.now() + expiresIn * 1000,
    })
    await sessions.remove(getCookie(c, SESSION_COOKIE))
    setCookie(c, SESSION_COOKIE, id, { ...COOKIE_OPTIONS, maxAge: expiresIn })
    return c.redirect(attempt.returnTo)
  })

  app.post('/auth/logout', async c => {
    await sessions.remove(getCookie(c, SESSION_COOKIE))
    deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS)
    return c.redirect('/login', 303)
  })

  app.use('*', async (c, next) => {
    const session = await sessions.read(getCookie(c, SESSION_COOKIE))
    if (session === null) {
      if (c.req.path === '/') return c.redirect('/login')
      if (['GET', 'HEAD'].includes(c.req.method) && /^\/repos\/[^/]+\/[^/]+\/review(?:\/|$)/.test(c.req.path))
        return c.redirect(
          `/login?next=${encodeURIComponent(canvasReturnPath(new URL(c.req.url).pathname + new URL(c.req.url).search, config.origin))}`
        )
      return c.json({ error: { code: 'GH_UNAUTHENTICATED', message: 'sign in with GitHub at /login' } }, 401)
    }
    c.set('session', session)
    await next()
    return undefined
  })

  async function authorize(session: Session, owner: string, repo: string): Promise<void> {
    const parsed = JobInputSchema.pick({ owner: true, repo: true }).safeParse({ owner, repo })
    if (!parsed.success || owner.toLowerCase() !== config.organization.toLowerCase()) {
      throw new AppError('NOT_FOUND', 'repository not found', 404)
    }
    // The GitHub App user token is constrained by BOTH installation and user access.
    const key = `${session.userId}/${session.expires}/${owner}/${repo}`.toLowerCase()
    if ((access.get(key) ?? 0) > Date.now()) return
    if (!(await github.userCanRead(session.token, owner, repo)))
      throw new AppError('NOT_FOUND', 'repository not found', 404)
    await github.installationToken(owner, repo)
    access.set(key, Date.now() + 30_000)
  }

  app.get('/', async c => {
    const session = c.get('session')
    const visible = []
    const readable = new Map<string, boolean>()
    for (const job of (await queue.list()).sort((a, b) => b.updatedAt - a.updatedAt)) {
      const key = `${job.owner}/${job.repo}`.toLowerCase()
      if (!readable.has(key)) {
        try {
          await authorize(session, job.owner, job.repo)
          readable.set(key, true)
        } catch (error) {
          if (!(error instanceof AppError && error.status === 404)) throw error
          readable.set(key, false)
        }
      }
      if (readable.get(key)) visible.push(job)
    }
    return c.html(
      html`<!doctype html><html lang="en"><title>PR Review Canvas</title><h1>PR Review Canvas</h1><p>${config.organization} · ${session.login}</p><form method="post" action="/auth/logout"><button>Sign out</button></form><ul>${visible.slice(0, 100).map(job => html`<li><a href="/repos/${job.owner}/${job.repo}/review/${job.number}">${job.owner}/${job.repo} #${job.number}</a> · ${job.headSha.slice(0, 7)} · ${job.status}${job.status === 'failed' ? html`<form method="post" action="/jobs/retry"><input type="hidden" name="id" value="${job.id}"><button>Retry generation</button></form>` : ''}</li>`)}</ul>${visible.length === 0 ? html`<p>No pull requests yet. Install the GitHub App on your repositories to start watching them.</p>` : ''}</html>`
    )
  })

  app.post('/jobs/retry', async c => {
    const body = await c.req.parseBody()
    const id = typeof body['id'] === 'string' ? body['id'] : ''
    const job = (await queue.list()).find(candidate => candidate.id === id && jobId(candidate) === id)
    if (job === undefined) throw new AppError('NOT_FOUND', 'generation job not found', 404)
    await authorize(c.get('session'), job.owner, job.repo)
    await queue.retry(id)
    return c.redirect('/', 303)
  })

  app.all('/repos/:owner/:repo/*', async c => {
    const owner = c.req.param('owner')
    const repo = c.req.param('repo')
    const session = c.get('session')
    await authorize(session, owner, repo)
    const prefix = `/repos/${owner}/${repo}`
    const url = new URL(c.req.url)
    url.pathname = url.pathname.slice(prefix.length) || '/'
    // Local work and machine diagnostics have no meaning on a shared service.
    if (
      /^\/(?:api\/prs|review)\/(?:branch|uncommitted)(?:\/|$)/.test(url.pathname) ||
      url.pathname === '/api/health'
    ) {
      throw new AppError('NOT_FOUND', 'route is unavailable in hosted mode', 404)
    }
    const ctx = await repositories.forUser(owner, repo, session)
    const local = createApp(ctx, async (_c, next) => {
      await next()
    })
    const request = new Request(url, c.req.raw)
    return mountResponse(await local.fetch(request), prefix)
  })
  return app
}
