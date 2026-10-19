// The one place a review manifest is built and its delegation reserved (TS §8.7). `check` calls it when review is
// next; `packet reviewer` calls it for a retry or an expired run directory.
import { addTokens, canReserve, recordDelegation, releaseStale, reserve } from "../core/budget.ts";
import type { FileChange } from "../core/review.ts";
import { buildManifest, deltaSince, isManifest, reviewMode } from "../core/review.ts";
import type { Reason, State, WorkContract } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";
import { nx } from "./common.ts";
import type { Facts } from "./facts.ts";

const RUBRIC = "Stage A: does the change satisfy each basis element and follow the design sketch? Stage B: structure, security, charter. Give every attention item a disposition. Return one ReviewResult.";

export interface Issued { work: WorkContract; next: Array<ReturnType<typeof nx>>; reasons: Reason[]; data?: Record<string, unknown> }

export function issueReview(ports: Ports, st: State, w: WorkContract, facts: Facts, changes: readonly FileChange[], retry = false): Issued {
  const basis = w.basis!;
  let budget = releaseStale(w.budget, facts.candidate, basis.hash);
  let nw: WorkContract = { ...w, budget };
  const done = nw.reviews.find((l) => l.candidate === facts.candidate && l.basisHash === basis.hash && l.status === "completed");
  if (done && !retry) return { work: nw, next: [nx("finish", "Checks pass and the review reached this candidate.")], reasons: [] };

  const live = budget.reservations.find((x) => x.candidate === facts.candidate && x.basisHash === basis.hash);
  if (!live && !canReserve(budget, nw.lane)) return { work: nw, next: [nx("stop", "No delegation capacity is left for a review.", true)], reasons: [] };
  if (live && retry && !canReserve({ ...budget, reservations: budget.reservations.filter((x) => x.id !== live.id) }, nw.lane)) {
    return { work: nw, next: [nx("stop", "No delegation capacity is left for a retry.", true)], reasons: [] };
  }

  const files = Object.fromEntries(facts.reviewPaths.map((p) => [p, facts.inv.entries.get(p)?.blob ?? ""]));
  const lastFull = [...nw.reviews].reverse().find((l) => l.mode === "full" && l.status === "completed");
  const { mode, basedOn } = reviewMode(nw, basis.hash, deltaSince(lastFull, files));
  const shown = mode === "recheck" ? changes.filter((c) => deltaSince(lastFull, files).includes(c.path)) : changes;
  const attempt = live ? live.attempt + (retry ? 1 : 0) : budget.delegations + budget.reservations.length + 1;
  const m = buildManifest({
    work: nw, elements: st.project.intent.elements.filter((e) => basis.elementIds.includes(e.id)), changes: shown, candidate: facts.candidate, basisHash: basis.hash,
    attempt, mode, ...(basedOn ? { basedOn } : {}), recheckFindings: nw.findings.filter((f) => f.state === "valid" || f.state === "fixed"), rubric: RUBRIC, id: nw.label, files,
  });
  if (!isManifest(m)) return { work: nw, next: [nx("ask", "The basis is too large to review in one pass; narrow the increment.", true)], reasons: [m] };

  const path = ports.store.writeArtifact(ports.store.tempDir("manifests"), `${m.hash}.json`, m.text);
  const rv = { ...m.reservation, manifest: path };
  // A retry replaces the live reservation with a new attempt and counts as a delegation, so a late result from the
  // earlier child matches nothing and cannot settle the later one.
  if (live && retry) budget = recordDelegation({ ...budget, reservations: budget.reservations.filter((x) => x.id !== live.id) });
  budget = addTokens(reserve(budget, rv), m.tokens);
  nw = { ...nw, budget };
  return {
    work: nw, reasons: [],
    next: [nx(mode === "recheck" ? "recheck" : "review", "Dispatch a fresh-context reviewer on the manifest.", true)],
    data: { review: { manifest: path, hash: m.hash, reservation: rv.id, attempt: rv.attempt, mode, tokens: m.tokens } },
  };
}
