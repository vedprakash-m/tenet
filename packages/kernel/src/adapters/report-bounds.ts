// A bound shared by every report normalizer (Vitest, tsc, ESLint, Playwright): a hostile or corrupt report cannot
// be allowed to recurse arbitrarily deep while being validated (TS §9.5).
/** True when any value in the report nests deeper than 64 levels. */
export function nestsTooDeep(report: unknown): boolean {
  const stack: Array<[unknown, number]> = [[report, 0]];
  while (stack.length) {
    const [value, depth] = stack.pop()!;
    if (depth > 64) return true;
    if (value && typeof value === "object") for (const item of Object.values(value)) stack.push([item, depth + 1]);
  }
  return false;
}
