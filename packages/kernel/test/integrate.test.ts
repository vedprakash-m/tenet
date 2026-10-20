// Local integration (TS §10.4, GIT-11): conflicts predicted first, the switch disclosed, receipts that stand or rerun.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

/** A finished, committed contract on its work branch, with the editor still on that branch. */
async function finished(p: Project) {
  const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
  const h = o.handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  await p.call("check", { h, stage: "candidate" });
  const f = await p.call("finish", { h, subject: "Add greet" });
  assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
  return { h, work: p.git("branch", "--show-current"), f };
}

describe("integrate [GIT-11]", () => {
  it("fast-forwards the base, moves the editor to it, and the receipts and review still stand", async () => {
    const p = fresh();
    const { h, work, f } = await finished(p);
    assert.deepEqual(d(f).integration, { setting: "offer", next: "integrate" }, "the result names integrate as the next action");
    const tip = p.git("rev-parse", "HEAD");
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(d(r).mode, "fast-forward");
    assert.equal(p.git("branch", "--show-current"), "main");
    assert.equal(p.git("rev-parse", "main"), tip, "no new commit: the tree is the one that was checked");
    assert.equal(d(await p.call("inspect", { view: "why", h })).endpoint, "checked-local");
    assert.equal(p.ports().store.read()!.state.work[Object.keys(p.ports().store.read()!.state.work)[0]!]!.acceptance, "accepted", "integrating records acceptance");
    assert.equal(p.git("rev-parse", work), tip, "the work branch is left alone");
    const again = await p.call("integrate", { h, again: true });
    assert.equal(again.exit, 0);
    assert.equal(p.git("rev-list", "--count", "main"), "2");
  });

  it("merges onto a moved base, calls the result unchecked until it is rechecked, and then says checked", async () => {
    const p = fresh();
    const { h, work } = await finished(p);
    p.git("switch", "-q", "main");
    p.write("docs/notes.md", "base moved\n");
    p.git("add", "-A"); p.git("commit", "-qm", "main moves");
    p.git("switch", "-q", work);
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(d(r).mode, "merge");
    assert.equal(r.next[0]!.action, "check");
    assert.equal(p.git("show", "--format=%P", "-s", "HEAD").split(" ").length, 2, "a merge commit");
    const why = await p.call("inspect", { view: "why", h });
    assert.ok(why.reasons.some((x) => x.code === "integration-unvalidated"), JSON.stringify(why.reasons));
    assert.equal(d(why).endpoint, "implemented-unverified");
    const c = await p.call("check", { h, stage: "integrated" });
    assert.equal(c.exit, 0, JSON.stringify(c));
    const after = await p.call("inspect", { view: "why", h });
    assert.deepEqual([d(after).endpoint, d(after).scope], ["checked-local", "committed"]);
  });

  it("predicts a conflict before the editor moves, and names the files", async () => {
    const p = fresh();
    const { h, work } = await finished(p);
    p.git("switch", "-q", "main");
    p.write("src/greet.ts", "export const greet = (_n: string): string => 'main changed this line';\n");
    p.git("add", "-A"); p.git("commit", "-qm", "main edits greet");
    p.git("switch", "-q", work);
    const head = p.git("rev-parse", "HEAD");
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3);
    assert.equal(r.reasons[0]!.code, "integration-conflict");
    assert.match(r.reasons[0]!.message, /src\/greet\.ts/);
    assert.equal(p.git("branch", "--show-current"), work, "the editor never left the work branch");
    assert.equal(p.git("rev-parse", "HEAD"), head);
    assert.equal(p.git("status", "--porcelain"), "");
  });

  it("asks before a switch that carries uncommitted edits, whatever the setting, and keeps them", async () => {
    const p = fresh();
    const { h } = await finished(p);
    p.write("docs/mine.md", "my notes\n");
    const ask = await p.call("integrate", { h });
    assert.equal(ask.exit, 3);
    assert.equal(ask.questions![0]!.id, "branch-switch");
    assert.equal(p.git("branch", "--show-current").startsWith("tenet/"), true);
    await p.call("decide", { h, kind: "branch-switch", answers: { "branch-switch": "continue" } });
    const r = await p.call("integrate", { h, again: true });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(p.git("branch", "--show-current"), "main");
    assert.ok(existsSync(join(p.root, "docs/mine.md")));
  });

  it("follows the integration setting: never omits the offer, auto-on-accept integrates when the user accepts", async () => {
    const p = fresh();
    const { h } = await finished(p);
    assert.equal((await p.call("decide", { h, kind: "config", target: "nonsense", propose: { value: "x" } })).exit, 2);
    assert.equal((await p.call("decide", { h, kind: "config", target: "integration", propose: { value: "sometimes" } })).exit, 2);
    await p.call("decide", { h, kind: "config", target: "integration", propose: { value: "never" } });
    assert.equal(d(await p.call("finish", { h })).integration.next, undefined);
    await p.call("decide", { h, kind: "config", target: "integration", propose: { value: "auto-on-accept" } });
    assert.equal(d(await p.call("finish", { h })).integration.next, "accept", "the result says accepting will integrate");
    const acc = await p.call("decide", { h, kind: "acceptance", target: "accepted" });
    assert.equal(acc.exit, 0, JSON.stringify(acc));
    assert.equal(p.git("branch", "--show-current"), "main", "accepting did the integration");
  });

  it("recovers from a crash right after the merge: it landed once, and state learns of it", async () => {
    const p = fresh();
    const { h } = await finished(p);
    const tip = p.git("rev-parse", "HEAD");
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-integrate.ts"), p.root, JSON.stringify({ h })], { stdio: "ignore" });
    assert.equal(await new Promise((r) => child.on("exit", (_c, s) => r(s))), "SIGKILL");
    assert.equal(p.git("rev-parse", "main"), tip);
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok(r.effects?.completed.some((e) => /had landed/.test(e)), JSON.stringify(r.effects));
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.git.integrated?.commit, tip);
    assert.equal(p.git("rev-list", "--count", "main"), "2");
  });

  it("has nothing to integrate when the work was committed on the base branch itself", async () => {
    const p = fresh();
    const o = await p.call("open", { profile: "investigate", request: "look" });
    const r = await p.call("integrate", { h: o.handle! });
    assert.equal(r.exit, 2);
  });
});
