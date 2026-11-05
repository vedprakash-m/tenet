import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { contractFixture, project } from "./support/fixture.ts";
import { cleanup } from "./helpers.ts";
import { snapshotOf } from "../src/core/attribution.ts";
import { emptyState } from "../src/core/state.ts";
import { WorkContract, type Receipt } from "../src/core/schemas.ts";
import type { Ports, Tx } from "../src/ports/types.ts";
import { checkInputId, gather, type Facts } from "../src/verbs/facts.ts";
import { startCommit } from "../src/verbs/commit.ts";

describe("checkpoint green-boundary admission [GIT-03]", () => {
  let p: ReturnType<typeof project>, ports: Ports, work: WorkContract, facts: Facts, receipt: Receipt, head: string;
  let intentCount = 0;
  before(async () => {
    p = project();
    ports = p.ports();
    // Planning only: no prepared job executes or needs a native process identity.
    ports.store.self = () => ({ pid: process.pid, procStart: "synthetic-planning-only" });
    ports.store.tempDir = () => p.root;
    const initial = await ports.git.inventory([]);
    work = contractFixture({
      label: "W-0001", level: "L4",
      basis: { intentRevision: 0, elementIds: [], hash: "basis", traits: [] },
      git: { mode: "git", base: initial.head, branch: initial.branch, start: snapshotOf(initial), commits: [], committed: [] },
      obligations: [{ id: "required-test", kind: "test", category: "acceptance", tool: "vitest" }],
      touched: [{ path: "src/greet.ts" }],
    });
    p.write("src/greet.ts", "export const greet = (_name: string): string => 'changed';\n");
    facts = await gather(ports, work);
    assert.deepEqual(facts.tenetPaths, ["src/greet.ts"]);
    work.lastCheck = { candidate: facts.candidate, at: work.updatedAt, stage: "candidate" };
    work.touched[0]!.hashAtLastCheck = facts.inv.entries.get("src/greet.ts")!.blob;
    receipt = {
      id: "RC-1", obligation: "required-test", kind: "test", stage: "candidate", source: "kernel-run",
      checkInputId: checkInputId(ports, work, facts.candidate), scope: "full", argv: ["vitest", "run"], cwd: ".",
      exit: 0, durationMs: 1, counts: { discovered: 1, executed: 1, passed: 1, failed: 0, skipped: 0, focused: 0 },
      versions: { tool: "fixture", reporter: "fixture", adapter: "fixture" },
      provenance: { runId: "fixture", runDir: "fixture", startedAt: work.updatedAt },
      status: "pass", qualifiers: [], reasons: [], limitations: [], candidate: facts.candidate,
    };
    head = p.git("rev-parse", "HEAD");
  });
  after(() => { if (p) cleanup(p.root); });

  async function prepare(receipts: Receipt[], change?: (w: WorkContract) => void) {
    const w = WorkContract.parse({ ...work, receipts });
    change?.(w);
    const state = { ...emptyState("fixture", "fixture"), work: { [w.id]: w } };
    const intents: unknown[] = [];
    intentCount = 0;
    const unused = (): never => { throw new Error("unexpected transaction operation"); };
    const tx: Tx = {
      state, recovered: false, ensure: unused, publish: unused, call: unused,
      intent: (...args) => { intentCount++; intents.push(args); return "intent"; },
      result: unused, unresolved: () => [], evict: unused, recent: unused,
    };
    const plan = await startCommit(ports, tx, state, w, facts, "Checkpoint", async () => {
      throw new Error("this test never executes the prepared commit job");
    });
    return { plan, intents };
  }

  const refused: Array<[string, () => Receipt[], ((w: WorkContract) => void)?]> = [
    ["failed current full check", () => [{ ...receipt, status: "fail", exit: 1 }]],
    ["missing receipts", () => []],
    ["inconclusive check", () => [{ ...receipt, status: "inconclusive" }]],
    ["skipped check", () => [{ ...receipt, status: "skipped" }]],
    ["flaky pass", () => [{ ...receipt, qualifiers: ["flaky"] }]],
    ["targeted-only pass", () => [{ ...receipt, scope: "targeted" }]],
    ["baseline-only pass", () => [{ ...receipt, stage: "baseline" }]],
    ["stale check inputs", () => [{ ...receipt, checkInputId: "previous-inputs" }]],
    ["wrong receipt candidate", () => [{ ...receipt, candidate: "previous-candidate" }]],
    ["missing required obligation", () => [receipt], w => {
      w.obligations.push({ id: "missing", kind: "static", category: "affected", tool: "tsc" });
    }],
    ["newer failure after a green run", () => [receipt, { ...receipt, id: "RC-2", status: "fail", exit: 1 }]],
    ["newer targeted failure after a full pass", () => [receipt, { ...receipt, id: "RC-2", scope: "targeted", status: "fail", exit: 1 }]],
    ["last check is baseline", () => [receipt], w => { w.lastCheck!.stage = "baseline"; }],
  ];
  for (const [name, receipts, change] of refused) {
    it(`refuses ${name} before a commit intent or job`, async () => {
      await assert.rejects(prepare(receipts(), change), (error: unknown) =>
        error instanceof Error && "exit" in error && error.exit === 2);
      assert.equal(intentCount, 0);
      assert.equal(p.git("rev-parse", "HEAD"), head);
    });
  }

  it("prepares a fresh full green checkpoint before review without executing it", async () => {
    const out = await prepare([receipt]);
    assert.ok(out.plan?.job);
    assert.equal(out.intents.length, 1);
    assert.equal(p.git("rev-parse", "HEAD"), head);
  });

  it("accepts a later full pass after a recorded failure", async () => {
    const out = await prepare([{ ...receipt, id: "old", status: "fail" }, receipt]);
    assert.ok(out.plan?.job);
    assert.equal(out.intents.length, 1);
  });
});
