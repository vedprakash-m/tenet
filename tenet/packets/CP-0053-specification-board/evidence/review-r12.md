# Independent round 12 re-review · CP-0053

Re-reviewed PR #28 (`9cb1be3`) against [review-r8.md](review-r8.md), [pending-r8.md](../escalations/pending-r8.md), `CP-0053` (`plan/alpha.0b.md`), and `contracts.md §5`. Did not edit code under review.

## Prior Findings Status

| Prior finding | Status | Evidence |
|---|---|---|
| B1 | fixed | `kit/schemas/board.json:110–135` requires `recorded` conditionally on `state === "blessed"` and declares `spec_debt`; `src/types/generated.ts:72–91` matches. |
| B2 | fixed | `test/views/specs-board-conformance.test.ts:98–145` loads and verifies all 13 `pkg/conformance/board/` JSON projections and Markdown/UX fixtures unmodified. |
| B3 | fixed | `src/views/specs-board.ts:332–352` discovers documents via `ladder({ cwd, specs_dir: policy.paths.records })` and applies configured level/budget overrides, covering both `one-file` `intent.md` and split parts. |
| B4 | fixed | `src/views/specs-board.ts:392–397` normalizes missing or invalid `recorded` metadata on `blessed` entries to `"self"`; regression `test/views/specs-board.test.ts:487–525`. |
| B5 | fixed | `src/views/specs-board.ts:474` counts tokens using `normalizedCharCount(text)` (LF-normalized); paired LF/CRLF regression `test/views/specs-board.test.ts:533–565`. |
| S1 | fixed | `src/commands/board.ts:12–22` emits canonical `message("TN-USAGE-BOARD", ...)`. |

All `pkg/conformance/board/` cases pass unmodified and no new defects were introduced.
