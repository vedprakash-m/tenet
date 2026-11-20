import type { Normalized } from "../ports/types.ts";
import type { Obligation } from "./schemas.ts";
import { ClosedFailureKind, FailureSlot } from "./privacy-types.ts";
import type { FailureEvent, PrivacyIdentity } from "./privacy-types.ts";
import { sha256, stableStringify } from "./ids.ts";
import { KernelError } from "./errors.ts";
import type { BudgetStateV3, Question } from "./schemas.ts";
import { BudgetStateV3 as PrivacyBudget } from "./schemas.ts";
import { z } from "zod";

export {
  IdentityDigest, PrivacyIdentity, SEMVER_PATTERN, SemVer, PackageName, RegistrySpec,
  FailureSlot, ClosedFailureKind, FailureEvent, FailureDiagnosis,
} from "./privacy-types.ts";
export { BudgetStateV3 } from "./schemas.ts";

const DiagnosisBinding = z.strictObject({
  domain: z.literal("failure-diagnosis-v1"), version: z.literal(1),
  workId: z.string().regex(/^wk_[a-z2-7]{10}$/),
  generation: z.number().int().nonnegative(), throughAttempt: z.number().int().nonnegative(),
  unknownEventIndex: z.number().int().min(0).max(7),
});
const DiagnosisChoice = z.enum(["resume", "finish-current", "pause"]);
const DiagnosisAnswer = z.strictObject({
  choice: DiagnosisChoice, at: z.iso.datetime(), factsHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export function failureDiagnosisQuestion(workId: unknown, generation: unknown, budget: unknown): Question | undefined {
  const parsed = PrivacyBudget.safeParse(budget);
  if (!parsed.success) return undefined;
  const b = parsed.data, latest = b.failureEvents.at(-1), diagnosis = b.failureDiagnosis;
  if (latest?.kind !== "unknown" || diagnosis && diagnosis.unknownEventIndex === b.failureEvents.length - 1 &&
      diagnosis.throughAttempt <= b.attempts && (latest.attempt === null || diagnosis.throughAttempt >= latest.attempt)) return undefined;
  const binding = DiagnosisBinding.safeParse({
    domain: "failure-diagnosis-v1", version: 1, workId, generation, throughAttempt: b.attempts,
    unknownEventIndex: b.failureEvents.length - 1,
  });
  if (!binding.success) return undefined;
  return {
    id: "failure-diagnosis", header: "Failure diagnosis",
    question: "The failure identity is unknown. Diagnose it before another full candidate attempt.",
    options: [
      { label: "Diagnosis is complete; run a later full attempt", description: "Keep the recorded failure barrier.", recommended: true },
      { label: "Finish with the current evidence", description: "Do not clear the failure stop." },
      { label: "Pause", description: "Pause the current work." },
    ],
    channel: "native", bind: { factsHash: sha256(stableStringify(binding.data)) },
  };
}

export function answerFailureDiagnosis(
  workId: unknown, generation: unknown, budget: BudgetStateV3, factsHash: unknown, answer: unknown, at: unknown
): { budget: BudgetStateV3; choice: "resume" | "finish-current" | "pause"; clearStop: boolean } {
  const accepted = DiagnosisAnswer.parse({ choice: answer, at, factsHash });
  const question = failureDiagnosisQuestion(workId, generation, budget);
  if (!question || question.bind.factsHash !== accepted.factsHash)
    throw new KernelError("revision-conflict", "Failure diagnosis has changed.");
  const current = PrivacyBudget.parse(budget);
  if (accepted.choice !== "resume") return { budget: current, choice: accepted.choice, clearStop: false };
  return {
    budget: PrivacyBudget.parse({
      ...current, failureDiagnosis: {
        domain: "failure-diagnosis-v1", version: 1, throughAttempt: current.attempts,
        unknownEventIndex: current.failureEvents.length - 1, at: accepted.at,
      },
    }),
    choice: accepted.choice, clearStop: true,
  };
}

export function legacyFailureEvents(signatures: readonly string[], verifiedAttempts: number): {
  events: FailureEvent[]; mapping: "verified" | "unavailable";
} {
  if (!Number.isSafeInteger(verifiedAttempts) || verifiedAttempts < 0 || signatures.length > 8 ||
      signatures.some(value => typeof value !== "string"))
    throw new KernelError("unsupported-record", "Legacy failure accounting is outside the supported bounds.");
  const mapped = signatures.length <= verifiedAttempts;
  return {
    events: signatures.map((_, index) => ({
      kind: "unknown", attempt: mapped ? verifiedAttempts - signatures.length + index + 1 : null, cause: "legacy-no-provenance",
    })),
    mapping: mapped ? "verified" : "unavailable",
  };
}

function singleReportedFailure(files: Normalized["files"]) {
  const entries = [...files.entries()];
  if (entries.some(([, file]) => !Number.isSafeInteger(file.failed) || file.failed < 0 ||
      (file.outcomes?.filter(outcome => outcome.status === "failed").length ?? 0) !== file.failed ||
      file.failures.length !== file.failed) ||
      entries.reduce((total, [, file]) => total + file.failed, 0) !== 1) return undefined;
  return entries.find(([, file]) => file.failed === 1);
}

export function failureIdentity(obligations: readonly Obligation[], report: Normalized): PrivacyIdentity {
  const unknown: PrivacyIdentity = { status: "unknown", producer: "failure", cause: "outside-closed-domain" };
  const obligation = obligations[0];
  if (obligations.length !== 1 || !obligation || report.invalid ||
      !/^OB-[A-Za-z0-9._-]{1,64}$/.test(obligation.id)) return unknown;
  const slots = [obligation.coverageTag, obligation.example].filter(slot => slot !== undefined);
  const slot = FailureSlot.safeParse(slots[0]);
  if (slots.length !== 1 || !slot.success) return unknown;
  const failed = singleReportedFailure(report.files);
  if (!failed || obligation.testFile !== undefined && obligation.testFile !== failed[0]) return unknown;
  const file = failed[1], outcomes = file.outcomes?.filter(outcome => outcome.status === "failed") ?? [];
  const outcome = outcomes[0], kind = ClosedFailureKind.safeParse(file.failureKinds[0]);
  if (outcomes.length !== 1 || !outcome || !kind.success || file.failures[0]?.test !== outcome.test ||
      file.failureKinds.length !== 1 || file.failures.length !== 1) return unknown;
  const tags = [...outcome.test.matchAll(/\[((?:COV|EX)-[^\]\s]+)\]/g)].map(match => match[1]);
  const kinds = [...(outcome.kinds ?? []), ...(outcome.kind === undefined ? [] : [outcome.kind]), file.failures[0]!.kind];
  if (tags.length !== 1 || tags[0] !== slot.data || kinds.some(value => value !== kind.data)) return unknown;
  const projection = {
    domain: "failure-slot-v1" as const, version: 1 as const, obligation: obligation.id, slot: slot.data, failureKind: kind.data,
  };
  return {
    status: "known", domain: projection.domain, version: 1,
    value: `sha256:${sha256(stableStringify(projection))}`, claim: "exact-admitted-value",
  };
}
