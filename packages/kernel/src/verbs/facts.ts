// Facts observed from the working tree for one contract: inventory, attribution, candidate and check-input identity.
// Shared by check, commit, finish and inspect so they all see the same thing.
import { attribute } from "../core/attribution.ts";
import { routineAuthorized, uncoveredProtected } from "../core/authority.ts";
import { attemptsLeft } from "../core/budget.ts";
import type { Attribution } from "../core/attribution.ts";
import { hashOf } from "../core/ids.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { VerdictInput } from "../core/verdict.ts";
import type { Inventory, Ports } from "../ports/types.ts";
import { settingsFor, unsupportedExecution } from "./reconcile.ts";
import { isEditingProfile } from "../core/risk.ts";
import { declaredInputs } from "../core/obligations.ts";
import { declaredOutputs } from "../core/outputs.ts";

export interface Facts {
  inv: Inventory;
  att: Attribution;
  candidate: string;
  /** Files Tenet owns: declared or kernel-written; minus the user's keep-out files. */
  tenetPaths: string[];
  /** Everything Tenet changed in this contract, committed or not: what a review and the attention scan must see. */
  reviewPaths: string[];
  /** Anchor commits of the project's acceptance-test locks that are ancestors of HEAD, so a branch that never had a test is unaffected. */
  lockAnchors: Set<string>;
}

const NO_GIT: Inventory = { head: null, branch: null, entries: new Map(), status: [], digest: "no-git" };

/** A digest of the working tree for call identity; a folder without Git has none to speak of. */
export async function worldDigest(ports: Ports, _input?: unknown, state?: State | null): Promise<string> {
  const inputs = Object.values(state?.work ?? {}).flatMap(w => declaredInputs(w.obligations));
  const tree = (await ports.git.probe()).isRepo ? (await ports.git.inventory([], inputs)).digest : NO_GIT.digest;
  const { commands, required_checks, exclusions, protected_paths, dependency_policy } = settingsFor(ports, state ?? null);
  return hashOf({ tree, toolchain: ports.stack.fingerprint(ports.root), commands, required_checks, exclusions, protected_paths, dependency_policy, traits: state?.project.traits ?? [] });
}

export async function gather(ports: Ports, w: WorkContract, locks: State["locks"] = []): Promise<Facts> {
  if (w.git.mode === "none") return { inv: NO_GIT, att: attribute(w, NO_GIT, () => false), candidate: NO_GIT.digest, tenetPaths: [], reviewPaths: [], lockAnchors: new Set() };
  const tests = new Set(w.obligations.map((o) => o.testFile).filter((p): p is string => !!p));
  const explained = (p: string) => tests.has(p) || p in w.vetted;
  const inv = await ports.git.inventory([], declaredInputs(w.obligations), declaredOutputs(w.obligations));
  const att = attribute(w, inv, explained);
  const keep = new Set(w.keepOut);
  const tenetPaths = [...new Set([...att.tenet, ...att.mixed.filter((p) => w.includeDirty.includes(p)), ...w.includeDirty])]
    .filter((p) => !keep.has(p) && inv.status.some((s) => s.path === p));
  const anchors = locks.flatMap((l) => ("commit" in l.anchor ? [l.anchor.commit] : []));
  const reviewPaths = [...new Set([...tenetPaths, ...w.git.committed])];
  return { inv, att, candidate: inv.digest, tenetPaths, reviewPaths, lockAnchors: anchors.length ? await ports.git.ancestors(anchors) : new Set() };
}

/** Edits in protected paths that Tenet made (or declared) and no grant covers. Declaring is cooperative; an unexplained change is not Tenet's to ask about (TS §9.7). */
export function unauthorizedEdits(ports: Ports, w: WorkContract, f: Facts): string[] {
  const changed = new Set(f.inv.status.map((s) => s.path));
  const mine = [...f.reviewPaths, ...w.touched.map((t) => t.path).filter((p) => changed.has(p) || w.git.committed.includes(p))];
  const vetted = ports.project.hashes(Object.keys(w.vetted)); // what a scaffold wrote is authorized by its kickoff, until someone changes it
  return uncoveredProtected(w.scope.protected, [...new Set(mine)].filter((p) => !(p in w.vetted && vetted[p] === w.vetted[p])).sort(), w.grants, ports.clock.now());
}

/** sha256(source candidate, obligation definitions, toolchain fingerprint, semantic envelope) (TS §8.8). */
export function checkInputId(ports: Ports, w: WorkContract, candidate: string): string {
  const defs = w.obligations.map((o) => ({ id: o.id, kind: o.kind, category: o.category, tool: o.tool, testFile: o.testFile, support: o.support, test: o.test, expectation: o.expectation, example: o.example }));
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
  for (const o of w.obligations) for (const p of Object.keys(o.baselineInputs ?? {})) testHashes[p] = inv.entries.get(p)?.blob ?? "";
  const humanPresent = att.human.length + att.concurrent.length + att.unexplained.length + att.mixed.filter((p) => w.keepOut.includes(p)).length > 0;
  const vetted = ports.project.hashes(Object.keys(w.vetted));
  const recipeOnly = facts.reviewPaths.length > 0 && facts.reviewPaths.every(p => w.vetted[p] !== undefined && vetted[p] === w.vetted[p]);
  const i: VerdictInput = {
    profile: w.profile, level: w.level, lane: w.lane,
    authorityAvailable: !isEditingProfile(w.profile) || routineAuthorized(w.grants, ports.clock.now()),
    implementationExists: commitExists || facts.tenetPaths.some((p) => ports.stack.classify(p) !== "test"),
    prototypeRequested: w.profile === "prototype",
    behavioralChange: !["refactor", "plan", "investigate"].includes(w.profile) && !recipeOnly && !w.reverting,
    reviewRequired: isEditingProfile(w.profile),
    candidate: facts.candidate, checkInputId: checkInputId(ports, w, facts.candidate), basisHash: w.basis?.hash ?? "",
    elements: st.project.intent.elements.filter((e) => w.basis?.elementIds.includes(e.id)),
    confirmedAssumptions: w.basis?.confirmedAssumptions ?? [],
    unsupportedChecks: unsupportedExecution(ports, st, w),
    obligations: w.obligations, receipts: w.receipts, baselineFailures: [], excludedScope: [], testHashes,
    unauthorized: unauthorizedEdits(ports, w, facts),
    changedLocks: st.locks.filter((l) => lockApplies(l, w, facts)).flatMap((l) => [
      ...(inv.entries.get(l.path)?.blob !== l.hash ? [l.path] : []),
      ...Object.entries(l.supportInputs).filter(([p, h]) => (inv.entries.get(p)?.blob ?? "") !== h).map(([p]) => p),
    ]),
    reviews: w.reviews, analyses: w.analyses,
    reviewFiles: Object.fromEntries(facts.reviewPaths.map((p) => [p, inv.entries.get(p)?.blob ?? ""])),
    findings: w.findings,
    attention: w.attention,
    declined: w.declined,
    attemptsLeft: attemptsLeft(w.budget, w.lane),
    commitExists,
    committedTreeChecked: commitExists && inv.status.length === 0 && w.lastCheck?.candidate === facts.candidate,
    checkedIncludesHumanEdits: humanPresent,
    integratedStale: !!w.git.integrated && w.git.integrated.moved && !w.git.integrated.validated,
  };
  if (w.stopReason) i.stopReason = w.stopReason;
  return i;
}
