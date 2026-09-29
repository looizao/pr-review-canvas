// @ts-check
// The tour's three requests: the bundle, the reader's state, and finishing.
/** @typedef {import('../contract-types.js').TourBundle} TourBundle */
/** @typedef {import('../contract-types.js').TourReaderState} TourReaderState */
/** @typedef {import('../contract-types.js').TourFinishResponse} TourFinishResponse */
import { fetchJson } from '../api.js'

/**
 * @param {string} key
 * @param {{ preview?: boolean, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<TourBundle>}
 */
export function fetchTour(key, opts = {}) {
  const query = opts.preview === true ? '?preview=1' : ''
  return fetchJson(`/api/tours/${encodeURIComponent(key)}${query}`, { fetchImpl: opts.fetchImpl })
}

/**
 * @param {string} key
 * @param {string} headSha
 * @param {TourReaderState} reader
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<TourReaderState>}
 */
export function saveReader(key, headSha, reader, opts = {}) {
  return fetchJson(`/api/tours/${encodeURIComponent(key)}/reader`, {
    method: 'PUT',
    body: { headSha, reader },
    fetchImpl: opts.fetchImpl,
  })
}

/**
 * @param {string} key
 * @param {string} headSha
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<TourFinishResponse>}
 */
export function finishTour(key, headSha, opts = {}) {
  return fetchJson(`/api/tours/${encodeURIComponent(key)}/finish`, {
    method: 'POST',
    body: { headSha },
    fetchImpl: opts.fetchImpl,
  })
}

/**
 * Saves the reader's state at most once every `delayMs`, and never two at once: a save that lands
 * while one is in flight goes out after it, with the latest state. Failures go to `onError`.
 * @param {(reader: TourReaderState) => Promise<unknown>} save
 * @param {{ delayMs?: number, onError?: (err: unknown) => void, setTimeoutImpl?: typeof setTimeout }} [opts]
 */
export function createSaver(save, opts = {}) {
  const delay = opts.delayMs ?? 250
  const later = opts.setTimeoutImpl ?? setTimeout
  /** @type {TourReaderState | null} */
  let pending = null
  let inFlight = false
  let timer = /** @type {ReturnType<typeof setTimeout> | null} */ (null)
  /** @type {Array<() => void>} */
  let idle = []

  async function flush() {
    timer = null
    if (inFlight || pending === null) {
      return
    }
    const state = pending
    pending = null
    inFlight = true
    try {
      await save(state)
    } catch (err) {
      opts.onError?.(err)
    } finally {
      inFlight = false
    }
    if (pending !== null) {
      void flush()
    } else {
      for (const resolve of idle) {
        resolve()
      }
      idle = []
    }
  }

  return {
    /** @param {TourReaderState} reader */
    push(reader) {
      pending = reader
      if (timer === null) {
        timer = later(() => void flush(), delay)
      }
    },
    /** Resolves once nothing is pending or in flight; sends what is pending now. */
    settle() {
      if (timer === null && !inFlight && pending === null) {
        return Promise.resolve()
      }
      return /** @type {Promise<void>} */ (
        new Promise(resolve => {
          idle.push(() => resolve(undefined))
          if (timer !== null) {
            clearTimeout(timer)
            void flush()
          }
        })
      )
    },
  }
}
