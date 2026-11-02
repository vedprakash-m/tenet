export function balance(openingCents, entries) {
  return entries.reduce((amount, entry) => amount + entry.cents, openingCents);
}
