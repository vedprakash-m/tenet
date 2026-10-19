// The small decision kinds: each is a few lines over one record. Kept together; split a kind out when it grows.
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import type { BasisElement, Finding } from "../core/schemas.ts";
import { undecidedDirty } from "../verbs/dirty.ts";
import { factsHash, nx, withWork } from "../verbs/common.ts";
import { gather } from "../verbs/facts.ts";
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
  run({ state, work, input }) {
    const v = input.target;
    if (!ACCEPT.includes(v as (typeof ACCEPT)[number])) throw new KernelError("revision-conflict", `target must be one of ${ACCEPT.join(", ")}`, { exit: 1 });
    const w = { ...work, acceptance: v as (typeof ACCEPT)[number] };
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
    const lock = state.locks.find((l) => l.path === id);
    if (lock) {
      const blob = (await gather(ports, work)).inv.entries.get(id)?.blob;
      if (!blob) throw new KernelError("revision-conflict", `${id} no longer exists; a deleted locked test needs a basis change`, { exit: 2 });
      const locks = state.locks.map((l) => (l.path === id ? { ...l, hash: blob } : l));
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
