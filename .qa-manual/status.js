// The second semantic layer gives navigation a separate destination.
export function statusLabel(state) {
  if (state === 'paid') return 'Paid'
  if (state === 'pending') return 'Pending'
  return 'Unknown'
}
