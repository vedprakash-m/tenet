import type { State } from "./schemas.ts";

export const JOB_FINAL_STATE_RESERVE = 1024 * 1024;

export function reservedStorage(state: State | undefined | null): number {
  const growth = Object.values(state?.work ?? {}).reduce(
    (total, work) => total + (work.session.inCall?.storageReservedBytes ?? 0),
    0,
  );
  // Concurrent calls preserve a snapshot rewrite as well as each job's bounded growth.
  return growth ? growth + Buffer.byteLength(JSON.stringify(state), "utf8") : 0;
}

export function releasedStorage(previous: State | undefined, next: State | undefined): number {
  const retained = new Set(Object.values(next?.work ?? {}).map((work) => work.session.inCall?.runId));
  return Object.values(previous?.work ?? {}).reduce((total, work) => {
    const call = work.session.inCall;
    return total + (call && !retained.has(call.runId) ? call.storageReservedBytes ?? 0 : 0);
  }, 0);
}
