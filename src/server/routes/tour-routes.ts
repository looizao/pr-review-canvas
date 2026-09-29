// The tour's API: the bundle the page opens with, the reader's state between visits, and finishing.
import { Hono } from 'hono'
import { TourFinishInputSchema, TourReaderInputSchema } from '../../contract/tour-api.js'
import { resolveTourBundle, tourReviewer } from '../../tour/bundle.js'
import { finishTour } from '../../tour/finish.js'
import { lookupTour } from '../../tour/lookup.js'
import { readReaderState, writeReaderState } from '../../tour/reader.js'
import type { PrLoader } from '../bundle.js'
import type { AppContext } from '../context.js'
import { AppError } from '../errors.js'
import { oneAtATime } from '../one-at-a-time.js'
import { parseTargetKey } from './api.js'
import { readBody } from './review-routes.js'

/** The stored tour the page is on, which must be the one a write names. */
async function tourOnScreen(
  ctx: AppContext,
  loader: PrLoader,
  key: ReturnType<typeof parseTargetKey>,
  headSha: string
) {
  const found = await lookupTour(ctx, loader, key)
  if (found.status === 'missing') {
    throw new AppError('CANVAS_NOT_FOUND', `no tour of ${String(key)}`, 404, 'generate one with /pr-tour')
  }
  if (found.headSha !== headSha) {
    throw new AppError(
      'CANVAS_STALE',
      `the tour on screen is of ${headSha.slice(0, 7)}, and this server now shows ${found.headSha.slice(0, 7)}`,
      409,
      'reload the page'
    )
  }
  return found
}

/** One finish of a tour at a time, so the record shared last holds every reader. */
const finishInTurn = oneAtATime<string>()

export function tourRoutes(ctx: AppContext, loader: PrLoader): Hono {
  const api = new Hono()

  api.get('/tours/:n', async c => {
    const key = parseTargetKey(c.req.param('n'))
    const bundle = await resolveTourBundle(ctx, loader, key, {
      preview: c.req.query('preview') !== undefined,
    })
    return c.json(bundle)
  })

  api.put('/tours/:n/reader', async c => {
    const key = parseTargetKey(c.req.param('n'))
    const input = await readBody(c.req.raw, TourReaderInputSchema, '{ "headSha": "…", "reader": { … } }')
    const found = await tourOnScreen(ctx, loader, key, input.headSha)
    // What was already finished stays finished: the page never unfinishes a tour by saving.
    const previous = await readReaderState(ctx, found.headSha, found.artifact, false)
    const reader =
      previous.finished === undefined ? input.reader : { ...input.reader, finished: previous.finished }
    await writeReaderState(ctx, found.headSha, reader)
    return c.json(reader)
  })

  api.post('/tours/:n/finish', async c => {
    const key = parseTargetKey(c.req.param('n'))
    const input = await readBody(c.req.raw, TourFinishInputSchema, '{ "headSha": "…" }')
    // The tour is read inside the turn, so a finish sees the record the one before it wrote.
    const answer = await finishInTurn(input.headSha, async () => {
      const found = await tourOnScreen(ctx, loader, key, input.headSha)
      const reviewer = await tourReviewer(ctx, key, found.pr)
      const reader = await readReaderState(ctx, found.headSha, found.artifact, reviewer.author)
      return finishTour(ctx, { key, headSha: found.headSha, artifact: found.artifact, reader, reviewer })
    })
    return c.json(answer)
  })

  return api
}
