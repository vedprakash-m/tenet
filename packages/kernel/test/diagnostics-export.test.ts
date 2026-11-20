// The diagnostics export (NFR-07): built only on request, a redacted projection, previewed whole, never sent or saved.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { DiagnosticsV2, diagnosticsExport, EXPORT_BYTES } from "../src/core/diagnostics.ts";
import { sha256 } from "../src/core/ids.ts";
import { KernelError } from "../src/core/errors.ts";
import { emptyState } from "../src/core/state.ts";
import type { LogEntry } from "../src/ports/types.ts";
import { KernelResponse, Receipt } from "../src/core/schemas.ts";
import type { State } from "../src/core/schemas.ts";
import { cleanup } from "./helpers.ts";
import { contractFixture, project } from "./support/fixture.ts";

const FAKE = ["ghp", "x".repeat(36)].join("_"); // a fake token shape, assembled so no literal sits in the source
const VERBS = ["open", "check", "decide", "inspect"];
const NOTICE = "Likely secrets are redacted. Detection is incomplete; a clean preview is not proof that no secret is present.";
const NOTE = `Nothing has been sent or saved. ${NOTICE}`;
const call = (n: number, extra: Record<string, unknown> = {}): LogEntry =>
  ({ t: `2026-11-10T00:00:${String(n % 60).padStart(2, "0")}Z`, kind: "call", verb: "check", exit: 0, revision: n, ...extra });
const build = (log: LogEntry[], state: State | null = null) =>
  diagnosticsExport({ version: "0.1.0", platform: "linux", node: "v24.0.0", state, log, verbs: VERBS });

const closedResponse = () => ({
  verb: "inspect", exit: 0, revision: 0, reasons: [], next: [],
  budget: { attempts: "0/4", rounds: "0/2", delegations: "0/3" },
});
const HISTORICAL = "This is the previously rendered response for the same admitted input and world. It is not fresher evidence.";

it("preserves structured privacy and historical disclosures through response parsing [SEC-11]", () => {
  const response = {
    ...closedResponse(), historical: true, historicalNotice: HISTORICAL,
    privacy: { redaction: "structured-likely", detection: "incomplete", paths: "excluded-marker", notice: NOTICE },
  };
  assert.deepEqual(KernelResponse.parse(response), response);
  assert.deepEqual(KernelResponse.parse(closedResponse()), closedResponse());
});

it("rejects altered or undeclared response disclosure fields [SEC-11]", () => {
  const privacy = { redaction: "structured-likely", detection: "incomplete", paths: "none", notice: NOTICE };
  for (const changed of [
    { ...privacy, detection: "complete" }, { ...privacy, notice: "No secrets were found." },
    { ...privacy, paths: "synthetic path" }, { ...privacy, syntheticUnknown: true },
  ]) assert.equal(KernelResponse.safeParse({ ...closedResponse(), privacy: changed }).success, false);
  assert.equal(KernelResponse.safeParse({
    ...closedResponse(), historical: true, historicalNotice: "This is fresh evidence.",
  }).success, false);
});

describe("diagnostics export", () => {
  it("keeps closed-set call fields and leaves out free text, paths and effect bodies", () => {
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

  it("never exports outcome or request text from the state", () => {
    const out = build([], emptyState("ws", "k7q"));
    assert.equal(JSON.parse(out.text).state.initialized, true);
    assert.ok(!out.text.includes("purpose"));
  });

  it("omits an unproven cookie-shaped label before serialization [NFR-07] [SEC-11]", () => {
    const state = emptyState("ws", "k7q");
    // The legacy schema accepts this string; it is not a closed diagnostics field.
    const work = contractFixture({ label: "Cookie: unproven-label" });
    state.work[work.id] = work;
    const out = build([], state);
    const bundle = JSON.parse(out.text);
    assert.ok(!out.text.includes("unproven"));
    assert.deepEqual(bundle.work, []);
    assert.deepEqual(bundle.state.byState, { [work.state]: 1 });
  });

  it("counts only closed receipt kinds without exporting legacy details [NFR-07] [SEC-11]", () => {
    const state = emptyState("ws", "k7q");
    const legacy = Receipt.parse({
      id: "RC-1", obligation: "OB-1", kind: "Cookie: unproven-kind", stage: "candidate",
      source: "kernel-run", checkInputId: "legacy-unavailable", scope: "full", argv: [], cwd: ".",
      durationMs: 1, versions: { tool: "1", reporter: "1", adapter: "1" },
      provenance: { runId: "1", runDir: "unproven-path", startedAt: "2026-11-19T00:00:00Z" },
      status: "fail", qualifiers: [], reasons: [], limitations: ["unproven-detail"], candidate: "legacy-unavailable",
    });
    const work = contractFixture({
      label: "W-0001", receipts: [legacy, { ...legacy, id: "RC-2", kind: "test" }],
    });
    state.work[work.id] = work;
    const out = build([], state);
    assert.deepEqual(JSON.parse(out.text).work[0].receipts, { "test:fail": 1 });
    assert.ok(!out.text.includes("unproven"));
  });

  it("embeds the v2 disclosure and hashes the exact returned UTF-8 bytes [NFR-07] [SEC-11]", () => {
    const out = build([call(1)]);
    const bundle = JSON.parse(out.text);
    assert.deepEqual(bundle.format, { name: "tenet.diagnostics", version: 2 });
    assert.deepEqual(bundle.privacy, {
      redaction: "structured-likely", detection: "incomplete", paths: "none", notice: NOTICE,
      operational: "Nothing has been sent or saved.",
    });
    assert.equal(bundle.note, NOTE);
    assert.equal(DiagnosticsV2.safeParse(bundle).success, true);
    assert.equal(out.note, NOTE);
    assert.equal(out.bundleHash, sha256(out.text));
    assert.equal(out.bytes, Buffer.byteLength(out.text, "utf8"));
    assert.equal(out.text.endsWith("\n"), true);
    assert.equal(out.text.endsWith("\n\n"), false);
  });

  it("omits unregistered effect names and separates invalid from truncated calls [NFR-07] [SEC-11]", () => {
    const out = build([
      call(1, { verb: "Cookie: unproven-verb" }),
      { t: "2026-11-10T00:00:03Z", kind: "Cookie: unproven-effect" } as unknown as LogEntry,
      call(2, { revision: Number.MAX_SAFE_INTEGER + 1 }),
    ]);
    const bundle = JSON.parse(out.text);
    assert.deepEqual(bundle.effects, {});
    assert.deepEqual(bundle.dropped, { calls: 2 });
    assert.deepEqual(bundle.truncated, { calls: 0, work: 0, value: false });
    assert.ok(!out.text.includes("unproven"));
  });

  it("refuses headers outside the closed version/platform domain [NFR-07] [SEC-11]", () => {
    for (const extra of [{ version: "Cookie: unproven" }, { node: "v024.0.0" }, { platform: "not-an-os" }]) {
      assert.throws(() => diagnosticsExport({
        version: "0.1.0", platform: "linux", node: "v24.0.0", state: null, log: [], verbs: VERBS, ...extra,
      }), (error: unknown) => error instanceof KernelError &&
        error.exit === 2 && error.reasons[0]?.code === "capability-missing" && !error.message.includes("unproven"));
    }
  });

  it("stays within the size cap and reports what it left out", () => {
    const log = Array.from({ length: 300 }, (_, i) => call(i));
    const out = build(log);
    assert.ok(out.bytes <= EXPORT_BYTES);
    const bundle = JSON.parse(out.text);
    assert.ok(bundle.calls.length <= 40);
    assert.equal(bundle.truncated.calls, 300 - bundle.calls.length);
    assert.equal(bundle.calls.at(-1).revision, 299);
  });

  it("removes oldest calls then work until serialized bytes fit, preserving JSON [NFR-07] [SEC-11]", () => {
    const state = emptyState("ws", "k7q");
    for (let n = 0; n < 12; n++) {
      state.work[`wk-${n}`] = contractFixture({ id: `wk-${n}`, label: `W-${String(n).padStart(4, "0")}${"0".repeat(2000)}` });
    }
    const out = build(Array.from({ length: 42 }, (_, n) => call(n)), state);
    const bundle = JSON.parse(out.text);
    assert.ok(out.bytes <= EXPORT_BYTES);
    assert.equal(bundle.calls.length, 0);
    assert.ok(bundle.work.length > 0 && bundle.work.length < 10);
    assert.equal(bundle.work.at(-1).label, state.work["wk-11"]!.label);
    assert.deepEqual(bundle.truncated, { calls: 42, work: 12 - bundle.work.length, value: true });
    assert.equal(out.bundleHash, sha256(out.text));
  });

  it("admits exactly the byte ceiling and removes a row one byte over [NFR-07] [SEC-11]", () => {
    const state = emptyState("ws", "k7q");
    const work = contractFixture({ label: "W-0001" });
    state.work[work.id] = work;
    work.label += "0".repeat(EXPORT_BYTES - build([], state).bytes);
    const exact = build([], state);
    assert.equal(exact.bytes, EXPORT_BYTES);
    assert.equal(JSON.parse(exact.text).work.length, 1);
    assert.equal(DiagnosticsV2.safeParse(JSON.parse(exact.text)).success, true);
    work.label += "0";
    const over = build([], state);
    assert.ok(over.bytes < EXPORT_BYTES);
    assert.deepEqual(JSON.parse(over.text).work, []);
    assert.deepEqual(over.truncated, { calls: 0, work: 1, value: true });
  });

  const roots: string[] = [];
  after(() => roots.forEach(cleanup));

  it("inspect --view export previews the bundle and writes nothing into the project", async () => {
    const p = project({ "README.md": "hello\n" });
    roots.push(p.root);
    const before = readdirSync(p.root).sort();
    const r = await p.call("inspect", { view: "export" });
    assert.equal(r.exit, 0);
    const data = r.data as { text: string; bundleHash: string; note: string };
    assert.equal(JSON.parse(data.text).format.name, "tenet.diagnostics");
    assert.match(data.bundleHash, /^[0-9a-f]{64}$/);
    assert.equal(data.note, NOTE);
    assert.deepEqual(readdirSync(p.root).sort(), before);
    const other = await p.call("inspect", { view: "export", topic: "evidence" });
    assert.equal(other.exit, 1);
  });
});
