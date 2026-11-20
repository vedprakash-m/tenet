import { changedSinceCheck } from "../core/attribution.ts";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import type { ReasonCode } from "../core/reasons.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import { coverageEvidenceForReceipts } from "../core/alternative-check.ts";
import { checkpointEvidence } from "../core/verdict.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { nx } from "./common.ts";
import { filterQuestion, hookQuestion, signingQuestion, unexplainedQuestion } from "./commit-questions.ts";
import { dirtyQuestion, undecidedDirty } from "./dirty.ts";
import { checkInputId } from "./facts.ts";
import type { Facts } from "./facts.ts";

function dirtyBlocker(
  ports: Ports, st: State, w: WorkContract, facts: Facts, paths: readonly string[], why: string,
): Plan {
  const q = dirtyQuestion(w, facts.inv, ports.rand.base32(12), paths);
  return {
    state: { ...st, pending: [...st.pending.filter((item) => item.id !== q.id), q] },
    resp: {
      work: w.id, exit: 3, questions: [q],
      reasons: [reason("attribution-mixed-file", paths.join(", "))],
      next: [nx("ask", why, true)],
    },
  };
}

function consentBlocker(
  st: State, w: WorkContract, q: ReturnType<typeof hookQuestion>, code: ReasonCode, why: string, note = false,
): Plan {
  return {
    state: { ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] },
    resp: {
      work: w.id,
      exit: 3,
      questions: [q],
      reasons: [reason(code, why, note ? { note: true } : {})],
      next: [nx("ask", "Ask the user about the configured program before committing.", true)],
    },
  };
}

/** Everything that stops a commit before any effect: a refusal, a question, nothing to commit, or `"go"`. */
export async function commitBlockers(
  ports: Ports, st: State, w: WorkContract, facts: Facts,
): Promise<Plan | null | "go"> {
  const probe = await ports.git.probe();
  if (w.git.mode !== "git") return null;
  if (probe.state !== "ok") throw new KernelError("repo-state-readonly", probe.why);
  if (!probe.identity) {
    return {
      resp: {
        work: w.id,
        reasons: [reason("git-identity-missing")],
        next: [nx("commit", "Set a Git name and email, then commit again.")],
      },
    };
  }
  const undecided = undecidedDirty(w, facts.inv);
  if (undecided.length)
    return dirtyBlocker(ports, st, w, facts, undecided, "Ask what happens to each overlapping file.");
  const editUncommitted = facts.editUncommitted ?? [];
  if (editUncommitted.length)
    return dirtyBlocker(ports, st, w, facts, editUncommitted, "Commit needs fresh whole-file inclusion authority.");
  if (facts.att.unexplained.length) {
    const q = unexplainedQuestion(facts.att.unexplained);
    return {
      state: { ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] },
      resp: {
        work: w.id,
        exit: 3,
        questions: [q],
        reasons: [reason("attribution-unexplained-change", facts.att.unexplained.join(", "))],
        next: [nx("ask", "Ask the user about the unexplained changes.", true)],
      },
    };
  }
  if (!facts.tenetPaths.length) return null;
  const inputId = checkInputId(ports, w, facts.candidate);
  const coverage = coverageEvidenceForReceipts(st, w.id, w.basis?.hash ?? "", w.receipts, inputId);
  if (
    !checkpointEvidence(w, facts.candidate, inputId, coverage.approval, coverage.evidence) ||
    changedSinceCheck(w, facts.inv, facts.tenetPaths).length
  ) {
    throw new KernelError("stale", "run a full successful check before committing", { exit: 2 });
  }
  if (probe.hooks && !st.consents.some((c) => c.kind === "hooks" && c.configHash === probe.hooks)) {
    const q = hookQuestion(probe.hooks);
    return consentBlocker(st, w, q, "hook-consent-needed", "commit hooks need consent");
  }
  const filters = await ports.git.filterGate();
  if (filters && !st.consents.some((c) => c.kind === "filters" && c.configHash === filters.hash)) {
    const q = filterQuestion(filters);
    return consentBlocker(
      st, w, q, "filter-consent-needed",
      `Git filters ${filters.names.join(", ")} would run on this commit`,
    );
  }
  if (probe.signing && !st.consents.some((c) => c.kind === "signing" && c.configHash === probe.signing)) {
    const q = signingQuestion(w, probe.signing, `SQ-${st.revision}-${ports.rand.base32(12)}`);
    return consentBlocker(
      st, w, q, "signing-unavailable", "configured commit signing needs consent", true,
    );
  }
  return "go";
}
