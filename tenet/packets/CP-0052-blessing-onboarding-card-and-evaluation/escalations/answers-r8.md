# CP-0052 · Answers to round 7 scenario questions

Answers to [proposals-r7.md](proposals-r7.md), decided on 2026-11-23.

1. **Scenario runner and `steps.json` harness contract (`tenet/specs/plan/alpha.0b.md` `CP-0052`).**
   - `npm run scenarios` executes `test/onboard/scenarios.test.ts` over every folder in `pkg/conformance/scenarios/`.
   - Each step dispatches through deterministic injected test adapters (`cwd`, `now`, isolated `git` author/committer environment, `fakeTty` line reader, filesystem fault injection for `interrupt`, and an in-memory forge/bundle harness for `verify`), asserting exit codes, JSON results, tree snapshots, and rendered `.md` cards against `expected/`.
   - **Spec edit:** `tenet/specs/plan/alpha.0b.md` (`CP-0052` *Behavior* and *Proving*).

2. **`tenet bless` prompts, reject-on-edited file restore, and JSON result (`algorithms.md` `ALG-03`, `contracts.md` `§8`, `alpha.0b.md` `CP-0052`).**
   - `bless({doc?, section?})` returns `{blessed, confirmed, rejected, deferred, minutes}` as non-negative numeric section counts and elapsed session minutes.
   - Owner selection lists numbered `owners[]` (`Who is blessing? … > `); conflict prompts list numbered `| 1: …` options plus `Decide later` and check whether any drafted statement contradicts the choice; section prompts accept `bless`, `edit`, `reject`, `later` (mapped to `defer`), and `confirm` (`sources-changed` only, displaying old/new anchor lines and `Confirm these source changes? [y/N] `); left `inferred` items prompt `edit / adopt / leave` (`TN-BLESS-INFERRED` if left).
   - On an `edited` blessed section, `reject` or `defer` keeps `blessed_copy` in force and prompts `"Restore the document's section from its blessed copy? [y/N] "`: `y` restores the section body from `blessed_copy` (recomputing `digest === blessed_digest` and clearing `"edited"`), while `n`/Enter leaves the edited draft in the document (`"edited"` remains until manually reverted or re-blessed).
   - **Spec edits:** `tenet/specs/tech-spec/algorithms.md` (`ALG-03`), `tenet/specs/tech-spec/contracts.md` (`§8`), `tenet/specs/plan/alpha.0b.md` (`CP-0052` *Behavior*).

3. **`ALG-13` `log.jsonl` when `drafted_at_rev` is unavailable (`contracts.md` `§1`, `onboarding.md` `§3`).**
   - When `drafted_at_rev` is absent or unreachable (for example, pruned by squash merge and missing from a `--depth 1` clone), `<records>/blessed/log.jsonl` still writes `{doc, section, by, at, minutes, statements}` with `{drafted: null, kept: null, edited: null, adopted: null, added: null}`.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` (`§1`) and `tenet/specs/tech-spec/onboarding.md` (`§3`).

4. **`tenet onboard --card` output and card formatting (`onboarding.md` `§1`, `contracts.md` `§8`, `alpha.0b.md` `CP-0052`).**
   - `tenet onboard --card` (--json `result`: `{card, drafted_at_rev}` where `drafted_at_rev` is the head commit pinned on drafted documents; human output prints `card`) fails with `TN-USAGE-ONBOARD` (exit `2`) if combined with `--inventory-only`, `--refresh`, or `--layout`.
   - Reading time per governed section is `Math.ceil(words / 200)` (`0` only for zero words), `"Sections (about <n> minutes)"` sums section reading minutes, and `Conflicts (settle these first)` is omitted when zero conflicts exist.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` (`§1`), `tenet/specs/tech-spec/contracts.md` (`§8`), `tenet/specs/plan/alpha.0b.md` (`CP-0052` *Exports* and *Behavior*).

5. **`ALG-07` gate fixture entrypoint in `alpha.0` (`alpha.0b.md` `CP-0052`).**
   - Until `evaluateGate` lands in `alpha.1` (`CP-0035`), the scenario runner evaluates `ALG-07` fixtures via an internal pure evaluator verifying `ALG-07`'s verdict/disposition table, paired with runtime `tenet check --json` asserting alpha.0's `TN-POLICY-ALPHA0-CAP` `advise` cap.
   - **Spec edit:** `tenet/specs/plan/alpha.0b.md` (`CP-0052` *Behavior*).

6. **`verify` on pull request closed without merging (`ci.md` `§3`).**
   - In `alpha.0`, closing a pull request without merging (`pull_request` `closed`, `merged: false`) triggers no `workflow_run` evaluation; if delivered to `verify --record`, it is a no-op exit `0` recording nothing beyond the pull request's last evaluation in `refs/tenet/records`.
   - **Spec edit:** `tenet/specs/tech-spec/ci.md` (`§3`).

7. **`CP-0010` install, doctor, and remove assertions (`alpha.0b.md` `CP-0052`).**
   - Until `CP-0010` lands exact `init`/`doctor`/`remove` payloads (`proposals-r5.md`), scenarios assert contracted `contracts §8` top-level keys, exit codes, interrupted-install `compareTreeToCleanRun` byte parity, and exact `remove` restoration of the `before/` tree.
   - **Spec edit:** `tenet/specs/plan/alpha.0b.md` (`CP-0052` *Behavior*).
