// The diagnostics export (NFR-07, TS §16): built only when the user asks, redacted, and previewed whole.
// Pure. The kernel never sends or saves it; the user saves the previewed text to a path they choose (cooperative).
// A projection: counts and closed-set fields only. Never outcome or request text, quotes, handles, paths, output or lessons.
import type { LogEntry } from "../ports/types.ts";
import type { State } from "./schemas.ts";
import { Lane, ModelRecord, Profile, WorkState } from "./schemas.ts";
import { sha256 } from "./ids.ts";
import { KernelError } from "./errors.ts";
import { PrivacyDisclosure, PRIVACY_NOTICE } from "./privacy-types.ts";
import { z } from "zod";

export const EXPORT_BYTES = 16_384;
const CALLS = 40, WORK = 10;
const bytes = (s: string) => new TextEncoder().encode(s).length;
const Nat = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const PART = String.raw`(?:0|[1-9]\d*)`;
const PRE = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const Version = z.string().max(128).regex(new RegExp(
  String.raw`^${PART}\.${PART}\.${PART}(?:-${PRE}(?:\.${PRE})*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$`,
));
const Platform = z.enum(["aix", "android", "darwin", "freebsd", "haiku", "linux", "netbsd", "openbsd", "sunos", "win32", "cygwin"]);
const Verb = z.enum([
  "open", "decide", "check", "packet", "findings", "commit", "finish", "integrate", "undo", "stop", "review", "inspect",
]);
const Label = z.string().regex(/^W-\d{4,}$/);
const Call = z.strictObject({
  t: z.iso.datetime(), verb: Verb, exit: Nat.max(5), revision: Nat, work: Label.optional(), durationMs: Nat.optional(),
});
const ReceiptCount = z.record(
  z.string().regex(/^(test|static|build|audit|workload|manual):(pass|fail|inconclusive|skipped)$/), Nat,
);
const Work = z.strictObject({
  label: Label, profile: Profile, state: WorkState, lane: Lane,
  modelQualification: ModelRecord.shape.qualification.optional(), receipts: ReceiptCount,
});
const Header = z.strictObject({
  kernel: z.strictObject({ version: Version }),
  platform: z.strictObject({
    os: Platform, node: z.string().max(129).refine(value => value.startsWith("v") && Version.safeParse(value.slice(1)).success),
  }),
  state: z.strictObject({
    initialized: z.boolean(), revision: Nat, pendingQuestions: Nat,
    byState: z.partialRecord(WorkState, Nat), byLane: z.partialRecord(Lane, Nat), byProfile: z.partialRecord(Profile, Nat),
  }),
});

export const EXPORT_NOTE = `Nothing has been sent or saved. ${PRIVACY_NOTICE}`;
const PRIVACY = {
  redaction: "structured-likely", detection: "incomplete", paths: "none", notice: PRIVACY_NOTICE,
  operational: "Nothing has been sent or saved.",
} as const;

export const DiagnosticsV2 = Header.extend({
  format: z.strictObject({ name: z.literal("tenet.diagnostics"), version: z.literal(2) }),
  privacy: PrivacyDisclosure.extend({
    paths: z.literal(PRIVACY.paths), operational: z.literal(PRIVACY.operational),
  }),
  work: z.array(Work).max(WORK), calls: z.array(Call).max(CALLS),
  effects: z.partialRecord(z.enum(["intent", "result"]), Nat),
  dropped: z.strictObject({ calls: Nat }),
  truncated: z.strictObject({ calls: Nat, work: Nat, value: z.boolean() })
    .refine(value => value.value === (value.calls > 0 || value.work > 0)),
  note: z.literal(EXPORT_NOTE),
});

const count = (xs: readonly string[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});

function callOf(e: LogEntry, verbs: ReadonlySet<string>) {
  if (typeof e.verb !== "string" || !verbs.has(e.verb)) return null;
  const parsed = Call.safeParse({
    t: e.t, verb: e.verb, exit: e.exit, revision: e.revision,
    ...(Label.safeParse(e.work).success ? { work: e.work } : {}),
    ...(Nat.safeParse(e.durationMs).success ? { durationMs: e.durationMs } : {}),
  });
  return parsed.success ? parsed.data : null;
}

function workOf(w: State["work"][string]) {
  const receipts = w.receipts.map(r => `${r.kind}:${r.status}`)
    .filter(key => ReceiptCount.keyType.safeParse(key).success);
  const parsed = Work.safeParse({
    label: w.label, profile: w.profile, state: w.state, lane: w.lane, receipts: count(receipts),
    ...(w.model ? { modelQualification: w.model.qualification } : {}),
  });
  return parsed.success ? [parsed.data] : [];
}

function headerOf(i: ExportInput, all: State["work"][string][]) {
  const header = Header.safeParse({
    kernel: { version: i.version }, platform: { os: i.platform, node: i.node },
    state: {
      initialized: !!i.state, revision: i.state?.revision ?? 0, pendingQuestions: i.state?.pending.length ?? 0,
      byState: count(all.map(w => w.state)), byLane: count(all.map(w => w.lane)), byProfile: count(all.map(w => w.profile)),
    },
  });
  if (!header.success) throw new KernelError("capability-missing", "diagnostics metadata is outside the closed export domain");
  return header.data;
}

export interface ExportInput {
  version: string; platform: string; node: string; state: State | null; log: readonly LogEntry[]; verbs: readonly string[];
}

export function diagnosticsExport(i: ExportInput) {
  const all = Object.values(i.state?.work ?? {});
  const header = headerOf(i, all);
  const verbs = new Set(i.verbs);
  const records = i.log.filter((e) => e.kind === "call");
  const valid = records.map((e) => callOf(e, verbs)).filter((c) => c !== null);
  const validWork = all.flatMap(workOf);
  let calls = valid.slice(-CALLS);
  let work = validWork.slice(-WORK);
  const effects = count(i.log.filter((e) => e.kind === "intent" || e.kind === "result").map((e) => e.kind));
  const build = () => ({
    format: { name: "tenet.diagnostics", version: 2 },
    privacy: PRIVACY, ...header,
    work, calls, effects,
    dropped: { calls: records.length - valid.length },
    truncated: {
      calls: valid.length - calls.length, work: validWork.length - work.length,
      value: valid.length > calls.length || validWork.length > work.length,
    },
    note: EXPORT_NOTE,
  });
  let text = JSON.stringify(DiagnosticsV2.parse(build()), null, 1) + "\n";
  while (bytes(text) > EXPORT_BYTES && (calls.length || work.length)) {
    if (calls.length) calls = calls.slice(1); else work = work.slice(1);
    text = JSON.stringify(DiagnosticsV2.parse(build()), null, 1) + "\n";
  }
  if (bytes(text) > EXPORT_BYTES) throw new KernelError("capability-missing", "diagnostics header exceeds the export byte limit");
  return { text, bundleHash: sha256(text), bytes: bytes(text), truncated: build().truncated, note: EXPORT_NOTE };
}
