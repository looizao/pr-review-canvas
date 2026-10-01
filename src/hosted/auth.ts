import { createHash, randomBytes } from 'node:crypto'
import { html } from 'hono/html'

const LOGIN_TTL_MS = 600_000

export function canvasReturnPath(candidate: string | undefined, origin: string): string {
  if (
    !candidate?.startsWith('/repos/') ||
    candidate.length > 2048 ||
    candidate.includes('\\') ||
    Array.from(candidate).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return '/'
  const url = new URL(candidate, origin)
  return url.origin === origin && url.pathname.startsWith('/repos/') ? `${url.pathname}${url.search}` : '/'
}

/** Short-lived, single-use login attempts stay on this server, including the PKCE verifier. */
export class LoginAttempts {
  private readonly pending = new Map<string, { verifier: string; returnTo: string; expires: number }>()
  private readonly now: () => number
  constructor(now: () => number = Date.now) {
    this.now = now
  }

  begin(returnTo: string): { state: string; challenge: string } | null {
    for (const [state, login] of this.pending) {
      if (login.expires <= this.now()) this.pending.delete(state)
    }
    if (this.pending.size >= 1000) return null
    const state = randomBytes(32).toString('hex')
    const verifier = randomBytes(32).toString('base64url')
    this.pending.set(state, { verifier, returnTo, expires: this.now() + LOGIN_TTL_MS })
    return { state, challenge: createHash('sha256').update(verifier).digest('base64url') }
  }

  consume(state: string): { verifier: string; returnTo: string } | null {
    const login = this.pending.get(state)
    this.pending.delete(state)
    return login !== undefined && login.expires > this.now() ? login : null
  }
}

export function loginPage(organization: string, returnTo: string, available = true, failed = false) {
  const url = `/auth/login${returnTo === '/' ? '' : `?next=${encodeURIComponent(returnTo)}`}`
  return html`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in | PR Review Canvas</title><style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: light-dark(#f4f5f7, #17191e); color: light-dark(#20242b, #e8eaf0); }
    main { margin: 24px; padding: 40px; width: min(380px, calc(100vw - 128px)); border: 1px solid light-dark(#dce0e6, #373c46); border-radius: 16px; background: light-dark(#fff, #22252c); }
    h1 { margin: 0 0 12px; font-size: 26px; }
    p { line-height: 1.6; }
    .organization { color: light-dark(#5a6472, #aeb6c4); }
    a { display: block; margin: 28px 0 20px; padding: 14px; border-radius: 8px; background: light-dark(#20242b, #e8eaf0); color: light-dark(#fff, #20242b); text-align: center; font-weight: 600; text-decoration: none; }
    a:focus-visible { outline: 3px solid #467edb; outline-offset: 4px; }
    .details { font-size: 14px; color: light-dark(#5a6472, #aeb6c4); }
  </style></head><body><main><h1>PR Review Canvas</h1><p class="organization">${organization}</p><p>Sign in before opening a canvas.</p>${failed ? html`<p role="alert">Sign-in could not be completed. Please try again.</p>` : ''}${available ? html`<a href="${url}">Sign in with GitHub</a><p class="details">Your GitHub permissions determine which repositories and canvases you can access.</p>` : html`<p role="status">GitHub sign-in is awaiting configuration. Canvas access is locked.</p>`}</main></body></html>`
}
