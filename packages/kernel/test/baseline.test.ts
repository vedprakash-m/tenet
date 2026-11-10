// Sealed baseline classification (EVD-04, TS §9.8): the pure rule that calls a broader-suite failure pre-existing, introduced,
// changed or unknown, and the adapter's failure ids it reads. Pure: runs on every platform.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { classify, excused, failureReasons, needsAnswer, spared } from "../src/core/baseline.ts";
import type { BaselineCtx } from "../src/core/baseline.ts";
import { normalize } from "../src/adapters/node-ts.ts";
import type { Receipt, WorkContract } from "../src/core/schemas.ts";

type Sealed = NonNullable<WorkContract["sealedBaseline"]>;
const id = (file: string, test: string, sig = "s1", kind = "assertion") => `${file}::${test}\u001f${kind}:${sig}`;
const suite = (ids: string[], over: Partial<Receipt> = {}): Receipt => ({
  id: "RC-1", obligation: "OB-suite", kind: "test", stage: "candidate", source: "kernel-run", checkInputId: "c", scope: "full",
  argv: [], cwd: ".", durationMs: 1, versions: { tool: "1", reporter: "r", adapter: "a" },
  provenance: { runId: "r", runDir: "d", startedAt: "t" }, status: "fail", qualifiers: [], reasons: [], limitations: [], candidate: "x",
  counts: { discovered: ids.length, executed: ids.length, passed: 0, failed: ids.length, skipped: 0, focused: 0 },
  failureIds: ids, ...over,
});
const recorded = (failed: string[], complete = true): Sealed => ({ status: "recorded", startId: "h", failed, complete, at: "t" });

describe("sealed baseline classification [EVD-04]", () => {
  it("is pre-existing only when every failure has the same identity and signature at the start [EVD-04]", () => {
    const a = id("a.test.ts", "adds");
    assert.deepEqual(classify(suite([a]), recorded([a])), { kind: "pre-existing" });
    assert.deepEqual(classify(suite([a]), recorded([])), { kind: "introduced", newTests: false });
  });

  it("E5: seven failures listed in full with two absent at the start are introduced; 201 failures are unknown [EVD-04]", () => {
    const ids = Array.from({ length: 7 }, (_, i) => id("a.test.ts", `t${i}`));
    assert.deepEqual(classify(suite(ids), recorded(ids.slice(0, 5))), { kind: "introduced", newTests: false });
    const many = suite(ids.slice(0, 200), { counts: { discovered: 201, executed: 201, passed: 0, failed: 201, skipped: 0, focused: 0 } });
    assert.deepEqual(classify(many, recorded(ids)), { kind: "unknown", why: "too-many" });
    assert.deepEqual(classify(suite(ids), recorded(ids, false)), { kind: "unknown", why: "too-many" });
  });

  it("E6: the same test name in another file is not pre-existing [EVD-04]", () => {
    assert.equal(classify(suite([id("b.test.ts", "adds")]), recorded([id("a.test.ts", "adds")])).kind, "introduced");
  });

  it("E7: the same test failing differently at the start is changed, never pre-existing [EVD-04]", () => {
    const r = classify(suite([id("a.test.ts", "adds", "assert")]), recorded([id("a.test.ts", "adds", "import", "runtime-error")]));
    assert.deepEqual(r, { kind: "changed", why: "differently" });
    const reasons = failureReasons({ id: "OB-suite" }, suite([id("a.test.ts", "adds", "assert")]),
      { sealed: recorded([id("a.test.ts", "adds", "import", "runtime-error")]) });
    assert.deepEqual(reasons.map((x) => x.code), ["classification-unknown"]);
    assert.match(reasons[0]!.message, /fails on your starting files, but differently/);
  });

  it("a failing file that did not exist at the start is new, with or without a starting record [EVD-04]", () => {
    const rc = suite([id("new.test.ts", "x")], { startAbsent: ["new.test.ts"] });
    assert.deepEqual(classify(rc, undefined), { kind: "introduced", newTests: true });
    assert.match(failureReasons({ id: "OB-suite" }, rc, {})[0]!.message, /new tests that fail: new\.test\.ts/);
  });

  it("without a completed starting run the failure is unknown, with the reason; deps add their own code [EVD-04]", () => {
    const rc = suite([id("a.test.ts", "adds")]);
    assert.deepEqual(classify(rc, undefined), { kind: "unknown", why: "no-run" });
    const deps: Sealed = { status: "unavailable", why: "sealed-deps-unavailable", tries: 0, at: "t" };
    const reasons = failureReasons({ id: "OB-suite" }, rc, { sealed: deps });
    assert.deepEqual(reasons.map((x) => [x.code, !!x.note]), [["classification-unknown", false], ["sealed-deps-unavailable", true]]);
  });

  it("the user's answer decides: exclude makes it a note and excuses it; fix makes it a failure to fix [EVD-04]", () => {
    const a = id("a.test.ts", "adds");
    const pre: BaselineCtx = { sealed: recorded([a]) };
    const rc = suite([a]);
    assert.ok(needsAnswer(rc, pre) && spared(rc, pre) && !excused(rc, pre));
    assert.deepEqual(failureReasons({ id: "OB-suite" }, rc, pre).map((r) => r.code), ["baseline-failure-not-excluded"]);
    const out = { ...pre, exceptions: [{ ids: [a] }] };
    assert.ok(excused(rc, out) && !needsAnswer(rc, out));
    assert.deepEqual(failureReasons({ id: "OB-suite" }, rc, out).map((r) => [r.code, r.note]), [["baseline-failure-excluded", true]]);
    const fix = { ...pre, treated: [{ ids: [a] }] };
    assert.ok(!excused(rc, fix) && !needsAnswer(rc, fix) && !spared(rc, fix));
    assert.deepEqual(failureReasons({ id: "OB-suite" }, rc, fix).map((r) => r.code), ["evidence-failed"]);
    const unknown = { exceptions: [{ ids: [a] }] };
    assert.deepEqual(failureReasons({ id: "OB-suite" }, rc, unknown).map((r) => [r.code, r.note]),
      [["baseline-failure-unclassified-excluded", true]]);
  });

  it("an acceptance, integrated or unlisted failure is not classified: it stays evidence-failed [EVD-04]", () => {
    const a = id("a.test.ts", "adds"), ctx = { sealed: recorded([a]), exceptions: [{ ids: [a] }] };
    for (const over of [{ obligation: "OB-EX-1" }, { stage: "integrated" as const }, { failureIds: undefined }]) {
      const rc = { ...suite([a]), ...over } as Receipt;
      assert.deepEqual(failureReasons({ id: rc.obligation }, rc, ctx).map((r) => r.code), ["evidence-failed"], JSON.stringify(over));
      assert.ok(!excused(rc, ctx));
    }
  });

  it("never calls a failure pre-existing without a complete candidate list and a complete starting record [EVD-04]", () => {
    const ident = fc.tuple(fc.constantFrom("a.test.ts", "b.test.ts"), fc.constantFrom("x", "y", "z"), fc.constantFrom("s1", "s2"));
    fc.assert(fc.property(fc.array(ident, { maxLength: 4 }), fc.array(ident, { maxLength: 4 }), fc.boolean(), fc.nat(3),
      (cand, start, complete, extra) => {
        const ids = [...new Set(cand.map(([f, t, s]) => id(f, t, s)))];
        const failed = ids.length + extra;
        const rc = suite(ids, { counts: { discovered: failed, executed: failed, passed: 0, failed, skipped: 0, focused: 0 } });
        const startIds = start.map(([f, t, s]) => id(f, t, s));
        if (classify(rc, recorded(startIds, complete)).kind !== "pre-existing") return;
        assert.ok(ids.length > 0 && extra === 0 && complete);
        for (const x of ids) assert.ok(startIds.includes(x));
      }));
  });

  it("the adapter lists every failure with a signature that ignores paths and numbers [EVD-04]", () => {
    const report = (root: string, ms: number) => JSON.stringify({
      numTotalTests: 2,
      testResults: [
        { name: `${root}/src/a.test.ts`, status: "failed", message: "", assertionResults: [
          { fullName: "adds", status: "failed", failureMessages: [`AssertionError: expected ${ms} in ${root}/src/a.ts to be 3`] },
          { fullName: "keeps", status: "passed", failureMessages: [] },
        ] },
        { name: `${root}/src/b.test.ts`, status: "failed", message: `Failed to load ${root}/src/missing.ts`, assertionResults: [] },
      ],
    });
    const one = normalize(report("/tmp/one", 12), "/tmp/one"), two = normalize(report("/tmp/sealed-two", 40), "/tmp/sealed-two");
    assert.equal(one.invalid, undefined);
    assert.deepEqual(one.files.get("src/a.test.ts")!.ids, two.files.get("src/a.test.ts")!.ids);
    assert.equal(one.files.get("src/a.test.ts")!.ids!.length, 1);
    assert.match(one.files.get("src/b.test.ts")!.ids![0]!, /^src\/b\.test\.ts\u001fcompile-or-import:/);
    assert.deepEqual(one.files.get("src/b.test.ts")!.ids, two.files.get("src/b.test.ts")!.ids);
  });
});
