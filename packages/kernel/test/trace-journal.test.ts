// Real calls leave journal `call` records that carry the ENG-09 trace fields (TS §16). These tests run mutating verbs, so
// they run where the kernel supports mutation (Linux, macOS); the pure rules are in trace.test.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { FsStore } from "../src/adapters/store-fs.ts";
import { systemRandom } from "../src/adapters/system.ts";
import { emptyState } from "../src/core/state.ts";
import { cleanup, tmp } from "./helpers.ts";
import { BASIS, GREET_TEST, callWithEnvelopeConsent, project } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

const clock = () => {
  let t = Date.parse("2026-11-03T09:00:00.000Z");
  return { advance: (ms: number) => { t += ms; }, now: () => new Date(t).toISOString(), ms: () => t };
};

const rig = () => {
  const p = project();
  roots.push(p.root);
  const c = clock();
  const call = (verb: string, input: Record<string, unknown> = {}) =>
    callWithEnvelopeConsent((v, i = {}) => runVerb({ ...p.ports(), clock: c }, VERBS, v, i), verb, input);
  const calls = () => p.ports().store.readLog().filter((e) => e.kind === "call");
  return { p, c, call, calls };
};

describe("journal call records are ENG-09 trace events", () => {
  it("a real contract call yields work, intent revision, times, termination and the declared gaps [ENG-09]", async () => {
    const r = rig();
    const opened = await r.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
    const h = opened.handle!;
    r.c.advance(1000);
    await r.call("decide", { h, kind: "basis", propose: BASIS });
    const decide = r.calls().filter((e) => e.verb === "decide").at(-1)!;
    assert.match(String(decide.work), /^W-\d{4}$/);
    assert.equal(typeof decide.intentRevision, "number");
    assert.ok((decide.intentRevision as number) >= 1, "accepting the basis raised the intent revision");
    assert.equal(decide.termination, "completed");
    assert.equal(typeof decide.startedAt, "string");
    assert.equal(typeof decide.durationMs, "number");
    assert.equal(decide.exit, 0);
    assert.equal(decide.role, "unknown");
    assert.equal(decide.model, "unknown");
    assert.equal(decide.permission, "unknown");
    assert.deepEqual(decide.visibilityGaps, ["role", "model", "permission"]);
    assert.ok(Date.parse(String(decide.startedAt)) <= Date.parse(decide.t), "the record ends no earlier than it starts");
  });

  it("a check call carries its check outcome, and other calls carry none [ENG-09]", async () => {
    const r = rig();
    const h = (await r.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    await r.call("decide", { h, kind: "basis", propose: BASIS });
    r.p.write("src/greet.test.ts", GREET_TEST);
    await r.call("check", { h, stage: "baseline" });
    const all = r.calls();
    const checks = all.filter((e) => e.verb === "check" && e.termination);
    assert.ok(checks.length >= 1, "the finished check call is journalled");
    for (const c of checks) assert.ok(["pass", "fail", "inconclusive", "skipped"].includes(String(c.checkOutcome)));
    assert.ok(all.filter((e) => e.verb !== "check").every((e) => !("checkOutcome" in e)));
  });

  it("a record holds only the declared fields: no prompt, file content, secret or command output [SEC-11]", async () => {
    const r = rig();
    const request = "add a greeting; " + "token=ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789";
    await r.call("open", { profile: "feature", request, scopePaths: ["src/greet.ts"], lane: "quick" });
    assert.ok(r.calls().length > 0, "the open call is journalled");
    const text = JSON.stringify(r.calls());
    assert.ok(!text.includes("ghp_") && !text.includes("add a greeting") && !text.includes("export const greet"));
    const allowed = new Set(["t", "kind", "verb", "exit", "revision", "work", "intentRevision", "startedAt", "durationMs",
      "termination", "checkOutcome", "role", "model", "permission", "visibilityGaps"]);
    for (const e of r.calls()) for (const k of Object.keys(e)) assert.ok(allowed.has(k), `unexpected field ${k}`);
  });

  it("records written before the trace fields still read, and old trace records reduce to counts by verb and exit [ENG-09]", async () => {
    const root = tmp("tenet-trace-");
    roots.push(root);
    let now = Date.parse("2026-05-01T12:00:00Z");
    const store = new FsStore(root, { now: () => new Date(now).toISOString(), ms: () => now }, systemRandom);
    const trace = { work: "W-0001", intentRevision: 2, startedAt: "2026-05-01T11:59:59.000Z", durationMs: 5, termination: "completed",
      role: "unknown", model: "unknown", permission: "unknown", visibilityGaps: ["role", "model", "permission"] };
    await store.transaction("seed", async (tx) => {
      const i = tx.ensure();
      tx.publish(emptyState(i.workspaceId, i.tag));
      tx.call({ verb: "decide", exit: 0, revision: 1 }); // the shape before the trace fields
      tx.call({ verb: "decide", exit: 0, revision: 2, ...trace });
    });
    assert.deepEqual(store.readLog().filter((e) => e.kind === "call").map((e) => "termination" in e), [false, true]);
    now = Date.parse("2026-11-03T12:00:00Z");
    await store.transaction("later", async (tx) => { for (let i = 0; i < 100; i++) tx.call({ verb: "check", exit: 0, revision: 3 }); tx.evict([]); });
    const kept = store.readLog().filter((e) => e.kind === "call");
    assert.ok(kept.every((e) => e.verb === "check"), "the two old records left the journal");
    const month = JSON.parse(readFileSync(join(root, ".tenet", "summaries.json"), "utf8")).months["2026-05"];
    assert.deepEqual([month.calls, month.exits], [{ decide: 2 }, { "0": 2 }], "a summary keeps counts only; the trace fields are not kept after 90 days");
  });
});
