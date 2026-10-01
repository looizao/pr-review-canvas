import { createVerify, generateKeyPairSync } from 'node:crypto'
import { GithubApp, GithubApiError, appJwt, gitCredentials, RepositorySchema } from './github.js'
import { testHostedConfig } from '../testing/hosted.js'

const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()
function setup(responses: Array<{ status?: number; body: unknown }>) {
  const fetchImpl = vi.fn(async () => {
    const next = responses.shift()
    if (next === undefined) throw new Error('unexpected request')
    return Response.json(next.body, { status: next.status ?? 200 })
  })
  const app = new GithubApp({ ...testHostedConfig('/tmp/data'), privateKey }, fetchImpl)
  return { app, fetchImpl }
}
const tokenResponse = {
  token: 'installation-token',
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
}

it('signs short-lived GitHub App JWTs with RS256', () => {
  const jwt = appJwt('123', privateKey, 1000 * 1000)
  const [header, body, signature] = jwt.split('.')
  expect(JSON.parse(Buffer.from(header ?? '', 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
  expect(JSON.parse(Buffer.from(body ?? '', 'base64url').toString())).toEqual({
    iat: 940,
    exp: 1540,
    iss: '123',
  })
  expect(
    createVerify('RSA-SHA256')
      .update(`${header}.${body}`)
      .verify(privateKey, Buffer.from(signature ?? '', 'base64url'))
  ).toBe(true)
})

it('issues and caches a token restricted to the requested repository', async () => {
  const { app, fetchImpl } = setup([{ body: { id: 1 } }, { body: tokenResponse }])
  expect(await app.installationToken('acme', 'widgets')).toBe('installation-token')
  expect(await app.installationToken('Acme', 'Widgets')).toBe('installation-token')
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][]
  expect(calls[1]?.[0]).toContain('app/installations/1/access_tokens')
  expect(JSON.parse(String(calls[1]?.[1].body))).toEqual({ repositories: ['widgets'] })
})

it('refreshes expiring installation tokens', async () => {
  const { app, fetchImpl } = setup([
    { body: { id: 1 } },
    { body: { ...tokenResponse, expires_at: new Date().toISOString() } },
    { body: { id: 1 } },
    { body: tokenResponse },
  ])
  await app.installationToken('acme', 'widgets')
  await app.installationToken('acme', 'widgets')
  expect(fetchImpl).toHaveBeenCalledTimes(4)
})

it('discovers installed repositories with pagination and organization filtering', async () => {
  const repos = Array.from({ length: 100 }, (_, i) => ({ name: `repo-${i}`, owner: { login: 'acme' } }))
  const { app, fetchImpl } = setup([
    { body: { id: 1 } },
    { body: tokenResponse },
    { body: { repositories: repos } },
    { body: { repositories: [{ name: 'hidden', owner: { login: 'other' } }] } },
  ])
  expect(await app.repositories()).toEqual(repos)
  const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][]
  expect(calls[3]?.[0]).toContain('page=2')
})

it.each([401, 403, 404])('fails closed on repository access HTTP %i', async status => {
  const { app } = setup([{ status, body: {} }])
  expect(await app.userCanRead('user-token', 'acme', 'widgets')).toBe(false)
})

it('requires actual pull permission and propagates unexpected infrastructure failures', async () => {
  const { app } = setup([
    { body: { permissions: { pull: true } } },
    { body: { permissions: { pull: false } } },
    { status: 500, body: {} },
  ])
  expect(await app.userCanRead('user-token', 'acme', 'widgets')).toBe(true)
  expect(await app.userCanRead('user-token', 'acme', 'widgets')).toBe(false)
  await expect(app.userCanRead('user-token', 'acme', 'widgets')).rejects.toBeInstanceOf(GithubApiError)
})

it('exchanges GitHub App OAuth codes and limits session duration', async () => {
  const { app, fetchImpl } = setup([
    { body: { access_token: 'user-token', expires_in: 3600 } },
    { body: { access_token: 'user-token' } },
    { status: 400, body: {} },
  ])
  expect(await app.exchangeCode('test-code', 'verifier')).toEqual({ token: 'user-token', expiresIn: 3600 })
  expect(await app.exchangeCode('test-code', 'verifier')).toEqual({ token: 'user-token', expiresIn: 28_800 })
  await expect(app.exchangeCode('bad-code', 'verifier')).rejects.toThrow('HTTP 400')
  const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][]
  expect(JSON.parse(String(calls[0]?.[1].body))).toMatchObject({
    code: 'test-code',
    code_verifier: 'verifier',
    redirect_uri: 'https://canvas.example.com/auth/callback',
  })
})

it('places Git credentials only in the child environment, with hooks disabled', () => {
  const credentials = gitCredentials('secret-token')
  expect(credentials['GIT_CONFIG_KEY_0']).toBe('http.https://github.com/.extraheader')
  expect(credentials['GIT_CONFIG_VALUE_0']).toBe(
    `Authorization: Basic ${Buffer.from('x-access-token:secret-token').toString('base64')}`
  )
  expect(credentials['GIT_CONFIG_VALUE_1']).toBe('/dev/null')
  expect(RepositorySchema.safeParse({ name: '..', owner: { login: 'acme' } }).success).toBe(false)
})
