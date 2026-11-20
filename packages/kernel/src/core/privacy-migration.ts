import { z } from "zod";

const Position = z.enum(["before", "after", "unchanged", "unknown"]);
const Observation = z.strictObject({
  operation: z.enum(["privacy-schema-3-migration", "privacy-schema-3-fresh", "digest-key-repair-v3"]),
  phase: z.enum(["prepared", "snapshot", "key", "previous", "state", "marker", "migration-evidence-installed", "remove"]),
  extraTemps: z.literal(false),
  privateSource: z.enum(["not-required", "reserved", "complete-exact", "mismatch", "unknown"]),
  positions: z.strictObject({
    "digest.key": Position, "state.prev": Position, state: Position, marker: Position,
    "summaries.json": Position, "journal-index.json": Position,
  }),
  evidence: z.enum(["none", "target", "target-and-evidence"]),
  recovery: z.enum(["none", "temp", "final"]),
});
type PublicationObservation = z.infer<typeof Observation>;
type Target = keyof PublicationObservation["positions"];
export type PrivacyPublicationStep =
  | { kind: "refuse"; code: "storage-accounting-unknown" }
  | { kind: "capture" }
  | { kind: "publish"; target: Target }
  | { kind: "advance"; phase: Exclude<PublicationObservation["phase"], "prepared"> }
  | { kind: "publish-evidence"; target: "target" | "evidence" }
  | { kind: "stage-recovery" | "publish-recovery" | "remove" };

const refused: PrivacyPublicationStep = { kind: "refuse", code: "storage-accounting-unknown" };
const metadata = ["summaries.json", "journal-index.json"] as const;

function initialPublication(observed: PublicationObservation): PrivacyPublicationStep {
  const positions = observed.positions;
  if ([positions["state.prev"], positions.state, positions.marker].some(position => position !== "before")) return refused;
  const order: Target[] = observed.operation === "digest-key-repair-v3" ? ["digest.key"] : [...metadata, "digest.key"];
  const remaining = order.findIndex(target => positions[target] === "before");
  if (remaining < 0) return { kind: "advance", phase: "key" };
  if (order.slice(remaining).some(target => positions[target] !== "before")) return refused;
  return { kind: "publish", target: order[remaining]! };
}

function finalPublication(observed: PublicationObservation): PrivacyPublicationStep {
  if (observed.operation !== "privacy-schema-3-migration")
    return observed.phase === "marker" ? { kind: "advance", phase: "remove" } : { kind: "remove" };
  if (observed.phase === "marker") {
    if (observed.recovery !== "none") return refused;
    if (observed.evidence === "none") return { kind: "publish-evidence", target: "target" };
    return observed.evidence === "target" ? { kind: "publish-evidence", target: "evidence" } :
      { kind: "advance", phase: "migration-evidence-installed" };
  }
  if (observed.evidence !== "target-and-evidence") return refused;
  if (observed.phase === "remove") return observed.recovery === "final" ? { kind: "remove" } : refused;
  if (observed.recovery === "none") return { kind: "stage-recovery" };
  return observed.recovery === "temp" ? { kind: "publish-recovery" } : { kind: "advance", phase: "remove" };
}

function statePublication(observed: PublicationObservation): PrivacyPublicationStep {
  const p = observed.positions;
  if (p["digest.key"] !== "after" || metadata.some(target =>
    p[target] !== (observed.operation === "digest-key-repair-v3" ? "unchanged" : "after"))) return refused;
  if (observed.phase === "key") {
    if (p.state !== "before" || p.marker !== "before") return refused;
    return p["state.prev"] === "before" ? { kind: "publish", target: "state.prev" } : { kind: "advance", phase: "previous" };
  }
  if (p["state.prev"] !== "after") return refused;
  if (observed.phase === "previous") {
    if (p.marker !== "before") return refused;
    return p.state === "before" ? { kind: "publish", target: "state" } : { kind: "advance", phase: "state" };
  }
  if (p.state !== "after") return refused;
  if (observed.phase === "state")
    return p.marker === "before" ? { kind: "publish", target: "marker" } : { kind: "advance", phase: "marker" };
  return p.marker === "after" ? finalPublication(observed) : refused;
}

function operationMatches(observed: PublicationObservation): boolean {
  if (observed.operation === "privacy-schema-3-migration")
    return observed.privateSource === "complete-exact" || observed.phase === "prepared" && observed.privateSource === "reserved";
  return observed.privateSource === "not-required" && observed.phase !== "snapshot" &&
    observed.phase !== "migration-evidence-installed" && observed.evidence === "none" && observed.recovery === "none";
}

/** Selects order from already bound observations; never admits a transition, identity, temp or private source. */
export function privacyPublicationStep(observation: unknown): PrivacyPublicationStep {
  const parsed = Observation.safeParse(observation);
  if (!parsed.success) return refused;
  const o = parsed.data, forward = o.operation === "privacy-schema-3-migration", repair = o.operation === "digest-key-repair-v3";
  if (Object.entries(o.positions).some(([target, position]) => position === "unknown" ||
      position === "unchanged" && !(repair && (target === "summaries.json" || target === "journal-index.json")))) return refused;
  if (repair && metadata.some(target => o.positions[target] !== "unchanged")) return refused;
  if (!operationMatches(o)) return refused;
  if (!["marker", "migration-evidence-installed", "remove"].includes(o.phase) &&
      (o.evidence !== "none" || o.recovery !== "none")) return refused;
  if (forward && o.phase === "prepared") {
    if (Object.values(o.positions).some(position => position !== "before")) return refused;
    return o.privateSource === "reserved" ? { kind: "capture" } : { kind: "advance", phase: "snapshot" };
  }
  return o.phase === "prepared" || o.phase === "snapshot" ? initialPublication(o) : statePublication(o);
}
