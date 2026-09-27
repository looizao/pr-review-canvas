// `pr-review deck preview`: what the deck page shows for the deck as written, before it is
// published. The page draws it from the work files in preview mode, and a Chrome-family browser
// already on this machine takes a screenshot of every card, so a generator can look at its scenes
// instead of drawing blind. Nothing is published, and no pick is touched.
import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { findOnPath } from '../acpx/acpx.js'
import type { ReviewKey } from '../contract/review-key.js'
import type { AppContext } from '../server/context.js'
import { previewDeck } from './publish-deck.js'

/** The desktop screen a card is drawn for: the size the deck page promises to fit. */
export const PREVIEW_VIEWPORT = { width: 1920, height: 1080 } as const

export interface PreviewDeckResult {
  status: 'previewed' | 'no-browser'
  review: ReviewKey
  cards: number
  /** One screenshot per card, in deck order; empty without a browser. */
  screenshots: string[]
  /** The same preview on a running `pr-review serve`, for a browser tool. */
  previewUrl: string
  hint?: string
}

/** A running copy of the review server that the browser loads the preview from. */
export interface PreviewServer {
  origin: string
  close(): Promise<void>
}

export interface PreviewDeps {
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  startServer(ctx: AppContext): Promise<PreviewServer>
  /** Loads `url` in the browser at the viewport, and writes what it shows to `file`. */
  screenshot(browser: string, url: string, file: string): Promise<void>
}

/** Where each platform keeps the browsers tried, after `PR_REVIEW_BROWSER` and the PATH. */
function installedBrowsers(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform === 'darwin') {
    return ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser'].map(
      app => `/Applications/${app}.app/Contents/MacOS/${app}`
    )
  }
  if (platform === 'win32') {
    const roots = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA']].filter(
      (root): root is string => root !== undefined
    )
    return roots.flatMap(root => [
      path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ])
  }
  return []
}

/** Names a Chrome-family browser goes by on a PATH. */
const BROWSER_NAMES = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'microsoft-edge',
  'microsoft-edge-stable',
  'brave-browser',
]

/** The browser to take screenshots with: `PR_REVIEW_BROWSER`, else the first one installed. */
export function findBrowser(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | null {
  const chosen = env['PR_REVIEW_BROWSER']
  if (chosen !== undefined && chosen !== '') {
    return chosen
  }
  for (const name of BROWSER_NAMES) {
    const found = findOnPath(name, env)
    if (found !== null) return found
  }
  for (const file of installedBrowsers(platform, env)) {
    try {
      accessSync(file, constants.X_OK)
      return file
    } catch {
      // Not installed there.
    }
  }
  return null
}

/**
 * Screenshots every card of the deck as written. Validation runs first, so an invalid deck throws
 * its problems as `deck publish` would. Without a browser, it says where to look instead.
 */
export async function previewDeckCards(
  ctx: AppContext,
  review: ReviewKey,
  deps: PreviewDeps
): Promise<PreviewDeckResult> {
  const deck = await previewDeck(ctx, review)
  const base = {
    review,
    cards: deck.cards.length,
    previewUrl: `http://localhost:${ctx.config.port}/deck/${review}?preview`,
  }
  const browser = findBrowser(deps.env, deps.platform)
  if (browser === null) {
    return {
      ...base,
      status: 'no-browser',
      screenshots: [],
      hint: 'install Chrome, Chromium, or Edge, or set PR_REVIEW_BROWSER to one; or run `pr-review serve` and open previewUrl in a browser tool',
    }
  }
  const dir = path.join(ctx.decks.workDir(review), 'preview')
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const server = await deps.startServer(ctx)
  const screenshots: string[] = []
  try {
    for (const [i, card] of deck.cards.entries()) {
      const file = path.join(dir, `${String(i + 1).padStart(2, '0')}-${card.key}.png`)
      const url = `${server.origin}/deck/${review}?preview&card=${encodeURIComponent(card.key)}&theme=light`
      await deps.screenshot(browser, url, file)
      screenshots.push(file)
    }
  } finally {
    await server.close()
  }
  return { ...base, status: 'previewed', screenshots }
}

const run = promisify(execFile)

/**
 * One headless run of the browser per card, in a profile of its own that is removed after. Reduced
 * motion shows each scene at rest, the state that has to read on its own, and the virtual time
 * budget lets the frames load and fit before the picture is taken.
 */
export async function headlessScreenshot(browser: string, url: string, file: string): Promise<void> {
  const profile = await mkdtemp(path.join(tmpdir(), 'pr-review-preview-'))
  try {
    await run(
      browser,
      [
        '--headless',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        '--mute-audio',
        '--force-prefers-reduced-motion',
        `--user-data-dir=${profile}`,
        `--window-size=${PREVIEW_VIEWPORT.width},${PREVIEW_VIEWPORT.height}`,
        '--virtual-time-budget=5000',
        `--screenshot=${file}`,
        url,
      ],
      { timeout: 60_000 }
    )
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
}
