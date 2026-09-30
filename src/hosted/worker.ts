import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { execGit } from '../git/git.js'
import { modelOutputSchema } from '../contract/review-artifact.js'
import { prepare } from '../review/prepare.js'
import { ModelInvalidError, publish, readContext } from '../review/publish.js'
import { readText, writeJsonAtomic } from '../store/atomic-json.js'
import type { GenerationAgent } from './claude.js'
import type { HostedConfig } from './config.js'
import type { GithubApp } from './github.js'
import { JobInputSchema, type GenerationQueue, type Job } from './queue.js'
import type { Repositories } from './repositories.js'

export interface WorkerOptions {
  config: HostedConfig
  github: GithubApp
  repositories: Pick<Repositories, 'context'>
  queue: GenerationQueue
  agent: GenerationAgent
  log: (line: string) => void
}

/** Backfill existing PRs and recover missed deliveries, including newly installed repositories. */
export async function reconcilePullRequests(opts: WorkerOptions): Promise<void> {
  for (const repo of await opts.github.repositories()) {
    const owner = repo.owner.login
    const token = await opts.github.installationToken(owner, repo.name)
    for (let page = 1; ; page += 1) {
      const prs = z
        .array(z.object({ number: z.number(), draft: z.boolean(), head: z.object({ sha: z.string() }) }))
        .parse(
          await opts.github.request(
            token,
            `repos/${owner}/${repo.name}/pulls?state=open&per_page=100&page=${page}`
          )
        )
      for (const pr of prs) {
        if (!pr.draft)
          await opts.queue.enqueue(
            JobInputSchema.parse({ owner, repo: repo.name, number: pr.number, headSha: pr.head.sha })
          )
      }
      if (prs.length < 100) break
    }
  }
}

export async function generateCanvas(
  opts: WorkerOptions,
  job: Job,
  abortController: AbortController
): Promise<'ready' | 'superseded'> {
  const ctx = await opts.repositories.context(job.owner, job.repo)
  const meta = await ctx.config.host.fetchPrMeta(ctx.gh, ctx.config.repo, job.number)
  if (meta.headSha !== job.headSha || meta.state !== 'open' || meta.draft) return 'superseded'
  const prepared = await prepare(ctx, { kind: 'pr', number: job.number }, { force: false, log: () => {} })
  if (prepared.headSha !== job.headSha) return 'superseded'
  if (prepared.status === 'exists') return 'ready'
  const context = await readContext(prepared.canvasDir)
  const task = await readText(prepared.promptPath)
  if (task === null) throw new Error('prepared canvas has no prompt')
  const cwd = path.join(opts.config.dataDir, 'agent', 'work')
  await mkdir(cwd, { recursive: true })
  const instructions = `${task}\n\nPrepared context:\n${JSON.stringify(context)}\n\nUse the repository MCP tools for source reads. Return model JSON only. Do not write model.json or run publish commands; the service does that.`
  const listed = await execGit(ctx.config.repoRoot, ['ls-tree', '-r', '--name-only', '-z', prepared.headSha])
  if (listed.code !== 0) throw new Error('cannot list repository paths')
  const paths = listed.stdout.toString('utf8').split('\0').filter(Boolean)
  let prompt = instructions
  for (let round = 0; round <= ctx.projectConfig.config.generation.maxRepairRounds; round += 1) {
    const model = await opts.agent.generate({
      prompt,
      schema: z.toJSONSchema(modelOutputSchema(context.caps)),
      cwd,
      model: ctx.projectConfig.config.generation.models['claude'] ?? 'opus',
      headSha: prepared.headSha,
      baseSha: prepared.mergeBaseSha,
      git: ctx.git,
      paths,
      abortController,
    })
    await writeJsonAtomic(path.join(prepared.canvasDir, 'model.json'), model)
    try {
      await publish(ctx, prepared.canvasDir, {
        agent: 'claude',
        harness: 'claude-code',
        allowStale: false,
        model: ctx.projectConfig.config.generation.models['claude'] ?? 'opus',
      })
      return 'ready'
    } catch (error) {
      if (
        !(error instanceof ModelInvalidError) ||
        round === ctx.projectConfig.config.generation.maxRepairRounds
      )
        throw error
      prompt = `${instructions}\n\nRepair this invalid model:\n${JSON.stringify(model)}\n\nValidation errors:\n${JSON.stringify(error.report.errors)}`
    }
  }
  throw new Error('canvas generation exhausted repair rounds')
}

export function startWorker(opts: WorkerOptions): { stop(): Promise<void> } {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let active: AbortController | undefined
  let current: Promise<void> = Promise.resolve()
  let nextScan = 0
  const tick = async () => {
    try {
      if (Date.now() >= nextScan) {
        nextScan = Date.now() + 300_000
        try {
          await reconcilePullRequests(opts)
        } catch {
          opts.log('GitHub reconciliation failed; check app installation and credentials')
        }
      }
      if (stopped) return
      const job = await opts.queue.claim()
      if (job !== null) {
        active = new AbortController()
        const deadline = setTimeout(() => active?.abort(), opts.config.generationTimeoutSec * 1000)
        try {
          const status = await generateCanvas(opts, job, active)
          await opts.queue.finish(job.id, status)
          opts.log(`generation ${status}: ${job.id}`)
        } catch {
          await opts.queue.fail(
            job.id,
            active.signal.aborted
              ? 'Generation interrupted or timed out'
              : 'Generation failed; check Claude authentication, repository access, and validation'
          )
          opts.log(`generation failed: ${job.id}`)
        } finally {
          clearTimeout(deadline)
          active = undefined
        }
      }
    } catch {
      opts.log('generation queue failed; check persistent storage')
    } finally {
      if (!stopped) timer = setTimeout(run, 5000)
    }
  }
  const run = () => {
    current = tick()
  }
  run()
  return {
    async stop() {
      stopped = true
      clearTimeout(timer)
      active?.abort()
      await current
    },
  }
}
