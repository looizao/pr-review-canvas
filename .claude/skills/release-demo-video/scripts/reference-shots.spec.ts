// Reference screenshots of the real UI for a release video. Copy into browser/, run with
// `SHOTS_DIR=<dir> npx playwright test browser/reference-shots.spec.ts --project=desktop`,
// then delete the copy. Add shots for whatever the release changed.
import { expect, test } from './fixtures.js'

const OUT = process.env['SHOTS_DIR'] ?? 'shots'

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only')
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('canvas, AI Chat, and settings', async ({ page, chatServer }) => {
  const comment = JSON.stringify({ path: 'src/app.ts', line: 4, side: 'new', body: 'Should `b()` guard against an empty list?' })
  const { url } = await chatServer({
    checkout: { delayMs: 2500 },
    runner: {
      delayMs: 120,
      script: [
        { type: 'chunk', text: 'Mostly. `b()` runs after `a()`, but nothing checks the empty case.\n\n' },
        { type: 'chunk', text: '```comment\n' + comment + '\n```\n' },
        { type: 'done', stopReason: 'end_turn' },
      ],
    },
  })
  await page.goto(url)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/overview.png` })
  await page.screenshot({ path: `${OUT}/overview-full.png`, fullPage: true })

  await page.locator('#msg').fill('Is the new run path safe on empty input?')
  await page.locator('#chat-send').click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/chat-running.png` })
  await expect(page.locator('.proposed')).toBeVisible({ timeout: 10000 })
  await page.screenshot({ path: `${OUT}/chat-proposed.png` })

  await page.locator('#settings').click()
  const dialog = page.locator('#settings-dialog')
  for (const tab of await dialog.getByRole('tab').allTextContents()) {
    await dialog.getByRole('tab', { name: tab }).click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${OUT}/settings-${tab.replaceAll(' ', '')}.png` })
  }
})

test('dark theme', async ({ page, reviewUrl }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(reviewUrl)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/dark.png` })
})
