// `publish <push|pr>`: remote effects, only on explicit request (GIT-05, TS §6.5, §10.6). `decide remote` binds the remote,
// its URL, the branch and the exact commit; this refuses if any of them changed, pushes that commit and reads the remote back.
// The pull request path needs a GitHub client and a rendered brief (GIT-06); neither is built, so `pr` refuses.
import { KernelError } from "../core/errors.ts";
import { hashOf } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import { changedFrom, settlePush, short, validRemoteName } from "../core/remote.ts";
import type { Binding, Pushed, Seen } from "../core/remote.ts";
import { PublishInput } from "../core/schemas.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan, Verb } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { nx, withWork, workOf } from "./common.ts";
import type { Recovery, Unresolved } from "./recover-effects.ts";

export interface PublishOp extends Binding { work: string; kind: "push"; runDir: string }

/** What the user agreed to push: the most recent `remote` grant of this contract. */
export const agreement = (w: WorkContract): Binding | undefined =>
  [...w.grants].reverse().find((g) => g.remote && g.actions.includes("remote"))?.remote;

/** The facts a push would act on right now. A missing remote or commit is an empty string, which never equals a bound fact. */
export async function bindingNow(ports: Ports, w: WorkContract, name: string, branch: string): Promise<Binding> {
  const url = validRemoteName(name) ? ((await ports.git.pushUrl(name)) ?? "") : "";
  return { name, url, branch, commit: w.git.commits.at(-1) ?? "" };
}

const askAgain = (why: string) =>
  new KernelError("authority-needed", why, { exit: 3, next: [nx("decision", "Ask the user in chat, then decide remote.", true)] });

type Done = { pushed?: { result: Pushed; detail?: string }; seen?: Seen; error?: string };

/** What the finished push turns into: recorded as done, recorded as not done, or left uncertain for recovery to settle. */
function settle(tx: Tx, st: State, w: WorkContract, id: string, b: Binding, result: unknown): { state: State; resp: Plan["resp"] } {
  const r = result as Done;
  const pushed = r.pushed ?? { result: "interrupted" as const, detail: r.error };
  const verdict = settlePush(pushed.result, r.seen ?? null, b.commit);
  const cw = st.work[w.id]!;
  const state = withWork(st, { ...cw, session: { generation: cw.session.generation } });
  if (verdict === "uncertain") {
    const effects = { completed: [], uncertain: [`the push of ${short(b.commit)} to ${b.name} is not confirmed by the remote`] };
    const why = reason("effect-uncertain", pushed.detail ?? "the remote did not confirm the push");
    const next = [nx("reconcile", "The next call reads the remote and settles this push.", true)];
    return { state, resp: { work: cw.id, exit: 2, effects, reasons: [why], next } };
  }
  tx.result("publish", id, { completed: verdict === "completed", commit: b.commit });
  if (verdict === "not-performed") {
    return { state, resp: { work: cw.id, exit: 2, reasons: [reason("repo-state-readonly", pushed.detail ?? "Git did not push")] } };
  }
  return { state, resp: { work: cw.id, data: { pushed: b } } };
}

/** A push that was cut off is settled by reading the remote back: a remote read of the remote the user agreed to (TS §7.4). */
export async function settleInterruptedPush(r: Recovery, u: Unresolved): Promise<void> {
  const op = u.op as PublishOp, what = `push of ${short(op.commit)} to ${op.name}`;
  const runDir = r.ports.store.tempDir(`run-${r.ports.rand.base32(6)}`);
  const seen = await r.ports.git.remoteBranch(op.name, op.branch, { runDir, timeoutMs: 30_000 });
  const verdict = settlePush("interrupted", seen, op.commit);
  if (verdict === "uncertain") {
    const why = seen ? `${op.branch} on the remote is at another commit` : "the remote could not be read";
    r.uncertain.push(`the interrupted ${what} cannot be confirmed: ${why}`);
    return;
  }
  r.tx.result("publish", u.id, { completed: verdict === "completed", commit: op.commit });
  const done = verdict === "completed";
  r.completed.push(done ? `the ${what} had reached the remote before the result was recorded` : "an interrupted push did not happen");
}

export const publish: Verb<PublishInput> = {
  name: "publish",
  schema: PublishInput,
  class: () => "mutating",
  /** A repeated call is a new call when the agreement, the remote's URL or the contract's commit moved. */
  async identity(ports, input, state) {
    const w = workOf(state, input.h), agreed = agreement(w);
    return hashOf({ agreed: agreed ?? null, now: agreed ? await bindingNow(ports, w, agreed.name, agreed.branch) : null });
  },
  async run(ports, state, input, tx) {
    const st = state!, w = workOf(st, input.h);
    if (input.kind === "pr") {
      const why = "pull requests are not built; push the branch and open the pull request yourself";
      throw new KernelError("capability-missing", why, { exit: 2 });
    }
    const agreed = agreement(w);
    if (!agreed) throw askAgain("nothing is agreed to leave this machine: ask the user, then record it with decide remote");
    const live = await bindingNow(ports, w, agreed.name, agreed.branch);
    const asked = { ...live, name: input.remote ?? live.name, branch: input.branch ?? live.branch };
    const changed = changedFrom(agreed, asked);
    if (changed.length) {
      const was = `${short(agreed.commit)} to ${agreed.name} as ${agreed.branch}`;
      throw askAgain(`You allowed pushing ${was}; ${changed.join("; ")}. Ask again before sending anything else.`);
    }
    if ((await ports.git.probe()).hooks) {
      const why = "Git hooks here would run on a push, and running them needs a consent path that is not built; nothing was pushed";
      throw new KernelError("capability-missing", why, { exit: 2 });
    }
    const id = `p-${ports.rand.base32(6)}`;
    const runDir = ports.store.tempDir(`run-${id}`);
    const op: PublishOp = { work: w.id, kind: "push", ...agreed, runDir };
    tx!.intent("publish", id, op);
    const now = ports.clock.now();
    const inCall = { runId: id, ...ports.store.self(), verb: "publish", since: now, runDir };
    const prepared: WorkContract = { ...w, updatedAt: now, session: { ...w.session, inCall } };
    const job: Job = {
      id,
      async execute() {
        const pushed = await ports.git.push(agreed.name, agreed.commit, agreed.branch, { runDir, timeoutMs: 120_000 });
        return { pushed, seen: await ports.git.remoteBranch(agreed.name, agreed.branch, { runDir, timeoutMs: 30_000 }) };
      },
      finalize: async (tx2, st2, result) => settle(tx2, st2, w, id, agreed, result),
    };
    return { state: withWork(st, prepared), resp: { work: w.id }, job };
  },
};
