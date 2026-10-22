// One builder for review manifests (TS §8.7). Native reviews reserve delegation capacity; a Quick pass has a
// same-session binding instead. `packet reviewer` rebuilds either kind after a retry or expired artifact.
import { addTokens, canReserve, LIMITS, recordDelegation, releaseStale, reserve } from "../core/budget.ts";
import { reason } from "../core/reasons.ts";
import type { FileChange, Manifest } from "../core/review.ts";
import { projectCharter } from "../core/charter.ts";
import {
  buildAnalystManifest, buildManifest, DEFAULT_CHARTER, DEFAULT_REVIEW_RUBRIC,
  RESEARCHER_RUBRIC, deltaSince, isManifest, reviewMode,
} from "../core/review.ts";
import type { BasisElement, BudgetState, Reason, Reservation, State, WorkContract } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { nx } from "./common.ts";
import type { Facts } from "./facts.ts";
import { settingsFor } from "./reconcile.ts";

/** The reviewer's rubric is the body of the tenet-review skill: one source, carried in the manifest. */
function rubric(ports: Ports, focused: boolean): string {
  const text = ports.recipes.text(focused ? "skills/tenet/resources/focused-review.md" : "skills/tenet-review/SKILL.md");
  return text ? text.replace(/^---\n[\s\S]*?\n---\n/, "").trim() : DEFAULT_REVIEW_RUBRIC;
}

type AnalystRole = "researcher" | "architect" | "security";
const ROLE_RESOURCE: Record<AnalystRole, string | undefined> = {
  researcher: undefined, architect: "skills/tenet-review/resources/architect.md", security: "skills/tenet-review/resources/security.md",
};

/** An analyst's rubric: the researcher default, or a role-specific resource file, one source each (TS §5.1). */
function analystRubric(ports: Ports, role: AnalystRole): string {
  const path = ROLE_RESOURCE[role];
  if (!path) return RESEARCHER_RUBRIC;
  const text = ports.recipes.text(path);
  return text ? text.replace(/^---\n[\s\S]*?\n---\n/, "").trim() : RESEARCHER_RUBRIC;
}

export interface Issued { work: WorkContract; next: Array<ReturnType<typeof nx>>; reasons: Reason[]; data?: Record<string, unknown> }

/** Early refusals before a manifest is built: retry limits and delegation capacity (TS §8.6). */
function admissionGate(nw: WorkContract, live: Reservation | undefined, focused: boolean, retry: boolean, budget: BudgetState): Issued | null {
  if (live && retry && (live.retries ?? 0) >= LIMITS[nw.lane].retries) {
    return { work: nw, next: [nx("stop", "The reviewer failed after two retries; stop and diagnose before another dispatch.", true)], reasons: [reason("budget-exhausted", "review retries")] };
  }
  if (!focused && !live && !canReserve(budget, nw.lane)) {
    return { work: nw, next: [nx("stop", "No delegation capacity is left for a review.", true)], reasons: [] };
  }
  if (!focused && live && retry && !canReserve({ ...budget, reservations: budget.reservations.filter((x) => x.id !== live.id) }, nw.lane)) {
    return { work: nw, next: [nx("stop", "No delegation capacity is left for a retry.", true)], reasons: [] };
  }
  return null;
}

/** The manifest's attempt number: a live reservation's own count, or the next one for its kind of dispatch. */
function nextAttempt(live: Reservation | undefined, retry: boolean, focused: boolean, budget: BudgetState): number {
  if (live) return live.attempt + (retry ? 1 : 0);
  return focused ? budget.reviewRounds + budget.rechecks + 1 : budget.delegations + budget.reservations.length + 1;
}

/** The next action naming the dispatch this issued manifest expects (TS §6.6). */
function dispatchNext(focused: boolean, mode: "full" | "recheck"): Array<ReturnType<typeof nx>> {
  if (focused) return [nx("focused-review", "Reread this manifest and diff in this session, then record findings as same-session.", true)];
  return [nx(mode === "recheck" ? "recheck" : "review", "Dispatch a fresh-context reviewer on the manifest.", true)];
}

/** Reserve capacity for the issued manifest (or bind the Quick same-session slot) and shape the final response. */
function reserveIssued(
  nw: WorkContract, budget: BudgetState, m: Manifest, path: string, live: Reservation | undefined, retry: boolean, focused: boolean, files: Record<string, string>,
): Issued {
  const rv = { ...m.reservation, manifest: path, retries: live ? (live.retries ?? 0) + (retry ? 1 : 0) : 0 };
  // A retry replaces the live reservation with a new attempt and counts as a delegation, so a late result from the
  // earlier child matches nothing and cannot settle the later one.
  let nb = !focused && live && retry ? recordDelegation({ ...budget, reservations: budget.reservations.filter((x) => x.id !== live.id) }) : budget;
  nb = addTokens(focused ? nb : reserve(nb, rv), m.tokens);
  return {
    work: { ...nw, budget: nb, ...(focused ? { focusedReview: rv } : {}) }, reasons: [], next: dispatchNext(focused, m.mode),
    data: { review: { manifest: path, hash: m.hash, reservation: rv.id, attempt: rv.attempt, mode: m.mode, tokens: m.tokens, files: rv.requiredPaths ?? Object.keys(files), dispatchMode: focused ? "same-session" : "subagent-fresh" } },
  };
}

/** The native passes a Deep contract still owes on this candidate, as required next actions (TS §5.3). */
export function deepPasses(w: WorkContract, candidate: string): Array<ReturnType<typeof nx>> {
  if (w.lane !== "deep") return [];
  const done = (role: string) =>
    w.analyses.some((a) => a.role === role && a.status === "completed" && a.revision === candidate && a.independence === "subagent-fresh");
  return (["architect", "security"] as const).filter((role) => !done(role)).map((role) =>
    nx("analyst", `Deep needs a native ${role} pass: packet analyst --analyst-role ${role} --question <text>, then dispatch.`, true));
}

/** The project's charter from the first instruction file the host binding names that has one, else the default (QLT-09). */
function charterOf(ports: Ports): string {
  const text = (path: string) => { try { return ports.project.read(path); } catch { return null; } };
  const names = ports.host.capabilities().instructionFiles;
  return projectCharter(names.source === "unknown" ? [] : names.value.split(",").map(text)) ?? DEFAULT_CHARTER;
}

export function issueReview(ports: Ports, st: State, w: WorkContract, facts: Facts, changes: readonly FileChange[], retry = false): Issued {
  const basis = w.basis!;
  const focused = w.lane === "quick";
  let budget = releaseStale(w.budget, facts.candidate, basis.hash);
  let nw: WorkContract = { ...w, budget, ...(w.focusedReview && (w.focusedReview.candidate !== facts.candidate || w.focusedReview.basisHash !== basis.hash) ? { focusedReview: undefined } : {}) };
  const files = Object.fromEntries(facts.reviewPaths.map((p) => [p, facts.inv.entries.get(p)?.blob ?? ""]));
  const done = nw.reviews.find(
    (l) => l.candidate === facts.candidate && l.basisHash === basis.hash && l.status === "completed" && Object.entries(files).every(([p, h]) => l.files[p] === h),
  );
  if (done && !retry) return { work: nw, next: [nx("finish", "Checks pass and the review reached this candidate.")], reasons: [] };

  const live = focused ? nw.focusedReview : budget.reservations.find((x) => x.candidate === facts.candidate && x.basisHash === basis.hash);
  const gated = admissionGate(nw, live, focused, retry, budget);
  if (gated) return gated;

  const lastFull = [...nw.reviews].reverse().find((l) => l.mode === "full" && l.status === "completed");
  const { mode, basedOn } = reviewMode(nw, basis.hash, deltaSince(lastFull, files));
  if (!live && mode === "full" && budget.reviewRounds >= LIMITS[nw.lane].rounds) {
    return { work: nw, next: [nx("finish", "No full review round remains; finish with the current evidence.", true)], reasons: [reason("budget-exhausted", "review rounds")] };
  }
  const shown = mode === "recheck" ? changes.filter((c) => deltaSince(lastFull, files).includes(c.path)) : changes;
  const m = buildManifest({
    work: nw, elements: st.project.intent.elements.filter((e) => basis.elementIds.includes(e.id)), changes: shown, candidate: facts.candidate, basisHash: basis.hash,
    attempt: nextAttempt(live, retry, focused, budget), mode, ...(basedOn ? { basedOn } : {}),
    recheckFindings: nw.findings.filter((f) => f.state === "valid" || f.state === "fixed"), rubric: rubric(ports, focused), id: nw.label, files, charter: charterOf(ports),
    exclusions: settingsFor(ports, st, w).exclusions as Exclusion[],
  });
  if (!isManifest(m)) return { work: nw, next: [nx("ask", "The basis is too large to review in one pass; narrow the increment.", true)], reasons: [m] };
  const path = ports.store.writeArtifact(ports.store.tempDir("manifests"), `${m.hash}.json`, m.text);
  return reserveIssued(nw, budget, m, path, live, retry, focused, files);
}

/** `packet analyst`: a researcher, architect or security assignment (AGT-03). No basis precondition, no "already
 * answered" cache — each question is a fresh dispatch, bounded only by the lane's delegation capacity, so several
 * analysts can be live on one declared revision at once (AGT-03's "in parallel"). */
export function issueAnalyst(
  ports: Ports, st: State, w: WorkContract, elements: readonly BasisElement[], candidate: string,
  role: AnalystRole, question: string,
): Issued {
  let budget = releaseStale(w.budget, candidate, w.basis?.hash ?? "none");
  if (!canReserve(budget, w.lane)) {
    return { work: { ...w, budget }, next: [nx("stop", "No delegation capacity is left for an analyst dispatch.", true)], reasons: [] };
  }
  const attempt = budget.delegations + budget.reservations.length + 1;
  const m = buildAnalystManifest({
    work: w, elements, candidate, attempt, role, question, rubric: analystRubric(ports, role),
    exclusions: settingsFor(ports, st, w).exclusions as Exclusion[],
  });
  if (!isManifest(m)) {
    return { work: { ...w, budget }, next: [nx("ask", "The question is too large to answer in one pass; narrow it.", true)], reasons: [m] };
  }
  const path = ports.store.writeArtifact(ports.store.tempDir("manifests"), `${m.hash}.json`, m.text);
  const rv = { ...m.reservation, manifest: path };
  budget = addTokens(reserve(budget, rv), m.tokens);
  return {
    work: { ...w, budget }, reasons: [],
    next: [nx("analyst", "Dispatch a fresh-context analyst on the packet.", true)],
    data: {
      analyst: {
        manifest: path, hash: m.hash, reservation: rv.id, attempt: rv.attempt, role, question, tokens: m.tokens,
        dispatchMode: w.lane === "quick" ? "same-session" : "subagent-fresh",
      },
    },
  };
}
