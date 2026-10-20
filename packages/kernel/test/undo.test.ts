// Undo (TS §10.5, GIT-04): the inverse of the work's commits, previewed, applied only on a yes, and never over later changes.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, finishFixture } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const STUB = "export const greet = (_name: string): string => '';\n";

async function finished(p: Project) {
  p.write("src/other.test.ts", 'import { expect, it } from "vitest";\nit("unrelated", () => { expect(1).toBe(1); });\n');
  p.git("add", "-A"); p.git("commit", "-qm", "an unrelated test that stays");
  const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
  const h = o.handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
  assert.equal(d(await finishFixture(p, { h, subject: "Add greet" })).endpoint, "checked-local");
  return h;
}

describe("undo [GIT-04]", () => {
  it("previews first and changes nothing; on a yes reverts only the work, keeps later human changes, then checks and commits like any work", async () => {
    const p = fresh();
    const h = await finished(p);
    p.write("docs/later.md", "a later human commit\n");
    p.git("add", "-A"); p.git("commit", "-qm", "human work after");
    const before = p.git("rev-parse", "HEAD");

    const pre = await p.call("undo", { h });
    assert.equal(pre.exit, 3, JSON.stringify(pre));
    assert.equal(pre.questions![0]!.id, "undo-confirm");
    assert.equal(pre.questions![0]!.channel, "chat", "undo is an authority question: plain chat");
    assert.deepEqual(d(pre).paths.sort(), ["src/greet.test.ts", "src/greet.ts"]);
    assert.match(d(pre).notUndone, /databases/);
    assert.equal(p.git("rev-parse", "HEAD"), before);
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), GREET_IMPL, "the preview applied nothing");

    const r = await p.call("decide", { h, kind: "undo-confirm", answers: { "undo-confirm": "apply" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), STUB);
    assert.ok(!existsSync(join(p.root, "src/greet.test.ts")));
    assert.ok(existsSync(join(p.root, "docs/later.md")), "the later human commit survives");
    assert.equal(p.git("rev-parse", "HEAD"), before, "nothing is committed before the checks");

    const h2 = r.handle!;
    assert.notEqual(h2, h);
    const c = await p.call("check", { h: h2, stage: "candidate" });
    assert.equal(c.exit, 0, JSON.stringify(c));
    const f = await finishFixture(p, { h: h2, subject: "Undo W-0001" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
    assert.equal(p.git("show", "--name-only", "--format=", "HEAD").split("\n").sort().join(), "src/greet.test.ts,src/greet.ts");
    assert.equal(p.git("show", "HEAD:src/greet.ts"), STUB.trim());
    assert.equal(p.ports().store.read()!.state.locks.length, 0, "the removed test's lock went with it");
    const again = await p.call("undo", { h });
    assert.equal(again.reasons[0]!.code, "undo-conflict");
    assert.match(again.reasons[0]!.message, /already reverted/);
  });

  it("stops with the overlap when a later commit changed the same lines, and applies nothing", async () => {
    const p = fresh();
    const h = await finished(p);
    p.write("src/greet.ts", `${GREET_IMPL}// a later change on the same file\n`);
    p.git("add", "-A"); p.git("commit", "-qm", "later edit to greet");
    const r = await p.call("undo", { h });
    assert.equal(r.exit, 3);
    assert.equal(r.reasons[0]!.code, "undo-conflict");
    assert.match(r.reasons[0]!.message, /greet\.ts/);
    assert.equal(p.git("status", "--porcelain"), "");
    assert.equal(p.ports().store.read()!.state.pending.length, 0, "no question is left open");
  });

  it("refuses while the person has uncommitted changes in the files it would revert", async () => {
    const p = fresh();
    const h = await finished(p);
    p.write("src/greet.test.ts", `${GREET_TEST}// my scribble\n`);
    const r = await p.call("undo", { h });
    assert.equal(r.reasons[0]!.code, "undo-conflict");
    assert.match(r.reasons[0]!.message, /uncommitted/);
  });

  it("applies nothing if the files changed after the preview, or if the answer is no", async () => {
    const p = fresh();
    const h = await finished(p);
    await p.call("undo", { h });
    p.write("docs/more.md", "x\n");
    p.git("add", "-A"); p.git("commit", "-qm", "unrelated");
    // The unrelated commit does not change the inverse: the preview still holds.
    const no = await p.call("decide", { h, kind: "undo-confirm", answers: { "undo-confirm": "cancel" } });
    assert.equal(no.exit, 0);
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), GREET_IMPL);
    await p.call("undo", { h, again: true });
    p.write("src/greet.ts", `${GREET_IMPL}// changed after the preview\n`);
    p.git("add", "-A"); p.git("commit", "-qm", "overlaps now");
    const stale = await p.call("decide", { h, kind: "undo-confirm", answers: { "undo-confirm": "apply" } });
    assert.notEqual(stale.exit, 0);
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), `${GREET_IMPL}// changed after the preview\n`);
  });

  it("reverts on the base branch after integration", async () => {
    const p = fresh();
    const h = await finished(p);
    assert.equal((await p.call("integrate", { h })).exit, 0);
    assert.equal(p.git("branch", "--show-current"), "main");
    await p.call("undo", { h });
    const r = await p.call("decide", { h, kind: "undo-confirm", answers: { "undo-confirm": "apply" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), STUB);
  });

  it("rolls forward after a crash between publishing the revert contract and applying the patch", async () => {
    const p = fresh();
    const h = await finished(p);
    await p.call("undo", { h });
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-undo.ts"), p.root, JSON.stringify({ h, kind: "undo-confirm", answers: { "undo-confirm": "apply" } })], { stdio: "ignore" });
    assert.equal(await new Promise((r) => child.on("exit", (_c, s) => r(s))), "SIGKILL");
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), GREET_IMPL, "the patch had not been applied");
    const w = Object.values(p.ports().store.read()!.state.work).find((x) => x.profile === "fix")!;
    const h2 = `W${Number(w.label.slice(2))}.${w.session.generation}.${p.ports().store.read()!.state.tag}`;
    const c = await p.call("check", { h: h2, stage: "candidate" });
    assert.equal(c.exit, 0, JSON.stringify(c));
    assert.ok(c.effects?.completed.some((e) => /undo was finished/.test(e)), JSON.stringify(c.effects));
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), STUB);
    assert.equal(d(await finishFixture(p, { h: h2, subject: "Undo" })).endpoint, "checked-local");
  });
});
