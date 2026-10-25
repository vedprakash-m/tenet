// `decide forget`: remove a lesson from every copy Tenet controls, after a preview (CON-10, TS §7.7). Published twice,
// so `state.prev` lacks the text; packets holding it are deleted. The host model's own copies are out of reach (OUTSIDE).
import { KernelError } from "../core/errors.ts";
import { forgetPreview, OUTSIDE, withoutLesson } from "../core/lessons.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

export const forget: Decision = {
  kind: "forget",
  run({ ports, tx, state, work, input }) {
    const l = state.lessons.find((x) => x.id === input.target);
    if (!l) throw new KernelError("restriction-key-unknown", `there is no lesson "${input.target ?? ""}" to forget`, { exit: 2 });
    if (input.answers?.["forget-confirm"] !== "yes") {
      const { question, preview } = forgetPreview(l);
      return { resp: { exit: 3, work: work.id, questions: [question], next: [], data: { preview } } };
    }
    const next = withWork(withoutLesson(state, l.id), work);
    tx.publish(next);
    const packetsRemoved = ports.store.purge([l.statement, l.provenance.quote]);
    return { state: next, resp: { work: work.id, next: [], data: { forgotten: l.id, packetsRemoved, outside: OUTSIDE } } };
  },
};
