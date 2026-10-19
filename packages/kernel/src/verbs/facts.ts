// Facts observed from the working tree for one contract: inventory, attribution, candidate and check-input identity.
// Shared by check, commit, finish and inspect so they all see the same thing.
import { attribute } from "../core/attribution.ts";
import { attemptsLeft } from "../core/budget.ts";
import type { Attribution } from "../core/attribution.ts";
import { matches } from "../core/exclusions.ts";
import { hashOf } from "../core/ids.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { VerdictInput } from "../core/verdict.ts";
import type { Inventory, Ports } from "../ports/types.ts";

export interface Facts {
  inv: Inventory;
  att: Attribution;
  candidate: string;
  /** Files Tenet owns: declared, inside the predicted scope, or acceptance tests; minus the user's keep-out files. */
  tenetPaths: string[];
  /** Everything Tenet changed in this contract, committed or not: what a review and the attention scan must see. */
  reviewPaths: string[];
  /** Anchor commits of the project's acceptance-test locks that are ancestors of HEAD, so a branch that never had a test is unaffected. */
  lockAnchors: Set<string>;
}

const NO_GIT: Inventory = { head: null, branch: null, entries: new Map(), status: [], digest: "no-git" };

/** A digest of the working tree for call identity; a folder without Git has none to speak of. */
export async function worldDigest(ports: Ports): Promise<string> {
  try { return (await ports.git.inventory([])).digest; } catch { return NO_GIT.digest; }
}

export async function gather(ports: Ports, w: WorkContract, locks: State["locks"] = []): Promise<Facts> {
  if (w.git.mode === "none") return { inv: NO_GIT, att: attribute(w, NO_GIT, () => false), candidate: NO_GIT.digest, tenetPaths: [], reviewPaths: [], lockAnchors: new Set() };
  const tests = new Set(w.obligations.map((o) => o.testFile).filter((p): p is string => !!p));
  const explained = (p: string) => tests.has(p) || w.scope.paths.some((s) => matches(s, p));
  const inv = await ports.git.inventory([]);
  const att = attribute(w, inv, explained);
  const keep = new Set(w.keepOut);
  const tenetPaths = [...new Set([...att.tenet, ...att.mixed.filter((p) => w.includeDirty.includes(p)), ...w.includeDirty])]
    .filter((p) => !keep.has(p) && inv.status.some((s) => s.path === p));
  const anchors = locks.flatMap((l) => ("commit" in l.anchor ? [l.anchor.commit] : []));
  const reviewPaths = [...new Set([...tenetPaths, ...w.git.committed])];
  return { inv, att, candidate: inv.digest, tenetPaths, reviewPaths, lockAnchors: anchors.length ? await ports.git.ancestors(anchors) : new Set() };
}

/** sha256(source candidate, obligation definitions, toolchain fingerprint, semantic envelope) (TS §8.8). */
export function checkInputId(ports: Ports, w: WorkContract, candidate: string): string {
  const defs = w.obligations.map((o) => ({ id: o.id, kind: o.kind, tool: o.tool, testFile: o.testFile, expectation: o.expectation }));
  return hashOf({ candidate, defs, toolchain: ports.stack.fingerprint(ports.root), envelope: { cwd: ".", env: { CI: "1" }, argv: "vitest run --reporter=json" } }).slice(0, 24);
}

// ---------------------------------------------------------------- verdict input

/**
 * A provisional lock binds its own contract; an anchored one binds every contract whose HEAD contains its commit. If the
 * anchor is not an ancestor (history was rewritten, or the branch never had the test) the lock still applies where the
 * path exists, because protection is never dropped silently (TS §9.7).
 */
const lockApplies = (l: State["locks"][number], w: WorkContract, f: Facts): boolean =>
  "provisional" in l.anchor ? l.anchor.provisional === w.id : f.lockAnchors.has(l.anchor.commit) || f.inv.entries.has(l.path);

/** Assembles the pure verdict's input from the contract and what the working tree shows now. */
export function verdictInput(ports: Ports, st: State, w: WorkContract, facts: Facts): VerdictInput {
  const { inv, att } = facts;
  const commitExists = w.git.commits.length > 0;
  const testHashes: Record<string, string> = {};
  for (const o of w.obligations) if (o.testFile) testHashes[o.testFile] = inv.entries.get(o.testFile)?.blob ?? "";
  const humanPresent = att.human.length + att.concurrent.length + att.unexplained.length + att.mixed.filter((p) => w.keepOut.includes(p)).length > 0;
  const i: VerdictInput = {
    profile: w.profile, level: w.level,
    implementationExists: commitExists || facts.tenetPaths.some((p) => ports.stack.classify(p) !== "test"),
    prototypeRequested: w.profile === "prototype",
    behavioralChange: !["refactor", "plan", "investigate"].includes(w.profile),
    reviewRequired: w.lane !== "quick",
    candidate: facts.candidate, checkInputId: checkInputId(ports, w, facts.candidate), basisHash: w.basis?.hash ?? "",
    elements: st.project.intent.elements.filter((e) => w.basis?.elementIds.includes(e.id)),
    obligations: w.obligations, receipts: w.receipts, baselineFailures: [], excludedScope: [], testHashes,
    changedLocks: st.locks.filter((l) => lockApplies(l, w, facts)).filter((l) => inv.entries.get(l.path)?.blob !== l.hash).map((l) => l.path),
    reviews: w.reviews, findings: w.findings, attention: w.attention, declined: w.declined, attemptsLeft: attemptsLeft(w.budget, w.lane),
    commitExists, committedTreeChecked: commitExists && inv.status.length === 0 && w.lastCheck?.candidate === facts.candidate,
    checkedIncludesHumanEdits: humanPresent, integratedStale: false,
  };
  if (w.stopReason) i.stopReason = w.stopReason;
  return i;
}
