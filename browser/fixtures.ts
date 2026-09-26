import { once } from 'node:events'
import { serve } from '@hono/node-server'
import { test as base, expect, type Page } from '@playwright/test'
import { createApp } from '../src/server/app.js'
import { resolveVendorRoots } from '../src/server/context.js'
import { DEFAULT_PROJECT_CONFIG } from '../src/project-config.js'
import { createFakeRunner, type FakeRunnerOptions } from '../src/testing/fake-runner.js'
import {
  createFakeCheckoutGit,
  ghHandler,
  ghPost,
  makeTestContext,
  type TestContext,
  type TestContextOptions,
} from '../src/testing/fakes.js'
import { GH_REVIEW_COMMENTS, ghFor42, gitFor42, syntheticArtifact } from '../src/testing/synthetic.js'

export { expect } from '@playwright/test'

/** What a chat-enabled server is built with: how the fake agent and the fake checkout behave. */
export interface ChatServerOptions {
  runner?: FakeRunnerOptions
  checkout?: { delayMs?: number; fail?: string }
  /** Runs against the server's context before the page loads, e.g. to save settings. */
  setup?: (t: TestContext) => Promise<void>
}

/** A review server with AI Chat on, driven by a fake agent and fake review checkouts. */
export interface ChatServer {
  url: string
  ctx: TestContext['ctx']
}

export const test = base.extend<{
  reviewUrl: string
  chatServer: (options?: ChatServerOptions) => Promise<ChatServer>
}>({
  chatServer: async ({ page }, use) => {
    const stops: Array<() => Promise<void>> = []
    await use(async (options = {}) => {
      const server = await startServer(page, {
        projectConfig: {
          config: { ...DEFAULT_PROJECT_CONFIG, chat: { ...DEFAULT_PROJECT_CONFIG.chat, enabled: true } },
          warnings: [],
          source: null,
        },
        runner: createFakeRunner(options.runner),
        checkoutGit: createFakeCheckoutGit(options.checkout),
      })
      stops.push(server.stop)
      await options.setup?.(server.t)
      return { url: server.url, ctx: server.t.ctx }
    })
    for (const stop of stops) {
      await stop()
    }
  },
  reviewUrl: async ({ page }, use) => {
    const server = await startServer(page)
    try {
      await use(server.url)
    } finally {
      await server.stop()
    }
  },
})

/** Serves PR 42 on a free port; `stop` fails the test if the page threw or a request 500ed. */
async function startServer(
  page: Page,
  extra: Partial<TestContextOptions> = {}
): Promise<{ url: string; t: TestContext; stop: () => Promise<void> }> {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 500) {
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`)
    }
  })
  let submitted: Array<Record<string, unknown>> = []
  const t = await makeTestContext({
    git: gitFor42(),
    gh: ghFor42({
      routes: { 'repos/acme/widgets/pulls/42/reviews/7001/comments': ghHandler(() => submitted) },
      postRoutes: {
        'repos/acme/widgets/pulls/42/reviews': ghPost(body => {
          const input = body as {
            comments?: Array<Record<string, unknown>>
            event: string
            commit_id: string
          }
          submitted = (input.comments ?? []).map((comment, index) => ({
            ...GH_REVIEW_COMMENTS[0],
            ...comment,
            id: 8001 + index,
            commit_id: input.commit_id,
            original_line: comment['line'],
            html_url: `https://github.com/acme/widgets/pull/42#discussion_r${8001 + index}`,
          }))
          return {
            id: 7001,
            state: 'COMMENTED',
            html_url: 'https://github.com/acme/widgets/pull/42#pullrequestreview-7001',
          }
        }),
        'repos/acme/widgets/pulls/42/comments': ghPost(body => ({
          ...GH_REVIEW_COMMENTS[0],
          ...(body as Record<string, unknown>),
          id: 5001,
          html_url: 'https://github.com/acme/widgets/pull/42#discussion_r5001',
        })),
      },
    }),
    fixtureArtifact: syntheticArtifact(),
    vendorRoots: resolveVendorRoots(),
    ...extra,
  })
  const server = serve({ fetch: createApp(t.ctx).fetch, port: 0, hostname: '127.0.0.1' })
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('test server did not bind a port')
  }
  const origin = `http://127.0.0.1:${address.port}`
  const stop = async (): Promise<void> => {
    try {
      if ('closeAllConnections' in server) {
        server.closeAllConnections()
      }
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
    } finally {
      await t.cleanup()
    }
    expect(errors).toEqual([])
  }
  return { url: `${origin}/review/42`, t, stop }
}
