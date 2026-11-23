# CP-0009 · Answers to the round 3 specification questions

Answers to [proposals-r3.md](proposals-r3.md), decided on 2026-11-23 to unblock `CP-0009`.

1. **Result summary.**
   - `check` and `tenet_check` return `summary: {errors: number, warnings: number, advises: number}`, counting `findings` by `severity` (`"error"`, `"warning"`, `"advise"`).
   - All-clear result: `{findings: [], summary: {errors: 0, warnings: 0, advises: 0}}`.
   - Mixed example (1 structural error, 2 warnings, 1 advise): `{errors: 1, warnings: 2, advises: 1}`.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §8 (`line 128`) and `tenet/specs/plan/alpha.0.md` (`CP-0009` *Exports*, `line 129`).

2. **Uncovered vision diagnostic.**
   - **Code:** `TN-SPEC-UNCOVERED-VISION` (structural finding in `contracts.md §13`, `severity: "error"`, `rule: null`, exit 1).
   - **Granularity and location:** one finding per blessed `V-…` item not served by any `blessed` requirement (`serves` containing that `V-…` ID) and not deferred under a `blessed` `## Not yet in scope` section (`slug === "not-yet-in-scope"`). `finding.file` is the vision document path (`doc.path`), and `finding.line` is the 1-based line of the `V-…` statement.
   - **Deferral entry syntax:** any bullet list item or table row inside a `blessed` `## Not yet in scope` section whose text contains the exact `V-(?:[A-Z]+)?\d+` token (`\b<id>\b`). Unblessed (`draft`, `rejected`, `deferred`) `## Not yet in scope` sections do not cover blessed vision items.
   - **Message and fix (`messages.md §2`):**
     - Message: `"Blessed vision item {id} is not served by a blessed requirement or listed under ## Not yet in scope."`
     - Fix: `"Add serves: {id} to a blessed requirement or list {id} under a blessed ## Not yet in scope section."`
   - **Spec edits:** `tenet/specs/tech-spec.md` §6.3 (`line 199`), `tenet/specs/tech-spec/contracts.md` §13 (`line 179`), `tenet/specs/tech-spec/messages.md` §2, and `tenet/specs/plan/alpha.0.md` (`CP-0009` *Behavior*, `line 131`).

3. **Budget warning versus CI error.**
   - **Token count and rounding:** `tokens = Math.ceil(chars / 4)` over LF-normalized file text; the 90% warning threshold is `Math.ceil(limit * 0.9)` (inclusive: `tokens >= Math.ceil(limit * 0.9)`).
   - **Local warning (`TN-BUDGET-WARN`):** when running without `--ci --base`, any checked document with `tokens >= Math.ceil(limit * 0.9)` emits `TN-BUDGET-WARN` (`severity: "warning"`, `rule: "budget"`, `file: <path>`, `line: null`, exit 0).
     - Message: `"File {path} is at or over 90% of its token budget ({tokens} / {limit} tokens)."`
     - Fix: `"Trim {path} or run \`tenet split\` to extract a section into a part."`
   - **CI crossing (`TN-BUDGET`):** emitted only with `--ci --base <rev>` when `head_tokens > limit` and (`base` lacks the file or `base_tokens <= limit`). If `base_tokens > limit` already, `--ci --base` does not emit `TN-BUDGET`.
   - **Rule severity and exit code under `advise` vs `enforce`:** per `contracts.md §13`, a rule finding carries `severity: "error"` when the rule's effective mode is `"enforce"` (exiting 1) and `severity: "advise"` when the rule's effective mode is `"advise"` (exiting 0; omitted when `"observe"`). When `check` runs as a direct validator or when `budget` is enforced, `TN-BUDGET` has `severity: "error"`.
   - **Spec edits:** `tenet/specs/tech-spec.md` §9 (`line 229`), `tenet/specs/tech-spec/contracts.md` §13 (`lines 170, 180–181`), `tenet/specs/tech-spec/messages.md` §2 (`TN-BUDGET-WARN`), and `tenet/specs/plan/alpha.0.md` (`CP-0009` *Behavior*, `line 132`).

4. **Diagnostic locations, ordering and malformed-citation message.**
   - **`finding.file` and `finding.line`:**
     - Citations (`TN-CITE-FILE`, `TN-CITE-RANGE`, `TN-CITE-HEADING`, `TN-CITE-TEST`): `file` is the citing specification document path (`doc.path`), and `line` is the 1-based line of the citing statement (`null` if unknown).
     - Cross-document duplicate IDs (`TN-SPEC-DUP-ID`): walk documents in `ladder` order (`L0 < L1 < L2 < null`, then `path`); keep the first occurrence and emit one `TN-SPEC-DUP-ID` per later duplicate with `file` = the later document's path and `line` = the 1-based line of the duplicate statement in that document.
     - Blessed copy integrity (`TN-SPEC-BLESSED-COPY`): `file` is the specification document path (`doc.path`) and `line` is the 1-based line of the section's `## ` heading (`null` for `_preamble`).
     - Kit and lock findings (`TN-KIT-EDITED`, `TN-LOCK-MISMATCH`): `file` is `"tenet.lock"` and `line` is `null`.
   - **Ordering:** sort `findings` by `(file ?? "", line ?? 0, code, message)` in ASCII code-unit order (comparing `line ?? 0` numerically).
   - **Malformed-citation message:** `ALG-04` uses the `messages.md §2` `TN-CITE-RANGE` template (`"Citation {cite} has an invalid line range or format."` / `"Fix {cite} to use a valid path:line or path:start-end within file length."`) for both out-of-bounds ranges and malformed citation tokens.
   - **Spec edits:** `tenet/specs/tech-spec/algorithms.md` (`ALG-03` `line 51`, `ALG-04` `line 70`) and `tenet/specs/plan/alpha.0.md` (`CP-0009` *Behavior*, `line 131`).

5. **Required files and mode interactions.**
   - **Required files:**
     - Always: `tenet.yaml` at the repository root.
     - Specification documents: `<records>/intent.md` when `one-file` layout is active (`intent.md` exists and the separate ladder is not configured), else every document in `policy.specs.documents` under `<records>/` (`vision.md`, `specs/prd.md`, `specs/tech-spec.md`, `specs/ux-spec.md`, `specs/plan.md`). Each missing required document emits `TN-SCHEMA` (`file: <expected path>`, `line: null`, `schema: "spec-ladder"`, `pointer: "/specs/documents"`).
     - Lock and kit: skipped when `policy.kit_path === "kit"` (self-hosting); otherwise `tenet.lock` is required (missing `tenet.lock` emits `TN-SCHEMA` with `file: "tenet.lock"`, `schema: "lock"`, `pointer: "/"`), and when `policy.kit_path` is a vendored path (`.tenet/kit`), that folder must exist.
   - **`TN-KIT-EDITED` vs `TN-LOCK-MISMATCH`:** `check` evaluates both independently when `kit_path !== "kit"`: an installed package version differing from `tenet.lock.version` emits `TN-LOCK-MISMATCH` (`severity: "warning"`), and a vendored kit folder whose digest differs from `tenet.lock.kit_sha256` (or is missing) emits `TN-KIT-EDITED` (`severity: "error"`). When both fail simultaneously, both findings are emitted.
   - **`--paths` scope:** passing `--paths` runs per-document checks (front matter, sections, citations, blessed copies, budgets) only on the selected specification files and skips cross-document / repository-wide checks (cross-file `TN-SPEC-DUP-ID`, `TN-SPEC-UNCOVERED-VISION`, `TN-KIT-EDITED`, `TN-LOCK-MISMATCH`).
   - **Spec edits:** `tenet/specs/plan/alpha.0.md` (`CP-0009` *Behavior*, `lines 131–132`).
