// totalCents(lines, discountPercent): lines are { cents, qty }; the result is in whole cents.
export function totalCents(lines, discountPercent = 0) {
  const subtotal = lines.reduce((sum, l) => sum + l.cents * l.qty, 0);
  return Math.round(subtotal * (1 - discountPercent));
}
