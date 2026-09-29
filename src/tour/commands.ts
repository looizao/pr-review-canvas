// `pr-review tour <prepare|validate|preview|publish>`: the tour's own steps, mirroring the canvas
// commands. Everything is injected: the AppContext carries git, the host, and the stores.
import path from 'node:path'
import { parseArgs } from 'node:util'
import { HARNESSES } from '../contract/review-artifact.js'
import { formatTourError } from '../contract/tour.js'
import { type CliIo, EXIT, parsePrepareTarget, printJson, UsageError } from '../commands.js'
import { PublishError } from '../review/publish.js'
import type { AppContext } from '../server/context.js'
import { startQuietServer } from '../server/node-server.js'
import {
  TOUR_PREVIEW_OPTIONS as PREVIEW_OPTIONS,
  TOUR_PUBLISH_OPTIONS as PUBLISH_OPTIONS,
  TOUR_VALIDATE_OPTIONS as VALIDATE_OPTIONS,
} from './named-dir.js'
import { prepareTour } from './prepare.js'
import { headlessScreenshot, previewTour } from './preview.js'
import { publishTour, readTourContext, readTourModel, tourValidationInput } from './publish.js'
import { validateTourModel } from './validate.js'

export const TOUR_STEPS = ['prepare', 'validate', 'preview', 'publish'] as const
export type TourStep = (typeof TOUR_STEPS)[number]

/** The step named, or a usage error naming the four. */
export function parseTourStep(argv: string[]): { step: TourStep; rest: string[] } {
  const [step, ...rest] = argv
  const hit = TOUR_STEPS.find(s => s === step)
  if (hit === undefined) {
    throw new UsageError(`tour takes a step: pr-review tour <${TOUR_STEPS.join('|')}> …`)
  }
  return { step: hit, rest }
}

function parseHarness(raw: string | undefined): (typeof HARNESSES)[number] {
  const hit = HARNESSES.find(h => h === raw)
  if (hit === undefined) throw new UsageError(`tour publish needs --harness <${HARNESSES.join('|')}>`)
  return hit
}

export async function runTour(ctx: AppContext, argv: string[], io: CliIo): Promise<number> {
  const { step, rest } = parseTourStep(argv)
  switch (step) {
    case 'prepare':
      return runTourPrepare(ctx, rest, io)
    case 'validate':
      return runTourValidate(ctx, rest, io)
    case 'preview':
      return runTourPreview(ctx, rest, io)
    default:
      return runTourPublish(ctx, rest, io)
  }
}

async function runTourPrepare(ctx: AppContext, argv: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      pr: { type: 'string' },
      base: { type: 'string' },
      head: { type: 'string' },
      branch: { type: 'boolean' },
      uncommitted: { type: 'boolean' },
      force: { type: 'boolean' },
    },
    strict: true,
  })
  const result = await prepareTour(ctx, parsePrepareTarget(values), {
    force: values.force === true,
    log: phase => io.stderr(phase),
  })
  printJson(io, result)
  return EXIT.ok
}

/** `tour validate <tour-model.json> --tour <dir> [--human]`: the report as one JSON line, or as lines. */
async function runTourValidate(ctx: AppContext, argv: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: VALIDATE_OPTIONS,
    allowPositionals: true,
    strict: true,
  })
  const file = positionals[0]
  if (file === undefined || positionals.length > 1) {
    throw new UsageError(
      'tour validate takes one file: pr-review tour validate <tour-model.json> --tour <dir>'
    )
  }
  if (values.tour === undefined)
    throw new UsageError('tour validate needs --tour <dir> (the tourDir prepare printed)')
  const context = await readTourContext(path.resolve(values.tour))
  const model = await readTourModel(context, path.resolve(file))
  const report =
    'error' in model
      ? { ok: false, errors: [{ code: 'SCHEMA' as const, where: '(root)', message: model.error.message }] }
      : validateTourModel(model.raw, await tourValidationInput(ctx, context, model.raw))
  if (values.human !== true) {
    printJson(io, { ok: report.ok, errors: report.errors })
    return report.ok ? EXIT.ok : EXIT.invalid
  }
  if (report.ok) {
    io.stdout(
      `ok: ${path.basename(file)} passes, ${context.budget.landmarks} landmarks, ${context.budget.decisions} decisions, ${context.budget.quiz} questions in the budget`
    )
  } else {
    for (const e of report.errors) io.stdout(formatTourError(e))
  }
  return report.ok ? EXIT.ok : EXIT.invalid
}

/** `tour preview <dir> [--landmark <id>]`: screenshots of the tour as written, before it is published. */
async function runTourPreview(ctx: AppContext, argv: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: PREVIEW_OPTIONS,
    allowPositionals: true,
    strict: true,
  })
  const tourDir = positionals[0]
  if (tourDir === undefined || positionals.length > 1) {
    throw new UsageError(
      'tour preview takes one directory: pr-review tour preview <tourDir> [--landmark <id>]'
    )
  }
  const result = await previewTour(
    ctx,
    path.resolve(tourDir),
    {
      env: process.env,
      platform: process.platform,
      startServer: startQuietServer,
      screenshot: headlessScreenshot,
    },
    { landmark: values.landmark }
  )
  printJson(io, result)
  return EXIT.ok
}

async function runTourPublish(ctx: AppContext, argv: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: PUBLISH_OPTIONS,
    allowPositionals: true,
    strict: true,
  })
  const tourDir = positionals[0]
  if (tourDir === undefined || positionals.length > 1) {
    throw new UsageError(
      'tour publish takes one directory: pr-review tour publish <tourDir> --agent <id> --harness <id>'
    )
  }
  if (values.agent === undefined || values.agent === '')
    throw new UsageError('tour publish needs --agent <id>')
  const result = await publishTour(ctx, path.resolve(tourDir), {
    agent: values.agent,
    model: values.model,
    harness: parseHarness(values.harness),
    allowStale: values['allow-stale'] === true,
  })
  if (result.sharing.status === 'failed')
    io.stderr(`${result.sharing.warning} ZIP: ${result.sharing.zipPath}`)
  printJson(io, result)
  return EXIT.ok
}

export { PublishError }
