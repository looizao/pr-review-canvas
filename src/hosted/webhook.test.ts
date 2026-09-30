import { createHmac } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { GenerationQueue } from './queue.js'
import { receiveWebhook, validSignature } from './webhook.js'

let root: string
let queue: GenerationQueue
const secret = 's'.repeat(32)
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'hosted-webhook-'))
  queue = new GenerationQueue(root)
  await queue.load()
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
const payload = {
  action: 'opened',
  number: 42,
  installation: { id: 1 },
  repository: { name: 'widgets', owner: { login: 'acme' } },
  pull_request: { draft: false, state: 'open', head: { sha: 'a'.repeat(40) } },
}
function request(body: unknown = payload, event = 'pull_request') {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('https://canvas.example.com/webhooks/github', {
    method: 'POST',
    body: text,
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(text).digest('hex')}`,
    },
  })
}
const receive = (r: Request) => receiveWebhook(r, { secret, organization: 'acme', queue })

it.each(['opened', 'reopened', 'synchronize', 'ready_for_review'])(
  'queues signed %s events exactly once',
  async action => {
    expect(await receive(request({ ...payload, action }))).toBe(true)
    expect(await receive(request({ ...payload, action }))).toBe(true)
    expect(await queue.list()).toHaveLength(1)
  }
)

it('ignores draft, closed, unrelated organization and unrelated event deliveries', async () => {
  for (const raw of [
    { ...payload, action: 'closed' },
    { ...payload, pull_request: { ...payload.pull_request, draft: true } },
    { ...payload, pull_request: { ...payload.pull_request, state: 'closed' } },
    { ...payload, repository: { ...payload.repository, owner: { login: 'other' } } },
  ])
    expect(await receive(request(raw))).toBe(false)
  expect(await receive(request({}, 'ping'))).toBe(false)
  expect(await queue.list()).toEqual([])
})

it('rejects forged, malformed and oversized deliveries before enqueueing', async () => {
  const forged = request()
  forged.headers.set('x-hub-signature-256', `sha256=${'0'.repeat(64)}`)
  await expect(receive(forged)).rejects.toMatchObject({ status: 403 })
  await expect(receive(request('{'))).rejects.toMatchObject({ status: 400 })
  await expect(receive(request({}))).rejects.toMatchObject({ status: 400 })
  await expect(
    receive(request({ ...payload, pull_request: { ...payload.pull_request, head: { sha: '../escape' } } }))
  ).rejects.toMatchObject({ status: 400 })
  await expect(receive(request('a'.repeat(2 * 1024 * 1024 + 1)))).rejects.toMatchObject({ status: 413 })
  expect(validSignature(new Uint8Array(), null, secret)).toBe(false)
  expect(validSignature(new Uint8Array(), 'sha256=bad', secret)).toBe(false)
  expect(await queue.list()).toEqual([])
})
