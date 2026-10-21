// The verdict table (PRD 4.5.2, TS §8.3). The only module that produces an endpoint. Pure and monotone:
// more fresh passing evidence never weakens an endpoint, removing evidence never strengthens it.
import { ceiling } from "./risk.ts";
import { reason } from "./reasons.ts";
import { baselineDefinitionMatches, wantsRed } from "./obligations.ts";
import type { AnalystLink, AttentionItem, BasisElement, Endpoint, Finding, Lane, Level, Obligation, Profile, Reason, Receipt, ReviewLink, Scope, StopReason } from "./schemas.ts";

export interface VerdictInput {
  profile: Profile | "review";
  level: Level;
  lane?: Lane;
  implementationExists: boolean;
  prototypeRequested: boolean;
  behavioralChange: boolean;
  reviewRequired: boolean;
  candidate: string;
  checkInputId: string; // identity of the current check inputs; a receipt is fresh only when it matches (TS §8.8)
  basisHash: string;
  elements: readonly BasisElement[];
  confirmedAssumptions?: readonly string[];
  unsupportedChecks?: readonly string[];
  authorityAvailable?: boolean;
  obligations: readonly Obligation[];
  receipts: readonly Receipt[];
  baselineFailures: readonly string[];
  excludedScope: readonly string[];
  testHashes: Readonly<Record<string, string>>; // current hash of each acceptance test file
  changedLocks: readonly string[]; // locked paths changed without disposition
  unauthorized: readonly string[]; // edits in protected paths that no grant covers (WRK-03)
  reviews: readonly ReviewLink[];
  analyses: readonly AnalystLink[];
  reviewFiles?: Readonly<Record<string, string>>;
  findings: readonly Finding[];
  attention: readonly AttentionItem[];
  declined: readonly string[];
  stopReason?: StopReason;
  attemptsLeft: number;
  commitExists: boolean;
  committedTreeChecked: boolean;
  checkedIncludesHumanEdits: boolean;
  integratedStale: boolean;
}

export interface Verdict { endpoint: Endpoint; scope?: Scope; reasons: Reason[]; stopReason?: StopReason }

const RANK: Record<string, number> = { blocked: 0, "findings-only": 1, "implemented-unverified": 2, "checked-local": 3 };
const ENDPOINT_BY_RANK = ["blocked", "findings-only", "implemented-unverified", "checked-local"] as const;

/** A receipt is valid while its check-input identity equals the current one, so the newest valid one is the evidence (TS §8.8). */
const fresh = (receipts: readonly Receipt[], id: string, checkInputId: string): Receipt | undefined =>
  receipts.filter((r) => r.obligation === id && r.checkInputId === checkInputId && r.stage !== "baseline").at(-1); // a planned red is not evidence of the candidate

function judgeObligation(ob: Obligation, i: VerdictInput): Reason[] {
  const rc = fresh(i.receipts, ob.id, i.checkInputId);
  if (!rc) return [i.receipts.some((r) => r.obligation === ob.id && r.stage !== "baseline") ? reason("stale", ob.id, { refs: [ob.id] }) : reason("evidence-missing", ob.id, { refs: [ob.id] })];
  if (rc.status === "skipped" || rc.status === "inconclusive") {
    return [reason("evidence-inconclusive", `${ob.id}: ${rc.reasons.join(", ") || rc.status}`, { refs: [ob.id] })];
  }
  const out: Reason[] = [];
  if (rc.status === "fail") {
    const names = (rc.failures ?? []).map((f) => f.test);
    const preexisting = names.length > 0 && names.every((n) => i.baselineFailures.includes(n));
    if (!preexisting) out.push(reason("evidence-failed", ob.id, { refs: [ob.id] }));
    else if (names.every((n) => i.excludedScope.includes(n))) out.push(reason("baseline-failure-excluded", ob.id, { note: true }));
    else out.push(reason("baseline-failure-not-excluded", ob.id, { refs: [ob.id] }));
  }
  if (rc.qualifiers.includes("flaky")) out.push(reason("evidence-flaky", ob.id, { refs: [ob.id] }));
  return out;
}

const passed = (i: VerdictInput, id: string): boolean => {
  const rc = fresh(i.receipts, id, i.checkInputId);
  return !!rc && rc.status === "pass" && !rc.qualifiers.includes("flaky");
};

const reviewOk = (i: VerdictInput): boolean => judgeReview(i).every(r => r.note);

function judgeElement(el: BasisElement, i: VerdictInput): Reason[] {
  if (el.kind === "deferred" || el.kind === "decision" || el.kind === "constraint") return [];
  const v = el.verifiedBy;
  if (!Array.isArray(v)) return v.notApplicable ? [] : [reason("basis-element-unverified", el.id, { refs: [el.id] })];
  const ok = v.length > 0 && v.every((m) => (m.method === "obligation" ? passed(i, m.ref) : m.method === "review" ? reviewOk(i) : el.kind === "assumption" && !!i.confirmedAssumptions?.includes(el.id)));
  if (el.kind === "assumption" && !ok) return [reason("assumption-unresolved", el.id, { refs: [el.id] })];
  return ok ? [] : [reason("basis-element-unverified", el.id, { refs: [el.id] })];
}

/** A behavioral change needs a distinguishing red on the baseline; the red must still apply to the test that went green. */
function judgeRed(i: VerdictInput): Reason[] {
  const out: Reason[] = [];
  const acceptance = i.obligations.filter(o => o.testFile && o.test);
  if (!acceptance.some(o => o.test !== "preservation" && wantsRed(o))) out.push(reason("no-distinguishing-red", "no distinguishing baseline obligation was recorded"));
  for (const ob of acceptance) {
    const proved = ob.baselineMatched && ob.baselineTestHash && ob.baselineInputs;
    if (wantsRed(ob) && !proved) out.push(reason("no-distinguishing-red", ob.id, { refs: [ob.id] }));
    else if (!wantsRed(ob) && !proved) out.push(reason("evidence-missing", `the baseline expectation for ${ob.id} was not verified`, { refs: [ob.id] }));
    else if (!baselineDefinitionMatches(ob, path => i.testHashes[path]) && ob.testFile && i.testHashes[ob.testFile] !== ob.baselineTestHash) {
      out.push(reason("red-invalidated", ob.testFile, { refs: [ob.id] }));
    }
    if (proved && ob.alongsideReason) out.push(reason("test-alongside", ob.alongsideReason, { refs: [ob.id], note: true }));
    for (const [path, hash] of Object.entries(ob.baselineInputs ?? {})) if ((i.testHashes[path] ?? "") !== hash) out.push(reason("red-invalidated", path, { refs: [ob.id] }));
  }
  return out;
}

export function judgeReview(i: VerdictInput): Reason[] {
  const link = i.reviews.at(-1);
  if (!link) return [reason("review-missing")];
  if (link.candidate !== i.candidate || link.basisHash !== i.basisHash) return [reason("review-stale")];
  if (i.reviewFiles && Object.entries(i.reviewFiles).some(([p, h]) => link.files[p] !== h)) {
    return [reason("review-stale")];
  }
  const chain = [link];
  if (link.mode === "recheck") {
    const parent = i.reviews.slice(0, -1).find(l => l.reservation === link.basedOn);
    if (!parent || parent.mode !== "full" || parent.basisHash !== i.basisHash) return [reason("review-stale", "the recheck has no matching full review")];
    chain.unshift(parent);
  }
  const fullTypes = i.obligations.some(ob => {
    const rc = fresh(i.receipts, ob.id, i.checkInputId);
    return ob.kind === "static" && ["tsc", "typescript", "types"].includes(ob.tool ?? "") && rc?.status === "pass" && rc.scope === "full" && rc.candidate === i.candidate;
  });
  const out: Reason[] = [];
  for (const [index, review] of chain.entries()) {
    if (review.independence !== "subagent-fresh") out.push(reason("reduced-independence", undefined, i.lane === "quick" ? { note: true } : {}));
    const coverage = review.coverage;
    const before = chain[index - 1]?.files;
    const required = Object.keys({ ...before, ...review.files }).filter(p => !before || before[p] !== review.files[p]);
    const missing = required.filter(p => !coverage?.inspected.some(x => x === p || x.startsWith(`${p}:`)));
    const sampled = coverage?.sampled.filter(s => s.opened < s.callers && (s.semantic || !fullTypes)) ?? [];
    if (review.status !== "completed" || !coverage || !coverage.crossCutting.trim() || review.uncovered.length || missing.length || sampled.length || review.openDependencies?.length) {
      const gaps = [...review.uncovered, ...missing, ...sampled.map(s => `${s.symbol}: unopened callers`), ...(review.openDependencies ?? [])];
      out.push(reason("review-partial-coverage", gaps.slice(0, 3).join(", ") || "review coverage is incomplete"));
    }
  }
  return out;
}

const FINDING_DONE = new Set(["verified", "withdrawn"]);
const FINDING_DISPOSED = new Set(["verified", "withdrawn", "risk-accepted", "deferred", "wont-fix"]);

function judgeFindings(i: VerdictInput): Reason[] {
  const out: Reason[] = [];
  for (const f of i.findings) {
    if (f.severity === "blocker" && !FINDING_DONE.has(f.state)) out.push(reason("blocker-open", f.claim, { refs: [f.id] }));
    else if (f.severity === "major" && !FINDING_DISPOSED.has(f.state)) out.push(reason("major-undisposed", f.claim, { refs: [f.id] }));
  }
  return out;
}

/** Markers need a fresh-context review or the user; other attention needs any recorded disposition. */
function judgeAttention(i: VerdictInput): Reason[] {
  const out: Reason[] = [];
  for (const a of i.attention) {
    const d = a.disposition;
    if (a.marker) {
      if (!d || d.outcome !== "accepted" || d.by === "same-session") out.push(reason("marker-unaccepted", `${a.path}:${a.line} ${a.pattern}`, { refs: [a.id] }));
    } else if (!d) out.push(reason("major-undisposed", `attention ${a.path}:${a.line} ${a.pattern}`, { refs: [a.id] }));
  }
  return out;
}

/** Deep needs native architect and security passes; the latest of each must be complete and on the current candidate (TS §5.3). */
function judgeDeepPasses(i: VerdictInput): Reason[] {
  return ([["architect", "architecture"], ["security", "security"]] as const).flatMap(([role, name]) => {
    const pass = i.analyses.filter((a) => a.role === role).at(-1);
    const why = (code: Parameters<typeof reason>[0], what: string) => [reason(code, `the Deep ${name} pass ${what}`)];
    if (!pass) return why("review-missing", "has not run");
    if (pass.revision !== i.candidate) return why("review-stale", "observed an earlier candidate");
    if (pass.status !== "completed" || pass.openDependencies.length) return why("review-partial-coverage", "is not complete");
    return pass.independence === "subagent-fresh" ? [] : why("reduced-independence", "was not a native subagent");
  });
}

export function verdict(i: VerdictInput): Verdict {
  const r: Reason[] = [];
  if (i.lane === "deep") r.push(...judgeDeepPasses(i));
  if (i.authorityAvailable === false) r.push(reason("authority-needed", "this contract's routine authority is suspended or expired"));
  for (const check of i.unsupportedChecks ?? []) r.push(reason("evidence-missing", `${check}: its execution consumer is unavailable`));
  for (const ob of i.obligations) r.push(...judgeObligation(ob, i));
  for (const el of i.elements) r.push(...judgeElement(el, i));
  for (const p of i.changedLocks) r.push(reason("locked-test-changed", p));
  if (i.unauthorized.length) r.push(reason("authority-needed", `protected path${i.unauthorized.length === 1 ? "" : "s"} ${i.unauthorized.slice(0, 3).join(", ")}`, { refs: [...i.unauthorized] }));
  if (i.behavioralChange) r.push(...judgeRed(i));
  if (i.reviewRequired) r.push(...judgeReview(i));
  r.push(...judgeFindings(i), ...judgeAttention(i));
  for (const d of i.declined) r.push(reason("declined-step", d));
  if (i.integratedStale) r.push(reason("integration-unvalidated"));

  const blocking = r.filter((x) => !x.note);
  const reviewOnly = i.profile === "review" || i.profile === "plan" || i.profile === "investigate";
  let rank = reviewOnly ? 1 : blocking.length === 0 ? 3 : i.implementationExists ? 2 : 0;
  rank = Math.min(rank, RANK[ceiling(i.level)]!);
  const endpoint: Endpoint = i.prototypeRequested && rank > 0 ? "prototype" : ENDPOINT_BY_RANK[rank]!;
  const scope: Scope | undefined = endpoint !== "checked-local" ? undefined
    : i.commitExists && i.committedTreeChecked ? "committed"
    : i.checkedIncludesHumanEdits ? "working-tree-with-your-edits" : "working-tree-uncommitted";
  const out: Verdict = { endpoint, reasons: r };
  if (scope) out.scope = scope;
  if (i.stopReason) out.stopReason = i.stopReason;
  return out;
}

/** `finish` refuses to close while an introduced failure remains, attempts remain and no stop reason is set. */
export const continueRequired = (v: Verdict, i: Pick<VerdictInput, "attemptsLeft" | "stopReason">): boolean =>
  !i.stopReason && i.attemptsLeft > 0 && v.reasons.some((x) => x.code === "evidence-failed" || x.code === "no-distinguishing-red");

/** The headline names what was true, in the user's terms (UX §4.2): scope belongs in the headline, never the caveat. */
export function headline(v: Verdict, o: { profile: Profile | "review"; branch?: string | null; humanFiles?: number }): string {
  if (o.profile === "plan") return "Plan ready, no source changes";
  if (o.profile === "review" || o.profile === "investigate") return "Findings only, nothing changed";
  switch (v.endpoint) {
    case "checked-local": {
      if (v.scope === "committed") return `Checked locally (\`checked-local\`), committed${o.branch ? ` on ${o.branch}` : ""}`;
      const alongside = v.scope === "working-tree-with-your-edits" && o.humanFiles ? `, alongside your ${o.humanFiles} uncommitted file${o.humanFiles === 1 ? "" : "s"}` : "";
      return `Checked locally (working tree)${alongside}`;
    }
    case "implemented-unverified": return v.reasons.some((x) => x.code === "evidence-failed") ? "Built, a check fails" : "Built, not fully checked";
    case "prototype": return "Prototype, not checked as a product";
    case "findings-only": return "Findings only";
    default: return "Can't continue";
  }
}
