// Small helpers shared by verbs. Anything with a rule in it lives in core/; this file only wires.
import { KernelError } from "../core/errors.ts";
import { hashOf } from "../core/ids.ts";
import { isEditingProfile, mutationSupported } from "../core/risk.ts";
import type { Readiness } from "../core/risk.ts";
import type { Action, Question, State, WorkContract } from "../core/schemas.ts";
import { handleOf, workByHandle } from "../pipeline.ts";
import type { EvictReport, Ports, RepoProbe, Tx } from "../ports/types.ts";

export const nx = (action: Action, why: string, required = false) => ({ action, why, ...(required ? { required } : {}) });

export const nodeOk = (): boolean => {
  const [maj = 0, min = 0] = process.versions.node.split(".").map(Number);
  return maj > 22 || (maj === 22 && min >= 12);
};

export function readinessOf(ports: Ports, probe: RepoProbe): Readiness {
  const d = ports.stack.detect(ports.root);
  return {
    nodeOk: nodeOk(), platformOk: mutationSupported(ports.platform), stateWritable: true, policyBlocks: false,
    gitState: probe.state, language: d.language, runnerSupported: d.runnerSupported, typescript: d.typescript,
    depsInstalled: d.depsInstalled, experimental: d.experimental,
  };
}

/** The contract a call addresses; mutating calls were already fenced by the pipeline, read-only ones are checked here. */
export function workOf(state: State | null, h: string | undefined): WorkContract {
  if (!state) throw new KernelError("handle-unknown", "there is no Tenet state in this folder yet; start with open");
  if (!h) throw new KernelError("handle-required", "pass --h <handle>; open returns one");
  return workByHandle(state, h);
}

/** Replaces one contract in the state document, immutably. */
export const withWork = (state: State, w: WorkContract): State => ({ ...state, work: { ...state.work, [w.id]: w } });

export const isEditing = (w: WorkContract): boolean => isEditingProfile(w.profile);

export const factsHash = (v: unknown): string => hashOf(v).slice(0, 12);

export const question = (q: Omit<Question, "channel"> & { channel?: Question["channel"] }): Question => ({ channel: "native", ...q });

export { handleOf };

/** Housekeeping at a boundary (CON-08): day-old run files go, old journal records become counts, run files stay under their cap.
 *  Run folders a live run or reservation uses are never removed. Returns the one sentence to report, if anything changed. */
export function reclaim(ports: Ports, tx: Tx, state: State): EvictReport {
  const keep = Object.values(state.work).flatMap((w) =>
    [w.session.inCall?.runDir, w.focusedReview?.manifest, ...w.budget.reservations.map((r) => r.manifest)].filter((x): x is string => !!x)
  );
  ports.store.sweepTemp(24 * 3600_000, keep);
  return tx.evict(keep);
}
