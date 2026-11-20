import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { KernelError } from "../src/core/errors.ts";
import { hashOf } from "../src/core/ids.ts";
import { undoOutcome } from "../src/decisions/undo.ts";
import { emptyState } from "../src/core/state.ts";
import type { State } from "../src/core/schemas.ts";
import type { Ports, Tx } from "../src/ports/types.ts";
import { recover } from "../src/verbs/recover.ts";
import { PUBLISH, SETTLE, type Recovery } from "../src/verbs/recover-effects.ts";
import { recoverUndo } from "../src/verbs/recover-undo.ts";
import { cleanup } from "./helpers.ts";
import { contractFixture } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

function undoRecovery(images: {
  a: string | null;
  b: string | null;
  modes?: { a?: string; b?: string };
}) {
  const original = contractFixture({
    id: "original", label: "W-0001", session: { generation: 1 },
    state: "finished", git: { ...contractFixture().git, undoneBy: "W-0002" },
  });
  const provisional = contractFixture({
    id: "provisional", label: "W-0002", session: {
      generation: 2, inCall: { runId: "u-1", verb: "undo", since: "2026-11-18", runDir: "owned-run" },
    },
    state: "executing", reverting: ["a.ts", "b.ts"],
  });
  const base = emptyState("ws", "tag");
  const state: State = {
    ...base,
    sourceOwner: { work: provisional.id, generation: 2 },
    work: { [original.id]: original, [provisional.id]: provisional },
    project: {
      ...base.project,
      intent: {
        ...base.project.intent,
        elements: [{ id: "CNS-001-und", origin: "request", kind: "constraint", text: "Undo W-0001",
          verifiedBy: { notApplicable: "a revert has no new behavior to prove" } }],
      },
    },
  };
  let applies = 0;
  const ports = {
    runner: { stopRun: async () => "gone" as const },
    git: {
      inventory: async () => ({ entries: new Map([
        ...images.a === null ? [] : [["a.ts", {
          path: "a.ts", mode: images.modes?.a ?? "100644", blob: images.a,
        }] as const],
        ...images.b === null ? [] : [["b.ts", {
          path: "b.ts", mode: images.modes?.b ?? "100644", blob: images.b,
        }] as const],
      ]) }),
      applyPatch: async () => { applies++; return { ok: true }; },
    },
  } as unknown as Ports;
  const results: unknown[][] = [];
  const tx = { result: (...args: unknown[]) => results.push(args) } as unknown as Tx;
  const recovery: Recovery = { ports, tx, state, completed: [], uncertain: [] };
  const op = {
    work: provisional.id, original: original.id, provisionalLabel: provisional.label,
    originalGeneration: 1, provisionalGeneration: 2,
    priorSourceOwner: null, intentElementId: "CNS-001-und",
    intentElementHash: hashOf(state.project.intent.elements[0]),
    tree: "post-tree", paths: ["a.ts", "b.ts"],     pre: {
      "a.ts": { mode: "100644", blob: "pre-a" },
      "b.ts": { mode: "100644", blob: "pre-b" },
    },
    post: {
      "a.ts": { mode: "100644", blob: "post-a" },
      "b.ts": { mode: "100644", blob: "post-b" },
    }, patch: "blob", runDir: "owned-run",
  };
  return { recovery, op, results, applies: () => applies };
}

describe("undo recovery [CON-03, P117]", () => {
  it("records exact all-pre as terminal cancellation and restores prior ownership without retry", async () => {
    const f = undoRecovery({ a: "pre-a", b: "pre-b" });
    await recoverUndo(f.recovery, { effect: "undo", id: "u-1", op: f.op });
    assert.equal(f.applies(), 0);
    assert.equal(f.recovery.state.work.provisional!.state, "cancelled");
    assert.equal(f.recovery.state.work.provisional!.session.inCall, undefined);
    assert.equal(f.recovery.state.work.provisional!.reverting, undefined);
    assert.equal(f.recovery.state.work.original!.git.undoneBy, undefined);
    assert.equal(f.recovery.state.sourceOwner, undefined);
    assert.deepEqual(f.recovery.state.project.intent.elements, []);
    const recorded = f.results.at(-1);
    assert.deepEqual(recorded?.[2], { completed: false });
    assert.ok(f.recovery.completed.some((message) => /did not apply/.test(message)));
  });

  it("leaves partial multi-path postconditions unresolved without applying a subset", async () => {
    const f = undoRecovery({ a: "post-a", b: "pre-b" });
    await recoverUndo(f.recovery, { effect: "undo", id: "u-1", op: f.op });
    assert.equal(f.applies(), 0);
    assert.deepEqual(f.results, []);
    assert.ok(f.recovery.uncertain.some((message) => /partial|postcondition/i.test(message)));
    assert.equal(f.recovery.state.work.provisional!.state, "executing");
    assert.deepEqual(f.recovery.state.sourceOwner, { work: "provisional", generation: 2 });
  });

  it("does not close all-pre recovery when the provisional contract is missing", async () => {
    const f = undoRecovery({ a: "pre-a", b: "pre-b" });
    delete f.recovery.state.work.provisional;
    await recoverUndo(f.recovery, { effect: "undo", id: "u-1", op: f.op });
    assert.deepEqual(f.results, []);
    assert.ok(f.recovery.uncertain.some(message => /lost its provisional contract/.test(message)));
    assert.equal(f.recovery.state.work.original!.git.undoneBy, "W-0002");
  });

  it("records all-post from postconditions without consulting an unavailable inverse mechanism", async () => {
    const f = undoRecovery({ a: "post-a", b: "post-b" });
    await recoverUndo(f.recovery, { effect: "undo", id: "u-1", op: f.op });
    assert.equal(f.applies(), 0);
    assert.deepEqual((f.results.at(-1))?.[2], { completed: true });
    assert.equal(f.recovery.state.work.provisional!.state, "executing");
    assert.equal(f.recovery.state.work.provisional!.session.inCall, undefined);
    assert.ok(f.recovery.completed.some(message => /had been applied/.test(message)));
  });

  it("does not call a same-blob mode change all-post", async () => {
    const f = undoRecovery({ a: "same", b: "same", modes: { a: "100755", b: "100644" } });
    f.op.pre = {
      "a.ts": { mode: "100644", blob: "same" },
      "b.ts": { mode: "100644", blob: "same" },
    };
    f.op.post = {
      "a.ts": { mode: "100755", blob: "same" },
      "b.ts": { mode: "100755", blob: "same" },
    };
    await recoverUndo(f.recovery, { effect: "undo", id: "u-1", op: f.op });
    assert.deepEqual(f.results, []);
    assert.ok(f.recovery.uncertain.some(message => /partial or changed postcondition/.test(message)));
  });

  for (const [name, images, result] of [
    ["all-post despite a failing process result", { a: "post-a", b: "post-b" }, { ok: false }],
    ["partial despite a successful process result", { a: "post-a", b: "pre-b" }, { ok: true }],
  ] as const) it(`finalizes first application from complete path postconditions: ${name}`, async () => {
    const f = undoRecovery(images);
    const provisional = f.recovery.state.work.provisional!;
    const plan = {
      paths: f.op.paths, stat: "1 file changed",
    } as Parameters<typeof undoOutcome>[5];
    const out = await undoOutcome(
      f.recovery.ports, f.recovery.tx, f.recovery.state, provisional, f.op, plan, "u-1", result,
    );
    if (images.b === "post-b") {
      assert.equal(out.resp.exit, undefined);
      assert.deepEqual((f.results.at(-1))?.[2], { completed: true });
    } else {
      assert.equal(out.resp.exit, 2);
      assert.ok(out.resp.effects?.uncertain.includes("undo postcondition is not established"));
      assert.deepEqual(f.results, []);
    }
  });

  it("contains one handler failure and continues later effects without losing earlier completions [CON-03]", async () => {
    const work = contractFixture({ id: "work", label: "W-0001" });
    const state: State = { ...emptyState("ws", "tag"), work: { work } };
    const ports = {} as Ports;
    const unresolved = [
      { effect: "test-before", id: "one", op: { work: work.id } },
      { effect: "test-throw", id: "two", op: { work: work.id } },
      { effect: "test-after", id: "three", op: { work: work.id } },
    ];
    const results: string[] = [];
    const tx = {
      state,
      unresolved: () => unresolved.filter(item => !results.includes(item.id)),
      result: (_effect: string, id: string) => results.push(id),
      recent: () => [],
    } as unknown as Tx;
    const saved = { a: SETTLE["test-before"], b: SETTLE["test-throw"], c: SETTLE["test-after"] };
    SETTLE["test-before"] = async (r, u) => {
      r.completed.push(`before ${u.id}`); r.tx.result(u.effect, u.id, { completed: true });
    };
    SETTLE["test-throw"] = async (r, u) => {
      r.state = { ...r.state, generationSeq: 99 };
      r.completed.push("discarded partial completion");
      r.tx.result(u.effect, u.id, { completed: true });
      throw new KernelError("capability-missing", "PRIVATE_INTERNAL_PATH", { exit: 2 });
    };
    SETTLE["test-after"] = async (r, u) => {
      r.completed.push(`after ${u.id}`); r.tx.result(u.effect, u.id, { completed: true });
    };
    try {
      const recovered = await recover(ports, tx, state);
      assert.deepEqual(recovered.completed, ["before one", "after three"]);
      assert.ok(recovered.uncertain.some((message) => /test-throw two.*capability-missing/.test(message)));
      assert.equal(JSON.stringify(recovered.uncertain).includes("PRIVATE_INTERNAL_PATH"), false);
      assert.equal(recovered.state.generationSeq, state.generationSeq);
      assert.equal(recovered.completed.includes("discarded partial completion"), false);
      assert.deepEqual(tx.unresolved().map((item) => `${item.effect}:${item.id}`), ["test-throw:two"]);
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        const key = { a: "test-before", b: "test-throw", c: "test-after" }[name]!;
        if (value) SETTLE[key] = value; else delete SETTLE[key];
      }
    }
  });

  it("contains process ownership probe failures and continues later intents", async () => {
    const provisional = contractFixture({
      id: "provisional", label: "W-0002", state: "executing",
      session: { generation: 2, inCall: {
        runId: "u-1", pid: 123, procStart: "synthetic", verb: "undo", since: "2026-11-18", runDir: "run",
      } },
    });
    const state: State = { ...emptyState("ws", "tag"), work: { provisional } };
    const after = SETTLE["test-after-process"];
    SETTLE["test-after-process"] = async (r, u) => {
      r.completed.push(`after ${u.id}`);
      r.tx.result(u.effect, u.id, { completed: true });
    };
    const unresolved = [
      { effect: "undo", id: "u-1", op: { ...undoRecovery({ a: "pre-a", b: "pre-b" }).op } },
      { effect: "test-after-process", id: "three", op: {} },
    ];
    const results: string[] = [];
    const tx = {
      state,
      unresolved: () => unresolved.filter(item => !results.includes(item.id)),
      result: (_effect: string, id: string) => results.push(id),
      recent: () => [],
    } as unknown as Tx;
    const ports = {
      store: { alive: async () => false },
      runner: { stopRun: async () => { throw new Error("PRIVATE_PROCESS_PROBE"); } },
    } as unknown as Ports;
    try {
      const recovered = await recover(ports, tx, state);
      assert.ok(recovered.completed.includes("after three"));
      assert.ok(recovered.uncertain.some(message => /undo|process ownership/.test(message)));
      assert.equal(JSON.stringify(recovered.uncertain).includes("PRIVATE_PROCESS_PROBE"), false);
      assert.deepEqual(tx.unresolved().map(item => item.id), ["u-1"]);
    } finally {
      if (after) SETTLE["test-after-process"] = after;
      else delete SETTLE["test-after-process"];
    }
  });

  it("replays a logged all-pre result after crash before state publication", () => {
    const f = undoRecovery({ a: "pre-a", b: "pre-b" });
    PUBLISH.undo!(f.recovery, f.op, { completed: false });
    assert.equal(f.recovery.state.work.provisional!.state, "cancelled");
    assert.equal(f.recovery.state.work.original!.git.undoneBy, undefined);
    assert.deepEqual(f.recovery.state.sourceOwner, undefined);
    assert.deepEqual(f.recovery.state.project.intent.elements, []);
  });

  it("replays completed:false records through the normal recovery pass", async () => {
    const f = undoRecovery({ a: "pre-a", b: "pre-b" });
    const tx = {
      state: f.recovery.state,
      unresolved: () => [],
      result: () => assert.fail("resolved records must not be written twice"),
      recent: () => [
        { kind: "intent", effect: "undo", id: "u-1", op: f.op },
        { kind: "result", effect: "undo", id: "u-1", outcome: { completed: false } },
      ],
    } as unknown as Tx;
    const recovered = await recover({} as Ports, tx, f.recovery.state);
    assert.equal(recovered.state.work.provisional!.state, "cancelled");
    assert.equal(recovered.state.work.original!.git.undoneBy, undefined);
    assert.deepEqual(recovered.state.sourceOwner, undefined);
    assert.ok(recovered.completed.some(message => /did not apply/.test(message)));
  });

  it("does not replay an all-pre cancellation twice in one recovery pass", async () => {
    const f = undoRecovery({ a: "pre-a", b: "pre-b" });
    const writes: Array<{ effect: string; id: string; outcome: unknown }> = [];
    const tx = {
      state: f.recovery.state,
      unresolved: () => [{ effect: "undo", id: "u-1", op: f.op }],
      result: (effect: string, id: string, outcome: unknown) => writes.push({ effect, id, outcome }),
      recent: () => [
        { kind: "intent", effect: "undo", id: "u-1", op: f.op },
        ...writes.map(write => ({ kind: "result", ...write })),
      ],
    } as unknown as Tx;
    const ports = {
      runner: { stopRun: async () => "gone" as const },
      git: f.recovery.ports.git,
    } as unknown as Ports;
    const recovered = await recover(ports, tx, f.recovery.state);
    assert.equal(recovered.state.work.provisional!.state, "cancelled");
    assert.equal(writes.length, 1);
    assert.equal(recovered.uncertain.length, 0, recovered.uncertain.join("\n"));
    assert.equal(recovered.completed.filter(message => /did not apply/.test(message)).length, 1);
  });
});
