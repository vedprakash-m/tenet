# Answers — CP-0050 round 10

Answers to `tenet/packets/CP-0050-gate-rule-modes-level-and-rules/escalations/proposals-r9.md`:

1. **`blocking` and `reasons` structure in `GateResult` (`algorithms.md` `ALG-07`)**
   When `disposition === "blocks"`, `blocking` is `{ row, rule, claim_id, reason }` selecting the earliest enforcing match by row ascending (`1..8`), then ASCII `claim_id` inside row 8 (`claim_id: null` for work-level rows 1–5). `reasons[]` holds unique matched reason codes ordered by first matching row (`1..8`), then ASCII `claim_id`.

2. **`level` and `rules` CLI / export signatures and decision binding (`plan/alpha.1.md` CP-0050; `contracts.md §8`)**
   - `level(targetLevel, opts)` writes `level` in `tenet.yaml` (`observe|protect|verify|assure`) and returns `{ previous_level, level, mode_changes, warnings }` (`kit/schemas/results/level.json`).
   - `rules(ruleId?, mode?, opts)` with no args returns `{ rules: [{ rule, mode, would_block_count, not_useful_count }] }`; with `(ruleId, mode)` updates `rules[ruleId]` in `tenet.yaml` and returns `{ rule, previous_mode, mode }` (`kit/schemas/results/rules.json`).
   - Promoting a rule to a stricter mode (`observe -> advise|enforce` or `advise -> enforce`) requires an approved `change-policy` decision matched by `opts.decision` or reduced events, else fails `TN-POLICY-RULE-DECISION`.

3. **Self-waiver and unapproved promotion error codes (`contracts.md §13`; `messages.md §3`)**
   - Author self-waiver (`waive.actor === author_of_change`) fails claim satisfaction with `TN-GATE-SELF-WAIVE` (`exit 1` in `enforce`, `advise` otherwise under `TN-GATE-*`), refusing the gate (`verdict: "refuse"`).
   - Rule promotion without an approved `change-policy` decision fails with `TN-POLICY-RULE-DECISION` (`exit 4`, policy refusal).
   - Both codes (plus `TN-BACKTEST-INCOMPLETE`) live in `messages.md §3` until `CP-0050` adds them to `src/core/messages.ts` and promotes them to `messages.md §2`.

4. **`next.command` strings vs evaluation fixtures (`algorithms.md` `ALG-07`; `kernel.md §2`)**
   Live `evaluateGate()` sets `next.command` to `"tenet resolve"` (`TN-GATE-CONFLICT`), `"tenet decide"` (`TN-GATE-TRUST`, `TN-GATE-REVIEW`, missing approval), `"tenet escalate"` (`TN-GATE-STOP`), `"tenet fix"` (`TN-GATE-UNKNOWN`, `TN-POLICY-INCOMPATIBLE`), or `null` (`advance`, CI wait, builder revise via runner). Fixture projections omit `command` or project `null` under `kernel.md §2 line 44`.

5. **100-PR backtest manifest & active-overhead format (`plan/alpha.1.md` CP-0050)**
   The frozen 100-PR cohort manifest records `{ schema_version: 1, frozen_at, cohort_size: 100, prs: [{ repository, pr, head_sha, decided_at, policy_revision, rules_triggered, enforced_refused, independent_adjudication: { warranted, reason }, active_minutes, incomplete? }], summary: { numerator, denominator, coverage, false_block_rate, total_active_minutes, mean_active_minutes_per_pr } }`. Incomplete coverage (`coverage < 100` or any `incomplete: true`) fails validation with `TN-BACKTEST-INCOMPLETE`.

   *Coordinator note for CP-0054-locked `kernel.md §4` (line 68):* approve `mean_active_minutes_per_pr = total_active_minutes / 100` and `TN-BACKTEST-INCOMPLETE` when coverage `< 100`.
