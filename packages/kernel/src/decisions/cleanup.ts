// `decide cleanup`: remove the run files Tenet wrote outside the project, after a preview (LFC-05, CON-10).
// Scopes: this project, or every stale Tenet run folder on this machine. `.tenet/` and adopted files are never touched.
import { KernelError } from "../core/errors.ts";
import { cleanupPreview, openPackets, STALE_MS } from "../core/residue.ts";
import type { Decision } from "./types.ts";

export const cleanup: Decision = {
  kind: "cleanup",
  run({ ports, state, work, input }) {
    const scope = input.target;
    if (scope !== "project" && scope !== "machine") {
      throw new KernelError("restriction-key-unknown", `cleanup "project" or "machine", not "${scope ?? ""}"`, { exit: 2 });
    }
    if (scope === "project" && openPackets(state)) {
      throw new KernelError("work-busy", "a review or analyst packet is still open; record or retry it first", { exit: 2 });
    }
    const age = scope === "machine" ? STALE_MS : 0;
    const confirmed = input.answers?.["cleanup-confirm"] === "yes";
    const plan = ports.store.cleanTemp(scope, age, confirmed);
    if (confirmed) return { resp: { work: work.id, next: [], data: { removed: plan.removed } } };
    const { question, preview } = cleanupPreview(scope, plan);
    return { resp: { exit: 3, work: work.id, questions: [question], next: [], data: { preview } } };
  },
};
