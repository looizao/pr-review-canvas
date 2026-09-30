import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { artifactToModelOutput } from '../review/normalize.js'
import { makeTestContext, type TestContext } from '../testing/fakes.js'
import { ghFor42, gitFor42, HEAD_SHA, syntheticArtifact } from '../testing/synthetic.js'
import type { GithubApp } from './github.js'
import { GenerationQueue, type Job } from './queue.js'
import { testHostedConfig } from '../testing/hosted.js'
import { generateCanvas, reconcilePullRequests, startWorker, type WorkerOptions } from './worker.js'

const fakeExec = vi.hoisted(() =>
  vi.fn(async () => ({ code: 0, stdout: Buffer.from('src/app.ts\0'), stderr: '' }))
)
vi.mock('../git/git.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../git/git.js')>()),
  execGit: fakeExec,
}))
let t: TestContext
let opts: WorkerOptions
let job: Job
beforeEach(async () => {
  vi.clearAllMocks()
  fakeExec.mockResolvedValue({ code: 0, stdout: Buffer.from('src/app.ts\0'), stderr: '' })
  t = await makeTestContext({ git: gitFor42(), gh: ghFor42() })
  t.ctx.projectConfig = structuredClone(t.ctx.projectConfig)
  t.ctx.projectConfig.config.sharing.canvasComment = false
  t.ctx.projectConfig.config.generation.maxRepairRounds = 1
  const queue = new GenerationQueue(t.dataDir)
  await queue.load()
  opts = {
    config: testHostedConfig(t.dataDir),
    queue,
    log: vi.fn(),
    github: {
      repositories: vi.fn(async () => [{ name: 'widgets', owner: { login: 'acme' } }]),
      installationToken: vi.fn(async () => 'token'),
      request: vi.fn(async () => [{ number: 42, draft: false, head: { sha: HEAD_SHA } }]),
    } as unknown as GithubApp,
    repositories: { context: vi.fn(async () => t.ctx) },
    agent: { generate: vi.fn(async () => artifactToModelOutput(syntheticArtifact())) },
  }
  job = await queue.enqueue({ owner: 'acme', repo: 'widgets', number: 42, headSha: HEAD_SHA })
})
afterEach(async () => {
  vi.useRealTimers()
  await t.cleanup()
})

it('uses the existing prepare and validation pipeline to store a shared canvas', async () => {
  expect(await generateCanvas(opts, job, new AbortController())).toBe('ready')
  expect(await t.ctx.canvases.exists(HEAD_SHA)).toBe(true)
  expect((await t.ctx.canvases.readIndex()).canvases[HEAD_SHA]?.prNumber).toBe(42)
  expect((await t.ctx.canvases.readArtifact(HEAD_SHA))?.generator.agent).toBe('claude')
  expect(await readFile(path.join(t.ctx.canvases.canvasDir(HEAD_SHA), 'model.json'), 'utf8')).toContain(
    'summary'
  )
  // An existing validated canvas needs no additional subscription usage.
  expect(await generateCanvas(opts, job, new AbortController())).toBe('ready')
  expect(opts.agent.generate).toHaveBeenCalledTimes(1)
})

it('repairs invalid output using validation errors before publishing', async () => {
  opts.agent.generate = vi
    .fn()
    .mockResolvedValueOnce({ summary: 'invalid' })
    .mockResolvedValueOnce(artifactToModelOutput(syntheticArtifact()))
  expect(await generateCanvas(opts, job, new AbortController())).toBe('ready')
  expect(opts.agent.generate).toHaveBeenCalledTimes(2)
  const requests = vi.mocked(opts.agent.generate).mock.calls
  expect(requests[1]?.[0].prompt).toContain('Validation errors')
  expect((await t.ctx.canvases.readArtifact(HEAD_SHA))?.generator.attempts).toBe(2)
})

it('does not publish invalid, failed or obsolete output', async () => {
  expect(await generateCanvas(opts, { ...job, headSha: 'b'.repeat(40) }, new AbortController())).toBe(
    'superseded'
  )
  expect(opts.agent.generate).not.toHaveBeenCalled()
  opts.agent.generate = vi.fn(async () => ({}))
  await expect(generateCanvas(opts, job, new AbortController())).rejects.toThrow('model.json')
  expect(await t.ctx.canvases.exists(HEAD_SHA)).toBe(false)
  opts.agent.generate = vi.fn(async () => {
    throw new Error('auth required')
  })
  await expect(generateCanvas(opts, job, new AbortController())).rejects.toThrow('auth required')
  fakeExec.mockResolvedValue({ code: 1, stdout: Buffer.from(''), stderr: 'failed' })
  await expect(generateCanvas(opts, job, new AbortController())).rejects.toThrow('list repository paths')
})

it('backfills installed repositories and skips draft PRs with pagination', async () => {
  const prs = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    draft: i === 0,
    head: { sha: HEAD_SHA },
  }))
  opts.github.request = vi.fn().mockResolvedValueOnce(prs).mockResolvedValueOnce([])
  await reconcilePullRequests(opts)
  expect(await opts.queue.list()).toHaveLength(99)
  expect(opts.github.request).toHaveBeenCalledTimes(2)
})

it('starts reconciliation and a worker job, then stops without rescheduling', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const worker = startWorker(opts)
  await vi.waitFor(async () => expect((await opts.queue.list())[0]?.status).toBe('ready'))
  await worker.stop()
  const calls = vi.mocked(opts.github.repositories).mock.calls.length
  await vi.advanceTimersByTimeAsync(600_000)
  expect(opts.github.repositories).toHaveBeenCalledTimes(calls)
})

it('keeps accepting jobs when reconciliation or generation fails', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  opts.github.repositories = vi.fn(async () => {
    throw new Error('not installed')
  })
  opts.agent.generate = vi.fn(async () => {
    throw new Error('auth required')
  })
  const worker = startWorker(opts)
  await vi.waitFor(async () => expect((await opts.queue.list())[0]?.attempts).toBe(1))
  await worker.stop()
  expect((await opts.queue.list())[0]).toMatchObject({
    status: 'queued',
    error: expect.stringContaining('Generation'),
  })
  expect(opts.log).toHaveBeenCalledWith(expect.stringContaining('reconciliation failed'))
})
