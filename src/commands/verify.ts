import { readFile } from "node:fs/promises";
import { git } from "../core/git.js";
import { message } from "../core/messages.js";
import { version } from "../core/output.js";
import { loadPolicy, verifyLock } from "../policy/index.js";
import type { Finding } from "../types/generated.js";
import type { VerifyDeps } from "../verify/bundle.js";
import { renderCheckSummary } from "../verify/card.js";
import { GitHubForge, githubRequest, workflowRun } from "../verify/forge.js";
import { record, type VerifyEvent } from "../verify/record.js";
import { GitRecords } from "../verify/records.js";
import { bundleExisting, runChecks, type RunChecksOptions } from "../verify/run-checks.js";

async function pending(): Promise<never> {
  throw new Error("CP-0009 check and CP-0044 specification exports are not wired");
}
// TODO(CP-0009, CP-0044): replace this object with { check, touched, deltas, parseDoc, sectionDigest } once their exports land.
const deps: VerifyDeps = { check: pending, touched: pending, deltas: pending };

function object(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
}
function oid(input: unknown): string {
  if (typeof input !== "string" || !/^(?!0+$)(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input)) throw new Error("CI event has an invalid commit");
  return input;
}
function number(input: unknown, minimum: number): number {
  const value = typeof input === "number" || typeof input === "string" && /^\d+$/.test(input) ? Number(input) : NaN;
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error("CI event has an invalid run or pull request number");
  return value;
}
function required(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) throw new Error("CI event information is missing");
  return input;
}
function usage(detail: string): { findings: Finding[]; exitCode: number } {
  const code = "TN-USAGE-VERIFY";
  return {
    findings: [{ code, severity: "error", rule: null, file: null, line: null, ...message(code, { command: "verify", detail }) }],
    exitCode: 2,
  };
}

export function recorderEvent(event: Record<string, unknown>, env: NodeJS.ProcessEnv): VerifyEvent {
  const repository = required(env.GITHUB_REPOSITORY);
  if (object(event.repository).full_name !== repository) throw new Error("CI event repository differs from the current repository");
  if (env.GITHUB_EVENT_NAME === "pull_request_target" && event.action === "edited") {
    return { kind: "edited", repository, number: number(event.number ?? object(event.pull_request).number, 1) };
  }
  if (env.GITHUB_EVENT_NAME !== "workflow_run" || event.action !== "completed") throw new Error("expected a completed workflow or edited pull request");
  const raw = object(event.workflow_run);
  const run = workflowRun({ ...raw, repository: raw.repository ?? event.repository });
  const pulls = Array.isArray(raw.pull_requests) ? raw.pull_requests.map((item) => number(object(item).number, 1)) : [];
  return { kind: "workflow_run", repository, run, pulls };
}

async function producerOptions(event: Record<string, unknown>, env: NodeJS.ProcessEnv, cwd: string): Promise<RunChecksOptions> {
  const gitOptions = { cwd };
  const repository = required(env.GITHUB_REPOSITORY);
  if (repository !== object(event.repository).full_name) throw new Error("CI event repository differs from the current repository");
  if (env.GITHUB_EVENT_NAME !== "pull_request" && env.GITHUB_EVENT_NAME !== "push") throw new Error("expected a pull request or push event");
  const pr = object(event.pull_request);
  const tested = oid((await git(["rev-parse", "HEAD"], gitOptions)).trim());
  const hasPull = env.GITHUB_EVENT_NAME === "pull_request";
  const head = hasPull ? oid(object(pr.head).sha) : oid(event.after);
  const base = hasPull ? oid(object(pr.base).sha) : oid(event.before);
  if ((!hasPull && tested !== head) || (env.GITHUB_SHA && oid(env.GITHUB_SHA) !== tested)) throw new Error("checkout differs from the CI subject");
  const rawOutcome = env.TENET_TEST_OUTCOME;
  const outcome = rawOutcome === "success" || rawOutcome === "failure" || rawOutcome === "cancelled" || rawOutcome === "skipped" ? rawOutcome : undefined;
  return {
    cwd, repository, ci: true, ...(outcome ? { outcome } : {}),
    ...(hasPull ? { pr: number(event.number ?? pr.number, 1) } : {}),
    tested: { commit: tested, kind: tested === head ? "head" : "merge-candidate", head, base },
    run: { id: String(number(env.GITHUB_RUN_ID, 1)), attempt: number(env.GITHUB_RUN_ATTEMPT, 1),
      workflow: required(env.GITHUB_WORKFLOW), job: required(env.GITHUB_JOB), index: number(env.TENET_JOB_INDEX ?? "0", 0) },
  };
}

type VerifyCommandContext = {
  args: string[];
  options: Record<string, string | boolean | string[]>;
  cwd: string;
  now: () => Date;
};

async function verify(context: VerifyCommandContext) {
  const modes = ["run-checks", "bundle", "record"].filter((flag) => context.options[flag] === true);
  if (modes.length !== 1 || context.args.length) return usage("choose exactly one of --run-checks, --bundle, or --record");
  let event: Record<string, unknown>;
  try {
    event = object(JSON.parse(await readFile(required(process.env.GITHUB_EVENT_PATH), "utf8")));
  } catch { return usage("provide a readable CI event file"); }
  const cwd = context.cwd;
  if (modes[0] === "record") {
    let parsed: VerifyEvent;
    try { parsed = recorderEvent(event, process.env); }
    catch (error) { return usage(error instanceof Error ? error.message : "invalid recorder event"); }
    const token = process.env.TENET_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) return usage("provide the recorder's GitHub token");
    const result = await record(parsed, deps, {
      cwd, now: context.now, version, render: renderCheckSummary,
      forge: new GitHubForge(parsed.repository, githubRequest(token, process.env.GITHUB_API_URL)),
      records: new GitRecords(cwd),
    });
    return { value: { evaluation_id: result.card.evaluation_id, conclusion: result.conclusion, wrote: result.wrote } };
  }

  let options: RunChecksOptions;
  try { options = await producerOptions(event, process.env, cwd); }
  catch (error) { return usage(error instanceof Error ? error.message : "invalid test job event"); }
  try { await git(["cat-file", "-e", `${options.tested.base}^{commit}`], { cwd }); }
  catch { await git(["fetch", "--no-tags", "--filter=blob:none", "origin", options.tested.base], { cwd }); }
  const policy = await loadPolicy({ cwd, ref: options.tested.base });
  await verifyLock({ cwd, ref: options.tested.base });
  if (options.pr !== undefined && (policy.level === "observe" || policy.level === "protect")) {
    const proposal = await loadPolicy({ cwd, ref: options.tested.commit }).catch(() => undefined);
    if (proposal?.checks) options.proposed = proposal.checks;
  }
  const result = await (modes[0] === "run-checks" ? runChecks : bundleExisting)(policy, options, deps);
  const findings: Finding[] = [];
  for (const check of result.bundle.checks) {
    const configured = policy.checks?.[check.name] ?? options.proposed?.[check.name];
    const file = configured?.report_path ?? `.tenet/reports/${check.name}.${configured?.report === "junit" ? "xml" : "json"}`;
    if (check.outcome === "report-missing" || check.outcome === "report-malformed") {
      const code = check.outcome === "report-missing" ? "TN-REPORT-MISSING" : "TN-REPORT-MALFORMED";
      findings.push({ code, severity: "warning", rule: null, file, line: null, ...message(code, { path: file, kind: configured?.report ?? "" }) });
    }
  }
  return { value: result.bundle, findings, exitCode: result.bundle.checks.some((check) => check.outcome !== "success") ? 1 : 0 };
}

export const verifyCommand = {
  name: "verify", description: "Run checks, collect a bundle, or record CI proof.",
  options: ["--run-checks", "--bundle", "--record"], network: true, handler: verify,
};
