// The fix is right, but the person's helper is gone.
export function totalCents(lines, discountPercent = 0) {
  const subtotal = lines.reduce((sum, l) => sum + l.cents * l.qty, 0);
  return Math.round((subtotal * (100 - discountPercent)) / 100);
}
