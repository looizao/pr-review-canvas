import { writeFile } from 'node:fs/promises'
import { expect, test } from './fixtures.js'
import { syntheticArtifact } from '../src/testing/synthetic.js'

// Release 0.6 browser regressions retained from the adversarial audit.
for (const receipt of ['available', 'unavailable']) {
  test(`proposed comment survives queue, reload, delete, and submission with receipt ${receipt}`, async ({
    page,
    chatServer,
  }) => {
    const narrow = (page.viewportSize()?.width ?? 1440) < 1200
    const openChat = async () => {
      if (narrow) await page.getByRole('button', { name: 'AI Chat', exact: true }).click()
    }
    const closeChat = async () => {
      if (narrow) await page.getByRole('button', { name: 'Minimize AI Chat' }).click()
    }
    const proposal = {
      path: 'src/app.ts',
      line: 5,
      startLine: 4,
      body: 'Cover both lines with a regression test.',
    }
    const { url } = await chatServer({
      setup: async ({ ctx }) => {
        if (receipt === 'unavailable') {
          const api = ctx.gh.api.bind(ctx.gh)
          ctx.gh.api = async (path, params) => {
            if (path.endsWith('/reviews/7001/comments')) throw new Error('receipt temporarily unavailable')
            return api(path, params)
          }
        }
      },
      runner: {
        script: [
          { type: 'chunk', text: '```comment\n' + JSON.stringify(proposal) + '\n```' },
          { type: 'done', stopReason: 'end_turn' },
        ],
      },
    })
    await page.goto(url)
    await openChat()
    await page.locator('#msg').fill('Propose a comment')
    await page.locator('#chat-send').click()
    const card = page.locator('.proposed')
    await card.locator('[data-act="proposed-queue"]').click()
    await expect(card).toContainText('in your review')
    await page.reload()
    await openChat()
    await expect(card).toContainText('in your review')
    await expect(page.locator('.pending-bar')).toContainText('1 pending comment')
    await closeChat()
    await page.locator('article.file[data-path="src/app.ts"]').first().scrollIntoViewIfNeeded()
    await page.locator('[data-act="pending-delete"]').click()
    await openChat()
    await expect(card.locator('[data-act="proposed-queue"]')).toBeVisible()
    await card.locator('[data-act="proposed-queue"]').click()
    await closeChat()
    await page.locator('[data-act="pending-finish"]').click()
    await page.locator('[data-act="signoff-post"]').click()
    await expect(page.locator('.signoff-result')).toContainText('Posted')
    await page.locator('[data-act="signoff-close"]').click()
    await openChat()
    if (receipt === 'available') {
      await expect(card.locator('a[href$="discussion_r8001"]')).toHaveCount(1)
    } else {
      await expect(card.locator('.tbtns')).toContainText('submitted')
      await expect(card.locator('a')).toHaveCount(0)
    }
    await expect(card.locator('[data-act="proposed-queue"]')).toHaveCount(0)
    await expect(card.locator('[data-act="proposed-post"]')).toHaveCount(0)
    await page.reload()
    await openChat()
    if (receipt === 'available') {
      await expect(card.locator('a[href$="discussion_r8001"]')).toHaveCount(1)
    } else {
      await expect(card.locator('.tbtns')).toContainText('submitted')
      await expect(card.locator('a')).toHaveCount(0)
    }
    await expect(card.locator('[data-act="proposed-queue"], [data-act="proposed-post"]')).toHaveCount(0)
  })
}

test('settling with sharing disabled and the reason unchecked stays local across reload', async ({
  page,
  chatServer,
}) => {
  const { url, ctx } = await chatServer({
    setup: async t => {
      t.ctx.fixtureArtifact = null
      t.ctx.projectConfig = {
        ...t.ctx.projectConfig,
        config: { ...t.ctx.projectConfig.config, sharing: { canvasComment: false, mentionCanvas: false } },
      }
      const artifact = syntheticArtifact()
      artifact.points[0] = { ...artifact.points[0]!, audience: 'author' }
      await t.ctx.canvases.write(
        artifact.pr.headSha,
        artifact,
        {
          formatVersion: 1,
          tool: { name: 'pr-review', version: '0.5.0' },
          repo: artifact.pr.repo,
          prNumber: 42,
          headSha: artifact.pr.headSha,
          mergeBaseSha: artifact.pr.mergeBaseSha,
          generatedAt: artifact.generatedAt,
          generator: artifact.generator,
          baseRef: 'main',
          headRef: 'feat/b',
        },
        42
      )
    },
  })
  await page.goto(url)
  const point = page.locator('section.layer li.finding[data-fingerprint="fp-1"]')
  await point.locator('[data-act="point-settle"]').click()
  await point.locator('[name="settle-reason"]').fill('This decision stays in the local canvas.')
  await point.locator('[name="settle-comment"]').uncheck()
  await point.locator('[data-act="settle-save"]').click()
  await expect(page.locator('.toast')).toContainText('canvas comment is off')
  await page.reload()
  await expect(point).toBeHidden()
  expect((await ctx.canvases.readArtifact(syntheticArtifact().pr.headSha))?.settled?.['fp-1']?.reason).toBe(
    'This decision stays in the local canvas.'
  )
})

test('saving Reading settings migrates legacy chat keys and preserves sharing overrides', async ({
  page,
  chatServer,
}) => {
  const { url, ctx } = await chatServer({
    setup: async t => {
      await writeFile(
        t.ctx.settings.file,
        'agent: codex\nmodel: chosen-model\ncanvasComment: false\nmentionCanvas: false\n'
      )
    },
  })
  await page.goto(url)
  await page.locator('#settings').click()
  await page.locator('#set-layer-view').selectOption('one')
  await page.locator('[data-act="settings-save"]').click()
  await expect(page.locator('#settings-dialog')).toBeHidden()
  expect(await ctx.settings.read()).toMatchObject({
    chatAgent: 'codex',
    chatModel: 'chosen-model',
    canvasComment: false,
    mentionCanvas: false,
    layerView: 'one',
  })
  await page.reload()
  await expect(page.locator('#overview')).toBeVisible()
  await expect(page.locator('#layer-run-path')).toBeHidden()
})

test('one-layer navigation supports deep links and browser back/forward', async ({ page, reviewUrl }) => {
  await page.goto(reviewUrl)
  await page.locator('#settings').click()
  await page.locator('#set-layer-view').selectOption('one')
  await page.locator('[data-act="settings-save"]').click()
  await page.locator('nav.rail a[href="#layer-run-path"]').click()
  await page.locator('nav.rail a[href="#layer-other"]').click()
  await page.goBack()
  await expect(page.locator('#layer-run-path')).toBeVisible()
  await expect(page.locator('#layer-other')).toBeHidden()
  await page.goForward()
  await expect(page.locator('#layer-other')).toBeVisible()
  await page.goto(reviewUrl + '#line:src/app.ts:4')
  await expect(page.locator('#layer-run-path')).toBeVisible()
  await expect(page.locator('#L-src_app_ts-new-4')).toBeInViewport()
})

test('marking the only displayed layer reviewed stays on that layer', async ({ page, reviewUrl }) => {
  await page.goto(reviewUrl)
  await page.locator('#settings').click()
  await page.locator('#set-layer-view').selectOption('one')
  await page.locator('[data-act="settings-save"]').click()
  await expect(page.locator('#settings-dialog')).toBeHidden()
  await page.keyboard.press('j')
  await page.keyboard.press('R')
  await expect(page.locator('#layer-run-path')).toBeVisible()
  await expect(page.locator('#layer-other')).toBeHidden()
  await expect(page.locator('.toast')).toContainText('layer marked reviewed')
})

test('file name single/double/triple clicks preserve the intended collapsed state', async ({
  page,
  reviewUrl,
}) => {
  await page.goto(reviewUrl)
  const file = page.locator('article.file').first()
  const name = file.locator('[data-act="toggle-card"]').filter({ hasText: 'src/app.ts' })
  const body = file.locator('.file-body')
  await name.click()
  await expect(body).toBeHidden()
  await name.dblclick()
  await expect(body).toBeHidden()
  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  await name.click({ clickCount: 3 })
  await expect(body).toBeHidden()
})

test('a failed settlement preserves the reason for retry', async ({ page, selfReviewUrl }) => {
  await page.goto(selfReviewUrl)
  const point = page.locator('section.layer li.finding[data-fingerprint="fp-1"]')
  await point.locator('[data-act="point-settle"]').click()
  const text = point.locator('[name="settle-reason"]')
  await text.fill('The API is intentionally internal.')
  await page.route('**/api/prs/42/points/fp-1/settled', route =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'CANVAS_STALE', message: 'Head changed' } }),
    })
  )
  await point.locator('[data-act="settle-save"]').click()
  await expect(text).toHaveValue('The API is intentionally internal.')
  await expect(point.locator('[data-act="settle-save"]')).toBeEnabled()
  await page.unroute('**/api/prs/42/points/fp-1/settled')
  await point.locator('[data-act="settle-save"]').click()
  await expect(point).toBeHidden()
})

test('self-review ignores personal dismissals and offers only resolve for author points', async ({
  page,
  selfReviewUrl,
}) => {
  await page.goto(selfReviewUrl)
  // Simulate marks saved by an earlier version, before self-review stopped offering dismiss.
  for (const fingerprint of ['fp-1', 'fp-2', 'fp-3']) {
    await page.evaluate(async fp => {
      const response = await fetch(`/api/prs/42/points/${fp}/dismissed`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
      if (!response.ok) throw new Error(await response.text())
    }, fingerprint)
  }
  await page.reload()
  await expect(page.locator('.self-review-note')).toContainText('3 points are marked yours')
  await expect(page.locator('[data-act="point-dismiss"]')).toHaveCount(0)
  await expect(page.locator('[data-act="point-restore"]')).toHaveCount(0)
  const card = page.locator('section.layer li.finding[data-fingerprint="fp-1"]')
  await expect(card.getByRole('button', { name: 'resolve', exact: true })).toBeVisible()
  await page.keyboard.press(']')
  await page.keyboard.press('d')
  await expect(card).toBeVisible()
  await expect(page.locator('.dismissed-list')).toBeHidden()
  await expect(page.locator('.self-review-note')).not.toContainText('Self-review done')
})

test('settings tabs are usable at a phone width', async ({ page, chatServer }) => {
  const { url } = await chatServer()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url)
  await page.locator('#settings').click()
  const dialog = page.locator('#settings-dialog')
  for (const name of ['AI Chat', 'Checkouts', 'Project', 'Reading']) {
    await dialog.getByRole('tab', { name, exact: true }).click()
    await expect(dialog.getByRole('tabpanel', { name, exact: true })).toBeVisible()
  }
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
})
