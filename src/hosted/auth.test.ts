import { createHash } from 'node:crypto'
import { canvasReturnPath, LoginAttempts, loginPage } from './auth.js'

it('limits redirects to normalized repository URLs on this service', () => {
  const origin = 'https://canvas.example.com'
  expect(canvasReturnPath('/repos/acme/widgets/review/42?point=1', origin)).toBe(
    '/repos/acme/widgets/review/42?point=1'
  )
  for (const target of [
    undefined,
    '/',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/repos/../../auth/login',
    '/repos/a\nLocation: evil',
    '/repos/' + 'a'.repeat(2048),
  ]) {
    expect(canvasReturnPath(target, origin)).toBe('/')
  }
})

it('binds single-use login attempts to a PKCE challenge and expires them after ten minutes', () => {
  let now = 0
  const attempts = new LoginAttempts(() => now)
  const first = attempts.begin('/repos/acme/widgets/review/42')!
  const login = attempts.consume(first.state)!
  expect(login.returnTo).toBe('/repos/acme/widgets/review/42')
  expect(createHash('sha256').update(login.verifier).digest('base64url')).toBe(first.challenge)
  expect(attempts.consume(first.state)).toBeNull()
  expect(attempts.consume('forged')).toBeNull()
  const second = attempts.begin('/')!
  now = 600_000
  expect(attempts.consume(second.state)).toBeNull()
})

it('bounds pending attempts and reclaims expired entries', () => {
  let now = 0
  const attempts = new LoginAttempts(() => now)
  for (let i = 0; i < 1000; i += 1) expect(attempts.begin('/')).not.toBeNull()
  expect(attempts.begin('/')).toBeNull()
  now = 600_000
  expect(attempts.begin('/')).not.toBeNull()
})

it('escapes organization labels and disables sign-in while credentials are unavailable', async () => {
  expect(String(await loginPage('<script>evil</script>', '/'))).not.toContain('<script>evil</script>')
  expect(String(await loginPage('acme', '/repos/acme/widgets/review/42'))).toContain('?next=%2Frepos')
  const pending = String(await loginPage('acme', '/', false))
  expect(pending).toContain('Canvas access is locked.')
  expect(pending).not.toContain('href="/auth/login')
})
