import { after, describe, it } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, focusFixture, project, reviewResult, waitFor } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import type { Verb } from "../src/pipeline.ts";
import { CheckInput } from "../src/core/schemas.ts";
import { VERBS } from "../src/verbs/index.ts";
import { gather } from "../src/verbs/facts.ts";

const roots: string[] = [];
const fresh = () => { const p = project(); roots.push(p.root); return p; };
after(() => roots.forEach(cleanup));

describe("audit: common mutation boundaries", () => {
  it("does not report checked-local from a backup whose authority was suspended [SEC-12, EVD-01]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "backup verdict", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL); await p.call("check", { h, touched: ["src/greet.ts"] });
    await focusFixture(p, h);
    await p.ports().store.transaction("test", async tx => tx.publish(tx.state!));
    p.write(".tenet/state", "{ corrupt");
    const why = await p.call("inspect", { h, view: "why" });
    assert.notEqual((why.data as { endpoint: string }).endpoint, "checked-local");
    assert.ok(why.reasons.some(r => r.code === "authority-needed"));
  });
  it("does not ignore a required type check added after green [CFG-11, EVD-01]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "required checks", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL); await p.call("check", { h, touched: ["src/greet.ts"] });
    await focusFixture(p, h);
    const before = Object.values(p.ports().store.read()!.state.work)[0]!.budget.checksLaunched;
    await p.call("decide", { h, kind: "config", target: "required_checks", propose: { value: [{ id: "types", property: "no type errors", tool: "tsc" }] } });
    const why = await p.call("inspect", { h, view: "why" });
    assert.notEqual((why.data as { endpoint: string }).endpoint, "checked-local");
    assert.ok(why.reasons.some(r => r.code === "evidence-missing" && /OB-types/.test(r.message)), JSON.stringify(why.reasons));
    const check = await p.call("check", { h, again: true });
    assert.ok((check.data as { receipts: Array<{ obligation: string }> }).receipts.some(r => r.obligation === "OB-types"), "the new requirement is run, not ignored");
    assert.ok(Object.values(p.ports().store.read()!.state.work)[0]!.budget.checksLaunched > before);
  });
  it("does not lock a changed support definition as if the earlier red still proved it [EVD-10]", async () => {
    const p = project({ "src/helper.ts": "export const helper = 1;\n" }); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "support binding", lane: "quick" })).handle!;
    const basis = { ...BASIS, elements: BASIS.elements.map(e => e.kind === "example" ? { ...e, support: ["src/helper.ts"] } : e) };
    await p.call("decide", { h, kind: "basis", propose: basis });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    let state = p.ports().store.read()!.state;
    assert.equal(Object.values(state.work)[0]!.obligations[0]!.state, "registered", "red alone is not verified red-to-green");
    p.write("src/greet.ts", GREET_IMPL);
    p.write("src/helper.ts", "export const helper = 2;\n");
    await p.call("check", { h, touched: ["src/greet.ts", "src/helper.ts"] });
    state = p.ports().store.read()!.state;
    assert.notEqual(Object.values(state.work)[0]!.obligations[0]!.state, "locked");
    assert.equal(state.locks.length, 0);
    const why = await p.call("inspect", { h, view: "why" });
    assert.ok(why.reasons.some(r => r.code === "red-invalidated"));
  });

  it("does not return a cached check after its observed toolchain changes [EVD-03]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "toolchain identity", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const ports = p.ports(), original = ports.stack.fingerprint;
    let observed = "first";
    ports.stack.fingerprint = root => ({ ...original(root), adapter: observed });
    const first = await runVerb(ports, VERBS, "check", { h, touched: ["src/greet.ts"] });
    assert.equal(first.exit, 0);
    observed = "changed";
    const second = await runVerb(ports, VERBS, "check", { h, touched: ["src/greet.ts"] });
    assert.equal(second.historical, undefined);
    assert.equal(second.budget.attempts, "2/3");
  });
  it("keeps a landed commit uncertain when a hook makes postcondition inspection unavailable [CON-03]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "hook changes configuration", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] });
    await focusFixture(p, h);
    p.write(".git/hooks/pre-commit", "#!/bin/sh\nfor i in $(seq 1 20001); do : > \"made-by-hook-$i\"; done\n");
    const { chmodSync } = await import("node:fs"); chmodSync(join(p.root, ".git/hooks/pre-commit"), 0o755);
    await p.call("finish", { h });
    await p.call("decide", { h, kind: "hook-consent", answers: { "hook-consent": "commit-with-hooks" } });
    const parent = p.git("rev-parse", "HEAD");
    const r = await p.call("finish", { h, subject: "landed but uninspectable" });
    assert.notEqual(p.git("rev-parse", "HEAD"), parent);
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(x => x.code === "effect-uncertain"));
    const state = p.ports().store.read()!.state, w = Object.values(state.work)[0]!;
    assert.equal(w.state, "blocked");
    assert.equal(w.session.inCall, undefined);
    assert.equal(state.sourceOwner?.work, w.id);
    await p.ports().store.transaction("test", async tx => { assert.ok(tx.unresolved().some(x => x.effect === "commit")); });
  });
  it("does not launch a process after its prepared job was cancelled [CON-12]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "late spawn", lane: "quick" })).handle!;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const delayed: Verb = {
      name: "delayed-spawn", schema: CheckInput, class: () => "mutating", editing: () => true,
      run(ports, state) {
        const w = Object.values(state!.work)[0]!, id = "delayed-spawn", runDir = ports.store.tempDir(id);
        return { state: { ...state!, work: { ...state!.work, [w.id]: { ...w, session: { ...w.session, inCall: { runId: id, ...ports.store.self(), verb: "check", runDir, since: ports.clock.now() } } } } }, resp: { work: w.id }, job: {
          id, async execute() { await barrier; return ports.runner.run({ argv: [process.execPath, "-e", "require('fs').writeFileSync('launched-after-cancel','bad')"], cwd: ports.root, runDir, timeoutMs: 5000 }); },
          async finalize(_tx, st) { return { state: st, resp: { work: w.id } }; },
        } };
      },
    };
    const running = runVerb(p.ports(), { ...VERBS, "delayed-spawn": delayed }, "delayed-spawn", { h });
    await waitFor(() => Object.values(p.ports().store.read()!.state.work)[0]!.session.inCall);
    await p.call("stop", { h, mode: "cancel" });
    release();
    const r = await running;
    assert.ok(r.reasons.some(x => x.code === "run-superseded"));
    assert.equal(existsSync(join(p.root, "launched-after-cancel")), false);
  });
  it("keeps a missing recovery process record fenced across calls and stop [CON-03]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "unknown process", lane: "quick" })).handle!;
    const ports = p.ports(), runDir = ports.store.tempDir("run-unrecorded");
    await ports.store.transaction("test", async tx => {
      const state = tx.state!, w = Object.values(state.work)[0]!;
      tx.publish({ ...state, work: { ...state.work, [w.id]: { ...w, state: "checking", session: { ...w.session, inCall: { runId: "unrecorded", pid: 2 ** 22 + 5, procStart: "dead", verb: "check", since: ports.clock.now(), runDir } } } } });
    });
    for (const verb of ["check", "check", "stop"]) {
      const r = await p.call(verb, { h, ...(verb === "stop" ? { mode: "pause" } : {}) });
      assert.equal(r.exit, 2, JSON.stringify(r));
      assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
      const state = ports.store.read()!.state, w = Object.values(state.work)[0]!;
      assert.equal(w.session.inCall?.cancelled, true);
      assert.equal(state.sourceOwner?.work, w.id);
    }
  });
  it("treats no-edit as a prohibition rather than an overridable protected path [CFG-11]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("decide", { h, kind: "config", target: "exclusions", propose: { value: [{ pattern: "src/", kinds: ["no-edit"] }] } });
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("check", { h, touched: ["src/greet.ts"] });
    assert.equal(r.exit, 2);
    assert.ok(r.reasons.some(x => x.code === "authority-needed"));
    assert.equal(r.questions, undefined, "no grant question may weaken a no-edit restriction");
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.budget.checksLaunched, 0);
  });
  it("refuses specialized profiles that lack their safeguards", async () => {
    const p = fresh();
    for (const profile of ["promote", "recipe-upgrade", "continue"]) {
      const r = await p.call("open", { profile, request: "first" });
      assert.equal(r.exit, 2);
      assert.equal(r.reasons[0]?.code, "capability-missing");
      assert.equal(r.handle, undefined);
    }
  });
  it("recommends Standard for an ordinary feature when no lane was requested [WRK-04]", async () => {
    const p = fresh();
    const r = await p.call("open", { profile: "feature", request: "add a feature" });
    assert.equal((r.data as { lane: string }).lane, "standard");
  });
  it("refuses unsupported review scopes instead of reporting the working tree [REV-01]", async () => {
    const p = fresh();
    for (const scope of ["branch", "file", "document"]) {
      const r = await p.call("review", { scope });
      assert.notEqual(r.exit, 0);
      assert.equal(r.reasons[0]?.code, "capability-missing");
      assert.equal(r.data, undefined);
    }
  });
  it("bounds direct kernel input before creating state [NFR-03]", async () => {
    const p = fresh();
    const r = await p.call("open", { profile: "feature", request: "bounded", scopePaths: ["x".repeat(1024 * 1024 + 1)] });
    assert.equal(r.exit, 1);
    assert.equal(r.reasons[0]?.code, "invalid-input");
    assert.equal(p.ports().store.exists(), false);
  });
  it("bounds structured proposal depth before creating state [NFR-03]", async () => {
    const p = fresh();
    let propose: unknown = {};
    for (let i = 0; i < 66; i++) propose = { nested: propose };
    const r = await p.call("decide", { kind: "overview", propose });
    assert.equal(r.exit, 1);
    assert.equal(r.reasons[0]?.code, "invalid-input");
    assert.equal(p.ports().store.exists(), false);
  });
  it("applies shared no-model-send exclusions before a stateless review [SEC-14]", async () => {
    const p = fresh();
    p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "src/greet.ts", kinds: ["no-model-send"] }] }));
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("review", {});
    assert.equal(r.exit, 0, JSON.stringify(r));
    const { readFileSync } = await import("node:fs");
    const manifest = JSON.parse(readFileSync((r.data as { manifest: string }).manifest, "utf8"));
    assert.ok(!manifest.investigation.includes("src/greet.ts"));
    assert.ok(!manifest.changes.some((c: { path: string }) => c.path === "src/greet.ts"));
  });
  it("suspends backup grants and preserves the good backup during recovery [CON-03, SEC-12]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write(".tenet/state", "{ corrupt");
    const store = p.ports().store;
    const recovered = store.read()!;
    assert.equal(recovered.recovered, true);
    assert.equal(Object.values(recovered.state.work)[0]!.grants.length, 0);
    const check = await p.call("check", { h });
    assert.equal(check.exit, 2);
    assert.equal(check.reasons[0]?.code, "authority-needed", "suspended authority must prevent execution, not just disappear from the record");
    await store.transaction("test", async tx => tx.publish(tx.state!));
    assert.equal(store.read()!.recovered, false);
    p.write(".tenet/state", "{ corrupt again");
    assert.equal(Object.values(store.read()!.state.work)[0]!.grants.length, 0);
  });
  it("keeps an uncertain effect fenced across successive calls [CON-03]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const store = p.ports().store;
    const w = Object.values(store.read()!.state.work)[0]!;
    await store.transaction("test", async tx => tx.intent("unknown-operation", "uncertain", { work: w.id }));
    for (let i = 0; i < 2; i++) {
      const r = await p.call("check", { h, again: true });
      assert.equal(r.exit, 2);
      assert.ok(r.effects?.uncertain.some(x => x.includes("unknown-operation")), JSON.stringify(r));
      assert.equal(Object.values(store.read()!.state.work)[0]!.budget.checksLaunched, 0);
    }
  });
  it("creates a distinct stacked branch for a second contract and honors current mode [GIT-02]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const first = p.git("branch", "--show-current");
    await p.call("stop", { h, mode: "pause" });
    const h2 = (await p.call("open", { profile: "feature", request: "second" })).handle!;
    const r = await p.call("decide", { h: h2, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.notEqual(p.git("branch", "--show-current"), first);
    await p.call("stop", { h: h2, mode: "pause" });
    const h3 = (await p.call("open", { profile: "feature", request: "third" })).handle!;
    const current = p.git("branch", "--show-current");
    await p.call("decide", { h: h3, kind: "config", target: "branching", propose: { value: "current", scope: "task" } });
    await p.call("decide", { h: h3, kind: "basis", propose: BASIS });
    assert.equal(p.git("branch", "--show-current"), current);
  });

  it("refuses a source operation after an external branch switch [GIT-02]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.git("checkout", "-q", "main");
    const r = await p.call("check", { h });
    assert.equal(r.exit, 2);
    assert.ok(r.reasons.some(x => x.code === "stale-session"));
  });
  it("does not preserve baseline proof when a locked assertion is revised [EVD-10]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] });
    const before = Object.values(p.ports().store.read()!.state.work)[0]!.obligations[0]!;
    p.write("src/greet.test.ts", GREET_TEST.replace('.toBe("Hello, Ada!")', '.toBeTruthy()'));
    await p.call("decide", { h, kind: "disposition", target: "src/greet.test.ts", propose: { outcome: "accepted", reason: "revise this test" } });
    const after = Object.values(p.ports().store.read()!.state.work)[0]!.obligations[0]!;
    assert.equal(after.state, "revised");
    assert.equal(after.baselineMatched, false);
    assert.equal(after.baselineTestHash, before.baselineTestHash, "the historical baseline hash remains historical");
  });
  it("refuses the unimplemented committed-tree stage before running", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const r = await p.call("check", { h, stage: "committed" });
    assert.equal(r.exit, 2);
    assert.ok(r.reasons.some(x => x.code === "capability-missing"));
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.receipts.length, 0);
    assert.equal(w.budget.checksLaunched, 0);
  });

  it("stops admission at the attempt cap, but preserves a successful final attempt [WRK-08]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    for (let i = 0; i < 3; i++) {
      const r = await p.call("check", { h, touched: ["src/greet.ts"], again: true });
      assert.equal(r.exit, 0, JSON.stringify(r));
    }
    const before = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(before.stopReason, undefined);
    const r = await p.call("check", { h, again: true });
    assert.equal(r.exit, 2);
    assert.ok(r.reasons.some(x => x.code === "budget-exhausted"));
    const after = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(after.budget.checksLaunched, before.budget.checksLaunched);
    assert.equal(after.budget.attempts, 3);
  });

  it("rejects a malformed unadopted policy [CFG-11]", async () => {
    const p = fresh();
    p.write("tenet.policy.json", '{"protected_pathz":["src/"]}');
    const r = await p.call("open", { profile: "feature", request: "first" });
    assert.equal(r.exit, 2);
    assert.ok(r.reasons.some(x => x.code === "restriction-key-unknown"));
  });

  it("applies protection tightened mid-work and asks in chat [WRK-03]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("decide", { h, kind: "config", target: "protected_paths", propose: { value: ["src/"] } });
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("check", { h, touched: ["src/greet.ts"] });
    assert.equal(r.exit, 3);
    assert.equal(r.questions?.[0]?.id, "grant-confirm");
    assert.equal(r.questions?.[0]?.channel, "chat");
  });

  it("raises the lane from actual auth edits before review [WRK-04]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/auth/login.ts", "export const login = () => true;\n");
    await p.call("check", { h, touched: ["src/auth/login.ts"] });
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.assessment.access, "high");
    assert.notEqual(w.lane, "quick");
    assert.notEqual(w.floor, "quick");
  });

  it("does not infer authorship from a predicted path [GIT-08]", async () => {
    const p = fresh();
    await p.call("open", { profile: "feature", request: "first", scopePaths: ["src/"] });
    p.write("src/personal.ts", "export const personal = 1;\n");
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    const facts = await gather(p.ports(), w);
    assert.ok(facts.att.unexplained.includes("src/personal.ts"));
    assert.ok(!facts.tenetPaths.includes("src/personal.ts"));
  });
  it("refuses a parked editing handle while another contract owns source [AGT-08]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("stop", { h, mode: "pause" });
    await p.call("open", { profile: "feature", request: "second" });
    const r = await p.call("check", { h });
    assert.equal(r.exit, 2);
    assert.equal(r.reasons[0]?.code, "owned-by-other-work");
  });

  it("a planning contract cannot run a source-changing decision [AGT-08]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "plan", request: "plan only" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const r = await p.call("decide", { h, kind: "scaffold" });
    assert.equal(r.exit, 2);
    assert.equal(r.reasons[0]?.code, "authority-needed");
  });

  it("a cancelled external job cannot finalize, independent of the verb [CON-12]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "first" })).handle!;
    let release!: (result: unknown) => void;
    const pending = new Promise(resolve => { release = resolve; });
    let finalized = false;
    const delayed: Verb = {
      name: "delayed", schema: CheckInput, class: () => "mutating", editing: () => true,
      run(ports, state) {
        const w = Object.values(state!.work)[0]!;
        return { state: { ...state!, work: { ...state!.work, [w.id]: { ...w, session: { ...w.session, inCall: { runId: "delayed", ...ports.store.self(), verb: "delayed", since: ports.clock.now() } } } } }, resp: { work: w.id }, job: {
          id: "delayed", execute: () => pending,
          async finalize(_tx, st) { finalized = true; return { state: st, resp: { work: w.id } }; },
        } };
      },
    };
    const running = runVerb(p.ports(), { ...VERBS, delayed }, "delayed", { h });
    await waitFor(() => Object.values(p.ports().store.read()!.state.work)[0]!.session.inCall);
    await p.call("stop", { h, mode: "cancel" });
    release({ ok: true });
    const r = await running;
    assert.equal(finalized, false);
    assert.ok(r.reasons.some(x => x.code === "run-superseded"));
  });

  it("honors configured integration setting in finish and acceptance [CFG-02, GIT-11]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "greet", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline", touched: ["src/greet.test.ts"] });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] });
    const cfg = await p.call("decide", { h, kind: "config", target: "integration", propose: { value: "auto-on-accept" } });
    assert.equal(cfg.exit, 0, JSON.stringify(cfg));
    const fin = await finishFixture(p, { h });
    assert.equal((fin.data as any).integration.next, "accept");
    const acc = await p.call("decide", { h, kind: "acceptance", target: "accepted" });
    assert.equal(acc.exit, 0, JSON.stringify(acc));
    assert.equal(p.git("branch", "--show-current"), "main");
  });

  it("reconciles an interrupted work-branch switch during recovery [CON-03, GIT-02]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "greet", scopePaths: ["src/greet.ts"] })).handle!;
    const ports = p.ports();
    const w = Object.values(ports.store.read()!.state.work)[0]!;
    await ports.store.transaction("decide", async (tx) => {
      tx.intent("branch", "b-crash", { work: w.id, from: "main", to: "tenet/w-0001-greet" });
    });
    p.git("checkout", "-q", "-b", "tenet/w-0001-greet");
    const r = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok(r.effects?.completed.some((e) => /branch tenet\/w-0001-greet had been created/.test(e)));
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.git.branch, "tenet/w-0001-greet");
  });

  it("invalidates review when newly declared reviewPaths are absent from the review manifest [REV-01]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "greet", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline", touched: ["src/greet.test.ts"] });
    p.write("src/greet.ts", GREET_IMPL);
    p.write("docs/spec.md", "# Spec\n");
    const ch = await p.call("check", { h, touched: ["src/greet.ts"] });
    const f = await p.call("findings", { h, result: reviewResult(ch.data as any, { dispatchMode: "same-session" }) });
    assert.equal(f.exit, 0, JSON.stringify(f));
    const ask = await p.call("finish", { h });
    assert.equal(ask.exit, 3, JSON.stringify(ask));
    await p.call("decide", { h, kind: "unexplained", answers: { unexplained: "mine" } });
    const fin = await p.call("finish", { h, noCommit: true });
    assert.equal((fin.data as any).endpoint, "implemented-unverified");
    assert.ok(fin.reasons.some((r) => r.code === "review-stale"));
  });
});
