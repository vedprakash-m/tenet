// `decide version-reconcile`: the answer to a paused contract (LFC-03). "continue" pins the contract to the running versions
// (evidence made under others is already stale); "stop" parks it. Either way grants, locks, counters and intent are untouched.
import { driftQuestion, versionDrift } from "../core/versions.ts";
import { running } from "../pipeline-version.ts";
import { stopWork } from "../verbs/stop.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

export const versionReconcile: Decision = {
  kind: "version-reconcile",
  run({ ports, state, work, input, tx }) {
    const now = running(ports);
    const drift = versionDrift(work.pinned, now);
    const answer = input.answers?.["version-reconcile"];
    if (!drift.length) return { resp: { work: work.id, next: [], data: { changed: false } } };
    if (answer === "stop") return stopWork(ports, state, { h: input.h!, mode: "pause" }, tx);
    if (answer !== "continue") {
      const ask = { action: "ask" as const, why: "Ask the user: continue or stop.", required: true };
      return { resp: { exit: 3, work: work.id, questions: [driftQuestion(drift)], next: [ask] } };
    }
    const pinned = { tenet: now.tenet, schema: now.schema, adapter: now.adapter };
    return { state: withWork(state, { ...work, pinned }), resp: { work: work.id, next: [], data: { pinned } } };
  },
};
