// The preview loop's browser: a Chrome-family browser already on this machine takes a screenshot
// of a page this server serves, so a generator can look at a landmark instead of writing it blind.
// Which pages, and where the pictures go, is the tour's business (`pr-review tour preview`).
import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { findOnPath } from '../acpx/acpx.js'
import type { AppContext } from '../server/context.js'

export interface Viewport {
  width: number
  height: number
}

/** The desktop the tour's stage is drawn for: the stage is 760 pixels wide and the page scrolls. */
export const PREVIEW_VIEWPORT: Viewport = { width: 1280, height: 1000 }
/** A phone, where a scene must still read: the design promises phone parity. */
export const PHONE_VIEWPORT: Viewport = { width: 390, height: 844 }

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
  screenshot(browser: string, url: string, file: string, viewport: Viewport): Promise<void>
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

/** What to tell a generator when no browser is found. */
export const NO_BROWSER_HINT =
  'install Chrome, Chromium, or Edge, or set PR_REVIEW_BROWSER to one; or run `pr-review serve` and open previewUrl in a browser tool'

const run = promisify(execFile)

/**
 * One headless run of the browser per page, in a profile of its own that is removed after. Reduced
 * motion shows each scene at rest, the state that has to read on its own, and the virtual time
 * budget lets the frames load and size themselves before the picture is taken.
 */
export async function headlessScreenshot(
  browser: string,
  url: string,
  file: string,
  viewport: Viewport = PREVIEW_VIEWPORT
): Promise<void> {
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
        `--window-size=${viewport.width},${viewport.height}`,
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
