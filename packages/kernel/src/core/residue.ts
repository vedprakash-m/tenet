// What stays after Tenet is removed and what a cleanup would touch (LFC-05, TS §18 item 6, CON-10). Pure: it formats what the
// store and project report. The `.tenet` folder is never removed by a kernel call: a call cannot safely delete the store it runs in.
import type { Footprint } from "../ports/types.ts";
import type { Question, State } from "./schemas.ts";
import { hashOf } from "./ids.ts";

export const ADOPTED_FILES = ["INTENT.md", "tenet.policy.json", "docs/architecture.md", "docs/hardening.md"] as const;
export const KEPT = ["test tags (@tenet) in test files", "Tenet-Work trailers in commits", "the code, specs and evidence you committed"];

export function residueView(
  r: { tenet: Footprint | null; temp: Footprint | null }, present: Readonly<Record<string, boolean>>,
) {
  return {
    tenet: r.tenet, temp: r.temp, kept: KEPT,
    adopted: ADOPTED_FILES.map((path) => ({ path, present: !!present[path] })),
    note: "Adopted files are your documents and stay. Cleanup removes only the run files Tenet wrote outside the project.",
    tenetDirCommand: "rm -rf .tenet   (run it yourself after uninstalling; Tenet cannot delete the store it is running in)",
  };
}

/** Run files stay while any contract holds a review or analyst packet in them. */
export const openPackets = (state: Pick<State, "work">): boolean =>
  Object.values(state.work).some((w) => w.budget.reservations.length > 0);

export const STALE_MS = 3600_000;

/** The question and preview for a cleanup: what would go, what stays, and that `.tenet/` and your files are not touched. */
type Plan = { removed: string[]; kept: string[] };
export function cleanupPreview(scope: string, plan: Plan): { question: Question; preview: unknown } {
  return {
    preview: plan,
    question: {
      id: "cleanup-confirm", header: "Clean up", channel: "native", bind: { factsHash: hashOf(plan).slice(0, 12) },
      question: `Remove ${plan.removed.length} run folder(s) from the temp folder (${scope})? ${plan.kept.length} recent one(s) stay. `
        + ".tenet/ and your files are not touched.",
      options: [
        { label: "Clean up", description: "Remove the listed run folders", recommended: true },
        { label: "Keep", description: "Change nothing" },
      ],
    },
  };
}
