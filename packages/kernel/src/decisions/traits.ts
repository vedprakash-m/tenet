// `decide traits`: detect and record project traits, show the work's change traits, and let the user correct either (QLT-11).
// `--answer traits=+auth,-ui` corrects project traits; `--answer change-traits=+persistence` corrects this work's change traits.
// A correction binds to the detected results it answers, so changed evidence needs a new correction.
// Removing auth, persistence, personal-data or external-effects removes a security control, so it needs the user's own words.
import { KernelError } from "../core/errors.ts";
import { detectProject, effectiveTraits, NOT_ASSESSED_IN_R1, parseCorrections, traitBind } from "../core/trait-detect.ts";
import type { TraitCorrection, TraitResult } from "../core/trait-detect.ts";
import { THREAT_TRAITS } from "../core/threat.ts";
import { nx, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const REMOVING = "removing a security trait removes its threat note; pass the user's own words with --quote";
const LIMIT = "Detection reads paths and package.json dependencies only. A trait without a signal is unknown, not absent.";

type Scope = "project" | "change";
function corrections(text: string | undefined, quote: string | undefined, scope: Scope, bind: string, work?: string): TraitCorrection[] {
  if (text === undefined) return [];
  const parsed = parseCorrections(text);
  if (!parsed) throw new KernelError("revision-conflict", 'name traits as "+auth,-ui" from the R1 set', { exit: 1 });
  const security = parsed.some((c) => c.outcome === "absent" && (THREAT_TRAITS as readonly string[]).includes(c.trait));
  if (security && !quote) throw new KernelError("revision-conflict", REMOVING, { exit: 1 });
  return parsed.map((c) => ({ ...c, scope, bind, ...(work ? { work } : {}) }));
}

export const traits: Decision = {
  kind: "traits",
  async run({ ports, state, work, input }) {
    const inv = await ports.git.inventory([]);
    const project = detectProject([...inv.entries.keys()].sort(), ports.project.read("package.json"));
    const projectBind = traitBind(project, "project");
    const change = (work.changeTraits ?? []) as TraitResult[];
    const changeBind = traitBind(change, "change", work.id);
    const all = [
      ...(state.project.traitCorrections ?? []) as TraitCorrection[],
      ...corrections(input.answers?.traits, input.quote, "project", projectBind),
      ...corrections(input.answers?.["change-traits"], input.quote, "change", changeBind, work.id),
    ];
    const projectTraits = effectiveTraits(project, all, projectBind);
    const next = { ...state, project: { ...state.project, traits: projectTraits, traitResults: project, traitCorrections: all } };
    const data = {
      project: { results: project, traits: projectTraits },
      change: work.changeTraits ? { results: change, traits: effectiveTraits(change, all, changeBind) } : null,
      notAssessed: NOT_ASSESSED_IN_R1, limit: LIMIT,
      ...(work.changeTraits ? {} : { changeNote: "Change traits are found at the next check, from the files this work changed." }),
    };
    return { state: withWork(next, work), resp: { work: work.id, data, next: [nx("check", "Continue.", true)] } };
  },
};
