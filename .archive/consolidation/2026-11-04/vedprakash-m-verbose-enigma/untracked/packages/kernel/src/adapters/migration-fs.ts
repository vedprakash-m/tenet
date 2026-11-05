// The 1 -> 2 file protocol (schema-migration 16.3 to 16.6, 18.2, 18.3): a durable descriptor as the old-writer fence, independent byte
// copies,
// staged targets, installation previous -> primary -> marker with each replacement fsynced, and recovery by recorded hashes alone.
// CANDIDATE: it works on a `.tenet` directory with portable fs calls and is not yet called by FsStore, its lock or its admission, so no
// ordinary
// writer forfeits rollback and nothing reserves storage. `hooks.at` is the seam real-process tests kill at; it adds no behavior.
import { isUtf8 } from "node:buffer";
import { constants } from "node:fs";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync,
  rmdirSync, statSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { hashOf, sha256 } from "../core/ids.ts";
import { consent, Descriptor, Terminal, matchTerminal, migrationBlockers, nextStep, pristineProblems,
  previewFacts } from "../core/schemas-migrate.ts";
import type { Observed, Part, Plan } from "../core/schemas-migrate.ts";
import { decodeJournal1, decodeState1, decodeState2, stateReferences } from "../core/schemas-legacy.ts";
import type { Refusal } from "../core/schemas-legacy.ts";
import { convertSet } from "../core/schemas-upcast.ts";
import type { UpcastContext } from "../core/schemas-upcast.ts";
import type { State } from "../core/schemas.ts";

export interface Hooks { at?: (step: string) => void }
export interface Builds { bridge: string; target: string; design: string }
const NAMES: Record<Part, string> = { previous: "state.prev", primary: "state", marker: "marker" };
const PARTS: Part[] = ["previous", "primary", "marker"];
const DESCRIPTOR = "migration-transition.json", TERMINAL = "migration-terminal.json";
const Marker = z.strictObject({ workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/), tag: z.string().regex(/^[a-z0-9]{4}$/),
  nonce: z.string().min(1), schema: z.union([z.literal(1), z.literal(2)]), dev: z.number().finite().nonnegative(),
  ino: z.number().finite().nonnegative() });
const refuse = (where: string, detail: string): Refusal => ({ ok: false, reason: "unsupported-record", where, detail });

// ---------------------------------------------------------------- durable primitives

function readText(path: string): string | null {
  try {
    if (!lstatSync(path).isFile()) throw new Error(`${path} is not a regular file`);
    const bytes = readFileSync(path);
    if (!isUtf8(bytes)) throw new Error(`${path} is not UTF-8`);
    return bytes.toString("utf8");
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}
function verifyRoot(dir: string): void {
  if (!lstatSync(dir).isDirectory()) throw new Error("migration store is not a real directory");
}
const digest = (t: string | null): string | null => (t === null ? null : sha256(t));

function syncDir(dir: string) {
  if (process.platform === "win32") return; // a directory cannot be opened for fsync here: unobserved, not claimed
  const fd = openSync(dir, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeFileNewSynced(path: string, data: string) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
}
/** Private exclusive staging, file fsync, rename, parent-directory fsync. */
function replace(dir: string, rel: string, data: string, hooks: Hooks) {
  const tmp = join(dir, `${rel.replaceAll("/", "_")}.mig.tmp`);
  const staged = readText(tmp);
  if (staged !== null && staged !== data) unlinkSync(tmp);
  if (staged !== data) writeFileNewSynced(tmp, data);
  hooks.at?.(`before-rename:${rel}`);
  renameSync(tmp, join(dir, rel));
  syncDir(join(dir, rel, ".."));
  hooks.at?.(`after-rename:${rel}`);
}
function unlink(dir: string, rel: string, hooks: Hooks) {
  hooks.at?.(`before-unlink:${rel}`);
  rmSync(join(dir, rel), { force: true });
  syncDir(dir);
  hooks.at?.(`after-unlink:${rel}`);
}

const observe = (dir: string): Observed => ({
  previous: digest(readText(join(dir, "state.prev"))), primary: digest(readText(join(dir, "state"))),
    marker: digest(readText(join(dir, "marker"))),
  log: digest(readText(join(dir, "log"))), summaries: digest(readText(join(dir, "summaries.json"))),
});
function ownedMarker(dir: string, text: string): z.infer<typeof Marker> | null {
  const parsed = Marker.safeParse(JSON.parse(text));
  if (!parsed.success) return null;
  const root = statSync(dir);
  return parsed.data.dev === root.dev && parsed.data.ino === root.ino ? parsed.data : null;
}
function ensureDirectory(path: string): void {
  try {
    if (!lstatSync(path).isDirectory()) throw new Error(`${path} is not a directory`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    mkdirSync(path, { mode: 0o700 });
  }
}
function verifyDirectory(path: string): void {
  if (!lstatSync(path).isDirectory()) throw new Error(`${path} is not a directory`);
}
const setDescriptor = (dir: string, d: Descriptor, hooks: Hooks) =>
  replace(dir, DESCRIPTOR, `${JSON.stringify(Descriptor.parse(d))}\n`, hooks);
function loadDescriptor(dir: string): Descriptor | Refusal | null {
  try {
    const text = readText(join(dir, DESCRIPTOR));
    if (text === null) return null;
    const p = Descriptor.safeParse(JSON.parse(text));
    return p.success ? p.data : refuse(DESCRIPTOR, p.error.issues[0]?.message ?? "invalid");
  } catch (e) { return refuse(DESCRIPTOR, e instanceof Error ? e.message : "not JSON"); }
}

// ---------------------------------------------------------------- preview (reads only; creates no file)

export interface Sources {
  marker: string; primary: string; previous: string | null; log: string | null; summaries: string | null; state: State;
}
export type Preview =
  | { ok: true; factsHash: string; blockers: string[]; sources: Sources; revisions: { primary: number; previous: number | null } }
  | Refusal;

export function previewUpgrade(dir: string, builds: Builds, registryVersion: string): Preview {
  try {
    verifyRoot(dir);
    if (loadDescriptor(dir) !== null) return refuse(DESCRIPTOR, "a migration is already recorded here");
    const read = (n: string) => readText(join(dir, n));
    const marker = read("marker"), primary = read("state"), previous = read("state.prev"), log = read("log"),
      summaries = read("summaries.json");
    if (marker === null || primary === null) return refuse("state", "no owned primary state to upgrade");
    if (!ownedMarker(dir, marker) || JSON.parse(marker).schema !== 1) {
      return refuse("marker", "marker is invalid, unowned, or not schema 1");
    }
    const own = decodeState1(JSON.parse(primary)), prev = previous === null ? null : decodeState1(JSON.parse(previous));
    if (!own.ok) return own;
    if (prev && !prev.ok) return prev;
    const journal = decodeJournal1(log ?? "");
    if (!journal.ok) return journal;
    const refs = stateReferences(own.value);
    const previousRefs = prev?.ok ? stateReferences(prev.value) : { blobs: [], runDirs: [], manifests: [] };
    const references = { blobs: [...new Set([...refs.blobs, ...journal.value.blobs,
      ...previousRefs.blobs])], runDirs: [...new Set([...refs.runDirs, ...previousRefs.runDirs, ...journal.value.runDirs])],
        manifests: [...new Set([...refs.manifests, ...previousRefs.manifests])] };
    if (references.blobs.length || references.runDirs.length || references.manifests.length) {
      return refuse("references", "referenced blobs, runs, or manifests cannot be preserved by this candidate");
    }
    const { factsHash } = previewFacts({ marker, primary, previous, log, summaries, references, ...builds, registryVersion });
    return {
      ok: true, factsHash, blockers: migrationBlockers(own.value), sources: { marker, primary, previous, log, summaries, state: own.value },
      revisions: { primary: own.value.revision, previous: prev?.ok ? prev.value.revision : null },
    };
  } catch (e) { return refuse("migration", e instanceof Error ? e.message : "invalid source data"); }
}

// ---------------------------------------------------------------- upgrade

export interface UpgradeInput {
  dir: string; id: string; builds: Builds; ctx: UpcastContext; answer: { answer?: string; factsHash?: string }; quote?: string;
}
export type Outcome =
  | { ok: true; phase: Descriptor["phase"] }
  | Refusal
  | { ok: false; reason: "declined" | "stale" | "missing" | "blocked"; detail?: string };

function targetTexts(sources: { primary: string; previous: string | null; marker: string },
  ctx: UpcastContext): { texts: Record<Part, string | null> } | Refusal {
  const set = convertSet({ primary: JSON.parse(sources.primary),
    previous: sources.previous === null ? null : JSON.parse(sources.previous) }, ctx);
  if (!set.ok) return set;
  const marker = { ...JSON.parse(sources.marker), schema: 2 };
  return { texts: { primary: JSON.stringify(set.value.primary),
    previous: set.value.previous ? JSON.stringify(set.value.previous) : null, marker: JSON.stringify(marker) } };
}

export function acceptUpgrade(i: UpgradeInput, hooks: Hooks = {}): Outcome {
  const p = previewUpgrade(i.dir, i.builds, i.ctx.registryVersion);
  if (!p.ok) return p;
  const c = consent(p.factsHash, i.answer);
  if (c !== "accepted") return { ok: false, reason: c };
  if (p.blockers.length) return { ok: false, reason: "blocked", detail: p.blockers.join("; ") };
  const t = targetTexts(p.sources, i.ctx);
  if (!("texts" in t)) return t;
  const s = p.sources, obs = observe(i.dir);
  const marker = JSON.parse(s.marker) as { workspaceId: string; nonce: string };
  const plan: Plan = {
    previous: { from: obs.previous, to: digest(t.texts.previous) }, primary: { from: obs.primary, to: digest(t.texts.primary) },
    marker: { from: obs.marker, to: digest(t.texts.marker) }, log: obs.log, summaries: obs.summaries,
  };
  const d: Descriptor = {
    protocolVersion: 1, direction: "upgrade", id: i.id, upgradeId: i.id, phase: "fenced", owner: { workspaceId: marker.workspaceId,
      nonce: marker.nonce },
    factsHash: p.factsHash, bridge: i.builds.bridge, target: i.builds.target, ...(i.quote ? { quote: i.quote } : {}), plan,
      rollbackEligible: true,
  };
  setDescriptor(i.dir, d, hooks);
  hooks.at?.("fenced");
  return resume(i.dir, i.ctx, hooks);
}

const setName = (id: string) => `migration-1-2-${id}`;
function backup(dir: string, d: Descriptor, hooks: Hooks) {
  const home = join(dir, setName(d.upgradeId));
  ensureDirectory(home);
  ensureDirectory(join(home, "target"));
  for (const [n, h] of [["marker", d.plan.marker.from], ["state", d.plan.primary.from], ["state.prev", d.plan.previous.from],
    ["log", d.plan.log], ["summaries.json", d.plan.summaries]] as const) {
    if (h === null) continue;
    const text = readText(join(dir, n)) ?? readText(join(home, n));
    if (text === null || sha256(text) !== h) throw new Error(`source ${n} changed`);
    const target = join(home, n), existing = readText(target);
    if (existing !== null && existing !== text) throw new Error(`backup ${n} already exists with different bytes`);
    if (existing === null) writeFileNewSynced(target, text);
    hooks.at?.(`backup:${n}`);
  }
  syncDir(home);
  hooks.at?.("backup-sealed");
}
const fromBackup = (dir: string, d: Descriptor, n: string, hash: string | null): string | null => {
  if (hash === null) return null;
  const text = readText(join(dir, setName(d.upgradeId), n));
  if (text === null || sha256(text) !== hash) throw new Error(`backup ${n} is missing or changed`);
  return text;
};

function stage(dir: string, d: Descriptor, ctx: UpcastContext, hooks: Hooks) {
  const src = { marker: fromBackup(dir, d, "marker", d.plan.marker.from)!, primary: fromBackup(dir, d, "state",
    d.plan.primary.from)!, previous: fromBackup(dir, d, "state.prev", d.plan.previous.from) };
  const t = targetTexts(src, ctx);
  if (!("texts" in t)) throw new Error(t.detail);
  const home = join(dir, setName(d.upgradeId), "target");
  ensureDirectory(join(dir, setName(d.upgradeId)));
  ensureDirectory(home);
  for (const part of PARTS) {
    const text = t.texts[part];
    if (digest(text) !== d.plan[part].to) throw new Error(`target ${part} differs from the recorded plan`);
    if (text !== null) {
      const path = join(home, NAMES[part]), existing = readText(path);
      if (existing !== null && existing !== text) throw new Error(`staged ${NAMES[part]} already exists with different bytes`);
      if (existing === null) writeFileNewSynced(path, text);
      hooks.at?.(`stage:${part}`);
    }
  }
  syncDir(home);
}

function install(dir: string, d: Descriptor, hooks: Hooks) {
  const target = d.direction === "upgrade";
  for (;;) {
    const step = nextStep(d.plan, observe(dir), d.direction);
    if (!step.ok) throw new Error(step.detail);
    if (step.step === "done") return;
    const want = target ? d.plan[step.step].to : d.plan[step.step].from;
    const text = want === null ? null : target
      ? readText(join(dir, setName(d.upgradeId), "target", NAMES[step.step]))
      : readText(join(dir, setName(d.upgradeId), NAMES[step.step]));
    if (want !== null && (text === null || sha256(text) !== want)) throw new Error(`${step.step} to install is missing or changed`);
    if (text === null) unlink(dir, NAMES[step.step], hooks); else replace(dir, NAMES[step.step], text, hooks);
  }
}

const terminalOf = (d: Descriptor, outcome: "upgraded" | "rolled-back") => ({
  operationId: d.id, protocolVersion: 1 as const, versions: outcome === "upgraded" ? { from: 1 as const,
    to: 2 as const } : { from: 2 as const, to: 1 as const },
  outcome, bindingDigest: d.factsHash,
});

/**
 * Completes whatever the descriptor and the recorded hashes admit, idempotently. A tuple outside the recorded prefixes refuses without
 * writing.
 */
export function resume(dir: string, ctx: UpcastContext, hooks: Hooks = {}): Outcome {
  const loaded = loadDescriptor(dir);
  if (loaded === null) {
    try {
      const done = readText(join(dir, TERMINAL));
      return done !== null && Terminal.safeParse(JSON.parse(done)).data?.outcome === "rolled-back" ? { ok: true,
        phase: "rolled-back" } : refuse(DESCRIPTOR, "no migration is in progress");
    } catch (e) { return refuse(TERMINAL, e instanceof Error ? e.message : "invalid terminal record"); }
  }
  if ("ok" in loaded) return loaded;
  let d: Descriptor = loaded;
  try {
    verifyRoot(dir);
    const marker = readText(join(dir, "marker"));
    const owner = marker === null ? null : ownedMarker(dir, marker);
    if (!owner || owner.workspaceId !== d.owner.workspaceId || owner.nonce !== d.owner.nonce) {
      return refuse(DESCRIPTOR, "descriptor does not belong to this live store");
    }
    if (d.phase === "applied" || d.phase === "rolled-back") return { ok: true, phase: d.phase };
    const pre = nextStep(d.plan, observe(dir), d.direction);
    if (!pre.ok) return pre;
    if (d.phase === "fenced") { if (d.direction === "upgrade") backup(dir, d, hooks); d = { ...d,
      phase: "backed-up" }; setDescriptor(dir, d, hooks); hooks.at?.("backed-up"); }
    if (d.phase === "backed-up") { if (d.direction === "upgrade") stage(dir, d, ctx, hooks); d = { ...d,
      phase: "prepared" }; setDescriptor(dir, d, hooks); hooks.at?.("prepared"); }
    install(dir, d, hooks);
    return finish(dir, d, hooks);
  } catch (e) { return refuse("migration", e instanceof Error ? e.message : "failed"); }
}

function finish(dir: string, d: Descriptor, hooks: Hooks): Outcome {
  if (d.direction === "upgrade") {
    setDescriptor(dir, { ...d, phase: "applied", terminal: terminalOf(d, "upgraded") }, hooks);
    hooks.at?.("applied");
    return { ok: true, phase: "applied" };
  }
  const migrationHome = join(dir, setName(d.upgradeId));
  const home = join(dir, setName(d.upgradeId), "target");
  verifyDirectory(migrationHome);
  let targetExists = true;
  try { verifyDirectory(home); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") targetExists = false;
    else throw e;
  }
  if (targetExists) {
    const entries = readdirSync(home, { withFileTypes: true });
    const expected = PARTS.filter((p) => d.plan[p].to !== null).map((p) => NAMES[p]);
    if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink() || !expected.includes(entry.name))) {
      throw new Error("the staged target contains unexpected entries; not deleted");
    }
    for (const part of PARTS) {
      const path = join(home, NAMES[part]), text = readText(path);
      if (text !== null && sha256(text) !== d.plan[part].to) throw new Error(`upgrade-created ${NAMES[part]} changed; not deleted`);
    }
    for (const part of PARTS) {
      const path = join(home, NAMES[part]);
      try { unlinkSync(path); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
    rmdirSync(home);
  }
  syncDir(migrationHome);
  replace(dir, TERMINAL, `${JSON.stringify(terminalOf(d, "rolled-back"))}\n`, hooks);
  unlink(dir, DESCRIPTOR, hooks);
  hooks.at?.("rolled-back");
  return { ok: true, phase: "rolled-back" };
}

// ---------------------------------------------------------------- rollback

export type RollbackPreview = { eligible: true; factsHash: string } | { eligible: false; reasons: string[] };
export function previewRollback(dir: string): RollbackPreview {
  try {
    verifyRoot(dir);
    const d = loadDescriptor(dir);
    if (!d || "ok" in d) return { eligible: false, reasons: ["no applied upgrade is recorded"] };
    const reasons: string[] = [];
    if (d.direction !== "upgrade" || d.phase !== "applied") reasons.push("the upgrade is not in its applied phase");
    if (!d.rollbackEligible) reasons.push("a later action forfeited rollback");
    const obs = observe(dir);
    if (PARTS.some((p) => obs[p] !== d.plan[p].to) || obs.log !== d.plan.log || obs.summaries !== d.plan.summaries) {
      reasons.push("live files do not match the applied manifest");
    }
    const primary = readText(join(dir, "state"));
    const live = primary === null ? null : decodeState2(JSON.parse(primary));
    if (!live?.ok) reasons.push("the live primary is not valid schema 2");
    else reasons.push(...pristineProblems(live.value, ""));
    try { for (const [n, h] of [["marker", d.plan.marker.from], ["state", d.plan.primary.from], ["state.prev",
      d.plan.previous.from]] as const) fromBackup(dir, d, n, h); }
    catch (e) { reasons.push(e instanceof Error ? e.message : "the source copy is not intact"); }
    try {
      const migrationHome = join(dir, setName(d.upgradeId));
      const home = join(dir, setName(d.upgradeId), "target");
      verifyDirectory(migrationHome);
      verifyDirectory(home);
      const names = readdirSync(home, { withFileTypes: true });
      const expected = PARTS.filter((p) => d.plan[p].to !== null).map((p) => NAMES[p]).sort();
      if (names.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
        names.map((entry) => entry.name).sort().join("\0") !== expected.join("\0")) {
        reasons.push("the staged target contains unexpected entries");
      } else for (const part of PARTS) {
        const name = NAMES[part], hash = d.plan[part].to;
        if (hash !== null && digest(readText(join(home, name))) !== hash) reasons.push(`staged target ${name} is missing or changed`);
      }
    } catch (e) { reasons.push(e instanceof Error ? e.message : "the staged target is not intact"); }
    return reasons.length ? { eligible: false, reasons } : { eligible: true, factsHash: hashOf({ rollback: d.id, live: obs }) };
  } catch (e) { return { eligible: false, reasons: [e instanceof Error ? e.message : "the migration record is invalid"] }; }
}

export function acceptRollback(i: { dir: string; id: string; ctx: UpcastContext; answer: { answer?: string; factsHash?: string } },
  hooks: Hooks = {}): Outcome {
  const p = previewRollback(i.dir);
  if (!p.eligible) return refuse("rollback", p.reasons.join("; "));
  const c = consent(p.factsHash, i.answer);
  if (c !== "accepted") return { ok: false, reason: c };
  const d = loadDescriptor(i.dir) as Descriptor;
  setDescriptor(i.dir, { ...d, direction: "rollback", id: i.id, phase: "fenced", factsHash: p.factsHash, terminal: undefined }, hooks);
  hooks.at?.("rollback-fenced");
  return resume(i.dir, i.ctx, hooks);
}

/** Called before any ordinary writer acts (16.6). A crash may forfeit conservatively; it never hides an action. */
export function forfeitRollback(dir: string, hooks: Hooks = {}): void {
  const d = loadDescriptor(dir);
  if (d && !("ok" in d) && d.phase === "applied" && d.rollbackEligible) setDescriptor(dir, { ...d, rollbackEligible: false }, hooks);
}

/** A historical terminal fact, recognized only on an exact match (18.3). */
export function terminalMatches(dir: string, asked: Parameters<typeof matchTerminal>[1]): boolean {
  try {
    const text = readText(join(dir, TERMINAL));
    const stored = text === null ? null : Terminal.safeParse(JSON.parse(text));
    return !!stored?.success && matchTerminal(stored.data, asked);
  } catch { return false; }
}
