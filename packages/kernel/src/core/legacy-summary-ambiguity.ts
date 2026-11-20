import { z } from "zod";
import { KernelError } from "./errors.ts";
import { sha256, stableStringify } from "./ids.ts";
import { parseUniqueRecord } from "./private-record.ts";
import {
  FileProof, JournalIndexV1, LegacyBaseV2, StableFileIdentity, StorageCount, SummaryV2,
} from "./storage-records.ts";

const WorkId = z.string().regex(/^wk_[a-z2-7]{10}$/);
const Instance = z.string().regex(/^[a-z2-7]{24}$/);
const Verb = z.enum(["open", "check", "commit", "integrate", "undo", "finish", "packet", "findings", "review", "decide"]);
const Decision = z.enum([
  "basis", "scaffold", "dirty-overlap", "acceptance", "disposition", "unexplained", "extend",
  "hook-consent", "filter-consent", "envelope-consent", "sync-index", "branch-switch", "shared-merge",
  "config", "undo-confirm", "adopt", "overview", "plan", "grant", "decision-record", "dependency",
  "abandon-confirm", "takeover-check", "decline", "lesson", "hardening", "model-limit", "traits", "baseline-failures",
]);
const StoreTuple = z.strictObject({
  workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/), markerIdentity: StableFileIdentity, schema: z.literal(3),
});
const Evidence = z.strictObject({
  summary: FileProof.extend({ path: z.literal("summaries.json") }),
  journalIndex: FileProof.extend({ path: z.literal("journal-index.json") }),
  journalIdentity: StableFileIdentity, legacyBase: LegacyBaseV2,
});
export const LegacySummaryAmbiguityRequestV1 = z.strictObject({
  version: z.literal(1), questionInstance: Instance, store: StoreTuple, evidence: Evidence,
  trigger: z.strictObject({
    verb: Verb, decisionKind: Decision.nullable(), workId: WorkId, sessionGeneration: StorageCount,
  }).refine(trigger => (trigger.verb === "decide") === (trigger.decisionKind !== null)),
  scope: z.strictObject({ eligibleOperationsVersion: z.literal(1), storeSession: z.literal(true) }),
});
export const LegacySummaryAmbiguityDecisionV1 = z.strictObject({
  version: z.literal(1), status: z.enum(["retained", "declined"]), request: LegacySummaryAmbiguityRequestV1,
  capturedAt: z.iso.datetime({ offset: true }), capture: z.literal("elicited"),
});
type Request = z.infer<typeof LegacySummaryAmbiguityRequestV1>;
type DecisionRecord = z.infer<typeof LegacySummaryAmbiguityDecisionV1>;
export interface AmbiguityObservation {
  store: z.infer<typeof StoreTuple>;
  summaryText: string; summaryProof: FileProof;
  indexText: string; indexProof: FileProof; journalIdentity: z.infer<typeof StableFileIdentity>;
  workId: string; sessionGeneration: number;
}
export interface AmbiguityOperation {
  verb: string; resume?: boolean; decisionKind?: string; target?: string; exactHistory?: boolean;
}
export const LEGACY_SUMMARY_DISCLOSURE =
  "Retained legacy summary ambiguity: local storage totals are historical and are not exact history.";
const same = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);
const unknown = () => new KernelError("storage-accounting-unknown", "legacy summary evidence is unavailable or unadmitted", { exit: 2 });
const stale = () => new KernelError("revision-conflict", "the legacy summary decision does not match this store and session", { exit: 2 });

function eligible(operation: AmbiguityOperation): boolean {
  if (!Verb.safeParse(operation.verb).success || operation.exactHistory === true) return false;
  if (operation.verb === "open") return operation.resume === true;
  if (operation.verb !== "decide") return true;
  if (!Decision.safeParse(operation.decisionKind).success) return false;
  return operation.decisionKind !== "adopt" || operation.target === "intent" || operation.target === "policy";
}

/** Repeated for creation, answer and replay; retained consent never replaces normal summary admission. */
function admitted(observed: AmbiguityObservation) {
  try {
    const store = StoreTuple.parse(observed.store), summaryProof = FileProof.parse(observed.summaryProof);
    const indexProof = FileProof.parse(observed.indexProof);
    const summary = SummaryV2.parse(parseUniqueRecord(observed.summaryText));
    const index = JournalIndexV1.parse(parseUniqueRecord(observed.indexText));
    if (summaryProof.path !== "summaries.json" || indexProof.path !== "journal-index.json") throw unknown();
    if (sha256(observed.summaryText) !== summaryProof.sha256 || sha256(observed.indexText) !== indexProof.sha256 ||
      Buffer.byteLength(observed.summaryText, "utf8") !== summaryProof.bytes ||
      Buffer.byteLength(observed.indexText, "utf8") !== indexProof.bytes) throw unknown();
    const { batchId, ...selectedSummary } = index.summary;
    const workId = WorkId.parse(observed.workId), sessionGeneration = StorageCount.parse(observed.sessionGeneration);
    return {
      store, workId, sessionGeneration,
      consistent: same(selectedSummary, summaryProof) && summary.batchId === batchId &&
        same(index.active.identity, observed.journalIdentity),
      evidence: summary.legacyBase === null ? null : Evidence.parse({
        summary: summaryProof, journalIndex: indexProof, journalIdentity: observed.journalIdentity,
        legacyBase: summary.legacyBase,
      }),
    };
  } catch (error) {
    if (error instanceof KernelError && error.reasons[0]?.code === "storage-accounting-unknown") throw error;
    throw unknown();
  }
}

export function ambiguityRequest(observed: AmbiguityObservation, operation: AmbiguityOperation, questionInstance: string): Request | null {
  const current = admitted(observed);
  if (!current.consistent) throw unknown();
  if (!current.evidence) return null;
  if (!eligible(operation)) throw unknown();
  return LegacySummaryAmbiguityRequestV1.parse({
    version: 1, questionInstance, store: current.store, evidence: current.evidence,
    trigger: {
      verb: operation.verb, decisionKind: operation.verb === "decide" ? operation.decisionKind : null,
      workId: current.workId, sessionGeneration: current.sessionGeneration,
    },
    scope: { eligibleOperationsVersion: 1, storeSession: true },
  });
}

function matches(request: Request, current: ReturnType<typeof admitted>): boolean {
  return same(request.store, current.store) && same(request.evidence, current.evidence) &&
    request.trigger.workId === current.workId && request.trigger.sessionGeneration === current.sessionGeneration;
}

export function ambiguityAnswer(request: unknown, observed: AmbiguityObservation, answer: string, capturedAt: string): DecisionRecord {
  const current = admitted(observed);
  const parsed = LegacySummaryAmbiguityRequestV1.safeParse(request);
  if (!parsed.success || !matches(parsed.data, current)) throw stale();
  if (!current.consistent) throw unknown();
  const retain = `retain:${parsed.data.questionInstance}`, decline = `decline:${parsed.data.questionInstance}`;
  if (answer !== retain && answer !== decline) throw stale();
  return LegacySummaryAmbiguityDecisionV1.parse({
    version: 1, status: answer === retain ? "retained" : "declined", request: parsed.data, capturedAt, capture: "elicited",
  });
}

export function ambiguityAllows(decision: unknown, observed: AmbiguityObservation, operation: AmbiguityOperation): boolean {
  const current = admitted(observed), parsed = LegacySummaryAmbiguityDecisionV1.safeParse(decision);
  if (!parsed.success || parsed.data.status !== "retained" || !eligible(operation) || !matches(parsed.data.request, current)) return false;
  if (!current.consistent) throw unknown();
  return true;
}

export function ambiguityDisclosure(decision: unknown) {
  const parsed = LegacySummaryAmbiguityDecisionV1.safeParse(decision);
  if (!parsed.success || parsed.data.status !== "retained") throw stale();
  return {
    storage: {
      legacySummary: "ambiguous-retained" as const, exactHistory: false as const,
      decisionInstance: parsed.data.request.questionInstance,
    },
    message: LEGACY_SUMMARY_DISCLOSURE,
  };
}
