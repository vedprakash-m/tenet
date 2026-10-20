// What every step of `open` shares: the call's context and how an answer reports shared-file changes and the new contract.
import { formatHandle } from "../core/ids.ts";
import type { OpenInput, Reason, State, WorkContract } from "../core/schemas.ts";
import { quarantineData } from "../decisions/quarantine.ts";
import type { Ports } from "../ports/types.ts";
import { nx } from "./common.ts";
import { settingsFor } from "./reconcile.ts";
import type { Shared } from "./reconcile.ts";

/** What reconciling the shared files adds to an answer: its reasons, and the question when a change needs acceptance. */
export const surface = (s: Shared, base: Reason[] = []) => ({
  reasons: [...base, ...s.reasons],
  ...(s.question ? { questions: [s.question], exit: 3 as const } : {}),
});

export function describe(ports: Ports, state: State, w: WorkContract) {
  const { style, checkpoints, resource_mode } = settingsFor(ports, state, w);
  const first =
    w.profile === "plan"
      ? nx("plan", "Draft the plan with the user.", true)
      : w.profile === "investigate"
        ? nx("research", "Investigate and report findings; nothing is edited.", true)
        : nx("basis", "Propose the outcome and examples, then record them with decide.", true);
  return {
    next: state.pending.length ? [nx("ask", "Answer the open question first.", true)] : [first],
    data: {
      settings: { style, checkpoints, resource_mode },
      label: w.label,
      handle: formatHandle(Number(w.label.slice(2)), w.session.generation, state.tag),
      profile: w.profile,
      lane: w.lane,
      floor: w.floor,
      level: w.level,
      branch: w.git.branch,
      ...(state.quarantine ? { quarantine: quarantineData(state) } : {}),
    },
  };
}

export interface Ctx {
  ports: Ports;
  input: OpenInput;
  before: State | null;
  state: State;
  shared: Shared;
  effects: { completed: string[]; uncertain: string[] } | undefined;
  now: string;
}
