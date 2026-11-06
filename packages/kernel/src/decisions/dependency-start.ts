// `decide dependency`, first phase: resolve in a private run directory, judge the diff, then publish only approved outputs.
// npm and pnpm are built for single-package projects; unsupported layouts and Yarn are refused (core/dependency-admission.ts).
import { judgeDependencies, type Issue, type Observation, type Policy } from "../core/dependencies.ts";
import { DIFF_OF, MANIFEST, RESOLVE_ARGV, ageInDays, configRefusal, contentRefusal, lastLines } from "../core/dependency-admission.ts";
import { lockFileOf, parseRequest, projectRefusal, selectManager } from "../core/dependency-admission.ts";
import type { Files, Manager, Resolution } from "../core/dependency-admission.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { nx, withWork } from "../verbs/common.ts";
import { settingsFor } from "../verbs/reconcile.ts";
import { TIMEOUT_MS, jobFor, previewQuestion, publishResolved } from "./dependency-job.ts";
import type { DecisionCtx } from "./types.ts";

const MAX_LOOKUPS = 50;

interface Request {
  specs: string[];
  urgent: boolean;
  manager: Manager;
  quote: string;
  before: Files;
  wasLock: string | null;
}
const unsupported = (why: string) => new KernelError("capability-missing", why, { exit: 2 });

/** Everything refused before the first process runs; returns the one snapshot the resolver will be given. */
function admitStart(c: DecisionCtx) {
  const { ports, work, input } = c;
  const body = parseRequest(input.quote, input.propose);
  if (work.dependency) throw new KernelError("continue-required", "a dependency change is waiting for your answer", { exit: 2 });
  const files = [MANIFEST, "package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
  const read: Record<string, string | null> = Object.fromEntries(files.map((f) => [f, ports.project.read(f)]));
  const selected = selectManager((path) => read[path] != null);
  if ("refusal" in selected) throw unsupported(selected.refusal);
  const { manager } = selected;
  const manifest = read[MANIFEST] ?? null, lock = read[lockFileOf(manager)] ?? null;
  const present = (path: string) => ports.project.exists(path);
  const refusal = configRefusal(present, manager) ?? contentRefusal(manager, manifest, lock);
  if (refusal) throw unsupported(refusal);
  return { ...body, manager, manifest, lock };
}

/** Days since each added or changed registry version was published; an age that cannot be read stays unknown. */
async function releaseAges(ports: Ports, runDir: string, observed: Observation[]): Promise<Record<string, number | undefined>> {
  const ages: Record<string, number | undefined> = {};
  for (const o of observed.filter((x) => x.source === "registry").slice(0, MAX_LOOKUPS)) {
    const v = await ports.runner.run({
      argv: ["npm", "view", `${o.name}@${o.version}`, "time", "--json"],
      cwd: runDir,
      runDir,
      timeoutMs: 60_000,
    });
    ages[`${o.name}@${o.version}`] = ageInDays(v.stdout, o.version, Date.now());
  }
  return ages;
}

/** Resolve without installing, then diff the lockfile and look up the age of what it adds. */
async function resolve(ports: Ports, runDir: string, req: Request): Promise<Resolution> {
  const manifest = req.before.manifest === null ? null : ports.store.readBlob(req.before.manifest);
  const lock = req.before.lock === null ? null : ports.store.readBlob(req.before.lock);
  if ((req.before.manifest !== null && manifest === null) || (req.before.lock !== null && lock === null))
    return { error: "the captured before-image is unavailable; no project files were changed" };
  if (manifest !== null) ports.store.writeArtifact(runDir, MANIFEST, manifest);
  if (lock !== null) ports.store.writeArtifact(runDir, lockFileOf(req.manager), lock);
  const r = await ports.runner.run({
    argv: RESOLVE_ARGV[req.manager](req.specs),
    cwd: runDir,
    runDir,
    timeoutMs: TIMEOUT_MS,
  });
  if (r.exit !== 0) return { failed: lastLines(r, 4) };
  const outputManifest = ports.store.readArtifact(runDir, MANIFEST);
  const outputLock = ports.store.readArtifact(runDir, lockFileOf(req.manager));
  if (outputManifest === null || outputLock === null)
    return { failed: "the package manager did not produce both required files; no project files were changed" };
  const after = { manifest: outputManifest, lock: outputLock };
  let diff;
  try {
    diff = DIFF_OF[req.manager](req.wasLock, after.lock);
  } catch (e) {
    return { failed: (e as Error).message, after };
  }
  return { diff, ages: await releaseAges(ports, runDir, [...diff.added, ...diff.changed]), after };
}

type Out = { state: State; resp: Plan["resp"] };

/** Judge the resolved lockfile against the policy, publish it, then ask the user to confirm the preview. */
function afterResolve(c: DecisionCtx, req: Request, tx: DecisionCtx["tx"], runId: string, st: State, cw: WorkContract, r: Resolution): Out {
  const { ports } = c;
  const { specs, urgent, manager, before } = req;
  // Not completed: the files are untouched or put back; say why. A conflict waits on the user (exit 3), the rest exit 2.
  const settle = (code: "install-failed" | "dependency-rejected" | "revision-conflict", detail: string, next: string): Out => {
    tx.result("dependency", runId, { completed: false });
    const exit = code === "revision-conflict" ? (3 as const) : (2 as const);
    const resp = { work: cw.id, exit, reasons: [reason(code, detail)], next: [nx("reconcile", next, true)] };
    return { state: withWork(st, cw), resp };
  };
  const after = r.after;
  if (r.failed || r.error || !r.diff || !after) {
    const why = `resolving ${specs.join(", ")}: ${r.failed ?? r.error ?? "no result"}; no resolver output was published to project files`;
    return settle("install-failed", why, "Fix the cause (network, spelling of the package), then ask again.");
  }
  const obs = [...r.diff.added, ...r.diff.changed];
  const policy = settingsFor(ports, st, cw).dependency_policy as Policy;
  const j = judgeDependencies(obs, r.ages ?? {}, { policy, urgent });
  if (j.verdict === "blocked") {
    const why = j.issues.filter((i: Issue) => i.severity === "blocked").map((i) => i.message).join("; ");
    return settle("dependency-rejected", `${why}; no resolver output was published to project files`,
      "Choose another package or version, or change the policy yourself.");
  }
  const refusal = projectRefusal((path) => ports.project.exists(path), manager);
  if (refusal) return settle("revision-conflict", `${refusal}; no resolver output was published`,
    "Remove or review the project configuration, then ask for the dependency change again.");
  const published = publishResolved(ports, before, manager, after);
  if (published === "changed") return settle("revision-conflict",
    "package.json or the lockfile changed during resolution; no resolver output was published",
    "Review the project changes, then ask for the dependency change again.");
  if (published === "uncertain") {
    const why = "dependency outputs could not be verified after publication; the dependency effect remains unresolved";
    return { state: withWork(st, cw), resp: { work: cw.id, exit: 2, reasons: [reason("effect-uncertain", why)] } };
  }
  tx.result("dependency", runId, { completed: true });
  const dep = { specs, urgent, manager, quote: req.quote.slice(0, 200), scripts: j.scripts, before,
    after: { manifest: sha256(after.manifest), lock: sha256(after.lock) } };
  const q = previewQuestion(dep, obs, r.diff.removed, j);
  return {
    state: withWork({ ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] }, { ...cw, dependency: dep }),
    resp: { work: cw.id, exit: 3, questions: [q],
      next: [nx("ask", "Ask the user, then answer with --answer dependency-confirm=confirm or decline.", true)] },
  };
}

export function start(c: DecisionCtx): Plan {
  const { ports, input } = c;
  const { specs, urgent, manager, manifest, lock } = admitStart(c);
  const before = {
    manifest: manifest === null ? null : ports.store.putBlob(manifest),
    lock: lock === null ? null : ports.store.putBlob(lock),
  };
  const req: Request = { specs, urgent, manager, quote: input.quote!, before, wasLock: lock };
  return jobFor(
    c,
    { phase: "resolve", manager, before },
    (runDir) => resolve(ports, runDir, req),
    async (tx2, runId, st, cw, result) => afterResolve(c, req, tx2, runId, st, cw, result as Resolution),
  );
}
