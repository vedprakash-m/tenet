// Recovery before anything else touches a resource (TS §7.4): an intent without a result is uncertain, never "did not
// happen", and is reconciled from its postcondition. Interrupted runs are stopped and discarded.
import type { State, WorkContract } from "../core/schemas.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { PUBLISH, SETTLE, type Outcome, type Recovery } from "./recover-effects.ts";

export interface Recovered { state: State; completed: string[]; uncertain: string[] }

/** Interrupted runs whose process is gone: stop what remains, discard the run, or fence it when ownership is unknown. */
async function discardDeadRuns(r: Recovery, original: State) {
  for (const w of Object.values(original.work)) {
    const c = w.session.inCall;
    if (!c) continue;
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
    const phase = w.state === "checking" ? (w.lastValidPhase ?? "executing") : w.state;
    put({ ...w, state: phase, session: { generation: w.session.generation, ...(w.session.last ? { last: w.session.last } : {}) } });
  }
}

/** Effects with an intent and no result, settled from their postconditions unless their process may still be running. */
async function settleEffects(r: Recovery) {
  for (const u of r.tx.unresolved()) {
    const running = r.state.work[(u.op as { work?: string } | null)?.work ?? ""]?.session.inCall;
    if (running?.cancelled) { r.uncertain.push(`the interrupted ${u.effect} still has uncertain process ownership`); continue; }
    if (running?.pid && running.procStart && (await r.ports.store.alive(running.pid, running.procStart))) continue;
    const settle = SETTLE[u.effect];
    if (settle) await settle(r, u);
    else r.uncertain.push(`${u.effect} ${u.id}`);
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
  const log = tx.recent(400);
  for (const res of log) {
    const out = res.outcome as Outcome | undefined;
    if (res.kind !== "result" || !out?.completed) continue;
    const intent = log.find((e) => e.kind === "intent" && e.effect === res.effect && e.id === res.id);
    if (intent && res.effect) PUBLISH[res.effect]?.(r, intent.op, out);
  }
  return { state: r.state, completed: r.completed, uncertain: r.uncertain };
}
