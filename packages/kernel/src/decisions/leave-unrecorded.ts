import { KernelError } from "../core/errors.ts";
import { commitRecoveryFacts } from "../verbs/recover-commit.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";
import { recordedResults } from "../core/state.ts";
import { replayUnrecorded } from "../core/commit-proof.ts";

export const leaveUnrecorded: Decision = {
  kind: "leave-unrecorded",
  async run({ ports, tx, state, work, input }) {
    if (input.answers?.[`leave-unrecorded-${input.target}`] !== "leave-unrecorded")
      throw new KernelError("revision-conflict", 'answer "leave-unrecorded" to the exact recovery question', { exit: 1 });
    const intent = tx.unresolved().find(u => u.effect === "commit" && u.id === input.target);
    if (!intent) {
      const records = recordedResults(tx.recent()).filter(r => r.effect === "commit" && r.id === input.target);
      const prior = records[0], next = prior && replayUnrecorded(state, prior.id, prior.op, prior.outcome);
      const out = prior?.outcome as { work?: unknown; generation?: unknown } | undefined;
      if (records.length === 1 && next && out?.work === work.id && out.generation === work.session.generation)
        return { state: next, resp: { work: work.id, data: prior?.outcome } };
    }
    const q = state.pending.find(p => p.id === `leave-unrecorded-${input.target}`);
    const op = intent?.op as { work?: unknown; generation?: unknown } | undefined;
    if (!intent || !q || op?.work !== work.id || work.session.inCall ||
      (op.generation !== undefined && op.generation !== work.session.generation))
      throw new KernelError("revision-conflict", "no unresolved commit decision matches this exact work and generation", { exit: 2 });
    const facts = await commitRecoveryFacts(ports, intent, work);
    if (q.bind.factsHash !== facts.hash) {
      return {
        state: { ...state, pending: state.pending.map(p => p.id === q.id ? { ...q, bind: { factsHash: facts.hash } } : p) },
        resp: { exit: 3, questions: [{ ...q, bind: { factsHash: facts.hash } }],
          data: { observedCandidates: facts.candidates },
          reasons: [{ code: "revision-conflict", message: "Recovery facts changed; review the new observation before answering again." }] },
      };
    }
    tx.result("commit", intent.id, {
      disposition: "leave-unrecorded", work: work.id, generation: work.session.generation,
      factsHash: facts.hash, observedCandidates: facts.candidates,
    });
    const next = withWork({ ...state, pending: state.pending.filter(p => p.id !== q.id) },
      { ...work, state: work.lastValidPhase ?? work.state });
    return {
      state: next, resp: { work: work.id,
        data: { disposition: "leave-unrecorded", observedCandidates: facts.candidates },
        reasons: [], effects: {
          completed: [`commit intent ${intent.id} left unrecorded; Git unchanged; undo not authorized`], uncertain: [],
        } },
    };
  },
};
