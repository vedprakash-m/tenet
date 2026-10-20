import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { cleanup, initState, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const root = tmp(); roots.push(root); return root; };

describe("private store boundaries", () => {
  it("never breaks or repairs a malformed lock based on an invalid process identity [CON-04]", async () => {
    for (const pid of [-1, "42", null]) {
      const root = fresh(), store = await initState(root);
      const bytes = JSON.stringify({ pid, procStart: "unknown", nonce: "untrusted", verb: "untrusted" });
      writeFileSync(join(root, ".tenet/lock"), bytes);
      await assert.rejects(store.transaction("test", async () => undefined), /recovery|identity/i);
      await assert.rejects(store.repairLock(), /recovery|identity/i);
      assert.equal(readFileSync(join(root, ".tenet/lock"), "utf8"), bytes);
    }
  });
  it("refuses a transaction when this process's start identity cannot be inspected [CON-04]", async () => {
    const root = fresh(); await initState(root);
    const result = execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/store-no-ps.ts"), root], { env: { ...process.env, PATH: "/nonexistent" }, encoding: "utf8" });
    assert.deepEqual(JSON.parse(result), { refused: true, code: "capability-missing" });
    assert.equal(existsSync(join(root, ".tenet/lock")), false);
  });
  it("refuses a linked artifact leaf without changing its target [SEC-06]", async () => {
    const root = fresh(), store = await initState(root), dir = store.tempDir("manifests");
    const outside = join(root, "outside"); writeFileSync(outside, "preserve me"); symlinkSync(outside, join(dir, "packet.json"));
    assert.throws(() => store.writeArtifact(dir, "packet.json", "unsafe"));
    assert.equal(readFileSync(outside, "utf8"), "preserve me");
  });
  it("restores private directory and record modes at a mutating boundary [SEC-12]", async () => {
    const root = fresh(), store = await initState(root);
    chmodSync(join(root, ".tenet"), 0o755);
    for (const name of ["marker", "state"]) chmodSync(join(root, ".tenet", name), 0o644);
    await store.transaction("test", async tx => tx.publish(tx.state!));
    assert.equal(statSync(join(root, ".tenet")).mode & 0o777, 0o700);
    for (const name of ["marker", "state", "state.prev"]) assert.equal(statSync(join(root, ".tenet", name)).mode & 0o777, 0o600);
  });
  it("refuses excessive record depth before schema traversal [SEC-06]", async () => {
    const root = fresh(), store = await initState(root);
    const state = JSON.parse(readFileSync(join(root, ".tenet/state"), "utf8"));
    let extension: unknown = "leaf";
    for (let i = 0; i < 70; i++) extension = { next: extension };
    writeFileSync(join(root, ".tenet/state"), JSON.stringify({ ...state, _ext: { extension } }));
    assert.throws(() => store.read(), /cannot be read|unsupported/i);
  });
  it("refuses linked workspace temp storage before artifact writes [SEC-06]", async () => {
    const root = fresh(), outside = fresh(), store = await initState(root);
    const id = store.read()!.state.workspaceId, base = join(tmpdir(), `tenet-${id}`);
    rmSync(base, { recursive: true, force: true });
    symlinkSync(outside, base);
    try {
      assert.throws(() => store.tempDir("run-unsafe"), /link|temp/i);
      assert.equal(existsSync(join(outside, "run-unsafe")), false);
    } finally { rmSync(base); }
    mkdirSync(base, { mode: 0o700 });
    symlinkSync(outside, join(base, "manifests"));
    try {
      assert.throws(() => store.tempDir("manifests/new"), /link|temp/i);
      assert.equal(existsSync(join(outside, "new")), false);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});
