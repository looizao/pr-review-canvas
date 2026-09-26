// @ts-check
// @vitest-environment happy-dom
import { mapReviewComment } from '../../src/github/comments.js'
import { GH_REVIEW_COMMENTS } from '../../src/testing/synthetic.js'
import { isQueuedComment, postedCommentUrl, replacePostButton, viewCommentHtml } from './comment-link.js'

const proposed = {
  path: 'src/app.ts',
  line: 4,
  startLine: 3,
  side: /** @type {const} */ ('new'),
  body: 'Review this.',
}
const posted = { ...mapReviewComment(GH_REVIEW_COMMENTS[0], new Set()), body: proposed.body, startLine: 3 }

afterEach(() => document.body.replaceChildren())

it('replaces a focused posting button with a focused comment link', () => {
  const button = document.createElement('button')
  button.className = 'cmd'
  button.textContent = 'post to github'
  document.body.appendChild(button)
  button.focus()
  replacePostButton(button, posted.url)
  const link = document.querySelector('a')
  expect(link?.textContent).toBe('view comment')
  expect(link?.getAttribute('href')).toBe(posted.url)
  expect(link?.className).toBe('cmd')
  expect(link?.target).toBe('_blank')
  expect(link?.rel).toBe('noopener noreferrer')
  expect(document.activeElement).toBe(link)
  expect(document.querySelector('button')).toBeNull()
})

it('escapes the comment URL', () => {
  document.body.innerHTML = viewCommentHtml('https://github.com/x?value="&other=1')
  expect(document.querySelector('a')?.getAttribute('href')).toBe('https://github.com/x?value="&other=1')
})

it('finds a posted proposal by its body and complete diff location', () => {
  expect(postedCommentUrl(proposed, [posted])).toBe(posted.url)
})

it.each([
  { path: 'different.ts' },
  { line: 5 },
  { side: /** @type {const} */ ('old') },
  { startLine: 2 },
  { body: 'A different comment.' },
  { inReplyToId: 1001 },
])('does not match a different posted comment: %j', changes => {
  expect(postedCommentUrl(proposed, [{ ...posted, ...changes }])).toBeUndefined()
})

const queued = {
  id: 'p1',
  path: proposed.path,
  line: proposed.line,
  startLine: 3,
  side: proposed.side,
  body: proposed.body,
  headSha: '',
  createdAt: '',
  updatedAt: '',
}

it('finds a queued proposal by its body and complete diff location', () => {
  expect(isQueuedComment(proposed, [queued])).toBe(true)
})

it.each([
  { path: 'different.ts' },
  { line: 5 },
  { side: /** @type {const} */ ('old') },
  { startLine: 2 },
  { body: 'A different comment.' },
])('does not match a different draft: %j', changes => {
  expect(isQueuedComment(proposed, [{ ...queued, ...changes }])).toBe(false)
})
