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
    note: "Adopted files are your documents and stay. Cleanup removes Tenet's temporary folder for this project from the system "
      + "temp folder, after a preview; anything added after the preview is kept.",
    tenetDirCommand: "rm -rf .tenet   (run it yourself after uninstalling; Tenet cannot delete the store it is running in)",
  };
}

/** Cleanup cannot remove files held by a running check, focused review or child packet. */
export const tempBusy = (state: Pick<State, "work">): boolean => busyWork(state).length > 0;

/** Each busy work and its recorded state, so a refusal names what is actually holding the run files (LFC-05, J-07). */
export function busyWork(state: Pick<State, "work">): string[] {
  return Object.values(state.work).flatMap((w) => [
    ...(w.session.inCall
      ? [w.session.inCall.cancelled
        ? `${w.label} has a stopped run whose result is not settled`
        : `${w.label} has a ${w.session.inCall.verb} in progress`]
      : []),
    ...(w.focusedReview ? [`${w.label} has an open review packet`] : []),
    ...(w.budget.reservations.length ? [`${w.label} has a reservation`] : []),
  ]);
}

export const STALE_MS = 3600_000;

/** One entry of a cleanup walk: identity from a no-follow bigint lstat, as decimal strings so it hashes as JSON. */
export interface TempEntry {
  path: string; type: "file" | "dir" | "link" | "other"; dev: string; ino: string; size: string; mtimeNs: string; ctimeNs: string;
}
export interface TempWalk { root: string | null; entries: TempEntry[]; kept: Array<{ path: string; cause: string }> }

/** The binding of a cleanup answer: the work, the scope and every entry the walk found. Only this hash is stored. */
export const cleanupFacts = (work: string, scope: string, walk: TempWalk): string =>
  hashOf({ work, scope, root: walk.root, entries: walk.entries });

const sizeText = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** The question and preview for a cleanup: what would go and what stays. It never claims more than the walk shows. */
export function cleanupPreview(work: string, scope: string, walk: TempWalk): { question: Question; preview: unknown } {
  const files = walk.entries.filter((e) => e.type !== "dir").length;
  const bytes = walk.entries.reduce((n, e) => n + (e.type === "file" ? Number(e.size) : 0), 0);
  return {
    preview: { root: walk.root, files, bytes, kept: walk.kept },
    question: {
      id: "cleanup-confirm", header: "Clean up", channel: "chat", bind: { factsHash: cleanupFacts(work, scope, walk) },
      question: `Remove Tenet's temporary folder for this project from the system temp folder (${files} files, ${sizeText(bytes)})? `
        + "Anything added after this preview is kept. .tenet/ is not touched.",
      options: [
        { label: "Clean up", description: "Remove the listed temporary folder", recommended: true },
        { label: "Keep", description: "Change nothing" },
      ],
    },
  };
}
