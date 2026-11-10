// The sealed starting-tree run (EVD-04, TS §9.8): when the broader suite still fails on a full candidate check, the same command
// runs once on a copy of the contract's starting files, and the failure is called pre-existing, introduced or unknown.
// Real Git and real Vitest processes; mutating work is refused on Windows, so these run on Linux and macOS.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GitCli } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project, reviewResult } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const POSIX = { skip: process.platform === "win32" && "mutating work is refused on Windows" };
const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const LOCK = '{"name":"fx","lockfileVersion":3,"requires":true,"packages":{}}\n';
const work = (p: Project) => Object.values(p.ports().store.read()!.state.work)[0]!;
/** A test that already fails on the starting commit, the same way every run. */
const LEGACY = `import { expect, it } from "vitest";
it("adds up", () => { expect(1 + 1).toBe(3); });
`;
/** A test that passes on the starting files (greet is a stub there) and fails once greet is implemented. */
const LEANS_ON_STUB = `import { expect, it } from "vitest";
import { ok } from "./flag.ts";
import { greet } from "./greet.ts";
it("keeps the old greeting", () => { expect(ok).toBe(true); expect(greet("x")).toBe(""); });
`;

const fresh = (files: Record<string, string>, lock = true): Project => {
  const p = project({ ...(lock ? { "package-lock.json": LOCK } : {}), ...files });
  roots.push(p.root);
  return p;
};

/** Through a distinguishing red to an implemented candidate. */
async function toCandidate(p: Project): Promise<string> {
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  const red = await p.call("check", { h, stage: "baseline" });
  assert.equal(red.next[0]!.action, "implement", JSON.stringify(red));
  p.write("src/greet.ts", GREET_IMPL);
  return h;
}

describe("sealed baseline [EVD-04]", () => {
  it("E1: a failure also on the starting files asks once, costs no attempt, and once left out reaches checked-local [EVD-04]", POSIX, async () => {
    const p = fresh({ "src/legacy.test.ts": LEGACY });
    const h = await toCandidate(p);
    const before = work(p).budget.checksLaunched;
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.questions?.[0]?.id, "baseline-failures");
    assert.match(r.questions![0]!.question, /also fail on a run of your starting files: src\/legacy\.test\.ts/);
    assert.ok(r.reasons.some((x) => x.code === "baseline-failure-not-excluded"), JSON.stringify(r.reasons));
    assert.ok(!r.reasons.some((x) => x.code === "evidence-failed"), JSON.stringify(r.reasons));
    const w1 = work(p);
    assert.equal(w1.sealedBaseline?.status, "recorded", JSON.stringify(w1.sealedBaseline));
    assert.equal(w1.sealedBaseline?.status === "recorded" && w1.sealedBaseline.failed.length, 1);
    assert.deepEqual([w1.budget.attempts, w1.budget.signatures], [0, []], "a pre-existing failure records no attempt or signature");
    const firstLaunched = w1.budget.checksLaunched - before;

    const noWords = await p.call("decide", { h, kind: "baseline-failures", answers: { "baseline-failures": "exclude" } });
    assert.equal(noWords.exit, 2, JSON.stringify(noWords));
    const out = await p.call("decide", { h, kind: "baseline-failures", answers: { "baseline-failures": "exclude" }, quote: "leave the old test out" });
    assert.equal(out.exit, 0, JSON.stringify(out));
    assert.equal(work(p).exceptions?.[0]?.reason, "leave the old test out");

    const again = await p.call("check", { h, stage: "candidate" });
    assert.equal(again.exit, 0, JSON.stringify(again));
    assert.ok(again.reasons.some((x) => x.code === "baseline-failure-excluded" && x.note), JSON.stringify(again.reasons));
    assert.ok(d(again).review, "the review manifest is issued");
    const w2 = work(p);
    assert.equal(firstLaunched - (w2.budget.checksLaunched - w1.budget.checksLaunched), 1, "the recheck reuses the record: no second sealed run");
    assert.equal(w2.budget.attempts, 0);

    await p.call("findings", { h, result: reviewResult(d(again)) });
    const f = await finishFixture(p, { h, noCommit: true });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
    assert.ok(f.reasons.some((x) => x.code === "baseline-failure-excluded" && x.note), JSON.stringify(f.reasons));
  });

  it("E2: a test that did not fail on the starting files is introduced, and finish asks for another attempt [EVD-04]", POSIX, async () => {
    const p = fresh({ "src/flag.ts": "export const ok = true;\n", "src/legacy.test.ts": LEANS_ON_STUB });
    const h = await toCandidate(p);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const failed = r.reasons.find((x) => x.code === "evidence-failed");
    assert.match(failed?.message ?? "", /weren't failing this way on a run of your starting files: src\/legacy\.test\.ts/, JSON.stringify(r.reasons));
    const w = work(p);
    assert.deepEqual(w.sealedBaseline?.status === "recorded" && w.sealedBaseline.failed, []);
    assert.equal(w.budget.attempts, 1);
    const f = await p.call("finish", { h, noCommit: true });
    assert.ok(f.reasons.some((x) => x.code === "continue-required"), JSON.stringify(f));
  });

  it("E3: the user's uncommitted edit at the start is part of the starting files [EVD-04]", POSIX, async () => {
    const p = fresh({ "src/flag.ts": "export const ok = false;\n", "src/legacy.test.ts": LEANS_ON_STUB });
    p.write("src/flag.ts", "export const ok = true;\n"); // the user's fix, uncommitted when the work opens
    const h = await toCandidate(p);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.ok(r.reasons.some((x) => x.code === "evidence-failed" && /weren't failing this way/.test(x.message)), JSON.stringify(r));
    const w = work(p);
    assert.equal(w.sealedBaseline?.status, "recorded", JSON.stringify(w.sealedBaseline));
    assert.deepEqual((w.sealedBaseline as { failed: string[] }).failed, [], "with the user's edit the old test passed at the start");
  });

  it("E4: a file the user had edited at the start changed since: unknown, and no starting run [EVD-04]", POSIX, async () => {
    const p = fresh({ "src/legacy.test.ts": LEGACY, "notes.md": "one\n" });
    p.write("notes.md", "two\n");
    const h = await toCandidate(p);
    p.write("notes.md", "three\n");
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.match(r.questions![0]!.question, /a file you had edited at the start has changed since/);
    assert.ok(r.reasons.some((x) => x.code === "classification-unknown"), JSON.stringify(r.reasons));
    const w = work(p);
    assert.deepEqual([w.sealedBaseline?.status, (w.sealedBaseline as { tries?: number }).tries], ["unavailable", 0], "decided before any process");
  });

  it("E10: without a lockfile the dependencies are not shared: unknown, and treating it as mine makes it a failure [EVD-04]", POSIX, async () => {
    const p = fresh({ "src/legacy.test.ts": LEGACY }, false);
    const h = await toCandidate(p);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.ok(r.reasons.some((x) => x.code === "sealed-deps-unavailable" && x.note), JSON.stringify(r.reasons));
    assert.match(r.questions![0]!.question, /dependencies could not be shared safely/);
    const fix = await p.call("decide", { h, kind: "baseline-failures", answers: { "baseline-failures": "fix" } });
    assert.equal(fix.exit, 0, JSON.stringify(fix));
    assert.equal(fix.next[0]?.action, "implement");
    const f = await p.call("finish", { h, noCommit: true });
    assert.ok(f.reasons.some((x) => x.code === "evidence-failed" || x.code === "continue-required"), JSON.stringify(f.reasons));
  });
});

describe("sealed copy of the starting files [EVD-04]", () => {
  it("E12: writes the commit's files outside the workspace without touching the index, refs or working tree [EVD-04]", async () => {
    const root = tmp("tenet-seal-"), out = tmp("tenet-sealed-out-");
    roots.push(root, out);
    initRepo(root);
    write(root, "a.txt", "a\n");
    write(root, "run.sh", "#!/bin/sh\n");
    write(root, "secret/key.txt", "k\n");
    write(root, "dirty.txt", "start\n");
    git(root, "add", "-A");
    if (process.platform !== "win32") git(root, "update-index", "--chmod=+x", "run.sh");
    git(root, "commit", "-qm", "start");
    const head = git(root, "rev-parse", "HEAD");
    write(root, "dirty.txt", "edited\n");
    write(root, "new.txt", "untracked\n");
    const index = readFileSync(join(root, ".git/index")), status = git(root, "status", "--porcelain=v1", "-uall");
    const sealed = await new GitCli(root).materialize(head, join(out, "sealed"), (p) => !p.startsWith("secret/"),
      { copy: [{ path: "dirty.txt", mode: "100644" }, { path: "new.txt", mode: "100644" }], remove: ["a.txt"] });
    assert.ok("root" in sealed, JSON.stringify(sealed));
    if (!("root" in sealed)) return;
    assert.equal(readFileSync(join(sealed.root, "dirty.txt"), "utf8"), "edited\n");
    assert.equal(readFileSync(join(sealed.root, "new.txt"), "utf8"), "untracked\n");
    assert.ok(!existsSync(join(sealed.root, "a.txt")) && !existsSync(join(sealed.root, "secret")) && !existsSync(join(sealed.root, ".git")));
    if (process.platform !== "win32") assert.ok(statSync(join(sealed.root, "run.sh")).mode & 0o100);
    assert.ok(readFileSync(join(root, ".git/index")).equals(index), "the index is byte-identical");
    assert.equal(git(root, "status", "--porcelain=v1", "-uall"), status);
    assert.equal(git(root, "rev-parse", "HEAD"), head);
    sealed.dispose();
    assert.ok(!existsSync(join(out, "sealed")));
  });
});
