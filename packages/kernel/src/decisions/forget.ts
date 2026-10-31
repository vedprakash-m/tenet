// `decide forget`: remove a lesson from every copy Tenet controls, after a preview (CON-10, TS §7.7). Published twice,
// so `state.prev` lacks the text; packets holding it are deleted. The host model's own copies are out of reach (OUTSIDE).
import { reason } from "../core/reasons.ts";
import { forgetPreview, OUTSIDE, withoutLesson } from "../core/lessons.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";
import type { State } from "../core/schemas.ts";
import type { Ports, Tx } from "../ports/types.ts";

/** Purge before removing the lookup text; two publications also clear the backup. Safe to repeat after a crash. */
export function completeForget(ports: Ports, tx: Tx, state: State, id: string) {
  const l = state.lessons.find(x => x.id === id);
  const packetsRemoved = l ? ports.store.purge([l.statement, l.provenance.quote]) : 0;
  const next = withoutLesson(state, id);
  tx.publish(next);
  tx.publish(next);
  tx.result("forget", id, { completed: true });
  return { state: next, packetsRemoved };
}

export const forget: Decision = {
  kind: "forget",
  run({ ports, tx, state, work, input }) {
    const l = state.lessons.find((x) => x.id === input.target);
    if (!l) return { resp: { work: work.id, exit: 2, reasons: [
      reason("restriction-key-unknown", `there is no lesson "${input.target ?? ""}" to forget`) ] } };
    if (input.answers?.["forget-confirm"] !== "yes") {
      const { question, preview } = forgetPreview(l);
      return { resp: { exit: 3, work: work.id, questions: [question], next: [], data: { preview } } };
    }
    tx.intent("forget", l.id, { work: work.id, lesson: l.id });
    const { state: next, packetsRemoved } = completeForget(ports, tx, withWork(state, work), l.id);
    return { state: next, resp: { work: work.id, next: [], data: { forgotten: l.id, packetsRemoved, outside: OUTSIDE } } };
  },
};
