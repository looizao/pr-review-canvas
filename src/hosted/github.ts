import { createSign } from 'node:crypto'
import { z } from 'zod'
import { createHostClient, execCli, GH_CLI, type HostClient } from '../host/client.js'
import type { HostedConfig } from './config.js'

const TokenSchema = z.object({ token: z.string(), expires_at: z.string() })
export const RepositorySchema = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .refine(name => name !== '.' && name !== '..'),
  owner: z.object({ login: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/) }),
})
export type Repository = z.infer<typeof RepositorySchema>

export class GithubApiError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`GitHub returned HTTP ${status}`)
    this.status = status
  }
}

export function appJwt(appId: string, privateKey: string, now = Date.now()): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iat: Math.floor(now / 1000) - 60,
    exp: Math.floor(now / 1000) + 540,
    iss: appId,
  })}`
  const signature = createSign('RSA-SHA256').update(payload).sign(privateKey).toString('base64url')
  return `${payload}.${signature}`
}

export function tokenClient(token: () => Promise<string>): HostClient {
  return createHostClient(GH_CLI, async (args, options) =>
    execCli(args, { ...options, env: { ...options?.env, GH_TOKEN: await token(), GH_HOST: 'github.com' } })
  )
}

/** Credentials reach git's child environment, never its argv or on-disk remote URL. */
export function gitCredentials(token: string): Record<string, string> {
  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
    GIT_CONFIG_KEY_1: 'core.hooksPath',
    GIT_CONFIG_VALUE_1: '/dev/null',
  }
}

export class GithubApp {
  private readonly tokens = new Map<string, { token: string; expires: number }>()

  private readonly config: HostedConfig
  private readonly fetchImpl: typeof fetch
  constructor(config: HostedConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config
    this.fetchImpl = fetchImpl
  }

  async request(token: string, endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`https://api.github.com/${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new GithubApiError(response.status)
    return response.status === 204 ? null : response.json()
  }

  private jwt(): string {
    return appJwt(this.config.appId, this.config.privateKey)
  }

  async installationToken(owner: string, repo: string): Promise<string> {
    const key = `${owner}/${repo}`.toLowerCase()
    const cached = this.tokens.get(key)
    if (cached !== undefined && cached.expires > Date.now() + 60_000) return cached.token
    const installation = z
      .object({ id: z.number() })
      .parse(await this.request(this.jwt(), `repos/${owner}/${repo}/installation`))
    const result = TokenSchema.parse(
      await this.request(this.jwt(), `app/installations/${installation.id}/access_tokens`, 'POST', {
        repositories: [repo],
      })
    )
    this.tokens.set(key, { token: result.token, expires: Date.parse(result.expires_at) })
    return result.token
  }

  async repositories(): Promise<Repository[]> {
    const installation = z
      .object({ id: z.number() })
      .parse(await this.request(this.jwt(), `orgs/${this.config.organization}/installation`))
    const { token } = TokenSchema.parse(
      await this.request(this.jwt(), `app/installations/${installation.id}/access_tokens`, 'POST')
    )
    const repositories: Repository[] = []
    for (let page = 1; ; page += 1) {
      const result = z
        .object({ repositories: z.array(RepositorySchema) })
        .parse(await this.request(token, `installation/repositories?per_page=100&page=${page}`))
      repositories.push(
        ...result.repositories.filter(
          repo => repo.owner.login.toLowerCase() === this.config.organization.toLowerCase()
        )
      )
      if (result.repositories.length < 100) return repositories
    }
  }

  async userCanRead(token: string, owner: string, repo: string): Promise<boolean> {
    try {
      const result = z
        .object({ permissions: z.object({ pull: z.boolean() }) })
        .parse(await this.request(token, `repos/${owner}/${repo}`))
      return result.permissions.pull
    } catch (error) {
      if (error instanceof GithubApiError && [401, 403, 404].includes(error.status)) return false
      throw error
    }
  }

  async exchangeCode(code: string, verifier: string): Promise<{ token: string; expiresIn: number }> {
    const response = await this.fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: `${this.config.origin}/auth/callback`,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new GithubApiError(response.status)
    const result = z
      .object({ access_token: z.string().min(1), expires_in: z.number().int().positive().optional() })
      .parse(await response.json())
    return { token: result.access_token, expiresIn: Math.min(result.expires_in ?? 28_800, 28_800) }
  }
}
