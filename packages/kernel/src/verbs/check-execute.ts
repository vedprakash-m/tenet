import { join } from "node:path";
import { notRunFacts } from "../core/receipts.ts";
import type { RunFacts } from "../core/receipts.ts";
import type { Obligation } from "../core/schemas.ts";
import type { RunResult, StaticTool } from "../ports/types.ts";
import { isE2e, isStatic, isWorkload, staticReport, e2eReport } from "./check-evidence.ts";
import type { CoverageAttempt, CoverageExecuted, E2eAttempt, Executed, Run } from "./check-evidence.ts";
import { digestAfter, rerunFailures } from "./check-rerun.ts";
import { sealedRun } from "./check-sealed.ts";
const TIMEOUT_MS = 10 * 60_000;
/** What the process did, whatever it was. `raw` is the output the tool's own report format is read from. */
const observed = (r: RunResult, raw: string | null): Omit<RunFacts, "after"> => ({
  outputTruncated: r.outputTruncated,
  ...(r.exit !== undefined ? { exit: r.exit } : {}),
  ...(r.signal ? { signal: r.signal } : {}),
  timedOut: r.timedOut,
  durationMs: r.durationMs,
  ...(r.pid ? { pid: r.pid } : {}),
  startedAt: r.startedAt,
  raw,
  ran: r.exit !== undefined || !!r.signal,
});
/** One static tool over the whole project; a tool that is not installed did not run. */
async function runStatic(run: Run, ob: Obligation): Promise<Omit<RunFacts, "after">> {
  const { ports, runDir } = run;
  const tool = ob.tool as StaticTool, report = staticReport(runDir, tool);
  const command = ports.stack.staticArgv(ports.root, tool, report);
  if (!Array.isArray(command)) return notRunFacts(ports.clock.now(), command?.unsupportedConfig);
  const argv = command;
  const r = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS, report });
  return observed(r, ports.stack.staticOutput(tool, r));
}
const E2E_TIMEOUT_MS = 10 * 60_000;
/** Playwright over the whole project, against a server Tenet starts and verifies for this candidate, on a
 * dedicated test database — never the developer's own (EVD-13, TS §9.3 Servers). A lost port race is retried. */
async function launchE2e(run: Run, attempt: number, inputs: readonly string[]): Promise<E2eAttempt> {
  const { ports, runDir } = run;
  const baseReport = attempt === 1 ? e2eReport(runDir) : join(runDir, `playwright-rerun-${attempt - 1}.json`);
  const initialArgv = ports.stack.e2eArgv(ports.root, baseReport);
  if (!initialArgv) return {
    report: baseReport,
    launches: 0,
    facts: { ...notRunFacts(ports.clock.now()), after: run.facts.candidate },
  };
  let launches = 0;
  for (let portAttempt = 0; portAttempt < 3; portAttempt++) {
    const report = portAttempt === 0 ? baseReport : join(
      runDir,
      `${attempt === 1 ? "playwright" : `playwright-rerun-${attempt - 1}`}-port-${portAttempt + 1}.json`,
    );
    const argv = ports.stack.e2eArgv(ports.root, report);
    if (!argv) return { report, launches, facts: { ...notRunFacts(ports.clock.now()), after: run.facts.candidate } };
    const port = await ports.runner.allocatePort();
    const env = {
      PORT: String(port),
      DATABASE_URL: join(
        runDir,
        attempt === 1 && portAttempt === 0 ? "e2e.db" : `e2e-${attempt}-${portAttempt}.db`,
      ),
      TENET_RUN_TOKEN: ports.rand.base32(16),
      PLAYWRIGHT_JSON_OUTPUT_NAME: report,
    };
    launches++;
    const r = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: E2E_TIMEOUT_MS, report, env });
    if (!/EADDRINUSE/.test(r.stderr)) {
      const first = observed(r, r.report);
      return { report, launches, facts: { ...first, after: (await digestAfter(run, inputs)).digest } };
    }
  }
  return {
    report: join(runDir, `${attempt === 1 ? "playwright" : `playwright-rerun-${attempt - 1}`}-port-3.json`),
    launches,
    facts: { ...notRunFacts(ports.clock.now()), after: run.facts.candidate },
  };
}

export function e2eStatus(run: Run, attempt: E2eAttempt): CoverageStatus {
  const facts = attempt.facts;
  if (!facts.ran || facts.timedOut || facts.signal || facts.outputTruncated || facts.after !== run.facts.candidate ||
      facts.raw === null) return "other";
  const normalized = run.ports.stack.normalizeE2e({ exit: facts.exit, raw: facts.raw }, run.ports.root);
  if (normalized.invalid) return "other";
  const files = [...normalized.files.values()];
  if (files.some((file) => file.focused) || files.some((file) => file.skipped > 0)) return "other";
  const failed = files.reduce((count, file) => count + file.failed, 0);
  if ((failed > 0) === (facts.exit === 0)) return "other";
  if (failed) return "failed";
  const passed = files.reduce((count, file) => count + file.passed, 0);
  return passed > 0 ? "passed" : "other";
}

export async function runE2eAttempts(run: Run, inputs: readonly string[]): Promise<E2eAttempt[]> {
  const attempts: E2eAttempt[] = [];
  const limit = run.stage === "baseline" ? 1 : 3;
  for (let attempt = 1; attempt <= limit; attempt++) {
    const next = await launchE2e(run, attempt, inputs);
    attempts.push(next);
    if (e2eStatus(run, next) !== "failed" || next.facts.durationMs > 120_000) break;
  }
  return attempts;
}

type CoverageStatus = "failed" | "passed" | "other";

export function coverageStatus(run: Run, attempt: CoverageAttempt): CoverageStatus {
  const { facts, check } = attempt;
  if (!facts.ran || facts.timedOut || facts.signal || facts.outputTruncated || facts.after !== run.facts.candidate)
    return "other";
  if (facts.raw === null) return "other";
  const raw = facts.raw;
  const norm = check.tool === "playwright"
    ? run.ports.stack.normalizeE2e({ exit: facts.exit, raw }, run.ports.root)
    : run.ports.stack.normalize(raw, run.ports.root);
  if (norm.invalid) return "other";
  const file = norm.files.get(check.file);
  const selected = file?.outcomes?.filter((test) => test.test.includes(`[${check.tag}]`)) ?? [];
  if (selected.length !== 1 || file?.focused || [...norm.files.values()].some((entry) => entry.focused)) return "other";
  const status = selected[0]!.status;
  if ((status === "passed") !== (facts.exit === 0)) return "other";
  return status === "failed" ? "failed" : status === "passed" ? "passed" : "other";
}
  async function launchCoverage(
    run: Run,
    mapping: NonNullable<Run["coverage"]>[number],
    role: "primary" | "alternative",
    attempt: number,
    inputs: readonly string[],
  ): Promise<CoverageAttempt> {
    const { ports, runDir } = run;
    const check = mapping[role];
    const baseReport = join(runDir, `coverage-${mapping.id}-${role}-${attempt}.json`);
    const initialArgv = ports.stack.coverageArgv(ports.root, check, baseReport);
    if (!initialArgv) {
      return {
        check,
        report: baseReport,
        launches: 0,
        facts: { ...notRunFacts(ports.clock.now()), after: run.facts.candidate },
      };
    }
    let observedRun: RunResult;
    let launches = 0;
    if (check.tool === "playwright") {
      let last: RunResult | undefined;
      let report = baseReport;
      for (let portAttempt = 0; portAttempt < 3; portAttempt++) {
        report = portAttempt === 0
          ? baseReport
          : join(runDir, `coverage-${mapping.id}-${role}-${attempt}-port-${portAttempt + 1}.json`);
        const argv = ports.stack.coverageArgv(ports.root, check, report);
        if (!argv) {
          return {
            check, report, launches,
            facts: { ...notRunFacts(ports.clock.now()), after: run.facts.candidate },
          };
        }
        const port = await ports.runner.allocatePort();
        const env = {
          PORT: String(port),
          DATABASE_URL: join(runDir, `coverage-${mapping.id}-${role}-${attempt}-${portAttempt}.db`),
          TENET_RUN_TOKEN: ports.rand.base32(16),
          PLAYWRIGHT_JSON_OUTPUT_NAME: report,
        };
        last = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: E2E_TIMEOUT_MS, report, env });
        launches++;
        if (!/EADDRINUSE/.test(last.stderr)) break;
      }
      observedRun = last!;
      return {
        check, report, launches,
        facts: { ...observed(observedRun, observedRun.report), after: (await digestAfter(run, inputs)).digest },
      };
    } else {
      observedRun = await ports.runner.run({
        argv: initialArgv, cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS, report: baseReport,
      });
      launches = 1;
    }
    const first = observed(observedRun, observedRun.report);
    return { check, report: baseReport, launches, facts: { ...first, after: (await digestAfter(run, inputs)).digest } };
  }
  async function executeCoverageRole(
    run: Run,
    mapping: NonNullable<Run["coverage"]>[number],
    role: "primary" | "alternative",
    inputs: readonly string[],
  ): Promise<CoverageAttempt[]> {
    const attempts: CoverageAttempt[] = [];
    const limit = run.stage === "baseline" ? 1 : 3;
    for (let attempt = 1; attempt <= limit; attempt++) {
      const next = await launchCoverage(run, mapping, role, attempt, inputs);
      attempts.push(next);
      const status = coverageStatus(run, next);
      if (status !== "failed" || next.facts.durationMs > 120_000) break;
    }
    return attempts;
  }
  async function executeCoverage(run: Run, inputs: readonly string[]): Promise<Executed["coverage"]> {
    const out: Record<string, CoverageExecuted> = {};
    for (const mapping of run.coverage ?? []) {
      const primary = await executeCoverageRole(run, mapping, "primary", inputs);
      const finalPrimary = primary.at(-1)!;
      const flakyPrimary = run.stage !== "baseline" &&
        primary.length > 1 &&
        coverageStatus(run, primary[0]!) === "failed" &&
        coverageStatus(run, finalPrimary) === "passed";
      out[mapping.id] = {
        primary,
        ...(flakyPrimary ? { alternative: await executeCoverageRole(run, mapping, "alternative", inputs) } : {}),
      };
    }
  return out;
}
/** The declared workload (QLT-05): its build, then its run, in this run directory under one declared timeout; no shell.
 * The report is what the run prints. A failed build leaves no report, so the receipt cannot pass. */
async function runWorkload(run: Run): Promise<Omit<RunFacts, "after">> {
  const { ports, runDir } = run;
  if (!run.workload?.ok) return notRunFacts(ports.clock.now());
  const { build, run: argv, timeoutMs } = run.workload.decl;
  let left = timeoutMs;
  if (build) {
    const b = await ports.runner.run({ argv: build, cwd: ports.root, runDir, timeoutMs: left });
    if (b.exit !== 0 || b.timedOut || b.signal) return observed(b, null);
    left = Math.max(1000, left - b.durationMs);
  }
  const r = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: left });
  return observed(r, r.stdout);
}

const settledPass = (f: Omit<RunFacts, "after">): boolean => f.ran && f.exit === 0 && !f.timedOut && !f.signal && !f.outputTruncated;
/** Runs the named test files (or everything) once, outside the lock, then each static check, and reports what the processes did. */
export async function execute(run: Run, inputs: readonly string[]): Promise<Executed> {
  const { ports, runDir, toExecute, facts } = run;
  if (toExecute !== "all" && !toExecute.length)
    return { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, after: facts.candidate, ran: false, statics: {} };
  const report = join(runDir, "vitest.json");
  const r = await ports.runner.run({ argv: ports.stack.argv(toExecute, report), cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS, report });
  const statics: Record<string, Omit<RunFacts, "after">> = {};
  const coverage = await executeCoverage(run, inputs);
  for (const ob of run.toRun.filter((o) => isStatic(o) && !isE2e(o))) statics[ob.id] = await runStatic(run, ob);
  const e2e: Record<string, E2eAttempt[]> = {};
  for (const ob of run.toRun.filter(isE2e)) {
    const attempts = await runE2eAttempts(run, inputs);
    e2e[ob.id] = attempts;
    statics[ob.id] = attempts[0]!.facts;
  }
  // The workload runs only once every other required obligation's process passed: no run is spent on a failing candidate.
  const workload = run.toRun.find(isWorkload);
  if (workload && settledPass(observed(r, r.report)) && Object.values(statics).every(settledPass))
    statics[workload.id] = await runWorkload(run);
  const { digest: after, moved } = await digestAfter(run, inputs);
  const first: RunFacts = { ...observed(r, r.report), after };
  const reruns = await rerunFailures(run, first, inputs, (x) => observed(x, x.report));
  const out: Executed = {
    ...first,
    statics: Object.fromEntries(Object.entries(statics).map(([id, s]) => [id, { ...s, after }])),
    ...(Object.keys(coverage ?? {}).length ? { coverage } : {}),
    ...(Object.keys(e2e).length ? { e2e } : {}),
    ...(reruns.length ? { reruns } : {}),
    ...(after !== run.facts.candidate ? { moved } : {}),
  };
  const sealed = await sealedRun(run, out, inputs);
  return sealed ? { ...out, sealed } : out;
}
