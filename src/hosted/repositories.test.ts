import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execGit } from '../git/git.js'
import { GithubApp } from './github.js'
import { Repositories } from './repositories.js'
import { testHostedConfig } from '../testing/hosted.js'

let root: string
let repositories: Repositories
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'hosted-repositories-'))
  const config = testHostedConfig(root)
  const github = new GithubApp(config)
  vi.spyOn(github, 'installationToken').mockResolvedValue('token')
  vi.spyOn(github, 'request').mockResolvedValue({ name: 'widgets', owner: { login: 'acme' } })
  repositories = new Repositories(config, github)
  const clone = path.join(root, 'clones', 'acme', 'widgets')
  await mkdir(clone, { recursive: true })
  const command = async (args: string[]) => {
    const result = await execGit(clone, args, {
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    })
    if (result.code !== 0) throw new Error(result.stderr)
  }
  await command(['init'])
  await writeFile(path.join(clone, 'app.txt'), 'source')
  await command(['add', 'app.txt'])
  await command(['commit', '-m', 'initial'])
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('shares canvas stores but isolates drafts, progress and settings per GitHub user', async () => {
  const alice = { userId: 1, login: 'alice', token: 'alice-token', expires: Date.now() + 10_000 }
  const bob = { ...alice, userId: 2, login: 'bob', token: 'bob-token' }
  const [a, b] = await Promise.all([
    repositories.forUser('acme', 'widgets', alice),
    repositories.forUser('acme', 'widgets', bob),
  ])
  expect(a.canvases).toBe(b.canvases)
  expect(a.prs).toBe(b.prs)
  expect(a.settings.file).not.toBe(b.settings.file)
  await a.state.addPending(42, { path: 'app.txt', line: 1, side: 'new', body: 'Alice draft' }, 'a'.repeat(40))
  expect((await b.state.read(42)).pending).toEqual([])
  await a.state.setReviewed(42, 'layer:one', true)
  expect((await b.state.read(42)).reviewed).toEqual({})
  await a.settings.write({ theme: 'dark' })
  expect((await b.settings.read()).theme).toBe('auto')
  const nextLogin = await repositories.forUser('acme', 'widgets', { ...alice, token: 'new-token' })
  expect((await nextLogin.state.read(42)).pending).toHaveLength(1)
  expect(nextLogin.gh).not.toBe(a.gh)
  expect(a.projectConfig.config.chat.enabled).toBe(false)
  expect(a.projectConfig.config.sharing.canvasComment).toBe(false)
  expect(await repositories.context('acme', 'widgets')).toBe(await repositories.context('Acme', 'Widgets'))
})

it('rejects repository paths and organizations outside the installation scope', () => {
  expect(() => repositories.context('other', 'widgets')).toThrow('outside')
  expect(() => repositories.context('acme', '..')).toThrow()
})
