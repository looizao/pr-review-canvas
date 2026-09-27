// Posts the justifications the author kept for reviewers, from the self-review decks, as the
// author's own review on the pull request: one COMMENT review, each justification inline on the
// code it concerns, worded as a settled point's reason is. A decision whose code changed since the
// card was dealt is listed in the review body instead of landing on a line it no longer describes.
import type { SettledCard } from '../contract/deck.js'
import type { PendingComment } from '../contract/pending.js'
import type { Pr } from '../contract/review-artifact.js'
import { resolveSharing } from '../contract/settings.js'
import type { AppContext } from '../server/context.js'
import { anchorOnHead, decisionsForPr, pickedLabel, recordOf, sentence, whyOf } from './settled-for-pr.js'

export type SelfReviewSharing =
  /** No settled decision is waiting to be posted; `held` counts those the canvas reopened. */
  | { status: 'none'; held?: number }
  | { status: 'posted'; url: string; comments: number; listed: number; held?: number }
  | { status: 'failed'; warning: string }
  | { status: 'skipped' }

/** `Picked A, Keep it. Because …`: the side, then the author's reason when there is one. */
function pickedSentence(card: SettledCard): string {
  const why = whyOf(card)
  return `${sentence(pickedLabel(card))}${why === '' ? '' : ` ${why}`}`
}

/** The comment on the decision's line. The credit line is left out when `sharing.mentionCanvas` is off. */
function commentBody(card: SettledCard, mentionCanvas: boolean): string {
  const credit = mentionCanvas ? '\n\n_from the pr-review self-review deck_' : ''
  return `**Settled by the author:** ${card.title}\n\nPicked ${pickedSentence(card)}${credit}`
}

function listedLine(card: SettledCard): string {
  return `- **${card.title}** (\`${card.path}\`): picked ${pickedSentence(card)}`
}

/**
 * Posts what is waiting. A decision the canvas reopens is held back: the author's reason would
 * stand on code that contradicts it. It posts on a later publish, once the canvas stops reopening
 * it, and is not recorded as posted until then.
 */
export async function postSettledComments(
  ctx: AppContext,
  pr: Pr & { number: number },
  opts: { reopened?: ReadonlySet<string> } = {}
): Promise<SelfReviewSharing> {
  const { settled } = await decisionsForPr(ctx, pr)
  const { posted } = await ctx.decks.readPosted(pr.number)
  const unposted = settled.filter(
    card => recordOf(card) === 'pr-comment' && posted[card.key]?.pickedAt !== card.pick.pickedAt
  )
  const waiting = unposted.filter(card => opts.reopened?.has(card.key) !== true)
  const held = unposted.length - waiting.length
  if (waiting.length === 0) {
    return held === 0 ? { status: 'none' } : { status: 'none', held }
  }
  try {
    const { mentionCanvas } = resolveSharing(ctx.projectConfig.config.sharing, await ctx.settings.read())
    const derived = await ctx.derived.ensure(pr.headSha, pr.mergeBaseSha)
    const now = ctx.now().toISOString()
    const comments: PendingComment[] = []
    const listed: SettledCard[] = []
    for (const card of waiting) {
      const anchor = await anchorOnHead(ctx, card, { sha: pr.headSha, derived })
      if (anchor === null) {
        listed.push(card)
        continue
      }
      comments.push({
        id: `self-review-${card.key}`,
        ...anchor,
        body: commentBody(card, mentionCanvas),
        headSha: pr.headSha,
        createdAt: now,
        updatedAt: now,
      })
    }
    const body = [
      'Decisions I settled in a self-review before asking for review, and why.',
      ...(listed.length === 0
        ? []
        : [
            '',
            'The code under these changed since, so they are not on a line:',
            '',
            ...listed.map(listedLine),
          ]),
    ].join('\n')
    const review = await ctx.config.host.postReview(
      ctx.gh,
      ctx.config.repo,
      pr.number,
      pr.headSha,
      { event: 'COMMENT', body, comments },
      derived
    )
    const next = { ...posted }
    for (const card of waiting) {
      next[card.key] = { pickedAt: card.pick.pickedAt, url: review.url }
    }
    await ctx.decks.writePosted(pr.number, { posted: next })
    const result: SelfReviewSharing = {
      status: 'posted',
      url: review.url,
      comments: comments.length,
      listed: listed.length,
    }
    if (held > 0) result.held = held
    return result
  } catch (err) {
    return {
      status: 'failed',
      warning: `The canvas is published, but the self-review justifications were not posted: ${err instanceof Error ? err.message : String(err)}. Publishing again retries them.`,
    }
  }
}
