// `packet`: kernel-built packets, never summaries of chats (TS §5.5). Reviewer packets are manifests (built once, in
// ./manifest.ts); handoff and resume are read-only text; analyst packets are read-only research/architect/security
// assignments (AGT-03), built the same way but without a basis precondition.
import { KernelError } from "../core/errors.ts";
import { handoffText } from "../core/handoff.ts";
import { reason } from "../core/reasons.ts";
import { PacketInput } from "../core/schemas.ts";
import type { Verb } from "../pipeline.ts";
import { nx, withWork, workOf } from "./common.ts";
import { gather, worldDigest } from "./facts.ts";
import { issueAnalyst, issueReview } from "./manifest.ts";

export const packet: Verb<PacketInput> = {
  name: "packet",
  schema: PacketInput,
  class: (i) => (i.role === "handoff" || i.role === "resume" ? "read-only" : "mutating"),
  identity: worldDigest,

  async run(ports, state, input) {
    const w = workOf(state, input.h);
    if (input.role === "handoff") return { resp: { work: w.id, data: { handoff: handoffText(state!, w) } } };
    const facts = await gather(ports, w);
    if (input.role === "resume") {
      const note = w.session.inCall ? `A ${w.session.inCall.verb} was in progress and will be reconciled on the next mutating call.` : "No call was in progress.";
      return { resp: { work: w.id, data: { handoff: handoffText(state!, w), reconciliation: { changedNow: facts.att.changed.length, unexplained: facts.att.unexplained, note } } } };
    }
    if (input.role === "analyst") {
      if (!input.question || !input.analystRole) {
        throw new KernelError("capability-missing", "an analyst packet needs --analyst-role and --question", { exit: 1 });
      }
      const elements = state!.project.intent.elements.filter((e) => w.basis?.elementIds.includes(e.id));
      const issued = issueAnalyst(ports, state!, w, elements, facts.candidate, input.analystRole, input.question);
      return {
        state: withWork(state!, issued.work),
        resp: { work: w.id, reasons: issued.reasons, next: issued.next, ...(issued.data ? { data: issued.data } : {}) },
      };
    }
    if (!w.basis) throw new KernelError("continue-required", "record a basis first", { exit: 2 });
    if (w.lastCheck?.candidate !== facts.candidate) return { resp: { work: w.id, exit: 2, reasons: [reason("stale", "run a full check before requesting a review")], next: [nx("check", "Check the current candidate first.", true)] } };
    const changes = await ports.git.changes(w.git.base, facts.reviewPaths, ports.stack.classify);
    const issued = issueReview(ports, state!, w, facts, changes, !!input.retry);
    return { state: withWork(state!, issued.work), resp: { work: w.id, reasons: issued.reasons, next: issued.next, ...(issued.data ? { data: issued.data } : {}) } };
  },
};
