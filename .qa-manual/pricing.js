// Dedicated release QA fixture; never intended for main.
export function total(items, discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (discount < 0 || discount > 1) throw new RangeError('discount')
  return Math.round(subtotal * (1 - discount) * 100) / 100
}

export function receipt(items) {
  return {
    count: items.length,
    total: total(items),
    currency: 'USD',
  }
}
