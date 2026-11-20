import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planJournalReduction, shouldSeal } from "../src/core/journal-plan.ts";

const old = "2026-01-01T00:00:00.000Z";
const nowMs = Date.parse("2026-11-19T00:00:00.000Z");
const call = (extra = {}) => ({ t: old, kind: "call", verb: "check", exit: 0, revision: 1, ...extra });
const line = (record: unknown) => JSON.stringify(record) + "\n";
const padding = line(call()).repeat(100);
const pair = (effect: string, id = "op", outcome: unknown = { completed: true, branch: "branch" }) => [
  { t: old, kind: "intent", effect, id, op: { work: "wk_aaaaaaaaaa", from: null, to: "branch" } },
  { t: old, kind: "result", effect, id, outcome },
];
const options = () => ({
  nowMs, days: 90, protectFromRevision: 10, protectedIds: new Set<string>(), protectedPaths: new Set<string>(),
});

describe("schema-3 byte-preserving reduction planner (not durable compaction)", () => {
  it("uses the exact byte trigger, including the equality boundary [AC-19] CT-1", () => {
    assert.equal(shouldSeal(1_999, 2_000), false);
    assert.equal(shouldSeal(2_000, 2_000), true);
    assert.equal(shouldSeal(2_001, 2_000), true);
    assert.throws(() => shouldSeal(-1, 2_000));
  });

  it("reduces 10,000 old reachable calls to exact fixture counts and newest 100 bytes [AC-19] CT-2", () => {
    const text = line(call()).repeat(10_000);
    assert.equal(shouldSeal(Buffer.byteLength(text), 5_000), true);
    const reduced = planJournalReduction([{ id: "generation", text }], options());
    assert.equal(reduced.removed, 9_900);
    assert.equal(reduced.retained[0]?.text, padding);
    assert.deepEqual(reduced.months, {
      "2026-01": {
        calls: { check: 9_900 }, exits: { "0": 9_900 }, intents: 0, results: 0, accounting: 0,
        workSeq: 0, generationSeq: 0,
      },
    });
  });

  it("keeps all publisherless, incomplete and unknown pairs even with an asserted publication [AC-19] CT-23", () => {
    const pairs = ["index-sync", "undo", "dependency", "forget", "unknown", "toString", "__proto__"]
      .flatMap(effect => pair(effect));
    pairs.push(...pair("index-sync", "sync", { status: "synced" }), ...pair("branch", "incomplete", { completed: false }));
    const source = pairs.map(line).join("") + padding;
    const reduced = planJournalReduction([{ id: "generation", text: source }], {
      ...options(), published: () => ({ current: "exact", previous: "exact" }),
    });
    assert.equal(reduced.removed, 0);
    assert.equal(reduced.retained[0]?.text, source);
  });

  it("requires independently exact publication in both copies and protects pair references [AC-19] CT-3 CT-4 CT-5", () => {
    const records = pair("branch"), source = records.map(line).join("") + padding;
    for (const previous of ["unknown", "not-applied"] as const) {
      const reduced = planJournalReduction([{ id: "generation", text: source }], {
        ...options(), published: () => ({ current: "exact", previous }),
      });
      assert.equal(reduced.retained[0]?.text, source);
    }
    const proved = { ...options(), published: () => ({ current: "exact" as const, previous: "exact" as const }) };
    assert.equal(planJournalReduction([{ id: "generation", text: source }], proved).removed, 2);
    proved.protectedIds.add("op");
    assert.equal(planJournalReduction([{ id: "generation", text: source }], proved).removed, 0);
    proved.protectedIds.clear();
    const withPath = [
      { ...records[0], op: { work: "wk_aaaaaaaaaa", from: null, to: "branch", runDir: "protected-run" } }, records[1],
    ].map(line).join("") + padding;
    proved.protectedPaths.add("protected-run");
    assert.equal(planJournalReduction([{ id: "generation", text: withPath }], proved).removed, 0);
  });

  it("never deletes duplicate structured pairs or conflates effect/ID components across generations [AC-19] CT-7", () => {
    const original = pair("branch").map(line).join("");
    const reduced = planJournalReduction([
      { id: "first", text: original }, { id: "second", text: original + padding },
    ], { ...options(), published: () => ({ current: "exact", previous: "exact" }) });
    assert.equal(reduced.removed, 0);
    assert.equal(reduced.retained[0]?.text, original);
    assert.equal(reduced.retained[1]?.text, original + padding);
  });

  it("retains a generation with unknown version/kind/shape and refuses a damaged complete line [AC-19] CT-6", () => {
    for (const unknown of [
      { ...call(), kind: "future" }, { ...call(), version: 2 }, { ...call(), verb: null },
    ]) {
      const source = line(call()) + line(unknown) + padding;
      assert.equal(planJournalReduction([{ id: "g", text: source }], options()).retained[0]?.text, source);
    }
    assert.throws(() => planJournalReduction([{ id: "g", text: '{"kind":\n' + padding }], options()));
    assert.throws(() => planJournalReduction([{ id: "g", text: padding + '{"kind":' }], options()));
  });

  it("protects the old member when its pair mate is recent or among the newest 100 [AC-19] CT-3", () => {
    const records = pair("branch");
    const source = line(records[0]) + padding + line(records[1]);
    const reduced = planJournalReduction([{ id: "generation", text: source }], {
      ...options(), published: () => ({ current: "exact", previous: "exact" }),
    });
    assert.equal(reduced.retained[0]?.text.startsWith(line(records[0])), true);
    assert.equal(reduced.retained[0]?.text.endsWith(line(records[1])), true);
    assert.equal(reduced.removed, 1, "only the one old call outside the newest 100 is reducible");
  });

  it("never infers the age of an invalid accounting timestamp [AC-19] CT-6", () => {
    const record = {
      kind: "accounting", t: "2026-01-NOT-A-DATE", workspaceId: "ws_aaaaaaaaaa", revision: 1,
      workSeq: 20, generationSeq: 30, complete: true, inFlight: [], entries: [],
    };
    const text = line(record) + padding;
    const reduced = planJournalReduction([{ id: "generation", text }], options());
    assert.equal(reduced.removed, 0);
    assert.equal(reduced.retained[0]?.text, text);
  });
  it("protects accounting with unknown nested budget data rather than stripping it [AC-19] CT-6", () => {
    const budget = {
      attempts: 0, reviewRounds: 0, rechecks: 0, reservations: [], delegations: 0, checksLaunched: 0,
      tenetTokens: 0, signatures: [], activeMinutesSinceCheckIn: 0, activeMinutesTotal: 0,
    };
    const accounting = {
      kind: "accounting", t: old, workspaceId: "ws_aaaaaaaaaa", revision: 1,
      workSeq: 20, generationSeq: 30, complete: true, inFlight: [],
      entries: [{ work: "W-1", generation: 1, budget }],
    };
    assert.equal(planJournalReduction([{ id: "g", text: line(accounting) + padding }], options()).removed, 1);
    const changed = { ...accounting, entries: [{ ...accounting.entries[0], budget: { ...budget, futureField: 1 } }] };
    const text = line(changed) + padding;
    const reduced = planJournalReduction([{ id: "g", text }], options());
    assert.equal(reduced.removed, 0);
    assert.equal(reduced.retained[0]?.text, text);
  });
});
