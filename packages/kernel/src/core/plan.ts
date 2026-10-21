// The plan: an ordered list of independently checkable increments with dependencies (INT-12, TS §5). Pure.
import { elementId } from "./ids.ts";
import type { PlanItem } from "./schemas.ts";

export interface ProposedItem { ref?: string; id?: string; outcome: string; check: string; elementIds?: string[]; dependsOn?: string[] }
export type Built = { ok: true; items: PlanItem[]; changed: string[] } | { ok: false; message: string };

const FROZEN = new Set<PlanItem["state"]>(["in-progress", "done"]);

interface Assigned { ids: Map<string, string>; used: Set<string>; error?: string }

/** A ref in the proposal to the item's ID: a named item keeps its identity; an unnamed one gets a fresh one. */
function assignIds(byId: Map<string, PlanItem>, proposal: readonly ProposedItem[], seq: number, suffix: () => string): Assigned {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  let n = seq;
  for (const p of proposal) {
    if (!p.id) { ids.set(p.ref ?? `#${ids.size}`, elementId("PLN", ++n, suffix())); continue; }
    const had = byId.get(p.id);
    if (!had) return { ids, used, error: `there is no plan item ${p.id}` };
    if (FROZEN.has(had.state) && (had.outcome !== p.outcome || had.check !== p.check)) return { ids, used, error: `${p.id} is ${had.state} and cannot be edited` };
    if (used.has(p.id)) return { ids, used, error: `${p.id} appears twice` };
    used.add(p.id);
    ids.set(p.ref ?? p.id, p.id);
  }
  return { ids, used };
}

interface ItemResult { item?: PlanItem; same: boolean; error?: string }

/** One proposed item against what the plan already has: validated checks and dependencies, same-vs-changed. */
function buildItem(byId: Map<string, PlanItem>, ids: Map<string, string>, p: ProposedItem, id: string): ItemResult {
  const name = p.ref ?? id;
  const had = byId.get(id);
  if (!p.check.trim()) return { same: true, error: `${name} has no check: say how it is checked` };
  const deps: string[] = [];
  for (const d of p.dependsOn ?? []) {
    const target = ids.get(d) ?? (byId.has(d) ? d : undefined);
    if (!target) return { same: true, error: `${name} depends on ${d}, which is not in the plan` };
    deps.push(target);
  }
  const item: PlanItem = { id, outcome: p.outcome, elementIds: p.elementIds ?? had?.elementIds ?? [], dependsOn: deps, check: p.check, state: had && FROZEN.has(had.state) ? had.state : "proposed", ...(had?.work ? { work: had.work } : {}) };
  const same = !!had && had.outcome === item.outcome && had.check === item.check && JSON.stringify(had.dependsOn) === JSON.stringify(item.dependsOn) && JSON.stringify(had.elementIds) === JSON.stringify(item.elementIds);
  return { item: same ? had : item, same };
}

/**
 * The plan after a proposal. An item named by ID keeps its identity; one the proposal leaves out is dropped; one that is
 * started or done is kept as it is and cannot be edited. `changed` lists what needs the user's word.
 */
export function buildPlan(existing: readonly PlanItem[], proposal: readonly ProposedItem[], seq: number, suffix: () => string): Built {
  const byId = new Map(existing.map((i) => [i.id, i]));
  const assigned = assignIds(byId, proposal, seq, suffix);
  if (assigned.error) return { ok: false, message: assigned.error };
  const { ids, used } = assigned;

  const changed: string[] = [];
  const edited: PlanItem[] = [];
  const idList = [...ids.values()];
  for (const [k, p] of proposal.entries()) {
    const id = p.id ?? idList[k]!;
    const built = buildItem(byId, ids, p, id);
    if (built.error) return { ok: false, message: built.error };
    edited.push(built.item!);
    if (!built.same) changed.push(id);
  }
  const dropped = existing.filter((i) => !used.has(i.id) && !FROZEN.has(i.state) && i.state !== "dropped").map((i) => ({ ...i, state: "dropped" as const }));
  for (const d of dropped) changed.push(d.id);
  const kept = existing.filter((i) => FROZEN.has(i.state) && !used.has(i.id));
  const items = [...kept, ...edited, ...dropped, ...existing.filter((i) => i.state === "dropped" && !used.has(i.id))];
  const cycle = findCycle(items);
  return cycle ? { ok: false, message: `the plan has a cycle through ${cycle}` } : { ok: true, items, changed };
}

function findCycle(items: readonly PlanItem[]): string | undefined {
  const deps = new Map(items.map((i) => [i.id, i.dependsOn]));
  const done = new Set<string>(), path = new Set<string>();
  const visit = (id: string): string | undefined => {
    if (path.has(id)) return id;
    if (done.has(id)) return undefined;
    path.add(id);
    for (const d of deps.get(id) ?? []) { const c = visit(d); if (c) return c; }
    path.delete(id);
    done.add(id);
    return undefined;
  };
  for (const i of items) { const c = visit(i.id); if (c) return c; }
  return undefined;
}

/** The first accepted item whose dependencies are all done. */
export const nextItem = (items: readonly PlanItem[]): PlanItem | undefined =>
  items.find((i) => i.state === "accepted" && i.dependsOn.every((d) => items.find((x) => x.id === d)?.state === "done"));

/** Why a contract cannot start this item yet, or nothing when it can. */
export function planBlock(items: readonly PlanItem[], item: PlanItem): string | undefined {
  if (item.state !== "accepted") return `${item.id} is ${item.state === "proposed" ? "not accepted yet" : item.state}`;
  const waiting = item.dependsOn.filter((d) => items.find((x) => x.id === d)?.state !== "done");
  return waiting.length ? `${item.id} waits for ${waiting.join(", ")}` : undefined;
}

/** A contract ends: its item is done when the work reached checked-local, otherwise it is available again. */
export const releaseItem = (items: readonly PlanItem[], work: string, done: boolean): PlanItem[] =>
  items.map((i) => {
    if (i.work !== work) return i;
    const { work: _w, ...rest } = i;
    return { ...rest, state: done ? "done" : "accepted" };
  });
