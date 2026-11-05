// Deterministic, repository-owned schema-1 records for the migration candidate (schema-migration 16.8). Built from the producers' own shapes and
// validated by the frozen schema-1 parser in the tests; none comes from a user's store. The captured set (123 files) is read through
// TENET_LEGACY_CAPTURE_ROOT when present; these cover the same shapes on every platform.
import { State } from "../../src/core/schemas.ts";
import type { State as State1 } from "../../src/core/schemas.ts";
import { emptyState, newContract } from "../../src/core/state.ts";

export const WS = "ws_aaaaaaaaaa";
export const H = (c: string): string => c.repeat(64);
const G = (c: string): string => c.repeat(40);
const start = { head: G("1"), branch: "main", staged: [], dirty: [] };

function contract(n: number, extra: Partial<State1["work"][string]> = {}): State1["work"][string] {
  return {
    ...newContract({
      id: `wk_${n}`, label: `W-000${n}`, profile: "feature", request: "r", lane: "standard", floor: "quick", level: "L1", generation: n, now: "2026-11-03T00:00:00.000Z",
      version: "0.9.0", adapter: "node-ts-1", assessment: {}, scopePaths: ["src"], protectedPaths: [], gitMode: "git", base: "main", branch: "tenet/w", start,
    }),
    ...extra,
  };
}

/** Project traits with an unknown and a repeated entry; one work with a basis snapshot of traits; distinct generations. */
export function state1(revision = 7): State1 {
  const s = emptyState(WS, "abcd");
  const basis = { intentRevision: 1, elementIds: ["REQ-1"], hash: H("b"), traits: ["persistence", "weird-trait", "persistence"] };
  const w1 = contract(1, { basis, state: "executing" });
  const w2 = contract(2, { budget: { ...contract(2).budget, attempts: 2, checksLaunched: 5, tenetTokens: 11 } });
  return State.parse({
    ...s, revision, generationSeq: 2, workSeq: 2,
    project: { ...s.project, traits: ["ui", "weird-trait", "ui"] },
    work: { [w1.id]: w1, [w2.id]: w2 },
  });
}

const T = "2026-11-03T00:00:00.000Z";
const rec = (kind: string, effect: string, id: string, extra: object) => JSON.stringify({ t: T, kind, effect, id, ...extra });
const pair = (effect: string, id: string, op: object, outcome: object): string[] => [rec("intent", effect, id, { op }), rec("result", effect, id, { outcome })];

/** One settled intent and result for each of the ten effect kinds, in the producers' exact key sets. */
export function journal1Lines(): string[] {
  const sync = { parent: G("1"), head: G("2"), paths: ["a.ts"], dev: 1, ino: 2, temp: `tenet-index-${"a".repeat(8)}-aaaa-aaaa-aaaa-${"a".repeat(12)}.lock`, pid: 3, procStart: "p" };
  return [
    ...pair("index-sync", "i-1", { work: "wk_1", sync }, { status: "synced" }),
    ...pair("commit", "c-1", { work: "wk_1", parent: G("1"), expectedTree: G("3"), paths: ["a.ts"], subject: "s" }, { completed: true, commit: G("4"), tree: G("3"), foreign: [] }),
    ...pair("integration", "g-1", { work: "wk_1", base: "main", baseBefore: G("1"), workTip: G("4") }, { completed: true, commit: G("4"), mode: "fast-forward" }),
    ...pair("undo", "u-1", { work: "wk_1", original: "wk_2", tree: G("5"), paths: ["a.ts"], pre: { "a.ts": G("6") }, post: { "a.ts": null }, patch: H("7"), runDir: "/t/run-u" }, { completed: true }),
    ...pair("scaffold", "s-1", { work: "wk_1", recipe: { id: "r", version: "1", checks: ["tsc"] }, expected: { "a.ts": H("8") }, protect: ["a.ts"] }, { completed: true, files: 1 }),
    ...pair("adopt", "a-1", { work: "wk_1", file: "INTENT.md", before: null, after: H("9"), blocks: { b: "x" }, at: T }, { completed: true }),
    ...pair("dependency", "d-1", { work: "wk_1", phase: "install", manager: "npm", before: { manifest: H("a"), lock: null }, scripts: [] }, { completed: true }),
    ...pair("branch", "b-1", { work: "wk_1", from: null, to: "tenet/w" }, { completed: true, branch: "tenet/w" }),
    ...pair("forget", "f-1", { work: "wk_1", lesson: "L-1" }, { completed: true }),
    ...pair("hardening", "h-1", { work: "wk_1", file: "docs/hardening.md", before: null, after: H("c"), block: "HARDENING-wk_1", hash: H("d"), updatedAt: T }, { completed: true }),
    JSON.stringify({ t: T, kind: "call", verb: "open", exit: 0, revision: 3 }),
  ];
}

export const journal1 = (lines = journal1Lines()): string => `${lines.join("\n")}\n`;
