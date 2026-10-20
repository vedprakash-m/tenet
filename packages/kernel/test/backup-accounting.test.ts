import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { failureSignature, recordAttempt, withSignature } from "../src/core/budget.ts";
import { BudgetState } from "../src/core/schemas.ts";
import { newBudget } from "../src/core/budget.ts";
import { cleanup, initState } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const p = project(); roots.push(p.root); return p; };

describe("durable recovery accounting [WRK-08, CON-03]", () => {
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
