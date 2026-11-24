# CP-0052 · Round 7 proposals for the independent scenario suite

Written by the round 7 specification reviewer alongside `pkg/conformance/scenarios/` (before anyone builds `CP-0052`). Expected files whose exact output depends on these open decisions are left absent from `pkg/conformance/scenarios/*/expected/`.

1. **Scenario runner and `steps.json` harness contract** (`pkg/conformance/scenarios/`):
   Each scenario executes ordered steps across `git`, `write`, `cli`, `sdk`, `mcp`, and `verify` (with optional `fakeTty` answers, `interrupt` write checkpoints, `workdir`, and deterministic `now` / `git` author environment). Confirm whether `npm run scenarios` runs via `test/onboard/scenarios.test.ts` (consuming `pkg/conformance/scenarios/*/steps.json`) and how `init`, `bless`, and `verify` dependency injection hooks connect to the harness.

2. **`tenet bless` interactive prompts, reject-on-edited file restore, and JSON result shape** (`s04`, `s08`, `s11`–`s13`; `ALG-03`, `ux-spec.md` Part 1A, `plan/alpha.0b.md` CP-0052):
   - Confirm exact prompt text and accepted keystrokes for owner selection, conflict resolution, section actions (`bless` / `edit` / `reject` / `defer` or `later`), and the `reject` prompt on an `edited` blessed section offering to restore the file's text from the blessed copy.
   - Confirm whether declining restoration leaves `digest !== blessed_digest` (so `flags` retains `"edited"` until manually reverted) while accepting restoration rewrites the file section and recomputes `digest === blessed_digest`.
   - Confirm whether `bless({doc?, section?})` returns string entries (`"<doc>#<slug>"`) or `{doc, section}` objects inside `{blessed, confirmed, rejected, deferred, minutes}`, and whether `minutes` is integer or fractional.

3. **`ALG-13` `log.jsonl` when `drafted_at_rev` is unreachable after squash merge** (`s08`; `onboarding.md §3`, `contracts.md §1`):
   `onboarding.md §3` says `"Without drafted_at_rev the measure is recorded as unavailable, never computed against later text"`, whereas `contracts.md §1` types `statements: {drafted, kept, edited, adopted, added}` in `<records>/blessed/log.jsonl`. Confirm how `"unavailable"` is serialized when `drafted_at_rev` is missing or pruned by a squash merge in a `--depth 1` clone (e.g., `statements: null` or `{drafted: null, kept: null, edited: null, adopted: null, added: null, available: false}`).

4. **`tenet onboard --card` output envelope and card formatting details** (`s11`–`s13`; `onboarding.md §1`, `ux-spec.md` Part 1A, `plan/alpha.0b.md` CP-0052):
   - Confirm the `--json` result shape for `onboard --card` (`{card, drafted_at_rev}` vs the `onboard` schema plus `card`).
   - Confirm reading-time rounding (`Math.max(1, Math.round(words / 200))` vs `Math.ceil`), how the header `"Sections (about <n> minutes)"` aggregates per-section minutes, and what line renders when `conflicts.length === 0`.

5. **`ALG-07` gate fixture entrypoint in `alpha.0`** (`s03`; `algorithms.md` ALG-07, `plan/alpha.0b.md` CP-0052):
   `CP-0052` specifies `"an advisory and an enforced failure together (ALG-07, as a fixture)"`, while runtime policy enforcement and `evaluateGate` belong to `alpha.1` (`CP-0035`). Confirm whether `alpha.0` evaluates this fixture through a pure internal helper tested by `scenarios.test.ts` alongside a runtime `check` asserting alpha.0's `advise` cap (`TN-POLICY-ALPHA0-CAP`).

6. **`verify` on pull request closed without merging in `alpha.0`** (`s10`; `ci.md §3`, `plan/alpha.0b.md` CP-0052):
   `ci.md §3` notes closing events arrive in `alpha.1`. Confirm whether `s10` verifies `"nothing beyond its last evaluation is recorded"` by keeping the workflow scoped to open/synchronize `workflow_run` evaluations in `alpha.0` or also asserts that delivering a `pull_request` `closed` (`merged: false`) payload writes nothing to `refs/tenet/records`.

7. **Open `CP-0010` install, doctor, and remove shapes** (`s07`, `s11`–`s13`; `proposals-r5.md`):
   Expected JSON result files for `init`, `upgrade`, `remove`, and `doctor` stay omitted until [proposals-r5.md](../../CP-0010-tenet-init/escalations/proposals-r5.md) Q1–Q13 are decided; interrupted-install tree parity (`compareTreeToCleanRun`) and byte-exact `remove` restoration are already specified and asserted.
