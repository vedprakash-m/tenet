import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { LIMITS, canReserve, failureSignature, nearLimit, newBudget, repeatedFailure, settleReservation, stopFor } from "../src/core/budget.ts";
import { formatHandle, hashOf, highestSeq, parseHandle, stableStringify } from "../src/core/ids.ts";
import { REASONS, exitFor, isReasonCode } from "../src/core/reasons.ts";
import { carryDispositions, netAttention } from "../src/core/review.ts";
import type { AttentionPattern, FileChange } from "../src/core/review.ts";
import { assistanceLevel, ceiling, chooseLane, laneFloor, raise } from "../src/core/risk.ts";
import type { Readiness } from "../src/core/risk.ts";
import { allowed } from "../src/core/exclusions.ts";
import { PATTERNS } from "../src/adapters/node-ts.ts";

describe("ids", () => {
  it("hashes equal values equally whatever the key order", () => {
    fc.assert(fc.property(fc.dictionary(fc.string(), fc.integer()), (o) => {
      const rev = Object.fromEntries(Object.entries(o).reverse());
      return hashOf(o) === hashOf(rev) && stableStringify(o) === stableStringify(rev);
    }));
  });
  it("round-trips handles and rejects malformed ones", () => {
    assert.deepEqual(parseHandle(formatHandle(7, 3, "k7q1")), { labelN: 7, generation: 3, tag: "k7q1" });
    for (const bad of ["W7.3", "w7.3.k7q1", "W7.3.K7Q1", "W7.3.k7q", ""]) assert.equal(parseHandle(bad), null);
  });
  it("allocates past the highest sequence on the branch", () => {
    assert.equal(highestSeq([{ id: "REQ-004-abc" }, { id: "EX-009-xyz.2" }, { id: "weird" }]), 9);
  });
});

describe("reason registry", () => {
  it("has a meaning and an exit for every code, exits within 0..5", () => {
    for (const [code, [exit, meaning]] of Object.entries(REASONS)) {
      assert.ok(exit >= 0 && exit <= 5, code);
      assert.ok(meaning.length > 5, code);
      assert.equal(exitFor(code as never), exit);
      assert.ok(isReasonCode(code));
    }
  });
});

describe("risk", () => {
  it("raises dimensions from signals and never lowers them", () => {
    fc.assert(fc.property(fc.array(fc.constantFrom("src/auth/login.ts", "db/migrations/001.sql", "src/util.ts", "package.json")), (paths) => {
      const before = { "sensitive-data": "high" as const };
      const after = raise(before, paths, [], false);
      return after["sensitive-data"] === "high";
    }));
    assert.equal(raise({}, ["src/auth/login.ts"], [], false).access, "high");
    assert.equal(raise({}, ["db/migrations/001_add.sql"], [], false).reversibility, "high");
  });
  it("sets floors: none Quick, one High Standard, two or irreversible Deep", () => {
    assert.equal(laneFloor({}), "quick");
    assert.equal(laneFloor({ access: "high" }), "standard");
    assert.equal(laneFloor({ access: "high", reversibility: "high" }), "deep");
    assert.equal(laneFloor({}, true), "deep");
  });
  it("lets the user raise freely and lower only to the floor", () => {
    assert.deepEqual(chooseLane("quick", "standard", "standard"), { lane: "standard", clamped: true });
    assert.deepEqual(chooseLane("deep", "quick", "quick"), { lane: "deep", clamped: false });
    assert.deepEqual(chooseLane(undefined, "standard", "quick"), { lane: "standard", clamped: false });
  });
  const ok: Readiness = { nodeOk: true, platformOk: true, stateWritable: true, policyBlocks: false, gitState: "ok", language: "ts-js", runnerSupported: true, typescript: true, depsInstalled: true, experimental: false };
  it("derives the assistance level from readiness; the lowest matching row wins", () => {
    assert.equal(assistanceLevel(ok, "feature").level, "L4");
    assert.equal(assistanceLevel({ ...ok, policyBlocks: true }, "feature").level, "L0");
    assert.equal(assistanceLevel({ ...ok, stateWritable: false }, "feature").level, "L0");
    assert.equal(assistanceLevel({ ...ok, stateWritable: false }, "investigate").level, "L4", "non-editing work needs no writable state");
    assert.equal(assistanceLevel({ ...ok, language: "other" }, "feature").level, "L1");
    assert.equal(assistanceLevel({ ...ok, depsInstalled: false }, "feature").level, "L2");
    assert.equal(assistanceLevel({ ...ok, runnerSupported: false }, "feature").level, "L3");
    assert.equal(assistanceLevel({ ...ok, experimental: true }, "feature").level, "L3");
    assert.equal(assistanceLevel(ok, "plan").level, "L2");
  });
  it("caps the endpoint a level can reach", () => {
    assert.deepEqual(["L0", "L1", "L2", "L3", "L4"].map((l) => ceiling(l as never)), ["blocked", "findings-only", "findings-only", "implemented-unverified", "checked-local"]);
  });
});

describe("budget", () => {
  it("treats the same signature twice, or A-B-A-B, as repeated failure, but not A-B-A [WRK-09]", () => {
    assert.equal(repeatedFailure(["a", "a"]), true);
    assert.equal(repeatedFailure(["a", "b", "a", "b"]), true);
    assert.equal(repeatedFailure(["a", "b", "a"]), false);
    assert.equal(repeatedFailure(["a", "b", "c", "a"]), false);
    assert.equal(repeatedFailure(["a"]), false);
  });
  it("signatures ignore numbers and ordering of failing tests", () => {
    assert.equal(failureSignature("o", ["b", "a"], "expected 3 to be 4"), failureSignature("o", ["a", "b"], "expected 9 to be 10"));
  });
  it("stops at the attempt limit only with a failure on record, and on repetition", () => {
    const b = { ...newBudget(), attempts: LIMITS.standard.attempts, signatures: ["x"] };
    assert.equal(stopFor(b, "standard"), "budget-exhausted");
    assert.equal(stopFor({ ...b, signatures: [] }, "standard"), undefined);
    assert.equal(stopFor({ ...newBudget(), signatures: ["x", "x"] }, "standard"), "repeated-failure");
  });
  it("warns at 80% of any counter, as whole numbers [WRK-08]", () => {
    const at = (over: object) => nearLimit({ ...newBudget(), ...over }, "standard");
    assert.equal(at({ delegations: 4 }), false);
    assert.equal(at({ delegations: 5 }), true, "5 of 6 is 83%");
    assert.equal(at({ attempts: 2 }), false);
    assert.equal(at({ attempts: 3 }), true);
    assert.equal(at({ reviewRounds: 2 }), true);
    assert.equal(at({ delegations: 3, reservations: [{ id: "r", role: "reviewer", manifest: "", manifestHash: "", candidate: "", basisHash: "", attempt: 1, mode: "full", files: {} }, { id: "s", role: "reviewer", manifest: "", manifestHash: "", candidate: "", basisHash: "", attempt: 2, mode: "full", files: {} }] }), true, "live reservations count");
  });
  it("counts live reservations against the delegation limit, and settles each once", () => {
    let b = newBudget();
    for (let i = 0; i < LIMITS.quick.delegations; i++) {
      assert.equal(canReserve(b, "quick"), true);
      b = { ...b, reservations: [...b.reservations, { id: `r${i}`, role: "reviewer", manifest: "", manifestHash: "", candidate: "c", basisHash: "b", attempt: i + 1, mode: "full", files: {} }] };
    }
    assert.equal(canReserve(b, "quick"), false, "a dispatch beyond the limit is refused before it happens");
    const s = settleReservation(b, "r0", { countRound: true, recheck: false });
    assert.equal(s.delegations, 1);
    assert.equal(s.reviewRounds, 1);
    assert.equal(s.reservations.length, LIMITS.quick.delegations - 1);
  });
});

describe("exclusions", () => {
  it("never allows content use of default secret files, but allows .env.example [SEC-14]", () => {
    for (const p of [".env", ".env.local", "config/.env.production", "certs/server.pem", "k.key", "id_rsa", "home/id_ed25519.pub"]) {
      for (const op of ["scan", "read", "model-send", "edit", "export"] as const) assert.equal(allowed(op, p), false, `${op} ${p}`);
    }
    assert.equal(allowed("model-send", ".env.example"), true);
    assert.equal(allowed("edit", ".tenet/state"), false);
  });
  it("applies each project exclusion kind to its own operations only", () => {
    const x = [{ pattern: "secrets/**", kinds: ["no-model-send" as const] }, { pattern: "vendor/**", kinds: ["no-edit" as const] }];
    assert.equal(allowed("model-send", "secrets/a.txt", x), false);
    assert.equal(allowed("read", "secrets/a.txt", x), true);
    assert.equal(allowed("edit", "vendor/lib.js", x), false);
    assert.equal(allowed("model-send", "vendor/lib.js", x), true);
  });
});

const change = (path: string, added: string[], removed: string[] = []): FileChange => ({ path, kind: "source", hunks: [{ line: 1, added, removed }], added: added.length, removed: removed.length });
const names = (cs: FileChange[], ps: readonly AttentionPattern[] = PATTERNS) => netAttention(cs, ps).map((a) => a.pattern);

describe("attention (net per hunk, whitespace and case folded)", () => {
  it("flags added markers, suppressions, escapes, mocks, empty catches and snapshots [REV-03]", () => {
    assert.deepEqual(names([change("a.ts", ["// @ts-ignore", "const x = y as any;", "try { f() } catch {}", "vi.mock('./x')", "it.skip('a', () => {})"])]).sort(), ["@ts-ignore", ".skip", "as any", "empty catch", "mock"].sort());
  });
  it("is not fooled by spacing or case", () => {
    assert.deepEqual(names([change("a.ts", ["const  x = y   AS    ANY ;"])]), ["as any"]);
    assert.deepEqual(names([change("a.ts", ["it . only ( 'x' )"])]), [".only"]);
  });
  it("nets within a hunk: moving a marker is not adding one, adding a second is", () => {
    assert.deepEqual(names([change("a.ts", ["// @ts-ignore"], ["// @ts-ignore"])]), []);
    assert.deepEqual(names([change("a.ts", ["// @ts-ignore", "// @ts-ignore"], ["// @ts-ignore"])]), ["@ts-ignore"]);
  });
  it("flags removed assertions, not added ones [REV-03]", () => {
    assert.deepEqual(names([change("a.test.ts", [], ["expect(a).toBe(1);"])]), ["assertion removed"]);
    assert.deepEqual(names([change("a.test.ts", ["expect(a).toBe(1);"])]), []);
    assert.deepEqual(names([change("a.test.ts", ["expect(a).toBe(2);"], ["expect(a).toBe(1);"])]), [], "replacing an assertion keeps the count");
  });
  it("keeps dispositions only for items that still exist", () => {
    const [a] = netAttention([change("a.ts", ["x as any"])], PATTERNS);
    const disposed = { ...a!, disposition: { by: "user" as const, outcome: "accepted" as const, reason: "ok" } };
    const next = netAttention([change("a.ts", ["x as any"])], PATTERNS);
    assert.equal(carryDispositions([disposed], next)[0]!.disposition?.by, "user");
    assert.equal(carryDispositions([disposed], netAttention([change("a.ts", ["y as any"])], PATTERNS))[0]!.disposition, undefined);
  });
});
