import path from 'node:path'
import { z } from 'zod'

const ConfigSchema = z.object({
  origin: z.url().transform(value => {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error('PR_REVIEW_PUBLIC_URL must be an HTTPS origin without a path')
    }
    return url.origin
  }),
  organization: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/),
  appId: z.string().regex(/^\d+$/),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  privateKey: z.string().min(1),
  webhookSecret: z.string().min(32),
  sessionKey: z.string().regex(/^[a-fA-F0-9]{64}$/),
  dataDir: z
    .string()
    .min(1)
    .transform(value => path.resolve(value)),
  port: z.coerce.number().int().min(1).max(65535),
  generationTimeoutSec: z.coerce.number().int().min(30).max(3600),
})

export type HostedConfig = z.infer<typeof ConfigSchema>

export function hostedConfig(env: NodeJS.ProcessEnv): HostedConfig {
  return ConfigSchema.parse({
    origin: env['PR_REVIEW_PUBLIC_URL'],
    organization: env['GITHUB_ORGANIZATION'],
    appId: env['GITHUB_APP_ID'],
    clientId: env['GITHUB_CLIENT_ID'],
    clientSecret: env['GITHUB_CLIENT_SECRET'],
    privateKey: env['GITHUB_APP_PRIVATE_KEY']?.replaceAll('\\n', '\n'),
    webhookSecret: env['GITHUB_WEBHOOK_SECRET'],
    sessionKey: env['PR_REVIEW_SESSION_KEY'],
    dataDir: env['PR_REVIEW_DATA_DIR'] ?? '/var/data/pr-review',
    port: env['PORT'] ?? 10000,
    generationTimeoutSec: env['PR_REVIEW_GENERATION_TIMEOUT_SEC'] ?? 900,
  })
}
