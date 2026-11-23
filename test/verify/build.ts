import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

export function buildVerify(): void {
  const files = readdirSync("src/verify").filter((name) => name.endsWith(".ts")).map((name) => `src/verify/${name}`);
  const run = spawnSync(process.execPath, [
    "node_modules/typescript/bin/tsc", "--target", "ES2023", "--module", "NodeNext", "--moduleResolution", "NodeNext",
    "--strict", "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--verbatimModuleSyntax",
    "--noEmitOnError", "--skipLibCheck", "--outDir", "dist", "--rootDir", "src", ...files,
  ], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);
}

export const emptyDeps = {
  check: async () => ({ findings: [], summary: { errors: 0, warnings: 0, advises: 0 } }),
  touched: async () => [],
  deltas: async () => [],
};
