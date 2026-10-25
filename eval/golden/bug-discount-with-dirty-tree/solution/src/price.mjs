// totalCents(lines, discountPercent): lines are { cents, qty }; the result is in whole cents.
export function totalCents(lines, discountPercent = 0) {
  const subtotal = lines.reduce((sum, l) => sum + l.cents * l.qty, 0);
  return Math.round((subtotal * (100 - discountPercent)) / 100);
}

// WIP (mine): display helper
export function formatCents(cents) {
  return (cents / 100).toFixed(2);
}
