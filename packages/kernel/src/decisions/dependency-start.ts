// `decide dependency`, first phase: resolve without installing (a remote read that writes only package.json and the lockfile),
// judge the diff against the policy and ask. npm and pnpm are built; Yarn is refused.
import { z } from "zod";
import { diffLockfile, diffPnpmLock, judgeDependencies } from "../core/dependencies.ts";
import type { Issue, LockDiff, Observation } from "../core/dependencies.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { nx, withWork } from "../verbs/common.ts";
import { settingsFor } from "../verbs/reconcile.ts";
import { MANIFEST, TIMEOUT_MS, jobFor, lockFileOf, previewQuestion, restore, restoreFiles } from "./dependency-job.ts";
import type { Manager } from "./dependency-job.ts";
import type { DecisionCtx } from "./types.ts";

const MAX_LOOKUPS = 50;
const DAY = 864e5;
const SPEC_RE = /^@?[a-z0-9][a-z0-9._~-]*(\/[a-z0-9._~-]+)?(@[A-Za-z0-9.^~<>=*|-]+)?$/i;
const Body = z.object({
  specs: z.array(z.string().regex(SPEC_RE, "not a registry package spec")).min(1).max(10),
  urgent: z.boolean().default(false),
});

type Saved = { manifest: string | null; lock: string | null };
interface Request {
  specs: string[];
  urgent: boolean;
  manager: Manager;
  quote: string;
  before: Saved;
  wasLock: string | null;
}
interface Resolution {
  failed?: string;
  error?: string;
  diff?: LockDiff;
  ages?: Record<string, number | undefined>;
  after?: { manifest: string; lock: string };
}

/** Everything refused before the first process runs: no quote, a bad spec, Yarn, a change already waiting. */
function admitStart(c: DecisionCtx): { specs: string[]; urgent: boolean; manager: Manager } {
  const { ports, work, input } = c;
  if (!input.quote?.trim())
    throw new KernelError("authority-needed", "a dependency change records the user's own words: pass them as the quote", {
      exit: 2,
    });
  const body = Body.safeParse(input.propose);
  if (!body.success) {
    throw new KernelError(
      "restriction-key-unknown",
      `dependency: ${body.error.issues[0]!.message}; only registry package names with an optional version are accepted`,
      { exit: 2 },
    );
  }
  const other = ports.project.hashes(["pnpm-lock.yaml", "yarn.lock"]);
  if (other["yarn.lock"] && !other["pnpm-lock.yaml"])
    throw new KernelError("capability-missing", "yarn projects are not built; an npm check is not a stand-in for yarn's", { exit: 2 });
  if (work.dependency) throw new KernelError("continue-required", "a dependency change is waiting for your answer", { exit: 2 });
  return { ...body.data, manager: other["pnpm-lock.yaml"] ? "pnpm" : "npm" };
}

/** Days since each added or changed registry version was published; an age that cannot be read stays unknown. */
async function releaseAges(ports: Ports, runDir: string, observed: Observation[]): Promise<Record<string, number | undefined>> {
  const ages: Record<string, number | undefined> = {};
  for (const o of observed.filter((x) => x.source === "registry").slice(0, MAX_LOOKUPS)) {
    const v = await ports.runner.run({
      argv: ["npm", "view", `${o.name}@${o.version}`, "time", "--json"],
      cwd: ports.root,
      runDir,
      timeoutMs: 60_000,
    });
    try {
      const t = (JSON.parse(v.stdout) as Record<string, string>)[o.version];
      if (t) ages[`${o.name}@${o.version}`] = Math.floor((Date.now() - Date.parse(t)) / DAY);
    } catch {
      /* unknown age stays unknown */
    }
  }
  return ages;
}

const RESOLVE_ARGV: Record<Manager, (specs: string[]) => string[]> = {
  npm: (specs) => ["npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", ...specs],
  pnpm: (specs) => ["pnpm", "add", "--lockfile-only", "--ignore-scripts", ...specs], // "add": package.json does not list these specs yet
};
const DIFF_OF: Record<Manager, (before: string | null, after: string) => LockDiff> = { npm: diffLockfile, pnpm: diffPnpmLock };

/** Resolve without installing, then diff the lockfile and look up the age of what it adds. */
async function resolve(ports: Ports, runDir: string, req: Request): Promise<Resolution> {
  const r = await ports.runner.run({
    argv: RESOLVE_ARGV[req.manager](req.specs),
    cwd: ports.root,
    runDir,
    timeoutMs: TIMEOUT_MS,
  });
  if (r.exit !== 0) return { failed: (r.stderr || r.stdout).trim().split("\n").slice(-4).join("\n") };
  const after = { manifest: ports.project.read(MANIFEST) ?? "", lock: ports.project.read(lockFileOf(req.manager)) ?? "" };
  let diff;
  try {
    diff = DIFF_OF[req.manager](req.wasLock, after.lock);
  } catch (e) {
    return { failed: (e as Error).message, after };
  }
  return { diff, ages: await releaseAges(ports, runDir, [...diff.added, ...diff.changed]), after };
}

/** The resolution failed or was rejected: put the files back, record the effect as not completed and say why. */
function refused(
  tx: DecisionCtx["tx"],
  runId: string,
  st: State,
  cw: WorkContract,
  code: "install-failed" | "dependency-rejected",
  detail: string,
  next: Plan["resp"]["next"],
): { state: State; resp: Plan["resp"] } {
  tx.result("dependency", runId, { completed: false });
  return { state: withWork(st, cw), resp: { work: cw.id, exit: 2, reasons: [reason(code, detail)], next } };
}

/** Judge the resolved lockfile against the policy, then ask the user to confirm the preview. */
function afterResolve(
  c: DecisionCtx,
  req: Request,
  tx: DecisionCtx["tx"],
  runId: string,
  st: State,
  cw: WorkContract,
  r: Resolution,
): { state: State; resp: Plan["resp"] } {
  const { ports } = c;
  const { specs, urgent, manager, before } = req;
  const dep = r.after
    ? {
        specs,
        urgent,
        manager,
        quote: req.quote.slice(0, 200),
        scripts: [] as string[],
        before,
        after: { manifest: sha256(r.after.manifest), lock: sha256(r.after.lock) },
      }
    : undefined;
  if (r.failed || r.error || !r.diff || !dep) {
    restoreFiles(ports, before, manager);
    const msg = r.failed ?? r.error ?? "no result";
    return refused(tx, runId, st, cw, "install-failed", `resolving ${specs.join(", ")}: ${msg}; your files are as they were`, [
      nx("reconcile", "Fix the cause (network, spelling of the package), then ask again.", true),
    ]);
  }
  const obs = [...r.diff.added, ...r.diff.changed];
  const policy = settingsFor(ports, st, cw).dependency_policy as {
    min_release_age_days: number;
    urgent_exception: "allow" | "require-approval" | "deny";
    unknown_age: "allow" | "require-approval" | "deny";
  };
  const j = judgeDependencies(obs, r.ages ?? {}, { policy, urgent });
  if (j.verdict === "blocked") {
    const why = j.issues
      .filter((i: Issue) => i.severity === "blocked")
      .map((i) => i.message)
      .join("; ");
    const restored = restore(ports, dep);
    return refused(
      tx,
      runId,
      st,
      cw,
      "dependency-rejected",
      `${why}${restored ? "" : "; the files changed meanwhile, so I left them"}`,
      [nx("reconcile", "Choose another package or version, or change the policy yourself.", true)],
    );
  }
  tx.result("dependency", runId, { completed: true });
  const full = { ...dep, scripts: j.scripts };
  const q = previewQuestion(full, obs, r.diff.removed, j);
  return {
    state: withWork({ ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] }, { ...cw, dependency: full }),
    resp: {
      work: cw.id,
      exit: 3,
      questions: [q],
      next: [nx("ask", "Ask the user, then answer with --answer dependency-confirm=confirm or decline.", true)],
    },
  };
}

export function start(c: DecisionCtx): Plan {
  const { ports, input } = c;
  const { specs, urgent, manager } = admitStart(c);
  const was = { manifest: ports.project.read(MANIFEST), lock: ports.project.read(lockFileOf(manager)) };
  const before = {
    manifest: was.manifest === null ? null : ports.store.putBlob(was.manifest),
    lock: was.lock === null ? null : ports.store.putBlob(was.lock),
  };
  const req: Request = { specs, urgent, manager, quote: input.quote!, before, wasLock: was.lock };
  return jobFor(
    c,
    { phase: "resolve", manager, before },
    (runDir) => resolve(ports, runDir, req),
    async (tx2, runId, st, cw, result) => afterResolve(c, req, tx2, runId, st, cw, result as Resolution),
  );
}
