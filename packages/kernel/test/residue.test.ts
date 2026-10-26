// What Tenet leaves behind and the previewed cleanups (LFC-05, CON-10, TS §18 residue): read-only listing, then two scopes.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

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

  it("refuses while a review or analyst reservation is open, because the packet would vanish under it", async () => {
    const p = fresh();
    const h = await withTemp(p);
    const r = await p.call("decide", { h, kind: "cleanup", target: "project", answers: { "cleanup-confirm": "yes" } });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "work-busy");
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
    const selection = p.ports().store.cleanTemp("machine", 2 * 3600_000, false);
    assert.deepEqual(readdirSync(tmpdir()).filter((name) => name.startsWith("tenet-ws_")).sort(), before);
    assert.deepEqual([existsSync(stale), existsSync(recent), existsSync(other), existsSync(busy)], [true, true, true, true]);
    assert.deepEqual([recent, other, busy].map((dir) => selection.removed.includes(dir)), [false, false, false]);
    assert.deepEqual({ selected: selection.removed.includes(stale), retained: selection.kept.includes(stale) }, { selected: false, retained: true });
  });

  it("refuses an unknown scope", async () => {
    const p = fresh();
    const h = await open(p);
    assert.equal((await p.call("decide", { h, kind: "cleanup", target: "everything" })).exit, 2);
  });
});
