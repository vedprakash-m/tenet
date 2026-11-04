// The journal call record as an ENG-09 trace event (TS §16): fields the kernel observes, declared gaps for the rest.
// These tests are pure; the journal-level tests that run real verbs are in trace-journal.test.ts.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECK_OUTCOME, PERMISSION, ROLE, TERMINATION, TRACE_GAPS, traceFields } from "../src/core/trace.ts";
import type { TraceFacts } from "../src/core/trace.ts";
import { emptyState } from "../src/core/state.ts";
import { stamp } from "../src/pipeline-render.ts";

const facts = (over: Partial<TraceFacts> = {}): TraceFacts => ({
  label: "W-0001", intentRevision: 3, startedAt: "2026-11-03T09:00:00.000Z", endedAt: "2026-11-03T09:00:02.500Z",
  verb: "decide", exit: 0, reasons: [], final: true, ...over,
});

describe("trace fields: what the kernel observes [ENG-09]", () => {
  it("links work, intent revision, start time, duration and termination", () => {
    const f = traceFields(facts());
    assert.equal(f.work, "W-0001");
    assert.equal(f.intentRevision, 3);
    assert.equal(f.startedAt, "2026-11-03T09:00:00.000Z");
    assert.equal(f.durationMs, 2500);
    assert.equal(f.termination, "completed");
  });

  it("omits work when the call has no contract, and never invents one", () => {
    assert.equal("work" in traceFields(facts({ label: undefined })), false);
  });

  it("never reports a negative duration when the clock ran backwards", () => {
    assert.equal(traceFields(facts({ endedAt: "2026-11-03T08:00:00.000Z" })).durationMs, 0);
  });

  it("maps termination from the observed exit and reasons", () => {
    assert.equal(traceFields(facts({ reasons: [{ code: "timeout" }] })).termination, "timeout");
    assert.equal(traceFields(facts({ exit: 2, reasons: [{ code: "run-superseded" }] })).termination, "cancelled");
    assert.equal(traceFields(facts({ exit: 5 })).termination, "crashed");
    assert.equal(traceFields(facts({ exit: 3 })).termination, "completed", "a question or refusal is a completed call");
  });

  it("writes no termination or check outcome for a provisional record of a job that has not ended", () => {
    const f = traceFields(facts({ verb: "check", final: false, receipts: [{ status: "pass" }] }));
    assert.equal("termination" in f, false);
    assert.equal("checkOutcome" in f, false);
  });
});

describe("trace fields: check outcome [ENG-09]", () => {
  const outcome = (statuses: string[], verb = "check") =>
    traceFields(facts({ verb, receipts: statuses.map((status) => ({ status })) })).checkOutcome;

  it("is the worst receipt status of a check call", () => {
    assert.equal(outcome(["pass", "pass"]), "pass");
    assert.equal(outcome(["pass", "fail", "inconclusive"]), "fail");
    assert.equal(outcome(["pass", "inconclusive"]), "inconclusive");
    assert.equal(outcome(["skipped"]), "skipped");
    assert.equal(outcome([]), "skipped");
  });

  it("is absent when the call ran no check", () => {
    assert.equal(outcome(["pass"], "decide"), undefined);
    assert.equal("checkOutcome" in traceFields(facts({ verb: "check" })), false, "no receipts reported");
  });
});

describe("trace fields: declared visibility gaps [ENG-09]", () => {
  it("writes role, model and permission as the explicit value unknown and names each as a gap", () => {
    const f = traceFields(facts());
    assert.equal(f.role, "unknown");
    assert.equal(f.model, "unknown");
    assert.equal(f.permission, "unknown");
    assert.deepEqual(f.visibilityGaps, ["role", "model", "permission"]);
  });

  it("registers every vocabulary as a closed set and writes only members", () => {
    assert.deepEqual(Object.keys(TERMINATION), ["completed", "cancelled", "timeout", "crashed"]);
    assert.deepEqual(Object.keys(CHECK_OUTCOME), ["pass", "fail", "inconclusive", "skipped"]);
    assert.deepEqual(Object.keys(PERMISSION), ["approved", "auto-approved", "denied", "unknown"]);
    assert.deepEqual(Object.keys(ROLE), ["coordinator", "reviewer", "analyst", "unknown"]);
    assert.deepEqual(Object.keys(TRACE_GAPS), ["role", "model", "permission"]);
    const f = traceFields(facts({ verb: "check", receipts: [{ status: "fail" }] }));
    assert.ok(Object.hasOwn(TERMINATION, String(f.termination)) && Object.hasOwn(CHECK_OUTCOME, String(f.checkOutcome)));
    assert.ok(Object.hasOwn(PERMISSION, String(f.permission)) && Object.hasOwn(ROLE, String(f.role)));
  });
});

describe("trace fields carry no content [SEC-11]", () => {
  it("copies no reason text, receipt detail, command output or free text into the record", () => {
    const secret = "ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789";
    const f = traceFields(facts({
      verb: "check",
      reasons: [{ code: "evidence-failed", message: `token=${secret}` } as never],
      receipts: [{ status: "fail", failures: [{ message: `stdout: ${secret}` }], reasons: ["export const x = 1"] } as never],
    }));
    const text = JSON.stringify(f);
    assert.ok(!text.includes(secret) && !text.includes("export const"));
    assert.deepEqual(Object.keys(f).sort(), [
      "checkOutcome", "durationMs", "intentRevision", "model", "permission", "role", "startedAt", "termination", "visibilityGaps", "work",
    ]);
  });
});

describe("the pipeline writes the trace fields into the call record [ENG-09]", () => {
  it("stamp passes the observed times, intent revision and gaps to the journal", () => {
    const calls: Record<string, unknown>[] = [];
    const tx = { state: null, publish: () => {}, call: (e: Record<string, unknown>) => calls.push(e) };
    const ports = { clock: { now: () => "2026-11-03T09:00:03.000Z", ms: () => 0 }, version: "0.0.0" };
    const base = emptyState("ws_x", "tag1");
    const next = { ...base, project: { ...base.project, intent: { ...base.project.intent, revision: 7 } } };
    stamp(ports as never, { name: "inspect" } as never, {}, null, tx as never, next, { exit: 0 }, true, "2026-11-03T09:00:00.000Z");
    assert.deepEqual(calls, [{
      verb: "inspect", exit: 0, revision: 1, intentRevision: 7, startedAt: "2026-11-03T09:00:00.000Z", durationMs: 3000,
      termination: "completed", role: "unknown", model: "unknown", permission: "unknown", visibilityGaps: ["role", "model", "permission"],
    }]);
  });
});
