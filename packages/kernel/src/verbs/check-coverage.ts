import { receiptsFrom, settleReruns } from "../core/receipts.ts";
import type { ReceiptContext } from "../core/receipts.ts";
import type { Obligation, Receipt } from "../core/schemas.ts";
import type { RecipeCoverageCheck } from "../ports/types.ts";
import type { CoverageAttempt, Executed, Run } from "./check-evidence.ts";

export function receiptContext(run: Run, argv: string[]): ReceiptContext {
  const { ports, facts, stage, scope, runId, runDir, executionEnvelope } = run;
  return {
    stage, scope, id: run.id, candidate: facts.candidate, runId, runDir, argv, before: facts.candidate,
    versions: run.versions ?? ports.stack.fingerprint(ports.root), executionEnvelope, missing: new Set<string>(),
  };
}

function coverageAttempt(
  run: Run,
  obligation: Obligation,
  check: RecipeCoverageCheck,
  attempt: CoverageAttempt,
): Receipt {
  const raw = attempt.facts.raw;
  const norm = raw === null ? null : check.tool === "playwright"
    ? run.ports.stack.normalizeE2e({ exit: attempt.facts.exit, raw }, run.ports.root)
    : run.ports.stack.normalize(raw, run.ports.root);
  const ctx = receiptContext(run, run.ports.stack.coverageArgv(run.ports.root, check, attempt.report) ?? []);
  if (check.tool === "playwright") {
    ctx.versions = {
      ...ctx.versions,
      tool: `playwright@${ctx.versions.static.playwright ?? "none"}`,
      reporter: "playwright-json",
    };
  }
  return receiptsFrom(attempt.facts, norm, [obligation], ctx)[0]!;
}

export function coverageReceipts(run: Run, executed: Executed, firstIndex: number): Receipt[] {
  const out: Receipt[] = [];
  for (const mapping of run.coverage ?? []) {
    const primary = run.toRun.find((obligation) => obligation.id === mapping.obligation);
    const attempts = executed.coverage?.[mapping.id];
    if (!primary || !attempts) continue;
    const primarySettled = settleReruns(
      [coverageAttempt(run, primary, mapping.primary, attempts.primary[0]!)],
      attempts.primary.slice(1).map((attempt) => [coverageAttempt(run, primary, mapping.primary, attempt)]),
    )[0]!;
    primarySettled.id = `RC-${run.runId}-${firstIndex + out.length + 1}`;
    out.push(primarySettled);
    if (!attempts.alternative?.length) continue;
    const alternative: Obligation = {
      ...primary,
      id: `${primary.id}-alternative`,
      tool: "playwright",
      testFile: mapping.alternative.file,
      coverageTag: mapping.alternative.tag,
    };
    const alternativeSettled = settleReruns(
      [coverageAttempt(run, alternative, mapping.alternative, attempts.alternative[0]!)],
      attempts.alternative.slice(1).map((attempt) => [coverageAttempt(run, alternative, mapping.alternative, attempt)]),
    )[0]!;
    alternativeSettled.id = `RC-${run.runId}-${firstIndex + out.length + 1}`;
    out.push(alternativeSettled);
  }
  return out;
}
