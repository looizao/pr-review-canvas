// @ts-check
// The bars above the canvas close with their dismiss command. Each bar names the facts it states
// in `data-bar`, such as the two commits it compares, and the browser keeps the names of the bars
// the reader dismissed. A dismissed bar stays closed on the next load, and a bar that states new
// facts, because the head or the canvas moved, shows again.

/** The localStorage key that holds the names of the dismissed bars. */
export const DISMISSED_BARS_KEY = 'pr-review.dismissed-bars'
/** The names kept, newest last. Older ones drop off, and those bars show again if they come back. */
const KEPT = 50

/** The command at the end of a bar that closes it. */
export const DISMISS_BAR_HTML =
  '<button class="cmd bar-dismiss" type="button" data-dismiss-bar title="Hide this bar until what it says changes">dismiss</button>'

/**
 * @param {Storage | null} storage
 * @returns {string[]}
 */
function readDismissed(storage) {
  try {
    const names = JSON.parse(storage?.getItem(DISMISSED_BARS_KEY) ?? '[]')
    return Array.isArray(names) ? names.filter(name => typeof name === 'string') : []
  } catch {
    return []
  }
}

/**
 * Removes the bars the reader dismissed before, and makes the rest close on their dismiss command.
 * Called after each render, before anything measures the bars.
 * @param {ParentNode} root
 * @param {Storage | null} storage
 */
export function wireBarDismissal(root, storage) {
  const dismissed = new Set(readDismissed(storage))
  for (const bar of Array.from(root.querySelectorAll('[data-bar]'))) {
    const name = /** @type {string} */ (bar.getAttribute('data-bar'))
    if (dismissed.has(name)) {
      bar.remove()
      continue
    }
    bar.querySelector('[data-dismiss-bar]')?.addEventListener('click', () => {
      bar.remove()
      storage?.setItem(DISMISSED_BARS_KEY, JSON.stringify([...readDismissed(storage), name].slice(-KEPT)))
    })
  }
}
