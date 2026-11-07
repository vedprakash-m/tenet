import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, it } from "node:test";
import { diagnosticsText, redactDiagnostics } from "../src/core/diagnostics.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { settleDiagnostics } from "../src/verbs/diagnostics.ts";
import type { Recovery } from "../src/verbs/recover-effects.ts";
import { cleanup, initState, tmp } from "./helpers.ts";
import type { LogEntry } from "../src/ports/types.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const rig = () => { const root = tmp(); roots.push(root); return { root, ports: createPorts(root) }; };
const call = (ports: ReturnType<typeof createPorts>, input = {}) => runVerb(ports, VERBS, "diagnostics", input);
const data = (r: Awaited<ReturnType<typeof call>>) => r.data as { text: string; hash: string; bytes: number; saved?: string };
const log = (n: number): LogEntry[] => Array.from({ length: n }, (_, i) => ({
  kind: "call", t: "2026-11-07T00:00:00.000Z", verb: "check", exit: 0, revision: i,
  durationMs: i, termination: "completed", request: "NEVER-COPY", token: ["NEVER", "COPY"].join("-"),
}));

it("previews without creating state or files, and help names explicit save [NFR-07]", async () => {
  const { root, ports } = rig();
  const a = await call(ports), b = await call(ports);
  assert.equal(a.exit, 0);
  assert.deepEqual(data(a), data(b));
  assert.equal(existsSync(join(root, ".tenet")), false);
  assert.equal(JSON.parse(data(a).text).state.initialized, false);
  const help = await runVerb(ports, VERBS, "inspect", { view: "help" });
  assert.match(JSON.stringify(help.data), /diagnostics.*--save/);
});

it("projects only bounded known facts, discloses omissions and unknown provenance [NFR-07]", () => {
  const entries = log(5000);
  entries.push({ kind: "call", t: "bad", verb: "NEVER-COPY", exit: 9 });
  const result = diagnosticsText(null, entries, "1.0.0", "linux", Object.keys(VERBS));
  assert.ok(Buffer.byteLength(result) <= 4000);
  assert.ok(!result.includes("NEVER-COPY"));
  const parsed = JSON.parse(result);
  assert.deepEqual(Object.keys(parsed), ["format", "kernel", "state", "calls", "omitted", "provenance", "redaction"]);
  assert.ok(parsed.omitted.calls >= 4980);
  assert.equal(parsed.omitted.invalidCalls, 1);
  assert.equal(parsed.calls.at(-1).revision, 4999);
  assert.equal(parsed.provenance.host, "unknown");
});

it("redacts fixed key/token/credential/path/email categories without changing global redaction [NFR-07]", () => {
  const token = "ghp_" + "a".repeat(36);
  const personalPaths = ["C:", "Users", "Example", "secret"].join("\\") + " " +
    ["/home", "example", "a"].join("/") + " " + ["/Users", "example", "a"].join("/");
  const text = `-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY----- ${token} password=abc123456 ` + // privacy-ok: fake private key redaction control
    `https://user:abc123456@example.com ${personalPaths} person@example.com`;
  const redacted = redactDiagnostics(text);
  for (const secret of [token, "abc123456", "Example", "/home/example", "/Users/example", "person@example.com", "\nprivate\n"])
    assert.ok(!redacted.includes(secret), secret);
});

it("refuses missing hash and unsafe targets before writes [NFR-07]", async () => {
  const { root, ports } = rig();
  for (const save of [true, "../a.json", "/a.json", "C:\\a.json", ".git/a.json", ".tenet/a.json", "a.txt", "a/../b.json"]) {
    const r = await call(ports, { save, previewHash: "a".repeat(64) });
    assert.notEqual(r.exit, 0);
  }
  assert.notEqual((await call(ports, { save: "a.json" })).exit, 0);
  assert.equal(existsSync(join(root, "a.json")), false);
});

it("saves exact preview bytes privately, never overwrites, and rejects stale previews [NFR-07]",
  { skip: process.platform === "win32" }, async () => {
    const { root, ports } = rig();
    await initState(root);
    const before = readFileSync(join(root, ".tenet", "state"), "utf8");
    const preview = data(await call(ports));
    const saved = await call(ports, { save: "diagnostics.json", previewHash: preview.hash });
    assert.equal(saved.exit, 0, JSON.stringify(saved));
    assert.equal(readFileSync(join(root, "diagnostics.json"), "utf8"), preview.text);
    assert.equal(statSync(join(root, "diagnostics.json")).mode & 0o777, 0o600);
    assert.equal(readFileSync(join(root, ".tenet", "state"), "utf8"), before);
    writeFileSync(join(root, "existing.json"), "human");
    const current = data(await call(ports));
    assert.notEqual((await call(ports, { save: "existing.json", previewHash: current.hash })).exit, 0);
    assert.equal(readFileSync(join(root, "existing.json"), "utf8"), "human");
    await ports.store.transaction("change", async tx => tx.call({ verb: "check", exit: 0, revision: 1 }));
    assert.notEqual((await call(ports, { save: "stale.json", previewHash: current.hash })).exit, 0);
    assert.equal(existsSync(join(root, "stale.json")), false);
    symlinkSync(join(root, "existing.json"), join(root, "link.json"));
    const latest = data(await call(ports));
    assert.notEqual((await call(ports, { save: "link.json", previewHash: latest.hash })).exit, 0);
  });

it("a refused save without state creates no store [NFR-07]", { skip: process.platform === "win32" }, async () => {
  const { root, ports } = rig();
  const preview = data(await call(ports));
  const refused = await call(ports, { save: "a.json", previewHash: preview.hash });
  assert.equal(refused.exit, 2);
  assert.equal(existsSync(join(root, ".tenet")), false);
  assert.equal(existsSync(join(root, "a.json")), false);
});

it("Windows permits previews but keeps the existing mutation refusal for saves [NFR-07]", async () => {
  const { ports } = rig();
  const win = { ...ports, platform: "win32" as const };
  const preview = data(await call(win));
  const response = await call(win, { save: "a.json", previewHash: preview.hash });
  assert.equal(response.exit, 2);
  assert.ok(response.reasons.some(r => r.code === "capability-missing"));
});

it("real killed saves recover absent or complete targets without rewriting or fencing [NFR-07]",
  { skip: process.platform === "win32" }, async () => {
    for (const step of ["intent", "published"]) {
      const { root, ports } = rig();
      await initState(root);
      const child = spawnSync(process.execPath, [join(import.meta.dirname, "fixtures", "crash-diagnostics.ts"), step],
        { cwd: root, encoding: "utf8" });
      assert.equal(child.signal, "SIGKILL", child.stderr);
      const path = join(root, "crash.json");
      assert.equal(existsSync(path), step === "published");
      if (existsSync(path)) assert.ok(Buffer.byteLength(readFileSync(path)) <= 4000);
      const state = ports.store.read()!.state;
      const recovery = await ports.store.transaction("recover-test", async tx => {
        const r: Recovery = { ports, state, tx, completed: [], uncertain: [] };
        for (const u of tx.unresolved()) await settleDiagnostics(r, u);
        return r;
      });
      assert.deepEqual(recovery.uncertain, []);
      assert.match(recovery.completed.join(" "), step === "published" ? /matching-content/ : /missing/);
      assert.equal(ports.store.readLog().filter(e => e.kind === "result" && e.effect === "diagnostics").length, 1);
    }
  });

it("recovery preserves changed and linked diagnostics targets [NFR-07]",
  { skip: process.platform === "win32" }, async () => {
    for (const linked of [false, true]) {
      const { root, ports } = rig();
      const store = await initState(root);
      const state = store.read()!.state;
      writeFileSync(join(root, "human.json"), "human");
      if (linked) symlinkSync(join(root, "human.json"), join(root, "crash.json"));
      else writeFileSync(join(root, "crash.json"), "changed");
      await store.transaction("recovery-test", async tx => {
        tx.intent("diagnostics", "interrupted", { path: "crash.json", hash: "a".repeat(64) });
        const r: Recovery = { ports, state, tx, completed: [], uncertain: [] };
        await settleDiagnostics(r, tx.unresolved()[0]!);
        assert.match(r.completed.join(" "), linked ? /linked/ : /different-content/);
        assert.deepEqual(r.uncertain, []);
      });
      assert.equal(readFileSync(join(root, "crash.json"), "utf8"), linked ? "human" : "changed");
    }
  });
