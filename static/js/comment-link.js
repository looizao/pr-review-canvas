// @ts-check
import { esc } from './dom.js'
import { postToLabel } from './host.js'

/** @param {string} url */
export function viewCommentHtml(url) {
  return `<a class="cmd" href="${esc(url)}" target="_blank" rel="noopener noreferrer">view comment</a>`
}

/** @param {HTMLElement} button @param {string} url */
export function replacePostButton(button, url) {
  const template = button.ownerDocument.createElement('template')
  template.innerHTML = viewCommentHtml(url)
  const link = template.content.firstElementChild
  if (link instanceof HTMLAnchorElement) {
    const focused = button.ownerDocument.activeElement === button
    button.replaceWith(link)
    if (focused) {
      link.focus()
    }
  }
}

/**
 * Whether two comments sit on the same lines of the same side and say the same thing.
 * @param {{ path: string, line: number | null, side: string, startLine?: number | undefined, body: string }} a
 * @param {{ path: string, line: number, side: string, startLine?: number | undefined, body: string }} b
 */
function sameAnchoredComment(a, b) {
  return (
    a.path === b.path &&
    a.line === b.line &&
    a.side === b.side &&
    (a.startLine ?? a.line) === (b.startLine ?? b.line) &&
    a.body === b.body
  )
}

/**
 * @param {import('./proposed-comment.js').ProposedComment} proposed
 * @param {ReadonlyArray<import('./contract-types.js').ReviewComment>} posted
 */
export function postedCommentUrl(proposed, posted) {
  return posted.find(c => c.inReplyToId === undefined && sameAnchoredComment(c, proposed))?.url
}

/**
 * Whether the proposed comment already waits in the pending review, drafted from this card.
 * @param {import('./proposed-comment.js').ProposedComment} proposed
 * @param {ReadonlyArray<import('./contract-types.js').PendingComment>} pending
 */
export function isQueuedComment(proposed, pending) {
  return pending.some(p => sameAnchoredComment(p, proposed))
}

/**
 * What a comment written in advance (an attention point, a comment the AI Chat proposes) offers
 * for getting onto the forge: the link to the comment it was posted as, the note that it is
 * waiting in the review, or the two ways to send it. It keeps both ways while a review is open:
 * its text is written in advance, so firing one off on its own is a use of its own, not a comment
 * jumping the queue.
 * @param {{
 *   kind: 'point' | 'proposed',
 *   id: string,
 *   postedUrl?: string | undefined,
 *   queued?: boolean | undefined,
 *   leadWithQueue?: boolean,
 * }} opts `kind` names the commands (`point-post`) and the attribute that carries `id`
 */
export function sendCommandsHtml(opts) {
  if (opts.postedUrl !== undefined) {
    return viewCommentHtml(opts.postedUrl)
  }
  if (opts.queued === true) {
    return '<span class="pill pending queued">in your review</span>'
  }
  const target = `data-${opts.kind}="${esc(opts.id)}"`
  const post = `<button class="cmd" type="button" data-act="${opts.kind}-post" ${target} data-needs-post>${postToLabel()}</button>`
  const queue = `<button class="cmd${opts.leadWithQueue === true ? ' fill' : ''}" type="button" data-act="${opts.kind}-queue" ${target}>add to review</button>`
  return opts.leadWithQueue === true ? queue + post : post + queue
}
