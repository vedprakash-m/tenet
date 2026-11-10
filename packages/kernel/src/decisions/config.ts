// `decide config`: a setting from the typed catalog, read back in the user's terms; loosening is confirmed first (PRD §7.5).
import { CATALOG, interpretChange, isSettingKey, layersOf, needsConfirmation, unknownSetting, validateSetting } from "../core/config.ts";
import type { Scope } from "../core/config.ts";
import { KernelError } from "../core/errors.ts";
import { factsHash, question, withWork } from "../verbs/common.ts";
import { sharedPolicy } from "../verbs/reconcile.ts";
import type { Decision } from "./types.ts";

/** A setting from the typed catalog: set for this task or this project, or reset.
 * A change to what is already in force is no change (PRD §7.5). */
const STORED = "Stored declaration only: configured execution is unavailable; checks and checked-local are blocked.";

export const config: Decision = {
  kind: "config",
  run(ctx) {
    const { state, work, input } = ctx; // ports are read only once the setting is valid
    const key = input.target ?? "";
    if (!isSettingKey(key)) throw new KernelError("restriction-key-unknown", unknownSetting(key), { exit: 2 });
    const body = (input.propose ?? {}) as { value?: unknown; scope?: Scope; reset?: boolean };
    const scope: Scope = body.scope ?? CATALOG[key].scopes[0] ?? "project";
    const v = validateSetting(key, body.reset === true ? CATALOG[key].default : body.value, scope);
    if (!v.ok) throw new KernelError("restriction-key-unknown", v.message, { exit: 2 });
    if (body.reset === true) v.value = undefined;
    const held = scope === "task" ? work.settings ?? {} : state.config.local;
    const { [key]: had, ...rest } = held;
    const hasConfigured = (key === "commands" || key === "required_checks") && v.value && Object.keys(v.value).length;
    const data = {
      setting: key,
      scope,
      ...(v.value === undefined ? { reset: true } : { value: v.value }),
      ...(hasConfigured ? { limits: [STORED] } : {}),
    };
    if (JSON.stringify(had) === JSON.stringify(v.value)) return { resp: { work: work.id, data: { ...data, changed: false } } };
    const next = v.value === undefined ? rest : { ...rest, [key]: v.value };
    const out = scope === "task"
      ? withWork(state, { ...work, settings: next })
      : withWork({ ...state, config: { revision: state.config.revision + 1, local: next } }, work);
    const shared = sharedPolicy(ctx.ports, state);
    const before = layersOf(state, work, shared), after = layersOf(out, out.work[work.id], shared);
    const interpreted = interpretChange(key, before, after, scope, had);
    const loosens = needsConfirmation(key, before, after);
    const pending = state.pending.filter((q) => q.id !== "config-confirm");
    if (input.answers?.["config-confirm"] === "keep") {
      return { state: { ...state, pending }, resp: { work: work.id, data: { ...data, interpreted, changed: false, kept: true } } };
    }
    if (loosens.length) {
      const bind = factsHash([key, scope, v.value ?? null, state.config.revision]);
      const asked = state.pending.find((q) => q.id === "config-confirm")?.bind.factsHash === bind;
      if (!asked || input.answers?.["config-confirm"] !== "confirm") {
        const q = configQuestion(key, loosens, bind);
        const resp = { work: work.id, exit: 3 as const, questions: [q], data: { ...data, interpreted, changed: false } };
        return { state: { ...state, pending: [...pending, q] }, resp };
      }
    }
    return { state: { ...out, pending }, resp: { work: work.id, data: { ...data, interpreted, changed: true } } };
  },
};

/** Loosening or altering a commitment, restriction or command is confirmed first, bound to this exact change (PRD §7.5). */
function configQuestion(key: string, changes: string[], bind: string) {
  return question({
    id: "config-confirm", header: "Setting", bind: { factsHash: bind },
    question: `Changing ${key} would loosen or alter what is enforced: ${changes.join("; ")}. Save it?`,
    options: [
      { label: "Save it", description: "Answer: repeat the same decide config call with --answer config-confirm=confirm." },
      { label: "Keep the current setting", description: "Answer: repeat the call with --answer config-confirm=keep." },
    ],
  });
}
