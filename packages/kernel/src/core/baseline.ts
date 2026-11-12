// Sealed baseline classification (EVD-04, TS §9.8). A failure of the broader suite on the candidate is compared with one run of
// the same command on the contract's starting files. Pure: the only place the pre-existing / introduced rule lives.
import { FULL_SUITE } from "./obligations.ts";
import { reason } from "./reasons.ts";
import type { Obligation, Reason, Receipt, WorkContract } from "./schemas.ts";
import type { Normalized } from "../ports/types.ts";

export const MAX_IDS = 200;
type Sealed = NonNullable<WorkContract["sealedBaseline"]>;
export interface BaselineCtx {
  sealed?: Sealed | undefined;
  exceptions?: readonly { ids: readonly string[] }[] | undefined;
  treated?: readonly { ids: readonly string[] }[] | undefined;
}
export type Classification =
  | { kind: "pre-existing" }
  | { kind: "introduced"; newTests: boolean }
  | { kind: "changed" | "unknown"; why: string };

/** Why a failure could not be classified, in the user's words (UX wording proposed in the sealed-baseline spec §15.4). */
export const WHY: Record<string, string> = {
  "start-changed": "a file you had edited at the start has changed since",
  differently: "it fails on your starting files, but differently",
  "not-finished": "the run on your starting files did not finish",
  timeout: "the run on your starting files did not finish",
  "report-invalid": "the run on your starting files did not finish",
  "concurrent-edit": "the workspace changed while your starting files were checked",
  "too-many": "more than 200 tests fail",
  filters: "a Git filter would have to run",
  "sealed-deps-unavailable": "dependencies could not be shared safely",
  materialize: "your starting files could not be copied to a temporary folder",
  "not-git": "there is no starting Git commit",
  "no-start": "there is no starting Git commit",
  symlink: "a file you had edited at the start is a symbolic link",
  excluded: "a file you had edited at the start is excluded from reading",
  "no-run": "your starting files were not checked",
  "too-slow": "the suite takes over 2 minutes, so it was not run again on your starting files",
  "no-ids": "the failing tests were not listed",
};

/** A failure's identity is `<file>::<test>`; the part after U+001F is its kind and message signature. */
const identity = (id: string): string => id.split("\u001f")[0]!;
const fileOf = (id: string): string => identity(id).split("::")[0]!;

/** Every failure identity of these report files, capped per entry; `failed` is the count the list is complete against. */
export function failureIdsOf(files: Normalized["files"], paths: readonly string[]): { ids: string[]; failed: number } {
  const ids = paths.flatMap((p) => (files.get(p)?.ids ?? []).map((i) => `${p}::${i}`.slice(0, 300)));
  return { ids, failed: paths.reduce((n, p) => n + (files.get(p)?.failed ?? 0), 0) };
}

/** A broader-suite failure on the candidate stage, listed by this adapter, is the only thing classified (SB-1). */
export const classifiable = (rc: Receipt): boolean =>
  rc.obligation === FULL_SUITE && rc.stage === "candidate" && rc.status === "fail" && rc.failureIds !== undefined;

/** Pre-existing needs a complete candidate list and a complete starting record with the same identity and signature (R-B, D2). */
export function classify(rc: Receipt, sealed: Sealed | undefined): Classification {
  const ids = rc.failureIds;
  if (!ids?.length) return { kind: "unknown", why: "no-ids" };
  const absent = new Set(rc.startAbsent ?? []);
  if (ids.some((id) => absent.has(fileOf(id)))) return { kind: "introduced", newTests: true };
  if (ids.length !== rc.counts?.failed) return { kind: "unknown", why: "too-many" };
  if (!sealed) return { kind: "unknown", why: "no-run" };
  if (sealed.status !== "recorded") return { kind: "unknown", why: sealed.why };
  if (!sealed.complete) return { kind: "unknown", why: "too-many" };
  const start = new Map(sealed.failed.map((id) => [identity(id), id]));
  if (ids.some((id) => !start.has(identity(id)))) return { kind: "introduced", newTests: false };
  if (ids.some((id) => start.get(identity(id)) !== id)) return { kind: "changed", why: "differently" };
  return { kind: "pre-existing" };
}

const covered = (ids: readonly string[], lists: BaselineCtx["exceptions"]): boolean =>
  ids.length > 0 && ids.every((id) => (lists ?? []).some((l) => l.ids.includes(id)));

/** What the user decided for this receipt's failures: left out of this work, treated as theirs to fix, or nothing yet. */
export function decided(rc: Receipt, c: BaselineCtx): "excluded" | "treated" | undefined {
  const ids = rc.failureIds ?? [];
  return covered(ids, c.treated) ? "treated" : covered(ids, c.exceptions) ? "excluded" : undefined;
}

/** A failure the user left out of this work: it counts as passed for the review gate and costs no attempt (SB-9). */
export const excused = (rc: Receipt, c: BaselineCtx): boolean =>
  classifiable(rc) && decided(rc, c) === "excluded" && classify(rc, c.sealed).kind !== "introduced";

/** A failing suite that needs the user's answer: pre-existing, changed or unknown, and not yet decided (SB-11). */
export const needsAnswer = (rc: Receipt, c: BaselineCtx): boolean =>
  classifiable(rc) && !decided(rc, c) && classify(rc, c.sealed).kind !== "introduced";

/** No attempt and no signature for a run whose failures all failed the same way before, or were left out (SB-9). */
export const spared = (rc: Receipt, c: BaselineCtx): boolean =>
  excused(rc, c) || (classifiable(rc) && !decided(rc, c) && classify(rc, c.sealed).kind === "pre-existing");

const files = (rc: Receipt): string => {
  const names = [...new Set((rc.failureIds ?? []).map(fileOf))];
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : "");
};

/** The reasons a failed receipt gives (SB-8). Anything not classifiable stays `evidence-failed`. */
export function failureReasons(ob: Pick<Obligation, "id">, rc: Receipt, c: BaselineCtx, detail = ob.id): Reason[] {
  const refs = { refs: [ob.id] };
  if (!classifiable(rc) || decided(rc, c) === "treated") return [reason("evidence-failed", detail, refs)];
  const k = classify(rc, c.sealed);
  const excluded = decided(rc, c) === "excluded";
  if (k.kind === "introduced") {
    const what = k.newTests ? "new tests that fail" : "these tests weren't failing this way on a run of your starting files";
    return [reason("evidence-failed", `${detail} (${what}: ${files(rc)})`, refs)];
  }
  if (k.kind === "pre-existing") {
    return excluded
      ? [reason("baseline-failure-excluded", `${files(rc)} (fails before and after the change)`, { note: true, ...refs })]
      : [reason("baseline-failure-not-excluded", `these tests also fail on a run of your starting files: ${files(rc)}`, refs)];
  }
  const why = WHY[k.why] ?? k.why;
  const deps = k.why === "sealed-deps-unavailable" ? [reason("sealed-deps-unavailable", why, { note: true })] : [];
  return excluded
    ? [reason("baseline-failure-unclassified-excluded", `${files(rc)}: you left it out; it was not shown to fail before`,
      { note: true, ...refs })]
    : [reason("classification-unknown", `couldn't tell whether ${files(rc)} failed before: ${why}`, refs), ...deps];
}
