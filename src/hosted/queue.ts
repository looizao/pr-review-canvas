import path from 'node:path'
import { z } from 'zod'
import { readJson, writeJsonAtomic } from '../store/atomic-json.js'

export const JobInputSchema = z.object({
  owner: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/),
  repo: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .refine(name => name !== '.' && name !== '..'),
  number: z.number().int().positive(),
  headSha: z.string().regex(/^[a-f0-9]{40}$/),
})
export type JobInput = z.infer<typeof JobInputSchema>
const JobSchema = JobInputSchema.extend({
  id: z.string(),
  status: z.enum(['queued', 'running', 'ready', 'failed', 'superseded']),
  attempts: z.number().int().nonnegative(),
  updatedAt: z.number(),
  availableAt: z.number(),
  error: z.string().optional(),
})
export type Job = z.infer<typeof JobSchema>

export function jobId(job: JobInput): string {
  return `${job.owner}/${job.repo}/${job.number}/${job.headSha}`.toLowerCase()
}

/** One service instance owns this queue and its disk. Writes serialize before acknowledgment. */
export class GenerationQueue {
  private jobs: Job[] = []
  private chain: Promise<unknown> = Promise.resolve()
  private readonly file: string

  private readonly now: () => number
  constructor(root: string, now: () => number = Date.now) {
    this.now = now
    this.file = path.join(root, 'jobs.json')
  }

  async load(): Promise<void> {
    this.jobs = (await readJson(this.file, z.array(JobSchema))) ?? []
    for (const job of this.jobs) {
      if (job.status === 'running') {
        job.status = 'queued'
        job.availableAt = this.now()
      }
    }
    await writeJsonAtomic(this.file, this.jobs)
  }

  private change<T>(mutate: () => T): Promise<T> {
    const run = async () => {
      const before = structuredClone(this.jobs)
      const result = mutate()
      try {
        await writeJsonAtomic(this.file, this.jobs)
      } catch (error) {
        this.jobs = before
        throw error
      }
      return structuredClone(result)
    }
    const result = this.chain.then(run, run)
    this.chain = result.catch(() => undefined)
    return result
  }

  async list(): Promise<Job[]> {
    await this.chain
    return structuredClone(this.jobs)
  }

  enqueue(input: JobInput): Promise<Job> {
    const parsed = JobInputSchema.parse(input)
    return this.change(() => {
      const id = jobId(parsed)
      const existing = this.jobs.find(job => job.id === id)
      if (existing !== undefined) return existing
      const job: Job = {
        ...parsed,
        id,
        status: 'queued',
        attempts: 0,
        updatedAt: this.now(),
        availableAt: this.now(),
      }
      this.jobs.push(job)
      return job
    })
  }

  claim(): Promise<Job | null> {
    return this.change(() => {
      const job = this.jobs.find(
        candidate => candidate.status === 'queued' && candidate.availableAt <= this.now()
      )
      if (job === undefined) return null
      job.status = 'running'
      job.attempts += 1
      job.updatedAt = this.now()
      return job
    })
  }

  finish(id: string, status: 'ready' | 'superseded'): Promise<void> {
    return this.change(() => {
      const job = this.jobs.find(candidate => candidate.id === id)
      if (job === undefined) throw new Error('unknown generation job')
      job.status = status
      job.updatedAt = this.now()
      delete job.error
    })
  }

  fail(id: string, error: string): Promise<void> {
    return this.change(() => {
      const job = this.jobs.find(candidate => candidate.id === id)
      if (job === undefined) throw new Error('unknown generation job')
      job.status = job.attempts < 3 ? 'queued' : 'failed'
      job.error = error
      job.updatedAt = this.now()
      job.availableAt = this.now() + 30_000 * 2 ** job.attempts
    })
  }

  retry(id: string): Promise<boolean> {
    return this.change(() => {
      const job = this.jobs.find(candidate => candidate.id === id && candidate.status === 'failed')
      if (job === undefined) return false
      job.status = 'queued'
      job.attempts = 0
      job.availableAt = this.now()
      job.updatedAt = this.now()
      delete job.error
      return true
    })
  }
}
