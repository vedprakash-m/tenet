// What Tenet leaves behind and the previewed cleanups (LFC-05, CON-10, TS §18 residue): read-only listing, then two scopes.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import { Receipt } from "../src/core/schemas.ts";
import { handoffText } from "../src/core/handoff.ts";

const roots: string[] = [];
const extra: string[] = [];
// Machine-wide listing assertions must not observe other test processes' run directories.
const temp = realpathSync(mkdtempSync(join(tmpdir(), "tenet-residue-")));
const previous = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
for (const key of Object.keys(previous)) process.env[key] = temp;
after(() => {
  try {
    for (const r of roots) cleanup(r);
    for (const e of extra) rmSync(e, { recursive: true, force: true });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(temp, { recursive: true, force: true });
  }
});
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
/** A run file in this workspace's temp root, as Tenet writes them. */
const tempFile = (p: Project, group: string, name: string): string => {
  const store = p.ports().store;
  return store.writeArtifact(store.tempDir(group), name, "{}");
};
const open = async (p: Project) => (await p.call("open", { profile: "plan", request: "plan the work" })).handle!;

it("isolates residue fixtures from other test processes", () => {
  assert.equal(realpathSync(tmpdir()), temp);
});

/** A plan contract with an analyst packet written to the temp folder, then the reservation released by stopping it. */
async function withTemp(p: Project) {
  const h = await open(p);
  await p.call("packet", { h, role: "analyst", analystRole: "researcher", question: "where is the store opened?" });
  return h;
}

describe("residue listing [LFC-05]", () => {
  it("names .tenet, the run files outside the project, the adopted documents that stay and what is kept", async () => {
    const p = fresh();
    writeFileSync(join(p.root, "tenet.policy.json"), "{}");
    await withTemp(p);
    const r = await p.call("inspect", { view: "residue" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const x = d(r).residue;
    assert.ok(x.tenet.files > 0 && x.tenet.bytes > 0);
    assert.ok(x.temp.files > 0, "the analyst packet is in the OS temp folder");
    assert.deepEqual(x.adopted.filter((a: any) => a.present).map((a: any) => a.path), ["tenet.policy.json"]);
    assert.match(x.kept.join(" "), /test tags/);
    assert.match(x.tenetDirCommand, /\.tenet/);
  });

  it("lists nothing for a project Tenet never touched, without creating .tenet", async () => {
    const p = fresh();
    const r = await p.call("inspect", { view: "residue" });
    assert.equal(r.exit, 0);
    assert.equal(d(r).residue.tenet, null);
    assert.equal(existsSync(join(p.root, ".tenet")), false);
  });
});

describe("cleanup previews and scopes [LFC-05, CON-10]", () => {
  it("previews first and changes nothing; confirming removes this project's run files but never .tenet or adopted files", async () => {
    const p = fresh();
    writeFileSync(join(p.root, "INTENT.md"), "# mine\n");
    const h = await open(p);
    const store = p.ports().store;
    store.writeArtifact(store.tempDir("manifests"), "old-packet.json", "{}");
    const before = d(await p.call("inspect", { view: "residue" })).residue.temp.files;
    const preview = await p.call("decide", { h, kind: "cleanup", target: "project" });
    assert.equal(preview.exit, 3, JSON.stringify(preview));
    assert.equal(preview.questions![0]!.id, "cleanup-confirm");
    assert.equal(d(await p.call("inspect", { view: "residue" })).residue.temp.files, before);
    const done = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
    assert.equal(done.exit, 0, JSON.stringify(done));
    assert.equal(d(await p.call("inspect", { view: "residue" })).residue.temp, null);
    assert.ok(existsSync(join(p.root, ".tenet", "state")), ".tenet stays: removing the store inside its own call is not safe");
    assert.ok(existsSync(join(p.root, "INTENT.md")));
  });

  it("marks evidence whose retained output folder was removed as history-unavailable in later claims [AC-19, CON-08]", async () => {
    const p = fresh();
    const h = await open(p);
    const store = p.ports().store;
    const runDir = store.tempDir("run-expired");
    store.writeArtifact(runDir, "raw.txt", "historical raw output");
    const current = store.read()!.state;
    const work = Object.values(current.work)[0]!;
    const receipt = Receipt.parse({
      id: "RC-expired", obligation: "OB-suite", kind: "test", stage: "candidate", source: "kernel-run",
      checkInputId: "a".repeat(24), scope: "full", argv: [], cwd: ".",
      candidate: "b".repeat(64), durationMs: 1,
      versions: { tool: "vitest", reporter: "json", adapter: "node-ts" },
      provenance: { runId: "run-expired", runDir, startedAt: "2026-01-01T00:00:00.000Z" },
      status: "pass", qualifiers: [], reasons: [], limitations: [],
    });
    await store.transaction("history-fixture", async (tx) => {
      tx.publish({
        ...tx.state!,
        work: { ...tx.state!.work, [work.id]: { ...work, receipts: [receipt] } },
      });
    });
    assert.equal((await p.call("decide", { h, kind: "cleanup", target: "project" })).exit, 3);
    assert.equal((await p.call("decide", {
      h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" },
    })).exit, 0);
    const after = store.read()!.state;
    const retained = after.work[work.id]!.receipts[0]!;
    assert.ok(retained.qualifiers.includes("history-unavailable"));
    assert.match(handoffText(after, after.work[work.id]!), /history-unavailable/);
  });

  it("refuses while a review or analyst reservation is open, because the packet would vanish under it", async () => {
    const p = fresh();
    const h = await withTemp(p);
    const r = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "work-busy");
    assert.match(r.reasons[0]!.message, /W-\d+ has a reservation|W-\d+ has an open review packet/);
  });

  it("preserves another contract's active run during project or machine cleanup [CON-12]", async () => {
    const p = fresh();
    await open(p);
    const h = (await p.call("open", { profile: "plan", request: "another task" })).handle!;
    const store = p.ports().store, runDir = store.tempDir("run-cleanup-live");
    const artifact = store.writeArtifact(runDir, "run.json", "{}");
    await store.transaction("fixture", async tx => {
      const state = tx.state!, first = Object.values(state.work)[0]!;
      tx.publish({ ...state, work: { ...state.work, [first.id]: { ...first,
        session: { ...first.session, inCall: { verb: "check", runId: "cleanup-live", runDir,
          ...store.self(), since: new Date().toISOString() } },
      } } });
    });
    const old = new Date(Date.now() - 3 * 3600_000);
    for (const path of [artifact, runDir, join(runDir, "..")]) utimesSync(path, old, old);
    for (const target of ["project", "machine"]) {
      const r = await p.call("decide", { h, kind: "cleanup", target, answers: { "cleanup-confirm": "yes" } });
      assert.equal(r.exit, 2, JSON.stringify(r));
      assert.equal(r.reasons[0]!.code, "work-busy");
      assert.match(r.reasons[0]!.message, /W-\d+ has a check in progress/);
      assert.ok(existsSync(artifact));
    }
  });

  it("protects an open packet from machine cleanup even when its files are old", async () => {
    const p = fresh();
    const h = await withTemp(p);
    const store = p.ports().store, root = store.residue().temp!.path;
    const old = new Date(Date.now() - 3 * 3600_000);
    const age = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, name.name);
        if (name.isDirectory()) age(path);
        utimesSync(path, old, old);
      }
      utimesSync(dir, old, old);
    };
    age(root);
    const r = await p.call("decide", { h, kind: "cleanup", target: "machine", answers: { "cleanup-confirm": "yes" } });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "work-busy");
    assert.ok(existsSync(root));
  });

  it("machine cleanup retains stale candidates whose ownership and compatibility cannot be proved [LFC-05, CON-10]", async () => {
    const p = fresh();
    const h = await open(p);
    const suffix = p.root.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const stale = join(tmpdir(), `tenet-ws_staletest${suffix}`), recent = join(tmpdir(), `tenet-ws_recenttest${suffix}`), other = join(tmpdir(), `tenet-wsx_other${suffix}`);
    for (const dir of [stale, recent, other]) { mkdirSync(dir); extra.push(dir); writeFileSync(join(dir, "f"), "x"); }
    const old = new Date(Date.now() - 3 * 3600_000);
    for (const dir of [stale, other]) { utimesSync(join(dir, "f"), old, old); utimesSync(dir, old, old); }
    // a folder whose own time is old but which holds a recently used packet is not stale
    const busy = join(tmpdir(), `tenet-ws_busytest${suffix}`);
    mkdirSync(busy); extra.push(busy); writeFileSync(join(busy, "live.json"), "{}");
    utimesSync(busy, old, old);
    const before = readdirSync(tmpdir()).filter((name) => name.startsWith("tenet-ws_")).sort();
    const preview = await p.call("decide", { h, kind: "cleanup", target: "machine" });
    assert.equal(preview.exit, 3);
    assert.ok(existsSync(stale), "a preview removes nothing");
    const selection = p.ports().store.walkTemp("machine", 2 * 3600_000);
    const keptPaths = selection.kept.map((k) => k.path);
    assert.deepEqual(readdirSync(tmpdir()).filter((name) => name.startsWith("tenet-ws_")).sort(), before);
    assert.deepEqual([existsSync(stale), existsSync(recent), existsSync(other), existsSync(busy)], [true, true, true, true]);
    assert.ok([recent, other, busy, stale].every((dir) => selection.root !== dir), "only this workspace's own root is ever selected");
    assert.deepEqual({ retained: keptPaths.includes(stale), cause: selection.kept.find((k) => k.path === stale)?.cause }, { retained: true, cause: "another workspace" });
  });

  it("[LFC-05] C1: a yes with no stored preview is refused and removes nothing", async () => {
    const p = fresh();
    const h = await open(p);
    const file = tempFile(p, "manifests", "c1.json");
    const r = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "revision-conflict");
    assert.ok(existsSync(file));
  });

  it("[LFC-05] C2: a project preview does not authorize a machine-scope answer", async () => {
    const p = fresh();
    const h = await open(p);
    const file = tempFile(p, "manifests", "c2.json");
    assert.equal((await p.call("decide", { h, kind: "cleanup", target: "project" })).exit, 3);
    const r = await p.call("decide", { h, kind: "cleanup", target: "machine", answers: { "cleanup-confirm": "yes" } });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "revision-conflict");
    assert.ok(existsSync(file));
  });

  for (const change of ["added", "rewritten"] as const) {
    it(`[LFC-05] C3: a file ${change} after the preview refuses the whole cleanup`, async () => {
      const p = fresh();
      const h = await open(p);
      const listed = tempFile(p, "manifests", "listed.json");
      assert.equal((await p.call("decide", { h, kind: "cleanup", target: "project" })).exit, 3);
      const mine = join(dirname(listed), "mine.txt");
      if (change === "added") writeFileSync(mine, "human");
      else writeFileSync(listed, "{\"rewritten\":true}");
      const r = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
      assert.equal(r.exit, 2, JSON.stringify(r));
      assert.equal(r.reasons[0]!.code, "revision-conflict");
      assert.match(r.reasons[0]!.message, /preview again/);
      assert.ok(existsSync(listed));
      if (change === "added") assert.equal(readFileSync(mine, "utf8"), "human");
    });
  }

  it("[LFC-05] C11: a stopped run whose result is not settled names its work and state", async () => {
    const p = fresh();
    const h = await open(p);
    const store = p.ports().store, runDir = store.tempDir("run-stopped");
    await store.transaction("fixture", async tx => {
      const state = tx.state!, w = Object.values(state.work)[0]!;
      tx.publish({ ...state, work: { ...state.work, [w.id]: { ...w,
        session: { ...w.session, inCall: { verb: "check", runId: "stopped", runDir, cancelled: true, ...store.self(), since: new Date().toISOString() } },
      } } });
    });
    const r = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
    assert.equal(r.reasons[0]!.code, "work-busy", JSON.stringify(r));
    assert.match(r.reasons[0]!.message, /W-\d+ has a stopped run whose result is not settled/);
    assert.ok(existsSync(runDir));
  });

  it("[LFC-05] C13: no settles the question and removes nothing; a later yes then has no question", async () => {
    const p = fresh();
    const h = await open(p);
    const file = tempFile(p, "manifests", "c13.json");
    assert.equal((await p.call("decide", { h, kind: "cleanup", target: "project" })).exit, 3);
    const no = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "no" } });
    assert.equal(no.exit, 0, JSON.stringify(no));
    assert.ok(existsSync(file));
    assert.equal(p.ports().store.read()!.state.pending.some((q) => q.id === "cleanup-confirm"), false);
    const yes = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
    assert.equal(yes.reasons[0]!.code, "revision-conflict");
    assert.ok(existsSync(file));
  });

  it("[LFC-05] C14: the stored question is a chat question that does not overclaim", async () => {
    const p = fresh();
    const h = await open(p);
    tempFile(p, "manifests", "c14.json");
    const preview = await p.call("decide", { h, kind: "cleanup", target: "project" });
    const q = preview.questions![0]!;
    assert.equal(q.channel, "chat");
    assert.match(q.question, /Anything added after this preview is kept/);
    assert.doesNotMatch(q.question, /your files are not touched/);
    assert.deepEqual(p.ports().store.read()!.state.pending.filter((x) => x.id === "cleanup-confirm").map((x) => x.bind.factsHash), [q.bind.factsHash]);
    assert.equal(q.bind.factsHash.length, 64, "the full SHA-256 of work, scope and every entry");
  });

  it("refuses an unknown scope", async () => {
    const p = fresh();
    const h = await open(p);
    assert.equal((await p.call("decide", { h, kind: "cleanup", target: "everything" })).exit, 2);
  });
});
