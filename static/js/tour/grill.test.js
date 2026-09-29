// @ts-check
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { syntheticPageTour } from '../../../src/testing/tour-page.js'
import { grillHtml, readRestatement } from './grill.js'

const decision = /** @type {import('../contract-types.js').Decision} */ (syntheticPageTour().decisions[0])

describe('grillHtml', () => {
  it('starts the restatement from the decision, or from the draft the reader wrote before', () => {
    document.body.innerHTML = grillHtml(decision, undefined)
    const what = document.querySelector('textarea[name="what"]')
    const where = document.querySelector('textarea[name="where"]')
    expect(what?.textContent).toBe('Product')
    expect(where?.textContent).toBe('src/app.ts:4')
    expect(document.querySelector('.tour-chat-h b')?.textContent).toBe('Change · Sum over product?')
    document.body.innerHTML = grillHtml(decision, {
      what: 'Multiply <b>them</b>',
      where: ['src/app.ts', 'src/b.ts'],
      unchanged: 'The callers.',
    })
    expect(document.querySelector('textarea[name="what"]')?.textContent).toBe('Multiply <b>them</b>')
    expect(document.querySelector('textarea[name="where"]')?.textContent).toBe('src/app.ts, src/b.ts')
    expect(document.querySelector('textarea[name="unchanged"]')?.textContent).toBe('The callers.')
  })
})

describe('readRestatement', () => {
  it('reads the three fields, splits the places, and refuses an empty one', () => {
    document.body.innerHTML = grillHtml(decision, undefined)
    const form = document.querySelector('form')
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('no form')
    }
    expect(readRestatement(form)).toBeNull()
    const unchanged = form.querySelector('textarea[name="unchanged"]')
    if (!(unchanged instanceof HTMLTextAreaElement)) {
      throw new Error('no field')
    }
    unchanged.value = '  The callers.  '
    const where = form.querySelector('textarea[name="where"]')
    if (!(where instanceof HTMLTextAreaElement)) {
      throw new Error('no field')
    }
    where.value = 'src/app.ts, , src/b.ts '
    expect(readRestatement(form)).toEqual({
      what: 'Product',
      where: ['src/app.ts', 'src/b.ts'],
      unchanged: 'The callers.',
    })
    where.value = ' , '
    expect(readRestatement(form)).toBeNull()
    document.body.innerHTML = '<form></form>'
    const bare = document.querySelector('form')
    if (!(bare instanceof HTMLFormElement)) {
      throw new Error('no form')
    }
    expect(readRestatement(bare)).toBeNull()
  })
})
