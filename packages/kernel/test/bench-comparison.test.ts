import { strict as assert } from "node:assert";
import { it } from "node:test";
import { PLAN, summarize } from "../../../tools/bench-comparison.ts";
import { measuredRows } from "../../../tools/bench.ts";

const rows = (fixture: string, ms = 1) => measuredRows(fixture, {
  cold: [{ label: "unit model", ms: 1, exit: 0 }],
  warm: [{ label: "unit model", ms, exit: 0 }],
  resume: [{ label: "unit model", ms: 1, exit: 0 }],
  storageBytes: 1,
});
const results = () => PLAN.map(attempt => ({ attempt, rows: rows(attempt.fixture) }));

it("freezes five paired repetitions on both failing fixtures and alternates order [NFR-01]", () => {
  assert.equal(PLAN.length, 20);
  for (const fixture of ["large", "long-history"]) {
    for (const arm of ["baseline", "candidate"]) {
      assert.deepEqual(PLAN.filter(p => p.fixture === fixture && p.arm === arm).map(p => p.repeat), [1, 2, 3, 4, 5]);
    }
    for (let repeat = 1; repeat <= 5; repeat++) {
      assert.deepEqual(PLAN.filter(p => p.fixture === fixture && p.repeat === repeat).map(p => p.arm),
        repeat % 2 ? ["baseline", "candidate"] : ["candidate", "baseline"]);
    }
  }
});

it("retains every repeated budget failure instead of selecting a passing run [NFR-01]", () => {
  const all = results();
  assert.deepEqual(summarize(all), { complete: true, failures: 0, exit: 0 });
  all[0]!.rows = rows(all[0]!.attempt.fixture, 301);
  assert.deepEqual(summarize(all), { complete: true, failures: 1, exit: 1 });
});

it("refuses missing, duplicate, empty or mislabeled repeated evidence [NFR-01]", () => {
  assert.equal(summarize(results().slice(1)).exit, 1);
  const duplicate = results();
  duplicate[1] = duplicate[0]!;
  assert.equal(summarize(duplicate).complete, false);
  const empty = results();
  empty[0]!.rows = [];
  assert.equal(summarize(empty).exit, 1);
  const mislabeled = results();
  mislabeled[0]!.rows = rows("small");
  assert.equal(summarize(mislabeled).exit, 1);
});
