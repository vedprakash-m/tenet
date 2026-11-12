// Executing a check run outside the lock (TS §6.1): returns what the processes did as facts; receipts are read from them in finalize.
import { join } from "node:path";
import { notRunFacts } from "../core/receipts.ts";
import type { RunFacts } from "../core/receipts.ts";
import type { Obligation } from "../core/schemas.ts";
import type { RunResult, StaticTool } from "../ports/types.ts";
import { isE2e, isStatic, isWorkload, staticReport, e2eReport } from "./check-evidence.ts";
import type { Executed, Run } from "./check-evidence.ts";
import { digestAfter, rerunFailures } from "./check-rerun.ts";

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
async function runE2e(run: Run): Promise<Omit<RunFacts, "after">> {
  const { ports, runDir } = run;
  const report = e2eReport(runDir);
  const argv = ports.stack.e2eArgv(ports.root, report);
  if (!argv) return { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, ran: false };
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await ports.runner.allocatePort();
    const env = {
      PORT: String(port), DATABASE_URL: join(runDir, "e2e.db"), TENET_RUN_TOKEN: ports.rand.base32(16),
      PLAYWRIGHT_JSON_OUTPUT_NAME: report,
    };
    const r = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: E2E_TIMEOUT_MS, report, env });
    if (!/EADDRINUSE/.test(r.stderr)) return observed(r, r.report);
  }
  return { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, ran: false };
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
  for (const ob of run.toRun.filter((o) => isStatic(o) && !isE2e(o))) statics[ob.id] = await runStatic(run, ob);
  for (const ob of run.toRun.filter(isE2e)) statics[ob.id] = await runE2e(run);
  // The workload runs only once every other required obligation's process passed: no run is spent on a failing candidate.
  const workload = run.toRun.find(isWorkload);
  if (workload && settledPass(observed(r, r.report)) && Object.values(statics).every(settledPass))
    statics[workload.id] = await runWorkload(run);
  const { digest: after, moved } = await digestAfter(run, inputs);
  const first: RunFacts = { ...observed(r, r.report), after };
  const reruns = await rerunFailures(run, first, inputs, (x) => observed(x, x.report));
  return {
    ...first,
    statics: Object.fromEntries(Object.entries(statics).map(([id, s]) => [id, { ...s, after }])),
    ...(reruns.length ? { reruns } : {}),
    ...(after !== run.facts.candidate ? { moved } : {}),
  };
}
