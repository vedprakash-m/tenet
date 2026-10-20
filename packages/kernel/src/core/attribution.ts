// File-level attribution by the last-check rule (TS §10.2). Pure over inventories and recorded facts.
import { allowed } from "./exclusions.ts";
import type { Inventory } from "../ports/types.ts";
import type { StartSnapshot, WorkContract } from "./schemas.ts";

/** What `open` records about the starting tree: only differences from HEAD, so a clean tree costs nothing. */
export function snapshotOf(inv: Inventory): StartSnapshot {
  return {
    head: inv.head, branch: inv.branch,
    staged: inv.status.filter((s) => s.staged).map((s) => ({ path: s.path, mode: s.mode, blob: s.indexBlob })),
    dirty: inv.status.map((s) => ({ path: s.path, status: s.xy, mode: s.mode, blob: s.blob })),
  };
}

export interface Attribution {
  tenet: string[];       // clean at start, changed since, declared or written by a kernel effect
  human: string[];       // dirty at start and unchanged since, or changed without a declaration
  mixed: string[];       // dirty at start and Tenet declared it touched: the user decides first
  unexplained: string[]; // clean at start, changed, explained by nothing
  concurrent: string[];  // dirty at start and changed since by the human
  changed: string[];     // every path that differs from HEAD now
}

export function attribute(work: WorkContract, inv: Inventory, explainedBy: (path: string) => boolean): Attribution {
  const start = new Map(work.git.start.dirty.map((d) => [d.path, d]));
  const declared = new Set(work.touched.map((t) => t.path));
  const out: Attribution = { tenet: [], human: [], mixed: [], unexplained: [], concurrent: [], changed: [] };
  for (const s of inv.status) {
    out.changed.push(s.path);
    // Tenet never edits a file the exclusions forbid editing (secrets, .tenet/), so such a change is never Tenet's.
    if (!allowed("edit", s.path)) { out.human.push(s.path); continue; }
    const was = start.get(s.path);
    if (was) {
      if (declared.has(s.path)) out.mixed.push(s.path);
      else if (was.blob !== s.blob) out.concurrent.push(s.path);
      else out.human.push(s.path);
    } else if (declared.has(s.path) || explainedBy(s.path)) out.tenet.push(s.path);
    else if (work.keepOut.includes(s.path)) out.human.push(s.path); // the user said these are not Tenet's
    else out.unexplained.push(s.path);
  }
  // A start-dirty path that is now clean was reverted or committed by the human: nothing to attribute.
  return out;
}

/** The last-check rule: every Tenet file must still have the hash it had at the last successful check. */
export function changedSinceCheck(work: WorkContract, inv: Inventory, tenetPaths: readonly string[]): string[] {
  const last = new Map(work.touched.map((t) => [t.path, t.hashAtLastCheck]));
  return tenetPaths.filter((p) => {
    const h = last.get(p);
    return h !== undefined && (inv.entries.get(p)?.blob ?? "") !== h;
  });
}
