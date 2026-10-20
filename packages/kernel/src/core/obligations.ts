// Obligations derived from the accepted basis (TS §9.2). Recipes and traits declare; they never bypass rules.
import type { BasisElement, Obligation } from "./schemas.ts";

export const obligationId = (elementId: string): string => `OB-${elementId}`;
export const FULL_SUITE = "OB-suite";

/** Whether the obligation's test must fail on the baseline. The default follows the test kind (deriveObligations sets the same one). */
export const wantsRed = (ob: Pick<Obligation, "test" | "expectation">): boolean =>
  (ob.expectation ?? (ob.test === "distinguishing" ? "fail" : "pass")) === "fail";

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
      state: "registered",
    };
    // A revised test keeps its earlier red only if the file is unchanged, so the prior record carries over by id.
    const p = prev.get(id);
    const same = p && p.testFile === base.testFile && p.test === base.test && p.expectation === base.expectation && JSON.stringify(p.support ?? []) === JSON.stringify(base.support ?? []);
    out.push(same ? { ...base, state: p.state, baselineTestHash: p.baselineTestHash, baselineMatched: p.baselineMatched, baselineInputs: p.baselineInputs } : base);
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

/** Support files locked with a test: those the example declares, plus the runner's own configuration (TS §9.7). */
export const CONFIG_INPUTS = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.json", ...["vitest", "vite"].flatMap(tool => ["ts", "js", "mts", "mjs", "cts", "cjs"].map(ext => `${tool}.config.${ext}`))];

/** Declared inputs participate even when Git ignores them; absences bind the baseline too. */
export const declaredInputs = (obligations: readonly Obligation[]): string[] => [...new Set([...CONFIG_INPUTS, ...obligations.flatMap(o => [...(o.testFile ? [o.testFile] : []), ...(o.support ?? []), ...Object.keys(o.baselineInputs ?? {})])])];
export function supportOf(ob: Obligation, facts: { inv: { entries: Map<string, { blob: string }> } }): Record<string, string> {
  const paths = [...(ob.support ?? []), ...CONFIG_INPUTS];
  return Object.fromEntries(paths.map(p => [p, facts.inv.entries.get(p)?.blob ?? ""]));
}

/** Both locking and the verdict require the same complete baseline definition, including declared absences. */
export function baselineDefinitionMatches(ob: Obligation, hash: (path: string) => string | undefined): boolean {
  return !!ob.baselineMatched && !!ob.testFile && !!ob.baselineTestHash && !!ob.baselineInputs &&
    hash(ob.testFile) === ob.baselineTestHash && Object.entries(ob.baselineInputs).every(([path, value]) => (hash(path) ?? "") === value);
}
