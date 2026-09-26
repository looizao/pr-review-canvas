// The idle sweep `serve` runs: at startup, then every `checkoutSweepMinutes`. The settings are read
// again on each run, so a change in the dialog applies from the next one without a restart.
import { CHECKOUT_IDLE_NEVER, type Settings } from '../contract/settings.js'
import type { ReviewCheckouts, SweepResult } from './checkouts.js'

export interface CheckoutSweeper {
  /** Runs one sweep now; resolves to null when idle cleanup is off. */
  runOnce(): Promise<SweepResult | null>
  stop(): void
}

export function startCheckoutSweep(opts: {
  checkouts: ReviewCheckouts
  readSettings: () => Promise<Settings>
  log: (line: string) => void
  /** Tests pass their own timer. */
  setTimer?: (run: () => void, ms: number) => { unref?: () => void; clear: () => void }
}): CheckoutSweeper {
  const setTimer =
    opts.setTimer ??
    ((run, ms) => {
      const handle = setTimeout(run, ms)
      return { unref: () => handle.unref(), clear: () => clearTimeout(handle) }
    })
  let timer: { clear: () => void } | null = null
  let stopped = false

  const runOnce = async (): Promise<SweepResult | null> => {
    const settings = await opts.readSettings()
    if (settings.checkoutIdleDays === CHECKOUT_IDLE_NEVER) {
      return null
    }
    const result = await opts.checkouts.sweep({ olderThanDays: settings.checkoutIdleDays })
    for (const removed of result.removed) {
      opts.log(`removed the idle review checkout of ${String(removed.key)} (last used ${removed.lastUsedAt})`)
    }
    return result
  }

  const schedule = async (): Promise<void> => {
    if (stopped) {
      return
    }
    await runOnce().catch((err: unknown) => {
      opts.log(`review checkout sweep failed: ${err instanceof Error ? err.message : String(err)}`)
    })
    if (stopped) {
      return
    }
    const minutes = (await opts.readSettings().catch(() => null))?.checkoutSweepMinutes ?? 60
    const next = setTimer(() => void schedule(), minutes * 60 * 1000)
    // A pending sweep never keeps the process alive on its own.
    next.unref?.()
    timer = next
  }

  void schedule()
  return {
    runOnce,
    stop: () => {
      stopped = true
      timer?.clear()
    },
  }
}
