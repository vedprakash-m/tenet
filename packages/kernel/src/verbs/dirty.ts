// Human-dirty files Tenet must edit: each displayed file is bound to its own authority (PRD 5.12, UX J-03b).
import { matches } from "../core/exclusions.ts";
import type { DirtyFileDecision, DirtyFileFacts, Question, WorkContract } from "../core/schemas.ts";
import type { Inventory } from "../ports/types.ts";
import { factsHash, question } from "./common.ts";

export type DirtyChoice = "wait" | "include" | "leave-out" | "dont-commit" | "keep-out";

export const dirtyScopeHash = (w: WorkContract): string =>
  factsHash({ paths: w.scope.paths, protected: w.scope.protected });

function startRef(w: WorkContract, path: string): string {
  return factsHash(w.git.start.dirty.find((entry) => entry.path === path) ?? { path });
}

export function dirtyFacts(w: WorkContract, inv: Inventory, path: string): DirtyFileFacts {
  const status = inv.status.find((entry) => entry.path === path);
  const entry = inv.entries.get(path);
  return {
    path,
    status: status?.xy ?? "clean",
    exists: !!entry,
    workMode: entry?.mode ?? status?.mode ?? null,
    workBlob: entry?.blob ?? (status ? status.blob || null : null),
    indexMode: status?.indexMode ?? (status?.untracked ? null : null),
    indexBlob: status?.indexBlob || null,
    startRef: startRef(w, path),
  };
}

function sameFacts(a: DirtyFileFacts, b: DirtyFileFacts): boolean {
  return factsHash(a) === factsHash(b);
}

export function currentDirtyDecision(
  w: WorkContract, inv: Inventory, path: string,
): DirtyFileDecision | undefined {
  const decision = [...(w.dirtyFileDecisions ?? [])].reverse().find((item) => item.path === path);
  if (
    !decision ||
    decision.workId !== w.id ||
    decision.sessionGeneration !== w.session.generation ||
    decision.scopeHash !== dirtyScopeHash(w) ||
    !sameFacts(decision.relevantFacts, dirtyFacts(w, inv, path))
  ) return;
  return decision;
}

/** Files dirty at the start that this work edits or plans to edit, and do not have current per-file authority. */
export function undecidedDirty(w: WorkContract, inv?: Inventory): string[] {
  const touched = new Set(w.touched.map((t) => t.path));
  return w.git.start.dirty.map((d) => d.path).filter((path) => {
    if (!touched.has(path) && !w.scope.paths.some((scope) => matches(scope, path))) return false;
    // Legacy leave-out facts narrow authority and may remain protective. Legacy include facts never grant commit authority.
    if (w.keepOut.includes(path) || w.leaveOut?.includes(path)) return false;
    const latest = [...(w.dirtyFileDecisions ?? [])].reverse().find((item) => item.path === path);
    if (!latest || latest.choice === "waiting") return true;
    return !!inv && !currentDirtyDecision(w, inv, path);
  });
}

/** A waiting file the person committed or set aside becomes ordinary clean-at-start-now content for the next edit. */
export function settleCleaned(w: WorkContract, dirtyNow: ReadonlySet<string>): WorkContract {
  const settled = (w.dirtyFileDecisions ?? [])
    .filter((decision) => decision.choice === "waiting" && !dirtyNow.has(decision.path))
    .map((decision) => decision.path);
  const legacy = undecidedDirty(w).filter((path) => !dirtyNow.has(path));
  const cleaned = new Set([...settled, ...legacy]);
  if (!cleaned.size) return w;
  return {
    ...w,
    dirtyFileDecisions: (w.dirtyFileDecisions ?? []).filter((decision) => !cleaned.has(decision.path)),
    git: {
      ...w.git,
      start: {
        ...w.git.start,
        dirty: w.git.start.dirty.filter((entry) => !cleaned.has(entry.path)),
      },
    },
  };
}

/** A left-out file is a stale authority event only when Tenet declares that it touched the exact file. */
export function leftOutChanged(
  w: WorkContract, _blobNow?: (path: string) => string | undefined,
): string[] {
  const touched = new Set(w.touched.map((t) => t.path));
  return (w.leaveOut ?? []).filter((path) => touched.has(path));
}

interface DirtyBinding {
  workId: string;
  sessionGeneration: number;
  scopeHash: string;
  instanceId: string;
  items: NonNullable<Question["bind"]["items"]>;
}

function productionBinding(
  w: WorkContract, inv: Inventory, instanceId: string, paths: readonly string[],
): DirtyBinding {
  const sorted = [...new Set(paths)].sort();
  return {
    workId: w.id,
    sessionGeneration: w.session.generation,
    scopeHash: dirtyScopeHash(w),
    instanceId,
    items: sorted.map((path, index) => ({
      token: String(index + 1),
      path,
      relevantFacts: dirtyFacts(w, inv, path),
    })),
  };
}

const displayPath = (path: string) => JSON.stringify(path);

/** A fully bound production question, with a path-only overload retained for small pure unit controls. */
export function dirtyQuestion(
  workOrPaths: WorkContract | readonly string[],
  inv?: Inventory,
  instanceId = `DQ-${factsHash(Array.isArray(workOrPaths) ? workOrPaths : (workOrPaths as WorkContract).id)}`,
  only?: readonly string[],
): Question {
  const production = !Array.isArray(workOrPaths);
  const pathWork = workOrPaths as WorkContract;
  const paths = production ? [...(only ?? undecidedDirty(pathWork, inv!))].sort() : [...(workOrPaths as readonly string[])].sort();
  const binding: DirtyBinding = production && inv
    ? productionBinding(workOrPaths as WorkContract, inv, instanceId, paths)
    : {
        workId: production ? pathWork.id : "",
        sessionGeneration: production ? pathWork.session.generation : 0,
        scopeHash: production ? dirtyScopeHash(pathWork) : "",
        instanceId,
        items: paths.map((path, index) => ({
          token: String(index + 1),
          path,
          relevantFacts: {
            path, status: "dirty", exists: true, workMode: null, workBlob: null,
            indexMode: null, indexBlob: null, startRef: factsHash(path),
          },
        })),
      };
  const listed = binding.items.map((item) => `${item.token}. ${displayPath(item.path)}`).join("\n");
  return question({
    id: "dirty-overlap",
    header: "Your edits",
    channel: "chat",
    bind: {
      factsHash: factsHash(binding),
      instanceId: binding.instanceId,
      workId: binding.workId,
      sessionGeneration: binding.sessionGeneration,
      scopeHash: binding.scopeHash,
      items: binding.items,
    },
    question:
      `This work needs to edit these files that already have your changes:\n${listed}\n` +
      "For each item: wait (recommended), include, or leave out. Reply with 1: wait, 2: include, or an explicit all-items choice. " +
      "Wait means I do not stage or commit those files. \"Don't commit\" keeps this task uncommitted and grants edit-only authority for every item named above.",
    options: [
      {
        label: "Wait",
        description: "Answer: wait. I won't stage or commit this file; commit or set it aside yourself, then continue.",
        recommended: true,
      },
      {
        label: "Include",
        description: "Answer: include. The whole file may enter a commit only if I also author a change to that same file.",
      },
      {
        label: "Leave out",
        description: "Answer: leave-out. I won't edit or commit this exact file; the result may be incomplete.",
      },
    ],
  });
}

/** Validated declared Tenet transitions refresh only the file whose edit the caller explicitly reports. */
export function observeDirtyTransitions(
  w: WorkContract, inv: Inventory, declared: readonly string[], at: string,
): WorkContract {
  const paths = new Set(declared);
  let changed = false;
  const decisions = (w.dirtyFileDecisions ?? []).map((decision) => {
    if (!paths.has(decision.path) || !["include", "edit-uncommitted"].includes(decision.choice)) return decision;
    changed = true;
    return { ...decision, relevantFacts: dirtyFacts(w, inv, decision.path), recordedAt: at };
  });
  return changed ? { ...w, dirtyFileDecisions: decisions } : w;
}

export function dirtyDecisionRefs(w: WorkContract, paths: readonly string[]): DirtyFileDecision[] {
  const set = new Set(paths);
  return (w.dirtyFileDecisions ?? []).filter((decision) => decision.choice === "include" && set.has(decision.path));
}

export type DirtyDecisionRef = Pick<
  DirtyFileDecision,
  "path" | "questionInstance" | "itemToken" | "relevantFacts" | "scopeHash" | "choice"
>;

const sameDecision = (decision: DirtyFileDecision, reference: DirtyDecisionRef): boolean =>
  decision.path === reference.path &&
  decision.questionInstance === reference.questionInstance &&
  decision.itemToken === reference.itemToken &&
  decision.scopeHash === reference.scopeHash &&
  decision.choice === reference.choice &&
  JSON.stringify(decision.relevantFacts) === JSON.stringify(reference.relevantFacts);

/** Commit settlement may use only one exact durable include decision for every admitted start-dirty path. */
export function hasDurableCommitAuthority(
  w: WorkContract, paths: readonly string[], references: unknown,
): boolean {
  if (paths.some(path => typeof path !== "string")) return false;
  const admitted = new Set(paths.filter(path => w.git.start.dirty.some(entry => entry.path === path)));
  if (!Array.isArray(references)) return admitted.size === 0;
  if (references.length !== admitted.size) return false;
  for (const path of admitted) {
    const refs = references.filter((item): item is DirtyDecisionRef =>
      !!item && typeof item === "object" && (item as { path?: unknown }).path === path
    );
    if (refs.length !== 1) return false;
    const reference = refs[0]!;
    if (
      reference.choice !== "include" ||
      typeof reference.questionInstance !== "string" ||
      typeof reference.itemToken !== "string" ||
      typeof reference.scopeHash !== "string"
    ) return false;
    const decisions = (w.dirtyFileDecisions ?? []).filter(decision => decision.path === path);
    const matches = decisions.filter(decision => sameDecision(decision, reference));
    const current = [...decisions].reverse()[0];
    if (
      !current ||
      matches.length !== 1 ||
      current !== matches[0] ||
      current.workId !== w.id ||
      current.sessionGeneration !== w.session.generation ||
      current.scopeHash !== dirtyScopeHash(w) ||
      current.relevantFacts.startRef !== startRef(w, path) ||
      current.choice !== "include"
    ) return false;
  }
  return true;
}
