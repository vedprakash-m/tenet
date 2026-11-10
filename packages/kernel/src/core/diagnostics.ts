// The diagnostics export (NFR-07, TS §16): built only when the user asks, redacted, and previewed whole.
// Pure. The kernel never sends or saves it; the user saves the previewed text to a path they choose (cooperative).
// A projection: counts and closed-set fields only. Never outcome or request text, quotes, handles, paths, output or lessons.
import type { LogEntry } from "../ports/types.ts";
import type { State } from "./schemas.ts";
import { hashOf } from "./ids.ts";
import { redact } from "./redact.ts";

export const EXPORT_BYTES = 16_384;
const CALLS = 40, WORK = 10;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const bytes = (s: string) => new TextEncoder().encode(s).length;
const nat = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export const EXPORT_NOTE =
  "This is everything the export holds. Nothing has been sent or saved. To share it, save this text to a file you choose. " +
  "It holds counts, verbs, exit codes and timings, not your code, requests or paths. Likely secrets are redacted anyway.";

const count = (xs: readonly string[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});

function callOf(e: LogEntry, verbs: ReadonlySet<string>) {
  if (!verbs.has(String(e.verb)) || !nat(e.exit) || (e.exit as number) > 5 || !nat(e.revision) || !ISO.test(e.t)) return null;
  const work = typeof e.work === "string" && /^W-\d{4,}$/.test(e.work) ? { work: e.work } : {};
  const ms = nat(e.durationMs) ? { durationMs: e.durationMs } : {};
  return { t: e.t, verb: e.verb, exit: e.exit, revision: e.revision, ...work, ...ms };
}

export interface ExportInput {
  version: string; platform: string; node: string; state: State | null; log: readonly LogEntry[]; verbs: readonly string[];
}

export function diagnosticsExport(i: ExportInput) {
  const all = Object.values(i.state?.work ?? {});
  const verbs = new Set(i.verbs);
  const records = i.log.filter((e) => e.kind === "call");
  const valid = records.map((e) => callOf(e, verbs)).filter((c) => c !== null);
  let calls = valid.slice(-CALLS);
  let work = all.slice(-WORK).map((w) => ({
    label: w.label, profile: w.profile, state: w.state, lane: w.lane, ...(w.model ? { modelQualification: w.model.qualification } : {}),
    receipts: count(w.receipts.map((r) => `${r.kind}:${r.status}`)),
  }));
  const effects = count(i.log.filter((e) => e.kind !== "call" && e.kind !== "accounting").map((e) => e.kind));
  const build = () => ({
    format: { name: "tenet.diagnostics", version: 1 },
    kernel: { version: i.version }, platform: { os: i.platform, node: i.node },
    state: {
      initialized: !!i.state, revision: i.state?.revision ?? 0, pendingQuestions: i.state?.pending.length ?? 0,
      byState: count(all.map((w) => w.state)), byLane: count(all.map((w) => w.lane)), byProfile: count(all.map((w) => w.profile)),
    },
    work, calls, effects,
    dropped: { calls: records.length - valid.length },
    truncated: { calls: valid.length - calls.length, work: all.length - work.length },
  });
  let text = redact(JSON.stringify(build(), null, 1)) + "\n";
  while (bytes(text) > EXPORT_BYTES && (calls.length || work.length)) {
    if (calls.length) calls = calls.slice(1); else work = work.slice(1);
    text = redact(JSON.stringify(build(), null, 1)) + "\n";
  }
  return { text, bundleHash: hashOf(text), bytes: bytes(text), truncated: build().truncated, note: EXPORT_NOTE };
}
