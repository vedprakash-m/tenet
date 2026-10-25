import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { accountingCheckpoint, failureSignature, recordAttempt, recoverAccounting, withSignature } from "../src/core/budget.ts";
import { BudgetState } from "../src/core/schemas.ts";
import { newBudget } from "../src/core/budget.ts";
import { replayCommit } from "../src/core/attribution.ts";
import { recordedResults } from "../src/core/state.ts";
import type { LogEntry } from "../src/ports/types.ts";
import { cleanup, initState } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, focusFixture, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const p = project(); roots.push(p.root); return p; };

describe("durable recovery accounting [WRK-08, CON-03]", () => {
  for (const conflict of ["in-flight", "completeness", "budget", "sequence"]) {
    it(`refuses same-revision ${conflict} conflicts or regressions while retaining observed usage [WRK-08, CON-03]`, async () => {
      const p = fresh(); await p.call("open", { profile: "investigate", request: "conflicting accounting checkpoints" });
      const before = p.ports().store.read()!.state, work = Object.values(before.work)[0]!;
      const next = { ...before, revision: before.revision + 1,
        work: { ...before.work, [work.id]: { ...work, budget: recordAttempt(work.budget) } } };
      const point = { ...accountingCheckpoint(next, before), t: "first" };
      const changed = conflict === "in-flight" ? { ...point, inFlight: [work.id] } :
        conflict === "completeness" ? { ...point, complete: false } :
        conflict === "sequence" ? { ...point, workSeq: point.workSeq + 1, generationSeq: point.generationSeq + 1 } :
        { ...point, entries: point.entries.map(entry => ({ ...entry, budget: recordAttempt(entry.budget) })) };
      for (const records of [[changed, { ...point, t: "retry" }], [point, { ...changed, t: "retry" }]]) {
        const recovered = recoverAccounting(before, records);
        assert.equal(recovered.verified, (conflict === "budget" || conflict === "sequence") && records[0] === point, conflict);
        assert.equal(recovered.state.work[work.id]!.budget.attempts, conflict === "budget" ? 2 : 1);
        assert.equal(recovered.state.workSeq, conflict === "sequence" ? before.workSeq + 1 : before.workSeq);
        assert.equal(recovered.state.generationSeq, conflict === "sequence" ? before.generationSeq + 1 : before.generationSeq);
      }
    });
  }
  it("accepts an identical accounting checkpoint retry with a different timestamp [CON-03]", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "identical accounting retry" });
    const before = p.ports().store.read()!.state, work = Object.values(before.work)[0]!;
    const next = { ...before, revision: before.revision + 1,
      work: { ...before.work, [work.id]: { ...work, budget: recordAttempt(work.budget) } } };
    const point = accountingCheckpoint(next, before);
    const recovered = recoverAccounting(before, [{ ...point, t: "first" }, { ...point, t: "retry" }]);
    assert.equal(recovered.verified, true);
    assert.equal(recovered.state.work[work.id]!.budget.attempts, 1);
  });
  it("keeps monotone same-revision progress after an unpublished checkpoint verifiable [CON-03]", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "unpublished checkpoint retry" });
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-budget-checkpoint.ts"), p.root], { stdio: ["ignore", "ignore", "inherit"] });
    assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.budget.attempts, 1);
    await p.ports().store.transaction("test", async tx => {
      const state = tx.state!, work = Object.values(state.work)[0]!;
      tx.publish({ ...state, work: { ...state.work, [work.id]: { ...work, budget: recordAttempt(work.budget) } } });
    });
    p.write(".tenet/state", "{ corrupt");
    const recovered = p.ports().store.read()!.state;
    assert.equal(recovered.recovered?.accounting, "verified");
    assert.equal(Object.values(recovered.work)[0]!.budget.attempts, 2);
  });
  it("pairs distant results by effect and ID while retaining first-intent semantics [CON-03]", () => {
    const commit = { work: "commit-work" }, scaffold = { work: "scaffold-work" }, colon = { work: "colon-work" };
    const log: LogEntry[] = [
      { t: "t", kind: "intent", effect: "commit", id: "shared", op: commit },
      { t: "t", kind: "intent", effect: "scaffold", id: "shared", op: scaffold },
      { t: "t", kind: "intent", effect: "commit:extra", id: "shared", op: colon },
      { t: "t", kind: "intent", effect: "commit", id: "extra:shared", op: { work: "other-colon-work" } },
      ...Array.from({ length: 1000 }, (): LogEntry => ({ t: "t", kind: "call", verb: "inspect", exit: 0, revision: 1 })),
      { t: "t", kind: "intent", effect: "commit", id: "shared", op: { work: "later-duplicate" } },
      { t: "t", kind: "result", effect: "scaffold", id: "shared", outcome: { completed: true } },
      { t: "t", kind: "result", effect: "commit", id: "shared", outcome: { completed: true } },
      { t: "t", kind: "result", effect: "commit:extra", id: "shared", outcome: { completed: false } },
    ];
    const replay = recordedResults(log);
    assert.deepEqual(replay.map(item => item.effect), ["scaffold", "commit", "commit:extra"]);
    assert.equal(replay[0]!.op, scaffold); assert.equal(replay[1]!.op, commit); assert.equal(replay[2]!.op, colon);
    assert.deepEqual(replay[2]!.outcome, { completed: false });
  });
  it("keeps diagnostic tails separate from complete recovery history [CON-03]", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "journal views" });
    await p.ports().store.transaction("test", async tx => {
      tx.intent("commit", "view", { work: "test" });
      tx.result("commit", "view", { completed: false });
      const all = tx.recent();
      assert.ok(all.length > 2);
      assert.deepEqual(tx.recent(2), all.slice(-2));
      assert.equal(recordedResults(all).at(-1)?.effect, "commit");
      assert.equal(tx.unresolved().length, 0);
    });
  });
  for (const noise of [0, 450]) it(`replays a foreign-path review gate after a commit result lands before state publication with ${noise} later records [CON-03, GIT-03]`, async () => {
    const p = project({ "human.txt": "original human bytes\n" }); roots.push(p.root);
    p.write("human.txt", "human staged\n"); p.git("add", "human.txt");
    p.write("human.txt", "human staged and unstaged\n");
    const humanIndex = p.git("ls-files", "-s", "--", "human.txt");
    const h = (await p.call("open", { profile: "feature", request: "recover foreign hook review", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL); await p.call("check", { h, touched: ["src/greet.ts"] });
    await focusFixture(p, h);
    p.write(".git/hooks/pre-commit", "#!/bin/sh\ngit add human.txt\n");
    chmodSync(join(p.root, ".git/hooks/pre-commit"), 0o755);
    assert.equal((await p.call("finish", { h })).questions?.[0]?.id, "hook-consent");
    await p.call("decide", { h, kind: "hook-consent", answers: { "hook-consent": "commit-with-hooks" } });
    const workId = Object.values(p.ports().store.read()!.state.work)[0]!.id;
    const count = Number(p.git("rev-list", "--count", "HEAD"));
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-commit.ts"), p.root, "finish",
      JSON.stringify({ h, subject: "greeting" }), "after-result"], { stdio: ["ignore", "ignore", "inherit"] });
    assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
    const landed = p.git("rev-parse", "HEAD");
    assert.equal(Number(p.git("rev-list", "--count", "HEAD")), count + 1);
    if (noise) await p.ports().store.transaction("test", async tx => {
      for (let index = 0; index < noise; index++) tx.call({ verb: "inspect", exit: 0, revision: tx.state!.revision });
    });
    await p.call("open", { profile: "investigate", request: "recover the recorded commit" });
    const recovered = p.ports().store.read()!.state.work[workId]!;
    assert.deepEqual(recovered.git.commits, [landed]);
    assert.ok(recovered.attention.some(item => item.path === "human.txt" && !item.disposition), "the foreign-path gate must survive the crash");
    await p.call("open", { profile: "investigate", request: "repeat recorded recovery" });
    const repeated = p.ports().store.read()!.state.work[workId]!;
    assert.deepEqual(repeated.git.commits, recovered.git.commits);
    assert.deepEqual(repeated.attention, recovered.attention);
    const finished = await p.call("finish", { h, again: true });
    assert.notEqual((finished.data as Record<string, unknown>)?.endpoint, "checked-local", JSON.stringify(finished));
    const foreign = recovered.attention.find(item => item.path === "human.txt")!;
    assert.equal((await p.call("decide", { h, kind: "disposition", target: foreign.id,
      propose: { outcome: "accepted", reason: "I reviewed and chose to retain the hook's human-file commit." } })).exit, 0);
    await p.call("open", { profile: "investigate", request: "retain reviewed recovery" });
    const disposition = p.ports().store.read()!.state.work[workId]!.attention.find(item => item.id === foreign.id)?.disposition;
    assert.equal(disposition?.outcome, "accepted");
    assert.equal(disposition?.by, "user");
    assert.equal(p.git("ls-files", "-s", "--", "human.txt"), humanIndex);
    assert.equal(readFileSync(join(p.root, "human.txt"), "utf8"), "human staged and unstaged\n");
    assert.equal(p.git("rev-parse", "HEAD"), landed);
    assert.equal(Number(p.git("rev-list", "--count", "HEAD")), count + 1);
  });
  it("refuses legacy or malformed unpublished foreign-path metadata and keeps replay idempotent [CON-03]", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "replay admission" });
    const work = Object.values(p.ports().store.read()!.state.work)[0]!;
    for (const foreign of [undefined, null, "human.txt", [1], ["human.txt", false]]) {
      assert.equal(replayCommit(work, { commit: "landed", foreign }, ["src/greet.ts"]), undefined);
    }
    const recovered = replayCommit(work, { commit: "landed", foreign: ["human.txt"] }, ["src/greet.ts"])!;
    assert.deepEqual(recovered.budget, work.budget); assert.deepEqual(recovered.grants, work.grants);
    assert.equal(recovered.attention[0]?.path, "human.txt");
    assert.equal(replayCommit(recovered, { commit: "landed" }, ["src/greet.ts"]), recovered);
    assert.equal(replayCommit(work, {}, []), work);
    assert.deepEqual(work.git.commits, []); assert.deepEqual(work.attention, []);
  });
  it("retains the three real candidate attempts after fallback, while suspending authority", async () => {
    const p = fresh(), h = (await p.call("open", { profile: "feature", request: "budget recovery", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS }); p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    for (const value of ["one", "two", "three"]) {
      p.write("src/greet.ts", `export const greet = (_name: string): string => ${JSON.stringify(value)};\n`);
      await p.call("check", { h, touched: ["src/greet.ts"], again: true });
    }
    const before = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(before.budget.attempts, 3);
    p.write(".tenet/state", "{ corrupt");
    const restored = p.ports().store.read()!, after = Object.values(restored.state.work)[0]!;
    assert.equal(restored.recovered, true);
    assert.equal(after.budget.attempts, before.budget.attempts);
    assert.equal(after.budget.checksLaunched, before.budget.checksLaunched);
    assert.deepEqual(after.budget.signatures, before.budget.signatures);
    assert.equal(after.stopReason, "budget-exhausted");
    assert.equal(after.grants.length, 0);
    assert.equal((restored.state.recovered as { accounting?: string }).accounting, "verified");
    const diagnostic = await p.call("inspect", { h, view: "why" });
    assert.equal(diagnostic.exit, 3);
    assert.ok(diagnostic.reasons.some(r => r.code === "state-recovered-from-backup" && r.message.includes("verified")));
    assert.equal(readFileSync(join(p.root, ".tenet/state"), "utf8"), "{ corrupt", "inspection never republishes recovered state");
  });

  it("rejects negative and fractional budget values instead of granting extra capacity", () => {
    for (const key of ["attempts", "reviewRounds", "rechecks", "delegations", "checksLaunched", "tenetTokens"]) {
      for (const value of [-1, 0.5]) assert.equal(BudgetState.safeParse({ ...newBudget(), [key]: value }).success, false, key);
    }
  });

  it("recovers a checkpoint written before publication without restoring authority from the log", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "checkpoint" });
    const before = p.ports().store.read()!.state;
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-budget-checkpoint.ts"), p.root], { stdio: ["ignore", "ignore", "inherit"] });
    assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
    const after = p.ports().store.read()!;
    assert.equal(after.recovered, false);
    assert.equal(after.state.revision, before.revision, "the unpublished revision is not fabricated");
    assert.equal(Object.values(after.state.work)[0]!.budget.attempts, 1);
    assert.deepEqual(Object.values(after.state.work)[0]!.grants, Object.values(before.work)[0]!.grants);
  });

  it("preserves allocated work and generation sequences when the newest contract is lost [CON-05]", async () => {
    const p = fresh(); await initState(p.root);
    const first = await p.call("open", { profile: "investigate", request: "first" });
    p.write(".tenet/state", "{ corrupt");
    const restored = p.ports().store.read()!.state;
    assert.equal(restored.workSeq, 1); assert.equal(restored.generationSeq, 1);
    const second = await p.call("open", { profile: "investigate", request: "second" });
    assert.match(second.handle!, /^W2\.2\./);
    assert.notEqual(second.handle, first.handle);
  });

  it("keeps legacy recovery diagnostic when no accounting checkpoint can establish usage", async () => {
    const p = fresh(), h = (await p.call("open", { profile: "feature", request: "legacy", lane: "quick" })).handle!;
    const store = p.ports().store;
    await store.transaction("test", async tx => {
      const state = tx.state!, w = Object.values(state.work)[0]!;
      tx.publish({ ...state, work: { ...state.work, [w.id]: { ...w, budget: recordAttempt(w.budget) } } });
    });
    const path = join(p.root, ".tenet/log");
    writeFileSync(path, readFileSync(path, "utf8").split("\n").filter(line => line && JSON.parse(line).kind !== "accounting").join("\n") + "\n");
    p.write(".tenet/state", "{ corrupt");
    const state = store.read()!.state;
    assert.equal((state.recovered as { accounting?: string }).accounting, "unknown");
    assert.equal(Object.values(state.work)[0]!.grants.length, 0);
    const diagnostic = await p.call("inspect", { h, view: "status" });
    assert.equal(diagnostic.exit, 3);
    assert.ok(diagnostic.reasons.some(r => r.code === "state-recovered-from-backup" && r.message.includes("unknown")));
    assert.notEqual((await p.call("check", { h })).exit, 0);
  });

  it("stores opaque signatures in accounting records and preserves legacy failure matching [SEC-11]", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "opaque accounting" });
    await p.ports().store.transaction("test", async tx => {
      const state = tx.state!, w = Object.values(state.work)[0]!;
      const legacy = "o|a,b|OBSERVED_PRIVATE_ASSERTION_CANARY expected N to be N";
      tx.publish({ ...state, work: { ...state.work, [w.id]: { ...w, budget: withSignature(recordAttempt(w.budget), legacy) } } });
    });
    assert.equal(readFileSync(join(p.root, ".tenet/log"), "utf8").includes("OBSERVED_PRIVATE_ASSERTION_CANARY"), false);
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.budget.signatures[0], failureSignature("o", ["b", "a"], "OBSERVED_PRIVATE_ASSERTION_CANARY expected 3 to be 4"));
  });

  it("leaves accounting unknown when a backup omits an in-flight run", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "unknown run cost" });
    await p.ports().store.transaction("test", async tx => {
      const state = tx.state!, w = Object.values(state.work)[0]!;
      tx.publish({ ...state, work: { ...state.work, [w.id]: { ...w, session: { ...w.session, inCall: { runId: "unknown", verb: "check", since: "t" } } } } });
    });
    p.write(".tenet/state", "{ corrupt");
    assert.equal((p.ports().store.read()!.state.recovered as { accounting?: string }).accounting, "unknown");
    const count = Object.keys(p.ports().store.read()!.state.work).length;
    const opened = await p.call("open", { profile: "feature", request: "must not outlive an unknown run" });
    assert.equal(opened.exit, 3);
    assert.equal(opened.handle, undefined, "a new request cannot bypass unknown recovery ownership/cost");
    assert.equal(Object.keys(p.ports().store.read()!.state.work).length, count);
  });

  it("cannot verify delta accounting across a missing journal revision", async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "missing checkpoint" });
    const backup = readFileSync(join(p.root, ".tenet/state"), "utf8");
    for (let i = 0; i < 3; i++) await p.ports().store.transaction("test", async tx => {
      const state = tx.state!, w = Object.values(state.work)[0]!;
      tx.publish({ ...state, work: { ...state.work, [w.id]: { ...w, budget: recordAttempt(w.budget) } } });
    });
    writeFileSync(join(p.root, ".tenet/state.prev"), backup); p.write(".tenet/state", "{ corrupt");
    const path = join(p.root, ".tenet/log"), revision = JSON.parse(backup).revision;
    writeFileSync(path, readFileSync(path, "utf8").split("\n").filter(line => line && !(JSON.parse(line).kind === "accounting" && JSON.parse(line).revision === revision + 2)).join("\n") + "\n");
    assert.equal((p.ports().store.read()!.state.recovered as { accounting?: string }).accounting, "unknown");
  });

  it("never calls a landed undo unperformed when fallback lost its new contract", async () => {
    const p = fresh(), h = (await p.call("open", { profile: "feature", request: "landed undo", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS }); p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" }); p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] }); await finishFixture(p, { h, subject: "Greeting" });
    await p.call("undo", { h });
    const input = { h, kind: "undo-confirm", answers: { "undo-confirm": "apply" } };
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-undo.ts"), p.root, JSON.stringify(input), "after-apply"], { stdio: ["ignore", "ignore", "inherit"] });
    assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
    assert.notEqual(readFileSync(join(p.root, "src/greet.ts"), "utf8"), GREET_IMPL);
    p.write(".tenet/state", "{ corrupt");
    const r = await p.call("open", { profile: "investigate", request: "recovery" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
    await p.ports().store.transaction("test", async tx => { assert.ok(tx.unresolved().some(e => e.effect === "undo")); });
  });
});
