import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { GenerationQueue, jobId, type JobInput } from './queue.js'
import { Sessions } from './sessions.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'hosted-state-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
const input: JobInput = { owner: 'acme', repo: 'widgets', number: 42, headSha: 'a'.repeat(40) }

it('persists a deduplicated job before acknowledging simultaneous deliveries', async () => {
  const queue = new GenerationQueue(root)
  await queue.load()
  await Promise.all(Array.from({ length: 15 }, () => queue.enqueue(input)))
  expect(await queue.list()).toHaveLength(1)
  const restarted = new GenerationQueue(root)
  await restarted.load()
  expect((await restarted.claim())?.id).toBe(jobId(input))
  expect(await restarted.claim()).toBeNull()
})

it('recovers interrupted jobs and backs off up to three attempts, then allows explicit retry', async () => {
  let now = 10
  let queue = new GenerationQueue(root, () => now)
  await queue.load()
  await queue.enqueue(input)
  await queue.claim()
  queue = new GenerationQueue(root, () => now)
  await queue.load()
  expect((await queue.list())[0]?.status).toBe('queued')
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    expect((await queue.claim())?.attempts).toBe(attempt)
    await queue.fail(jobId(input), 'interrupted')
    expect(await queue.claim()).toBeNull()
    now += 300_000
  }
  expect((await queue.list())[0]?.status).toBe('failed')
  expect(await queue.retry('missing')).toBe(false)
  expect(await queue.retry(jobId(input))).toBe(true)
  expect((await queue.claim())?.attempts).toBe(1)
  await queue.finish(jobId(input), 'ready')
  expect((await queue.list())[0]?.error).toBeUndefined()
  await queue.enqueue({ ...input, headSha: 'b'.repeat(40) })
  await queue.finish(jobId({ ...input, headSha: 'b'.repeat(40) }), 'superseded')
  expect((await queue.list())[1]?.status).toBe('superseded')
  await expect(queue.finish('missing', 'ready')).rejects.toThrow('unknown')
  await expect(queue.fail('missing', 'failure')).rejects.toThrow('unknown')
})

it('does not acknowledge a failed write or poison subsequent queue writes', async () => {
  const queue = new GenerationQueue(root)
  await queue.load()
  await rm(root, { recursive: true })
  await writeFile(root, 'unwritable-directory')
  await expect(queue.enqueue(input)).rejects.toThrow()
  expect(await queue.list()).toEqual([])
  await rm(root)
  await queue.enqueue(input)
  expect(await queue.list()).toHaveLength(1)
})

it('rejects repository traversal in job inputs', async () => {
  const queue = new GenerationQueue(root)
  for (const repo of ['..', '.', '../escape', '/root', 'foo/bar']) {
    expect(() => queue.enqueue({ ...input, repo })).toThrow()
  }
})

it('encrypts tokens at rest and invalidates expired, corrupted, rotated and logged-out sessions', async () => {
  const sessions = new Sessions(root, 'f'.repeat(64))
  const session = { userId: 1, login: 'alice', token: 'secret-token', expires: Date.now() + 100_000 }
  const id = await sessions.create(session)
  const file = path.join(root, 'sessions', `${id}.json`)
  expect(await readFile(file, 'utf8')).not.toContain('secret-token')
  expect(await sessions.read(id)).toEqual(session)
  expect(await sessions.read(undefined)).toBeNull()
  expect(await sessions.read('../escape')).toBeNull()
  expect(await sessions.read('1'.repeat(64))).toBeNull()
  await sessions.remove(undefined)
  await sessions.remove('../escape')
  await sessions.remove(id)
  expect(await sessions.read(id)).toBeNull()
  const expired = await sessions.create({ ...session, expires: 0 })
  expect(await sessions.read(expired)).toBeNull()
  const rotated = await sessions.create(session)
  expect(await new Sessions(root, 'a'.repeat(64)).read(rotated)).toBeNull()
  const corrupted = await sessions.create(session)
  const encrypted = JSON.parse(await readFile(path.join(root, 'sessions', `${corrupted}.json`), 'utf8')) as {
    tag: string
  }
  encrypted.tag = '0'.repeat(32)
  await writeFile(path.join(root, 'sessions', `${corrupted}.json`), JSON.stringify(encrypted))
  expect(await sessions.read(corrupted)).toBeNull()
  const malformed = await sessions.create(session)
  await writeFile(path.join(root, 'sessions', `${malformed}.json`), '{broken json')
  expect(await sessions.read(malformed)).toBeNull()
})
