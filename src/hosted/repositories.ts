import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { createAgentRunner } from '../acpx/acpx.js'
import { createGit, execGit } from '../git/git.js'
import { GITHUB_HOST } from '../host/host.js'
import { loadProjectConfig } from '../project-config.js'
import { createAppContext, createChatSet, type AppContext } from '../server/context.js'
import { createPrStore } from '../store/pr-store.js'
import { createStateStore } from '../store/state-store.js'
import { repoDir } from '../store/data-dir.js'
import type { HostedConfig } from './config.js'
import { GithubApp, gitCredentials, RepositorySchema, tokenClient } from './github.js'
import type { Session } from './sessions.js'

export class Repositories {
  private readonly shared = new Map<string, Promise<AppContext>>()
  private readonly personal = new Map<string, AppContext>()

  private readonly config: HostedConfig
  private readonly github: GithubApp
  constructor(config: HostedConfig, github: GithubApp) {
    this.config = config
    this.github = github
  }

  context(owner: string, name: string): Promise<AppContext> {
    const repo = RepositorySchema.parse({ owner: { login: owner }, name })
    if (repo.owner.login.toLowerCase() !== this.config.organization.toLowerCase()) {
      throw new Error('repository is outside the configured organization')
    }
    const key = `${owner}/${name}`.toLowerCase()
    let pending = this.shared.get(key)
    if (pending === undefined) {
      pending = this.build(owner, name)
      this.shared.set(key, pending)
      void pending.catch(() => this.shared.delete(key))
    }
    return pending
  }

  private async build(owner: string, name: string): Promise<AppContext> {
    const root = path.join(this.config.dataDir, 'clones', owner.toLowerCase(), name.toLowerCase())
    await mkdir(path.dirname(root), { recursive: true })
    const token = () => this.github.installationToken(owner, name)
    const canonical = RepositorySchema.parse(
      await this.github.request(await token(), `repos/${owner}/${name}`)
    )
    if (`${canonical.owner.login}/${canonical.name}`.toLowerCase() !== `${owner}/${name}`.toLowerCase()) {
      throw new Error('repository identity changed; use its current GitHub URL')
    }
    const git = createGit(root, async (cwd, args, extra) =>
      execGit(cwd, args, { ...gitCredentials(await token()), ...extra })
    )
    const exists = await git.topLevel().then(
      topLevel => path.resolve(topLevel) === root,
      () => false
    )
    if (!exists) {
      const temporary = `${root}.cloning`
      await rm(temporary, { recursive: true, force: true })
      const result = await execGit(
        path.dirname(root),
        ['clone', '--no-checkout', '--', `https://github.com/${owner}/${name}.git`, temporary],
        gitCredentials(await token())
      )
      if (result.code !== 0) {
        await rm(temporary, { recursive: true, force: true })
        throw new Error('repository clone failed')
      }
      await rename(temporary, root)
    }
    // Read config from the trusted default branch, never a contributor's PR checkout.
    // No checkout is needed to collect diffs, but project config lives in the working tree.
    const checkout = await execGit(root, ['checkout', '--force', 'HEAD'], gitCredentials(await token()))
    if (checkout.code !== 0) throw new Error('repository checkout failed')
    const projectConfig = await loadProjectConfig(root)
    projectConfig.config.sharing.canvasComment = false
    // Hosted chat is disabled until agent execution can be isolated per collaborator.
    projectConfig.config.chat.enabled = false
    const runner = createAgentRunner({
      env: {
        PATH: process.env['PATH'],
        HOME: process.env['PR_REVIEW_AGENT_HOME'] ?? path.join(this.config.dataDir, 'agent'),
        CLAUDE_CODE_OAUTH_TOKEN: process.env['CLAUDE_CODE_OAUTH_TOKEN'],
      },
    })
    const ctx = createAppContext({
      config: {
        repo: { owner: canonical.owner.login, name: canonical.name },
        repoRoot: root,
        commonDir: path.join(root, '.git'),
        dataDir: this.config.dataDir,
        host: GITHUB_HOST,
        port: this.config.port,
        fixtureCanvasPath: null,
        chatOverrides: {},
        openBrowser: false,
      },
      projectConfig,
      fixtureArtifact: null,
      git,
      gh: tokenClient(token),
      runner,
    })
    return ctx
  }

  async forUser(owner: string, name: string, session: Session): Promise<AppContext> {
    const shared = await this.context(owner, name)
    const key = `${owner}/${name}/${session.userId}`.toLowerCase()
    let ctx = this.personal.get(key)
    const gh = tokenClient(async () => session.token)
    if (ctx === undefined) {
      const personalData = path.join(this.config.dataDir, 'users', String(session.userId))
      const prs = createPrStore(repoDir(personalData, shared.config.repo))
      const state = createStateStore(prs, shared.now)
      const config = { ...shared.config, dataDir: personalData }
      const runner = createAgentRunner()
      ctx = {
        ...shared,
        state,
        ...createChatSet(config, runner, { ...shared, state }, shared.now, shared.git),
      }
      this.personal.set(key, ctx)
    }
    // A request binds its own token and capabilities, including after a new sign-in.
    return {
      ...ctx,
      gh,
      capabilities: { get: () => shared.config.host.probeCapabilities(gh, shared.config.repo) },
    }
  }
}
