// Version pinning and the pause (LFC-03, specs/schema-migration.md v2): a contract pinned to one kernel, schema and adapter stops at
// its next boundary when those change, says what changed, and continues only after an explicit reconcile.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { versionDrift, kernelLine, schemaStatus } from "../src/core/versions.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, callWithEnvelopeConsent, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const work = (p: Project) => Object.values(p.ports().store.read()!.state.work)[0]!;
/** The same project as another build of Tenet: other kernel, adapter or schema version, everything else real. */
function as(p: Project, over: { version?: string; adapter?: string }) {
  const base = p.ports();
  const stack = over.adapter
    ? Object.create(base.stack, {
      adapterVersion: { value: () => over.adapter },
      fingerprint: { value: (root: string) => ({ ...base.stack.fingerprint(root), adapter: over.adapter }) },
    })
    : base.stack;
  const ports = { ...base, ...(over.version ? { version: over.version } : {}), stack };
  const raw = (verb: string, input: Record<string, unknown> = {}) => runVerb(ports, VERBS, verb, input);
  return (verb: string, input: Record<string, unknown> = {}) => callWithEnvelopeConsent(raw, verb, input);
}
const open = async (p: Project, profile = "plan") => (await p.call("open", { profile, request: "plan the work" })).handle!;

describe("schema metadata status (pure) [LFC-03]", () => {
  it("treats absent metadata as unavailable without defaulting to schema 1", () => {
    for (const record of [undefined, null, false, 1, "metadata", [], {}, { work: {} }]) {
      assert.equal(schemaStatus(record, 1), "unavailable");
    }
  });

  it("requires an own schema on a non-array object", () => {
    assert.equal(schemaStatus(Object.create({ schema: 1 }), 1), "unavailable");
    assert.equal(schemaStatus(Object.assign([], { schema: 1 }), 1), "unavailable");
  });

  it("supports matching positive safe integers without claiming the state is valid", () => {
    assert.equal(schemaStatus({ schema: 1 }, 1), "supported");
    assert.equal(schemaStatus(Object.assign(Object.create(null), { schema: 1 }), 1), "supported");
    assert.equal(schemaStatus({ schema: 1, work: null }, 1), "supported");
    assert.equal(schemaStatus({ schema: Number.MAX_SAFE_INTEGER }, Number.MAX_SAFE_INTEGER), "supported");
  });

  it("rejects explicit future and older schemas", () => {
    assert.equal(schemaStatus({ schema: 2 }, 1), "unsupported");
    assert.equal(schemaStatus({ schema: 1 }, 2), "unsupported");
  });

  it("rejects malformed explicit schemas", () => {
    for (const schema of [undefined, "1", null, false, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, {}, []]) {
      assert.equal(schemaStatus({ schema }, 1), "unsupported");
    }
  });

  it("requires the running schema to be a positive safe integer too", () => {
    for (const current of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(schemaStatus({ schema: current }, current), "unsupported");
    }
  });
});

describe("the drift rule (pure) [LFC-03]", () => {
  const run = { tenet: "0.1.0-m0", schema: 1, adapter: "node-ts@10" };
  it("names kernel major.minor plus pre-release, schema and adapter, and ignores a patch release", () => {
    assert.deepEqual(versionDrift({ tenet: "0.1.0-m0", schema: 1, adapter: "node-ts@10" }, run), []);
    assert.deepEqual(versionDrift({ tenet: "0.1.7-m0", schema: 1, adapter: "node-ts@10" }, run), [], "a patch release does not pause");
    assert.deepEqual(versionDrift({ tenet: "0.2.0-m0", schema: 1, adapter: "node-ts@10" }, run).map((d) => d.field), ["kernel"]);
    assert.deepEqual(versionDrift({ tenet: "0.1.0-m1", schema: 1, adapter: "node-ts@10" }, run).map((d) => d.field), ["kernel"], "a pre-release tag counts");
    assert.deepEqual(versionDrift({ tenet: "0.1.0-m0", schema: 2, adapter: "node-ts@10" }, run).map((d) => d.field), ["schema"]);
    assert.deepEqual(versionDrift({ tenet: "0.1.0-m0", schema: 1, adapter: "node-ts@9" }, run).map((d) => d.field), ["adapter"]);
  });
  it("treats a missing adapter as unchanged and says when it is a downgrade", () => {
    assert.deepEqual(versionDrift({ tenet: "0.1.0-m0", schema: 1 }, run), []);
    const d = versionDrift({ tenet: "0.3.0-m0", schema: 1, adapter: "node-ts@12" }, run);
    assert.deepEqual(d.map((x) => x.downgrade), [true, true]);
    assert.equal(kernelLine("0.1.9-m0"), "0.1-m0");
  });
});

describe("a pinned contract pauses when Tenet changes [LFC-03]", () => {
  it("records kernel, schema and adapter on a new contract", async () => {
    const p = fresh();
    await open(p);
    assert.deepEqual(work(p).pinned, { tenet: "0.1.0-m0", schema: 1, adapter: p.ports().stack.adapterVersion() });
  });

  it("a changed adapter pauses the next call with one question; inspect and stop still work", async () => {
    const p = fresh();
    const h = await open(p);
    const next = as(p, { adapter: "node-ts@99" });
    const r = await next("check", { h, stage: "candidate" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "version-changed");
    assert.equal(r.questions![0]!.id, "version-reconcile");
    assert.match(r.reasons[0]!.message, /adapter/);
    assert.equal((await next("inspect", { view: "status", h })).exit, 0);
    const note = await next("inspect", { view: "status", h });
    assert.ok(note.reasons.some((x) => x.code === "version-changed" && x.note), "a read-only call notes the drift without refusing");
    assert.equal((await next("stop", { h, mode: "pause" })).exit, 0);
  });

  it("'continue' re-pins this contract only; grants, counters and intent are unchanged, and the next call runs", async () => {
    const p = fresh();
    const h = await open(p);
    const before = work(p);
    const next = as(p, { version: "0.2.0-m0" });
    assert.equal((await next("decide", { h, kind: "basis", propose: BASIS })).exit, 3);
    const done = await next("decide", { h, kind: "version-reconcile", answers: { "version-reconcile": "continue" } });
    assert.equal(done.exit, 0, JSON.stringify(done));
    const after = work(p);
    assert.equal(after.pinned.tenet, "0.2.0-m0");
    const counters = (w: typeof before) => [w.budget.attempts, w.budget.reviewRounds, w.budget.rechecks, w.budget.delegations, w.budget.checksLaunched, w.budget.tenetTokens];
    assert.deepEqual([after.grants, counters(after), after.obligations.length], [before.grants, counters(before), before.obligations.length]);
    assert.equal((await next("decide", { h, kind: "basis", propose: BASIS })).exit, 0);
  });

  it("'stop' parks the contract", async () => {
    const p = fresh();
    const h = await open(p);
    const next = as(p, { adapter: "node-ts@99" });
    const r = await next("decide", { h, kind: "version-reconcile", answers: { "version-reconcile": "stop" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(work(p).state, "parked");
  });

  it("a patch release of the kernel does not pause", async () => {
    const p = fresh();
    const h = await open(p);
    const r = await as(p, { version: "0.1.9-m0" })("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 0, JSON.stringify(r));
  });

  it("an older document with no adapter is back-filled, not paused", async () => {
    const p = fresh();
    const h = await open(p);
    const store = p.ports().store;
    await store.transaction("test", async (tx) => {
      const s = tx.state!, w = Object.values(s.work)[0]!;
      const { adapter: _a, ...pinned } = w.pinned;
      tx.publish({ ...s, work: { [w.id]: { ...w, pinned } } });
    });
    assert.equal((await p.call("decide", { h, kind: "basis", propose: BASIS })).exit, 0);
    assert.equal(work(p).pinned.adapter, p.ports().stack.adapterVersion());
  });

  it("a downgrade is named as one", async () => {
    const p = fresh();
    const h = await open(p);
    await as(p, { version: "0.2.0-m0" })("decide", { h, kind: "version-reconcile", answers: { "version-reconcile": "continue" } });
    const r = await as(p, { version: "0.1.0-m0" })("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 3);
    assert.match(r.reasons[0]!.message, /older|downgrade/i);
  });

  it("open --resume still returns a handle, with the question, so the answer can be given", async () => {
    const p = fresh();
    const h = await open(p);
    await p.call("stop", { h, mode: "pause" });
    const r = await as(p, { adapter: "node-ts@99" })("open", { profile: "plan", request: "plan the work", resume: true });
    assert.ok(r.handle && r.handle !== h, JSON.stringify(r));
    assert.equal(r.exit, 3);
    assert.equal(r.questions![0]!.id, "version-reconcile");
    const done = await as(p, { adapter: "node-ts@99" })("decide", { h: r.handle, kind: "version-reconcile", answers: { "version-reconcile": "continue" } });
    assert.equal(done.exit, 0, JSON.stringify(done));
  });

  for (const [label, over] of [
    ["kernel major drift", { version: "1.1.0-m0" }],
    ["kernel minor drift", { version: "0.2.0-m0" }],
    ["adapter drift", { adapter: "node-ts@99" }],
    ["no drift", {}],
  ] as const) {
    it(`repeated identical open preserves the proposed contract under ${label}`, async () => {
      const p = fresh();
      const h = await open(p);
      const before = p.ports().store.read()!.state;
      const next = as(p, over);
      const response = await next("open", { profile: "plan", request: "plan the work" });
      const after = p.ports().store.read()!.state;
      assert.equal(response.exit, label === "no drift" ? 0 : 3, JSON.stringify(response));
      assert.equal(response.handle, h);
      if (label !== "no drift") {
        assert.deepEqual(response.questions?.map((question) => question.id), ["version-reconcile"]);
        assert.ok(response.reasons.some((reason) => reason.code === "version-changed"));
        assert.equal(response.next[0]!.action, "ask");
      } else {
        assert.ok(!response.questions?.some((question) => question.id === "version-reconcile"));
      }
      assert.equal(after.generationSeq, before.generationSeq);
      assert.deepEqual(Object.keys(after.work), Object.keys(before.work));
      assert.deepEqual(after.pending, before.pending);
      assert.deepEqual(after.sourceOwner, before.sourceOwner);
      assert.equal(work(p).state, "proposed");
      assert.deepEqual(work(p).session.generation, Object.values(before.work)[0]!.session.generation);
      assert.deepEqual(work(p).pinned, Object.values(before.work)[0]!.pinned);
      assert.deepEqual(work(p).budget, Object.values(before.work)[0]!.budget);
      const note = await next("inspect", { view: "status", h });
      assert.equal(note.exit, 0);
      if (label !== "no drift") {
        assert.ok(note.reasons.some((reason) => reason.code === "version-changed" && reason.note));
      }
    });
  }

  it("a new contract on a project with a paused one pins the running versions", async () => {
    const p = fresh();
    await open(p);
    const next = as(p, { adapter: "node-ts@99" });
    const second = await next("open", { profile: "plan", request: "something else" });
    assert.equal(second.exit, 0, JSON.stringify(second));
    const pinned = Object.values(p.ports().store.read()!.state.work).map((w) => w.pinned.adapter).sort();
    assert.deepEqual(pinned, [p.ports().stack.adapterVersion(), "node-ts@99"].sort());
  });

  it("a changed adapter makes old receipts stale: after 'continue' the check reruns", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const first = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(first.exit, 0);
    const next = as(p, { adapter: "node-ts@99" });
    assert.equal((await next("check", { h, stage: "candidate" })).exit, 3);
    await next("decide", { h, kind: "version-reconcile", answers: { "version-reconcile": "continue" } });
    const why = await next("inspect", { view: "why", h });
    assert.ok(JSON.stringify(why.reasons).match(/stale|evidence-missing/), JSON.stringify(why.reasons));
  });
});
