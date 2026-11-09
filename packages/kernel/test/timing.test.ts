import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { callTiming } from "../src/pipeline-timing.ts";
import { Timing } from "../src/core/timing.ts";
import { KernelResponse } from "../src/core/schemas.ts";
import { runVerb } from "../src/pipeline.ts";
import { stamp } from "../src/pipeline-render.ts";
import { emptyState } from "../src/core/state.ts";
import { accrueTime, newBudget } from "../src/core/budget.ts";
import type { Ports, RunResult } from "../src/ports/types.ts";

function fixture() {
  let at = 0;
  const pending: Array<{ resolve: (r: RunResult) => void; reject: (e: Error) => void }> = [];
  const ports: Ports = {
    clock: { ms: () => at, now: () => new Date(at).toISOString() },
    version: "0.0.0", platform: "linux", host: { capabilities: () => ({}) },
    store: { exists: () => false },
    runner: {
      run: () => new Promise<RunResult>((resolve, reject) => pending.push({ resolve, reject })),
    },
  } as never;
  return {
    ports, pending, set: (n: number) => { at = n; },
    result: { exit: 0, timedOut: false, durationMs: 999, stdout: "", stderr: "", startedAt: "", report: null },
  };
}
const spec = { argv: ["check"], cwd: ".", runDir: ".", timeoutMs: 1000 };
const unknown = { ms: null, source: "unknown", reason: "host-not-reported" };

describe("five measured or unknown timing fields [NFR-05]", () => {
  it("separates kernel elapsed work from the union of overlapping check intervals", async () => {
    const f = fixture(), measured = callTiming(f.ports);
    f.set(10);
    const a = measured.runner.run(spec);
    f.set(20);
    const b = measured.runner.run(spec);
    f.set(40);
    f.pending[0]!.resolve(f.result);
    await a;
    f.set(50);
    f.pending[1]!.resolve(f.result);
    await b;
    f.set(100);
    assert.deepEqual(measured.read(), {
      scope: "kernel-call", active: { ms: 60, source: "kernel" }, tool: { ms: 40, source: "kernel" },
      provider: unknown, network: unknown, userWait: unknown,
    });
  });

  it("counts sequential rejected and timed-out checks without trusting result durations", async () => {
    const f = fixture(), measured = callTiming(f.ports);
    f.set(5);
    const a = measured.runner.run(spec);
    f.set(15);
    f.pending[0]!.reject(new Error("check failed"));
    await assert.rejects(a, /check failed/);
    f.set(25);
    const b = measured.runner.run(spec);
    f.set(45);
    f.pending[1]!.resolve({ ...f.result, timedOut: true });
    await b;
    f.set(60);
    assert.equal(measured.read().tool.ms, 30);
    assert.equal(measured.read().active.ms, 30);
  });

  it("reports an in-flight snapshot without pretending the check has finished", () => {
    const f = fixture(), measured = callTiming(f.ports);
    f.set(10);
    void measured.runner.run(spec);
    f.set(30);
    assert.equal(measured.read().tool.ms, 20);
    assert.equal(measured.read().active.ms, 10);
  });

  it("preserves exact host observations and provenance without estimating missing fields", () => {
    const f = fixture();
    f.ports.host.callTimings = () => ({ provider: { ms: 37, observedAt: "2026-11-07T00:00:00.000Z" } });
    const timing = callTiming(f.ports).read();
    assert.deepEqual(timing.provider, { ms: 37, source: "host", observedAt: "2026-11-07T00:00:00.000Z" });
    assert.deepEqual(timing.network, unknown);
    assert.deepEqual(timing.userWait, unknown);
  });

  it("refuses invalid host observations explicitly", () => {
    for (const ms of [-1, Infinity, NaN]) {
      const f = fixture();
      f.ports.host.callTimings = () => ({ network: { ms, observedAt: "2026-11-07T00:00:00.000Z" } });
      assert.throws(() => callTiming(f.ports).read(), /host timing/i);
    }
    for (const observed of [null, undefined, { extra: 1 }]) {
      const f = fixture();
      f.ports.host.callTimings = () => observed as never;
      assert.throws(() => callTiming(f.ports).read(), /host timing/i);
    }
  });

  it("returns an internal-error response for invalid host observations, including early refusals", async () => {
    const f = fixture();
    f.ports.host.callTimings = () => ({ network: { ms: -1, observedAt: "2026-11-07T00:00:00.000Z" } });
    const res = await runVerb(f.ports, {}, "missing", {});
    assert.equal(res.exit, 5);
    assert.equal(res.reasons[0]!.code, "internal-error");
    assert.deepEqual(res.timing?.network, { ms: null, source: "unknown", reason: "host-invalid" });
  });

  it("marks a failed host observation as invalid rather than not reported", async () => {
    const f = fixture();
    f.ports.host.callTimings = () => { throw new Error("Host timing unavailable."); };
    const res = await runVerb(f.ports, {}, "missing", {});
    assert.equal(res.exit, 5);
    assert.equal(res.reasons[0]!.message, "Host timing unavailable.");
    assert.deepEqual(res.timing?.provider, { ms: null, source: "unknown", reason: "host-invalid" });
  });

  it("accepts only the exact declared timing shape and provenance", () => {
    const timing = callTiming(fixture().ports).read();
    for (const change of [
      { extra: 1 }, { scope: "session" }, { provider: { ms: 0, source: "kernel" } },
      { network: { ms: null, source: "unknown", reason: "estimated" } },
      { userWait: { ms: 1, source: "host", observedAt: "not-a-date" } },
      { active: { ms: -1, source: "kernel" } },
    ]) assert.equal(Timing.safeParse({ ...timing, ...change }).success, false);
  });

  it("renders timing for stateless, read-only and refused calls without mutating the original ports", async () => {
    const f = fixture();
    const verbs = {
      sample: { name: "sample", schema: z.object({}), class: () => "stateless" as const,
        run: () => { f.set(12); return { resp: { exit: 0 as const } }; } },
      view: { name: "view", schema: z.object({}), class: () => "read-only" as const,
        run: () => ({ resp: { exit: 0 as const } }) },
    };
    for (const name of ["sample", "view", "missing"]) {
      const res = await runVerb(f.ports, verbs, name, {});
      assert.equal(res.timing?.scope, "kernel-call");
      assert.deepEqual(res.timing?.userWait, unknown);
      assert.equal(KernelResponse.safeParse(res).success, true);
    }
    assert.equal(f.ports.timing, undefined);
  });

  it("caches and journals the same snapshot without changing active budget accrual", () => {
    const f = fixture(), measured = callTiming(f.ports);
    f.set(100);
    const calls: Record<string, unknown>[] = [];
    const next = emptyState("ws_x", "tag1");
    const tx = { state: null, publish: () => {}, call: (e: Record<string, unknown>) => calls.push(e) };
    const res = stamp({ ...f.ports, timing: measured.read }, { name: "test" } as never, {}, null,
      tx as never, next, { exit: 0 }, true, new Date(0).toISOString());
    assert.deepEqual(calls[0]!.timing, res.timing);
    assert.equal(res.timing?.active.ms, 100);
    const budget = accrueTime(newBudget(), { startedAt: new Date(0).toISOString(),
      endedAt: new Date(60_000).toISOString(), exit: 0, checkIn: false });
    assert.equal(budget.activeMinutesTotal, 1);
    assert.equal(budget.activeMinutesSinceCheckIn, 1);
  });
});
