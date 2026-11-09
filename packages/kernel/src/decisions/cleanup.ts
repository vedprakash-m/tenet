// `decide cleanup`: remove the run files Tenet wrote outside the project, after a preview (LFC-05, CON-10).
// Scopes: this project, or every stale Tenet run folder on this machine. `.tenet/` and adopted files are never touched.
import { KernelError } from "../core/errors.ts";
import { cleanupPreview, tempBusy, STALE_MS } from "../core/residue.ts";
import type { Decision } from "./types.ts";

let removalEnabled = false;
/** Test seam only: lets the existing cleanup tests keep exercising the disabled removal path. */
export function enableCleanupForTests(): void { removalEnabled = true; }

export const cleanup: Decision = {
  kind: "cleanup",
  run({ ports, state, work, input }) {
    const scope = input.target;
    if (scope !== "project" && scope !== "machine") {
      throw new KernelError("restriction-key-unknown", `cleanup "project" or "machine", not "${scope ?? ""}"`, { exit: 2 });
    }
    if (tempBusy(state)) {
      throw new KernelError("work-busy", "a check or packet is still active; stop or settle it first", { exit: 2 });
    }
    const age = scope === "machine" ? STALE_MS : 0;
    const confirmed = input.answers?.["cleanup-confirm"] === "yes";
    if (confirmed && !removalEnabled) {
      const why = "cleanup removal is disabled in this preview because it can remove files Tenet did not create";
      throw new KernelError("capability-missing", `${why}; preview it, then delete the listed folders yourself`, { exit: 2 });
    }
    const plan = ports.store.cleanTemp(scope, age, confirmed);
    if (confirmed) return { resp: { work: work.id, data: { removed: plan.removed } } };
    const { question, preview } = cleanupPreview(scope, plan);
    return { resp: { exit: 3, work: work.id, questions: [question], data: { preview } } };
  },
};
