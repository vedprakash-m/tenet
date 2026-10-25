// Impact of an intent change (INT-08, TS §7.8): one pure function over links that already exist. It follows an example or
// invariant to its requirement and back, plan items to their elements and dependents, decision links, and live contracts that
// carry an affected element or plan item. Nothing is inferred from text, and test tags are not scanned here.
import { isLive } from "./state.ts";
import type { State } from "./schemas.ts";

export interface Impact {
  requested: string[]; unknown: string[];
  elements: Array<{ id: string; kind: string; text: string }>;
  plan: Array<{ id: string; outcome: string; state: string }>;
  tests: Array<{ file: string; element: string }>;
  decisions: Array<{ id: string; title: string; status: string }>;
  work: Array<{ id: string; label: string; state: string }>;
}

export function impact(state: Pick<State, "project" | "work">, ids: readonly string[]): Impact {
  const { elements, plan, records } = state.project.intent;
  const known = new Set([...elements.map((e) => e.id), ...plan.map((p) => p.id), ...records.map((r) => r.id)]);
  const unknown = ids.filter((id) => !known.has(id));
  const hit = new Set(ids.filter((id) => known.has(id)));

  // A requirement carries its examples and invariants; an example or invariant carries its requirement, but not its siblings.
  const asked = new Set(hit);
  for (const e of elements) if (e.of && asked.has(e.of)) hit.add(e.id);
  for (const e of elements) if (e.of && asked.has(e.id)) hit.add(e.of);
  const planHit = new Set(plan.filter((p) => p.elementIds.some((id) => hit.has(id)) || hit.has(p.id)).map((p) => p.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const p of plan) if (!planHit.has(p.id) && p.dependsOn.some((d) => planHit.has(d))) { planHit.add(p.id); grew = true; }
  }
  const touched = (id: string) => hit.has(id) || planHit.has(id);
  const mine = elements.filter((e) => hit.has(e.id));
  return {
    requested: [...ids], unknown,
    elements: mine.map((e) => ({ id: e.id, kind: e.kind, text: e.text })),
    plan: plan.filter((p) => planHit.has(p.id)).map((p) => ({ id: p.id, outcome: p.outcome, state: p.state })),
    tests: mine.filter((e) => e.testFile).map((e) => ({ file: e.testFile!, element: e.id })),
    decisions: records
      .filter((r) => touched(r.id) || r.links.some(touched) || (r.supersedes && touched(r.supersedes)))
      .map((r) => ({ id: r.id, title: r.title, status: r.status })),
    work: Object.values(state.work)
      .filter((w) => isLive(w) && ((w.basis?.elementIds ?? []).some(touched) || (w.planItem && planHit.has(w.planItem))))
      .map((w) => ({ id: w.id, label: w.label, state: w.state })),
  };
}
