import type { PendingComment } from '../contract/pending.js'
import { samePostedComment } from '../../static/js/comment-link.js'

/**
 * The `posted` entries for submitted drafts, found in the comment list the
 * forge created in this submission. Match the full range and body inside that receipt,
 * never against historical comments. A failed comment read is reported by the host adapter.
 */
export function postedFromPending(
  pending: ReadonlyArray<PendingComment>,
  comments: ReadonlyArray<{
    id: number
    path: string
    line: number | null
    startLine?: number | undefined
    originalLine?: number | null | undefined
    originalStartLine?: number | null | undefined
    side: string
    body: string
  }>
): Array<{ commentId: number; pointFingerprint?: string }> {
  const entries: Array<{ commentId: number; pointFingerprint?: string }> = []
  const used = new Set<number>()
  for (const draft of pending) {
    const match = comments.find(c => !used.has(c.id) && samePostedComment(c, draft))
    if (match !== undefined) {
      used.add(match.id)
      entries.push({
        commentId: match.id,
        ...(draft.pointFingerprint === undefined ? {} : { pointFingerprint: draft.pointFingerprint }),
      })
    }
  }
  return entries
}
