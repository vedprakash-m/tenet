// Composition scenarios and the three injected failures of the walking skeleton (plan §6.9), on real repositories,
// real processes and real signals.
import { spawn } from "node:child_process";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, SLOW_TEST, cli, isAlive, listFiles, project, reviewResult, runCli, runningCheck, waitFor } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (files?: Record<string, string>): Project => { const p = project(files); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

/** open → basis → red, leaving the project ready for the implementation. */
async function toRed(p: Project, over: Record<string, unknown> = {}, basis = BASIS) {
  const o = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard", ...over });
  const h = o.handle!;
  const b = await p.call("decide", { h, kind: "basis", propose: basis });
  p.write("src/greet.test.ts", GREET_TEST);
  const red = await p.call("check", { h, stage: "baseline" });
  return { o, h, b, red };
}
async function toGreen(p: Project, h: string) {
  p.write("src/greet.ts", GREET_IMPL);
  return p.call("check", { h, stage: "candidate" });
}

describe("one-stop rule (UX-D1)", () => {
  const tenetExample = { ref: "e2", kind: "example", origin: "tenet", of: "r1", text: "greet('') is 'Hello, !'", testFile: "src/greet.test.ts", test: "boundary", expect: "pass" };

  it("stops exactly once when Tenet adds an example, then proceeds on confirmation [INT-04]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"] })).handle!;
    const proposal = { ...BASIS, elements: [...BASIS.elements, tenetExample] };
    const ask = await p.call("decide", { h, kind: "basis", propose: proposal });
    assert.equal(ask.exit, 3);
    assert.equal(ask.questions!.length, 1);
    assert.equal(ask.questions![0]!.id, "basis-confirm");
    assert.match(ask.questions![0]!.question, /greet\(''\)/);
    assert.equal(p.ports().store.read()!.state.work[Object.keys(p.ports().store.read()!.state.work)[0]!]!.basis, undefined, "nothing is recorded before the answer");

    const ok = await p.call("decide", { h, kind: "basis", propose: proposal, answers: { "basis-confirm": "confirm" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.equal(ok.questions, undefined);
    const st = p.ports().store.read()!.state;
    assert.equal(Object.values(st.work)[0]!.grants.some((g) => g.capture === "elicited"), true);
  });

  it("refuses a confirmation whose proposal changed after the question was asked", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"] })).handle!;
    await p.call("decide", { h, kind: "basis", propose: { ...BASIS, elements: [...BASIS.elements, tenetExample] } });
    const changed = { ...BASIS, elements: [...BASIS.elements, { ...tenetExample, text: "something else entirely" }] };
    const r = await p.call("decide", { h, kind: "basis", propose: changed, answers: { "basis-confirm": "confirm" } });
    assert.equal(r.exit, 3);
    assert.equal(r.reasons[0]!.code, "basis-confirm");
  });

  it("never stops when every element is in the user's own words (a bug fix, or every boundary stated literally)", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "bug", request: "greet(\"\") must return \"Hello, !\"", scopePaths: ["src/greet.ts"] })).handle!;
    const literal = { ...BASIS, elements: [...BASIS.elements, { ...tenetExample, origin: "request" }] };
    const r = await p.call("decide", { h, kind: "basis", propose: literal });
    assert.equal(r.exit, 0);
    assert.equal(r.questions, undefined);
  });

  it("does not treat an inferred case as already said: an origin: tenet element always asks", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"] })).handle!;
    const r = await p.call("decide", { h, kind: "basis", propose: { ...BASIS, elements: [BASIS.elements[0], { ...tenetExample, origin: "tenet" }] } });
    assert.equal(r.exit, 3);
  });
});

describe("misleading-success traps (AC-07)", () => {
  it("a vacuous test that passes on the baseline is not a distinguishing red [TDD-01]", async () => {
    const p = fresh();
    const { h } = await toRed(p);
    p.write("src/greet.test.ts", 'import { it } from "vitest";\nit("greets by name", () => {});\n');
    const r = await p.call("check", { h, stage: "baseline" });
    assert.ok(r.reasons.some((x) => x.code === "no-distinguishing-red"), JSON.stringify(r.reasons));
    assert.equal(r.next[0]!.action, "test");
  });

  it("a compile or import error is never counted as a behavioral red [TDD-02]", async () => {
    const p = fresh();
    const { h } = await toRed(p);
    p.write("src/greet.test.ts", 'import { it, expect } from "vitest";\nimport { nope } from "./missing.ts";\nit("x", () => { expect(nope()).toBe(1); });\n');
    const r = await p.call("check", { h, stage: "baseline" });
    assert.ok(r.reasons.some((x) => x.code === "no-distinguishing-red"));
    const ob = Object.values(p.ports().store.read()!.state.work)[0]!.obligations[0]!;
    assert.equal(ob.baselineMatched, false);
  });

  it("skipped and focused tests are inconclusive, never a pass [EVD-02]", async () => {
    const p = fresh();
    const { h } = await toRed(p);
    p.write("src/greet.ts", GREET_IMPL);
    p.write("src/greet.test.ts", GREET_TEST.replace('it("greets', 'it.skip("greets'));
    const skipped = await p.call("check", { h, stage: "candidate" });
    assert.ok(skipped.reasons.some((x) => x.code === "zero-tests"), JSON.stringify(skipped.reasons));
    p.write("src/greet.test.ts", GREET_TEST.replace('it("greets', 'it.only("greets'));
    const focused = await p.call("check", { h, stage: "candidate", again: true });
    assert.ok(focused.reasons.some((x) => x.code === "focused-tests"), JSON.stringify(focused.reasons));
    const f = await p.call("finish", { h });
    assert.notEqual(d(f).endpoint, "checked-local");
  });

  it("editing a locked acceptance test after it went green blocks checked-local [INT-05]", async () => {
    const p = fresh();
    const { h } = await toRed(p, { lane: "quick" });
    const green = await toGreen(p, h);
    assert.equal(green.next[0]!.action, "finish");
    assert.equal(p.ports().store.read()!.state.locks.length, 1);
    p.write("src/greet.test.ts", GREET_TEST.replace('.toBe("Hello, Ada!")', ".toBeTruthy()"));
    const c2 = await p.call("check", { h, stage: "candidate" });
    assert.equal(c2.exit, 0, JSON.stringify(c2));
    const f = await p.call("finish", { h, noCommit: true });
    assert.ok(f.reasons.some((x) => x.code === "locked-test-changed"), JSON.stringify(f.reasons));
    assert.notEqual(d(f).endpoint, "checked-local");
  });

  it("weakening a support file or the runner configuration after a test is locked blocks checked-local, until the user dispositions it [INT-05]", async () => {
    const helper = 'import { expect } from "vitest";\nexport const same = (a: unknown, b: unknown) => expect(a).toBe(b);\n';
    const p = fresh({ "src/helper.ts": helper, "vitest.config.ts": 'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: {} });\n' });
    const basis = { ...BASIS, elements: [BASIS.elements[0], { ...BASIS.elements[1], support: ["src/helper.ts"] }] };
    const { h } = await toRed(p, { lane: "quick" }, basis as typeof BASIS);
    p.write("src/greet.test.ts", 'import { it } from "vitest";\nimport { greet } from "./greet.ts";\nimport { same } from "./helper.ts";\nit("greets by name", () => { same(greet("Ada"), "Hello, Ada!"); });\n');
    await p.call("check", { h, stage: "baseline", again: true });
    p.write("src/greet.ts", GREET_IMPL);
    const g = await p.call("check", { h, stage: "candidate" });
    assert.equal(g.exit, 0, JSON.stringify(g));
    const lock = p.ports().store.read()!.state.locks[0]!;
    assert.deepEqual(Object.keys(lock.supportInputs).sort(), ["src/helper.ts", "vitest.config.ts"]);

    p.write("src/helper.ts", 'export const same = (_a: unknown, _b: unknown) => undefined;\n'); // the assertion is gone; the test still "passes"
    await p.call("check", { h, stage: "candidate" });
    const f = await p.call("finish", { h, noCommit: true });
    assert.ok(f.reasons.some((r) => r.code === "locked-test-changed" && /src\/helper\.ts/.test(r.message)), JSON.stringify(f.reasons));
    assert.notEqual(d(f).endpoint, "checked-local");

    p.write("src/helper.ts", helper);
    p.write("vitest.config.ts", 'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { exclude: ["**"] } });\n');
    const f2 = await p.call("finish", { h, noCommit: true });
    assert.ok(f2.reasons.some((r) => r.code === "locked-test-changed" && /vitest\.config\.ts/.test(r.message)), JSON.stringify(f2.reasons));
    const ok = await p.call("decide", { h, kind: "disposition", target: "vitest.config.ts", propose: { outcome: "accepted", reason: "narrowed on purpose" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    await p.call("check", { h, stage: "candidate", again: true });
    assert.ok(!(await p.call("finish", { h, noCommit: true })).reasons.some((r) => r.code === "locked-test-changed"));
  });

  it("a weakened assertion raises an attention item that needs a disposition, and a marker needs the reviewer or the user", async () => {
    const p = fresh({ "src/other.test.ts": 'import { it, expect } from "vitest";\nit("o", () => { expect(1).toBe(1); });\n' });
    const { h } = await toRed(p, { lane: "quick" });
    p.write("src/greet.ts", `${GREET_IMPL}// @ts-ignore\nexport const x: number = "s" as any;\n`);
    await p.call("check", { h, stage: "candidate" });
    const f = await p.call("finish", { h, noCommit: true });
    const codes = f.reasons.map((r) => r.code);
    assert.ok(codes.includes("marker-unaccepted"), JSON.stringify(codes));
    assert.notEqual(d(f).endpoint, "checked-local");
  });
});

describe("review binding", () => {
  it("rejects a result for a stale reservation, counting the dispatch, and a late result for a replaced attempt [AGT-02, REV-01]", async () => {
    const p = fresh();
    const { h } = await toRed(p);
    const green = await toGreen(p, h);
    const data = d(green);
    const wrong = await p.call("findings", { h, result: reviewResult(data, { attempt: 9 }) });
    assert.equal(wrong.exit, 2);
    assert.equal(wrong.reasons[0]!.code, "review-stale");
    assert.equal(wrong.budget.delegations, "2/6", "the stale dispatch still counts as a delegation");
    const retry = await p.call("packet", { h, role: "reviewer", retry: true });
    assert.equal(retry.exit, 0, JSON.stringify(retry));
    const second = d(retry).review;
    assert.equal(second.attempt, data.review.attempt + 1);
    const late = await p.call("findings", { h, result: reviewResult(data) });
    assert.equal(late.reasons[0]!.code, "review-stale", "a late result from the earlier child cannot settle the later attempt");
    const good = await p.call("findings", { h, result: reviewResult({ review: second }) });
    assert.equal(good.exit, 0, JSON.stringify(good));
    assert.equal((await p.call("finish", { h, subject: "s" })).data && d(await p.call("inspect", { view: "why", h })).endpoint, "checked-local");
  });

  it("a same-session review reduces independence and cannot reach checked-local", async () => {
    const p = fresh();
    const { h } = await toRed(p);
    const g = await toGreen(p, h);
    await p.call("findings", { h, result: reviewResult(d(g), { dispatchMode: "same-session" }) });
    const f = await p.call("finish", { h, noCommit: true });
    assert.ok(f.reasons.some((r) => r.code === "reduced-independence"));
    assert.equal(d(f).endpoint, "implemented-unverified");
  });

  it("a blocker blocks until fixed and verified by a focused recheck, which is allowed once", async () => {
    const p = fresh();
    const { h } = await toRed(p);
    const g = await toGreen(p, h);
    const blocker = { severity: "blocker", axis: "behavior", location: { path: "src/greet.ts", line: 1 }, claim: "does not trim the name", evidence: "src/greet.ts:1" };
    const r1 = await p.call("findings", { h, result: reviewResult(d(g), { findings: [blocker] }) });
    assert.equal(r1.next[0]!.action, "implement");
    p.write("src/greet.ts", "export const greet = (name: string): string => `Hello, ${name.trim()}!`;\n");
    const c2 = await p.call("check", { h, stage: "candidate" });
    assert.equal(c2.next[0]!.action, "recheck", JSON.stringify(c2));
    const rv = d(c2).review;
    assert.equal(rv.mode, "recheck");
    const r2 = await p.call("findings", { h, result: reviewResult({ review: rv }, { mode: "recheck", rechecked: [{ finding: "FND-1", outcome: "verified", evidence: "src/greet.ts:1 trims" }] }) });
    assert.equal(r2.exit, 0, JSON.stringify(r2));
    assert.equal(r2.budget.rounds, "1/2");
    const f = await p.call("finish", { h, subject: "s" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
  });
});

describe("budget and stops", () => {
  it("stops on the same failure twice and finishes honestly, never claiming a check [WRK-08]", async () => {
    const p = fresh();
    const { h } = await toRed(p, { lane: "quick" });
    p.write("src/greet.ts", "export const greet = (name: string): string => `Hi, ${name}!`;\n");
    const a = await p.call("check", { h, stage: "candidate" });
    assert.equal(a.exit, 0);
    p.write("src/greet.ts", "export const greet = (name: string): string => `Hi, ${name}!`; // second try\n");
    const b = await p.call("check", { h, stage: "candidate" });
    assert.equal(b.exit, 2, JSON.stringify(b));
    assert.ok(b.reasons.some((r) => r.code === "repeated-failure"));
    const f = await p.call("finish", { h, noCommit: true });
    assert.equal(f.exit, 0);
    assert.equal(d(f).endpoint, "implemented-unverified");
    assert.equal(d(f).stopReason, "repeated-failure");
  });

  it("finish refuses to close while a failure remains and attempts are left", async () => {
    const p = fresh();
    const { h } = await toRed(p, { lane: "quick" });
    await p.call("check", { h, stage: "candidate" }); // the stub still fails
    const f = await p.call("finish", { h, noCommit: true });
    assert.equal(f.exit, 2);
    assert.equal(f.reasons[0]!.code, "continue-required");
    assert.equal(f.next[0]!.action, "implement");
  });
});

describe("idempotency and the envelope", () => {
  it("returns an identical retry as historical without repeating the effect; --again repeats it", async () => {
    const p = fresh();
    const { h } = await toRed(p, { lane: "quick" });
    p.write("src/greet.ts", GREET_IMPL);
    const first = await p.call("check", { h, stage: "candidate" });
    const again = await p.call("check", { h, stage: "candidate" });
    assert.equal(again.historical, true);
    assert.equal(again.budget.attempts, first.budget.attempts);
    const forced = await p.call("check", { h, stage: "candidate", again: true });
    assert.equal(forced.historical, undefined);
    assert.equal(forced.budget.attempts, "2/3");
  });

  it("fences an older generation and a handle from another workspace", async () => {
    const p = fresh();
    const { h } = await toRed(p);
    const resumed = await p.call("open", { profile: "feature", request: "add a greeting", resume: true });
    assert.equal(resumed.exit, 0, JSON.stringify(resumed));
    assert.notEqual(resumed.handle, h);
    const stale = await p.call("check", { h, stage: "candidate" });
    assert.equal(stale.exit, 4);
    assert.equal(stale.reasons[0]!.code, "stale-session");
    const other = fresh();
    await other.call("open", { profile: "feature", request: "x", scopePaths: [] });
    const cross = await other.call("check", { h: resumed.handle! });
    assert.equal(cross.exit, 4);
  });

  it("repeats open with the same request as the still-proposed contract", async () => {
    const p = fresh();
    const a = await p.call("open", { profile: "feature", request: "same", scopePaths: [] });
    const b = await p.call("open", { profile: "feature", request: "same", scopePaths: [] });
    assert.equal(a.handle, b.handle);
    assert.equal(Object.keys(p.ports().store.read()!.state.work).length, 1);
  });

  it("blocks a second editing contract while the first owns the source, and not a non-editing one", async () => {
    const p = fresh();
    await p.call("open", { profile: "feature", request: "one", scopePaths: [] });
    const two = await p.call("open", { profile: "feature", request: "two", scopePaths: [] });
    assert.equal(two.exit, 2);
    assert.equal(two.reasons[0]!.code, "owned-by-other-work");
    const inv = await p.call("open", { profile: "investigate", request: "look" });
    assert.equal(inv.exit, 0);
  });
});

describe("review-only and read-only calls write nothing to the project", () => {
  it("`review` and `inspect` leave the folder and Git byte-for-byte as they were [CON-09]", async () => {
    const p = fresh();
    p.write("src/greet.ts", `${GREET_IMPL}// @ts-ignore\n`);
    const before = { ls: listFiles(p.root), status: p.git("status", "--porcelain"), objects: p.git("count-objects", "-v") };
    const r = await p.call("review", {});
    assert.equal(r.exit, 0, JSON.stringify(r));
    const manifest = JSON.parse(readFileSync(d(r).manifest, "utf8"));
    assert.ok(manifest.attention.some((a: { pattern: string }) => a.pattern === "@ts-ignore"));
    await p.call("inspect", { view: "status" });
    const doc = await p.call("inspect", { view: "doctor" });
    assert.deepEqual((doc.data as any).detected, { language: "ts-js", typescript: true, packageManager: "unknown", runner: "vitest", depsInstalled: true, hooks: false, git: true });
    await p.call("inspect", { view: "help" });
    assert.deepEqual({ ls: listFiles(p.root), status: p.git("status", "--porcelain"), objects: p.git("count-objects", "-v") }, before);
  });
});

describe("injected failure 1: a human's edits on the files Tenet needs", () => {
  it("asks before editing a file that is dirty at the start, and keeps the human's lines out of the commit when asked [GIT-10]", async () => {
    const p = fresh();
    p.write("src/greet.ts", "// my own work in progress\nexport const greet = (_name: string): string => '';\n");
    const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "standard" });
    assert.equal(o.exit, 3);
    assert.equal(o.questions![0]!.id, "dirty-overlap");
    const h = o.handle!;
    const blocked = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(blocked.exit, 0, "the basis itself does not edit anything");
    const stopped = await p.call("check", { h, stage: "baseline" });
    assert.equal(stopped.exit, 3, "checks wait for the answer");
    const a = await p.call("decide", { h, kind: "dirty-overlap", answers: { "dirty-overlap": "include" } });
    assert.equal(a.exit, 0, JSON.stringify(a));

    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", `// my own work in progress\n${GREET_IMPL}`);
    const g = await p.call("check", { h, stage: "candidate" });
    await p.call("findings", { h, result: reviewResult(d(g)) });
    const f = await p.call("finish", { h, subject: "greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
    assert.match(p.git("show", "HEAD:src/greet.ts"), /my own work in progress/, "included by the user's choice, byte for byte");
  });

  it("keeps a concurrent edit to an unrelated file out of the commit, byte for byte, and names the scope honestly [GIT-08]", async () => {
    const p = fresh({ "docs/notes.md": "# notes\n" });
    const { h } = await toRed(p);
    const g = await toGreen(p, h);
    p.write("docs/notes.md", "# notes\nthe human typed this while Tenet worked\n");
    const g2 = await p.call("check", { h, stage: "candidate", again: true });
    await p.call("findings", { h, result: reviewResult(d(g2)) });
    void g;
    const ask = await p.call("finish", { h, subject: "greet" });
    assert.equal(ask.exit, 3, "Tenet cannot explain docs/notes.md");
    assert.equal(ask.questions![0]!.id, "unexplained");
    const ans = await p.call("decide", { h, kind: "unexplained", answers: { unexplained: "not-mine" } });
    assert.equal(ans.exit, 0, JSON.stringify(ans));
    const f = await p.call("finish", { h, subject: "greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
    assert.equal(d(f).scope, "working-tree-with-your-edits");
    assert.match(d(f).label, /alongside your 1 uncommitted file/);
    assert.equal(p.git("show", "--name-only", "--format=", "HEAD").includes("notes.md"), false);
    assert.equal(readFileSync(join(p.root, "docs/notes.md"), "utf8"), "# notes\nthe human typed this while Tenet worked\n");
  });
});

describe("injected failure 2: SIGKILL during a check", () => {
  it("recovers on the next call: orphans are stopped, the run is discarded, a clean rerun passes [CON-03]", async () => {
    const p = fresh();
    const { h } = await toRed(p, { lane: "quick" });
    p.write("src/greet.test.ts", SLOW_TEST);
    const running = cli(p.root, ["check", "--h", h, "--stage", "candidate"]);
    const run = await waitFor(() => runningCheck(p), 30000, "the test runner to start");
    assert.ok(isAlive(run.pid), "the runner is up");
    running.child.kill("SIGKILL"); // the kernel dies; the runner's process group is left behind
    await running.done;
    assert.ok(isAlive(run.pid), "the orphan outlived the kernel");

    p.write("src/greet.test.ts", GREET_TEST);
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("check", { h, stage: "candidate" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok(r.effects?.completed.some((e) => /discarded the interrupted check/.test(e)), JSON.stringify(r.effects));
    await waitFor(() => !isAlive(run.pid), 5000, "the orphan to be stopped");
    assert.equal(r.next[0]!.action, "finish");
    const st = p.ports().store.read()!.state;
    assert.equal(Object.values(st.work)[0]!.session.inCall, undefined);
    assert.ok(Object.values(st.work)[0]!.receipts.every((x) => x.status !== "fail" || x.stage === "baseline"));
  });

  it("takes the runner's whole process group down when the kernel is told to stop (SIGTERM)", async () => {
    const p = fresh();
    const { h } = await toRed(p, { lane: "quick" });
    p.write("src/greet.test.ts", SLOW_TEST);
    const running = cli(p.root, ["check", "--h", h, "--stage", "candidate"]);
    const run = await waitFor(() => runningCheck(p), 30000, "the test runner to start");
    running.child.kill("SIGTERM");
    const out = await running.done;
    assert.notEqual(out.code, 0);
    await waitFor(() => !isAlive(run.pid), 5000, "the runner to stop with the kernel");
  });

  it("`stop cancel` while a check runs stops it, and the check's late result is discarded", async () => {
    const p = fresh();
    const { h } = await toRed(p, { lane: "quick" });
    p.write("src/greet.test.ts", SLOW_TEST);
    const running = cli(p.root, ["check", "--h", h, "--stage", "candidate"]);
    const run = await waitFor(() => runningCheck(p), 30000, "the test runner to start");
    const busy = await p.call("check", { h, stage: "candidate", again: true });
    assert.equal(busy.reasons[0]!.code, "work-busy");
    const stopped = await p.call("stop", { h, mode: "cancel" });
    assert.equal(stopped.exit, 0, JSON.stringify(stopped));
    const late = await running.done;
    await waitFor(() => !isAlive(run.pid), 5000, "the runner to stop");
    assert.equal(late.json?.reasons[0]?.code, "run-superseded", late.stdout);
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.receipts.filter((r) => r.stage === "candidate").length, 0, "no receipt was published");
    assert.equal(w.budget.attempts, 0);
  });
});

describe("injected failure 3: a crash anywhere in the commit effect (intent, act, result, publish)", () => {
  /** Runs `finish` in a child that dies at `point`, then finishes again and checks the postcondition. */
  async function crashAt(point: string, landed: boolean) {
    const p = fresh();
    const { h } = await toRed(p);
    const g = await toGreen(p, h);
    await p.call("findings", { h, result: reviewResult(d(g)) });
    const before = Number(p.git("rev-list", "--count", "HEAD"));

    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-commit.ts"), p.root, "finish", JSON.stringify({ h, subject: "greet" }), point], { stdio: "ignore" });
    const sig = await new Promise((r) => child.on("exit", (_c, s) => r(s)));
    assert.equal(sig, "SIGKILL", point);
    assert.equal(Number(p.git("rev-list", "--count", "HEAD")), before + (landed ? 1 : 0), `${point}: the commit ${landed ? "landed" : "had not run"}`);

    const f = await p.call("finish", { h, subject: "greet" });
    assert.equal(f.exit, 0, `${point}: ${JSON.stringify(f)}`);
    assert.equal(Number(p.git("rev-list", "--count", "HEAD")), before + 1, `${point}: exactly one commit, never none and never two`);
    assert.equal(d(f).endpoint, "checked-local", `${point}: ${JSON.stringify(f.reasons)}`);
    assert.equal(d(f).scope, "committed");
    assert.equal(d(f).commits.length, 1);
    const st = p.ports().store.read()!.state;
    assert.equal(Object.values(st.work)[0]!.session.inCall, undefined);
    return { f, p };
  }

  it("before the intent is written: nothing happened, the rerun commits once", async () => { await crashAt("before-intent", false); });
  it("after the intent, before the commit: reconciled as not performed, the rerun commits once", async () => {
    const { f } = await crashAt("before-act", false);
    assert.ok(f.effects?.completed.some((e) => /did not happen/.test(e)), JSON.stringify(f.effects));
  });
  it("after the commit, before its result record: reconciled from the postcondition, no duplicate [CON-03]", async () => {
    const { f, p } = await crashAt("after-act", true);
    assert.ok(f.effects?.completed.some((e) => /had landed/.test(e)), JSON.stringify(f.effects));
    assert.ok(p.ports().store.readLog().some((e) => e.kind === "result" && e.effect === "commit"));
  });
  it("after the result record, before the revision is published: the logged result is applied to state", async () => {
    const { f } = await crashAt("after-result", true);
    assert.ok(f.effects?.completed.some((e) => /recorded as done/.test(e)), JSON.stringify(f.effects));
  });
});

describe("the command line", () => {
  it("runs a verb end to end through a real process, with a JSON body on stdin and the exit code", async () => {
    const p = fresh();
    const o = await runCli(p.root, ["open", "feature", "--request", "greeting", "--scope-paths", "src/greet.ts"]);
    assert.equal(o.code, 0, o.stdout);
    const h = o.json!.handle!;
    const b = await runCli(p.root, ["decide", "basis", "--h", h], JSON.stringify({ propose: BASIS }));
    assert.equal(b.code, 0, b.stdout);
    const malformed = await runCli(p.root, ["check", "--h", "nonsense"]);
    assert.equal(malformed.code, 1);
    const unknown = await runCli(p.root, ["check", "--h", "W9.1.abcd"]);
    assert.equal(unknown.code, 4);
    const usage = await runCli(p.root, ["decide", "--h", h]);
    assert.equal(usage.code, 1);
    const help = await runCli(p.root, ["--help"]);
    assert.equal(help.code, 0);
    assert.ok(help.json!.data);
  });

  it("answers a copied .tenet directory with an integrity exit, never a crash", async () => {
    const a = fresh();
    await a.call("open", { profile: "feature", request: "x", scopePaths: [] });
    const b = fresh();
    cpSync(join(a.root, ".tenet"), join(b.root, ".tenet"), { recursive: true });
    for (const args of [["inspect", "status"], ["open", "feature", "--request", "y"]]) {
      const r = await runCli(b.root, args);
      assert.equal(r.code, 3, r.stdout);
      assert.equal(r.json!.reasons[0]!.code, "marker-mismatch");
    }
  });

  it("refuses to run under a preload flag", async () => {
    const p = fresh();
    const child = spawn(process.execPath, [join(import.meta.dirname, "../src/main.ts"), "inspect", "--view", "help"], { cwd: p.root, env: { PATH: process.env.PATH, NODE_OPTIONS: "--import data:text/javascript," }, stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    const code = await new Promise((r) => child.on("exit", r));
    assert.equal(code, 4);
    assert.equal(JSON.parse(out).reasons[0].code, "preload-present");
  });
});
