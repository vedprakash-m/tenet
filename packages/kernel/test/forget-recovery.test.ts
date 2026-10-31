import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, closeSync, existsSync, ftruncateSync, openSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cleanup, tmp } from "./helpers.ts";
import { project, type Project } from "./support/fixture.ts";
import { workByHandle } from "../src/pipeline-render.ts";
import { procStart } from "../src/adapters/proc.ts";
const roots: string[] = [], temps: string[] = [];
after(() => { for (const root of [...roots, ...temps]) cleanup(root); });
const statement = "forget the unique ORCHID-74623 convention", quote = "the ORCHID-quote-92503 is only advice";
const state = (p: Project) => p.ports().store.read()!.state;
const data = (r: { data?: unknown }) => r.data as any;
const files = (dir: string): string[] => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
async function seed(text = statement, words = quote) {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "plan", request: "plan the first work" })).handle!;
  const added = await p.call("decide", { h, kind: "lesson", quote: words, propose: { statement: text } });
  assert.equal(added.exit, 0, JSON.stringify(added));
  const id = data(added).id as string;
  await p.call("decide", { h, kind: "lesson", quote: "keep this advice", propose: { statement: "keep the second lesson" } });
  const other = (await p.call("open", { profile: "plan", request: "plan the second work" })).handle!;
  await p.call("packet", { h: other, role: "analyst", analystRole: "researcher", question: "inspect the lessons" });
  const base = dirname(p.ports().store.tempDir("manifests")); temps.push(base);
  const input = { h, kind: "forget", target: id, answers: { "forget-confirm": "yes" } };
  return { p, h, other, id, base, input };
}
function absent(p: Project, base: string) {
  for (const path of [...files(join(p.root, ".tenet")), ...files(base)]) {
    const text = readFileSync(path, "utf8");
    assert.equal(text.includes(statement) || text.includes(quote), false, path);
  }
}
function revisions(p: Project, r: { revision: number; handle?: string }) {
  const s = state(p), log = p.ports().store.readLog();
  assert.equal(r.revision, s.revision);
  if (r.handle) assert.equal((workByHandle(s, r.handle).session.last!.response as { revision: number }).revision, s.revision);
  assert.equal(log.filter(x => x.kind === "call").at(-1)!.revision, s.revision);
}
const conserved = (p: Project) => {
  const s = state(p);
  return { lessons: s.lessons.filter(l => l.statement !== statement), work: Object.fromEntries(Object.entries(s.work).map(([id,w]) => [id, { grants: w.grants, budget: { ...w.budget, lastCall: undefined, activeMinutesTotal: undefined, activeMinutesSinceCheckIn: undefined } }])) };
};
const effects = (p: Project) => p.ports().store.readLog().filter(x => x.effect === "forget");
async function crash(p: Project, input: unknown, point: string) {
  const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-forget.ts"), p.root, JSON.stringify(input), point], { stdio: ["ignore", "pipe", "inherit"] });
  const [code, signal] = await once(child, "exit");
  assert.equal(signal, "SIGKILL", `${point}: exit ${code}`);
}

describe("crash-safe lesson forgetting [CON-10]", () => {
  it("FG-1 clears state/backup/all caches/packets, journals once, and reports the published revision", async () => {
    const { p, base, input } = await seed(), before = p.ports().store.readLog().filter(x => x.kind === "call").length;
    const r = await p.call("decide", input);
    assert.equal(r.exit, 0, JSON.stringify(r)); absent(p, base); revisions(p, r);
    assert.equal(p.ports().store.readLog().filter(x => x.kind === "call").length, before + 1);
    assert.deepEqual(effects(p).map(x => x.kind), ["intent", "result"]);
    assert.deepEqual(effects(p)[0]!.op, { work: workByHandle(state(p), input.h).id, lesson: input.target });
    assert.deepEqual(effects(p)[1]!.outcome, { completed: true });
    assert.match(data(r).outside, /already sent to the host/i);
  });
  for (const point of ["after-intent", "after-purge", "after-first", "after-second", "after-result"]) {
    it(`FG-2 recovers after SIGKILL ${point}, preserves other facts and stays idempotent`, { timeout: 20_000 }, async () => {
      const { p, h, base, input } = await seed(), before = conserved(p);
      await crash(p, input, point);
      if (point === "after-first") {
        assert.equal(files(base).some(path => readFileSync(path, "utf8").includes(statement)), false, "purge precedes the first publication");
      }
      const r = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
      assert.equal(r.exit, 0, JSON.stringify(r)); absent(p, base); revisions(p, r);
      assert.deepEqual(conserved(p), before);
      assert.deepEqual(effects(p).map(x => x.kind), ["intent", "result"]);
      if (point !== "after-result") assert.ok(r.effects!.completed.some(x => x.includes("an interrupted forget was finished")), JSON.stringify(r));
      const settled = effects(p);
      for (let i = 0; i < 2; i++) {
        const retry = await p.call("decide", { h, kind: "forget", target: input.target, again: true });
        assert.equal(retry.exit, 2); absent(p, base); assert.equal(retry.revision, state(p).revision);
        assert.deepEqual(effects(p), settled); assert.deepEqual(conserved(p), before);
      }
    });
  }
  it("FG-3 finishes after primary damage falls back to the lesson-bearing backup", { timeout: 20_000 }, async () => {
    const { p, h, base, input } = await seed();
    await crash(p, input, "after-first");
    assert.ok(JSON.parse(readFileSync(join(p.root, ".tenet/state.prev"), "utf8")).lessons.some((l: any) => l.id === input.target));
    writeFileSync(join(p.root, ".tenet/state"), "{ damaged");
    assert.equal(p.ports().store.read()!.recovered, true);
    const r = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
    absent(p, base); revisions(p, r);
    assert.ok(r.effects!.completed.some(x => x.includes("an interrupted forget was finished")), JSON.stringify(r));
    assert.deepEqual(effects(p).map(x => x.kind), ["intent", "result"]);
  });
  it("lost-response retry reports both the missing lesson and the finished recovery", async () => {
    const { p, base, input } = await seed();
    await crash(p, input, "after-intent");
    const r = await p.call("decide", input);
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.effects?.completed.includes("an interrupted forget was finished"), JSON.stringify(r));
    absent(p, base); revisions(p, r);
  });
  it("FG-5 Keep it preserves the lesson and creates no forget effect", async () => {
    const { p, input } = await seed(), before = state(p).lessons;
    const r = await p.call("decide", { ...input, answers: { "forget-confirm": "keep" } });
    assert.equal(r.exit, 3); assert.deepEqual(state(p).lessons, before); assert.deepEqual(effects(p), []);
  });
  it("FG-6 preserves a live job's process record and report when their text matches the forgotten lesson", { timeout: 15_000 }, async () => {
    const child = spawn(process.execPath, ["-e", "console.log('ready');setInterval(()=>{},1000)"], { detached: true, stdio: ["ignore", "pipe", "inherit"] });
    const exited = once(child, "exit");
    try {
      await once(child.stdout!, "data");
      const { p, other, base, input } = await seed("prepared", '"pid"');
      const store = p.ports().store, runDir = store.tempDir("run-forget-scope");
      const record = JSON.stringify({ prepared: true, pid: child.pid, procStart: procStart(child.pid!) });
      writeFileSync(join(runDir, "run.json"), record);
      const report = "check output: prepared, with a \"pid\" field";
      writeFileSync(join(runDir, "report.json"), report);
      const packet = store.writeArtifact(store.tempDir("manifests"), "matching.txt", "prepared");
      const otherId = workByHandle(state(p), other).id;
      await store.transaction("seed-live", async tx => {
        const s = tx.state!, w = s.work[otherId]!;
        tx.publish({ ...s, work: { ...s.work, [otherId]: { ...w, session: { ...w.session, inCall: { verb: "check", runId: "forget-scope", runDir, pid: process.pid, procStart: procStart(process.pid)!, since: new Date().toISOString() } } } } });
      });
      const r = await p.call("decide", input); assert.equal(r.exit, 0, JSON.stringify(r));
      assert.equal(existsSync(packet), false); assert.equal(readFileSync(join(runDir, "run.json"), "utf8"), record);
      assert.equal(readFileSync(join(runDir, "report.json"), "utf8"), report); process.kill(child.pid!, 0);
      const stopped = await p.call("stop", { h: other, mode: "cancel" });
      assert.equal(stopped.exit, 0, JSON.stringify(stopped)); await exited;
      assert.equal(readFileSync(join(runDir, "report.json"), "utf8"), report);
      assert.equal(existsSync(base), true);
    } finally { if (child.exitCode === null && child.signalCode === null) { process.kill(-child.pid!, "SIGKILL"); await exited; } }
  });
});

describe("recovery refusal reports current facts [CON-03, CON-04]", () => {
  it("finishes a forget and reports the actual publication revision while another effect stays uncertain", async () => {
    const { p, h, base, input } = await seed();
    await crash(p, input, "after-intent");
    await p.ports().store.transaction("seed-unknown", async tx => tx.intent("unrecognized-effect", "uncertain-one", { work: workByHandle(tx.state!, h).id }));
    const r = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(x => x.code === "effect-uncertain"));
    assert.ok(r.effects?.completed.includes("an interrupted forget was finished"));
    assert.ok(r.effects?.uncertain.some(x => x.includes("unrecognized-effect")));
    absent(p, base);
    assert.equal(r.revision, state(p).revision, "the refusal must not precede its own completed recovery publications");
    const before = state(p).revision;
    const retry = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
    assert.equal(retry.exit, 2); assert.equal(retry.revision, state(p).revision);
    assert.equal(state(p).revision, before, "an unchanged uncertain effect causes no repeated publication");
  });
});


describe("forget refuses an incomplete packet purge [CON-10, SEC-06]", () => {
  for (const failure of ["unreadable-file", "unreadable-directory", "unwritable-directory", "oversized-file", "invalid-utf8"]) {
    it(`keeps the lesson and pending intent after ${failure}, then completes when repaired`, async () => {
      assert.notEqual(process.geteuid!(), 0, "permission controls require a real unprivileged process");
      const { p, h, id, base, input } = await seed();
      const packet = files(base).find(path => readFileSync(path, "utf8").includes(statement))!;
      assert.ok(packet);
      const original = readFileSync(packet), manifests = dirname(packet);
      const before = readFileSync(join(p.root, ".tenet/state"));
      try {
        if (failure === "unreadable-file") chmodSync(packet, 0o000);
        else if (failure === "unreadable-directory") chmodSync(manifests, 0o000);
        else if (failure === "unwritable-directory") chmodSync(manifests, 0o500);
        else if (failure === "invalid-utf8") writeFileSync(packet, Buffer.concat([original, Buffer.from([0xff])]));
        else {
          const fd = openSync(packet, "r+");
          try { ftruncateSync(fd, 50 * 1024 * 1024 + 1); } finally { closeSync(fd); }
        }
        const refused = await p.call("decide", input);
        assert.notEqual(refused.exit, 0, "an unverified purge cannot acknowledge forgetting");
        assert.equal(state(p).lessons.some(l => l.id === id), true);
        assert.deepEqual(readFileSync(join(p.root, ".tenet/state")), before);
        assert.deepEqual(effects(p).map(x => x.kind), ["intent"]);
        if (failure !== "unreadable-directory") assert.equal(existsSync(packet), true);
      } finally {
        chmodSync(manifests, 0o700);
        if (existsSync(packet)) { chmodSync(packet, 0o600); writeFileSync(packet, original); }
      }
      assert.equal(existsSync(packet), true, "packet still exists after restoring directory access");
      const done = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
      assert.equal(done.exit, 0, JSON.stringify(done));
      absent(p, base); revisions(p, done);
      assert.ok(done.effects?.completed.includes("an interrupted forget was finished"));
      assert.deepEqual(effects(p).map(x => x.kind), ["intent", "result"]);
    });
  }
});


describe("forget checks the owned temp root [CON-10]", () => {
  it("does not mistake an inaccessible temp parent for missing packets", async () => {
    assert.notEqual(process.geteuid!(), 0);
    const { p, h, base, input } = await seed();
    const parent = tmp(); roots.push(parent);
    const moved = join(parent, base.split("/").at(-1)!);
    renameSync(base, moved);
    const previous = process.env.TMPDIR;
    try {
      process.env.TMPDIR = parent;
      chmodSync(parent, 0o000);
      const r = await p.call("decide", input);
      assert.notEqual(r.exit, 0, "failure to inspect the temp root is not proof of absence");
      assert.ok(state(p).lessons.some(l => l.id === input.target));
      assert.deepEqual(effects(p).map(x => x.kind), ["intent"]);
    } finally {
      chmodSync(parent, 0o700);
      if (previous === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous;
      renameSync(moved, base);
    }
    const done = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
    assert.equal(done.exit, 0, JSON.stringify(done)); absent(p, base); revisions(p, done);
  });
});
