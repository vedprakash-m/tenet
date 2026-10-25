// Reruns of a failed required test (EVD-08, TS §9.9) and the end-of-run comparison of inputs (EVD-11). Only the failing obligations'
// files rerun, at most twice, on inputs that must still equal the candidate's; planned reds, timeouts, kills and moved inputs never rerun.
import { join } from "node:path";
import { hashOf } from "../core/ids.ts";
import { declaredOutputs, movedPaths } from "../core/outputs.ts";
import type { RunFacts } from "../core/receipts.ts";
import type { Ports, RunResult } from "../ports/types.ts";
import { failedAmong, isStatic } from "./check-evidence.ts";
import type { Rerun, Run } from "./check-evidence.ts";

const MAX_RERUNS = 2;
const FIRST_RUN_LIMIT_MS = 120_000;
const RERUN_TIMEOUT_MS = 10 * 60_000;

/** A fingerprint of the toolchain, or a marker when it cannot be read: either way a change from the prepared one is a moved input. */
export function toolchainOf(ports: Ports): string {
  try { return hashOf(ports.stack.fingerprint(ports.root)); } catch { return "unreadable"; }
}

/** The inventory digest after a run, tagged when the toolchain moved since the run was prepared, so the receipt rule sees an edit
 * during the run; `moved` names (up to 5) what changed, so a `concurrent-edit` says which file (EVD-09, EVD-11). */
export async function digestAfter(run: Run, inputs: readonly string[]): Promise<{ digest: string; moved: string[] }> {
  const inv = await run.ports.git.inventory([], inputs, declaredOutputs(run.w.obligations));
  const moved = movedPaths(run.facts.inv.entries, inv.entries);
  const tool = toolchainOf(run.ports) === run.toolchain;
  return { digest: tool ? inv.digest : `${inv.digest}+toolchain`, moved: [...moved, ...(tool ? [] : ["the installed toolchain"])] };
}

type Observe = (r: RunResult) => Omit<RunFacts, "after">;

export async function rerunFailures(run: Run, first: RunFacts, inputs: readonly string[], observed: Observe): Promise<Rerun[]> {
  const { ports, runDir } = run;
  const settled = first.ran && !first.timedOut && !first.signal && !first.outputTruncated && first.after === run.facts.candidate;
  if (run.stage === "baseline" || !settled || first.durationMs > FIRST_RUN_LIMIT_MS) return [];
  const tests = run.toRun.filter((ob) => !isStatic(ob));
  let failing = failedAmong(run, first, tests, run.toExecute, join(runDir, "vitest.json"));
  const out: Rerun[] = [];
  for (let i = 1; i <= MAX_RERUNS && failing.length; i++) {
    const toExecute = failing.every((ob) => ob.testFile) ? failing.map((ob) => ob.testFile!) : run.toExecute;
    const report = join(runDir, `vitest-rerun-${i}.json`);
    const timeoutMs = Math.min(RERUN_TIMEOUT_MS, Math.max(30_000, 2 * first.durationMs));
    const r = await ports.runner.run({ argv: ports.stack.argv(toExecute, report), cwd: ports.root, runDir, timeoutMs, report });
    const facts: RunFacts = { ...observed(r), after: (await digestAfter(run, inputs)).digest };
    out.push({ facts, obligations: failing.map((ob) => ob.id), toExecute, report });
    if (!facts.ran || facts.timedOut || facts.after !== run.facts.candidate) break;
    failing = failedAmong(run, facts, failing, toExecute, report);
  }
  return out;
}
