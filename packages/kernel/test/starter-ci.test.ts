// The starter's CI workflow runs the checks the recipe declares, with the commands Tenet itself uses (GIT-07).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";

const starter = join(import.meta.dirname, "../../../plugin/skills/tenet-starter-ts-web-api");
const workflow = readFileSync(join(starter, "template/.github/workflows/ci.yml"), "utf8");
const scripts: Record<string, string> = JSON.parse(readFileSync(join(starter, "template/package.json"), "utf8")).scripts;
const recipe: { checks: string[] } = JSON.parse(readFileSync(join(starter, "recipe.json"), "utf8"));

/** What each obligation runs locally (adapters/node-ts.ts: `tsc --noEmit -p tsconfig.json`, `eslint .`, `vitest run`, Playwright), as the npm script CI calls. */
const OBLIGATIONS: Record<string, { script: string; command: string }> = {
  tsc: { script: "typecheck", command: "tsc --noEmit" },
  eslint: { script: "lint", command: "eslint ." },
  vitest: { script: "test", command: "vitest run" },
  e2e: { script: "e2e", command: "playwright test" },
};

/** The obligations whose script CI does not run, or whose script is not the command Tenet runs. */
function gaps(text: string, pkgScripts: Record<string, string>, obligations: string[]): string[] {
  const doc = parse(text) as { jobs: Record<string, { steps: Array<{ run?: string }> }> };
  const runs = Object.values(doc.jobs).flatMap((job) => job.steps.map((step) => step.run ?? ""));
  return obligations.flatMap((name) => {
    const { script, command } = OBLIGATIONS[name]!;
    const call = script === "test" ? "npm test" : `npm run ${script}`;
    return [
      ...(runs.some((run) => run.trim() === call) ? [] : [`${name}: CI does not run \`${call}\``]),
      ...(pkgScripts[script] === command ? [] : [`${name}: script ${script} is not \`${command}\``]),
    ];
  });
}

describe("starter CI workflow [GIT-07]", () => {
  it("runs every check the recipe declares, plus the full test suite, with the commands Tenet runs", () => {
    assert.deepEqual(recipe.checks, ["tsc", "eslint", "e2e"]);
    assert.deepEqual(gaps(workflow, scripts, [...recipe.checks, "vitest"]), []);
  });

  it("detects a missing step and a changed script (control)", () => {
    const withoutE2e = workflow.replace(/^ *- run: npm run e2e\n?/m, "");
    assert.deepEqual(gaps(withoutE2e, scripts, ["e2e"]), ["e2e: CI does not run `npm run e2e`"]);
    assert.deepEqual(gaps(workflow, { ...scripts, lint: "eslint src" }, ["eslint"]), ["eslint: script lint is not `eslint .`"]);
  });
});
