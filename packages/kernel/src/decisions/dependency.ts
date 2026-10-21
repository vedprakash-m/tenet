// `decide dependency`: one governed flow that verifies before anything installs (SEC-05, TS §9.11). `start` resolves and
// previews (dependency-start.ts); `settle`, after the answer, installs the lockfile shown. A rejected or failed check restores
// both files if they still equal what the resolution wrote.
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { assistanceLevel } from "../core/risk.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, nx, readinessOf, withWork } from "../verbs/common.ts";
import { MANIFEST, TIMEOUT_MS, jobFor, lockFileOf, restore } from "./dependency-job.ts";
import type { Manager } from "./dependency-job.ts";
import { start } from "./dependency-start.ts";
import type { Decision, DecisionCtx } from "./types.ts";

export { restoreFiles } from "./dependency-job.ts";
export type { DependencyOp } from "./dependency-job.ts";

const nameOf = (id: string) => id.slice(0, id.lastIndexOf("@"));

type Waiting = NonNullable<DecisionCtx["work"]["dependency"]>;

/** The user declined: put the files back if they still equal what the resolution wrote, and drop the change. */
function decline(c: DecisionCtx, dep: Waiting): Plan {
  const { ports, state, work } = c;
  const restored = restore(ports, dep);
  const note = restored
    ? "declined; package.json and the lockfile are as they were"
    : "declined; the files changed meanwhile, so I left them";
  const { dependency: _gone, ...cleared } = work;
  return {
    state: withWork({ ...state, pending: state.pending.filter((q) => q.id !== "dependency-confirm") }, cleared),
    resp: { work: work.id, reasons: [reason("dependency-rejected", note, { note: true })], next: [] },
  };
}

/** The files no longer equal what the preview showed: ask again instead of installing something else. */
function changedSincePreview(c: DecisionCtx, dep: Waiting): Plan | undefined {
  const { ports, state, work } = c;
  const lock = lockFileOf(dep.manager);
  const here = ports.project.hashes([MANIFEST, lock]);
  if (here[MANIFEST] === dep.after.manifest && here[lock] === dep.after.lock) return undefined;
  const waiting = state.pending.find((q) => q.id === "dependency-confirm");
  const why = "package.json or the lockfile changed after the preview; decline to restore them, or ask for the change again";
  return {
    resp: {
      work: work.id,
      exit: 3,
      ...(waiting ? { questions: [waiting] } : {}),
      reasons: [reason("revision-conflict", why)],
      next: [nx("ask", "Ask again.", true)],
    },
  };
}

/** The install scripts the user named; each must have been named by the preview. */
function approvedScripts(c: DecisionCtx, dep: Waiting): string[] {
  const approved = (c.input.answers?.["dependency-scripts"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = approved.filter((s) => !dep.scripts.includes(s));
  if (unknown.length) {
    const why = `${unknown.join(", ")} was not named by the preview; its scripts need their own consent`;
    throw new KernelError("restriction-key-unknown", why, { exit: 2 });
  }
  return approved;
}

const lastLines = (r: { stderr: string; stdout: string }, n: number) =>
  (r.stderr || r.stdout).trim().split("\n").slice(-n).join("\n");

const CI_ARGV: Record<Manager, string[]> = {
  npm: ["npm", "ci", "--ignore-scripts"],
  pnpm: ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"],
};
const rebuildArgv = (manager: Manager, name: string): string[] => [manager, "rebuild", name];

/** The exact install matching the resolved lockfile, scripts off, then a rebuild of each package whose scripts the user approved. */
async function install(ports: Ports, runDir: string, manager: Manager, approved: string[]): Promise<{ ok?: boolean; failed?: string }> {
  const run = (argv: string[]) => ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS });
  const ci = await run(CI_ARGV[manager]);
  if (ci.exit !== 0) return { failed: `${manager} install: ${lastLines(ci, 4)}` };
  for (const id of approved) {
    const r = await run(rebuildArgv(manager, nameOf(id)));
    if (r.exit !== 0) return { failed: `${manager} rebuild ${nameOf(id)}: ${lastLines(r, 3)}` };
  }
  return { ok: true };
}

/** The install worked: record the grant for both files, the files as touched, and the assistance level. */
async function installed(
  c: DecisionCtx,
  dep: Waiting,
  approved: string[],
  st: State,
  cw: WorkContract,
): Promise<{ state: State; resp: Plan["resp"] }> {
  const { ports } = c;
  const lock = lockFileOf(dep.manager);
  const g = {
    id: `GR-${cw.grants.length + 1}`,
    actions: ["dependency" as const],
    paths: [MANIFEST, lock],
    source: "decide" as const,
    capture: "reported" as const,
    quote: dep.quote,
    bind: { factsHash: factsHash(dep.after) },
  };
  const { dependency: _d, ...bare } = cw;
  const touched = [MANIFEST, lock].filter((f) => !bare.touched.some((t) => t.path === f)).map((path) => ({ path }));
  const probe = await ports.git.probe();
  const level = assistanceLevel(readinessOf(ports, probe), bare.profile).level;
  return {
    state: withWork(
      { ...st, pending: st.pending.filter((q) => q.id !== "dependency-confirm") },
      { ...bare, grants: [...bare.grants, g], touched: [...bare.touched, ...touched], level },
    ),
    resp: {
      work: cw.id,
      next: [nx("check", "Run the checks with the new dependencies.", true)],
      data: { installed: dep.specs, scripts: approved },
    },
  };
}

function settle(c: DecisionCtx): Plan {
  const { ports, work, input } = c;
  const dep = work.dependency;
  if (!dep) throw new KernelError("continue-required", "no dependency change is waiting for an answer", { exit: 2 });
  const answer = input.answers?.["dependency-confirm"];
  if (answer === "decline") return decline(c, dep);
  if (answer !== "confirm") throw new KernelError("revision-conflict", 'answer "confirm" or "decline"', { exit: 1 });
  const changed = changedSincePreview(c, dep);
  if (changed) return changed;
  const approved = approvedScripts(c, dep);
  return jobFor(
    c,
    { phase: "install", manager: dep.manager, scripts: approved },
    (runDir) => install(ports, runDir, dep.manager, approved),
    async (tx2, runId, st, cw, result) => {
      const r = result as { ok?: boolean; failed?: string; error?: string };
      tx2.result("dependency", runId, { completed: !!r.ok });
      if (r.ok) return installed(c, dep, approved, st, cw);
      const msg = r.failed ?? r.error ?? "no result";
      return {
        state: withWork(st, { ...cw, dependency: dep }),
        resp: {
          work: cw.id,
          exit: 2,
          reasons: [reason("install-failed", `${msg}; the files are as resolved, and answering again retries`)],
          next: [nx("reconcile", "Fix the cause, then answer again.", true)],
        },
      };
    },
  );
}

export const dependency: Decision = {
  kind: "dependency",
  run: (c) => (c.input.answers?.["dependency-confirm"] !== undefined ? settle(c) : start(c)),
};
