// A cache entry is valid strictly before expiresAt.
export function readCached(entry, now) {
  if (!entry || now >= entry.expiresAt) return undefined;
  return entry.value;
}
