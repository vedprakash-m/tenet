// Recovery before anything else touches a resource (TS §7.4): an intent without a result is uncertain, never "did not
// happen", and is reconciled from its postcondition. Interrupted runs are stopped and discarded.
import type { State, WorkContract } from "../core/schemas.ts";
import { INTERRUPTED_CHECK, recoverStoppedCall } from "../core/execution-envelope.ts";
import { recordedResults } from "../core/state.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { PUBLISH, SETTLE, type Outcome, type Recovery } from "./recover-effects.ts";
import { replayUnrecorded } from "../core/commit-proof.ts";
import { KernelError } from "../core/errors.ts";

export interface Recovered { state: State; completed: string[]; uncertain: string[] }

/** Interrupted runs whose process is gone: stop what remains, discard the run, or fence it when ownership is unknown. */
async function discardDeadRuns(r: Recovery, original: State) {
  for (const w of Object.values(original.work)) {
    const c = w.session.inCall;
    if (!c) continue;
    const before = { state: r.state, completed: r.completed.length, uncertain: r.uncertain.length };
    try {
      const alive = c.pid !== undefined && c.procStart !== undefined && (await r.ports.store.alive(c.pid, c.procStart));
      if (alive && !c.cancelled) continue;
      const stopped = c.runDir ? await r.ports.runner.stopRun(c.runDir) : "unknown";
      const put = (x: WorkContract) => { r.state = { ...r.state, work: { ...r.state.work, [x.id]: x } }; };
      if (stopped === "unknown") {
        r.uncertain.push(`the interrupted ${c.verb} has no trusted process record; an orphan may exist`);
        put({ ...w, state: "blocked", session: { ...w.session, inCall: { ...c, cancelled: true } } });
        continue;
      }
      const how = stopped === "stopped" ? "its processes were stopped" : "its processes had ended";
      r.completed.push(`discarded the interrupted ${c.verb} (${how})`);
      const next = recoverStoppedCall(r.state, w);
      if (next.consents !== r.state.consents) r.completed.push(INTERRUPTED_CHECK);
      r.state = next;
    } catch {
      r.state = before.state;
      r.completed.length = before.completed;
      r.uncertain.length = before.uncertain;
      r.uncertain.push(`the interrupted ${c.verb} process ownership could not be inspected safely`);
    }
  }
}

/** Effects with an intent and no result, settled from their postconditions unless their process may still be running. */
async function settleEffects(r: Recovery) {
  for (const u of r.tx.unresolved()) {
    const running = r.state.work[(u.op as { work?: string } | null)?.work ?? ""]?.session.inCall;
    if (running?.cancelled) {
      r.uncertain.push(`the interrupted ${u.effect} still has uncertain process ownership`);
      continue;
    }
    const before = {
      state: r.state,
      completed: r.completed.length,
      uncertain: r.uncertain.length,
    };
    const writes: Array<
      | { kind: "intent"; effect: string; id: string; op: unknown }
      | { kind: "result"; effect: string; id: string; outcome: unknown }
    > = [];
    const tx = new Proxy(r.tx, {
      get(target, key) {
        if (key === "intent")
          return (effect: string, id: string, op: unknown) => writes.push({ kind: "intent", effect, id, op });
        if (key === "result")
          return (effect: string, id: string, outcome: unknown) => writes.push({ kind: "result", effect, id, outcome });
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const attempted: Recovery = { ...r, tx };
    let failed = false;
    let failure: unknown;
    try {
      if (
        running?.pid && running.procStart &&
        await r.ports.store.alive(running.pid, running.procStart)
      ) continue;
      if (Object.hasOwn(SETTLE, u.effect)) await SETTLE[u.effect]!(attempted, u);
      else attempted.uncertain.push(`${u.effect} ${u.id}`);
    } catch (error) {
      failed = true;
      failure = error;
    }
    if (failed) {
      r.state = before.state;
      r.completed.length = before.completed;
      r.uncertain.length = before.uncertain;
      if (failure instanceof KernelError) {
        const code = failure.reasons[0]?.code ?? "effect-uncertain";
        r.uncertain.push(`${u.effect} ${u.id}: ${code}`);
      } else r.uncertain.push(`${u.effect} ${u.id}: recovery handler failed internally`);
      continue;
    }
    r.state = attempted.state;
    for (const write of writes) {
      if (write.kind === "intent") r.tx.intent(write.effect, write.id, write.op);
      else r.tx.result(write.effect, write.id, write.outcome);
    }
  }
}

/** Recovery before anything touches a resource. `effects: false` (stop) handles processes only and defers project effects. */
export async function recover(ports: Ports, tx: Tx, state: State, options: { effects?: boolean } = {}): Promise<Recovered> {
  const r: Recovery = { ports, tx, state, completed: [], uncertain: [] };
  await discardDeadRuns(r, state);
  if (options.effects === false) {
    const why = "postcondition reconciliation is deferred until a policy-aware call";
    for (const u of tx.unresolved()) r.uncertain.push(`${u.effect} ${u.id}: ${why}`);
    return { state: r.state, completed: r.completed, uncertain: r.uncertain };
  }
  await settleEffects(r);
  for (const res of recordedResults(tx.recent())) {
    const out = res.outcome as Outcome | undefined;
    if (res.effect === "commit" && out?.disposition === "leave-unrecorded") {
      const next = replayUnrecorded(r.state, res.id, res.op, out);
      if (!next) r.uncertain.push(`commit ${res.id}: terminal disposition does not match its exact work and recovery question`);
      else r.state = next;
    }
    const publishable = out?.completed || (res.effect === "undo" && out?.completed === false);
    if (publishable && out && Object.hasOwn(PUBLISH, res.effect))
      await PUBLISH[res.effect]?.(r, res.op, out);
  }
  return { state: r.state, completed: r.completed, uncertain: r.uncertain };
}
