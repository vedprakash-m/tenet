// The small decision kinds: each is a few lines over one record. Kept together; split a kind out when it grows.
import { CATALOG, isSettingKey, validateSetting } from "../core/config.ts";
import type { Scope } from "../core/config.ts";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import type { BasisElement, Finding, State, WorkContract } from "../core/schemas.ts";
import { undecidedDirty } from "../verbs/dirty.ts";
import { factsHash, nx, withWork } from "../verbs/common.ts";
import { gather } from "../verbs/facts.ts";
import { integrationSetting, startIntegrate, switchFacts } from "../verbs/integrate.ts";
import type { Decision } from "./types.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";

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
    if (
      v !== "rejected" &&
      integrationSetting(ports, state, w) === "auto-on-accept" &&
      w.git.commits.length &&
      w.git.branch &&
      w.git.start.branch &&
      w.git.branch !== w.git.start.branch &&
      !w.git.integrated
    ) {
      return startIntegrate(ports, tx, withWork(state, w), w);
    }
    return { state: withWork(state, w), resp: { work: w.id, next: [nx("finish", "Acceptance is recorded; it does not change the checks.")], data: { acceptance: v } } };
  },
};

const FINDING_USER = ["deferred", "risk-accepted", "wont-fix"] as const;

/** A lock's test is revised with a new definition; permission to revise never proves the new definition against the
 * baseline (INT-06) — the obligations it supports are marked unproved until a fresh baseline establishes it. */
async function reviseLock(ports: Ports, state: State, work: WorkContract, id: string, why: string, now: string): Promise<Plan> {
  const blob = (await gather(ports, work)).inv.entries.get(id)?.blob;
  if (!blob) throw new KernelError("revision-conflict", `${id} no longer exists; a deleted locked test needs a basis change`, { exit: 2 });
  const locks = state.locks.map((l) => {
    if (l.path !== id && !(id in l.supportInputs)) return l;
    const patch = l.path === id ? { hash: blob } : { supportInputs: { ...l.supportInputs, [id]: blob } };
    const rev = { path: id, from: l.path === id ? l.hash : l.supportInputs[id]!, to: blob, reason: why, at: now };
    return { ...l, ...patch, revisions: [...(l.revisions ?? []), rev] };
  });
  const obligations = work.obligations.map((o) =>
    o.testFile === id || id in (o.baselineInputs ?? {}) ? { ...o, state: "revised" as const, baselineMatched: false } : o,
  );
  return {
    state: withWork({ ...state, locks }, { ...work, obligations }),
    resp: { work: work.id, next: [nx("test", "The revision is authorized. Re-establish baseline and candidate proof before claiming checked-local.", true)] },
  };
}

function dispositionAttention(state: State, work: WorkContract, id: string, outcome: string | undefined, why: string): Plan {
  const o = outcome === "finding" ? "finding" as const : "accepted" as const;
  const w = { ...work, attention: work.attention.map((a) => (a.id === id ? { ...a, disposition: { by: "user" as const, outcome: o, reason: why } } : a)) };
  return { state: withWork(state, w), resp: { work: work.id, next: [nx("check", "Re-check; the item is dispositioned.")] } };
}

function dispositionFinding(state: State, work: WorkContract, f: Finding, outcome: string | undefined, why: string, now: string): Plan {
  if (f.severity === "blocker") throw new KernelError("blocker-open", "a blocker is closed by a fix or by changing the basis, not by a disposition", { exit: 2 });
  const to = outcome as Finding["state"];
  if (!FINDING_USER.includes(to as (typeof FINDING_USER)[number])) throw new KernelError("revision-conflict", `outcome must be one of ${FINDING_USER.join(", ")}`, { exit: 1 });
  const w = { ...work, findings: work.findings.map((x) => (x.id === f.id ? { ...x, state: to, history: [...x.history, { to, by: "user" as const, reason: why, at: now }] } : x)) };
  return { state: withWork(state, w), resp: { work: w.id, next: [nx("finish", "The finding is dispositioned.")] } };
}

function dispositionElement(state: State, work: WorkContract, el: BasisElement, why: string): Plan {
  const upd: BasisElement = { ...el, verifiedBy: { notApplicable: why } };
  const intent = { ...state.project.intent, revision: state.project.intent.revision + 1, elements: state.project.intent.elements.map((e) => (e.id === el.id ? upd : e)) };
  return {
    state: withWork({ ...state, project: { ...state.project, intent } }, work),
    resp: { work: work.id, reasons: [reason("assumption-unresolved", el.id, { note: true })], next: [nx("finish", "The element is dispositioned.")] },
  };
}

/** TDD-03: a behavioral red is infeasible, so the user records why a seeded fault stands in for it. The obligation
 * still has to genuinely fail with the fault in place; this only authorizes the negative-control exemption. */
function recordAlongside(state: State, work: WorkContract, id: string, why: string): Plan {
  const ob = work.obligations.find((o) => o.id === id || o.testFile === id);
  if (!ob) throw new KernelError("revision-conflict", `nothing called ${id} in this contract`, { exit: 1 });
  const w = { ...work, obligations: work.obligations.map((o) => (o === ob ? { ...o, alongsideReason: why } : o)) };
  return {
    state: withWork(state, w),
    resp: { work: w.id, next: [nx("check", "Baseline it as a negative control: --alongside the seeded-fault file, fault in place.")] },
  };
}

/** The user's disposition of an attention item, a finding or an assumption. */
export const disposition: Decision = {
  kind: "disposition",
  async run({ state, work, input, ports }) {
    const id = input.target ?? "";
    const body = (input.propose ?? {}) as { outcome?: string; reason?: string };
    const why = (body.reason ?? "").trim();
    if (!why) throw new KernelError("revision-conflict", "a disposition needs a reason", { exit: 1 });
    const now = ports.clock.now();

    const lock = state.locks.find((l) => l.path === id || id in l.supportInputs);
    if (lock) return reviseLock(ports, state, work, id, why, now);
    const att = work.attention.find((a) => a.id === id);
    if (att) return dispositionAttention(state, work, id, body.outcome, why);
    const f = work.findings.find((x) => x.id === id);
    if (f) return dispositionFinding(state, work, f, body.outcome, why, now);
    const el = state.project.intent.elements.find((e) => e.id === id && work.basis?.elementIds.includes(e.id));
    if (el) return dispositionElement(state, work, el, why);
    if (body.outcome === "alongside") return recordAlongside(state, work, id, why);
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
    const hasConfigured = (key === "commands" || key === "required_checks") && v.value && Object.keys(v.value as object).length;
    const data = {
      setting: key,
      scope,
      ...(v.value === undefined ? { reset: true } : { value: v.value }),
      ...(hasConfigured ? { limits: ["Stored declaration only: configured execution is unavailable; checks and checked-local are blocked."] } : {}),
    };
    if (JSON.stringify(had) === JSON.stringify(v.value)) return { resp: { work: work.id, next: [], data: { ...data, changed: false } } };
    const next = v.value === undefined ? rest : { ...rest, [key]: v.value };
    const out = scope === "task" ? withWork(state, { ...work, settings: next }) : withWork({ ...state, config: { revision: state.config.revision + 1, local: next } }, work);
    return { state: out, resp: { work: work.id, next: [], data: { ...data, changed: true } } };
  },
};

/** The one-step "sync my index" after a commit left the index untouched (TS §10.3 step 7): reruns only that step. */
export const syncIndex: Decision = {
  kind: "sync-index",
  async run({ ports, work, tx }) {
    const last = work.git.commits.at(-1);
    if (!last) throw new KernelError("revision-conflict", "there is no commit of this work to sync the index for", { exit: 2 });
    const id = `index-${ports.rand.base32(10)}`;
    const result = await ports.git.syncIndex(work.git.committed, await ports.git.parentOf(last), {
      owner: ports.store.self(),
      intent: async (sync) => { tx.intent("index-sync", id, { work: work.id, sync }); },
      result: async (status) => { tx.result("index-sync", id, { status }); },
    }, last);
    if (result === "untouched") {
      return {
        resp: {
          work: work.id,
          exit: 2,
          reasons: [reason("index-sync-needed", "the index was left untouched; its lock, current commit or format does not permit this sync", { refs: [] })],
          next: [nx("reconcile", "Review the current commit and index lock, then retry decide sync-index.")],
        },
      };
    }
    return { resp: { work: work.id, next: [], data: { index: result } } };
  },
};
