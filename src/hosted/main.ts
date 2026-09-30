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
const worker = startWorker({
  config,
  github,
  repositories,
  queue,
  agent: createClaudeGenerator({ ...process.env, PR_REVIEW_AGENT_HOME: agentHome }),
  log,
})
const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, () => {
  log(`PR Review Canvas hosted: ${config.origin} · ${config.organization}`)
})
let closing = false
const stop = async () => {
  if (closing) return
  closing = true
  server.close()
  await worker.stop()
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
