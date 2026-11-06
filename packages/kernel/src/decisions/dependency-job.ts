// The dependency decision's shared pieces: the files it may restore, the job that runs outside the lock, and the preview question.
import type { Judgement, Observation } from "../core/dependencies.ts";
import { MANIFEST, lockFileOf, named, previewOptions, previewText, same } from "../core/dependency-admission.ts";
import type { DependencyOp, Files, Manager } from "../core/dependency-admission.ts";
import { sha256 } from "../core/ids.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, question, withWork } from "../verbs/common.ts";
import type { DecisionCtx } from "./types.ts";

export const TIMEOUT_MS = 10 * 60_000;

/** Restore only from complete, hash-verified before-images and only over the verified resolver output; true when restored. */
export function restoreFiles(ports: Ports, before: Files, manager: Manager, after: Files): boolean {
  const want = named(manager, before), paths = Object.keys(want);
  const now = ports.project.hashes(paths);
  if (same(now, want)) return true;
  if (!same(now, named(manager, after))) return false;
  const images = paths.map((file) => ({ file, blob: want[file]!, content: want[file] == null ? null : ports.store.readBlob(want[file]) }));
  if (images.some(({ blob, content }) => blob !== null && (content === null || sha256(content) !== blob))) return false;
  for (const { file, content } of images) {
    if (content === null) ports.project.remove([file]);
    else ports.project.write(file, content);
  }
  return same(ports.project.hashes(paths), want);
}

/** Write the resolver output only over the unchanged before-state, then verify what was written. */
export function publishResolved(ports: Ports, before: Files, manager: Manager, output: { manifest: string; lock: string }) {
  const paths = [MANIFEST, lockFileOf(manager)];
  if (!same(ports.project.hashes(paths), named(manager, before))) return "changed";
  ports.project.write(MANIFEST, output.manifest);
  ports.project.write(paths[1]!, output.lock);
  const written = named(manager, { manifest: sha256(output.manifest), lock: sha256(output.lock) });
  return same(ports.project.hashes(paths), written) ? "published" : "uncertain";
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
  return { state: withWork(state, w), resp: { work: w.id }, job };
}

export const restore = (ports: Ports, dep: NonNullable<WorkContract["dependency"]>): boolean => {
  return restoreFiles(ports, dep.before, dep.manager, dep.after);
};

export const previewQuestion = (
  dep: NonNullable<WorkContract["dependency"]>,
  obs: Observation[],
  removed: string[],
  j: Judgement,
): Question => {
  return question({
    id: "dependency-confirm",
    header: "Dependencies",
    bind: { factsHash: factsHash({ specs: dep.specs, after: dep.after }) },
    question: previewText(dep.specs, obs, removed, j),
    options: previewOptions(j.verdict === "ok"),
  });
};
