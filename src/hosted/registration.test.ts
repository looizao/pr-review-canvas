import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { createRegistrationApp, type RegistrationOptions } from './registration.js'
import { hostedConfig } from './config.js'

let root: string
let opts: RegistrationOptions
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'hosted-registration-'))
  opts = {
    origin: 'https://canvas.example.com',
    organization: 'acme',
    callbackOrigin: 'http://127.0.0.1:3011',
    output: path.join(root, '.env.hosted'),
    manifest: { name: 'Canvas', public: false },
    completed: vi.fn(),
    fetchImpl: vi.fn(async () =>
      Response.json({
        id: 123,
        client_id: 'client',
        client_secret: 'secret',
        pem: 'key\nline\n',
        webhook_secret: 'w'.repeat(32),
        html_url: 'https://github.com/apps/canvas',
      })
    ),
  }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('registers using a loopback CSRF handshake and writes secrets only to a private configuration file', async () => {
  const { app, url } = createRegistrationApp(opts)
  const headers = { host: '127.0.0.1:3011' }
  const html = await (await app.request(url, { headers })).text()
  expect(html).toContain('https://github.com/organizations/acme/settings/apps/new')
  expect(html).toContain('/webhooks/github')
  expect(html).toContain('/auth/callback')
  expect((await app.request(url, { headers: { host: 'evil.example' } })).status).toBe(403)
  expect((await app.request('http://127.0.0.1:3011/?state=forged', { headers })).status).toBe(403)
  const callback = new URL(url)
  callback.pathname = '/callback'
  expect((await app.request(callback, { headers })).status).toBe(400)
  callback.searchParams.set('code', 'manifest-code')
  const response = await app.request(callback, { headers })
  expect(response.status).toBe(200)
  expect(await response.text()).not.toContain('client_secret')
  const environment = parseEnv(await readFile(opts.output, 'utf8'))
  expect(hostedConfig(environment).privateKey).toBe('key\nline\n')
  expect(opts.completed).toHaveBeenCalledWith('https://github.com/apps/canvas/installations/new')
  expect((await app.request(callback, { headers })).status).toBe(400)
})

it('does not display secrets or overwrite existing output when registration fails', async () => {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(opts.output, 'existing credentials')
  const { app, url } = createRegistrationApp(opts)
  const callback = new URL(url)
  callback.pathname = '/callback'
  callback.searchParams.set('code', 'manifest-code')
  const response = await app.request(callback, { headers: { host: '127.0.0.1:3011' } })
  expect(response.status).toBe(500)
  expect(await readFile(opts.output, 'utf8')).toBe('existing credentials')
  const failed = createRegistrationApp({
    ...opts,
    fetchImpl: async () => new Response(null, { status: 500 }),
  })
  const badCallback = new URL(failed.url)
  badCallback.pathname = '/callback'
  badCallback.searchParams.set('code', 'code')
  expect((await failed.app.request(badCallback, { headers: { host: '127.0.0.1:3011' } })).status).toBe(500)
})
