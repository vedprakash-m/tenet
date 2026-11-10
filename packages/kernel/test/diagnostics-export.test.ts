// The diagnostics export (NFR-07): built only on request, a redacted projection, previewed whole, never sent or saved.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { diagnosticsExport, EXPORT_BYTES } from "../src/core/diagnostics.ts";
import { emptyState } from "../src/core/state.ts";
import type { LogEntry } from "../src/ports/types.ts";
import type { State } from "../src/core/schemas.ts";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";

const FAKE = ["ghp", "x".repeat(36)].join("_"); // a fake token shape, assembled so no literal sits in the source
const VERBS = ["open", "check", "decide", "inspect"];
const call = (n: number, extra: Record<string, unknown> = {}): LogEntry =>
  ({ t: `2026-11-10T00:00:${String(n % 60).padStart(2, "0")}Z`, kind: "call", verb: "check", exit: 0, revision: n, ...extra });
const build = (log: LogEntry[], state: State | null = null) =>
  diagnosticsExport({ version: "0.1.0", platform: "linux", node: "v24.0.0", state, log, verbs: VERBS });

describe("diagnostics export [NFR-07]", () => {
  it("[NFR-07] keeps closed-set call fields and leaves out free text, paths and effect bodies", () => {
    const log: LogEntry[] = [
      call(1, { work: "W-0001", durationMs: 12, note: `token=${FAKE}` }),
      call(2, { verb: "not-a-verb" }),
      { t: "2026-11-10T00:00:03Z", kind: "intent", effect: "write", id: "x", op: { path: "src/secret-plans.ts" } },
    ];
    const out = build(log);
    assert.ok(!out.text.includes("ghp_"), "unlisted fields are not exported");
    assert.ok(!out.text.includes("secret-plans"), "effect bodies are left out");
    const bundle = JSON.parse(out.text);
    assert.deepEqual(bundle.calls, [{ t: "2026-11-10T00:00:01Z", verb: "check", exit: 0, revision: 1, work: "W-0001", durationMs: 12 }]);
    assert.equal(bundle.dropped.calls, 1);
    assert.deepEqual(bundle.effects, { intent: 1 });
    assert.match(out.note, /Nothing has been sent or saved/);
  });

  it("[NFR-07] never exports outcome or request text from the state", () => {
    const out = build([], emptyState("ws", "k7q"));
    assert.equal(JSON.parse(out.text).state.initialized, true);
    assert.ok(!out.text.includes("purpose"));
  });

  it("[NFR-07] stays within the size cap and reports what it left out", () => {
    const log = Array.from({ length: 300 }, (_, i) => call(i));
    const out = build(log);
    assert.ok(out.bytes <= EXPORT_BYTES);
    const bundle = JSON.parse(out.text);
    assert.ok(bundle.calls.length <= 40);
    assert.equal(bundle.truncated.calls, 300 - bundle.calls.length);
    assert.equal(bundle.calls.at(-1).revision, 299);
  });

  const roots: string[] = [];
  after(() => roots.forEach(cleanup));

  it("[NFR-07] inspect --view export previews the bundle and writes nothing into the project", async () => {
    const p = project({ "README.md": "hello\n" });
    roots.push(p.root);
    const before = readdirSync(p.root).sort();
    const r = await p.call("inspect", { view: "export" });
    assert.equal(r.exit, 0);
    const data = r.data as { text: string; bundleHash: string; note: string };
    assert.equal(JSON.parse(data.text).format.name, "tenet.diagnostics");
    assert.match(data.bundleHash, /^[0-9a-f]{64}$/);
    assert.match(data.note, /save this text to a file you choose/);
    assert.deepEqual(readdirSync(p.root).sort(), before);
    const other = await p.call("inspect", { view: "export", topic: "evidence" });
    assert.equal(other.exit, 1);
  });
});
