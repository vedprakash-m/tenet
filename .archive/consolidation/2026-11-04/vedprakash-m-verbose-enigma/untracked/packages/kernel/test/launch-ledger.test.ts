// Launch ledger and the proof-validity fence, pure candidate slice (config-completion 18.2 to 18.4, 20.1 to 20.3). The runner handshake,
// Tx.launch, per-launch ownership directories and stop/recovery enumeration of real processes are not built; this proves the rules they
// must obey.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AccountingCheckpoint2, LaunchEvent } from "../src/core/schemas.ts";
import type { LaunchEvent as Event } from "../src/core/schemas.ts";
import { newBudget, recordLaunchedChecks } from "../src/core/budget.ts";
import { allocateJob, allocateLaunch, eligibility, foldLedger, ownershipSet, recoveredStamp, recoverPrepared,
  settleAccountingCheckpoint, settleJob } from "../src/core/budget-launch.ts";
import { upcastState1 } from "../src/core/schemas-upcast.ts";
import { pristineProblems } from "../src/core/schemas-migrate.ts";
import { ctx } from "./support/migration-ctx.ts";
import { H, state1 } from "./support/schema1-fixtures.ts";

const WS = "ws_aaaaaaaaaa";
const owner = { work: { workspaceId: WS, work: "wk_1" }, generation: 1, runId: "run-1" };
const job = { workspaceId: WS, jobSeq: 1 };
const key = (ordinal: number) => ({ job, ordinal });
const prepared = (ordinal: number, obligations: string[], extra: Partial<Extract<Event, { phase: "prepared" }>> = {}): Event => ({
  kind: "launch", version: 2, key: key(ordinal), owner, phase: "prepared", issuedBinding: { hash: H("a"), serial: 0 }, checkInputId: "cid",
  stage: "candidate", scope: "targeted", commandKind: "tests", obligations, ...extra,
});
const at = (ordinal: number, phase: "starting" | "launched"): Event => ({ kind: "launch", version: 2, key: key(ordinal), owner, phase });
const none = (ordinal: number,
  cause: "cancelled-before-start" | "refused-before-start" | "spawn-failed-no-child"): Event => ({ kind: "launch", version: 2,
    key: key(ordinal), owner, phase: "no-launch", cause });
const settlement = { key: job, owner, allocatedThrough: 0, settledThrough: 0, settledUnits: 0, closed: false };
const allocated = (through: number) => ({ ...settlement, allocatedThrough: through });
const ok = (events: Event[]) => { const f = foldLedger(events); assert.deepEqual(f.issues, []); return f; };

describe("the launch event union is exact", () => {
  it("accepts each phase and rejects extra keys, a missing cause, a repeated obligation and a positional ordinal", () => {
    for (const e of [prepared(1, ["OB-1"]), at(1, "starting"), at(1, "launched"), none(1,
      "cancelled-before-start")]) assert.equal(LaunchEvent.safeParse(e).success, true);
    assert.equal(LaunchEvent.safeParse({ ...at(1, "starting"), argv: ["x"] }).success, false);
    assert.equal(LaunchEvent.safeParse({ ...none(1, "refused-before-start"), cause: undefined }).success, false);
    assert.equal(LaunchEvent.safeParse(prepared(1, ["OB-1", "OB-1"])).success, false);
    assert.equal(LaunchEvent.safeParse({ ...at(1, "launched"), key: { job, ordinal: 0 } }).success, false);
    assert.equal(LaunchEvent.safeParse({ ...prepared(1, []), env: {} }).success, false);
  });
});

describe("legal transitions and identity", () => {
  it("allows prepared -> starting -> launched, prepared -> no-launch, starting -> no-launch only for a spawn that made no child", () => {
    ok([prepared(1, ["OB-1"]), at(1, "starting"), at(1, "launched")]);
    ok([prepared(1, ["OB-1"]), none(1, "cancelled-before-start")]);
    ok([prepared(1, ["OB-1"]), at(1, "starting"), none(1, "spawn-failed-no-child")]);
    assert.ok(foldLedger([prepared(1, ["OB-1"]), at(1, "starting"), none(1, "cancelled-before-start")]).issues.length);
    assert.ok(foldLedger([prepared(1, ["OB-1"]), none(1, "spawn-failed-no-child")]).issues.length);
  });
  it("refuses a chain that skips prepared or starting, changes a terminal, or goes backward", () => {
    for (const events of [
      [at(1, "starting")], [prepared(1, ["OB-1"]), at(1, "launched")], [prepared(1, ["OB-1"]), at(1, "starting"), at(1, "launched"),
        none(1, "refused-before-start")],
      [prepared(1, ["OB-1"]), at(1, "starting"), at(1, "launched"), at(1, "starting")],
    ]) assert.ok(foldLedger(events).issues.length, JSON.stringify(events.map((e) => e.phase)));
  });
  it("treats an identical replay as idempotent and the same key with different immutable content as a fence", () => {
    ok([prepared(1, ["OB-1"]), prepared(1, ["OB-1"]), at(1, "starting"), at(1, "starting")]);
    assert.ok(foldLedger([prepared(1, ["OB-1"]), prepared(1, ["OB-2"])]).issues.length);
    assert.ok(foldLedger([prepared(1, ["OB-1"]), prepared(1, ["OB-1"], { stage: "baseline" })]).issues.length);
  });
  it("refuses a gap in the ordinals, a second owner for a job and a record from another workspace", () => {
    assert.ok(foldLedger([prepared(1, []), prepared(3, [])]).issues.length);
    assert.ok(foldLedger([prepared(1, []), { ...prepared(2, []), owner: { ...owner, runId: "other" } }]).issues.length);
    const foreign = { ...prepared(1, []), key: { job: { workspaceId: "ws_bbbbbbbbbb", jobSeq: 1 }, ordinal: 1 } } as Event;
    assert.ok(foldLedger([prepared(1, []), foreign], WS).issues.length);
    const mismatchedOwner = { ...prepared(1, []), owner: { ...owner, work: { workspaceId: "ws_bbbbbbbbbb", work: "wk_1" } } };
    assert.ok(foldLedger([mismatchedOwner]).issues.some((issue) => issue.includes("owner belongs to another workspace")));
  });
});

describe("honest counts and exactly-once settlement", () => {
  it("counts obligation units per known launch, not processes, and nothing for a pre-spawn failure", () => {
    const f = ok([
      prepared(1, ["OB-1", "OB-2", "OB-3"]), at(1, "starting"), at(1, "launched"),
      prepared(2, ["OB-9"]), at(2, "starting"), none(2, "spawn-failed-no-child"),
      prepared(3, []), at(3, "starting"), at(3, "launched"),
    ]);
    const s = settleJob(allocated(3), f, 1);
    assert.equal(s.addUnits, 3);
    assert.deepEqual(s.job, { ...settlement, allocatedThrough: 3, settledThrough: 3, settledUnits: 3 });
    assert.deepEqual(s.unresolved, []);
    assert.equal(s.complete, true);
  });
  it("counts each launched retry of the same obligation again", () => {
    const f = ok([prepared(1, ["OB-1"]), at(1, "starting"), at(1, "launched"), prepared(2, ["OB-1"]), at(2, "starting"), at(2,
      "launched")]);
    assert.equal(settleJob(allocated(2), f, 1).addUnits, 2);
  });
  it("adds only units beyond the settled prefix, so a replayed checkpoint adds nothing", () => {
    const f = ok([prepared(1, ["OB-1", "OB-2"]), at(1, "starting"), at(1, "launched")]);
    const once = settleJob(allocated(1), f, 1);
    const twice = settleJob(once.job, f, 1);
    assert.equal(twice.addUnits, 0);
    assert.deepEqual(twice.job, once.job);
    const b = recordLaunchedChecks(newBudget(), once.addUnits);
    assert.equal(recordLaunchedChecks(b, twice.addUnits).checksLaunched, 2);
  });
  it("publishes launch units and settlement prefix in one checkpoint, idempotently", () => {
    const events = [prepared(1, ["A", "B"]), at(1, "starting"), at(1, "launched"),
      prepared(2, ["C"]), at(2, "starting"), none(2, "spawn-failed-no-child")];
    const checkpoint = AccountingCheckpoint2.parse({
      kind: "accounting", version: 2, t: "2026-11-03T00:00:00.000Z", workspaceId: WS, revision: 1, workSeq: 1,
      generationSeq: 1, complete: true, inFlight: [], recovery: { version: 2, jobSeq: 1, validity: [],
        jobs: [{ ...settlement, allocatedThrough: 2 }] }, entries: [{ work: owner.work.work, generation: owner.generation,
        budget: newBudget() }],
    });
    const once = settleAccountingCheckpoint(checkpoint, events, 1);
    assert.equal(once.settlement.addUnits, 2);
    assert.equal(once.checkpoint.recovery.jobs[0]!.settledThrough, 2);
    assert.equal(once.checkpoint.entries[0]!.budget.checksLaunched, 2);
    const replay = settleAccountingCheckpoint(once.checkpoint, events, 1);
    assert.equal(replay.settlement.addUnits, 0);
    assert.equal(replay.checkpoint.entries[0]!.budget.checksLaunched, 2);
  });
  it("replays a compacted event suffix from the retained settlement prefix without recounting old launches", () => {
    const settledJob = { ...settlement, allocatedThrough: 3, settledThrough: 1, settledUnits: 2 };
    const suffix = [
      { ...prepared(2, ["C"]), key: key(2) }, { ...at(2, "starting"), key: key(2) },
      { ...at(2, "launched"), key: key(2) },
      { ...prepared(3, ["D"]), key: key(3) }, { ...at(3, "starting"), key: key(3) },
      { ...none(3, "spawn-failed-no-child"), key: key(3) },
    ];
    const checkpoint = AccountingCheckpoint2.parse({
      kind: "accounting", version: 2, t: "2026-11-03T00:00:00.000Z", workspaceId: WS, revision: 1, workSeq: 1,
      generationSeq: 1, complete: true, inFlight: [], recovery: { version: 2, jobSeq: 1, validity: [],
        jobs: [settledJob] }, entries: [{ work: owner.work.work, generation: owner.generation,
        budget: { ...newBudget(), checksLaunched: 2 } }],
    });
    const once = settleAccountingCheckpoint(checkpoint, suffix, 1);
    assert.equal(once.settlement.addUnits, 1);
    assert.equal(once.checkpoint.recovery.jobs[0]!.settledThrough, 3);
    assert.equal(once.checkpoint.entries[0]!.budget.checksLaunched, 3);
    const replay = settleAccountingCheckpoint(once.checkpoint, suffix, 1);
    assert.equal(replay.settlement.addUnits, 0);
    assert.equal(replay.checkpoint.entries[0]!.budget.checksLaunched, 3);
    assert.throws(() => settleAccountingCheckpoint(checkpoint, suffix.slice(3), 1), /ledger/);
  });
  it("keeps a hole unresolved and later launches separately visible in a checkpoint", () => {
    const events = [prepared(1, ["A"]), at(1, "starting"),
      prepared(2, ["B", "C"]), at(2, "starting"), at(2, "launched")];
    const checkpoint = AccountingCheckpoint2.parse({
      kind: "accounting", version: 2, t: "2026-11-03T00:00:00.000Z", workspaceId: WS, revision: 1, workSeq: 1,
      generationSeq: 1, complete: true, inFlight: [], recovery: { version: 2, jobSeq: 1, validity: [],
        jobs: [{ ...settlement, allocatedThrough: 2 }] }, entries: [{ work: owner.work.work, generation: owner.generation,
        budget: newBudget() }],
    });
    const result = settleAccountingCheckpoint(checkpoint, events, 1);
    assert.equal(result.checkpoint.entries[0]!.budget.checksLaunched, 0);
    assert.deepEqual(result.settlement.unresolved, [1]);
    assert.equal(result.settlement.beyondHole, 2);
    assert.equal(result.settlement.complete, false);
  });
  it("does not lower an allocated high-water when launch events are missing", () => {
    const persisted = { ...settlement, allocatedThrough: 4 };
    const settled = settleJob(persisted, ok([]), 1);
    assert.equal(settled.job.allocatedThrough, 4);
    assert.equal(settled.job.settledThrough, 0);
    assert.equal(settled.addUnits, 0);
    assert.deepEqual(settled.unresolved, [1, 2, 3, 4]);
    assert.equal(settled.complete, false);
  });
  it("refuses a terminal event beyond the durably allocated launch prefix", () => {
    const checkpoint = AccountingCheckpoint2.parse({
      kind: "accounting", version: 2, t: "2026-11-03T00:00:00.000Z", workspaceId: WS, revision: 1, workSeq: 1,
      generationSeq: 1, complete: true, inFlight: [], recovery: { version: 2, jobSeq: 1, validity: [],
        jobs: [{ ...settlement, allocatedThrough: 1 }] }, entries: [{ work: owner.work.work, generation: owner.generation,
        budget: newBudget() }],
    });
    const issued = [prepared(1, ["A"]), at(1, "starting"), at(1, "launched")];
    const unallocated = { ...prepared(2, ["B"]), key: key(2) };
    assert.throws(() => settleAccountingCheckpoint(checkpoint, [...issued, unallocated], 1), /allocation|allocated|ordinal/i);
    assert.equal(checkpoint.recovery.jobs[0]!.allocatedThrough, 1);
    assert.equal(checkpoint.entries[0]!.budget.checksLaunched, 0);
  });
  it("leaves a hole unsettled: later known launches are reported separately and never invented away", () => {
    const f = ok([prepared(1, ["OB-1"]), at(1, "starting"), prepared(2, ["OB-2", "OB-3"]), at(2, "starting"), at(2, "launched")]);
    const s = settleJob(allocated(2), f, 1);
    assert.equal(s.addUnits, 0);
    assert.equal(s.job.settledThrough, 0);
    assert.equal(s.beyondHole, 2);
    assert.deepEqual(s.unresolved, [1]);
    assert.equal(s.complete, false);
    const later = ok([...f.events, none(1, "spawn-failed-no-child")]);
    const resolved = settleJob(s.job, later, 1);
    assert.equal(resolved.addUnits, 2);
    assert.equal(resolved.job.settledThrough, 2);
    assert.equal(resolved.complete, true);
  });
  it("closes a prepared-only chain as no launch on recovery, because spawning always requires starting first", () => {
    const f = ok([prepared(1, ["OB-1"]), prepared(2, ["OB-2"]), at(2, "starting")]);
    const closed = recoverPrepared(f);
    assert.deepEqual(closed.map((e) => [e.key.ordinal, e.phase]), [[1, "no-launch"]]);
    assert.equal(closed[0]!.phase === "no-launch" && closed[0]!.cause, "cancelled-before-start");
  });
  it("allocates launch ordinals monotonically before preparation and refuses a closed job", () => {
    const first = allocateLaunch(settlement);
    const second = allocateLaunch(first.job);
    assert.deepEqual(first.key, { job, ordinal: 1 });
    assert.deepEqual(second.key, { job, ordinal: 2 });
    assert.equal(second.job.allocatedThrough, 2);
    assert.throws(() => allocateLaunch({ ...second.job, closed: true }), /closed/);
    assert.throws(() => allocateLaunch({ ...settlement, allocatedThrough: Number.MAX_SAFE_INTEGER }), /exhaust/);
  });
  it("refuses to settle a checkpoint when launch ownership is ambiguous or invalid", () => {
    const checkpoint = AccountingCheckpoint2.parse({
      kind: "accounting", version: 2, t: "2026-11-03T00:00:00.000Z", workspaceId: WS, revision: 1, workSeq: 1,
      generationSeq: 1, complete: true, inFlight: [], recovery: { version: 2, jobSeq: 1, validity: [],
        jobs: [{ ...settlement, allocatedThrough: 1 }] }, entries: [{ work: owner.work.work, generation: owner.generation,
        budget: newBudget() }],
    });
    assert.throws(() => settleAccountingCheckpoint(checkpoint, [at(1, "starting")], 1), /ledger/);
    assert.throws(() => settleAccountingCheckpoint(checkpoint, [prepared(1, ["A"]), at(1, "starting"), at(1, "launched")], 2),
      /job 2/);
  });
  it("names each owned launch by job and ordinal, including one beyond a hole, but excludes prepared-only and no-launch entries", () => {
    const f = ok([
      prepared(1, ["A"]), at(1, "starting"), prepared(2, ["B"]), at(2, "starting"), at(2, "launched"), prepared(3, ["C"]),
      prepared(4, ["D"]), none(4, "refused-before-start"), prepared(5, ["E"]), at(5, "starting"), none(5, "spawn-failed-no-child"),
    ]);
    assert.deepEqual(ownershipSet(f), [{ key: key(1), owner }, { key: key(2), owner }]);
  });
  it("enumerates retained ownership from every job without conflating equal ordinals", () => {
    const otherJob = { workspaceId: WS, jobSeq: 2 };
    const otherOwner = { ...owner, runId: "run-2" };
    const events = [
      prepared(1, ["A"]), at(1, "starting"),
      { ...prepared(1, ["B"]), key: { job: otherJob, ordinal: 1 }, owner: otherOwner },
      { ...at(1, "starting"), key: { job: otherJob, ordinal: 1 }, owner: otherOwner },
    ];
    assert.deepEqual(ownershipSet(ok(events)), [
      { key: key(1), owner },
      { key: { job: otherJob, ordinal: 1 }, owner: otherOwner },
    ]);
  });
  it("allocates job numbers above the durable high-water, never reusing one", () => {
    const base = { version: 2 as const, jobSeq: 4, validity: [], jobs: [] };
    const a = allocateJob(base, owner);
    assert.equal(a.key.jobSeq, 5);
    assert.equal(a.recovery.jobSeq, 5);
    assert.deepEqual(a.recovery.jobs.map((j) => j.key.jobSeq), [5]);
    assert.equal(allocateJob(a.recovery, owner).key.jobSeq, 6);
    assert.throws(() => allocateJob({ ...base, jobSeq: Number.MAX_SAFE_INTEGER }, owner), /exhaust/);
  });
});

describe("the proof-validity fence", () => {
  const t = () => upcastState1(state1(), ctx);
  it("is current only when the work's stamp equals the durable floor, and unavailable without one", () => {
    const s = t();
    assert.deepEqual(eligibility(s, false), { wk_1: "current", wk_2: "current" });
    const noFloor = { ...s, recovery: { ...s.recovery, validity: s.recovery.validity.filter((v) => v.key.work !== "wk_2") } };
    assert.equal(eligibility(noFloor, false).wk_2, "unavailable");
  });
  it("holds proof back when a newer floor exists, however readable the primary is: a checkpoint without its state", () => {
    const s = t();
    const newer = { ...s, recovery: { ...s.recovery, validity: s.recovery.validity.map((v) => (v.key.work === "wk_1" ? { ...v,
      hash: H("b"), serial: 1 } : v)) } };
    assert.deepEqual(eligibility(newer, false), { wk_1: "fence-pending", wk_2: "current" });
  });
  it("holds proof back when validity floors are duplicated and rejects that state for rollback", () => {
    const s = t();
    const duplicate = { ...s, recovery: { ...s.recovery, validity: [...s.recovery.validity, s.recovery.validity[0]!] } };
    assert.equal(eligibility(duplicate, false).wk_1, "fence-pending");
    assert.ok(pristineProblems(duplicate, "").includes("a validity floor is duplicated"));
  });
  it("never calls a view recovered from the previous state current, and a floor above the stamp survives a return to the first configuration", () => {
    const s = t();
    assert.deepEqual(eligibility(s, true), { wk_1: "fence-pending", wk_2: "fence-pending" });
  });
  it("allocates a recovered stamp above every retained serial and refuses to guess without a source", () => {
    assert.deepEqual(recoveredStamp(H("a"), [0, 3, 1]), { hash: H("a"), serial: 4 });
    assert.deepEqual(recoveredStamp(H("a"), [0]), { hash: H("a"), serial: 1 });
    assert.throws(() => recoveredStamp(H("a"), []), /no retained serial/);
    assert.throws(() => recoveredStamp(H("a"), [Number.MAX_SAFE_INTEGER]), /exhaust/);
  });
});
