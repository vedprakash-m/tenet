# CP-0053 · Answers to the round 3 specification questions

Answers to [proposals-r3.md](proposals-r3.md), decided on 2026-11-23 to unblock `CP-0053`.

1. **Schema reconciliation (`spec_debt` and `recorded`).**
   - In alpha.0, `board.json` fills five top-level fields: `as_of`, `read`, `specs`, `pending_blessings`, and `spec_debt: [{kind: broken-citation|untested-requirement|over-budget, path, id: string|null, message}]`.
   - In `specs[]`, `recorded` (`"self" | "forge" | "signed"`) is required only when `state === "blessed"` and is omitted (or `null`) on `draft`, `deferred` and `rejected` sections. `CP-0053` owns updating `kit/schemas/board.json` (and regenerating types) to include `spec_debt` and make `recorded` optional/nullable on unblessed sections.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §5 (`line 86`) and `tenet/specs/plan/alpha.0.md` (`CP-0053` *Owns* / *Exports*, `lines 157–158`).

2. **Working-tree subject, `read` fields, `--all` filter and ordering.**
   - **`read` object in alpha.0:** `{main: string | null, branches: string[], records: string | null}`, where `main` is the current commit SHA (or `null` when no commits exist), `branches` is `[]`, and `records` is `null`.
   - **`--all` behavior:** `board.json` always contains the complete `specs`, `pending_blessings`, and `spec_debt` arrays regardless of `--all`; `--all` affects only the human/Markdown output by appending the `Blessed (<n>)` group of clean blessed sections (`state === "blessed"` and `flags.length === 0`).
   - **Ordering:** `specs` and `pending_blessings` follow `ladder` document order (`L0 < L1 < L2 < null`, then `path`), then section order within each document. `spec_debt` is sorted by `kind` (`broken-citation`, `untested-requirement`, `over-budget`), then `path`, then `id ?? ""`, then `message`.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §5 (`line 86`) and `tenet/specs/plan/alpha.0.md` (`CP-0053` *Behavior*, `line 159`).

3. **Debt and pending-blessing membership and debt messages.**
   - **`pending_blessings`:** includes every section with `state === "draft"`, plus any `state === "blessed"` section with `"edited"` or `"sources-changed"` in `flags`. `deferred` and `rejected` sections are not in `pending_blessings`. Each entry carries `{path, section, conflicts: [id], open_questions: [id]}` (open `[ ]` items naming that section).
   - **`spec_debt` by section state:**
     - `broken-citation`: checked on `blessed`, `draft`, and `deferred` sections (`rejected` excluded). A deleted cited file in a `blessed` section both flags `sources-changed` and emits a `broken-citation` debt item; a `sources-changed` anchor whose target still resolves under `ALG-04` is not `broken-citation` debt.
     - `untested-requirement`: checked on `blessed` requirements only (any blessed requirement ID absent from `scanTests(HEAD).declarations[].tags`).
     - `over-budget`: checked per specification document when `Math.ceil(chars / 4) > limit`.
   - **`spec_debt` `id` and `message`:**
     - `broken-citation`: `id` is the citing item ID (or `null` when section-level); `message` is `"<Heading> cites <citePath>, which no longer exists"` (`TN-CITE-FILE`, with `:line`/`:start-end` stripped from `<citePath>`), `"<Heading> cites <path>#<slug>, which has no heading #<slug>"` (`TN-CITE-HEADING`), `"<Heading> cites test <name> in <file>, which was not found"` (`TN-CITE-TEST`), or `"<Heading> cites <cite>, which is out of range"` (`TN-CITE-RANGE`), deduplicated by `(kind, path, message)`.
     - `untested-requirement`: `id` is the requirement ID; `message` is `"<Heading> › <id> has no tagged test"`.
     - `over-budget`: `id` is `null`; `message` is `"<path> is over its token budget (<tokens> > <limit> tokens)"`.
   - **Spec edits:** `tenet/specs/plan/alpha.0.md` (`CP-0053` *Behavior*, `line 159`).

4. **Byte-level renderer contract.**
   - The terminal view in UX Part 2 (`lines 151–158`, without the `$ tenet board` prompt) is the exact LF-terminated text/Markdown view produced by `tenet board`.
   - **Empty repository (0 spec documents):** `"No specifications found · run tenet onboard\n"`.
   - **Header line:** `<repo> · <branch> <7-char-commit> · level <policy.level>`.
   - **Groups** (each omitted when its count is 0; indented by two spaces `"  "` per item):
     1. `Waiting for your blessing (<n>)`: `"  <Heading> · undecided since onboarding"` (when `drafted_from` is set or body is `"Undecided since onboarding.\n"`, else `"  <Heading> · draft"`).
     2. `Sources changed (<n>)`: `"  <Heading> › <ID> · <citedFile> changed after you blessed it; the blessed text still applies"` (or `"  <Heading> · sources changed after you blessed it; the blessed text still applies"` when no single requirement/file is identified).
     3. `Edited (<n>)`: `"  <Heading> · edited since blessing; the blessed text still applies"`.
     4. `Spec debt (<n>)`: `"  <item.message>"`.
     5. `Blessed (<n>)` (only with `--all`): `"  <Heading> · blessed"` for clean blessed sections (`flags.length === 0`).
   - When all displayed groups are empty (e.g. only clean blessed sections without `--all`), print the header line followed by `"All blessed specifications are current.\n"`.
   - **Spec edits:** `tenet/specs/plan/alpha.0.md` (`CP-0053` *Behavior*, `lines 159–160`).
