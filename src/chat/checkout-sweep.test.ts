// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '../contract/settings.js'
import type { ReviewCheckouts, SweepOptions } from './checkouts.js'
import { startCheckoutSweep } from './checkout-sweep.js'

function fakeCheckouts(): ReviewCheckouts & { sweeps: SweepOptions[] } {
  const sweeps: SweepOptions[] = []
  return {
    sweeps,
    root: '/data/checkouts',
    lease: () => Promise.reject(new Error('not used')),
    list: async () => [],
    size: async () => 0,
    sweep: async options => {
      sweeps.push(options)
      return {
        removed: [{ key: 42, dir: '/data/checkouts/42', sha: 'a', lastUsedAt: 'then', locked: false }],
        skipped: [],
      }
    },
  }
}

describe('startCheckoutSweep', () => {
  it('sweeps at startup with the idle limit, then again after the configured minutes', async () => {
    const checkouts = fakeCheckouts()
    const timers: number[] = []
    let fire = (): void => undefined
    const settings: Settings = { ...DEFAULT_SETTINGS, checkoutIdleDays: 3, checkoutSweepMinutes: 15 }
    const lines: string[] = []
    const sweeper = startCheckoutSweep({
      checkouts,
      readSettings: async () => settings,
      log: line => lines.push(line),
      setTimer: (run, ms) => {
        timers.push(ms)
        fire = run
        return { clear: () => undefined }
      },
    })
    await expect.poll(() => timers).toEqual([15 * 60 * 1000])
    expect(checkouts.sweeps).toEqual([{ olderThanDays: 3 }])
    expect(lines).toEqual(['removed the idle review checkout of 42 (last used then)'])
    fire()
    await expect.poll(() => checkouts.sweeps.length).toBe(2)
    sweeper.stop()
  })

  it('removes nothing while idle cleanup is off', async () => {
    const checkouts = fakeCheckouts()
    const sweeper = startCheckoutSweep({
      checkouts,
      readSettings: async () => ({ ...DEFAULT_SETTINGS, checkoutIdleDays: -1 }),
      log: () => undefined,
      setTimer: () => ({ clear: () => undefined }),
    })
    expect(await sweeper.runOnce()).toBeNull()
    expect(checkouts.sweeps).toEqual([])
    sweeper.stop()
  })
})
