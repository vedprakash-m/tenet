// The dependency decision's shared pieces: the files it may restore, the job that runs outside the lock, and the preview question.
import type { Judgement, Observation } from "../core/dependencies.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, question, withWork } from "../verbs/common.ts";
import type { DecisionCtx } from "./types.ts";

export const MANIFEST = "package.json";
export const LOCK_FILES = { npm: "package-lock.json", pnpm: "pnpm-lock.yaml" } as const;
export type Manager = keyof typeof LOCK_FILES;
export const lockFileOf = (manager: Manager): string => LOCK_FILES[manager];
export const TIMEOUT_MS = 10 * 60_000;

export interface DependencyOp {
  work: string;
  phase: "resolve" | "install";
  manager: Manager;
  before?: { manifest: string | null; lock: string | null };
  scripts?: string[];
}

export function restoreFiles(ports: Ports, before: { manifest: string | null; lock: string | null }, manager: Manager = "npm"): void {
  for (const [file, blob] of [
    [MANIFEST, before.manifest],
    [lockFileOf(manager), before.lock],
  ] as const) {
    if (blob === null) ports.project.remove([file]);
    else ports.project.write(file, ports.store.readBlob(blob) ?? "");
  }
}

/** Runs outside the lock, like every job that spawns a process (TS §7.3). */
export function jobFor(
  c: DecisionCtx,
  op: Omit<DependencyOp, "work">,
  execute: (runDir: string) => Promise<unknown>,
  finalize: (
    tx: DecisionCtx["tx"],
    runId: string,
    st: State,
    cw: WorkContract,
    result: unknown,
  ) => Promise<{ state: State; resp: Plan["resp"] }>,
): Plan {
  const { ports, tx, state, work } = c;
  const runId = `${work.label}-d${ports.rand.base32(5)}`;
  const runDir = ports.store.tempDir(`run-${runId}`);
  const now = ports.clock.now();
  tx.intent("dependency", runId, { work: work.id, ...op });
  const inCall = { runId, ...ports.store.self(), verb: "dependency", since: now, runDir };
  const w = { ...work, updatedAt: now, session: { ...work.session, inCall } };
  const job: Job = {
    id: runId,
    execute: () => execute(runDir),
    async finalize(tx2, st, result) {
      const cw = st.work[work.id]!;
      return finalize(tx2, runId, st, { ...cw, session: { generation: cw.session.generation } }, result);
    },
  };
  return { state: withWork(state, w), resp: { work: w.id, next: [] }, job };
}

export const restore = (ports: Ports, dep: NonNullable<WorkContract["dependency"]>): boolean => {
  const lock = lockFileOf(dep.manager);
  const now = ports.project.hashes([MANIFEST, lock]);
  if (now[MANIFEST] !== dep.after.manifest || now[lock] !== dep.after.lock) return false;
  restoreFiles(ports, dep.before, dep.manager);
  return true;
};

export const previewQuestion = (
  dep: NonNullable<WorkContract["dependency"]>,
  obs: Observation[],
  removed: string[],
  j: Judgement,
): Question => {
  const lines = obs
    .slice(0, 8)
    .map((o) => `${o.name}@${o.version}${o.previous ? ` (was ${o.previous})` : ""}${o.direct ? "" : ", transitive"}`);
  const notes = j.issues.filter((i) => i.severity !== "note").map((i) => i.message);
  const more = obs.length > 8 ? `; and ${obs.length - 8} more` : "";
  const dropped = removed.length ? `. It drops ${removed.slice(0, 4).join(", ")}` : "";
  const issueNotes = notes.length ? ` ${notes.join(". ")}.` : "";
  const scriptsHint = j.scripts.length
    ? ` To run an install script, name it: --answer dependency-scripts=${j.scripts.join(",")}.`
    : "";
  const count = `${obs.length} package${obs.length === 1 ? "" : "s"}`;
  const summary = `Add ${dep.specs.join(", ")}? The lockfile changes ${count}: ${lines.join("; ")}${more}${dropped}.`;
  const held = "package.json and the lockfile already hold the resolved versions; nothing is installed yet.";
  return question({
    id: "dependency-confirm",
    header: "Dependencies",
    bind: { factsHash: factsHash({ specs: dep.specs, after: dep.after }) },
    question: `${summary}${issueNotes} ${held}${scriptsHint}`,
    options: [
      {
        label: "Yes, install them",
        description: "Install exactly the lockfile shown, with install scripts off.",
        recommended: j.verdict === "ok",
      },
      {
        label: "No, restore my files",
        description: "Put package.json and the lockfile back as they were; nothing is installed.",
      },
    ],
  });
};
