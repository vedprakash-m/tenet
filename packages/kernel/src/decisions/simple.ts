// The small decision kinds: each is a few lines over one record. Kept together; split a kind out when it grows.
import { CATALOG, isSettingKey, validateSetting } from "../core/config.ts";
import type { Scope } from "../core/config.ts";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import type { BasisElement, Finding } from "../core/schemas.ts";
import { undecidedDirty } from "../verbs/dirty.ts";
import { factsHash, nx, withWork } from "../verbs/common.ts";
import { gather } from "../verbs/facts.ts";
import { integrationSetting, startIntegrate, switchFacts } from "../verbs/integrate.ts";
import type { Decision } from "./types.ts";

/** Answers the dirty-overlap question: the question's facts must still be the current facts. */
export const dirtyOverlap: Decision = {
  kind: "dirty-overlap",
  run({ state, work, input }) {
    const q = state.pending.find((p) => p.id === "dirty-overlap");
    const paths = undecidedDirty(work);
    const answer = input.answers?.["dirty-overlap"];
    if (!q || !paths.length) throw new KernelError("revision-conflict", "there is no open question about your edits", { exit: 2 });
    if (answer !== "keep-out" && answer !== "include") throw new KernelError("revision-conflict", 'answer "keep-out" or "include"', { exit: 1 });
    const w = { ...work, ...(answer === "include" ? { includeDirty: [...work.includeDirty, ...paths] } : { keepOut: [...work.keepOut, ...paths] }) };
    const rest = state.pending.filter((p) => p.id !== "dirty-overlap");
    return { state: withWork({ ...state, pending: rest }, w), resp: { work: w.id, next: [nx(w.basis ? "check" : "basis", "Continue.", true)], data: { decided: paths, answer } } };
  },
};

const ACCEPT = ["accepted", "rejected", "accepted-with-residual-risk"] as const;
/** Owner acceptance is recorded as what it is and never removes a blocking reason (EVD-06). */
export const acceptance: Decision = {
  kind: "acceptance",
  async run({ ports, tx, state, work, input }) {
    const v = input.target;
    if (!ACCEPT.includes(v as (typeof ACCEPT)[number])) throw new KernelError("revision-conflict", `target must be one of ${ACCEPT.join(", ")}`, { exit: 1 });
    const w = { ...work, acceptance: v as (typeof ACCEPT)[number] };
    // Under `auto-on-accept` the result already said accepting also integrates; accepting is the consent (UX A12).
    if (v !== "rejected" && integrationSetting(state) === "auto-on-accept" && w.git.commits.length && w.git.branch && w.git.start.branch && w.git.branch !== w.git.start.branch && !w.git.integrated) return startIntegrate(ports, tx, withWork(state, w), w);
    return { state: withWork(state, w), resp: { work: w.id, next: [nx("finish", "Acceptance is recorded; it does not change the checks.")], data: { acceptance: v } } };
  },
};

const FINDING_USER = ["deferred", "risk-accepted", "wont-fix"] as const;
/** The user's disposition of an attention item, a finding or an assumption. */
export const disposition: Decision = {
  kind: "disposition",
  async run({ state, work, input, ports }) {
    const id = input.target ?? "";
    const body = (input.propose ?? {}) as { outcome?: string; reason?: string };
    const why = (body.reason ?? "").trim();
    if (!why) throw new KernelError("revision-conflict", "a disposition needs a reason", { exit: 1 });
    const now = ports.clock.now();

    // A locked acceptance test the user confirms may change: the lock moves to what the file is now, and so does the
    // record of the red it was verified against (INT-06). The reason is the user's, on the record.
    const lock = state.locks.find((l) => l.path === id || id in l.supportInputs);
    if (lock) {
      const blob = (await gather(ports, work)).inv.entries.get(id)?.blob;
      if (!blob) throw new KernelError("revision-conflict", `${id} no longer exists; a deleted locked test needs a basis change`, { exit: 2 });
      const locks = state.locks.map((l) => (l.path === id ? { ...l, hash: blob } : id in l.supportInputs ? { ...l, supportInputs: { ...l.supportInputs, [id]: blob } } : l));
      const w = { ...work, obligations: work.obligations.map((o) => (o.testFile === id ? { ...o, baselineTestHash: blob } : o)) };
      return { state: withWork({ ...state, locks }, w), resp: { work: w.id, next: [nx("check", "Check again; the locked test is dispositioned.")] } };
    }
    const att = work.attention.find((a) => a.id === id);
    if (att) {
      const outcome = body.outcome === "finding" ? "finding" as const : "accepted" as const;
      const w = { ...work, attention: work.attention.map((a) => (a.id === id ? { ...a, disposition: { by: "user" as const, outcome, reason: why } } : a)) };
      return { state: withWork(state, w), resp: { work: w.id, next: [nx("check", "Re-check; the item is dispositioned.")] } };
    }
    const f = work.findings.find((x) => x.id === id);
    if (f) {
      if (f.severity === "blocker") throw new KernelError("blocker-open", "a blocker is closed by a fix or by changing the basis, not by a disposition", { exit: 2 });
      const to = body.outcome as Finding["state"];
      if (!FINDING_USER.includes(to as (typeof FINDING_USER)[number])) throw new KernelError("revision-conflict", `outcome must be one of ${FINDING_USER.join(", ")}`, { exit: 1 });
      const w = { ...work, findings: work.findings.map((x) => (x.id === id ? { ...x, state: to, history: [...x.history, { to, by: "user" as const, reason: why, at: now }] } : x)) };
      return { state: withWork(state, w), resp: { work: w.id, next: [nx("finish", "The finding is dispositioned.")] } };
    }
    const el = state.project.intent.elements.find((e) => e.id === id && work.basis?.elementIds.includes(e.id));
    if (el) {
      const upd: BasisElement = { ...el, verifiedBy: { notApplicable: why } };
      const intent = { ...state.project.intent, revision: state.project.intent.revision + 1, elements: state.project.intent.elements.map((e) => (e.id === id ? upd : e)) };
      return { state: withWork({ ...state, project: { ...state.project, intent } }, work), resp: { work: work.id, reasons: [reason("assumption-unresolved", id, { note: true })], next: [nx("finish", "The element is dispositioned.")] } };
    }
    throw new KernelError("revision-conflict", `nothing called ${id} in this contract`, { exit: 1 });
  },
};

/** `repair-lock` runs its work before the lock (verb.preLock); inside the pipeline it only reports. */
export const repairLock: Decision = {
  kind: "repair-lock",
  run: ({ work }) => ({ resp: { work: work.id, next: [nx("check", "The lock was repaired; continue.")] } }),
};

/** Who owns changes the kernel cannot explain: either way they are recorded, never silently attributed. */
export const unexplained: Decision = {
  kind: "unexplained",
  async run({ ports, state, work, input }) {
    const answer = input.answers?.["unexplained"];
    const q = state.pending.find((p) => p.id === "unexplained");
    if (!q) throw new KernelError("revision-conflict", "there is no open question about unexplained changes", { exit: 2 });
    if (answer !== "mine" && answer !== "not-mine") throw new KernelError("revision-conflict", 'answer "mine" or "not-mine"', { exit: 1 });
    const facts = await gather(ports, work);
    const paths = facts.att.unexplained;
    if (factsHash([...paths].sort()) !== q.bind.factsHash) throw new KernelError("revision-conflict", "the files changed since the question was asked", { exit: 2 });
    const w = answer === "mine" ? { ...work, touched: [...work.touched, ...paths.map((path) => ({ path }))] } : { ...work, keepOut: [...work.keepOut, ...paths] };
    return { state: withWork({ ...state, pending: state.pending.filter((p) => p.id !== "unexplained") }, w), resp: { work: w.id, next: [nx("check", answer === "mine" ? "Check again so the new files are covered." : "Continue.", answer === "mine")] } };
  },
};

/** Consent to carry uncommitted edits across the branch switch an integration makes, bound to the files and branch shown. */
export const branchSwitch: Decision = {
  kind: "branch-switch",
  async run({ ports, state, work, input }) {
    const q = state.pending.find((p) => p.id === "branch-switch");
    const answer = input.answers?.["branch-switch"];
    if (!q) throw new KernelError("revision-conflict", "there is no open question about switching branches", { exit: 2 });
    if (answer !== "continue" && answer !== "cancel") throw new KernelError("revision-conflict", 'answer "continue" or "cancel"', { exit: 1 });
    const rest = state.pending.filter((p) => p.id !== "branch-switch");
    if (answer === "cancel") return { state: withWork({ ...state, pending: rest }, work), resp: { work: work.id, next: [] } };
    const dirty = (await gather(ports, work, state.locks)).inv.status.map((s) => s.path);
    const base = work.git.start.branch ?? "";
    if (switchFacts(base, dirty) !== q.bind.factsHash) throw new KernelError("revision-conflict", "your uncommitted files changed since the question was asked", { exit: 2 });
    return { state: withWork({ ...state, pending: rest }, { ...work, git: { ...work.git, switchConsent: q.bind.factsHash } }), resp: { work: work.id, next: [nx("integrate", "Integrate again; the switch is agreed.", true)] } };
  },
};

/** A setting from the typed catalog: set for this task or this project, or reset. A change to what is already in force is no change (PRD §7.5). */
export const config: Decision = {
  kind: "config",
  run({ state, work, input }) {
    const key = input.target ?? "";
    if (!isSettingKey(key)) throw new KernelError("restriction-key-unknown", `"${key}" is not a setting; known: ${Object.keys(CATALOG).join(", ")}`, { exit: 2 });
    const body = (input.propose ?? {}) as { value?: unknown; scope?: Scope; reset?: boolean };
    const scope: Scope = body.scope ?? CATALOG[key].scopes[0] ?? "project";
    const v = body.reset ? { ok: true as const, value: undefined } : validateSetting(key, body.value, scope);
    if (!v.ok) throw new KernelError("restriction-key-unknown", v.message, { exit: 2 });
    const held = scope === "task" ? work.settings ?? {} : state.config.local;
    const { [key]: had, ...rest } = held;
    const data = { setting: key, scope, ...(v.value === undefined ? { reset: true } : { value: v.value }) };
    if (JSON.stringify(had) === JSON.stringify(v.value)) return { resp: { work: work.id, next: [], data: { ...data, changed: false } } };
    const next = v.value === undefined ? rest : { ...rest, [key]: v.value };
    const out = scope === "task" ? withWork(state, { ...work, settings: next }) : withWork({ ...state, config: { revision: state.config.revision + 1, local: next } }, work);
    return { state: out, resp: { work: work.id, next: [], data: { ...data, changed: true } } };
  },
};

/** The one-step "sync my index" after a commit left the index untouched (TS §10.3 step 7): reruns only that step. */
export const syncIndex: Decision = {
  kind: "sync-index",
  async run({ ports, work }) {
    const last = work.git.commits.at(-1);
    if (!last) throw new KernelError("revision-conflict", "there is no commit of this work to sync the index for", { exit: 2 });
    const result = await ports.git.syncIndex(work.git.committed, await ports.git.parentOf(last));
    if (result === "untouched") return { resp: { work: work.id, exit: 2, reasons: [reason("git-locked", "another Git process holds the index lock; try again when it ends, or remove a stale .git/index.lock", { refs: [] })], next: [nx("commit", "Retry the sync once the lock is gone.")] } };
    return { resp: { work: work.id, next: [], data: { index: result } } };
  },
};

/** Consent to run this project's commit hooks, bound to the hook files as they are now (TS §10.3). */
export const hookConsent: Decision = {
  kind: "hook-consent",
  async run({ ports, state, work, input }) {
    const answer = input.answers?.["hook-consent"];
    const q = state.pending.find((p) => p.id === "hook-consent");
    if (!q) throw new KernelError("revision-conflict", "there is no open question about commit hooks", { exit: 2 });
    if (answer !== "commit-with-hooks" && answer !== "keep-uncommitted") throw new KernelError("revision-conflict", 'answer "commit-with-hooks" or "keep-uncommitted"', { exit: 1 });
    const probe = await ports.git.probe();
    if (probe.hooks !== q.bind.factsHash) throw new KernelError("revision-conflict", "the hooks changed since the question was asked", { exit: 2 });
    const rest = state.pending.filter((p) => p.id !== "hook-consent");
    if (answer === "keep-uncommitted") return { state: withWork({ ...state, pending: rest }, { ...work, git: { ...work.git, noCommit: true } }), resp: { work: work.id, next: [nx("finish", "Finish without committing.")] } };
    const consents = [...state.consents, { kind: "hooks" as const, configHash: q.bind.factsHash, at: ports.clock.now() }];
    return { state: withWork({ ...state, pending: rest, consents }, work), resp: { work: work.id, next: [nx("finish", "Hooks are consented; finish again to commit.", true)] } };
  },
};
