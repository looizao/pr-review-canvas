import { createFakeGit } from '../testing/fakes.js'
import { BASE_SHA, HEAD_SHA } from '../testing/synthetic.js'
import { createClaudeGenerator, repositoryTools, type GenerationRequest } from './claude.js'

const sdk = vi.hoisted(() => ({
  query: vi.fn(),
  server: vi.fn(),
  tool: vi.fn((_name, _description, _schema, handler) => ({ handler })),
}))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: sdk.query,
  createSdkMcpServer: sdk.server,
  tool: sdk.tool,
}))
beforeEach(() => {
  vi.clearAllMocks()
})

it('exposes only commit-backed code reads, with no filesystem or shell access', async () => {
  const git = createFakeGit({
    blobs: { [`${HEAD_SHA}:src/app.ts`]: 'head', [`${BASE_SHA}:src/app.ts`]: 'base' },
  })
  repositoryTools(git, HEAD_SHA, BASE_SHA, ['src/app.ts', 'src/app.test.ts'])
  const read = sdk.tool.mock.calls[0]?.[3] as (input: { path: string; side: string }) => Promise<unknown>
  const find = sdk.tool.mock.calls[1]?.[3] as (input: { contains: string }) => Promise<unknown>
  expect(await read({ path: 'src/app.ts', side: 'head' })).toMatchObject({ content: [{ text: 'head' }] })
  expect(await read({ path: 'src/app.ts', side: 'base' })).toMatchObject({ content: [{ text: 'base' }] })
  for (const path of ['/etc/secrets', '../sessions.json', 'src/../../secret', 'a\0b', 'missing.ts']) {
    expect(await read({ path, side: 'head' })).toMatchObject({ isError: true })
  }
  git.options.blobs![`${HEAD_SHA}:big`] = 'a'.repeat(1024 * 1024 + 1)
  expect(await read({ path: 'big', side: 'head' })).toMatchObject({ isError: true })
  expect(await find({ contains: '.test.' })).toMatchObject({
    content: [{ text: JSON.stringify({ paths: ['src/app.test.ts'], total: 1 }) }],
  })
})

function request(): GenerationRequest {
  return {
    prompt: 'Generate',
    schema: {},
    cwd: '/isolated',
    model: 'opus',
    headSha: HEAD_SHA,
    baseSha: BASE_SHA,
    git: createFakeGit(),
    paths: [],
    abortController: new AbortController(),
  }
}
function messages(events: unknown[]) {
  const close = vi.fn()
  sdk.query.mockReturnValue({
    close,
    async *[Symbol.asyncIterator]() {
      yield* events
    },
  })
  return close
}

it('uses T3-style SDK control with an isolated environment and structured results', async () => {
  const close = messages([
    { type: 'system' },
    { type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'canvas' } },
  ])
  expect(
    await createClaudeGenerator({
      PATH: '/bin',
      PR_REVIEW_AGENT_HOME: '/agent',
      CLAUDE_CODE_OAUTH_TOKEN: 'claude-token',
      GITHUB_APP_PRIVATE_KEY: 'never-inherit',
    }).generate(request())
  ).toEqual({ summary: 'canvas' })
  const options = sdk.query.mock.calls[0]?.[0].options
  expect(options.env).not.toHaveProperty('GITHUB_APP_PRIVATE_KEY')
  expect(options.env.CLAUDE_CODE_OAUTH_TOKEN).toBe('claude-token')
  expect(options).toMatchObject({
    tools: [],
    settingSources: [],
    persistSession: false,
    strictMcpConfig: true,
  })
  expect(await options.canUseTool('Bash', {})).toMatchObject({ behavior: 'deny' })
  expect(await options.canUseTool('mcp__repository__read_file', { path: 'file' })).toMatchObject({
    behavior: 'allow',
  })
  expect(close).toHaveBeenCalled()
})

it('accepts JSON result fallback and always closes failed or incomplete queries', async () => {
  messages([{ type: 'result', subtype: 'success', is_error: false, result: '{"summary":"canvas"}' }])
  expect(await createClaudeGenerator().generate(request())).toEqual({ summary: 'canvas' })
  for (const events of [
    [],
    [{ type: 'result', subtype: 'error_during_execution' }],
    [{ type: 'result', subtype: 'success', is_error: true }],
  ]) {
    const close = messages(events)
    await expect(createClaudeGenerator().generate(request())).rejects.toThrow()
    expect(close).toHaveBeenCalled()
  }
})
