// Small helpers shared by verbs. Anything with a rule in it lives in core/; this file only wires.
import { KernelError } from "../core/errors.ts";
import { hashOf } from "../core/ids.ts";
import { isEditingProfile } from "../core/risk.ts";
import type { Readiness } from "../core/risk.ts";
import type { Action, Question, State, WorkContract } from "../core/schemas.ts";
import { handleOf, workByHandle } from "../pipeline.ts";
import type { Ports, RepoProbe } from "../ports/types.ts";

export const nx = (action: Action, why: string, required = false) => ({ action, why, ...(required ? { required } : {}) });

export const nodeOk = (): boolean => {
  const [maj = 0, min = 0] = process.versions.node.split(".").map(Number);
  return maj > 22 || (maj === 22 && min >= 12);
};

export function readinessOf(ports: Ports, probe: RepoProbe): Readiness {
  const d = ports.stack.detect(ports.root);
  return {
    nodeOk: nodeOk(), platformOk: process.platform === "darwin" || process.platform === "linux", stateWritable: true, policyBlocks: false,
    gitState: probe.state, language: d.language, runnerSupported: d.runnerSupported, typescript: d.typescript,
    depsInstalled: d.depsInstalled, experimental: d.experimental,
  };
}

/** The contract a call addresses; mutating calls were already fenced by the pipeline, read-only ones are checked here. */
export function workOf(state: State | null, h: string | undefined): WorkContract {
  if (!state) throw new KernelError("stale-session", "there is no Tenet state in this folder yet", { exit: 1 });
  if (!h) throw new KernelError("stale-session", "this verb needs --h <handle>", { exit: 1 });
  return workByHandle(state, h);
}

/** Replaces one contract in the state document, immutably. */
export const withWork = (state: State, w: WorkContract): State => ({ ...state, work: { ...state.work, [w.id]: w } });

export const isEditing = (w: WorkContract): boolean => isEditingProfile(w.profile);

export const factsHash = (v: unknown): string => hashOf(v).slice(0, 12);

export const question = (q: Omit<Question, "channel"> & { channel?: Question["channel"] }): Question => ({ channel: "native", ...q });

export { handleOf };
