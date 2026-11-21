// Cleanup removal after a confirmed preview (LFC-05, cleanup-confirmation §9): entry by entry against the confirmation's walk,
// keeping anything added or changed after it, never following links, journaled so an interrupted cleanup is never repeated.
// Real filesystem throughout. A canary folder beside the workspace's temp root must survive every case.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, utimesSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { project, type Project } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import type { TempWalk } from "../src/core/residue.ts";
import { cleanup as cleanupDecision } from "../src/decisions/cleanup.ts";
import type { DecisionCtx } from "../src/decisions/types.ts";

const roots: string[] = [];
const temp = realpathSync(mkdtempSync(join(tmpdir(), "tenet-cleanup-")));
const previous = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
for (const key of Object.keys(previous)) process.env[key] = temp;
after(() => {
  try { for (const r of roots) cleanup(r); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    chmodTree(temp);
    rmSync(temp, { recursive: true, force: true });
  }
});
/** Restores permissions so the fixture folder can be removed after a chmod case. */
function chmodTree(dir: string) {
  try { chmodSync(dir, 0o755); for (const n of readdirSync(dir, { withFileTypes: true })) if (n.isDirectory()) chmodTree(join(dir, n.name)); } catch { /* gone */ }
}
const posixUser = process.platform !== "win32" && process.getuid?.() !== 0;

interface Setup { p: Project; h: string; root: string; listed: string; other: string; canary: string; outside: string }
/** A project whose temp root holds two run files in two folders, a canary beside the root and a folder outside it. */
async function setup(): Promise<Setup> {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "plan", request: "plan the work" })).handle!;
  const store = p.ports().store;
  const listed = store.writeArtifact(store.tempDir("manifests"), "listed.json", "{}");
  const other = store.writeArtifact(store.tempDir("review"), "packet.json", "{}");
  const root = store.residue().temp!.path;
  const canary = join(temp, `canary-${p.root.replace(/[^a-z0-9]/gi, "").slice(-12)}`);
  mkdirSync(canary, { recursive: true }); writeFileSync(join(canary, "keep.txt"), "canary");
  const outside = join(temp, `outside-${p.root.replace(/[^a-z0-9]/gi, "").slice(-12)}`);
  mkdirSync(outside, { recursive: true }); writeFileSync(join(outside, "theirs.txt"), "outside");
  return { p, h, root, listed, other, canary, outside };
}
const preview = async (s: Setup, target = "project") => {
  const r = await s.p.call("decide", { h: s.h, kind: "cleanup", target });
  assert.equal(r.exit, 3, JSON.stringify(r));
};
/** Confirms with the store's removal wrapped, so a change lands after the confirmation's walk and before removal. */
async function confirm(s: Setup, before?: (walk: TempWalk) => void, target = "project") {
  const ports = s.p.ports();
  const real = ports.store.removeTemp.bind(ports.store);
  ports.store.removeTemp = (walk, keep) => { before?.(walk); return real(walk, keep); };
  return runVerb(ports, VERBS, "decide", { h: s.h, kind: "cleanup", target, answers: { "cleanup-confirm": "yes" } });
}
const d = (r: { data?: unknown }) => r.data as { removed: string[]; kept: Array<{ path: string; cause: string }> };
const canaryOk = (s: Setup) => assert.equal(readFileSync(join(s.canary, "keep.txt"), "utf8"), "canary");

describe("cleanup removal [LFC-05]", () => {
  it("[LFC-05] removes every listed entry and the root when nothing changed", async () => {
    const s = await setup();
    await preview(s);
    const r = await confirm(s);
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.deepEqual(d(r), { removed: [s.root], kept: [] });
    assert.equal(existsSync(s.root), false);
    canaryOk(s);
    assert.ok(existsSync(join(s.p.root, ".tenet", "state")));
  });

  it("[LFC-05] C4: a file added under a listed folder after the confirmation's walk survives with its parents", async () => {
    const s = await setup();
    await preview(s);
    const added = join(s.root, "manifests", "added-later.txt");
    const r = await confirm(s, () => writeFileSync(added, "human"));
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(readFileSync(added, "utf8"), "human");
    assert.equal(existsSync(s.listed), false);
    assert.equal(existsSync(s.other), false);
    assert.deepEqual(d(r).kept, [{ path: join(s.root, "manifests"), cause: "added" }]);
    assert.deepEqual(d(r).removed, []);
    canaryOk(s);
  });

  for (const how of ["rewritten", "replaced by rename"] as const) {
    it(`[LFC-05] C5: a listed file ${how} after the confirmation's walk survives`, async () => {
      const s = await setup();
      await preview(s);
      const r = await confirm(s, () => {
        if (how === "rewritten") writeFileSync(s.listed, "{\"mine\":true}");
        else { const swap = join(s.root, "manifests", "swap.tmp"); writeFileSync(swap, "{\"mine\":true}"); renameSync(swap, s.listed); }
      });
      assert.equal(r.exit, 3, JSON.stringify(r));
      assert.equal(readFileSync(s.listed, "utf8"), "{\"mine\":true}");
      assert.equal(existsSync(s.other), false);
      assert.deepEqual(d(r).kept, [{ path: s.listed, cause: "changed" }]);
      canaryOk(s);
    });
  }

  for (const how of ["a link to another folder", "a link to where it was moved"] as const) {
    it(`[LFC-05] C6: a listed folder replaced by ${how} is not followed`, { skip: process.platform === "win32" }, async () => {
      const s = await setup();
      await preview(s);
      const review = join(s.root, "review"), moved = join(s.outside, "moved");
      const r = await confirm(s, () => {
        if (how === "a link to another folder") rmSync(review, { recursive: true });
        else renameSync(review, moved);
        symlinkSync(how === "a link to another folder" ? s.outside : moved, review);
      });
      assert.equal(r.exit, 3, JSON.stringify(r));
      assert.equal(readFileSync(join(s.outside, "theirs.txt"), "utf8"), "outside");
      if (how === "a link to where it was moved") assert.equal(readFileSync(join(moved, "packet.json"), "utf8"), "{}");
      assert.ok(d(r).kept.some((k) => (k.path === review || k.path.startsWith(`${review}/`)) && k.cause === "changed"), JSON.stringify(d(r)));
      assert.equal(existsSync(s.listed), false);
      canaryOk(s);
    });
  }

  it("[LFC-05] C7: a link inside the root is removed and its target outside survives", { skip: process.platform === "win32" }, async () => {
    const s = await setup();
    const link = join(s.root, "manifests", "link");
    symlinkSync(join(s.outside, "theirs.txt"), link);
    await preview(s);
    const r = await confirm(s);
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(existsSync(s.root), false);
    assert.equal(readFileSync(join(s.outside, "theirs.txt"), "utf8"), "outside");
    canaryOk(s);
  });

  it("[LFC-05] C8: an old root with an unreadable folder is kept as could not inspect", { skip: !posixUser }, async () => {
    const s = await setup();
    const locked = join(s.root, "manifests", "locked");
    mkdirSync(locked); writeFileSync(join(locked, "recent.txt"), "recent");
    const old = new Date(Date.now() - 3 * 3600_000);
    const age = (dir: string) => {
      for (const n of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, n.name);
        if (n.isDirectory() && path !== locked) age(path);
        if (path !== join(locked, "recent.txt")) utimesSync(path, old, old);
      }
      utimesSync(dir, old, old);
    };
    age(s.root);
    chmodSync(locked, 0o000);
    try {
      const r = await s.p.call("decide", { h: s.h, kind: "cleanup", target: "machine" });
      assert.equal(r.exit, 3, JSON.stringify(r));
      const kept = (r.data as { preview: { kept: Array<{ path: string; cause: string }> } }).preview.kept;
      assert.ok(kept.some((k) => k.path === s.root && k.cause === "could not inspect"), JSON.stringify(kept));
      const done = await confirm(s, undefined, "machine");
      assert.deepEqual(d(done).removed, [], JSON.stringify(done));
    } finally { chmodSync(locked, 0o755); }
    assert.equal(readFileSync(join(locked, "recent.txt"), "utf8"), "recent");
    assert.ok(existsSync(s.listed));
    canaryOk(s);
  });

  it("[LFC-05] C9: an unlink that fails keeps that entry and its parents and removes the rest", { skip: !posixUser }, async () => {
    const s = await setup();
    await preview(s);
    const manifests = join(s.root, "manifests");
    try {
      const r = await confirm(s, () => chmodSync(manifests, 0o555));
      assert.equal(r.exit, 3, JSON.stringify(r));
      assert.deepEqual(d(r).kept, [{ path: s.listed, cause: "EACCES" }]);
      assert.equal(existsSync(s.other), false);
      assert.equal(existsSync(join(s.root, "review")), false);
    } finally { chmodSync(manifests, 0o755); }
    assert.ok(existsSync(s.listed));
    canaryOk(s);
  });

  // The pipeline fences every call while recovery leaves an intent unsettled, so this keep rule is reached only through
  // an intent whose process is still alive; the handler is driven directly with such an intent.
  it("[LFC-05] C12: a run folder an unresolved effect names is kept as recovery pending", async () => {
    const s = await setup();
    const store = s.p.ports().store, runDir = store.tempDir("run-u-pending");
    store.writeArtifact(runDir, "run.json", "{}");
    await preview(s);
    const ports = s.p.ports(), state = ports.store.read()!.state;
    const work = Object.values(state.work)[0]!;
    const journal: string[] = [];
    const tx = {
      unresolved: () => [{ effect: "undo", id: "u-pending", op: { runDir } }],
      intent: (effect: string) => { journal.push(`intent ${effect}`); },
      result: (effect: string) => { journal.push(`result ${effect}`); },
    };
    const input = { h: s.h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } };
    const plan = await cleanupDecision.run({ ports, tx, state, work, input } as unknown as DecisionCtx);
    assert.equal(plan.resp.exit, 3, JSON.stringify(plan.resp));
    assert.deepEqual(d(plan.resp).kept, [{ path: runDir, cause: "recovery pending" }]);
    assert.deepEqual(journal, ["intent cleanup", "result cleanup"]);
    assert.ok(existsSync(join(runDir, "run.json")));
    assert.equal(existsSync(s.listed), false);
    canaryOk(s);
  });
});

describe("interrupted cleanup [LFC-05, CON-12]", () => {
  for (const mode of ["before", "after-some"] as const) {
    it(`[LFC-05] [CON-12] C10: killed ${mode === "before" ? "before the first unlink" : "after some unlinks"}; recovery removes nothing and a retried yes is refused`, { skip: process.platform === "win32" }, async () => {
      const s = await setup();
      await preview(s);
      const input = JSON.stringify({ h: s.h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
      const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-cleanup.ts"), s.p.root, input, mode], { stdio: "ignore" });
      assert.equal(await new Promise((r) => child.on("exit", (_c, sig) => r(sig))), "SIGKILL");
      const leftBefore = existsSync(s.listed) || existsSync(s.other);
      assert.ok(leftBefore);
      const retry = await s.p.call("decide", { h: s.h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
      assert.equal(retry.exit, 2, JSON.stringify(retry));
      assert.equal(retry.reasons[0]!.code, "revision-conflict");
      assert.ok(retry.effects?.completed.some((e) => /interrupted cleanup may have removed some run files/.test(e)), JSON.stringify(retry.effects));
      assert.ok(existsSync(s.root), "recovery and the refused retry removed nothing");
      const again = await s.p.call("decide", { h: s.h, kind: "cleanup", target: "project" });
      assert.equal(again.exit, 3, JSON.stringify(again));
      const files = (again.data as { preview: { files: number } }).preview.files;
      assert.ok(files >= 1, "the new preview shows what remains");
      canaryOk(s);
    });
  }
});
