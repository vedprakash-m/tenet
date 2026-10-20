// Authority (TS §8.1, WRK-03): which changes a contract's grants cover. Pure. A routine grant covers in-scope local work;
// an edit in a protected path needs a `protected-path` grant that lists that path, and it covers that contract only.
import { matches } from "./exclusions.ts";
import type { Grant } from "./schemas.ts";

/** The changed paths inside a protected path that no live `protected-path` grant lists. */
export function uncoveredProtected(protectedPatterns: readonly string[], changed: readonly string[], grants: readonly Grant[], now = ""): string[] {
  const live = grants.filter((g) => g.actions.includes("protected-path") && (!g.expiresAt || !now || g.expiresAt > now));
  return changed.filter((p) => protectedPatterns.some((x) => matches(x, p)) && !live.some((g) => (g.paths ?? []).some((x) => matches(x, p))));
}
