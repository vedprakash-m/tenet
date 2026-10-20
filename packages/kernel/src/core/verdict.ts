// The verdict table (PRD 4.5.2, TS §8.3). The only module that produces an endpoint. Pure and monotone:
// more fresh passing evidence never weakens an endpoint, removing evidence never strengthens it.
import { ceiling } from "./risk.ts";
import { reason } from "./reasons.ts";
import type { AttentionItem, BasisElement, Endpoint, Finding, Level, Obligation, Profile, Reason, Receipt, ReviewLink, Scope, StopReason } from "./schemas.ts";

export interface VerdictInput {
  profile: Profile | "review";
  level: Level;
  implementationExists: boolean;
  prototypeRequested: boolean;
  behavioralChange: boolean;
  reviewRequired: boolean;
  candidate: string;
  checkInputId: string; // identity of the current check inputs; a receipt is fresh only when it matches (TS §8.8)
  basisHash: string;
  elements: readonly BasisElement[];
  obligations: readonly Obligation[];
  receipts: readonly Receipt[];
  baselineFailures: readonly string[];
  excludedScope: readonly string[];
  testHashes: Readonly<Record<string, string>>; // current hash of each acceptance test file
  changedLocks: readonly string[]; // locked paths changed without disposition
  unauthorized: readonly string[]; // edits in protected paths that no grant covers (WRK-03)
  reviews: readonly ReviewLink[];
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

const reviewOk = (i: VerdictInput): boolean => judgeReview(i).length === 0;

function judgeElement(el: BasisElement, i: VerdictInput): Reason[] {
  if (el.kind === "deferred" || el.kind === "decision" || el.kind === "constraint") return [];
  const v = el.verifiedBy;
  if (!Array.isArray(v)) return v.notApplicable ? [] : [reason("basis-element-unverified", el.id, { refs: [el.id] })];
  const ok = v.length > 0 && v.every((m) => (m.method === "obligation" ? passed(i, m.ref) : m.method === "review" ? reviewOk(i) : true));
  if (el.kind === "assumption" && !ok) return [reason("assumption-unresolved", el.id, { refs: [el.id] })];
  return ok ? [] : [reason("basis-element-unverified", el.id, { refs: [el.id] })];
}

/** A behavioral change needs a distinguishing red on the baseline; the red must still apply to the test that went green. */
function judgeRed(i: VerdictInput): Reason[] {
  const out: Reason[] = [];
  for (const ob of i.obligations.filter((o) => o.category === "acceptance" && o.test !== "preservation")) {
    const wantsRed = (ob.expectation ?? "fail") === "fail";
    if (wantsRed && !ob.baselineMatched) out.push(reason("no-distinguishing-red", ob.id, { refs: [ob.id] }));
    else if (ob.testFile && ob.baselineTestHash && i.testHashes[ob.testFile] && i.testHashes[ob.testFile] !== ob.baselineTestHash) {
      out.push(reason("red-invalidated", ob.testFile, { refs: [ob.id] }));
    }
  }
  return out;
}

export function judgeReview(i: VerdictInput): Reason[] {
  const link = i.reviews.at(-1);
  if (!link) return [reason("review-missing")];
  if (link.status !== "completed") return [reason("review-partial-coverage", `review ${link.status}`)];
  if (link.candidate !== i.candidate || link.basisHash !== i.basisHash) return [reason("review-stale")];
  const out: Reason[] = [];
  if (link.independence !== "subagent-fresh") out.push(reason("reduced-independence"));
  if (link.uncovered.length) out.push(reason("review-partial-coverage", link.uncovered.slice(0, 3).join(", ")));
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

export function verdict(i: VerdictInput): Verdict {
  const r: Reason[] = [];
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
