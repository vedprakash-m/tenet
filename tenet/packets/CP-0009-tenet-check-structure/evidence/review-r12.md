# Independent round 12 re-review · CP-0009

Re-reviewed PR #28 (`9cb1be3`) and PR #29 (`aa925e6`) against [review-r8.md](review-r8.md), [pending-r8.md](../escalations/pending-r8.md), `CP-0009` (`plan/alpha.0.md`), `contracts.md §§8, 13`, and `messages.md §2`. Did not edit code under review.

## Prior Findings Status

| Prior finding | Status | Evidence |
|---|---|---|
| B1 | fixed | `test/check/check.test.ts:192–230` loads and validates all 14 `pkg/conformance/check/` cases unmodified. |
| B2 | fixed | `src/specs/check.ts:209–247` separates `localProblems()` (retaining only intra-document second+ occurrences) from `duplicateIdFindings()`, and `--paths` scope (`691`) skips cross-document checks cleanly. |
| B3 | fixed | `src/specs/check.ts:249–265` skips fenced code blocks and counts `V-…` tokens only on bullet list items or table rows (`^\s*(?:[-*+]\s+|\|)`). |
| B4 | not fixed | `src/specs/check.ts:671` still delegates absent `tenet.yaml` to `loadPolicy({ cwd })` (`src/policy/load.ts:232–236`), which throws `TN-POLICY-MISSING` instead of returning `{ findings: [TN-SCHEMA], summary }` directly from `check()`; CLI catches it at `src/cli.ts:401–409` (`test/cli/wiring.test.ts:76–102`, exit `3`). Decide SDK vs CLI missing-policy contract with Coordinator if direct `check()` must return findings instead of throwing. |
| B5 | fixed | `src/specs/split.ts:231–289` fails on destination existence before writes, rebases outgoing links (`77–101, 255`), checks all planned IDs and anchors (`110–192, 283`), then writes atomically. |
| B6 | fixed | `src/specs/fix.ts:418–477` verifies source/sidecar existence and destination absence before renaming and rolls back completed moves on error. |
| B7 | fixed | `src/commands/verify.ts:6–10` links `src/specs/{deltas,touched,parse,sections}.ts` into `npm run build` (`package.json:27`). |
| S1 | fixed | `src/specs/citations.ts:41`, `src/commands/fix.ts:13`, `src/commands/split.ts:13`, and `src/specs/check.ts:58–74` use canonical `message()` templates. (Note: `src/specs/ladder.ts:59` still constructs a custom string that `localProblems()` discards/re-formats.) |
| S2 | fixed | `src/commands/check.ts:12–21` accepts both positional `[paths...]` and `--paths <paths>`. |
| S3 | fixed | `src/cli.ts:270–278` prints `${message}${location}`, `why: ${rule ?? code}`, and `→ ${fix}` in TS §10 order. |
| S4 | partly fixed | `test/check/check.test.ts:952–1035` verifies `<= 6` non-repeated batched Git calls under `GIT_TRACE2_EVENT` on 500 specs, but `1035` checks `cold.elapsed < 30_000` (beyond R-082's `<= 10 s` cold / `<= 3 s` warm target), and `pkg/evals/bench/results/2026-11-24/RESULTS.md:7–10` records linear 20x growth (`6.907 s` at 1k files to `138.154 s` at 30k files). |

## Bounded Discovery Check & New Findings

- **One-file `tenet/intent.md` & split parts:** Confirmed `activeDocumentPaths` (`src/specs/check.ts:503–560`) discovers `tenet/intent.md` when raw `tenet.yaml` omits `specs.documents`, and `markdownBelow` finds split parts nested under `<doc-stem>/**` (tested at `test/check/check.test.ts:232–300`).
- **should** (`src/specs/check.ts:112–126`): `defaultBudget()` maps `vision.md`, `prd.md`, `tech-spec.md`, `ux-spec.md`, `plan.md`, and subpaths, but returns `null` for `tenet/intent.md` and `tenet/intent/*.md`, omitting default budget checks on `one-file` repositories unless configured in `tenet.yaml` / front matter.
- **note** (`src/specs/check.ts:508–519`): Unlisted `.md` files directly under `tenet/specs/` outside any `<doc-stem>/` subfolder are intentionally skipped by bounded discovery, whereas `board` (`specs-board.ts:333`) walks all `policy.paths.records`.
- **Pending question (`pending-r8.md`):** Citation severity on direct `check` under `level: "observe"` vs `--ci --base` (`src/specs/check.ts:680–683`, `src/specs/citations.ts:17`) is settled separately in `CP-0009/escalations/answers-r12.md`.
