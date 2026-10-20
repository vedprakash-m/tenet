// One builder for review manifests (TS §8.7). Native reviews reserve delegation capacity; a Quick pass has a
// same-session binding instead. `packet reviewer` rebuilds either kind after a retry or expired artifact.
import { addTokens, canReserve, LIMITS, recordDelegation, releaseStale, reserve } from "../core/budget.ts";
import { reason } from "../core/reasons.ts";
import type { FileChange } from "../core/review.ts";
import { buildManifest, deltaSince, isManifest, reviewMode } from "../core/review.ts";
import type { Reason, State, WorkContract } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";
import { nx } from "./common.ts";
import type { Facts } from "./facts.ts";

const FALLBACK_RUBRIC = "Stage A: does the change satisfy each basis element and follow the design sketch? Stage B: structure, security, charter. Give every attention item a disposition. Return one ReviewResult shaped like resultTemplate.";

/** The reviewer's rubric is the body of the tenet-review skill: one source, carried in the manifest. */
function rubric(ports: Ports, focused: boolean): string {
  const text = ports.recipes.text(focused ? "skills/tenet/resources/focused-review.md" : "skills/tenet-review/SKILL.md");
  return text ? text.replace(/^---\n[\s\S]*?\n---\n/, "").trim() : FALLBACK_RUBRIC;
}

export interface Issued { work: WorkContract; next: Array<ReturnType<typeof nx>>; reasons: Reason[]; data?: Record<string, unknown> }

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
  if (live && retry && (live.retries ?? 0) >= LIMITS[nw.lane].retries) return { work: nw, next: [nx("stop", "The reviewer failed after two retries; stop and diagnose before another dispatch.", true)], reasons: [reason("budget-exhausted", "review retries")] };
  if (!focused && !live && !canReserve(budget, nw.lane)) return { work: nw, next: [nx("stop", "No delegation capacity is left for a review.", true)], reasons: [] };
  if (!focused && live && retry && !canReserve({ ...budget, reservations: budget.reservations.filter((x) => x.id !== live.id) }, nw.lane)) {
    return { work: nw, next: [nx("stop", "No delegation capacity is left for a retry.", true)], reasons: [] };
  }

  const lastFull = [...nw.reviews].reverse().find((l) => l.mode === "full" && l.status === "completed");
  const { mode, basedOn } = reviewMode(nw, basis.hash, deltaSince(lastFull, files));
  if (!live && mode === "full" && budget.reviewRounds >= LIMITS[nw.lane].rounds) return { work: nw, next: [nx("finish", "No full review round remains; finish with the current evidence.", true)], reasons: [reason("budget-exhausted", "review rounds")] };
  const shown = mode === "recheck" ? changes.filter((c) => deltaSince(lastFull, files).includes(c.path)) : changes;
  const attempt = live ? live.attempt + (retry ? 1 : 0) : focused ? budget.reviewRounds + budget.rechecks + 1 : budget.delegations + budget.reservations.length + 1;
  const m = buildManifest({
    work: nw, elements: st.project.intent.elements.filter((e) => basis.elementIds.includes(e.id)), changes: shown, candidate: facts.candidate, basisHash: basis.hash,
    attempt, mode, ...(basedOn ? { basedOn } : {}), recheckFindings: nw.findings.filter((f) => f.state === "valid" || f.state === "fixed"), rubric: rubric(ports, focused), id: nw.label, files,
  });
  if (!isManifest(m)) return { work: nw, next: [nx("ask", "The basis is too large to review in one pass; narrow the increment.", true)], reasons: [m] };

  const path = ports.store.writeArtifact(ports.store.tempDir("manifests"), `${m.hash}.json`, m.text);
  const rv = { ...m.reservation, manifest: path, retries: live ? (live.retries ?? 0) + (retry ? 1 : 0) : 0 };
  // A retry replaces the live reservation with a new attempt and counts as a delegation, so a late result from the
  // earlier child matches nothing and cannot settle the later one.
  if (!focused && live && retry) budget = recordDelegation({ ...budget, reservations: budget.reservations.filter((x) => x.id !== live.id) });
  budget = addTokens(focused ? budget : reserve(budget, rv), m.tokens);
  nw = { ...nw, budget, ...(focused ? { focusedReview: rv } : {}) };
  return {
    work: nw, reasons: [],
    next: [nx(focused ? "focused-review" : mode === "recheck" ? "recheck" : "review", focused ? "Reread this manifest and diff in this session, then record findings as same-session." : "Dispatch a fresh-context reviewer on the manifest.", true)],
    data: { review: { manifest: path, hash: m.hash, reservation: rv.id, attempt: rv.attempt, mode, tokens: m.tokens, files: rv.requiredPaths ?? Object.keys(files), dispatchMode: focused ? "same-session" : "subagent-fresh" } },
  };
}
