// Obligations derived from the accepted basis (TS §9.2). Recipes and traits declare; they never bypass rules.
import type { BasisElement, Obligation } from "./schemas.ts";

export const obligationId = (elementId: string): string => `OB-${elementId}`;
export const FULL_SUITE = "OB-suite";

/** One acceptance obligation per example that names a test file, plus the full-suite affected obligation. */
export function deriveObligations(elements: readonly BasisElement[], tool: string, previous: readonly Obligation[]): Obligation[] {
  const prev = new Map(previous.map((o) => [o.id, o]));
  const out: Obligation[] = [];
  for (const el of elements) {
    if (el.kind !== "example" || !el.testFile) continue;
    const kind = el.test ?? "distinguishing";
    const id = obligationId(el.id);
    const base: Obligation = {
      id, kind: "test", category: kind === "boundary" ? "boundary" : "acceptance", targeted: true, tool, example: el.id,
      testFile: el.testFile, ...(el.support?.length ? { support: el.support } : {}), test: kind, expectation: el.expect ?? (kind === "distinguishing" ? "fail" : "pass"),
    };
    // A revised test keeps its earlier red only if the file is unchanged, so the prior record carries over by id.
    const p = prev.get(id);
    out.push(p && p.testFile === base.testFile ? { ...base, state: p.state, baselineTestHash: p.baselineTestHash, baselineMatched: p.baselineMatched } : base);
  }
  out.push(prev.get(FULL_SUITE) ?? { id: FULL_SUITE, kind: "test", category: "affected", tool });
  return out;
}

/** The verification links a basis element gets by default, derived from the obligations that exist. */
export function linkElement(el: BasisElement, all: readonly BasisElement[]): BasisElement["verifiedBy"] {
  if (el.kind === "example") return el.testFile ? [{ method: "obligation", ref: obligationId(el.id) }] : [{ method: "review", ref: "review" }];
  if (el.kind === "requirement" || el.kind === "invariant") {
    const refs = all.filter((e) => e.kind === "example" && e.of === el.id && e.testFile).map((e) => ({ method: "obligation" as const, ref: obligationId(e.id) }));
    return refs.length ? refs : [{ method: "review", ref: "review" }];
  }
  if (el.kind === "assumption") return [];
  return { notApplicable: `${el.kind} carries no check of its own` };
}
