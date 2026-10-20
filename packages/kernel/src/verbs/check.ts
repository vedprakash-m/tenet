// `check`: run the obligations and turn what happened into receipts, counters, attention items and the next step.
// The run happens outside the lock (prepare, execute, finalize); the response is rebuilt from the observed result.
import { join } from "node:path";
import { attemptsLeft, failureSignature, nearLimit, recordAttempt, recordLaunchedChecks, stopFor, withSignature } from "../core/budget.ts";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { handoffText } from "../core/handoff.ts";
import { carryDispositions, netAttention } from "../core/review.ts";
import { CheckInput } from "../core/schemas.ts";
import { receiptReasons, receiptsFrom } from "../core/receipts.ts";
import type { RunFacts } from "../core/receipts.ts";
import type { AttentionItem, Obligation, State, WorkContract } from "../core/schemas.ts";
import type { Reason } from "../core/schemas.ts";
import { hashOf } from "../core/ids.ts";
import type { Job, Plan, Resp, Verb } from "../pipeline.ts";
import type { Normalized } from "../ports/types.ts";
import { nx, withWork, workOf } from "./common.ts";
import { dirtyQuestion, undecidedDirty } from "./dirty.ts";
import { checkInputId, gather, worldDigest } from "./facts.ts";
import { issueReview } from "./manifest.ts";
import { keepRecovered, recover } from "./recover.ts";

const TIMEOUT_MS = 10 * 60_000;

/** Support files locked with a test: those the example declares, plus the runner's own configuration (TS §9.7). */
const RUNNER_CONFIG = /^(?:vitest|vite)\.config\.[cm]?[jt]s$/;
function supportOf(ob: Obligation, facts: { inv: { entries: Map<string, { blob: string }> } }): Record<string, string> {
  const paths = [...(ob.support ?? []), ...[...facts.inv.entries.keys()].filter((p) => RUNNER_CONFIG.test(p))];
  return Object.fromEntries(paths.flatMap((p) => { const blob = facts.inv.entries.get(p)?.blob; return blob ? [[p, blob]] : []; }));
}

export const check: Verb<CheckInput> = {
  name: "check",
  schema: CheckInput,
  class: () => "mutating",
  identity: worldDigest,
  editing: () => true,

  async run(ports, state0, input, tx): Promise<Plan> {
    const state = state0!;
    let w = workOf(state, input.h);
    if (!w.basis) throw new KernelError("continue-required", "record a basis with decide before checking", { exit: 2 });
    // Finished work can still be rechecked on the integrated tree; nothing else reopens it.
    if (["finished", "cancelled", "superseded"].includes(w.state) && !(w.state === "finished" && input.stage === "integrated")) throw new KernelError("stale-session", `this work is ${w.state}`, { exit: 2 });
    const rec = await recover(ports, tx!, state);
    let cur = rec.state;
    w = cur.work[w.id]!;
    if (w.session.inCall) throw new KernelError("work-busy", `a ${w.session.inCall.verb} is running`);
    if (cur.pending.length) {
      return keepRecovered({ resp: { work: w.id, exit: 3, questions: cur.pending, next: [nx("ask", "Answer the open question first.", true)] } }, rec, state);
    }

    const now = ports.clock.now();
    const declared = (input.touched ?? []).filter((p) => !p.startsWith("/") && !p.split("/").includes(".."));
    w = { ...w, touched: [...w.touched, ...declared.filter((p) => !w.touched.some((t) => t.path === p)).map((path) => ({ path }))] };

    // Scaffolding in existing files is declared, never inferred; each declared file is shown to the reviewer.
    const scaffold = (input.scaffold ?? []).filter((p) => !p.startsWith("/") && !p.split("/").includes(".."));
    if (scaffold.length) w = { ...w, scaffolding: [...new Set([...(w.scaffolding ?? []), ...scaffold])] };

    const undecided = undecidedDirty(w);
    if (undecided.length) {
      const q = dirtyQuestion(undecided);
      return { state: withWork({ ...cur, pending: [...cur.pending.filter((p) => p.id !== q.id), q] }, w), resp: { work: w.id, exit: 3, questions: [q], reasons: [reason("attribution-mixed-file", undecided.join(", "))], next: [nx("ask", "Ask the user what happens to their edits.", true)] } };
    }

    const facts = await gather(ports, w);
    const id = checkInputId(ports, w, facts.candidate);
    const runId = `${w.label}-${ports.rand.base32(6)}`;
    const runDir = ports.store.tempDir(`run-${runId}`);
    const stage = input.stage;
    const baseline = stage === "baseline";
    const scope: "targeted" | "full" = baseline || input.targeted ? "targeted" : "full";
    const acceptance = w.obligations.filter((o) => o.testFile);
    const toRun: Obligation[] = scope === "full" ? w.obligations : acceptance;

    // Prepare: record the run intent in the contract and release the lock (TS §7.3).
    const prepared: WorkContract = {
      ...w, lastValidPhase: w.state === "checking" ? w.lastValidPhase : w.state, state: "checking", updatedAt: now,
      session: { ...w.session, inCall: { runId, ...ports.store.self(), verb: "check", since: now, runDir } },
    };
    const present = (f: string) => facts.inv.entries.has(f);
    const files = acceptance.map((o) => o.testFile!).filter(present);
    const missing = acceptance.filter((o) => !present(o.testFile!));
    const toExecute = scope === "full" ? "all" as const : files;

    const job: Job = {
      id: runId,
      async execute(): Promise<RunFacts> {
        if (toExecute !== "all" && !toExecute.length) return { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, after: facts.candidate, ran: false };
        const report = join(runDir, "vitest.json");
        const argv = ports.stack.argv(toExecute, report);
        const r = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS, report });
        const raw = r.report;
        const after = (await ports.git.inventory([])).digest;
        return { ...(r.exit !== undefined ? { exit: r.exit } : {}), ...(r.signal ? { signal: r.signal } : {}), timedOut: r.timedOut, durationMs: r.durationMs, ...(r.pid ? { pid: r.pid } : {}), startedAt: r.startedAt, raw, after, ran: r.exit !== undefined || !!r.signal };
      },

      async finalize(_tx, st, result): Promise<{ state: State; resp: Resp }> {
        const cw = st.work[w.id];
        // A check that finishes after `stop cancel` or replacement can never publish passing receipts.
        if (!cw || cw.state !== "checking" || cw.session.inCall?.runId !== runId) {
          return { state: st, resp: { work: w.id, exit: 2, reasons: [reason("run-superseded")], next: [nx("stop", "The check was cancelled or replaced; its result was discarded.")] } };
        }
        const o = (result as RunFacts | { error: string });
        if ("error" in o) return { state: withWork(st, { ...cw, state: cw.lastValidPhase ?? "executing", session: { generation: cw.session.generation } }), resp: { work: w.id, exit: 5, reasons: [{ code: "internal-error", message: o.error }], next: [nx("check", "Retry the check.")] } };

        const norm: Normalized | null = o.raw === null ? null : ports.stack.normalize(o.raw, ports.root);
        const argv = ports.stack.argv(toExecute, join(runDir, "vitest.json"));
        const receipts = receiptsFrom(o, norm, toRun, { stage, scope, id, candidate: facts.candidate, runId, runDir, argv, before: facts.candidate, versions: ports.stack.fingerprint(ports.root), missing: new Set(missing.map((m) => m.id)) });
        // The baseline may differ from the start only by tests and new files (the minimal scaffolding a new interface needs);
        // a pre-existing source file that changed means the red was not taken on the starting behavior.
        const isNew = (p: string) => facts.inv.status.some((s) => s.path === p && (s.untracked || s.xy.startsWith("A")));
        const contaminated = baseline ? [...facts.att.tenet, ...facts.att.mixed].filter((p) => ports.stack.classify(p) === "source" && !isNew(p) && !(cw.scaffolding ?? []).includes(p)) : [];
        if (baseline && cw.scaffolding?.length) for (const r of receipts) r.limitations.push(`scaffolding declared in existing files: ${cw.scaffolding.slice(0, 3).join(", ")}`);
        if (contaminated.length) for (const r of receipts) { r.status = "inconclusive"; r.reasons.push("evidence-inconclusive"); r.limitations.push(`source changed before the baseline: ${contaminated.slice(0, 3).join(", ")}`); }
        const hasConfigFailure = receipts.some((r) => r.status === "inconclusive");

        // Baseline: a planned red is expected evidence and never counts as an attempt (TS §8.6).
        let obligations = cw.obligations.map((ob) => {
          const r = receipts.find((x) => x.obligation === ob.id);
          if (!r || !baseline) return ob;
          const wantsRed = (ob.expectation ?? "pass") === "fail";
          const behavioral = r.status === "fail" && (r.failures ?? []).length > 0 && (r.failures ?? []).every((f) => f.kind === "assertion");
          const matched = wantsRed ? behavioral : r.status === "pass";
          return { ...ob, baselineMatched: matched, baselineTestHash: ob.testFile ? facts.inv.entries.get(ob.testFile)?.blob : undefined, state: matched ? "verified" as const : ob.state };
        });
        let budget = recordLaunchedChecks(cw.budget, receipts.length);
        const failing = receipts.filter((r) => r.status === "fail");
        const passedAll = !baseline && scope === "full" && receipts.length > 0 && receipts.every((r) => r.status === "pass") && cw.obligations.every((ob) => receipts.some((r) => r.obligation === ob.id));
        if (stage === "candidate" && scope === "full" && !hasConfigFailure) {
          budget = recordAttempt(budget);
          const first = failing[0];
          budget = withSignature(budget, first ? failureSignature(first.obligation, (first.failures ?? []).map((f) => f.test), first.failures?.[0]?.message ?? "") : `pass@${budget.attempts}`);
        }
        const stop = stopFor(budget, cw.lane);

        // Locks: an acceptance test that went red to green is locked whole-file (TS §9.7).
        let locks = st.locks;
        for (const ob of obligations) {
          const r = receipts.find((x) => x.obligation === ob.id);
          if (stage === "candidate" && r?.status === "pass" && ob.testFile && ob.baselineMatched && !locks.some((l) => l.path === ob.testFile)) {
            const blob = facts.inv.entries.get(ob.testFile)?.blob;
            if (blob) { locks = [...locks, { path: ob.testFile, hash: blob, obligation: ob.id, anchor: { provisional: cw.id }, supportInputs: supportOf(ob, facts) }]; obligations = obligations.map((x) => (x.id === ob.id ? { ...x, state: "locked" as const } : x)); }
          }
        }

        // Attention: markers and weakenings, counted net per hunk, plus configuration that decides what runs.
        const paths = facts.tenetPaths;
        const changes = await ports.git.changes(cw.git.base, facts.reviewPaths, ports.stack.classify);
        // Recipe files a scaffold wrote are vetted content; they raise nothing until someone changes them.
        const vetted = ports.project.hashes(Object.keys(cw.vetted));
        const cfg: AttentionItem[] = changes.filter((c) => c.kind === "config" && vetted[c.path] !== cw.vetted[c.path]).map((c) => ({ id: `AT-${hashOf(["cfg", c.path, c.hunks]).slice(0, 8)}`, path: c.path, line: c.hunks[0]?.line ?? 1, pattern: "test or build configuration", marker: false }));
        const declared = (cw.scaffolding ?? []).map((path): AttentionItem => ({ id: `AT-${hashOf(["scaffold", path]).slice(0, 8)}`, path, line: 1, pattern: "declared scaffolding", marker: false }));
        const attention = carryDispositions(cw.attention, [...declared, ...netAttention(changes.filter((c) => !cw.reverting?.includes(c.path)), ports.stack.patterns), ...cfg]);

        let nw: WorkContract = {
          ...cw, obligations, budget, attention, receipts: [...cw.receipts.filter((r) => !receipts.some((n) => n.obligation === r.obligation && n.stage === r.stage && n.scope === r.scope)), ...receipts].slice(-80),
          state: cw.lastValidPhase ?? "executing", session: { generation: cw.session.generation }, updatedAt: ports.clock.now(),
          touched: cw.touched.map((t) => (paths.includes(t.path) && !hasConfigFailure ? { ...t, hashAtLastCheck: facts.inv.entries.get(t.path)?.blob ?? "" } : t)),
          lastCheck: { candidate: facts.candidate, at: ports.clock.now(), stage }, ...(stop ? { stopReason: stop } : {}),
        };

        // Review next? Build the manifest and reserve its delegation (one builder, TS §8.7).
        const reasons: Reason[] = receipts.flatMap((r) => (r.status === "fail" ? baseline ? [] : [reason("evidence-failed", `${r.obligation}: ${(r.failures ?? []).map((f) => f.test).slice(0, 3).join(", ")}`, { refs: [r.obligation] })] : receiptReasons(r)));
        let data: Record<string, unknown> = { stage, scope, receipts: receipts.map((r) => ({ obligation: r.obligation, status: r.status, counts: r.counts, failures: r.failures?.slice(0, 3), reasons: r.reasons })) };
        const next: Array<ReturnType<typeof nx>> = [];
        if (stop) {
          reasons.push(reason(stop === "repeated-failure" ? "repeated-failure" : "budget-exhausted"));
          next.push(nx("finish", "Stop here: finish reports the honest endpoint and a handoff.", true));
        } else if (baseline) {
          const unmatched = obligations.filter((ob) => ob.baselineMatched === false);
          if (unmatched.length) { reasons.push(...unmatched.map((ob) => reason("no-distinguishing-red", `${ob.id}: the test must fail on the baseline with a failed assertion`, { refs: [ob.id] }))); next.push(nx("test", "Fix the acceptance test so it fails for the right reason.", true)); }
          else next.push(nx("implement", "The red is distinguishing. Implement, then check.", true));
        } else if (failing.length || hasConfigFailure) {
          next.push(nx(failing.length ? "implement" : "check", failing.length ? `Fix the failing check (${attemptsLeft(budget, cw.lane)} attempts left).` : "The check could not run cleanly; fix the cause and retry.", true));
        } else if (passedAll) {
          if (cw.lane === "quick") next.push(nx("finish", "Checks pass. Finish to commit and get the result."));
          else {
            const issued = issueReview(ports, st, nw, facts, changes);
            nw = issued.work; next.push(...issued.next); reasons.push(...issued.reasons);
            if (issued.data) data = { ...data, ...issued.data };
          }
        } else {
          next.push(nx(scope === "targeted" ? "check" : "implement", scope === "targeted" ? "Targeted checks pass; run a full check when the pass is done." : "Continue.", false));
        }
        // A prototype's recovery point: every check snapshots the folder into the shadow repository (TS §10.9).
        if (nw.git.mode === "shadow") {
          try { await ports.git.snapshot(`Tenet: ${stage} check`); } catch (e) { if (!(e instanceof KernelError)) throw e; reasons.push(...e.reasons.map((r) => ({ ...r, note: true }))); }
        }
        if (nearLimit(nw.budget, nw.lane)) reasons.push(reason("budget-warning", "80% of a limit is used", { note: true }));
        // At a stop, and at 80% of any limit, the handoff is written while there is still budget to write it (WRK-12).
        if (stop || nearLimit(nw.budget, nw.lane)) nw = { ...nw, handoff: handoffText(withWork(st, nw), nw) };
        if (stage === "integrated" && passedAll && nw.git.integrated) nw = { ...nw, git: { ...nw.git, integrated: { ...nw.git.integrated, validated: true } } };
        const out: State = { ...withWork(st, nw), locks };
        return { state: out, resp: { work: nw.id, reasons, next, data, progress: { phase: "checking", ...(passedAll ? { boundary: "milestone" as const } : {}) }, ...(stop ? { exit: 2 as const } : {}), ...(rec.completed.length ? { effects: { completed: rec.completed, uncertain: rec.uncertain } } : {}) } };
      },
    };
    return { state: withWork(cur, prepared), resp: { work: w.id, progress: { phase: "checking" }, next: [] }, job };
  },
};
