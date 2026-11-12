// Counting a finished check (TS §8.6): launched checks, the candidate attempt and its failure signature.
import { failureSignature, recordAttempt, recordLaunchedChecks, stopFor, withSignature } from "../core/budget.ts";
import { spared } from "../core/baseline.ts";
import type { BaselineCtx } from "../core/baseline.ts";
import type { BudgetState, Receipt, StopReason, WorkContract } from "../core/schemas.ts";
import { isSharedTest } from "./check-evidence.ts";
import type { Executed, Run } from "./check-evidence.ts";

/** Launched checks always count; a full candidate run that could run counts one attempt and its failure signature (TS §8.6). */
export function account(
  run: Run,
  cw: WorkContract,
  o: Executed,
  receipts: Receipt[],
  configFailed: boolean,
  ctx: BaselineCtx = {}
): { budget: BudgetState; stop: StopReason | undefined } {
  const ranTests = o.ran ? run.toRun.filter((ob) => isSharedTest(ob) && !run.missing.some((m) => m.id === ob.id)).length : 0;
  const reran = (o.reruns ?? []).reduce((n, r) => n + r.obligations.length, 0); // each rerun obligation is a launched check (PRD §4.4.1)
  const sealed = o.sealed?.run?.ran ? 1 : 0; // the starting-tree run is one launched check (EVD-04)
  const launched = ranTests + reran + sealed + run.toRun.filter((ob) => !isSharedTest(ob) && o.statics[ob.id]?.ran).length;
  let budget = recordLaunchedChecks(cw.budget, launched);
  const failing = receipts.filter((r) => r.status === "fail");
  const allSpared = failing.length > 0 && failing.every((r) => spared(r, ctx)); // failures that also fail at the start cost no attempt
  if (run.stage === "candidate" && run.scope === "full" && !configFailed && !allSpared) {
    budget = recordAttempt(budget);
    // an attempt that failed before a flaky pass still counts as a failure for the repeated-failure signature
    const first = failing.find((r) => !spared(r, ctx)) ?? receipts.find((r) => r.qualifiers.includes("flaky"));
    const names = first?.status === "fail" ? (first.failures ?? []).map((f) => f.test) : (first?.history?.[0]?.failed ?? []);
    budget = first
      ? withSignature(
          budget,
          failureSignature(
            first.obligation,
            names,
            first.failures?.[0]?.message ?? ""
          )
        )
      : { ...budget, signatures: [] };
  }
  return { budget, stop: stopFor(budget, cw.lane) };
}
