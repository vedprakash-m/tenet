// Historical counterexample, outside the product test suite. Run before changing backup accounting.
// Three real candidate runs exhaust Quick; corrupting state then reveals the previous revision's smaller counters.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BASIS, GREET_TEST, project } from "../../../packages/kernel/test/support/fixture.ts";
import { cleanup } from "../../../packages/kernel/test/helpers.ts";

const p = project();
let workspace: string | undefined;
try {
  const h = (await p.call("open", { profile: "feature", request: "backup counter accounting", lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  for (const value of ["one", "two", "three"]) {
    p.write("src/greet.ts", `export const greet = (_name: string): string => ${JSON.stringify(value)};\n`);
    await p.call("check", { h, touched: ["src/greet.ts"], again: true });
  }
  const before = Object.values(p.ports().store.read()!.state.work)[0]!;
  workspace = p.ports().store.read()!.state.workspaceId;
  assert.equal(before.budget.attempts, 3);
  p.write(".tenet/state", "{ corrupt");
  const fallback = p.ports().store.read()!, after = Object.values(fallback.state.work)[0]!;
  assert.equal(fallback.recovered, true);
  assert.equal(after.budget.attempts, 2);
  assert.equal(after.grants.length, 0);
  console.log(JSON.stringify({ observed: "backup counter rollback", attemptsBefore: before.budget.attempts, attemptsAfter: after.budget.attempts, checksBefore: before.budget.checksLaunched, checksAfter: after.budget.checksLaunched, authoritySuspended: true, additionalAttemptLaunched: false }, null, 2));
} finally {
  if (workspace && /^ws_[a-z2-7]{10}$/.test(workspace)) rmSync(join(tmpdir(), `tenet-${workspace}`), { recursive: true, force: true });
  cleanup(p.root);
}
