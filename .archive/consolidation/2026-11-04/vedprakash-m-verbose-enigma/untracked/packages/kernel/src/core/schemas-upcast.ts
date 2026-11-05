// The one pure schema 1 -> 2 conversion (schema-migration 16.2 and 16.2.1; config-completion 16.2 and 18.2). It changes the format and
// nothing else: no revision, counter, grant, lock, pin, timestamp, receipt or reservation is touched, and no trait is inferred.
// Pure: a document and a context in, a document or a refusal out.
import type { State, WorkContract } from "./schemas.ts";
import { State2 } from "./schemas.ts";
import type { State2 as State2Doc } from "./schemas.ts";
import { decodeState1 } from "./schemas-legacy.ts";
import type { Decoded } from "./schemas-legacy.ts";

export interface UpcastContext {
  /** The target build's registry identity (`sha256:<hex>`), pinned in the preview. */
  registryVersion: string;
  /** The configuration projection of a work, computed from freshly validated sources; throws when a source is absent or malformed. */
  bindingHash: (work: WorkContract) => string;
}

const unassessedWork = {
  status: "unassessed", projectTraitHash: null, candidateDiffHash: null, assessments: [], corrections: [],
} as const;

/**
 * Legacy trait strings move, in order and with repeats, to inert fields; every project and work starts unassessed; each work gets a
 * binding at serial 0 and the recovery table starts at the initial floor (jobSeq 0, no job). Historical evidence stays unstamped, so it
 * proves nothing new.
 */
export function upcastState1(s: State, ctx: UpcastContext): State2Doc {
  const work = Object.fromEntries(Object.entries(s.work).map(([id, w]) => {
    const { basis, ...rest } = w;
    const moved = basis ? { basis: (({ traits, ...b }) => ({ ...b, legacyTraits: traits }))(basis) } : {};
    return [id, { ...rest, ...moved, configEvidence: { hash: ctx.bindingHash(w), serial: 0 }, traits: unassessedWork }];
  }));
  const traits = {
    status: "unassessed" as const, registryVersion: ctx.registryVersion, evidenceHash: null, resolutionHash: null,
    assessments: [], corrections: [], legacyUnverified: [...s.project.traits],
  };
  const validity = Object.values(work).map(w => ({ key: { workspaceId: s.workspaceId, work: w.id }, hash: w.configEvidence.hash,
    serial: 0 }));
  return State2.parse({ ...s, schema: 2, project: { ...s.project, traits }, work, recovery: { version: 2, jobSeq: 0, validity,
    jobs: [] } });
}

export interface SourceSet { primary: unknown; previous: unknown | null }
export interface TargetSet { primary: State2Doc; previous: State2Doc | null }

/**
 * Primary and previous convert independently, each with its own revision.
 * An invalid document, or a failing source, refuses the whole set.
 */
export function convertSet(src: SourceSet, ctx: UpcastContext): Decoded<TargetSet> {
  const one = (raw: unknown, where: string): Decoded<State2Doc> => {
    const d = decodeState1(raw);
    if (!d.ok) return { ...d, where: `${where}:${d.where}` };
    try { return { ok: true, value: upcastState1(d.value, ctx) }; }
    catch (e) { return { ok: false, reason: "unsupported-record", where, detail: e instanceof Error ? e.message : "conversion failed" }; }
  };
  const primary = one(src.primary, "state");
  if (!primary.ok) return primary;
  if (src.previous === null) return { ok: true, value: { primary: primary.value, previous: null } };
  const previous = one(src.previous, "state.prev");
  return previous.ok ? { ok: true, value: { primary: primary.value, previous: previous.value } } : previous;
}
