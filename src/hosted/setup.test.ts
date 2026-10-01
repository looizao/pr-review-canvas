import { createSetupApp, missingHostedEnvironment } from './setup.js'

it('reports a live bootstrap process while rejecting all application requests', async () => {
  const app = createSetupApp()
  const health = await app.request('http://internal/healthz')
  expect(await health.json()).toEqual({ ok: true, ready: false, status: 'awaiting_configuration' })
  const home = await app.request('https://canvas.example/')
  expect(home.status).toBe(503)
  expect(await home.text()).toContain('Canvas access is locked.')
  expect(home.headers.get('content-security-policy')).toContain("default-src 'none'")
  expect(home.headers.get('cache-control')).toBe('no-store')
  for (const route of ['/auth/login', '/repos/acme/repo/api/prs', '/webhooks/github']) {
    const response = await app.request(`https://canvas.example${route}`, { method: 'POST' })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: { code: 'SERVICE_NOT_CONFIGURED', message: 'Awaiting configuration' },
    })
  }
})

it('requires every authentication input without returning values', () => {
  const missing = missingHostedEnvironment({ GITHUB_APP_PRIVATE_KEY: 'private key' })
  expect(missing).toContain('GITHUB_CLIENT_SECRET')
  expect(missing).not.toContain('CLAUDE_CODE_OAUTH_TOKEN')
  expect(missing).not.toContain('GITHUB_APP_PRIVATE_KEY')
  expect(missing).not.toContain('private key')
})
