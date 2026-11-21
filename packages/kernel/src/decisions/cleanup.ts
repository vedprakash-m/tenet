// `decide cleanup`: remove this workspace's temporary folder from the system temp folder, after a stored preview (LFC-05).
// The answer is bound to the work, the scope and every entry the preview's walk found; removal goes entry by entry and
// keeps anything added or changed since, and any run folder an unresolved effect still needs. `.tenet/` is never touched.
import { reason, type ReasonCode } from "../core/reasons.ts";
import { sep } from "node:path";
import { busyWork, cleanupFacts, cleanupPreview, STALE_MS } from "../core/residue.ts";
import type { State } from "../core/schemas.ts";
import { nx } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const settled = (state: State): State => ({ ...state, pending: state.pending.filter((q) => q.id !== "cleanup-confirm") });
/** Refusals return the state instead of throwing, so what recovery settled first (an interrupted cleanup's withdrawn
 *  question) is published; a thrown refusal would discard it and let a retried yes match the old preview again. */
const refuse = (state: State, work: string, code: ReasonCode, detail: string) =>
  ({ state, resp: { work, exit: 2 as const, reasons: [reason(code, detail)] } });

export const cleanup: Decision = {
  kind: "cleanup",
  run({ ports, tx, state, work, input }) {
    const scope = input.target;
    if (scope !== "project" && scope !== "machine") {
      return refuse(state, work.id, "restriction-key-unknown", `cleanup "project" or "machine", not "${scope ?? ""}"`);
    }
    const busy = busyWork(state);
    if (busy.length) return refuse(state, work.id, "work-busy", `${busy.slice(0, 4).join("; ")}; stop or settle it first`);
    const walk = ports.store.walkTemp(scope, scope === "machine" ? STALE_MS : 0);
    const answer = input.answers?.["cleanup-confirm"];
    if (answer === undefined) {
      const { question, preview } = cleanupPreview(work.id, scope, walk);
      return {
        state: { ...settled(state), pending: [...settled(state).pending, question] },
        resp: { exit: 3, work: work.id, questions: [question], data: { preview } },
      };
    }
    const q = state.pending.find((p) => p.id === "cleanup-confirm");
    if (!q) return refuse(state, work.id, "revision-conflict", "there is no cleanup preview to answer; preview it first");
    if (answer !== "yes") return { state: settled(state), resp: { work: work.id } };
    if (q.bind.factsHash !== cleanupFacts(work.id, scope, walk)) {
      return refuse(state, work.id, "revision-conflict", "the run folders changed since the preview; preview again");
    }
    // Folders an unresolved effect names are its recovery evidence (for example an interrupted undo's run folder).
    const keep = tx.unresolved().flatMap((u) => {
      const dir = (u.op as { runDir?: unknown } | null)?.runDir;
      return typeof dir === "string" ? [dir] : [];
    });
    const id = `c-${ports.rand.base32(6)}`;
    tx.intent("cleanup", id, { scope, root: walk.root, facts: q.bind.factsHash });
    tx.flush?.();
    const out = ports.store.removeTemp(walk, keep);
    tx.result("cleanup", id, out);
    const prefix = walk.root ? `${walk.root}${sep}` : "";
    const changed = !!walk.root && (out.removed.length > 0 || out.kept.length > 0);
    const next = changed
      ? {
          ...settled(state),
          work: Object.fromEntries(Object.entries(state.work).map(([workId, current]) => [
            workId,
            {
              ...current,
              receipts: current.receipts.map((receipt) =>
                receipt.provenance.runDir === walk.root || receipt.provenance.runDir.startsWith(prefix)
                  ? { ...receipt, qualifiers: [...new Set([...receipt.qualifiers, "history-unavailable" as const])] }
                  : receipt
              ),
            },
          ])),
        }
      : settled(state);
    return {
      state: next,
      resp: {
        work: work.id,
        ...(out.kept.length
          ? { exit: 3 as const, next: [nx("ask", "Some entries were kept; preview the cleanup again to see what remains.")] }
          : {}),
        data: { removed: out.removed, kept: out.kept },
      },
    };
  },
};
