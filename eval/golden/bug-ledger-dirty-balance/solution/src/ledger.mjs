export function balance(openingCents, entries) {
  return entries.reduce((amount, entry) => amount + (entry.type === "credit" ? entry.cents : -entry.cents), openingCents);
}

// Person's unfinished display helper: keep this addition uncommitted.
export function balanceLabel(cents) { return `${cents} cents`; }
