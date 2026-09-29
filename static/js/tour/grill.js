// @ts-check
// The drawer a change pick opens. The reader says what they want instead, as a restatement: what
// changes, where, and what stays the same. Approving it settles the decision and puts it in the
// plan; nothing else does. The AI Chat grilling, when it is on, drives the same card.
/** @typedef {import('../contract-types.js').Decision} Decision */
/** @typedef {import('../contract-types.js').Restatement} Restatement */
import { esc } from '../dom.js'
import { inline } from './screens.js'

export const GRILL_DIALOG_ID = 'tour-grill'

/**
 * @param {Decision} d
 * @param {Restatement | undefined} draft
 */
export function grillHtml(d, draft) {
  const r = draft ?? { what: d.change.label, where: [`${d.anchor.path}:${d.anchor.line}`], unchanged: '' }
  return `<div class="tour-chat-box">
    <div class="tour-chat-h"><div><b>Change · ${esc(d.title)}</b><span class="agent">say what you want instead, in your words</span></div><button class="tour-btn quiet" type="button" data-act="close-grill" aria-label="Close">✕</button></div>
    <div class="tour-chat-log">
      <div class="tour-msg agent"><span class="who">the decision</span>${inline(d.context)}</div>
      <div class="tour-msg agent"><span class="who">what the code does</span>${esc(d.keep.label)}. ${inline(d.keep.consequence)}</div>
      <form class="tour-restate" data-act="restate">
        <h4>What you want instead</h4>
        <label><b>What changes</b><textarea name="what" required maxlength="2000">${esc(r.what)}</textarea></label>
        <label><b>Where</b> <span class="tour-hint">paths or places, comma separated</span><textarea name="where" required maxlength="2000">${esc(r.where.join(', '))}</textarea></label>
        <label><b>Stays the same</b><textarea name="unchanged" required maxlength="2000" placeholder="What this change must not touch">${esc(r.unchanged)}</textarea></label>
        <div class="tour-actions"><button class="tour-btn primary" type="submit">Approve · into the plan</button><button class="tour-btn quiet" type="button" data-act="close-grill">Cancel</button></div>
      </form>
    </div>
  </div>`
}

/**
 * The restatement the form holds, or null while a field is empty.
 * @param {HTMLFormElement} form
 * @returns {Restatement | null}
 */
export function readRestatement(form) {
  const data = new FormData(form)
  const what = String(data.get('what') ?? '').trim()
  const unchanged = String(data.get('unchanged') ?? '').trim()
  const where = String(data.get('where') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')
  if (what === '' || unchanged === '' || where.length === 0) {
    return null
  }
  return { what, where, unchanged }
}
