// The threat and data note (QLT-13): basis elements tagged with a `threat` section. Pure.
// Required when the change carries auth, persistence, personal-data or external-effects as `present` (trait-threat-data.md §5.2;
// `unknown` alone does not require it here, because every R1 detector declares partial coverage and would ask on every change).
import type { BasisElement } from "./schemas.ts";

export const THREAT_TRAITS = ["auth", "persistence", "personal-data", "external-effects"] as const;
export const THREAT_SECTIONS = ["actor", "asset", "data", "abuse"] as const;
export type ThreatSection = (typeof THREAT_SECTIONS)[number];

/** Which element kinds each section may use (TN-12). An actor may also be a constraint: a stated trust boundary needs no confirming. */
const KINDS: Record<ThreatSection, readonly BasisElement["kind"][]> = {
  actor: ["assumption", "constraint"],
  asset: ["constraint", "invariant", "example"],
  data: ["constraint", "invariant", "example"],
  abuse: ["example", "invariant", "constraint"],
};

/** A security item is linked when it is a constraint, an example with a test, or an invariant with a tested child example (TN-3). */
function linked(el: BasisElement, all: readonly BasisElement[]): boolean {
  if (el.kind === "constraint") return true;
  if (el.kind === "example") return !!el.testFile;
  return el.kind === "invariant" && all.some((c) => c.kind === "example" && c.of === el.id && !!c.testFile);
}

export interface ThreatStatus {
  required: boolean; traits: string[]; missingSections: ThreatSection[]; open: string[]; invalid: string[]; constraints: number;
}

export function threatNoteStatus(changeTraits: readonly string[], elements: readonly BasisElement[]): ThreatStatus {
  const traits = THREAT_TRAITS.filter((t) => changeTraits.includes(t));
  const tagged = elements.filter((e) => e.threat);
  const invalid = tagged.filter((e) => !KINDS[e.threat!].includes(e.kind)).map((e) => e.id);
  const open = tagged.filter((e) => e.threat !== "actor" && !invalid.includes(e.id) && !linked(e, elements)).map((e) => e.id);
  return {
    required: traits.length > 0, traits,
    missingSections: THREAT_SECTIONS.filter((s) => !tagged.some((e) => e.threat === s && !invalid.includes(e.id))),
    open, invalid,
    constraints: tagged.filter((e) => e.kind === "constraint" && e.threat !== "actor").length,
  };
}

/** The sentence a reason carries: which sections are missing and which items are neither a test nor a constraint. */
export function threatGap(s: ThreatStatus): string | null {
  if (!s.required) return null;
  const parts = [
    ...(s.missingSections.length ? [`missing ${s.missingSections.join(", ")}`] : []),
    ...(s.open.length ? [`not a test or constraint: ${s.open.join(", ")}`] : []),
    ...(s.invalid.length ? [`wrong element kind: ${s.invalid.join(", ")}`] : []),
  ];
  return parts.length ? `the ${s.traits.join(", ")} change needs a threat and data note (${parts.join("; ")})` : null;
}
