import { existsSync } from "node:fs";

// npm test builds dist once before any test runs; tests never compile into dist themselves,
// because a rebuild during the run races other test files importing from dist.
export function buildVerify(): void {
  if (!existsSync("dist/verify/record.js")) throw new Error("dist is not built: run `npm run build` (npm test does this first)");
}

export const emptyDeps = {
  check: async () => ({ findings: [], summary: { errors: 0, warnings: 0, advises: 0 } }),
  touched: async () => [],
  deltas: async () => [],
};
