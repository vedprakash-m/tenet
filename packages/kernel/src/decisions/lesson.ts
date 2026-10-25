// `decide lesson`: an explicit "always" correction kept as advice with its provenance (LRN-01, LRN-02, LRN-05).
import { addLesson } from "../core/lessons.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

export const lesson: Decision = {
  kind: "lesson",
  run({ ports, state, work, input }) {
    const r = addLesson(state, work, { now: ports.clock.now(), suffix: ports.rand.base32(3) }, input.quote, input.propose);
    const resp = { work: work.id, next: [], data: { changed: r.changed, id: r.id } };
    return r.changed ? { state: withWork({ ...state, lessons: r.lessons }, work), resp } : { resp };
  },
};
