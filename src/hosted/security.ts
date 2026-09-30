import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../server/env.js'
import { AppError } from '../server/errors.js'

export function hostedSecurity(origin: string): MiddlewareHandler<AppEnv> {
  const host = new URL(origin).host.toLowerCase()
  return async (c, next) => {
    if (c.req.header('host')?.toLowerCase() !== host) {
      throw new AppError('FORBIDDEN_HOST', 'unrecognized service hostname', 403)
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.path !== '/webhooks/github') {
      const site = c.req.header('sec-fetch-site')
      if (
        c.req.header('origin') !== origin ||
        (site !== undefined && site !== 'same-origin' && site !== 'none')
      ) {
        throw new AppError('CROSS_ORIGIN', 'cross-origin request rejected', 403)
      }
    }
    await next()
  }
}

/** Keep the canvas's existing routes and assets inside the selected repository mount. */
export async function mountResponse(response: Response, prefix: string): Promise<Response> {
  const headers = new Headers(response.headers)
  const location = headers.get('location')
  if (location?.startsWith('/') && !location.startsWith('//')) headers.set('location', `${prefix}${location}`)
  headers.set('cache-control', 'no-store')
  if (!headers.get('content-type')?.startsWith('text/html')) {
    return new Response(response.body, { status: response.status, headers })
  }
  const text = (await response.text())
    .replace(/\b(href|src|action)="\/(?!\/)/g, `$1="${prefix}/`)
    .replace(/"\/vendor\//g, `"${prefix}/vendor/`)
  headers.delete('content-length')
  return new Response(text, { status: response.status, headers })
}
