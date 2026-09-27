import type { Page } from '@playwright/test'
import { HEAD_SHA } from '../src/testing/synthetic.js'
import { expect, test } from './fixtures.js'

const SHORT = HEAD_SHA.slice(0, 7)

test.beforeEach(async ({ page }, testInfo) => {
  // The chat pane docks on a wide screen; the narrower layouts are covered by chat-panel.spec.ts.
  test.skip(testInfo.project.name !== 'desktop', 'desktop layout only')
  await page.setViewportSize({ width: 1440, height: 900 })
})

async function ask(page: Page, question: string): Promise<void> {
  await page.locator('#msg').fill(question)
  await page.locator('#chat-send').click()
}

test('shows the review checkout being created, and only on the turn that creates it', async ({
  page,
  chatServer,
}) => {
  const { url } = await chatServer({ checkout: { delayMs: 1500 }, runner: { delayMs: 150 } })
  await page.goto(url)
  const pane = page.locator('.layout > .chat')
  await expect(pane).toBeVisible()

  await ask(page, 'Is the new flag covered by a test?')
  const first = pane.locator('.turn.a').first()
  await expect(first.locator('.chat-activity')).toContainText(`Creating the review checkout at ${SHORT}`)
  await expect(first.locator('.prose')).toContainText('The behavior is covered at')
  await expect(first.locator('.chat-activity')).toContainText('Elapsed')

  // The checkout is already at this commit, so the second turn goes straight to the answer.
  await ask(page, 'And the error path?')
  const second = pane.locator('.turn.a').nth(1)
  await expect(second.locator('.chat-activity')).not.toContainText('review checkout')
  await expect(second.locator('.prose')).toContainText('The behavior is covered at')
  await expect(second.locator('.chat-activity')).toContainText('Elapsed')
})

test("warns when the review checkout fails and the answer read the reader's checkout", async ({
  page,
  chatServer,
}) => {
  const { url } = await chatServer({
    checkout: { delayMs: 800, fail: 'git worktree add failed: No space left on device' },
    runner: { delayMs: 150 },
  })
  await page.goto(url)
  await ask(page, 'Is this safe?')
  const answer = page.locator('.layout > .chat .turn.a').first()
  const warning = answer.locator('.chat-warning')
  await expect(warning).toContainText('The review checkout could not be updated')
  await expect(warning).toContainText('No space left on device')
  await expect(answer.locator('.prose')).toContainText('The behavior is covered at')
  await expect(answer.locator('.chat-activity')).toContainText('Elapsed')
})

test('lists review checkouts in the settings Checkouts tab and saves its settings', async ({
  page,
  chatServer,
}) => {
  const { url, ctx } = await chatServer({ runner: { delayMs: 50 } })
  await page.goto(url)
  await ask(page, 'What does this change?')
  await expect(page.locator('.layout > .chat .turn.a .chat-activity')).toContainText('Elapsed')

  await page.locator('#settings').click()
  const dialog = page.locator('#settings-dialog')
  await expect(dialog.getByRole('tab')).toHaveText(['Reading', 'AI Chat', 'Checkouts', 'Project'])
  await dialog.getByRole('tab', { name: 'Checkouts' }).click()
  const panel = dialog.getByRole('tabpanel', { name: 'Checkouts' })
  await expect(panel.locator('.checkout-table tbody tr')).toHaveCount(1)
  await expect(panel.locator('.checkout-table tbody tr')).toContainText('#42')
  await expect(panel.locator('.checkout-table tbody tr')).toContainText(SHORT)
  await expect(dialog.getByRole('tabpanel', { name: 'Reading' })).toBeHidden()

  await panel.getByLabel('Remove after idle days').fill('-1')
  await panel.getByLabel('Check every (minutes)').fill('30')
  await page.locator('[data-act="settings-save"]').click()
  await expect(dialog).toBeHidden()
  await expect
    .poll(async () => {
      const saved = await ctx.settings.read()
      return [saved.checkoutIdleDays, saved.checkoutSweepMinutes]
    })
    .toEqual([-1, 30])

  // The dialog opens on the tab it was left on.
  await page.locator('#settings').click()
  await expect(dialog.getByRole('tabpanel', { name: 'Checkouts' })).toBeVisible()
})
