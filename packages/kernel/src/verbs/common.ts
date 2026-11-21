// Small helpers shared by verbs. Anything with a rule in it lives in core/; this file only wires.
import { KernelError } from "../core/errors.ts";
import { hashOf } from "../core/ids.ts";
import { isEditingProfile, mutationSupported } from "../core/risk.ts";
import type { Readiness } from "../core/risk.ts";
import type { Action, Question, State, WorkContract } from "../core/schemas.ts";
import { handleOf, workByHandle } from "../pipeline.ts";
import type { EvictReport, Ports, RepoProbe, Tx } from "../ports/types.ts";
import { protectedRunPaths } from "../core/storage-protection.ts";

export const nx = (action: Action, why: string, required = false) => ({ action, why, ...(required ? { required } : {}) });

export const nodeOk = (): boolean => {
  const [maj = 0, min = 0] = process.versions.node.split(".").map(Number);
  return maj > 22 || (maj === 22 && min >= 12);
};

const UNKNOWN_DETECTION = {
  language: "unknown" as const,
  runner: undefined,
  runnerVersion: "",
  runnerSupported: null,
  typescript: null,
  depsInstalled: null,
  experimental: null,
  packageManager: "unknown" as const,
  moduleRoot: ".",
};

export function toolchainForReadiness(
  ports: Ports,
  bestEffort = false,
) {
  if (!mutationSupported(ports.platform)) return UNKNOWN_DETECTION;
  try {
    return ports.stack.detect(ports.root);
  } catch (error) {
    const reason = error instanceof KernelError ? error.reasons[0] : undefined;
    if (
      bestEffort && reason?.code === "capability-missing" &&
      /installed (?:tool|dependency) metadata cannot be verified safely/.test(reason.message)
    ) {
      return UNKNOWN_DETECTION;
    }
    throw error;
  }
}

export function readinessOf(
  ports: Ports,
  probe: RepoProbe,
  bestEffortMetadata = false,
  d = toolchainForReadiness(ports, bestEffortMetadata),
): Readiness {
  const platformOk = mutationSupported(ports.platform);
  return {
    nodeOk: nodeOk(), platformOk, stateWritable: ports.store.canWrite(), policyBlocks: false,
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
export function reclaim(ports: Pick<Ports, "store">, tx: Tx, state: State): EvictReport {
  const keep = protectedRunPaths(state, tx.unresolved());
  const report = tx.evict(keep);
  if (report.refusal) throw new KernelError(report.refusal.code, report.refusal.message, {
    exit: 2,
    effects: {
      completed: report.message ? [report.message] : [],
      uncertain: report.uncertain ?? [],
    },
  });
  if (report.uncertain?.length) return report;
  try {
    const swept = ports.store.sweepTempDetailed
      ? ports.store.sweepTempDetailed(24 * 3600_000, keep).count
      : ports.store.sweepTemp(24 * 3600_000, keep);
    const age = swept ? `Removed ${swept} old run folder(s) past the age limit.` : undefined;
    return { ...report, ...(age ? { message: [report.message, age].filter(Boolean).join(" ") } : {}) };
  } catch {
    throw new KernelError("storage-accounting-unknown",
      "Age cleanup could not finish safely; dependent work was not published.",
      {
        exit: 2,
        effects: {
          completed: report.message ? [report.message] : [],
          uncertain: ["Age cleanup stopped after an incomplete measurement or changed run scope."],
        },
      });
  }
}
