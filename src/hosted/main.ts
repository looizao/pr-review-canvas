import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { lock } from 'proper-lockfile'
import { createHostedApp } from './app.js'
import { createClaudeGenerator } from './claude.js'
import { hostedConfig } from './config.js'
import { GithubApp } from './github.js'
import { GenerationQueue } from './queue.js'
import { Repositories } from './repositories.js'
import { Sessions } from './sessions.js'
import { startWorker } from './worker.js'
import { createSetupApp, missingHostedEnvironment } from './setup.js'
import { z } from 'zod'

const missing = missingHostedEnvironment(process.env)
if (process.env['PR_REVIEW_SETUP_MODE'] === 'true' && missing.length > 0) {
  const port = z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .parse(process.env['PORT'] ?? 10000)
  const server = serve({
    fetch: createSetupApp(process.env['GITHUB_ORGANIZATION']).fetch,
    port,
    hostname: '0.0.0.0',
  })
  process.stderr.write(`Hosted service awaiting configuration: ${missing.join(', ')}\n`)
  process.once('SIGTERM', () => server.close())
  process.once('SIGINT', () => server.close())
} else {
  const config = hostedConfig(process.env)
  await mkdir(config.dataDir, { recursive: true })
  // Enforce the queue's single-process ownership, including during accidental local launches.
  const release = await lock(config.dataDir, { lockfilePath: path.join(config.dataDir, 'hosted.lock') })
  const log = (line: string) => process.stderr.write(`${line}\n`)
  const github = new GithubApp(config)
  const sessions = new Sessions(config.dataDir, config.sessionKey)
  const queue = new GenerationQueue(config.dataDir)
  await queue.load()
  const repositories = new Repositories(config, github)
  const app = createHostedApp({ config, github, sessions, queue, repositories, log })
  const agentHome = process.env['PR_REVIEW_AGENT_HOME'] ?? path.join(config.dataDir, 'agent')
  await mkdir(agentHome, { recursive: true })
  const worker = process.env['CLAUDE_CODE_OAUTH_TOKEN']?.trim()
    ? startWorker({
        config,
        github,
        repositories,
        queue,
        agent: createClaudeGenerator({ ...process.env, PR_REVIEW_AGENT_HOME: agentHome }),
        log,
      })
    : undefined
  if (worker === undefined) log('Canvas generation paused: configure CLAUDE_CODE_OAUTH_TOKEN')
  const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, () => {
    log(`PR Review Canvas hosted: ${config.origin} · ${config.organization}`)
  })
  let closing = false
  const stop = async () => {
    if (closing) return
    closing = true
    server.close()
    await worker?.stop()
    if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function')
      server.closeAllConnections()
    await release()
  }
  process.once('SIGTERM', () => {
    void stop()
  })
  process.once('SIGINT', () => {
    void stop()
  })
}
