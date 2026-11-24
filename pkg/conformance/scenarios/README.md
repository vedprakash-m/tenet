# `pkg/conformance/scenarios` — independent end-to-end scenario suite (`CP-0052`)

Written independently from the `CP-0052` build contract (`tenet/specs/plan/alpha.0b.md:101–126`), `ALG-02`–`ALG-14` (`tenet/specs/tech-spec/{algorithms,onboarding,evidence,contracts,ci,agents}.md`), `README.md`, and `tenet/specs/ux-spec.md`, before anyone builds `CP-0052`. See [independent ownership](../INDEPENDENT.md) and the [round 7 proposals](../../../tenet/packets/CP-0052-blessing-onboarding-card-and-evaluation/escalations/proposals-r7.md).

## Structure and step controls

Each scenario folder contains:
- `before/` — starting repository tree materialized into a fresh temporary Git repository (`main` branch, one initial commit unless `before/` holds only `.gitkeep`).
- `steps.json` — ordered sequence of deterministic steps across `git`, `write`, `cli`, `sdk`, `mcp`, and `verify`:
  - `git` / `git-squash-shallow-clone`: repository mutations, squash-merge, or `git clone --depth 1` into `workdir`.
  - `write`: exact UTF-8 working-tree file updates.
  - `cli`: invokes `tenet <args...>` (with optional `fakeTty` prompt answers, `interrupt` fault injection for interrupted install checkpoints, `workdir`, and `expectExitCode`).
  - `sdk`: calls an exported Tenet SDK function (`context`, `board`, `onboard`, `record`, `renderCard`, or the `ALG-07` gate fixture evaluator).
  - `mcp`: sends newline-delimited JSON-RPC 2.0 requests to `serveMcp` and checks ordered responses and parity with CLI/SDK.
  - `verify`: evaluates a `VerifyEvent` (`workflow_run`, `edited`, or `pull_request` closed) with bundle/JUnit inputs and renders the proof card Markdown.
- `expected/` — exact JSON results and rendered `.md` cards for every decided and shipped output. Where exact output depends on open questions in `proposals-r7.md` or `proposals-r5.md`, expected files are omitted (`expectedOmitted`) and left absent until those decisions close.

## Scenarios (13 folders covering all 11 contract items)

| Scenario | Contract bullet | Surfaces | Spec lines exercised | Expected files & open decisions |
|---|---|---|---|---|
| [s01-tagged-test-never-ran](s01-tagged-test-never-ran/steps.json) | Tagged test that never ran | `git`, `write`, `verify`, `card` | `ALG-08` (`evidence.md §3`), `CI §10` (`ci.md:253`), `CP-0051` (`alpha.0b.md:48`) | `expected/04-verify.json`, `expected/04-card.md` |
| [s02-implements-changed-same-commit](s02-implements-changed-same-commit/steps.json) | `Implements:` changed on the same commit | `git`, `write`, `verify`, `card` | `contracts §1` (`contracts.md:18`), `CI §3` (`ci.md:138`), `ALG-14` (`algorithms.md:189`) | `expected/04-verify.json`, `expected/04-card.md`, `expected/05-verify.json`, `expected/05-card.md` |
| [s03-advisory-and-enforced-failure](s03-advisory-and-enforced-failure/steps.json) | Advisory and enforced failure together (`ALG-07` fixture) | `sdk`, `cli` | `ALG-07` (`algorithms.md:106–132`), `contracts §13` (`contracts.md:157`) | `expected/02-check.json`; step 01 pending · `proposals-r7#Q5` |
| [s04-reject-edit-to-blessed-section](s04-reject-edit-to-blessed-section/steps.json) | Rejecting an edit to a blessed section | `write`, `cli`, `sdk`, `mcp`, `fakeTty` | `ALG-03` (`algorithms.md:47–52`), `ALG-10` (`algorithms.md:159`), `contracts §9` (`contracts.md:126`) | `expected/02-board.json`, `expected/03-context.json`, `expected/04-mcp.json`, `expected/06-context-sdk.json`; step 05 pending · `proposals-r7#Q2` |
| [s05-global-rule-budget-pressure](s05-global-rule-budget-pressure/steps.json) | Global rule under budget pressure | `cli`, `mcp`, `sdk` | `ALG-10` (`algorithms.md:161–172`), `contracts §9` (`contracts.md:126`) | `expected/01-context-tight.json`, `expected/02-mcp.json`, `expected/03-context-explicit.json`, `expected/04-context-zero.json` |
| [s06-change-to-shared-helper](s06-change-to-shared-helper/steps.json) | Change to a shared helper | `cli`, `git`, `write`, `verify`, `card` | `OB §1` (`onboarding.md:71`), `ALG-11` (`algorithms.md:176`), `ALG-14` (`algorithms.md:190`) | `expected/06-verify.json`, `expected/06-card.md` |
| [s07-install-interrupted-part-way](s07-install-interrupted-part-way/steps.json) | Install interrupted part-way | `cli`, `interrupt` | `ALG-12` (`onboarding.md:103–114`), `CP-0010` (`alpha.0b.md:82, 93`) | tree equivalence & `before/` restoration; JSON pending · `proposals-r7#Q7` |
| [s08-blessing-fresh-clone-squash-merge](s08-blessing-fresh-clone-squash-merge/steps.json) | Blessing in a fresh clone after squash merge | `git`, `sdk`, `write`, `cli`, `fakeTty` | `ALG-03` (`algorithms.md:45–56`), `ALG-13` (`onboarding.md:119`), `CP-0052` (`alpha.0b.md:106`) | `expected/02-context-clean.json`, `expected/04-context-drift.json`; step 05 pending · `proposals-r7#Q3` |
| [s09-renamed-heading](s09-renamed-heading/steps.json) | Renamed heading | `write`, `cli`, `sdk` | `ALG-02` (`algorithms.md:23`), `CP-0009` (`alpha.0.md`) | `expected/02-fix.json`, `expected/03-check.json`, `expected/04-board.json`, `expected/05-context.json` |
| [s10-pr-closed-without-merging](s10-pr-closed-without-merging/steps.json) | PR closed without merging | `git`, `write`, `verify`, `card` | `CI §3–§4` (`ci.md:154–169`), `CP-0052` (`alpha.0b.md:124`) | `expected/04-verify.json`, `expected/04-card.md`; step 05 pending · `proposals-r7#Q6` |
| [s11-readme-walkthrough](s11-readme-walkthrough/steps.json) | README walkthrough verbatim | `cli`, `fakeTty` | `README.md:15–30`, `CP-0052` (`alpha.0b.md:125`) | pending · `proposals-r7#Q2, Q4, Q7` |
| [s12-ux-walkthrough-existing](s12-ux-walkthrough-existing/steps.json) | UX Part 1A & Part 2 walkthrough verbatim (existing repo) | `cli`, `fakeTty` | `ux-spec.md:34–115, 148–158`, `CP-0052` (`alpha.0b.md:125`) | pending · `proposals-r7#Q2, Q4, Q7` |
| [s13-ux-walkthrough-new](s13-ux-walkthrough-new/steps.json) | UX Part 1B walkthrough verbatim (new project) | `cli`, `git`, `fakeTty` | `ux-spec.md:119–125`, `CP-0052` (`alpha.0b.md:125`) | pending · `proposals-r7#Q2, Q4, Q7` |
