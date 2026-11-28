import { commandHelp } from "../core/cli-help.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { git } from "../core/git.js";
import { message } from "../core/messages.js";
import { version } from "../core/output.js";
import { loadPolicy, verifyLock, type Policy } from "../policy/index.js";
import { check } from "../specs/check.js";
import { deltas } from "../specs/deltas.js";
import { parseDoc } from "../specs/parse.js";
import { sectionDigest } from "../specs/sections.js";
import { touched } from "../specs/touched.js";
import type { Finding, ProofCard } from "../types/generated.js";
import { decodeBundle, type BundleData, type VerifyDeps } from "../verify/bundle.js";
import { renderCard, renderCheckSummary } from "../verify/card.js";
import { GitHubForge, githubRequest, workflowRun, type ForgeAdapter } from "../verify/forge.js";
import { record, type VerifyEvent } from "../verify/record.js";
import { GitRecords, type RecordsStore } from "../verify/records.js";
import { bundleExisting, runChecks, type RunChecksOptions } from "../verify/run-checks.js";

const deps: VerifyDeps = { check, touched, deltas, parseDoc, sectionDigest };

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
  json: boolean;
  now: () => Date;
};

async function gitOptional(args: string[], cwd: string): Promise<string | null> {
  try {
    return (await git(args, { cwd })).trim() || null;
  } catch {
    return null;
  }
}

async function localDefaultBranch(cwd: string): Promise<string> {
  const remoteHead = await gitOptional(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], cwd);
  if (remoteHead) {
    const slash = remoteHead.indexOf("/");
    const branch = slash >= 0 ? remoteHead.slice(slash + 1) : remoteHead;
    if (branch && await gitOptional(["rev-parse", "--verify", "--quiet", branch], cwd)) return branch;
    if (await gitOptional(["rev-parse", "--verify", "--quiet", remoteHead], cwd)) return remoteHead;
  }
  for (const candidate of ["main", "master", "origin/main", "origin/master"]) {
    if (await gitOptional(["rev-parse", "--verify", "--quiet", candidate], cwd)) return candidate;
  }
  return await gitOptional(["branch", "--show-current"], cwd) ?? "HEAD";
}

async function workingTreePreviewCommit(cwd: string, head: string, now: () => Date): Promise<string> {
  const scratch = await mkdtemp(path.join(tmpdir(), "tenet-local-index-"));
  const env: NodeJS.ProcessEnv = {
    GIT_INDEX_FILE: path.join(scratch, "index"),
    GIT_AUTHOR_NAME: "Tenet Local Preview",
    GIT_AUTHOR_EMAIL: "local@tenet.invalid",
    GIT_COMMITTER_NAME: "Tenet Local Preview",
    GIT_COMMITTER_EMAIL: "local@tenet.invalid",
    GIT_AUTHOR_DATE: now().toISOString(),
    GIT_COMMITTER_DATE: now().toISOString(),
  };
  try {
    await git(["read-tree", head], { cwd, env });
    await git(["add", "-A"], { cwd, env });
    const tree = (await git(["write-tree"], { cwd, env })).trim();
    const headTree = (await git(["rev-parse", `${head}^{tree}`], { cwd })).trim();
    if (tree === headTree) return head;
    return (await git(["commit-tree", tree, "-p", head, "-m", "tenet local preview"], { cwd, env })).trim();
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

function checkFindings(bundle: BundleData["bundle"], policy: Policy, proposed?: Policy["checks"]): Finding[] {
  const findings: Finding[] = [];
  for (const entry of bundle.checks) {
    const configured = policy.checks?.[entry.name] ?? proposed?.[entry.name];
    const file = configured?.report_path ?? `.tenet/reports/${entry.name}.${configured?.report === "junit" ? "xml" : "json"}`;
    if (entry.outcome === "report-missing" || entry.outcome === "report-malformed") {
      const code = entry.outcome === "report-missing" ? "TN-REPORT-MISSING" : "TN-REPORT-MALFORMED";
      findings.push({ code, severity: "warning", rule: null, file, line: null, ...message(code, { path: file, kind: configured?.report ?? "" }) });
    }
  }
  return findings;
}

function localForge(decoded: BundleData): ForgeAdapter {
  const emptyPr = { number: 0, base: decoded.bundle.tested.base, head: decoded.bundle.tested.head, body: "" };
  return {
    getPullRequest: async () => emptyPr,
    findPullRequests: async () => [],
    latestRun: async () => null,
    downloadBundles: async () => ({ total: 1, missing: 0, bundles: [decoded] }),
    upsertCheckRun: async () => {},
  };
}

function memoryRecords(): RecordsStore {
  return {
    read: async () => ({ tip: null, files: {} }),
    write: async () => true,
  };
}

async function runLocalVerify(context: VerifyCommandContext) {
  const cwd = context.cwd;
  const head = await gitOptional(["rev-parse", "--verify", "HEAD^{commit}"], cwd);
  if (!head) {
    const words = message("TN-ENV-NO-COMMIT");
    return { findings: [{ code: "TN-ENV-NO-COMMIT", severity: "error" as const, rule: null, file: null, line: null, ...words }], exitCode: 3 };
  }
  const branch = await localDefaultBranch(cwd);
  const base = await gitOptional(["merge-base", head, branch], cwd)
    ?? await gitOptional(["rev-parse", "--verify", `${branch}^{commit}`], cwd)
    ?? head;
  const previewCommit = await workingTreePreviewCommit(cwd, head, context.now);
  const workingPolicy = await loadPolicy({ cwd });
  await verifyLock({ cwd });
  const hasBasePolicy = await git(["cat-file", "-e", `${base}:tenet.yaml`], { cwd }).then(() => true, () => false);
  const basePolicy = hasBasePolicy ? await loadPolicy({ cwd, ref: base }) : null;
  const checksPolicy = basePolicy ?? workingPolicy;
  const bundleDir = `.tenet/runs/local-preview-${process.pid}`;
  try {
    const bundleData = await runChecks(checksPolicy, {
      cwd,
      repository: "local/preview",
      ci: false,
      directory: bundleDir,
      tested: { commit: previewCommit, kind: "head", head: previewCommit, base },
      run: { id: "1", attempt: 1, workflow: checksPolicy.ci?.test_workflow ?? "Tenet tests", job: "local", index: 0 },
    }, deps);
    const decoded = decodeBundle(bundleData.files);
    const localDeps: VerifyDeps = {
      ...deps,
      policy: async (ref) => ref === base && basePolicy ? basePolicy : workingPolicy,
      verifyLock: async () => {},
    };
    const evaluated = await record({
      kind: "workflow_run",
      repository: "local/preview",
      base,
      run: {
        id: "1",
        attempt: 1,
        workflow: checksPolicy.ci?.test_workflow ?? "Tenet tests",
        head: previewCommit,
        repository: "local/preview",
        startedAt: context.now().toISOString(),
      },
      pulls: [],
    }, localDeps, {
      cwd,
      version,
      now: context.now,
      render: renderCheckSummary,
      checkout: async () => ({ cwd, stale: false, close: async () => {} }),
      policyBlob: async (ref, dir) => basePolicy
        ? (await git(["rev-parse", `${ref}:tenet.yaml`], { cwd: dir })).trim()
        : (await git(["hash-object", "tenet.yaml"], { cwd: dir })).trim(),
      forge: localForge(decoded),
      records: memoryRecords(),
    });
    const card = { ...evaluated.card, "x-local-preview": true } as ProofCard;
    const cardText = renderCard(card);
    const findings = checkFindings(bundleData.bundle, checksPolicy);
    const exitCode = bundleData.bundle.checks.some((entry) => entry.outcome !== "success") ? 1 : 0;
    if (context.json) {
      return { result: { card, markdown: cardText, conclusion: evaluated.conclusion, bundle: bundleData.bundle }, findings, exitCode };
    }
    return { value: cardText.trimEnd(), findings, exitCode };
  } finally {
    await rm(path.join(cwd, ...bundleDir.split("/")), { recursive: true, force: true }).catch(() => {});
  }
}

async function verify(context: VerifyCommandContext) {
  const modes = ["run-checks", "bundle", "record", "local"].filter(
    (flag) => context.options[`--${flag}`] === true,
  );
  if (modes.length !== 1 || context.args.length) return usage("choose exactly one of --run-checks, --bundle, --record, or --local");
  if (modes[0] === "local") return runLocalVerify(context);
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
  const findings = checkFindings(result.bundle, policy, options.proposed);
  return { value: result.bundle, findings, exitCode: result.bundle.checks.some((check) => check.outcome !== "success") ? 1 : 0 };
}

export const verifyCommand = {
  ...commandHelp.verify,
  network: (options: Record<string, string | boolean | string[]>) => options["--local"] !== true,
  handler: verify,
};
