export function summarize(valid) {
  const totals = new Map();
  for (const { customer, cents } of valid) totals.set(customer, (totals.get(customer) ?? 0) + cents);
  return [...totals].map(([customer, totalCents]) => ({ customer, totalCents })).sort((a, b) => (a.customer < b.customer ? -1 : 1));
}
