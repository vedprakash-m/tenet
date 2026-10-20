// `decide adopt` and the reconciliation in `open` for INTENT.md and tenet.policy.json (TS §7.8, §8.5; CON-01, PH0-4).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fresh = (files?: Record<string, string>): Project => { const p = project(files); roots.push(p.root); return p; };
const read = (p: Project, rel: string) => readFileSync(join(p.root, rel), "utf8");
const state = (p: Project) => p.ports().store.read()!.state;
const ask = { "adopt-confirm": "confirm" };

async function withBasis(p: Project) {
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  return h;
}

describe("adopting the intent as INTENT.md [CON-01, INT-02]", () => {
  it("previews first, writes nothing until the user answers, and then writes the blocks and remembers the answer", async () => {
    const p = fresh();
    const h = await withBasis(p);
    const pre = await p.call("decide", { h, kind: "adopt", target: "intent" });
    assert.equal(pre.exit, 3, JSON.stringify(pre));
    assert.equal(pre.questions![0]!.id, "adopt-confirm");
    assert.match(pre.questions![0]!.question, /INTENT\.md/);
    assert.match(pre.questions![0]!.question, /REQ-001/);
    assert.throws(() => read(p, "INTENT.md"), /ENOENT/, "a preview writes nothing");
    assert.equal(state(p).project.adoption.intent, "undecided");

    const done = await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    assert.equal(done.exit, 0, JSON.stringify(done));
    assert.match(read(p, "INTENT.md"), /tenet:begin REQ-001/);
    assert.equal(state(p).project.adoption.intent, "adopted");
    const trust = state(p).trust.find((t) => t.file === "INTENT.md")!;
    assert.ok(trust.hash && trust.adoptedAt);
  });

  it("is a no-op when repeated: the file is already what the intent says", async () => {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    const before = read(p, "INTENT.md");
    const again = await p.call("decide", { h, kind: "adopt", target: "intent" });
    assert.equal(again.exit, 0, JSON.stringify(again));
    assert.match(JSON.stringify(again.data), /up to date/);
    assert.equal(read(p, "INTENT.md"), before);
  });

  it("asks again when the file changed after the preview", async () => {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    p.write("INTENT.md", "# Mine\n\nWritten while the preview was open.\n");
    const r = await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    assert.equal(r.exit, 3, "the approval binds to the exact previewed content");
    assert.equal(read(p, "INTENT.md"), "# Mine\n\nWritten while the preview was open.\n");
  });

  it("adds blocks to an existing CRLF file and leaves every other byte alone", async () => {
    const mine = "# Library\r\n\r\nWe lend books.\r\nKeep this.\r\n";
    const p = fresh({ "INTENT.md": mine });
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    const r = await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const text = read(p, "INTENT.md");
    assert.equal(text.startsWith(mine), true);
    assert.equal(/[^\r]\n/.test(text), false);
  });

  it("stops on damaged markers, shows the line, and never writes", async () => {
    const broken = "# Mine\n<!-- tenet:begin REQ-001-zzz -->\nno end marker\n";
    const p = fresh({ "INTENT.md": broken });
    const h = await withBasis(p);
    const r = await p.call("decide", { h, kind: "adopt", target: "intent" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "intent-markers-invalid");
    assert.match(r.reasons[0]!.message, /line 2/);
    assert.equal(read(p, "INTENT.md"), broken);
  });

  it("remembers a refusal without writing anything", async () => {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    const r = await p.call("decide", { h, kind: "adopt", target: "intent", answers: { "adopt-confirm": "decline" } });
    assert.equal(r.exit, 0);
    assert.equal(state(p).project.adoption.intent, "declined");
    assert.throws(() => read(p, "INTENT.md"), /ENOENT/);
  });

  it("warns in the preview when the repository has a remote", async () => {
    const p = fresh();
    p.git("remote", "add", "origin", "https://example.invalid/team/library.git");
    const h = await withBasis(p);
    const pre = await p.call("decide", { h, kind: "adopt", target: "intent" });
    assert.match(pre.questions![0]!.question, /remote/i);
  });

  it("the written file belongs to the contract: it is not a human's edit and is committed with the work", async () => {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    const w = Object.values(state(p).work)[0]!;
    assert.ok(w.touched.some((t) => t.path === "INTENT.md"));
    assert.ok(w.vetted["INTENT.md"]);
  });
});

describe("adopting tenet.policy.json [CFG-11, PRD §7.4]", () => {
  const POLICY = { protected_paths: ["db/**"], dependency_policy: { min_release_age_days: 7 } };

  it("refuses when there is no file, and blocks an unknown key naming the nearest valid one", async () => {
    const p = fresh();
    const h = await withBasis(p);
    const none = await p.call("decide", { h, kind: "adopt", target: "policy" });
    assert.equal(none.exit, 2);
    p.write("tenet.policy.json", JSON.stringify({ protected_path: ["db/**"] }));
    const bad = await p.call("decide", { h, kind: "adopt", target: "policy" });
    assert.equal(bad.exit, 2);
    assert.equal(bad.reasons[0]!.code, "restriction-key-unknown");
    assert.match(bad.reasons[0]!.message, /protected_paths/);
  });

  it("previews the restrictions, then records the hash and the parsed policy on confirmation", async () => {
    const p = fresh();
    p.write("tenet.policy.json", JSON.stringify(POLICY));
    const h = await withBasis(p);
    const pre = await p.call("decide", { h, kind: "adopt", target: "policy" });
    assert.equal(pre.exit, 3);
    assert.match(pre.questions![0]!.question, /db\/\*\*/);
    assert.equal(state(p).project.adoption.policy, "undecided");
    const done = await p.call("decide", { h, kind: "adopt", target: "policy", answers: ask });
    assert.equal(done.exit, 0, JSON.stringify(done));
    assert.equal(state(p).project.adoption.policy, "adopted");
    assert.deepEqual((state(p).trust.find((t) => t.file === "tenet.policy.json")!.restrictions as { protected_paths: string[] }).protected_paths, ["db/**"]);
  });
});

describe("open reconciles the shared files with what was adopted [PH0-4, PRD §7.4 item 14]", () => {
  async function adoptedPolicy(policy: object) {
    const p = fresh({ "tenet.policy.json": JSON.stringify(policy) });
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "policy" });
    await p.call("decide", { h, kind: "adopt", target: "policy", answers: ask });
    await p.call("stop", { h, mode: "pause" });
    return p;
  }
  const protectedOf = (p: Project) => Object.values(state(p).work).at(-1)!.scope.protected; // the newest contract

  it("puts the adopted protected paths into every new contract", async () => {
    const p = await adoptedPolicy({ protected_paths: ["db/**"] });
    const o = await p.call("open", { profile: "investigate", request: "look around" });
    assert.deepEqual(protectedOf(p), ["db/**"]);
  });

  it("applies a tightening at once and says so", async () => {
    const p = await adoptedPolicy({ protected_paths: ["db/**"] });
    p.write("tenet.policy.json", JSON.stringify({ protected_paths: ["db/**", "infra/**"] }));
    const o = await p.call("open", { profile: "investigate", request: "look around" });
    assert.equal(o.exit, 0, JSON.stringify(o));
    assert.deepEqual(protectedOf(p).sort(), ["db/**", "infra/**"]);
    assert.ok(o.reasons.some((r) => /tighten/i.test(r.message)), JSON.stringify(o.reasons));
  });

  it("keeps the previous rules for a loosening and asks, until the user accepts the diff", async () => {
    const p = await adoptedPolicy({ protected_paths: ["db/**", "infra/**"] });
    p.write("tenet.policy.json", JSON.stringify({ protected_paths: ["db/**"] }));
    const o = await p.call("open", { profile: "investigate", request: "look around" });
    assert.equal(o.exit, 3, JSON.stringify(o));
    assert.equal(o.reasons.some((r) => r.code === "policy-change-needs-acceptance"), true);
    assert.deepEqual(protectedOf(p).sort(), ["db/**", "infra/**"], "the loosened rule is not applied");
    const h = o.handle!;
    const ok = await p.call("decide", { h, kind: "adopt", target: "policy", answers: ask });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    const again = await p.call("open", { profile: "plan", request: "another look" });
    assert.deepEqual(protectedOf(p), ["db/**"]);
    assert.equal(again.exit, 0);
  });

  it("reports an INTENT.md block edited outside Tenet and keeps it as written", async () => {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    await p.call("stop", { h, mode: "pause" });
    p.write("INTENT.md", read(p, "INTENT.md").replace("Hello, Ada!", "Hi, Ada!"));
    const o = await p.call("open", { profile: "investigate", request: "look around" });
    assert.equal(o.exit, 0, JSON.stringify(o));
    assert.ok(o.reasons.some((r) => r.code === "intent-edited-outside"), JSON.stringify(o.reasons));
    assert.match(read(p, "INTENT.md"), /Hi, Ada!/);
  });

  it("reports damaged markers without blocking read-only work", async () => {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    await p.call("stop", { h, mode: "pause" });
    p.write("INTENT.md", read(p, "INTENT.md").replace(/<!-- tenet:end REQ-001[^>]*-->/, ""));
    const o = await p.call("open", { profile: "investigate", request: "look around" });
    assert.equal(o.exit, 0);
    assert.ok(o.reasons.some((r) => r.code === "intent-markers-invalid"), JSON.stringify(o.reasons));
  });
});

describe("adoption crash recovery (the file write has the effect protocol's steps)", () => {
  async function crashAt(point: string) {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-adopt.ts"), p.root, JSON.stringify({ h, kind: "adopt", target: "intent", answers: ask }), point], { stdio: "ignore" });
    assert.equal(await new Promise((r) => child.on("exit", (_c, sig) => r(sig))), "SIGKILL", point);
    const r = await p.call("decide", { h, kind: "adopt", target: "intent", answers: ask });
    assert.equal(r.exit, 0, `${point}: ${JSON.stringify(r)}`);
    assert.match(read(p, "INTENT.md"), /tenet:begin REQ-001/, point);
    assert.equal(state(p).project.adoption.intent, "adopted", point);
    assert.equal(state(p).trust.filter((t) => t.file === "INTENT.md").length, 1, point);
    assert.equal(read(p, "INTENT.md").match(/tenet:begin REQ-001/g)!.length, 1, `${point}: written once`);
  }
  it("after the intent, before the file is written", async () => { await crashAt("after-intent"); });
  it("after the file is written, before the result record", async () => { await crashAt("after-write"); });
  it("after the result record, before the revision is published", async () => { await crashAt("after-result"); });
});

describe("the adoption offer (CON-01)", () => {
  it("is made once, with the first checked-local result, and never again", async () => {
    const p = fresh();
    const h = await withBasis(p);
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const green = await p.call("check", { h, stage: "candidate" });
    await p.call("findings", { h, result: reviewResult(green.data as Record<string, any>) });
    const done = await p.call("finish", { h, noCommit: true });
    assert.equal((done.data as Record<string, any>).endpoint, "checked-local", JSON.stringify(done.reasons));
    assert.equal((done.data as Record<string, any>).offer, "adopt");
    assert.equal(state(p).project.adoption.offered, true);
    const again = await p.call("finish", { h, noCommit: true, subject: "again" }); // a different call, so not the cached answer
    assert.equal((again.data as Record<string, any>).offer, undefined, "the offer is not repeated");
  });
  it("is not made when the user already answered", async () => {
    const p = fresh();
    const h = await withBasis(p);
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    await p.call("decide", { h, kind: "adopt", target: "intent", answers: { "adopt-confirm": "decline" } });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const green = await p.call("check", { h, stage: "candidate" });
    await p.call("findings", { h, result: reviewResult(green.data as Record<string, any>) });
    const done = await p.call("finish", { h, noCommit: true });
    assert.equal((done.data as Record<string, any>).offer, undefined);
  });
});
