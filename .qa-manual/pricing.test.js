import assert from 'node:assert/strict'
import { total } from './pricing.js'

assert.equal(total([{ price: 10, quantity: 2 }]), 20)
assert.equal(total([{ price: 10, quantity: 2 }], 0.25), 15)
