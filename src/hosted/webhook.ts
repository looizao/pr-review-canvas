import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { BodyTooLargeError, readCappedBody } from '../server/capped-body.js'
import { AppError } from '../server/errors.js'
import { JobInputSchema, type GenerationQueue } from './queue.js'
import { RepositorySchema } from './github.js'

export function validSignature(body: Uint8Array, signature: string | null, secret: string): boolean {
  if (signature === null || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false
  const expected = createHmac('sha256', secret).update(body).digest()
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))
}

const PayloadSchema = z.object({
  action: z.string(),
  number: z.number().int().positive(),
  repository: RepositorySchema,
  installation: z.object({ id: z.number().int().positive() }),
  pull_request: z.object({ state: z.string(), draft: z.boolean(), head: z.object({ sha: z.string() }) }),
})

export async function receiveWebhook(
  request: Request,
  opts: {
    secret: string
    organization: string
    queue: GenerationQueue
  }
): Promise<boolean> {
  let body: Uint8Array
  try {
    body = await readCappedBody(request, 2 * 1024 * 1024)
  } catch (error) {
    if (error instanceof BodyTooLargeError) throw new AppError('BAD_REQUEST', 'webhook is too large', 413)
    throw error
  }
  if (!validSignature(body, request.headers.get('x-hub-signature-256'), opts.secret)) {
    throw new AppError('CROSS_ORIGIN', 'invalid webhook signature', 403)
  }
  if (request.headers.get('x-github-event') !== 'pull_request') return false
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(body).toString('utf8'))
  } catch {
    throw new AppError('BAD_REQUEST', 'invalid webhook JSON', 400)
  }
  const parsed = PayloadSchema.safeParse(raw)
  if (!parsed.success) throw new AppError('BAD_REQUEST', 'invalid pull request event', 400)
  const payload = parsed.data
  if (payload.repository.owner.login.toLowerCase() !== opts.organization.toLowerCase()) return false
  if (!['opened', 'reopened', 'synchronize', 'ready_for_review'].includes(payload.action)) return false
  if (payload.pull_request.state !== 'open' || payload.pull_request.draft) return false
  const job = JobInputSchema.safeParse({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    number: payload.number,
    headSha: payload.pull_request.head.sha,
  })
  if (!job.success) throw new AppError('BAD_REQUEST', 'invalid pull request head', 400)
  await opts.queue.enqueue(job.data)
  return true
}
