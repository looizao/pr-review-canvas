// @ts-check
// @vitest-environment happy-dom
import { DISMISSED_BARS_KEY, wireBarDismissal } from './bar-dismissal.js'
import { carriedOverBarHtml, marksCarriedBarHtml, staleBarHtml } from './empty-state.js'

const HEAD = 'a'.repeat(40)
const OLD = 'e'.repeat(40)
const NEWER = 'b'.repeat(40)

/** A Storage that keeps its items in a Map, so each test starts empty. */
function memoryStorage() {
  const items = new Map()
  return /** @type {Storage} */ (
    /** @type {unknown} */ ({
      getItem: (/** @type {string} */ key) => items.get(key) ?? null,
      setItem: (/** @type {string} */ key, /** @type {string} */ value) => items.set(key, value),
    })
  )
}

/** @param {string} html */
function mount(html) {
  document.body.innerHTML = `<main id="main">${html}<section id="overview"></section></main>`
  return /** @type {HTMLElement} */ (document.getElementById('main'))
}

/** @param {ParentNode} root */
function dismiss(root, selector = '[data-bar]') {
  const button = root.querySelector(`${selector} [data-dismiss-bar]`)
  if (!(button instanceof HTMLElement)) throw new Error(`no dismiss command in ${selector}`)
  button.click()
}

const outdated = () =>
  staleBarHtml({ canvasHeadSha: OLD, currentHeadSha: HEAD, relation: 'ancestor', commitsBehind: 1 })

describe('bar dismissal', () => {
  it('names each bar by the commits it states and ends it with a dismiss command', () => {
    const root = mount(
      outdated() +
        carriedOverBarHtml({ canvasHeadSha: OLD, currentHeadSha: HEAD }) +
        marksCarriedBarHtml(OLD, HEAD)
    )
    const bars = Array.from(root.querySelectorAll('.stale-bar'))
    expect(bars.map(bar => bar.getAttribute('data-bar'))).toEqual([
      `outdated:${OLD}:${HEAD}`,
      `carried-over:${OLD}:${HEAD}`,
      `marks-carried:${OLD}:${HEAD}`,
    ])
    for (const bar of bars) {
      expect(bar.lastElementChild?.textContent).toBe('dismiss')
      expect(bar.querySelector('.bar-text strong')).not.toBeNull()
    }
  })

  it('closes a bar on its dismiss command and keeps it closed on the next render', () => {
    const storage = memoryStorage()
    let root = mount(outdated() + marksCarriedBarHtml(OLD, HEAD))
    wireBarDismissal(root, storage)
    dismiss(root, '.outdated-bar')
    expect(root.querySelector('.outdated-bar')).toBeNull()
    expect(root.querySelector('.carried-over-bar')).not.toBeNull()
    expect(JSON.parse(storage.getItem(DISMISSED_BARS_KEY) ?? '')).toEqual([`outdated:${OLD}:${HEAD}`])

    root = mount(outdated() + marksCarriedBarHtml(OLD, HEAD))
    wireBarDismissal(root, storage)
    expect(root.querySelector('.outdated-bar')).toBeNull()
    expect(root.querySelector('.carried-over-bar')).not.toBeNull()
  })

  it('shows a bar again once it states other commits', () => {
    const storage = memoryStorage()
    let root = mount(carriedOverBarHtml({ canvasHeadSha: OLD, currentHeadSha: HEAD }))
    wireBarDismissal(root, storage)
    dismiss(root)
    root = mount(carriedOverBarHtml({ canvasHeadSha: OLD, currentHeadSha: NEWER }))
    wireBarDismissal(root, storage)
    expect(root.querySelector('.carried-over-bar')?.getAttribute('data-bar')).toBe(
      `carried-over:${OLD}:${NEWER}`
    )
  })

  it('keeps the newest 50 names', () => {
    const storage = memoryStorage()
    const older = Array.from({ length: 50 }, (_, i) => `outdated:${i}:${HEAD}`)
    storage.setItem(DISMISSED_BARS_KEY, JSON.stringify(older))
    const root = mount(carriedOverBarHtml({ canvasHeadSha: OLD, currentHeadSha: HEAD }))
    wireBarDismissal(root, storage)
    dismiss(root)
    expect(JSON.parse(storage.getItem(DISMISSED_BARS_KEY) ?? '')).toEqual([
      ...older.slice(1),
      `carried-over:${OLD}:${HEAD}`,
    ])
  })

  it('shows every bar when the stored names are unreadable, and works with no storage at all', () => {
    const storage = memoryStorage()
    for (const stored of ['not json', '{"a":1}', '[1, null]']) {
      storage.setItem(DISMISSED_BARS_KEY, stored)
      const root = mount(outdated())
      wireBarDismissal(root, storage)
      expect(root.querySelector('.outdated-bar')).not.toBeNull()
    }
    const root = mount(outdated())
    wireBarDismissal(root, null)
    dismiss(root)
    expect(root.querySelector('.outdated-bar')).toBeNull()
  })
})
