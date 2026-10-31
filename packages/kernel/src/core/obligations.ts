// Obligations derived from the accepted basis (TS §9.2). Recipes and traits declare; they never bypass rules.
import type { CheckTool, StaticTool } from "../ports/types.ts";
import type { BasisElement, Obligation } from "./schemas.ts";

export const obligationId = (elementId: string): string => `OB-${elementId}`;
export const FULL_SUITE = "OB-suite";
export const E2E_SUITE = "OB-e2e";

const STATIC: Record<StaticTool, string> = { tsc: "OB-types", eslint: "OB-lint" };
const ALIASES: Record<string, StaticTool> = { types: "tsc", typecheck: "tsc", lint: "eslint" };
type StaticRequirement = {
  id: string; tool?: string; configuration?: string; population?: string; pass?: string; alternatives?: string[];
};

/** The static checks a contract owes: both after a starter scaffold, otherwise those a required check names (by tool, or by id). */
export function wantedStatic(recipe: readonly CheckTool[], required: readonly StaticRequirement[]): StaticTool[] {
  const toolOf = (c: StaticRequirement) => {
    // The fixed invocation cannot prove custom configuration, population, criteria or alternatives.
    if (c.configuration !== undefined || c.population !== undefined || c.pass !== undefined || c.alternatives?.length)
      return undefined;
    return c.tool ? (c.tool in STATIC ? (c.tool as StaticTool) : undefined) : ALIASES[c.id];
  };
  const named = new Set(required.map(toolOf));
  return (Object.keys(STATIC) as StaticTool[]).filter((t) => recipe.includes(t) || named.has(t));
}

/** Adds the static obligations that are not there yet; the acceptance obligations are untouched. */
export const withStatic = (obligations: readonly Obligation[], tools: readonly StaticTool[]): Obligation[] => [
  ...obligations,
  ...tools
    .filter((t) => !obligations.some((o) => o.id === STATIC[t]))
    .map((t): Obligation => ({ id: STATIC[t], kind: "static", category: "boundary", tool: t })),
];

/** The recipe names "e2e" (EVD-13): integration/end-to-end checks against a Tenet-started server and a dedicated test database. */
export const wantsE2e = (recipe: readonly CheckTool[]): boolean => recipe.includes("e2e");

/** Adds the e2e obligation when wanted and not already present; routed like a static tool (its own separate run,
 * its own report), but normalized with real test counts, not diagnostics — so it keeps `kind: "static"` for
 * dispatch while `tool: "playwright"` tells the receipt layer to use test-count normalization instead. */
export const withE2e = (obligations: readonly Obligation[], wanted: boolean): Obligation[] =>
  wanted && !obligations.some((o) => o.id === E2E_SUITE)
    ? [...obligations, { id: E2E_SUITE, kind: "static", category: "affected", tool: "playwright" }]
    : [...obligations];


/** Requirements that have neither a boundary example nor an invariant (a negative statement) to go with them (INT-15). */
export const withoutBoundary = (elements: readonly BasisElement[]): string[] =>
  elements
    .filter((r) => r.kind === "requirement")
    .filter((r) => !elements.some((e) => e.of === r.id && (e.kind === "invariant" || (e.kind === "example" && e.test === "boundary"))))
    .map((r) => r.id);

/** Whether a required check is one the kernel runs itself; every other one is still only a stored declaration. */
export const isStaticCheck = (c: StaticRequirement): boolean => wantedStatic([], [c]).length > 0;

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
      testFile: el.testFile, ...(el.support?.length ? { support: el.support } : {}), ...(el.outputs?.length ? { outputs: el.outputs } : {}), test: kind, expectation: el.expect ?? (kind === "distinguishing" ? "fail" : "pass"),
      state: "registered",
    };
    // A revised test keeps its earlier red only if the file is unchanged, so the prior record carries over by id.
    const p = prev.get(id);
    const same = p && p.testFile === base.testFile && p.test === base.test && p.expectation === base.expectation &&
      JSON.stringify(p.support ?? []) === JSON.stringify(base.support ?? []) &&
      JSON.stringify(p.outputs ?? []) === JSON.stringify(base.outputs ?? []);
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
export const CONFIG_INPUTS = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.json", ...["vitest", "vite", "eslint", "playwright"].flatMap(tool => ["ts", "js", "mts", "mjs", "cts", "cjs"].map(ext => `${tool}.config.${ext}`))];

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
