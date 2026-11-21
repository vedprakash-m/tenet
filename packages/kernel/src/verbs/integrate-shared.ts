// GIT-09: when integration conflicts only in Tenet's shared files, or both branches created the same ID, Tenet merges those
// files by element ID from the merge base and both tips and proposes the result. The proposal is bound to both tips, the
// merge base, every proposed file and the chosen sides; it is applied only on the answer to exactly that proposal.
import { allowed } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import { BLOCK_FILES, isDecisionPath, notText, planShared, renamer } from "../core/shared-merge.ts";
import type { Collision, MergeSide, SharedPlan } from "../core/shared-merge.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports, Resolved } from "../ports/types.ts";
import { factsHash, nx, question } from "./common.ts";
import { settingsFor } from "./reconcile.ts";

const MAX_FILE = 256 * 1024;
const MAX_TOTAL = 1024 * 1024;
const MAX_FILES = 16;

export type Agreed = { facts?: string; sides?: Record<string, MergeSide> };
type Where = {
  st: State; w: WorkContract; base: string; baseTip: string; workTip: string; dirty: readonly string[]; conflicted: readonly string[];
};
export type SharedResolved = { resolved: Resolved; facts: string; hashes: Record<string, string | null> };
type Planned = Extract<SharedPlan, { ok: true }>;
/** What one proposal is computed from: the tips, the merge base, what each side changed, and the user's read limits. */
type Ctx = Where & { mb: string; onTarget: string[]; onWork: string[]; exclusions: Exclusion[] };

const refuse = (why: string) => new KernelError("integration-conflict", why, { exit: 3 });
const clip = (s: string | null) => (s === null ? null : s.length > 2048 ? `${s.slice(0, 2048)}…` : s);
const fileName = (p: string) => p.slice(p.lastIndexOf("/") + 1);

function readable(c: Ctx, p: string) {
  if (!allowed("read", p, c.exclusions, { kind: "routine-inventory" }))
    throw refuse(`${p} is excluded from Tenet's reads, so Tenet cannot merge it by ID`);
}
async function read(ports: Ports, tree: string, p: string): Promise<string | null> {
  const t = await ports.git.showAt(tree, p);
  if (t !== null && t.length > MAX_FILE) throw refuse(`${p} is larger than 256 KB`);
  return t;
}

/** The in-scope files at the merge base and both tips, merged by ID. */
async function planFor(ports: Ports, c: Ctx, sides: Record<string, MergeSide>): Promise<Planned> {
  const both = c.onTarget.filter((p) => c.onWork.includes(p));
  const blocks = BLOCK_FILES.filter((p) => both.includes(p) || c.conflicted.includes(p));
  const inScope = [...new Set([...blocks, ...[...c.onTarget, ...c.onWork].filter(isDecisionPath)])];
  for (const p of inScope) readable(c, p);
  const [base, ours, theirs] = await Promise.all([c.mb, c.baseTip, c.workTip].map(async (tree) => {
    const m = new Map<string, string>();
    for (const p of inScope) { const t = await read(ports, tree, p); if (t !== null) m.set(p, t); }
    return m;
  }));
  const plan = planShared({ base: base!, ours: ours!, theirs: theirs!, seed: c.workTip, sides });
  if (!plan.ok) throw refuse(plan.why);
  for (const id of Object.keys(sides))
    if (!plan.collisions.some((x) => x.kind === "content" && x.id === id))
      throw new KernelError("revision-conflict", `${id} is not a content collision in this proposal`, { exit: 1 });
  return plan;
}

/** Mentions of a renamed ID outside the merged files: rewritten where only the work branch changed the file, else refused. */
async function followRenames(ports: Ports, c: Ctx, plan: Planned) {
  if (!plan.renames.size) return;
  const r = renamer(plan.renames, plan.names);
  const ids = [...plan.renames.keys()];
  const cores = ids.map((id) => id.slice(id.indexOf("-") + 1));
  const workOnly = c.onWork.filter((p) => !c.onTarget.includes(p) && !plan.handled.has(p));
  const shared = c.onWork.filter((p) => c.onTarget.includes(p) && !plan.handled.has(p));
  for (const p of [...workOnly, ...shared]) readable(c, p);
  for (const tree of [c.baseTip, c.workTip]) {
    for (const p of await ports.git.grepAt(tree, cores, shared))
      if (r.mentions((await read(ports, tree, p)) ?? "")) throw refuse(`${p}, changed on both branches, mentions ${ids.join(", ")}`);
    for (const lock of c.st.locks) {
      const t = allowed("read", lock.path, c.exclusions, { kind: "routine-inventory" })
        ? await read(ports, tree, lock.path)
        : null;
      if (t && r.mentions(t)) throw refuse(`${lock.path} is a locked acceptance test that mentions ${ids.join(", ")}`);
    }
  }
  for (const p of await ports.git.grepAt(c.workTip, cores, workOnly)) {
    const t = (await read(ports, c.workTip, p)) ?? "";
    if (notText(t)) throw refuse(`${p} mentions ${ids.join(", ")} and is not UTF-8 text`);
    if (r.mentions(t)) plan.files.set(p, r.apply(t));
  }
}

/** Limits, policy and uncommitted edits on every file the merge would write. */
function checkOutputs(c: Ctx, plan: Planned) {
  const total = [...plan.files.values()].reduce((n, t) => n + (t?.length ?? 0), 0);
  if (plan.files.size > MAX_FILES || total > MAX_TOTAL) throw refuse(`the proposal is over ${MAX_FILES} files or 1 MB`);
  const missing = c.conflicted.find((p) => !plan.files.has(p));
  if (missing) throw refuse(`Tenet has no merged text for ${missing}`);
  for (const p of plan.files.keys()) {
    if (!allowed("edit", p, c.exclusions) || !allowed("model-send", p, c.exclusions))
      throw refuse(`${p} is excluded from Tenet's edits or from the model`);
    if (c.dirty.includes(p)) throw refuse(`${p} has uncommitted edits that the merged file would replace`);
  }
}

/** The proposal for these tips, null when there is nothing to propose (no conflict and no duplicate ID). */
async function propose(ports: Ports, at: Where, sides: Record<string, MergeSide>) {
  const mb = await ports.git.mergeBase(at.baseTip, at.workTip);
  if (!mb) {
    if (at.conflicted.length) throw refuse("the branches have no merge base, so Tenet cannot merge its shared files by ID");
    return null;
  }
  const [onTarget, onWork] = await Promise.all([ports.git.changedSince(mb, at.baseTip), ports.git.changedSince(mb, at.workTip)]);
  // Without a Git conflict, only a block file both changed or decisions added on both sides can hide a duplicate ID.
  const blockOnBoth = BLOCK_FILES.some((p) => onTarget.includes(p) && onWork.includes(p));
  if (!at.conflicted.length && !blockOnBoth && !(onTarget.some(isDecisionPath) && onWork.some(isDecisionPath))) return null;
  const c: Ctx = { ...at, mb, onTarget, onWork, exclusions: settingsFor(ports, at.st, at.w).exclusions as Exclusion[] };
  const plan = await planFor(ports, c, sides);
  // Git's own merge holds every change it combined; without a conflict only a duplicate ID needs the user.
  if (!at.conflicted.length && !plan.collisions.some((x) => x.kind === "duplicate")) return null;
  await followRenames(ports, c, plan);
  checkOutputs(c, plan);
  const sorted = [...plan.files].sort(([a], [b]) => a.localeCompare(b));
  const hashes = Object.fromEntries(sorted.map(([p, t]) => [p, t === null ? null : sha256(t)]));
  return { plan, hashes, facts: factsHash({ baseTip: at.baseTip, workTip: at.workTip, mb, files: hashes, sides }) };
}

function mergeQuestion(base: string, conflicted: readonly string[], facts: string, paths: string[], collisions: Collision[]): Question {
  const content = collisions.filter((c) => c.kind === "content"), dups = collisions.filter((c) => c.kind === "duplicate");
  const n = collisions.length, files = `${paths.length} file${paths.length > 1 ? "s" : ""}`;
  const ids = [...new Set(dups.map((c) => c.id))];
  const lead = conflicted.length
    ? `Integrating into ${base} conflicts only in Tenet's shared files (${conflicted.join(", ")}). Tenet merged them by ID`
      + `${n ? ` and found ${n} ID collision${n > 1 ? "s" : ""}` : ""}; the proposed ${files} are shown.`
    : `Integrating into ${base} merges cleanly in Git, but ${ids.join(", ")} ${ids.length > 1 ? "were" : "was"} created on both `
      + `branches. Tenet proposes renaming the work branch's copy in ${files}; they are shown.`;
  const side = content.every((c) => c.side === "target") ? "target" : "work";
  const keep = content.length
    ? ` For ${content.map((c) => c.id).join(", ")}, the proposal uses the ${side} branch's text;`
      + " the other branch's change is dropped unless you choose it instead."
    : "";
  return question({
    id: "shared-merge",
    header: "Shared files",
    bind: { factsHash: facts },
    question: `${lead}${keep} Use them in the merge?`,
    options: [
      { label: "Use the merged files", description: "Integrate now; the merge commit holds exactly the files shown.",
        ...(content.length ? {} : { recommended: true }) },
      { label: "Not now", description: "Nothing moves; resolve the files on the work branch yourself and integrate again." },
    ],
  });
}

/** The proposal's files for the coordinator to show: saved in a run folder, by path, hash and where it came from. */
function shownFiles(ports: Ports, facts: string, plan: Planned, hashes: Record<string, string | null>) {
  const dir = ports.store.tempDir(`shared-${facts}`);
  const from = new Map(plan.collisions.filter((c) => c.renamedTo && isDecisionPath(c.path))
    .map((c) => [c.path.replace(c.id, c.renamedTo!), c.path]));
  return [...plan.files].map(([path, text], i) => text === null
    ? { path, delete: true }
    : { path, sha256: hashes[path], file: ports.store.writeArtifact(dir, `${i}-${fileName(path)}`, text),
        ...(from.has(path) ? { renamedFrom: from.get(path) } : {}) });
}

/** The question with the current proposal, the confirmed files to merge with, or null when there is nothing to propose. */
export async function sharedMerge(ports: Ports, at: Where, agreed: Agreed = {}): Promise<Plan | SharedResolved | null> {
  const p = await propose(ports, at, agreed.sides ?? {});
  if (!p) return null;
  const { plan, facts, hashes } = p;
  if (agreed.facts === facts)
    return { resolved: { files: Object.fromEntries(plan.files), conflicted: [...at.conflicted] }, facts, hashes };
  const q = mergeQuestion(at.base, at.conflicted, facts, [...plan.files.keys()], plan.collisions);
  const collisions = plan.collisions.map((c) =>
    ({ ...c, base: clip(c.base), ours: clip(c.ours), theirs: clip(c.theirs), proposed: clip(c.proposed) }));
  const listed = plan.collisions.map((c) => `${c.kind} ${c.id}${c.renamedTo ? ` -> ${c.renamedTo}` : ""}`).join(", ");
  return {
    state: { ...at.st, pending: [...at.st.pending.filter((x) => x.id !== q.id), q] },
    resp: {
      work: at.w.id,
      exit: 3,
      questions: [q],
      reasons: [reason("shared-merge-proposed", `${[...plan.files.keys()].join(", ")}: ${listed || "no ID collisions"}`)],
      data: { proposal: { files: shownFiles(ports, facts, plan, hashes), collisions } },
      next: [nx("ask", "Show the user the proposed files (read each `file`) and the collisions, then ask. To keep the target "
        + "branch's text for a content collision, answer `revise` with {\"<ID>\": \"target\"}; `apply` repeats those answers.", true)],
    },
  };
}
