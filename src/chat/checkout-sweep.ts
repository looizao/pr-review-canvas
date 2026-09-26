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
}): CheckoutSweeper {
  let timer: NodeJS.Timeout | undefined
  let stopped = false

  const sweepWith = async (settings: Settings): Promise<SweepResult | null> => {
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
    // The settings store answers the defaults for a missing or broken file; it does not throw.
    const settings = await opts.readSettings()
    await sweepWith(settings).catch((err: unknown) => {
      opts.log(`review checkout sweep failed: ${err instanceof Error ? err.message : String(err)}`)
    })
    if (stopped) {
      return
    }
    timer = setTimeout(() => void schedule(), settings.checkoutSweepMinutes * 60 * 1000)
    // A pending sweep never keeps the process alive on its own.
    timer.unref()
  }

  void schedule()
  return {
    runOnce: async () => sweepWith(await opts.readSettings()),
    stop: () => {
      stopped = true
      clearTimeout(timer)
    },
  }
}
