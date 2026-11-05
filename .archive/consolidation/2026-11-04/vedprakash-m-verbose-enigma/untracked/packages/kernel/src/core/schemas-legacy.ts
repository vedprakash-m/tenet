// Strict schema-1 decoding for the migration candidate (schema-migration 16.7 and 18.1). Pure: bytes in, a value or a refusal out.
// Zod strips nested unknown keys, so every decode parses once and then compares the raw object with what survived: a raw key that did not
// survive is an unknown key and refuses. Nothing is repaired, relocated or reinterpreted.
import { z } from "zod";
import { IndexSyncRecord, KernelResponse, Sha, State, State2, AccountingCheckpoint } from "./schemas.ts";

export interface Refusal { ok: false; reason: "unsupported-record"; where: string; detail: string }
export type Decoded<T> = { ok: true; value: T } | Refusal;
const refuse = (where: string, detail: string): Refusal => ({ ok: false, reason: "unsupported-record", where, detail });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The first raw key (as a path) that the parsed copy does not hold, or null. Values typed `unknown` survive whole and never report. */
export function unknownKey(raw: unknown, parsed: unknown, path = ""): string | null {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    for (let i = 0; i < raw.length; i++) { const hit = unknownKey(raw[i], parsed[i], `${path}/${i}`); if (hit) return hit; }
    return null;
  }
  if (!isObject(raw) || !isObject(parsed)) return null;
  for (const [k, v] of Object.entries(raw)) {
    if (!Object.hasOwn(parsed, k)) return `${path}/${k}`;
    const hit = unknownKey(v, parsed[k], `${path}/${k}`);
    if (hit) return hit;
  }
  return null;
}

function strictParse<T extends z.ZodType>(schema: T, raw: unknown, where: string): Decoded<z.infer<T>> {
  const r = schema.safeParse(raw);
  if (!r.success) return refuse(where, r.error.issues[0]?.message ?? "invalid");
  const extra = unknownKey(raw, r.data);
  return extra ? refuse(where, `unknown key ${extra}`) : { ok: true, value: r.data };
}

// ---------------------------------------------------------------- state document

/** Where a schema-1 document points outside itself (18.1): owned blobs, owned temp run directories and manifests. */
export interface References { blobs: string[]; runDirs: string[]; manifests: string[] }

export function stateReferences(s: State): References {
  const blobs = new Set<string>(), runDirs = new Set<string>(), manifests = new Set<string>();
  for (const a of s.archive) blobs.add(a.blob);
  for (const w of Object.values(s.work)) {
    for (const b of [w.dependency?.before.manifest, w.dependency?.before.lock]) if (b) blobs.add(b);
    for (const r of w.receipts) runDirs.add(r.provenance.runDir);
    if (w.session.inCall?.runDir) runDirs.add(w.session.inCall.runDir);
    for (const r of [...w.budget.reservations, ...(w.focusedReview ? [w.focusedReview] : [])]) manifests.add(r.manifestHash);
  }
  return { blobs: [...blobs].sort(), runDirs: [...runDirs].sort(), manifests: [...manifests].sort() };
}

/**
 * A schema-1 state document, strictly. A nonempty archive refuses (no writer or payload decoder exists), and so does a cached response
 * whose envelope holds a key outside the response schema; `data` stays opaque and is never searched for paths (18.1, open question Q1).
 */
export function decodeState1(raw: unknown): Decoded<State> {
  const d = strictParse(State, raw, "state");
  if (!d.ok) return d;
  if (d.value.archive.length) return refuse("state/archive", "an archive entry has no reviewed payload decoder");
  for (const [id, w] of Object.entries(d.value.work)) {
    const last = w.session.last?.response;
    if (last === undefined) continue;
    const r = strictParse(KernelResponse, last, `state/work/${id}/session/last/response`);
    if (!r.ok) return r;
  }
  return d;
}

/**
 * A schema-2 document, with the same unknown-key rule: a nested key the schema does not declare refuses, and no schema-1 field is a
 * fallback.
 */
export const decodeState2 = (raw: unknown): Decoded<State2> => strictParse(State2, raw, "state");

// ---------------------------------------------------------------- journal and the ten effect kinds

const Oid = z.string().regex(/^[0-9a-f]{40,64}$/);
const Id = z.string().min(1);
const Done = { completed: z.boolean() };
const Blobs = z.strictObject({ manifest: Sha.nullable(), lock: Sha.nullable() });
const Checks = z.array(z.enum(["tsc", "eslint", "e2e"]));
const Map0 = (v: z.ZodType) => z.record(z.string(), v);
const only = <T extends z.ZodType>(s: T, extra: (v: z.infer<T>) => boolean, message: string) => s.refine(extra, message);

/** Exact op and outcome key sets per producer (18.1). `?` fields are optional in the producer; success and failure variants differ. */
export const EFFECTS = {
  "index-sync": {
    op: z.strictObject({ work: Id, sync: IndexSyncRecord }),
    outcome: z.strictObject({ status: z.enum(["synced", "untouched", "not-needed"]) }),
  },
  commit: {
    op: z.strictObject({ work: Id, parent: Oid.nullable(), expectedTree: Oid, paths: z.array(Id), subject: z.string() }),
    outcome: only(z.strictObject({
      ...Done, reason: z.string().optional(), commit: Oid.nullable().optional(), tree: Oid.nullable().optional(),
        foreign: z.array(z.string()).optional(),
    }), o => o.completed ? o.reason === undefined : o.commit === undefined && o.tree === undefined && o.foreign === undefined,
      "variant mixes success and failure keys"),
  },
  integration: {
    op: z.strictObject({ work: Id, base: Id, baseBefore: Oid, workTip: Oid }),
    outcome: only(z.strictObject({ ...Done, commit: Oid.optional(), mode: z.enum(["fast-forward", "merge"]).optional() }),
      o => o.completed || (o.commit === undefined && o.mode === undefined), "a failed integration holds no commit"),
  },
  undo: {
    op: z.strictObject({
      work: Id, original: Id, tree: Oid, paths: z.array(Id), pre: Map0(Oid.nullable()), post: Map0(Oid.nullable()), patch: Sha,
        runDir: z.string().optional(),
    }),
    outcome: z.strictObject(Done),
  },
  scaffold: {
    op: z.strictObject({
      work: Id, recipe: z.strictObject({ id: Id, version: Id, checks: Checks.optional() }), expected: Map0(Sha),
        protect: z.array(z.string()),
    }),
    outcome: z.strictObject({ ...Done, files: z.number().int().nonnegative().optional() }),
  },
  adopt: {
    op: z.strictObject({
      work: Id, file: z.literal("INTENT.md"), before: Sha.nullable(), after: Sha, blocks: Map0(z.string()), at: Id,
        previousTrust: Sha.nullable().optional(),
    }),
    outcome: z.strictObject(Done),
  },
  dependency: {
    op: z.strictObject({ work: Id, phase: z.enum(["resolve", "install"]), manager: z.enum(["npm", "pnpm"]),
      before: Blobs.optional(), scripts: z.array(z.string()).optional() }),
    outcome: z.strictObject(Done),
  },
  branch: {
    op: z.strictObject({ work: Id, from: z.string().nullable(), to: Id }),
    outcome: only(z.strictObject({ ...Done, branch: z.string().optional() }), o => o.completed || o.branch === undefined,
      "a skipped branch names none"),
  },
  forget: { op: z.strictObject({ work: Id, lesson: Id }), outcome: z.strictObject(Done) },
  hardening: {
    op: only(z.strictObject({
      work: Id, file: z.literal("docs/hardening.md"), before: Sha.nullable(), after: Sha, block: Id, hash: Id, updatedAt: Id,
    }), o => o.block === `HARDENING-${o.work}`, "block is not the producer's identity for this work"),
    outcome: z.strictObject(Done),
  },
} as const;
export type EffectKind = keyof typeof EFFECTS;
export const EFFECT_KINDS = Object.keys(EFFECTS) as EffectKind[];

const stampT = { t: z.string().min(1) };
const Entry = z.discriminatedUnion("kind", [
  z.strictObject({ ...stampT, kind: z.literal("intent"), effect: z.string(), id: Id, op: z.unknown() }),
  z.strictObject({ ...stampT, kind: z.literal("result"), effect: z.string(), id: Id, outcome: z.unknown() }),
  z.strictObject({ ...stampT, kind: z.literal("call"), verb: z.string(), exit: z.number().int(), revision: z.number().int() }),
  AccountingCheckpoint,
]);

export interface Journal1 { entries: unknown[]; effects: Record<string, number>; blobs: string[]; runDirs: string[] }

/**
 * A complete schema-1 journal: exact outer keys, producer-exact effect payloads, one intent and one result per identity, no orphan, no
 * unresolved intent (source-kernel recovery, not migration, settles those), no torn tail. The bytes are not rewritten.
 */
export function decodeJournal1(text: string): Decoded<Journal1> {
  if (text.length && !text.endsWith("\n")) return refuse("log", "torn tail: repair under the source kernel first");
  const intents = new Map<string, unknown>(), results = new Set<string>();
  const out: Journal1 = { entries: [], effects: {}, blobs: [], runDirs: [] };
  const lines = text.split("\n").slice(0, -1);
  for (const [n, line] of lines.entries()) {
    const where = `log/${n + 1}`;
    let raw: unknown;
    try { raw = JSON.parse(line); } catch { return refuse(where, "not JSON"); }
    const e = strictParse(Entry, raw, where);
    if (!e.ok) return e;
    out.entries.push(raw);
    if (e.value.kind !== "intent" && e.value.kind !== "result") continue;
    const { effect, id } = e.value, key = JSON.stringify([effect, id]);
    if (!Object.hasOwn(EFFECTS, effect)) return refuse(where, `unknown effect ${effect}`);
    const spec = EFFECTS[effect as EffectKind];
    if (e.value.kind === "intent") {
      const op = strictParse(spec.op, e.value.op, `${where}/op`);
      if (!op.ok) return op;
      if (intents.has(key)) return refuse(where, `duplicate intent ${key}`);
      intents.set(key, op.value);
      out.effects[effect] = (out.effects[effect] ?? 0) + 1;
      collect(effect, op.value, out);
    } else {
      const r = strictParse(spec.outcome, e.value.outcome, `${where}/outcome`);
      if (!r.ok) return r;
      if (!intents.has(key)) return refuse(where, `orphan result ${key}`);
      if (results.has(key)) return refuse(where, `duplicate result ${key}`);
      results.add(key);
    }
  }
  for (const key of intents.keys()) if (!results.has(key)) return refuse("log", `unresolved intent ${key}`);
  out.blobs.sort(); out.runDirs.sort();
  return { ok: true, value: out };
}

function collect(effect: string, op: unknown, out: Journal1) {
  const o = op as { patch?: string; runDir?: string; before?: { manifest: string | null; lock: string | null } };
  if (effect === "undo") { out.blobs.push(o.patch!); if (o.runDir) out.runDirs.push(o.runDir); }
  if (effect === "dependency") for (const b of [o.before?.manifest, o.before?.lock]) if (b) out.blobs.push(b);
}
