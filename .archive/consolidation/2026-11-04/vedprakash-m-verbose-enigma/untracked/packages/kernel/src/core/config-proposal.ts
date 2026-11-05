// Candidate schema-2 configuration proposal parsing, confirmation and publication rules.
import { CATALOG, isSettingKey, layersOf, resolveSetting, validateSetting, effectiveSettings } from "./config.ts";
import type { Layers, Scope } from "./config.ts";
import { advance, canonicalConfigValue, configHash, configValueEqual, definitionOf } from "./config-binding.ts";
import { hashOf, parseHandle, stableStringify } from "./ids.ts";
import { wantedStatic, wantsE2e, withE2e, withStatic } from "./obligations.ts";
import { Policy, comparePolicy, distinctRequiredChecks, sameRequiredCheck } from "./policy.ts";
import type { RequiredCheck } from "./policy.ts";
import { ConfigStamp } from "./schemas.ts";
import type { DecideInput, Question, State, State2, WorkContract, WorkContract2 } from "./schemas.ts";

export interface ConfigItem { key: string; path: string; reset: boolean; value?: unknown }
export interface ConfigRequest { scope: "task" | "project"; batch: boolean; items: ConfigItem[]; normalized: unknown }
export type ParsedConfigRequest =
  | { ok: true; request: ConfigRequest }
  | { ok: false; message: string; code: "restriction-key-unknown" | "revision-conflict" };
export interface ConfigCandidateContext { state: State2; input: DecideInput; shared: Policy; sharedBytes: string | null }
export interface ConfigCandidateResult {
  state: State2;
  resp: { exit?: 0 | 2 | 3; work: string; questions?: Question[]; data?: unknown; reasons?: { code: string; message: string }[] };
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const strictKeys = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).every((k) => keys.includes(k));
const canonical = (v: unknown): unknown => v === undefined ? { absent: true } : JSON.parse(stableStringify(v));
const canonicalProposalValue = (key: string, value: unknown, scope: Scope): unknown => {
  if (!isSettingKey(key)) return canonical(value);
  const parsed = validateSetting(key, value, scope);
  return parsed.ok ? canonicalConfigValue(key, parsed.value) : canonical(value);
};

export function parseConfigRequest(input: DecideInput): ParsedConfigRequest {
  const invalid = (message: string): ParsedConfigRequest => ({ ok: false, code: "restriction-key-unknown", message });
  if (input.quote !== undefined) return invalid("quote is not a config input");
  if (input.target !== undefined) {
    if (!object(input.propose) || !strictKeys(input.propose, ["value", "reset", "scope"])) {
      return invalid("propose must be a strict value/reset object");
    }
    const body = input.propose;
    if ((Object.hasOwn(body, "value") === Object.hasOwn(body, "reset")) || (body.reset !== undefined && body.reset !== true)) {
      return invalid("propose must contain exactly one of value or reset:true");
    }
    if (body.scope !== undefined && body.scope !== "task" && body.scope !== "project") return invalid("scope must be task or project");
    const defaultScope: Scope | undefined = isSettingKey(input.target) ? CATALOG[input.target].scopes[0] as Scope | undefined : undefined;
    const scope = (body.scope as Scope | undefined) ?? defaultScope;
    if (!scope) return invalid(`unknown setting "${input.target}"`);
    return { ok: true, request: {
      scope, batch: false,
      items: [{ key: input.target, path: input.target, reset: body.reset === true, ...(body.reset === true ? {} : { value: body.value }) }],
      normalized: {
        target: input.target, scope,
        ...(body.reset === true ? { reset: true } : { value: canonicalProposalValue(input.target, body.value, scope) }),
      },
    } };
  }
  if (!object(input.propose) || !strictKeys(input.propose, ["settings", "scope"])) {
    return invalid("batch propose must contain only settings and scope");
  }
  const body = input.propose;
  if (!object(body.settings) || Object.keys(body.settings).length === 0) return invalid("settings must be a nonempty object");
  if (body.scope !== "project") return invalid("batch scope must be project");
  const items = Object.entries(body.settings).map(([key, value]) => ({ key, path: key, reset: false, value }));
  const normalized = {
    settings: Object.fromEntries(items.map((item) => [item.key, canonicalProposalValue(item.key, item.value, "project")])),
    scope: "project",
  };
  return { ok: true, request: { scope: "project", batch: true, items, normalized } };
}

const safePattern = (v: unknown): v is string => typeof v === "string" && !!v && v.length <= 200
  && !v.startsWith("/") && !v.includes("\\") && !v.includes("\0") && !v.split("/").some((part) => !part || part === "." || part === "..");
const validKey = (key: string) => isSettingKey(key) && CATALOG[key].scopes.some((scope) => scope === "project");
const schemaValue = (key: string, value: unknown) => isSettingKey(key)
  ? validateSetting(key, value, "project")
  : { ok: false as const, message: `unknown setting "${key}"` };
const normalizedSetting = (key: string, value: unknown): unknown => {
  if (!isSettingKey(key) || value === undefined) return canonical(value);
  const r = validateSetting(key, value, "project");
  return r.ok ? r.value : canonical(value);
};

function currentWork(state: State2, h: string | undefined): WorkContract2 | undefined {
  return findWork(state, h) as WorkContract2 | undefined;
}

function findWork(state: State | State2, h: string | undefined): WorkContract | WorkContract2 | undefined {
  if (!h) return undefined;
  const parsed = parseHandle(h);
  if (!parsed || parsed.tag !== state.tag) return undefined;
  return Object.values(state.work).find((w) => w.label === `W-${String(parsed.labelN).padStart(4, "0")}`
    && w.session.generation === parsed.generation);
}

const idFor = (w: WorkContract2) => `config-confirm:${w.id}:${w.session.generation}`;
const pendingFor = (state: State2, w: WorkContract2) => state.pending.find((q) => q.id === idFor(w));
const confirmationMatches = (
  ctx: ConfigCandidateContext, request: ConfigRequest, work: WorkContract2, answer: [string, string] | undefined,
) => {
  if (answer?.[1] !== "confirm") return true;
  const pending = pendingFor(ctx.state, work);
  return answer[0] === idFor(work) && !!pending
    && pending.bind.factsHash === configConfirmationFacts(ctx, request, work);
};

export function configConfirmationFacts(ctx: ConfigCandidateContext, request: ConfigRequest, work: WorkContract2): string {
  const keys = [...new Set(request.items.map((i) => i.key))].sort();
  const layers = layersOf(ctx.state, work, ctx.shared);
  const values = proposalValues(request);
  const afterLayers = prospectiveLayers(ctx.state, work, request, values, ctx.shared);
  const before = Object.fromEntries(keys.filter(isSettingKey).map((key) => [key, {
    stored: canonical((request.scope === "project" ? ctx.state.config.local : work.settings)?.[key]),
    effective: resolveSetting(key, layers),
  }]));
  const after = Object.fromEntries(keys.filter(isSettingKey).map((key) => [key, {
    stored: canonical((request.scope === "project" ? afterLayers.local : afterLayers.task)[key]),
    effective: resolveSetting(key, afterLayers),
  }]));
  return hashOf({
    version: 1, workspace: ctx.state.workspaceId, work: work.id, generation: work.session.generation,
    proposal: request.normalized, catalog: Object.fromEntries(keys.map((k) => [k, isSettingKey(k) ? CATALOG[k].default : null])),
    before, after, sharedBytes: ctx.sharedBytes, adopted: ctx.state.trust.filter((t) => t.file === "tenet.policy.json"),
    adoption: ctx.state.project.adoption.policy, impacts: impactProjection(ctx.state, request, work),
  });
}

/** Pre-cache identity for the existing decide verb; other decision kinds keep their prior identity. */
export function configCallIdentity(ctx: {
  state: State | State2; input: DecideInput; shared: Policy; sharedBytes: string | null;
}): unknown {
  if (ctx.input.kind !== "config") return undefined;
  const parsed = parseConfigRequest(ctx.input);
  const request = parsed.ok ? parsed.request : undefined;
  const work = findWork(ctx.state, ctx.input.h);
  const question = work && ctx.state.pending.find((q) => q.id === `config-confirm:${work.id}:${work.session.generation}`);
  const details = request && work ? configIdentityProjection(ctx.state, request, work, ctx.shared) : null;
  const retainedPolicy = ctx.state.trust.filter((t) => t.file === "tenet.policy.json");
  return {
    kind: "config", proposal: request ? request.normalized : ctx.input.propose,
    target: ctx.input.target ?? null, scope: ctx.input.propose && object(ctx.input.propose) ? ctx.input.propose.scope ?? null : null,
    facts: request && work && details ? hashOf({
      version: 1, workspace: ctx.state.workspaceId, work: work.id, generation: work.session.generation,
      proposal: request.normalized, ...details,
      sharedBytes: ctx.sharedBytes, retainedPolicy, adoption: ctx.state.project.adoption.policy,
    }) : null,
    currentQuestion: question ? { id: question.id, binding: question.bind.factsHash } : null,
  };
}

function configIdentityProjection(state: State | State2, request: ConfigRequest, work: WorkContract | WorkContract2, shared: Policy) {
  const keys = [...new Set(request.items.map((i) => i.key))].sort();
  const layers = layersOf(state, work, shared);
  const afterLayers = prospectiveLayers(state, work, request, proposalValues(request), shared);
  const source = request.scope === "task" ? work.settings ?? {} : state.config.local;
  return {
    catalog: Object.fromEntries(keys.map((key) => [key, isSettingKey(key) ? CATALOG[key].default : null])),
    stored: Object.fromEntries(keys.map((key) => [key, canonical(source[key])])),
    before: Object.fromEntries(keys.filter(isSettingKey).map((key) => [key, resolveSetting(key, layers)])),
    after: Object.fromEntries(keys.filter(isSettingKey).map((key) => [key, {
      stored: canonical((request.scope === "project" ? afterLayers.local : afterLayers.task)[key]),
      effective: resolveSetting(key, afterLayers),
    }])),
    impacts: impactProjection(state, request, work),
  };
}

function impactProjection(state: State | State2, request: ConfigRequest, work: WorkContract | WorkContract2) {
  const keys = [...new Set(request.items.map((i) => i.key))].sort();
  const affected = request.scope === "project" ? Object.values(state.work) : [work];
  return affected.map((w) => ({
    id: w.id,
    generation: w.session.generation,
    task: Object.fromEntries(keys.map((key) => [key, canonical(w.settings?.[key])])),
    ...(keys.includes("protected_paths") ? { protected: [...w.scope.protected] } : {}),
    ...(keys.includes("required_checks") ? {
      obligations: w.obligations.map(definitionOf)
        .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)),
    } : {}),
  })).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
}

function proposalValues(request: ConfigRequest): Map<string, unknown> {
  return new Map(request.items.map((item) => [item.key, item.reset ? undefined : normalizedSetting(item.key, item.value)]));
}

function prospectiveLayers(
  state: { config: { local: Record<string, unknown> }; project: { adoption: Layers["adoption"] } },
  work: { settings?: Record<string, unknown> },
  request: ConfigRequest,
  values: Map<string, unknown>,
  shared: Policy,
): Layers {
  const local = { ...state.config.local };
  const task = { ...(work.settings ?? {}) };
  const destination = request.scope === "project" ? local : task;
  for (const [key, value] of values) {
    if (value === undefined) delete destination[key];
    else destination[key] = value;
  }
  return { shared, local, task, adoption: state.project.adoption };
}

function error(state: State2, work: WorkContract2 | undefined, code: string, message: string): ConfigCandidateResult {
  return { state, resp: { exit: 2, work: work?.id ?? "", reasons: [{ code, message }] } };
}

function contentProblems(request: ConfigRequest) {
  const problems: Array<{ path: string; message: string }> = [];
  for (const item of request.items) {
    if (!validKey(item.key)) {
      problems.push({ path: item.path, message: `unknown or unsupported setting "${item.key}"` });
      continue;
    }
    if (item.reset) continue;
    const r = schemaValue(item.key, item.value);
    if (!r.ok) {
      problems.push({ path: item.path, message: r.message });
      continue;
    }
    if (item.key === "protected_paths") for (const [i, p] of (item.value as unknown[]).entries()) {
      if (!safePattern(p)) problems.push({
        path: `${item.path}[${i}]`,
        message: "path must be a nonempty workspace-relative pattern without empty, dot, parent, absolute, or backslash segments",
      });
    }
    if (item.key === "exclusions") for (const [i, rule] of (item.value as Array<{ pattern: string; kinds: string[] }>).entries()) {
      if (!safePattern(rule.pattern)) problems.push({
        path: `${item.path}[${i}].pattern`, message: "pattern must be a nonempty workspace-relative pattern",
      });
    }
  }
  return problems;
}

const enumKinds = ["no-model-send", "no-read", "no-edit", "no-export", "no-routine-scan"] as const;
const strictRank = { allow: 0, "require-approval": 1, deny: 2 } as const;
const effective = (state: State2, work: WorkContract2, shared: Policy) =>
  effectiveSettings(layersOf(state, work, shared));
const asPolicy = (settings: Record<string, unknown>) => Policy.parse(Object.fromEntries(
  ["commands", "required_checks", "exclusions", "protected_paths", "dependency_policy"]
    .filter((key) => settings[key] !== undefined).map((key) => [key, settings[key]]),
));

function sameValue(key: string, a: unknown, b: unknown): boolean {
  return isSettingKey(key) && configValueEqual(key, a, b);
}

function needsConfirmation(before: State2, after: State2, request: ConfigRequest, shared: Policy, work: WorkContract2): boolean {
  for (const item of request.items) {
    if (!isSettingKey(item.key)) continue;
    const oldLocal = request.scope === "project" ? before.config.local[item.key] : work.settings?.[item.key];
    const newLocal = request.scope === "project" ? after.config.local[item.key] : after.work[work.id]?.settings?.[item.key];
    if (sameValue(item.key, oldLocal, newLocal)) continue;
    if (item.key === "commands") return true;
    if (item.key === "required_checks") {
      const oldChecks = oldLocal as RequiredCheck[] | undefined ?? [];
      const nextChecks = newLocal as RequiredCheck[] | undefined ?? [];
      for (const oldCheck of oldChecks) {
        const nextCheck = nextChecks.find((check) => check.id === oldCheck.id);
        if (nextCheck && !sameRequiredCheck(oldCheck, nextCheck)) return true;
      }
      const sharedChecks = (shared.required_checks ?? []) as RequiredCheck[];
      for (const nextCheck of nextChecks) {
        const oldCheck = oldChecks.find((check) => check.id === nextCheck.id);
        if (oldCheck) continue;
        if (sharedChecks.some((check) => check.id === nextCheck.id && !sameRequiredCheck(check, nextCheck))) return true;
      }
      const old = resolveSetting(item.key, layersOf(before, work, shared)).value as RequiredCheck[];
      const nextWork = after.work[work.id] ?? work;
      const next = resolveSetting(item.key, layersOf(after, nextWork, shared)).value as RequiredCheck[];
      const oldById = new Map(old.map((c) => [c.id, c]));
      if (next.some((c) => oldById.has(c.id) && !sameRequiredCheck(oldById.get(c.id)!, c))
        || old.some((c) => !next.some((n) => n.id === c.id))) return true;
    }
  }
  const beforeSettings = effective(before, work, shared);
  const nextWork = after.work[work.id] ?? work;
  const afterSettings = effective(after, nextWork, shared);
  return comparePolicy(asPolicy(beforeSettings), asPolicy(afterSettings)).some((c) => c.kind === "loosened" || c.kind === "changed");
}

function updateCandidateState(
  state: State2, request: ConfigRequest, values: Map<string, unknown>, work: WorkContract2, shared: Policy,
): State2 {
  let next: State2 = state;
  if (request.scope === "project") {
    const local = { ...state.config.local };
    for (const item of request.items) {
      if (!values.has(item.key) || !isSettingKey(item.key)) continue;
      const value = values.get(item.key);
      if (value === undefined) delete local[item.key];
      else local[item.key] = value;
    }
    next = { ...next, config: { revision: state.config.revision + 1, local } };
  } else {
    const settings = { ...(work.settings ?? {}) };
    for (const item of request.items) {
      if (!values.has(item.key) || !isSettingKey(item.key)) continue;
      const value = values.get(item.key);
      if (value === undefined) delete settings[item.key];
      else settings[item.key] = value;
    }
    next = { ...next, work: { ...next.work, [work.id]: { ...work, settings } } };
  }
  const hashes: Record<string, string> = {};
  const floors: Record<string, number> = {};
  const updated: Record<string, WorkContract2> = {};
  for (const [id] of Object.entries(next.work)) {
    const w = next.work[id]!;
    const layers = layersOf(next, w, shared);
    const resolved = effectiveSettings(layers);
    const protectedPaths = [...new Set([...w.scope.protected, ...(resolved.protected_paths as string[])])];
    const recipeChecks = next.project.recipe?.checks ?? [];
    const required = resolved.required_checks as RequiredCheck[];
    const obligations = withE2e(withStatic(w.obligations, wantedStatic(recipeChecks, required)), wantsE2e(recipeChecks));
    const projectedWork: WorkContract2 = { ...w, scope: { ...w.scope, protected: protectedPaths }, obligations };
    const bound = {
      lane: projectedWork.lane, floor: projectedWork.floor, protectedPaths,
      recipeChecks, obligations: projectedWork.obligations,
    };
    hashes[id] = configHash(layers, bound);
    floors[id] = next.recovery.validity.find((f) => f.key.workspaceId === next.workspaceId && f.key.work === id)?.serial ?? -1;
    updated[id] = projectedWork;
  }
  for (const id of Object.keys(updated)) {
    const stamp = advance(updated[id]!.configEvidence, hashes[id]!, floors[id]);
    updated[id] = { ...updated[id]!, configEvidence: ConfigStamp.parse(stamp) };
  }
  const floorsById = new Map(next.recovery.validity.map((f) => [`${f.key.workspaceId}\0${f.key.work}`, f]));
  for (const [id, w] of Object.entries(updated)) floorsById.set(`${next.workspaceId}\0${id}`, {
    key: { workspaceId: next.workspaceId, work: id }, hash: w.configEvidence.hash, serial: w.configEvidence.serial,
  });
  next = {
    ...next, work: updated,
    recovery: { ...next.recovery, validity: [...floorsById.values()] },
  };
  return next;
}

type SubsetIssue = { path: string; message: string };
type SubsetBuilder = {
  before: Record<string, unknown>; local: Record<string, unknown>;
  applied: string[]; rejected: SubsetIssue[]; heldChecks: RequiredCheck[];
};

function addContribution(b: SubsetBuilder, key: string, value: unknown, path: string) {
  const old = b.local[key];
  if (key === "protected_paths") b.local[key] = [...new Set([...(old as string[] | undefined ?? []), ...(value as string[])])];
  else if (key === "exclusions") {
    const all = [
      ...(old as Array<{ pattern: string; kinds: string[] }> | undefined ?? []),
      ...(value as Array<{ pattern: string; kinds: string[] }>),
    ];
    const grouped = new Map<string, Set<string>>();
    for (const entry of all) {
      const kinds = grouped.get(entry.pattern) ?? new Set<string>();
      entry.kinds.forEach((kind) => kinds.add(kind));
      grouped.set(entry.pattern, kinds);
    }
    b.local[key] = [...grouped].map(([pattern, kinds]) => ({ pattern, kinds: [...kinds] }));
  } else if (key === "dependency_policy") b.local[key] = { ...(old as object ?? {}), ...(value as object) };
  else if (key === "required_checks") b.local[key] = distinctRequiredChecks([
    ...((old as RequiredCheck[] | undefined) ?? []), ...(value as RequiredCheck[]),
  ]);
  b.applied.push(path);
}

function addProtectedSubset(b: SubsetBuilder, item: ConfigItem) {
  if (!Array.isArray(item.value)) return;
  const seen = new Set<string>();
  for (const [i, value] of item.value.entries()) {
    const path = `${item.path}[${i}]`;
    if (!safePattern(value)) continue;
    if ((b.before.protected_paths as string[]).includes(value)) {
      b.rejected.push({ path, message: "already held by an effective source; do not copy it into the local contribution" });
    } else if (seen.has(value)) b.rejected.push({ path, message: "duplicate path in the proposed safe subset" });
    else {
      seen.add(value);
      addContribution(b, item.key, [value], path);
    }
  }
}

function addExclusionSubset(b: SubsetBuilder, item: ConfigItem) {
  if (!Array.isArray(item.value)) return;
  for (const [i, raw] of item.value.entries()) {
    const path = `${item.path}[${i}]`;
    if (!object(raw) || !safePattern(raw.pattern) || !Array.isArray(raw.kinds)) continue;
    if (Object.keys(raw).some((key) => !["pattern", "kinds"].includes(key))) {
      b.rejected.push({ path, message: "unknown exclusion member; recognized valid members are evaluated independently" });
    }
    const kinds = raw.kinds.filter((kind): kind is typeof enumKinds[number] =>
      typeof kind === "string" && enumKinds.includes(kind as typeof enumKinds[number]));
    raw.kinds.forEach((kind, j) => {
      if (!kinds.includes(kind as typeof enumKinds[number])) {
        b.rejected.push({ path: `${path}.kinds[${j}]`, message: "unknown exclusion kind" });
      }
    });
    const held = (b.before.exclusions as Array<{ pattern: string; kinds: string[] }>)
      .find((entry) => entry.pattern === raw.pattern)?.kinds ?? [];
    const fresh = kinds.filter((kind) => !held.includes(kind));
    if (fresh.length) addContribution(b, item.key, [{ pattern: raw.pattern, kinds: fresh }], path);
    else if (!b.rejected.some((issue) => issue.path === path)) b.rejected.push({ path, message: "no new effective restriction" });
  }
}

function addDependencySubset(b: SubsetBuilder, item: ConfigItem) {
  if (!object(item.value)) return;
  const safe: Record<string, unknown> = {};
  const shape = Policy.shape.dependency_policy.unwrap().shape;
  for (const [key, value] of Object.entries(item.value)) {
    const parsed = shape[key as keyof typeof shape]?.safeParse(value);
    if (!parsed?.success) {
      b.rejected.push({ path: `${item.path}.${key}`, message: "unknown or invalid dependency restriction" });
      continue;
    }
    const old = (b.before.dependency_policy as Record<string, unknown>)[key];
    const tighter = key === "min_release_age_days" ? Number(value) > Number(old)
      : typeof value === "string" && typeof old === "string" && value in strictRank && old in strictRank
        && strictRank[value as keyof typeof strictRank] > strictRank[old as keyof typeof strictRank];
    if (tighter) safe[key] = value;
    else b.rejected.push({ path: `${item.path}.${key}`, message: "not a proven tightening over the effective restriction" });
  }
  if (Object.keys(safe).length) addContribution(b, item.key, safe, item.path);
}

function addRequiredSubset(b: SubsetBuilder, item: ConfigItem) {
  if (!Array.isArray(item.value)) return;
  const grouped = new Map<string, RequiredCheck[]>();
  for (const [i, raw] of item.value.entries()) {
    const path = `${item.path}[${i}]`;
    const parsed = schemaValue("required_checks", [raw]);
    if (!parsed.ok) { b.rejected.push({ path, message: parsed.message }); continue; }
    const check = (parsed.value as RequiredCheck[])[0]!;
    if (b.heldChecks.some((old) => old.id === check.id)) {
      b.rejected.push({ path, message: `required check "${check.id}" is not a new ID across all sources` });
      continue;
    }
    grouped.set(check.id, [...(grouped.get(check.id) ?? []), check]);
  }
  const additions: RequiredCheck[] = [];
  for (const [id, definitions] of grouped) {
    const distinct = distinctRequiredChecks(definitions);
    if (distinct.length > 1) b.rejected.push({ path: item.path, message: `conflicting proposed definitions for "${id}"` });
    else additions.push(distinct[0]!);
  }
  if (additions.length) addContribution(b, item.key, additions, item.path);
}

function addSafeItem(b: SubsetBuilder, item: ConfigItem) {
  if (item.key === "protected_paths") addProtectedSubset(b, item);
  else if (item.key === "exclusions") addExclusionSubset(b, item);
  else if (item.key === "dependency_policy") addDependencySubset(b, item);
  else if (item.key === "required_checks") addRequiredSubset(b, item);
}

function addSafeSubset(ctx: ConfigCandidateContext, request: ConfigRequest, problems: SubsetIssue[], work: WorkContract2) {
  const { state, shared } = ctx;
  const local = { ...state.config.local };
  const eligible = new Set(["protected_paths", "exclusions", "dependency_policy", "required_checks"]);
  const b: SubsetBuilder = {
    before: effectiveSettings(layersOf(state, work, shared)), local, applied: [], rejected: [...problems],
    heldChecks: [...((shared.required_checks ?? []) as RequiredCheck[]), ...((local.required_checks ?? []) as RequiredCheck[])],
  };
  for (const item of request.items) {
    if (item.reset && !b.rejected.some((issue) => issue.path === item.path)) {
      b.rejected.push({ path: item.path, message: "resets are not eligible for a D6 safe subset" });
    } else if (!eligible.has(item.key) && !b.rejected.some((issue) => issue.path === item.path || issue.path.startsWith(`${item.path}.`))) {
      b.rejected.push({ path: item.path, message: "this setting is not eligible for a D6 safe subset" });
    } else if (eligible.has(item.key)) addSafeItem(b, item);
  }
  const after = effectiveSettings(layersOf({ ...state, config: { ...state.config, local } }, work, shared));
  const changes = comparePolicy(asPolicy(b.before), asPolicy(after));
  if (changes.some((change) => change.kind === "loosened" || change.kind === "changed")) {
    return {
      values: new Map<string, unknown>(), applied: [],
      rejected: [...b.rejected, { path: "settings", message: "composed safe subset is not provably tighter" }],
    };
  }
  const values = new Map<string, unknown>();
  for (const key of eligible) {
    if (stableStringify(local[key]) !== stableStringify(state.config.local[key])) values.set(key, local[key]);
  }
  return { values, applied: b.applied, rejected: b.rejected };
}

function applyD6Subset(
  ctx: ConfigCandidateContext, work: WorkContract2, request: ConfigRequest, problems: SubsetIssue[],
): ConfigCandidateResult | undefined {
  if (!problems.length) return undefined;
  const { state, shared } = ctx;
  const subset = request.scope === "project"
    ? addSafeSubset(ctx, request, problems, work)
    : { values: new Map<string, unknown>(), applied: [] as string[], rejected: problems };
  if (!subset.values.size) {
    const failed = error(state, work, "restriction-key-unknown", "the proposal has no independently applicable safe restriction");
    return { ...failed, resp: { ...failed.resp, data: { applied: [], rejected: subset.rejected } } };
  }
  const partial = { ...request, items: request.items.filter((item) => subset.values.has(item.key)) };
  const next = updateCandidateState(state, partial, subset.values, work, shared);
  return { state: next, resp: { exit: 2, work: work.id, data: { changed: true, applied: subset.applied, rejected: subset.rejected } } };
}

export function runConfigCandidate(ctx: ConfigCandidateContext): ConfigCandidateResult {
  const { state, input, shared } = ctx;
  const work = currentWork(state, input.h);
  if (!work) return error(state, undefined, "handle-unknown", "the candidate config request needs a current work handle");
  const fail = (code: string, message: string) => error(state, work, code, message);
  if (input.kind !== "config") return fail("restriction-key-unknown", "candidate config handler received another decision kind");
  if (input.answers && (
    Object.keys(input.answers).length !== 1
    || Object.values(input.answers).some((v) => !["confirm", "decline"].includes(v))
  )) {
    return fail("revision-conflict", "config accepts only the current config-confirm answer");
  }
  const answerEntry = input.answers && Object.entries(input.answers)[0];
  const id = idFor(work);
  if (answerEntry?.[1] === "decline") {
    if (input.propose !== undefined || input.target !== undefined || answerEntry[0] !== id || !pendingFor(state, work)) {
      return fail("revision-conflict", "decline must answer this work's current config question without a proposal");
    }
    return {
      state: { ...state, pending: state.pending.filter((q) => q.id !== id) },
      resp: { work: work.id, exit: 0, data: { declined: true } },
    };
  }
  const parsed = parseConfigRequest(input);
  if (!parsed.ok) return fail(parsed.code, parsed.message);
  const request = parsed.request;
  if (!confirmationMatches(ctx, request, work, answerEntry)) {
    return fail("revision-conflict", "the configuration proposal or relevant source changed; "
      + "submit it again without answers for a fresh preview");
  }
  const problems = contentProblems(request);
  const partial = applyD6Subset(ctx, work, request, problems);
  if (partial) return partial;
  const values = new Map<string, unknown>();
  for (const item of request.items) values.set(item.key, item.reset ? undefined : normalizedSetting(item.key, item.value));
  const changed = request.items.some((item) => !sameValue(item.key,
    request.scope === "project" ? state.config.local[item.key] : work.settings?.[item.key], values.get(item.key)));
  if (!changed) {
    if (answerEntry) return fail("revision-conflict", "a confirmation answer cannot be applied to a no-op proposal");
    return { state, resp: { work: work.id, exit: 0, data: { changed: false } } };
  }
  const candidate = updateCandidateState(state, request, values, work, shared);
  if (needsConfirmation(state, candidate, request, shared, work)) {
    const factsHash = configConfirmationFacts(ctx, request, work);
    const answer = answerEntry?.[1];
    if (answer !== "confirm") {
      const q: Question = {
        id, header: "Confirm configuration change", channel: "native",
        bind: { factsHash },
        question: "This proposal changes an existing command/check definition or loosens a restriction. "
          + "Confirm the full repeated proposal to apply it; no execution or evidence authority is granted.",
        options: [{ label: "Confirm this change", description: "Apply the repeated proposal only if its bound facts are unchanged." },
          { label: "Decline", description: "Leave configuration unchanged." }],
      };
      return { state: { ...state, pending: [...state.pending.filter((p) => p.id !== id), q] },
        resp: { exit: 3, work: work.id, questions: [q], data: { changed: false } } };
    }
  } else if (answerEntry) {
    return fail("revision-conflict", "this proposal does not match an active confirmation question");
  }
  const next = updateCandidateState(state, request, values, work, shared);
  return { state: { ...next, pending: next.pending.filter((p) => p.id !== id) },
    resp: { work: work.id, exit: 0, data: { changed: true, scope: request.scope } } };
}

/** Extend the pre-cache hook with exact config proposal/source/question identity. */
