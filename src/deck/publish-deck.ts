// `pr-review deck validate` and `pr-review deck publish`: check the generated deck-model.json, with
// the scene files beside it, against the context `deck prepare` wrote, and publish it as the
// review's deck.
import { createHash } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { type Deck, type DeckContext, DeckContextSchema, type DecisionCard } from '../contract/deck.js'
import { isLocalKey, keyLabel, type ReviewKey } from '../contract/review-key.js'
import { resolveLocalHead } from '../git/local-target.js'
import type { AppContext } from '../server/context.js'
import { AppError } from '../server/errors.js'
import { readJson, readText } from '../store/atomic-json.js'
import { DECK_SCENES_DIR } from './prepare-deck.js'
import { type DeckProblem, validateDeckModel } from './validate-deck.js'

export class DeckInvalidError extends Error {
  readonly problems: DeckProblem[]

  constructor(problems: DeckProblem[]) {
    super(`deck-model.json has ${problems.length} problem${problems.length === 1 ? '' : 's'}`)
    this.name = 'DeckInvalidError'
    this.problems = problems
  }
}

export async function readDeckContext(ctx: AppContext, review: ReviewKey): Promise<DeckContext> {
  const file = path.join(ctx.decks.workDir(review), 'context.json')
  const context = await readJson(file, DeckContextSchema)
  if (context === null) {
    throw new AppError(
      'DECK_NOT_FOUND',
      `no prepared deck for ${keyLabel(review)}`,
      404,
      `run \`pr-review deck prepare ${isLocalKey(review) ? `--${review}` : `--pr ${review}`}\` first`
    )
  }
  return context
}

/** The deck's cards once they pass, or the problems that stop them. */
export async function checkDeckModel(
  context: DeckContext
): Promise<{ ok: true; cards: Deck['cards'] } | { ok: false; problems: DeckProblem[] }> {
  const text = await readText(context.modelPath)
  if (text === null) {
    throw new AppError(
      'DECK_NOT_FOUND',
      `${context.modelPath} does not exist`,
      404,
      'write the deck there first'
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      problems: [{ code: 'DECK_SCHEMA', where: '(root)', message: `not valid JSON: ${reason}` }],
    }
  }
  const scenes = await readSceneFiles(path.join(path.dirname(context.modelPath), DECK_SCENES_DIR))
  const placed = placeSceneFiles(raw, scenes)
  const result = validateDeckModel(raw, { files: context.files, maxCards: context.maxCards })
  if (result.ok && placed.length === 0) return { ok: true, cards: result.model.cards }
  return { ok: false, problems: [...placed, ...(result.ok ? [] : result.problems)] }
}

/** A scene file's name: the card's key and the side. */
const SCENE_FILE_RE = /^([a-z0-9][a-z0-9-]{0,47})\.(a|b)\.html$/

/** The files of the scenes directory by name; none when it does not exist. */
async function readSceneFiles(dir: string): Promise<Map<string, string>> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
    throw err
  }
  const files = new Map<string, string>()
  for (const name of names.sort()) {
    files.set(name, (await readText(path.join(dir, name))) ?? '')
  }
  return files
}

/**
 * Puts each scene file into the side it names, in the parsed model, before it is validated. A
 * side with a scene in both places, and a file that names no side, are problems: either would
 * leave the author a scene other than the one the generator meant.
 */
function placeSceneFiles(raw: unknown, files: ReadonlyMap<string, string>): DeckProblem[] {
  const problems: DeckProblem[] = []
  const cards = (raw as { cards?: unknown } | null)?.cards
  const sides = new Map<string, Record<string, unknown>>()
  for (const card of Array.isArray(cards) ? (cards as unknown[]) : []) {
    const c = card as Record<string, unknown> | null
    for (const side of ['a', 'b'] as const) {
      const content = c?.[side]
      if (typeof c?.['key'] === 'string' && typeof content === 'object' && content !== null) {
        sides.set(`${c['key']}.${side}.html`, content as Record<string, unknown>)
      }
    }
  }
  for (const [name, html] of files) {
    const match = SCENE_FILE_RE.exec(name)
    const side = sides.get(name)
    const where = `${DECK_SCENES_DIR}/${name}`
    if (match === null || side === undefined) {
      problems.push({
        code: 'SCENE_INVALID',
        where,
        message: `${where}: names no card side; name a scene file <card key>.a.html or <card key>.b.html`,
      })
    } else if (side['scene'] !== undefined) {
      const scene = `card:${match[1]}.${match[2]}.scene`
      problems.push({
        code: 'SCENE_INVALID',
        where: scene,
        message: `${scene}: is in deck-model.json and in ${where}; keep one`,
      })
    } else {
      side['scene'] = html
    }
  }
  return problems
}

/**
 * Swaps sides A and B on about half the cards, chosen by the card's key. Generators put the code
 * as it is on side A almost every time, which would make "keep it" always the left swipe; the
 * author should read both sides, not learn a direction. The key decides, so a card asked again
 * keeps its layout.
 */
export function shuffleSides(card: DecisionCard): DecisionCard {
  const swap = (createHash('sha256').update(card.key).digest()[0] ?? 0) % 2 === 1
  if (!swap) return card
  const current = card.current === null ? null : card.current === 'a' ? 'b' : 'a'
  return { ...card, a: card.b, b: card.a, current }
}

/** Where the target's head is now: the forge's answer for a pull request, the clone's otherwise. */
async function currentHead(ctx: AppContext, review: ReviewKey): Promise<string> {
  if (isLocalKey(review)) {
    return (await resolveLocalHead(ctx.git, review)).headSha
  }
  return (await ctx.config.host.fetchPrMeta(ctx.gh, ctx.config.repo, review)).headSha
}

export interface PublishDeckResult {
  status: 'published'
  review: ReviewKey
  headSha: string
  cards: number
  settled: number
  deckUrl: string
}

export async function publishDeck(
  ctx: AppContext,
  review: ReviewKey,
  opts: { agent: string; model?: string | undefined; allowStale: boolean }
): Promise<PublishDeckResult> {
  const context = await readDeckContext(ctx, review)
  const checked = await checkDeckModel(context)
  if (!checked.ok) {
    throw new DeckInvalidError(checked.problems)
  }
  const headSha = await currentHead(ctx, review)
  if (headSha !== context.headSha && !opts.allowStale) {
    throw new AppError(
      'DECK_STALE',
      `the head of ${keyLabel(review)} moved to ${headSha.slice(0, 12)} while the deck was written for ${context.headSha.slice(0, 12)}`,
      409,
      'prepare the deck again, or pass --allow-stale to publish it for the old head'
    )
  }
  // A settled decision asked again means the code still contradicts it: the new card replaces it.
  const asked = new Set(checked.cards.map(c => c.key))
  const deck: Deck = {
    version: 1,
    review,
    headSha: context.headSha,
    mergeBaseSha: context.mergeBaseSha,
    baseRef: context.base,
    headRef: context.headRef,
    generatedAt: ctx.now().toISOString(),
    generator: opts.model === undefined ? { agent: opts.agent } : { agent: opts.agent, model: opts.model },
    cards: checked.cards.map(shuffleSides),
    settled: context.settled.filter(c => !asked.has(c.key)),
  }
  await ctx.decks.writeDeck(review, deck)
  return {
    status: 'published',
    review,
    headSha: deck.headSha,
    cards: deck.cards.length,
    settled: deck.settled.length,
    deckUrl: `http://localhost:${ctx.config.port}/deck/${review}`,
  }
}
