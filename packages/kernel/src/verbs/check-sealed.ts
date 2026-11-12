// The sealed starting-tree run (EVD-04, TS §9.8): when the broader suite still fails after reruns on a full candidate check,
// the same test command runs once on a copy of the contract's starting files outside the workspace. Only its failure ids
// are kept. A failing test file that did not exist at the start needs no run: that failure is new.
import { join } from "node:path";
import { classifiable, classify, failureIdsOf, MAX_IDS, needsAnswer, WHY } from "../core/baseline.ts";
import type { BaselineCtx } from "../core/baseline.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { FULL_SUITE } from "../core/obligations.ts";
import type { RunFacts } from "../core/receipts.ts";
import type { Question, Receipt, WorkContract } from "../core/schemas.ts";
import type { SealOverlay } from "../ports/types.ts";
import { factsHash, question } from "./common.ts";
import { digestAfter } from "./check-rerun.ts";
import type { Executed, Run } from "./check-evidence.ts";

export const BASELINE_QUESTION = "baseline-failures";
const FIRST_RUN_LIMIT_MS = 120_000;
const MAX_TRIES = 2;

/** What `execute` learned: which failing files are new, and the starting-tree run or why it could not happen. */
export interface SealedRun {
  absent: string[];
  unavailable?: string;
  transient?: boolean;
  run?: Omit<RunFacts, "startedAt" | "pid" | "outputTruncated">;
  root?: string;
  startId?: string;
}

type Sealed = NonNullable<WorkContract["sealedBaseline"]>;

/** The suite's last settled run (the final rerun when there was one) and the report files that failed in it. */
function failingFiles(run: Run, o: Executed): string[] | undefined {
  const settled = (f: RunFacts) => f.ran && !f.timedOut && !f.signal && !f.outputTruncated && f.after === run.facts.candidate;
  if (!settled(o)) return undefined;
  const last = o.reruns?.filter((r) => r.obligations.includes(FULL_SUITE)).at(-1)?.facts ?? o;
  if (!settled(last) || last.raw === null) return undefined;
  const norm = run.ports.stack.normalize(last.raw, run.ports.root);
  if (norm.invalid) return undefined;
  const files = [...norm.files].filter(([, f]) => f.failed > 0).map(([p]) => p);
  return files.length ? files : undefined;
}

/** Reasons decided before any process (SB-10), and the start-dirty overlay when there are none. */
function plan(run: Run, w: WorkContract): { why: string } | { overlay: SealOverlay } {
  const start = w.git.start;
  if (w.git.mode !== "git") return { why: "not-git" };
  if (!start.head) return { why: "no-start" };
  const read = (p: string) => allowed("read", p, (run.exclusions ?? []) as Exclusion[]);
  const overlay: SealOverlay = { copy: [], remove: [] };
  for (const d of start.dirty) {
    if (d.mode === "120000") return { why: "symlink" };
    if (!read(d.path)) return { why: "excluded" };
    if ((run.facts.inv.entries.get(d.path)?.blob ?? "") !== (d.blob ?? "")) return { why: "start-changed" };
    if (d.blob) overlay.copy.push({ path: d.path, mode: d.mode });
    else overlay.remove.push(d.path);
  }
  return { overlay };
}

/** One run of the suite command on the sealed starting files, in the same call, once per contract (SB-3, SB-6). */
export async function sealedRun(run: Run, o: Executed, inputs: readonly string[]): Promise<SealedRun | undefined> {
  const { ports, w, runDir } = run;
  if (run.stage !== "candidate" || run.scope !== "full" || !run.toRun.some((ob) => ob.id === FULL_SUITE)) return undefined;
  const files = failingFiles(run, o);
  if (!files) return undefined;
  const existed = w.git.start.head ? await ports.git.blobsAt(w.git.start.head, files).catch(() => null) : {};
  if (!existed) return { absent: [], unavailable: "no-start" }; // the starting commit is gone
  const absent = files.filter((p) => !existed[p] && !w.git.start.dirty.some((d) => d.path === p && d.blob));
  const prev = w.sealedBaseline;
  if (absent.length || prev?.status === "recorded" || (prev?.status === "unavailable" && prev.tries >= MAX_TRIES)) return { absent };
  if (o.durationMs > FIRST_RUN_LIMIT_MS) return { absent, unavailable: "too-slow" };
  const decided = plan(run, w);
  if ("why" in decided) return { absent, unavailable: decided.why };
  if (await ports.git.filterGate()) return { absent, unavailable: "filters" };
  const keep = (p: string) => allowed("read", p, (run.exclusions ?? []) as Exclusion[]);
  const sealed = await ports.git.materialize(w.git.start.head!, join(runDir, "sealed"), keep, decided.overlay);
  if ("problem" in sealed) return { absent, unavailable: sealed.problem };
  try {
    const deps = ports.stack.shareDeps(ports.root, sealed.root);
    if (deps) return { absent, unavailable: deps };
    const report = join(runDir, "sealed-vitest.json");
    const timeoutMs = Math.min(10 * 60_000, Math.max(30_000, 2 * o.durationMs));
    const r = await ports.runner.run({ argv: ports.stack.argv("all", report), cwd: sealed.root, runDir, timeoutMs, report });
    const after = (await digestAfter(run, inputs)).digest;
    const facts = { ran: r.exit !== undefined || !!r.signal, timedOut: r.timedOut, durationMs: r.durationMs, raw: r.report, after };
    return { absent, run: { ...facts, ...(r.exit !== undefined ? { exit: r.exit } : {}), ...(r.signal ? { signal: r.signal } : {}) },
      root: sealed.root, startId: w.git.start.head! };
  } finally {
    sealed.dispose();
  }
}

/** The contract's record after this check: a completed run records its failures; anything else says why it did not (SB-6). */
export function sealedRecord(run: Run, cw: WorkContract, s: SealedRun | undefined, at: string): Sealed | undefined {
  const prev = cw.sealedBaseline;
  if (!s || (!s.unavailable && !s.run)) return prev;
  const tries = prev?.status === "unavailable" ? prev.tries : 0;
  const fail = (why: string, transient: boolean): Sealed => ({ status: "unavailable", why, tries: tries + (transient ? 1 : 0), at });
  if (s.unavailable) return fail(s.unavailable, !!s.transient);
  const f = s.run!;
  if (!f.ran || f.signal || f.exit === undefined) return fail("not-finished", true);
  if (f.timedOut) return fail("timeout", true);
  if (f.after !== run.facts.candidate) return fail("concurrent-edit", true);
  const norm = f.raw === null ? null : run.ports.stack.normalize(f.raw, s.root!);
  if (!norm || norm.invalid) return fail("report-invalid", true);
  const { ids, failed } = failureIdsOf(norm.files, [...norm.files.keys()]);
  const complete = ids.length === failed && failed <= MAX_IDS;
  return { status: "recorded", startId: s.startId!, failed: ids.slice(0, MAX_IDS), complete, at };
}

/** Marks failing files that did not exist at the start on the suite receipt (so the verdict can call their failures new),
 * and returns what classification reads: the record after this check and the user's decisions. */
export function sealedEvidence(run: Run, cw: WorkContract, o: Executed, receipts: Receipt[]): BaselineCtx {
  const suite = receipts.find((r) => r.obligation === FULL_SUITE);
  if (suite && o.sealed?.absent.length) suite.startAbsent = o.sealed.absent.slice(0, MAX_IDS);
  return { sealed: sealedRecord(run, cw, o.sealed, run.ports.clock.now()), exceptions: cw.exceptions, treated: cw.treated };
}

/** The one aggregate question when the suite's failures are pre-existing, changed or unknown and undecided (SB-11). */
export function baselineQuestion(receipts: Receipt[], c: BaselineCtx): Question | undefined {
  const rc = receipts.find((r) => classifiable(r) && needsAnswer(r, c));
  if (!rc) return undefined;
  const files = [...new Set(rc.failureIds!.map((id) => id.split("::")[0]!))];
  const named = `${files.slice(0, 3).join(", ")}${files.length > 3 ? ` and ${files.length - 3} more` : ""}`;
  const k = classify(rc, c.sealed);
  const text = k.kind === "pre-existing"
    ? `These tests also fail on a run of your starting files: ${named}. Leave them out of this work, or fix them as part of it?`
    : `Couldn't tell whether ${named} failed before: ${"why" in k ? WHY[k.why] ?? k.why : ""}. Leave it out, or treat it as mine to fix?`;
  return question({
    id: BASELINE_QUESTION, header: "Failing tests", question: text, bind: { factsHash: factsHash([...rc.failureIds!].sort()) },
    options: [
      { label: "Leave them out", description: "Answer: exclude, with the user's own words as the quote." },
      { label: "Fix them as part of this work", description: "Answer: fix. They count as failures this work must fix." },
    ],
  });
}
