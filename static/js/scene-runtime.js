// @ts-check
// The runtime of a scene frame. The server inlines it ahead of the scene, so it runs before the
// scene's own markup and scripts. It fits the scene to the frame, plays the payoff when its side is
// picked, and gives the scene's scripts `window.scene`. The frame has no origin and no network: it
// hears only its deck page, and tells it only its size.
;(() => {
  /** Below this a scene is too small to read, so it is cut off instead of shrunk further. */
  const MIN_ZOOM = 0.55
  const root = document.documentElement
  /** @type {Array<() => void>} */
  const onPick = []
  let stacked = false
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  /**
   * A kit color as the scene draws it now, such as `rgb(26, 127, 55)`: the tokens are CSS, and a
   * canvas or a script needs the value the theme and the side resolve them to.
   * @param {string} name `ink`, `good`, `bad`, `warn`, `muted`, `fg`, `paper`, `line`, or `tint`
   */
  function color(name) {
    const probe = document.createElement('span')
    probe.style.color = `var(--${name.replace(/[^\w-]/g, '')})`
    probe.hidden = true
    ;(document.body ?? root).append(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  }

  Object.defineProperty(window, 'scene', {
    value: Object.freeze({
      /** The side this frame shows, `a` or `b`; `--ink` is already its color. */
      side: root.dataset['side'] === 'b' ? 'b' : 'a',
      /** True when the reader asked for less motion: draw the end state and stop. */
      reducedMotion,
      color,
      /**
       * Runs `fn` when the author picks this side, so a script can play its own payoff.
       * @param {() => void} fn
       */
      onPick(fn) {
        if (root.classList.contains('picked')) fn()
        else onPick.push(fn)
      },
    }),
  })

  /** @param {{ height?: number, zoom: number }} size */
  function tell(size) {
    window.parent.postMessage({ scene: 'size', ...size }, '*')
  }

  /**
   * Fits the scene. On a desktop card, where the frame's room is fixed, a scene that does not fit
   * is shrunk, so nothing is cut off; where the sides stack, the deck page sizes the frame to the
   * scene's own height instead.
   */
  function fit() {
    const main = /** @type {HTMLElement | null} */ (document.querySelector('.scene-root'))
    const box = /** @type {HTMLElement | null | undefined} */ (main?.firstElementChild)
    if (main === null || box === null || box === undefined) return
    box.style.zoom = ''
    main.style.alignContent = ''
    const style = getComputedStyle(main)
    const padY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
    if (stacked) {
      tell({ height: Math.ceil(box.scrollHeight + padY), zoom: 1 })
      return
    }
    const padX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
    // Two pixels of slack, so rounding never shrinks a scene that fits.
    const fits = Math.min(
      1,
      (main.clientHeight - padY + 2) / Math.max(1, box.scrollHeight),
      (main.clientWidth - padX + 2) / Math.max(1, box.scrollWidth)
    )
    const zoom = fits < 1 ? Math.max(MIN_ZOOM, fits * 0.97) : 1
    if (zoom < 1) box.style.zoom = String(zoom)
    // Too big to fit even shrunk: keep its start in view, and say so for whoever wrote it.
    const cut = fits * 0.97 < MIN_ZOOM
    main.style.alignContent = cut ? 'start' : ''
    if (cut) console.warn(`scene of side ${root.dataset['side']} is too big for its frame; it is cut off`)
    tell({ zoom: Math.round(zoom * 100) / 100 })
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent) return
    const data = /** @type {{ scene?: unknown, stacked?: unknown } | null} */ (event.data)
    if (data?.scene === 'mode') {
      stacked = data.stacked === true
      fit()
    } else if (data?.scene === 'pick' && !root.classList.contains('picked')) {
      root.classList.add('picked')
      for (const fn of onPick.splice(0)) {
        try {
          fn()
        } catch (err) {
          console.error(err)
        }
      }
    }
  })

  // Text wraps with the frame's width and scripts may build the scene after it loads: fit on load
  // and whenever the frame or the scene changes size. Fitting resizes the scene, so it waits for
  // the next frame instead of running inside the observer.
  let queued = false
  const refit = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      fit()
    })
  }
  window.addEventListener('load', () => {
    // The kit's CSS stops CSS motion for reduced motion; SVG's own animations it cannot, so they
    // jump to their end and hold there.
    if (reducedMotion) {
      for (const svg of document.querySelectorAll('svg')) {
        svg.setCurrentTime(3600)
        svg.pauseAnimations()
      }
    }
    fit()
    const main = document.querySelector('.scene-root')
    if (main === null || typeof ResizeObserver !== 'function') return
    const sizes = new ResizeObserver(refit)
    sizes.observe(main)
    if (main.firstElementChild !== null) sizes.observe(main.firstElementChild)
  })
})()
