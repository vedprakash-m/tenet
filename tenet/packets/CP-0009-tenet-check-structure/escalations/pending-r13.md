# Pending question — CP-0009 round 13 (for MAI)

**Trigger (`s06-change-to-shared-helper`, `05-onboard-refresh`):** after editing `src/shared/http.ts` (cited by blessed requirement `R-1` in `tenet/intent.md`), running `tenet onboard --refresh` invokes `check()` (`src/specs/check.ts`), which currently returns `TN-SCHEMA` (`severity: "error"`) at `/sections/requirements/flags` and causes CLI exit `1`, even though `tenet/intent.md`'s front matter has valid `flags: []`.

## Spec ruling (`ALG-03` & `contracts §3`)

A stale stored `flags` field on disk is **not** a schema error:

- **`tenet/specs/tech-spec/algorithms.md:48–50` (`ALG-03`):**
  > **Flags**, recomputed by `check` and `board` at the current revision (return `[]` when `section.state !== "blessed"`):
  > - `edited`: the section's digest differs from `blessed_digest`
  > - `sources-changed`: an anchored range's lines no longer hash to its anchor, or the file or test is gone.
- **`tenet/specs/tech-spec/contracts.md:50` (`contracts §3`) and `kit/schemas/spec-front-matter.json:153–162`:**
  Front-matter schema validates `flags` only as an array of unique `"edited" | "sources-changed"` enum values (`flags: []` is schema-valid).
- **`tenet/specs/plan/alpha.0.md:133` (`CP-0009` `fix`):** `tenet fix` updates stored `flags` in front matter when run (`src/specs/fix.ts:490`), whereas `check` and `board` recompute flags at the current revision without requiring front matter to be edited every time cited code changes.

## Required code fix (`src/specs/check.ts`)

1. Remove the computed-vs-stored `flags` equality check in `src/specs/check.ts:328–345` (`if (JSON.stringify(expected) !== JSON.stringify(actual))` emitting `TN-SCHEMA` at `/sections/${section.slug}/flags`). Keep JSON Schema validation through `schemaFindings(entry.path, "spec-front-matter", entry.doc.front)` at `src/specs/check.ts:327`.
2. Leave `src/specs/fix.ts:490` (`flags: flags(section, read)`) unchanged so `tenet fix` continues refreshing stored `flags` when run.
3. Update `pkg/conformance/scenarios/s06-change-to-shared-helper/expected/05-onboard-refresh.json` (`errors: []`, matching `ok: true` and `expectExitCode: 0`; `TN-SPEC-BLESSED-COPY` also does not fire because `tenet/blessed/tenet__intent.md/requirements.md` matches `blessed_digest`).
