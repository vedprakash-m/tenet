# Independent cases for alpha.1 · audit

> Audit of the six alpha.1 conformance suites (`pkg/conformance/kernel-schemas/`, `events/`, `gate/`, `decisions/`, `full-board/`, and `evaluator-trial/`) and their rows in [INDEPENDENT.md](../../../pkg/conformance/INDEPENDENT.md), against today's specifications and `0.1.0`/`0.1.1` code. Audited without editing any conformance case.

## Summary

| Suite | Cases | matches | stale | conflict | unclear | Untested rules |
|---|---|---|---|---|---|---|
| `kernel-schemas/` (`CP-0049`) | 16 | 15 | 0 | 1 | 0 | 7 |
| `events/` (`CP-0007`) | 15 | 12 | 0 | 1 | 2 | 6 |
| `gate/` (`CP-0050`) | 16 | 13 | 0 | 0 | 3 | 5 |
| `decisions/` (`CP-0019`) | 15 | 14 | 0 | 1 | 0 | 5 |
| `full-board/` (`CP-0008`) | 13 | 7 | 0 | 6 | 0 | 5 |
| `evaluator-trial/` (`plan.md §4`) | 1 (6 evaluations) | 0 | 0 | 1 | 0 | 1 |
| **Total** | **76** | **61** | **0** | **10** | **5** | **29** |

Note on suite indexes (`pkg/conformance/INDEPENDENT.md` and suite `README.md` files):
- `pkg/conformance/INDEPENDENT.md:18` cites `agents.md lines 169 & 184`; those worked examples are now at `tenet/specs/tech-spec/agents.md:170` and `185`.
- `pkg/conformance/INDEPENDENT.md:20` lists `backtest` under `gate/`, but `pkg/conformance/gate/` has no backtest case.
- `pkg/conformance/INDEPENDENT.md` has no row for `pkg/conformance/evaluator-trial/`.
- Many `README.md` tables across all five suites point to pre-CP-0066 line numbers even where the underlying rule text is unchanged; those moved line numbers are noted in each table below.

## kernel-schemas

Contract: `CP-0049` ([plan/alpha.1.md:12-20](../../specs/plan/alpha.1.md#L12-L20)). Suite index: [kernel-schemas/README.md:1-26](../../../pkg/conformance/kernel-schemas/README.md).

| Case | Tests (path:line) | Verdict | Problem | Proposed fix to the case or the spec |
|---|---|---|---|---|
| `n01-unknown-key-rejected` | `tenet/specs/tech-spec/contracts.md:24` | matches | None (`README.md:21` links `contracts.md` line 5; rule moved to line 24). | Refresh `README.md:21` link to `contracts.md:24`. |
| `n02-incomplete-claim-rejected` | `tenet/specs/tech-spec.md:90` | matches | None (`README.md:22` cites line 70; moved to line 90). | Refresh `README.md:22` link to `tech-spec.md:90`. |
| `n03-bad-timestamp-and-short-hash` | `tenet/specs/tech-spec.md:76`, `tenet/specs/tech-spec/contracts.md:149` | matches | None (`README.md:23` cites old lines 56 and 138). | Refresh `README.md:23` line references. |
| `n04-incomplete-review-payload` | `tenet/specs/tech-spec/evidence.md:25`, `tenet/specs/plan/alpha.1.md:16` | matches | None (`README.md:24` cites line 15; moved to line 25). | Refresh `README.md:24` link to `evidence.md:25`. |
| `n05-loop-invalid-route-and-step` | `tenet/specs/tech-spec/agents.md:151`, `tenet/specs/plan/alpha.1.md:16` | matches | None. | — |
| `n06-migrate-malformed-legacy-packet` | `tenet/specs/plan/alpha.1.md:16`, `kit/schemas/finding.json:5-58`, `tenet/specs/tech-spec/messages.md:77` | conflict | `expected.json:10,18` asserts `"pointer": "/id"` and `"pointer": "/history/0/at"` on `problems[]`, while `plan/alpha.1.md:16` requires `finding.json` and `kit/schemas/finding.json:6,10-49` sets `additionalProperties: false` with no `pointer` field. | Remove `"pointer"` from `expected.json:10,18` (and match `TN-SCHEMA` `message` from `messages.md:77`), or add `pointer` to `finding.json` and `contracts.md:135` (D-1). |
| `p01-minimal-seven-primitives` | `tenet/specs/tech-spec.md:90`, `tenet/specs/tech-spec/contracts.md:24`, `answers-r10.md:5-9` | matches | Validates 6 primitives (`policy` uses `tenet-yaml.json` per `answers-r10.md:7`; `README.md:11` cites line 70 vs 90). | Refresh `README.md:11` line reference. |
| `p02-full-records-and-evidence-payloads` | `tenet/specs/tech-spec.md:78-86`, `tenet/specs/tech-spec/evidence.md:21-22,25` | matches | None (`README.md:12` cites old lines 58–66, 74 and 9–15). | Refresh `README.md:12` line references. |
| `p03-agents-md-define-loop` | `tenet/specs/tech-spec/agents.md:170-182`, `tenet/specs/plan/alpha.1.md:16` | matches | `input.yaml:4` sets `limits: {rounds: 2}` while `agents.md:173` shows `rounds: 5`; `README.md:13` cites line 169 vs 170. | Change `input.yaml:4` to `rounds: 5` or soften `README.md:13` wording and cite line 170. |
| `p04-agents-md-build-loop` | `tenet/specs/tech-spec/agents.md:185-195`, `tenet/specs/plan/alpha.1.md:16` | matches | `input.yaml:4` sets `limits: {rounds: 2}` while `agents.md:188` shows `rounds: 5`; `README.md:14` cites line 184 vs 185. | Change `input.yaml:4` to `rounds: 5` or soften `README.md:14` wording and cite line 185. |
| `p05-fix-loop-assignment-result-criteria` | `tenet/specs/tech-spec/agents.md:138-161`, `tenet/packets/CP-0049-kernel-schemas/escalations/answers-r10.md:29` | matches | `criteria.json` exact field list appears only in `answers-r10.md:29`, not yet in `contracts.md` or `agents.md`. | Copy `criteria.json` field list from `answers-r10.md:29` into `contracts.md §1` or `agents.md §5`. |
| `p06-reserved-evidence-kinds` | `tenet/specs/tech-spec/evidence.md:26-28`, `tenet/specs/plan/alpha.1.md:16,18` | matches | None (`README.md:16` cites old lines 16–18). | Refresh `README.md:16` link to `evidence.md:26-28`. |
| `p07-migrate-legacy-packet` | `tenet/specs/plan/alpha.1.md:16`, `tenet/specs/tech-spec/contracts.md:32`, `answers-r10.md:13-18` | matches | All 3 deterministic ULIDs match `rfc8785({work, index, entry})`. | — |
| `p08-migrate-idempotent-repeat` | `tenet/specs/plan/alpha.1.md:16,20`, `answers-r10.md:13-18` | matches | Both deterministic ULIDs match. | — |
| `p09-migrate-duplicate-history` | `tenet/specs/plan/alpha.1.md:16`, `answers-r10.md:13-18` | matches | All 3 deterministic ULIDs match. | — |
| `p10-extension-keys` | `tenet/specs/tech-spec/contracts.md:24`, `tenet/specs/plan/alpha.1.md:17` | matches | None (`README.md:20` cites `contracts.md` line 5 vs 24). | Refresh `README.md:20` link to `contracts.md:24`. |

### Untested rules

1. **[Most important] `evidence.json` payloads for `attestation` and `observation` (`plan/alpha.1.md:16`, `evidence.md:23-24`)** · `p02` and `p06` cover six evidence kinds, leaving `attestation` and `observation` unvalidated by any case · `p11-attestation-and-observation-payloads`.
2. **[Most important] `review` with `status: "incomplete"` and `invalid[]` fallback (`plan/alpha.1.md:16`, `evidence.md:25`)** · `n04` rejects unlocated findings on `status: "complete"`, but nothing confirms unlocated findings are accepted when `status: "incomplete"` or moved to `invalid[]` · `p12-incomplete-review-and-invalid-findings`.
3. **[Most important] `loop.json` `steps` default `20` and invalid `step` / conditional `{if, goto, else}` `route.on` forms (`plan/alpha.1.md:16`, `agents.md:142-151`)** · `n05` only drops `human-gate`; omitted `limits.steps` defaulting to `20`, invalid `script`/`set`/`human_gate` steps, and malformed `{if, goto, else}` targets have no test · `n07-loop-steps-default-and-step-variants`.
4. `work.json`, `criteria.json`, `step-assignment.json`, and `step-result.json` negative inputs (`plan/alpha.1.md:19`, `contracts.md:24`) · Each schema needs ≥3 negative fixtures, while `kernel-schemas/` only validates `work` inside `migratePacket` and has zero negative cases for `criteria`, `step-assignment`, and `step-result` · `n08-invalid-work-criteria-step-records`.
5. `migratePacket` preserves original `old` object untouched (`plan/alpha.1.md:16`, `kernel-schemas/README.md:5`) · `p07`–`p09` inspect only the returned projection and never assert that nested arrays/objects on `old` are not mutated · `p13-migrate-preserves-input-object`.
6. Minimal `work` and optional `review` `substantiated` field (`tech-spec.md:88`, `evidence.md:25`) · Standalone minimal `work.json` and `substantiated: true` without `location` are uncovered · `p14-standalone-work-and-substantiated-review`.
7. `migratePacket` missing/non-array `history` and unsupported legacy fields (`plan/alpha.1.md:16-17`) · `n06` tests bad `id` and `history[0].at`, leaving missing `history` or non-string `by` untested · `n09-migrate-missing-history`.

## events

Contract: `CP-0007` ([plan/alpha.1.md:22-30](../../specs/plan/alpha.1.md#L22-L30)). Suite index: [events/README.md:1-25](../../../pkg/conformance/events/README.md).

| Case | Tests (path:line) | Verdict | Problem | Proposed fix to the case or the spec |
|---|---|---|---|---|
| `n01-duplicate-id-distinct-content` | `tenet/specs/tech-spec/kernel.md:24`, `tenet/specs/tech-spec/algorithms.md:99` | matches | None (`README.md:20` cites old lines 14 and 76). | Refresh `README.md:20` line references. |
| `n02-missing-predecessor-and-orphan-chain` | `tenet/specs/tech-spec/kernel.md:25`, `tenet/specs/tech-spec/algorithms.md:100` | matches | None (`README.md:21` cites old lines 15 and 77). | Refresh `README.md:21` line references. |
| `n03-cycle-and-cross-work-edge` | `tenet/specs/tech-spec/kernel.md:26-27`, `tenet/specs/tech-spec/algorithms.md:111` | matches | None (`README.md:22` cites old lines 16–17 and 88). | Refresh `README.md:22` line references. |
| `n04-no-creation-and-competing-creations` | `tenet/specs/tech-spec/kernel.md:21-22`, `answers-r10.md:9` | matches | None (`README.md:23` cites old lines 11–12, 25). | Refresh `README.md:23` line references. |
| `n05-stale-forge-and-incomplete-resolve` | `tenet/specs/plan/alpha.1.md:26`, `tenet/specs/tech-spec/kernel.md:31`, `answers-r10.md:17,23` | matches | Same `pack.legal_edges` gap as `p04` (`01` `define` → `03` `verify` is absent from `legal_edges`, though conflict still triggers). | Align edge with `p04`/`p05` rule (D-2). |
| `n06-unsupported-legacy-version` | `tenet/specs/plan/alpha.1.md:26`, `tenet/specs/tech-spec/kernel.md:52`, `answers-r10.md:14` | matches | `input.json:4` uses `"conclusion": "success"` rather than a `0.1.0`/`0.1.1` `ProofCard` (`src/verify/records.ts:37`), though `schema_version: 99` still triggers `TN-SCHEMA`. | Replace mock `proof/` JSON in `input.json:4` with a real `ProofCard` structure keeping `schema_version: 99`. |
| `p01-subject-exclusions-and-byte-sort` | `tenet/specs/tech-spec/algorithms.md:30-36`, `tenet/specs/tech-spec.md:80` | matches | Digest verified byte for byte (`README.md:11` cites old lines 9–15 and 60; `now.html` not in fixture). | Refresh `README.md:11` line references. |
| `p02-reduce-linear-and-merge-disjoint` | `tenet/specs/tech-spec/kernel.md:28-29,35-36`, `tenet/specs/tech-spec/algorithms.md:101,109` | matches | None (`README.md:12` cites old lines). | Refresh `README.md:12` line references. |
| `p03-reduce-permutation-and-idempotent-dup` | `tenet/specs/tech-spec/kernel.md:17,23`, `tenet/specs/tech-spec/algorithms.md:99,101` | matches | None (`README.md:13` cites old lines). | Refresh `README.md:13` line references. |
| `p04-reduce-conflict-and-resolve` | `tenet/specs/tech-spec/kernel.md:28,30-31`, `tenet/specs/tech-spec/algorithms.md:102-110` | unclear | `04` moves from `define` (`02`) to `verify`, which is absent from `pack.legal_edges` (`define -> build`, `build -> verify`), yet `expected.json:4` applies it; `kernel.md:28` ("using the pack's legal edges") does not state whether `reduce()` rejects illegal edges or leaves edge checks to `gate`. | Clarify in `kernel.md:28` whether `reduce()` enforces `legal_edges`, or add a `build` step / update `legal_edges` in `p04` (D-2). |
| `p05-reduce-resolve-then-reopen` | `tenet/specs/tech-spec/kernel.md:31`, `tenet/specs/tech-spec/algorithms.md:110` | unclear | Same `legal_edges` omission (`define -> verify` on `04`, `define -> integrate` on `06`); also `expected.json:4` expects conflict head `05` (the `resolve` event) vs retained `work.moved` `04`, which `kernel.md:31` and `ALG-05:110` do not specify. | Clarify `kernel.md:31` / `algorithms.md:110` on `resolve` acting as the post-resolution head and resolve `legal_edges` behavior (D-2). |
| `p06-forge-observations-ready-draft-merged-closed` | `tenet/specs/plan/alpha.1.md:26`, `tenet/specs/tech-spec/kernel.md:39`, `answers-r10.md:17` | matches | None (`README.md:16` cites old line 29 vs 39). | Refresh `README.md:16` line reference. |
| `p07-tentative-move-and-advisory-leases` | `tenet/specs/tech-spec/kernel.md:17,37,42,44`, `answers-r10.md:8,20` | matches | None (`README.md:17` cites old lines 27, 32, 34). | Refresh `README.md:17` line references. |
| `p08-alpha0-records-read-compat` | `tenet/specs/plan/alpha.1.md:26,30`, `tenet/specs/tech-spec/kernel.md:52`, `src/verify/records.ts:18,37,48,52-55` | conflict | All three synthetic records in `input.json:6,10,14` disagree with what `0.1.0` and `0.1.1` write in `src/verify/records.ts`: `proof/` writes `ProofCard` (no `conclusion`), `latest` writes `{id, attempt, startedAt, evaluation_id}` (not `{started_at, path}`), and `rules/*.jsonl` writes `run: {id, attempt}` (not `"1001-1"`). | Replace `input.json:6,10,14` with real `0.1.0`/`0.1.1` `records.ts` outputs (D-5). |
| `p09-alias-collision-and-unusual-paths` | `tenet/specs/tech-spec/contracts.md:32`, `tenet/specs/tech-spec/algorithms.md:30-35`, `src/core/hash.ts:110-126` | matches | Alias and subject digest match; note `src/core/hash.ts:110` `alias()` matches unprefixed codes while `input.json:6` passes `"CP-000000"`, so `deriveAlias` (`CP-0007`) must strip/match `"CP-"`. | Confirm `"CP-"` prefix handling in `deriveAlias` spec/wrapper (`answers-r10.md:20`). |

### Untested rules

1. **[Most important] `readEvents(revision, work)` single batched committed-record read (`plan/alpha.1.md:25-26`, `tech-spec.md:141`)** · Every `reduce` case passes inline JSON events, never testing git object streaming via `git cat-file --batch` · `p10-read-events-batched-git-revision`.
2. **[Most important] Active working-copy leases (`expires_at > asOf`), `lease.released`, and advisory `overlaps(leases, paths)` (`plan/alpha.1.md:25-26`, `answers-r10.md:20`)** · `p07` only tests an expired lease returning `active_leases: []` · `p11-active-leases-and-path-overlap`.
3. **[Most important] `claim.stated` conflict/retirement and `work.closed` vs concurrent state event (`kernel.md:40`, `algorithms.md:106-107`)** · Only `work.moved` and `work.changed` conflicts are tested; concurrent `claim.stated`, `work.status`, and `work.closed` conflicts are untouched · `p12-claim-stated-and-work-closed-conflicts`.
4. Stale forge observation by older timestamp on matching `head_sha` (`answers-r10.md:17`) · `n05` only tests mismatched `head_sha`, not an older timestamp · `n07-stale-forge-older-timestamp`.
5. 1-node self-link cycle (`prev: [self]`) and `readProofRecord` preserving non-empty `unknown_fields` (`kernel.md:26`, `answers-r10.md:14`) · `n03` tests a 2-node cycle and `p08` tests `unknown_fields: []` · `n08-self-link-cycle-and-unknown-record-fields`.
6. Dirty working tree `TN-SUBJ-DIRTY` and 10,000-event batch latency (`algorithms.md:36`, `plan/alpha.1.md:30`) · Neither dirty-tree refusal nor batch scaling is in `events/` · `n09-subject-dirty-worktree`.

## gate

Contract: `CP-0050` ([plan/alpha.1.md:32-40](../../specs/plan/alpha.1.md#L32-L40)). Suite index: [gate/README.md:1-26](../../../pkg/conformance/gate/README.md).

| Case | Tests (path:line) | Verdict | Problem | Proposed fix to the case or the spec |
|---|---|---|---|---|
| `n01-alg07-row3-unknown-applicability` | `tenet/specs/tech-spec/algorithms.md:119,140`, `tenet/specs/tech-spec.md:121` | matches | None (`README.md:21` cites old lines 116 and 101). | Refresh `README.md:21` line references. |
| `n02-alg07-row4-incompatible-policy` | `tenet/specs/tech-spec/algorithms.md:122,141` | matches | None (`README.md:22` cites old lines). | Refresh `README.md:22` line references. |
| `n03-alg06-loosening-refused` | `tenet/specs/tech-spec/algorithms.md:120`, `tenet/specs/tech-spec/messages.md:69` | matches | None (`README.md:23` cites line 97 vs 120). | Refresh `README.md:23` line reference. |
| `n04-expiry-boundary-at-deadline` | `tenet/specs/tech-spec/kernel.md:50`, `tenet/specs/tech-spec/algorithms.md:145` | matches | None (`README.md:24` cites line 40 vs 50). | Refresh `README.md:24` line reference. |
| `n05-approval-for-evidence-claim` | `tenet/specs/tech-spec/algorithms.md:134,145,151` | unclear | `expected.json:4-6` requires exact list `reasons: ["TN-GATE-APPROVE-NOT-EVIDENCE"]`, whereas `ALG-07:134` does not state whether `TN-GATE-APPROVE-NOT-EVIDENCE` replaces `TN-GATE-CLAIM` (row 8) in `reasons[]` or coexists with it (unlike `TN-GATE-SELF-WAIVE` at `ALG-07:154`). | Add one sentence at `algorithms.md:134` stating `TN-GATE-APPROVE-NOT-EVIDENCE` replaces `TN-GATE-CLAIM` in `reasons[]` (or update `n05/expected.json`). |
| `n06-self-waiver-and-unapproved-promotion` | `tenet/specs/tech-spec/algorithms.md:154`, `tenet/specs/tech-spec.md:120,151`, `tenet/specs/tech-spec/messages.md:101-102` | matches | None (`README.md:26` cites old line 100 vs 120). | Refresh `README.md:26` line reference. |
| `p01-alg07-row9-advance` | `tenet/specs/tech-spec/algorithms.md:146,154`, `tenet/specs/tech-spec/kernel.md:50,54` | matches | None (`README.md:11` cites old lines). | Refresh `README.md:11` line references. |
| `p02-alg07-row1-frozen` | `tenet/specs/tech-spec/algorithms.md:138,154` | unclear | `expected.json:10` asserts `"rule": "always-enforce"`, while `algorithms.md:138` writes `always enforce` (without hyphen) and `ALG-07:154` omits the machine literal for `blocking.rule` on rows 1–4. | Specify `blocking.rule: "always-enforce"` for rows 1–4 in `algorithms.md:154` (D-3). |
| `p03-alg07-row2-conflict` | `tenet/specs/tech-spec/algorithms.md:139,154`, `answers-r10.md:19` | unclear | Same unstated `"rule": "always-enforce"` literal in `expected.json:15` (and live `next.command` `"tenet resolve"` lives in `answers-r10.md:19`, with `ALG-07:154` giving only `tenet resolve|decide|escalate|fix`). | Specify `"always-enforce"` for rows 1–4 in `algorithms.md:154` (D-3) and copy row-to-command mapping from `answers-r10.md:19` into `algorithms.md:154`. |
| `p04-alg07-row5-stop-threshold` | `tenet/specs/tech-spec/algorithms.md:142,154`, `answers-r10.md:6,19` | matches | None (`README.md:14` cites old lines 118, 132). | Refresh `README.md:14` line references. |
| `p05-alg07-row6-and-7-human-gates` | `tenet/specs/tech-spec/algorithms.md:143-144,149-151` | matches | None (`README.md:15` cites old lines 119–120). | Refresh `README.md:15` line references. |
| `p06-mixed-advisory-and-enforced` | `tenet/specs/tech-spec/algorithms.md:144-156` | matches | None (`README.md:16` cites old lines 125–132). | Refresh `README.md:16` line references. |
| `p07-monotonicity-adding-enforced-fail` | `tenet/specs/tech-spec/algorithms.md:152` | matches | None (`README.md:17` cites line 128 vs 152). | Refresh `README.md:17` line reference. |
| `p08-alg06-policy-merge-tightening` | `tenet/specs/tech-spec/algorithms.md:120-128`, `tenet/specs/tech-spec.md:121` | matches | None (`README.md:18` cites old lines). | Refresh `README.md:18` line references. |
| `p09-valid-waiver-and-ci10-enforced-fail` | `tenet/specs/tech-spec.md:119-120`, `tenet/specs/tech-spec/ci.md:243` | matches | None (`README.md:19` cites old lines 99–100, 242). | Refresh `README.md:19` line references. |
| `p10-level-and-rules-promotion` | `tenet/specs/plan/alpha.1.md:35-36`, `tenet/specs/tech-spec.md:150-151`, `answers-r10.md:9-11` | matches | None (`README.md:20` cites `TS §6.1` lines 130–131 vs 150–151). | Refresh `README.md:20` line references. |

### Untested rules

1. **[Most important] Fixed 100-PR backtest cohort, `TN-BACKTEST-INCOMPLETE`, and active overhead timing (`plan/alpha.1.md:36,39-40`, `kernel.md:76-78`, `answers-r10.md:22`)** · `INDEPENDENT.md:20` already claims backtest coverage under `gate/`, yet zero cases test complete 100-PR backtests, `< 100` / `incomplete: true` rejection, or `total_active_minutes / 100` · `p11-backtest-complete-and-n07-backtest-incomplete`.
2. **[Most important] Stale input-digest mismatch (`requirement_digest`, `policy_digest`, `acceptance_digest`, `check_definition_digest`, `runner_image_digest`, `lock_digest`) and insufficient evidence strength (`kernel.md:50`, `tech-spec.md:98`)** · Every positive `gate/` case either omits digests on failures or matches all digests cleanly · `n07-stale-inputs-and-insufficient-strength`.
3. **[Most important] Row 8 branches (`builder/revise` when `rounds_remaining > 0` vs `rounds_remaining === 0` human gate) and `waivable: false` / wrong waiver scope (`algorithms.md:145`, `tech-spec.md:120`)** · `n04` covers only missing/expired evidence; `builder/revise`, exhausted rounds, wrong-scope waivers, and unwaivable claims are untested in `gate/` · `p12-row8-rounds-revise-vs-exhausted-and-unwaivable`.
4. `ALG-06` `probabilistic` / `binary` pass-rule merge, incompatible pass-rule kinds, `picomatch` `!` negation, and CODEOWNERS area fallback (`algorithms.md:118-128`) · `p08`/`n03` only test `baseline-relative` tolerance · `p13-alg06-probabilistic-and-negated-paths`.
5. `ruleMode(policy, rule)`, zero-arg `rules()` query, and `level()` `mode_changes` / `warnings` output (`plan/alpha.1.md:35`, `answers-r10.md:9-10`) · `p10` tests only mutating `level` and `rules`, not read queries or computed `mode_changes`/`warnings` · `p14-rule-mode-query-and-level-diff`.

## decisions

Contract: `CP-0019` ([plan/alpha.1.md:42-50](../../specs/plan/alpha.1.md#L42-L50)). Suite index: [decisions/README.md:1-25](../../../pkg/conformance/decisions/README.md).

| Case | Tests (path:line) | Verdict | Problem | Proposed fix to the case or the spec |
|---|---|---|---|---|
| `n01-unlisted-actor-rejected` | `tenet/specs/tech-spec/ci.md:203`, `tenet/specs/tech-spec/messages.md:103`, `answers-r11.md:13` | matches | None. | — |
| `n02-stale-eval-after-description-edit` | `tenet/specs/tech-spec/kernel.md:60`, `tenet/specs/tech-spec/messages.md:109`, `answers-r11.md:14` | matches | None (`README.md:21` cites old line 50 vs 60). | Refresh `README.md:21` line reference. |
| `n03-late-reply-past-expiry` | `tenet/specs/tech-spec/kernel.md:50,60`, `tenet/specs/tech-spec/messages.md:106`, `answers-r11.md:15` | matches | None (`README.md:22` cites old lines 48, 50). | Refresh `README.md:22` line references. |
| `n04-ambiguous-two-pending-requests` | `tenet/specs/tech-spec/kernel.md:60`, `tenet/specs/tech-spec/messages.md:104`, `answers-r11.md:16` | matches | None (`README.md:23` cites line 50 vs 60). | Refresh `README.md:23` line reference. |
| `n05-concurrent-competing-picks` | `tenet/specs/tech-spec/kernel.md:60`, `tenet/specs/tech-spec/messages.md:105`, `answers-r11.md:17` | matches | None (`README.md:24` cites line 50 vs 60). | Refresh `README.md:24` line reference. |
| `n06-revoked-key-and-verify-self-approve` | `tenet/specs/tech-spec/ci.md:207-211`, `tenet/specs/tech-spec/messages.md:107-108` | conflict | In `self-approve-at-verify` (`input.json:546-549,589-594`), `reviewer_login: "tenet-bot"` maps to `bot-owner`, which is **omitted** from `request.allowed_actors: ["ved", "alice"]`; checking `allowed_actors` first or collecting both errors emits `TN-DEC-ACTOR` instead of / alongside `expected.json` exact list `["TN-DEC-SELF-VERIFY"]`. | Add `"bot-owner"` to `request.allowed_actors` at `n06/input.json:546-549`, or state `TN-DEC-SELF-VERIFY` vs `TN-DEC-ACTOR` check order in `ci.md §6` / `kernel.md §3`. |
| `p01-make-and-render-request` | `tenet/specs/tech-spec/kernel.md:58`, `answers-r11.md:5-10` | matches | `request_id` (`sha256:9b2e64de...`) verified byte for byte; note `renderRequest` Markdown format lives only in `answers-r11.md:8-9`, not in `kernel.md` or `ci.md`. | Copy `renderRequest` layout from `answers-r11.md:8-9` into `ci.md §6` or `kernel.md §3`, and refresh `README.md:11`. |
| `p02-native-approve-binds-commit` | `tenet/specs/tech-spec/ci.md:202`, `tenet/specs/tech-spec/kernel.md:60` | matches | None (`README.md:12` cites old line 50 vs 60). | Refresh `README.md:12` line reference. |
| `p03-reply-approve-and-pick` | `tenet/specs/tech-spec/ci.md:203`, `tenet/specs/ux-spec.md:213` | matches | Content digest verified (`README.md:13` cites `UX §3 line 167`, now `ux-spec.md:213`). | Refresh `README.md:13` link to `ux-spec.md:213`. |
| `p04-self-accepted-below-verify` | `tenet/specs/tech-spec/ci.md:208`, `answers-r11.md:21-22` | matches | None. | — |
| `p05-redelivery-and-compatible-duplicates` | `tenet/specs/tech-spec/kernel.md:60`, `tenet/specs/plan/alpha.1.md:46-47` | matches | `input.json:32-49` repeats identical `cmt-901` redelivery; `README.md:15` mentions concurrent compatible approvals, which are not in `input.json`. | Update `README.md:15` (and line 50 → 60) or add a second distinct compatible approval case. |
| `p06-reply-bless-exact-section` | `tenet/specs/tech-spec/ci.md:203,208`, `answers-r11.md:25` | matches | None. | — |
| `p07-reply-not-useful-finding` | `tenet/specs/tech-spec/ci.md:203,208`, `tenet/specs/prd/tooling.md:125`, `answers-r11.md:26` | matches | `input.json` passes `op: "recordAnswer"` with no `request` object; `plan/alpha.1.md:45` signature `recordAnswer(request, event, snapshot)` must allow `request: Request | null`. | Document `request: Request | null` on `recordAnswer` in `plan/alpha.1.md:45`. |
| `p08-withdrawn-observation-kept-visible` | `tenet/specs/tech-spec/kernel.md:60`, `tenet/specs/plan/alpha.1.md:46` | matches | None (`README.md:18` cites line 50 vs 60). | Refresh `README.md:18` line reference. |
| `p09-waiver-by-non-author` | `tenet/specs/tech-spec/kernel.md:60`, `tenet/specs/tech-spec.md:120` | matches | None (`README.md:19` cites old lines 50 and 100). | Refresh `README.md:19` line references. |

### Untested rules

1. **[Most important] Native review on a mismatched commit (`reviewed_commit !== tested_commit`) and native review when two requests are pending (`ci.md:202`, `kernel.md:60`)** · `p02` only tests matching commit with one open request; stale native reviews and multi-request native reviews have no negative case · `n07-stale-or-ambiguous-native-review`.
2. **[Most important] `@<evaluation>` suffix required at `assure` and accepted/rejected on single pending request (`ci.md:203`, `plan/alpha.1.md:46`)** · `n04` tests unqualified reply across two requests at `protect`, leaving `assure`'s mandatory `@<evaluation>` enforcement untested · `n08-assure-requires-evaluation-suffix`.
3. **[Most important] Two distinct concurrent compatible replies and spot check when owner answers PR opened by their own agent session (`kernel.md:60`, `ci.md:209`, `evidence.md:90`)** · `p05` tests only redelivery of the same `source_id`, and nothing tests flagging owner approval on an agent-opened PR · `p10-concurrent-compatible-and-agent-session-flag`.
4. Earlier signature made before key revocation timestamp remains valid (`ci.md:211`) · `n06` tests signing *after* revocation, never confirming historical validity before revocation · `p11-signature-before-key-revocation-valid`.
5. Invalid `/tenet pick <unknown>` choice ID or missing `reason` / wrong `scope` on `/tenet bless` or `waive` (`kernel.md:58,60`) · Invalid choice numbers and malformed reply commands have no negative case · `n09-invalid-choice-and-malformed-reply`.

## full-board

Contract: `CP-0008` ([plan/alpha.1.md:52-60](../../specs/plan/alpha.1.md#L52-L60)). Suite index: [full-board/README.md:1-23](../../../pkg/conformance/full-board/README.md).

| Case | Tests (path:line) | Verdict | Problem | Proposed fix to the case or the spec |
|---|---|---|---|---|
| `n01-no-external-fetch-without-flag` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec/contracts.md:126,163`, `tenet/specs/tech-spec/messages.md:43` | matches | None (`README.md:19` cites old lines 49, 51, 153). | Refresh `README.md:19` line references. |
| `n02-missing-cost-reported-unavailable` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec/contracts.md:107`, `tenet/specs/prd/tooling.md:50` | matches | None (`README.md:20` cites line 86 vs 107). | Refresh `README.md:20` line reference. |
| `n03-conflict-heads-visible` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec/contracts.md:107`, `kit/schemas/board.json:532-538` | conflict | `expected.json:8-16` asserts `conflicts: [{work: "pr-11", heads: [...]}]`, while `kit/schemas/board.json:532-538` defines `conflicts` as `string[]` and `contracts.md:107` gives no object shape. | Extend `kit/schemas/board.json:532-538` and `contracts.md:107` for `conflicts: [{work, heads}]` in `CP-0008` (D-4). |
| `n04-stale-trust-observation-downgraded` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec/evidence.md:92`, `answers-r11.md:21` | matches | None (`README.md:22` cites line 82 vs 92). | Refresh `README.md:22` link to `evidence.md:92`. |
| `n05-changed-ref-or-tampered-event` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec.md:246`, `tenet/specs/tech-spec/messages.md:80,110` | matches | Matches `tech-spec.md:246` and `answers-r11.md:21`; note `kit/schemas/board.json` and `contracts.md:107` do not yet declare `findings[]`. | Add optional `findings[]` to `contracts.md:107` and `kit/schemas/board.json` in `CP-0008` (D-4). |
| `p01-empty-repository-and-change-set` | `tenet/specs/plan/alpha.1.md:54,56`, `tenet/specs/tech-spec/contracts.md:107` | matches | None (`README.md:11` cites line 86 vs 107). | Refresh `README.md:11` line reference. |
| `p02-tentative-move-and-justified-station` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec/contracts.md:107`, `kit/schemas/board.json:236-443` | conflict | `expected.json:5-7` asserts `items[0].justified_station` and `items[0].tentative`, absent from `contracts.md:107` and rejected by `kit/schemas/board.json:236`. Also `input.json:2` sets `op: "projectAndRender"` without asserting `renderBoard` output. | Add optional `justified_station` and `tentative` to `items[]` in `contracts.md:107` and `kit/schemas/board.json` in `CP-0008` (D-4). |
| `p03-active-items-modes-next-actions-cost` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec/contracts.md:107`, `kit/schemas/board.json:6,337-379` | conflict | Two conflicts: (1) `expected.json:14-19` puts integers on `items[0].claims`, while `kit/schemas/board.json:343-378` requires `string[]` arrays; (2) `expected.json:22-26` adds top-level `"modes"`, absent from `contracts.md:107` and rejected by `kit/schemas/board.json:6`. | Either fix `expected.json:14-19` to ID arrays (`string[]`) or update `kit/schemas/board.json:343-378`, and decide `"modes"` on `board.json` (`contracts.md:107`, D-4). |
| `p04-since-delta-filter` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec.md:246`, `kit/schemas/board.json:6`, `answers-r11.md:18` | conflict | `expected.json:2` expects top-level `"since": "commit-before-pr8"`, which `contracts.md:107` omits and `kit/schemas/board.json:6` rejects (`additionalProperties: false`). | Add optional `since` to `board.json` or drop `"since"` from `expected.json:2` and add real git-rev filtering inputs (D-4). |
| `p05-alpha0-legacy-records-read` | `tenet/specs/plan/alpha.1.md:56`, `src/verify/records.ts:37,52-55`, `kit/schemas/board.json:6,539-546` | conflict | Three conflicts: (1) `input.json:6-25` mock alpha.0 records disagree with `src/verify/records.ts` (`"conclusion": "success"` vs `ProofCard`, `"run": "100-1"` vs `{id, attempt}`); (2) `expected.json:2-3` uses unspec'd `legacy_records_count` / `decisions_count`; (3) `flow.cost` fails `kit/schemas/board.json:540-545` (`flow` has empty `properties: {}`). | Update `input.json` to `src/verify/records.ts` formats, replace count fields with `items[]`/`flow`/`friction`, and expand `flow` in `kit/schemas/board.json` (D-4, D-5). |
| `p06-friction-and-self-accepted` | `tenet/specs/plan/alpha.1.md:56`, `tenet/specs/tech-spec/contracts.md:107`, `kit/schemas/board.json:6,236`, `answers-r11.md:10-11` | conflict | Three conflicts: (1) `expected.json:16-18` asserts top-level `merged_self_accepted` vs `answers-r11.md:11` (`items[].self_accepted`); (2) `expected.json:5` uses `"would_block": 2` vs `expected.json:12` and `answers-r11.md:10` (`"refusals"`); (3) `friction`, `self_accepted`, `merged_self_accepted` are absent from `contracts.md:107` and `kit/schemas/board.json`. | Fix `p06/expected.json` to `items[].self_accepted` and `"refusals"`, and add `friction` / `items[].self_accepted` to `contracts.md:107` and `kit/schemas/board.json` (D-4). |
| `p07-single-file-html-self-contained` | `tenet/specs/plan/alpha.1.md:55`, `answers-r11.md:15` | matches | `input.json:8` hardcodes `read.main: "9f3c2e1"` without `AB-A11` branch header context, though HTML self-containment still holds. | Optionally include `branch` metadata in `renderBoardHtml` cases after `CP-0066 AB-A11`. |
| `p08-untracked-generated-views-and-open` | `tenet/specs/plan/alpha.1.md:54,56`, `tenet/specs/tech-spec.md:246` | matches | None. | — |

### Untested rules

1. **[Most important] `renderBoard(board).markdown` sections (`Waiting for you`, `Blocked`, `Changed since you looked`, `Friction`, `Flow`), `AB-A11` file-grouped specs, and branch header (`plan/alpha.1.md:55`, `ux-spec.md:193-205`, `answers-r11.md:14`)** · Zero cases assert Markdown output even though `p02`, `p03`, and `p06` invoke `projectAndRender` · `p09-render-board-markdown-sections-and-specs`.
2. **[Most important] `tenet board --since <invalid-ref>` failing with `TN-USAGE-REF` (exit 2), plus `--since` filtering `decision_queue`, `review_queue`, and `specs` (`plan/alpha.1.md:56`, `tech-spec.md:246`, `answers-r11.md:18`)** · `p04` uses a mock boolean flag on `works[]` only and never tests `TN-USAGE-REF` · `n06-since-invalid-ref-and-queue-deltas`.
3. **[Most important] Full `flow` metrics (`verified_per_week_by_lane`, `lead_time_hours`, `lane_mix_quick_express_pct`, `decision_wait_hours`, `escapes`, `autonomy_share`), `decision_queue`, `review_queue`, `active_runs`, `areas`, `campaigns`, `escalations`, and `next_actions` (`plan/alpha.1.md:56`, `answers-r11.md:6-9`)** · `p05` asserts only `flow.cost.status`; none of the other metrics or queues have assertions · `p10-flow-metrics-queues-areas-and-next-actions`.
4. Explicit `tenet board --fetch` succeeding (`fetched_external_refs: true`) and `R-082` latency workload (500 packets, 10,000 events, 5,000 commits cold/warm) (`plan/alpha.1.md:57,59-60`, `prd/tooling.md:115`) · `n01` tests refusal/no-fetch only, leaving `--fetch` success and `R-082` performance uncovered · `p11-explicit-fetch-and-r082-benchmark`.
5. `false_blocks_per_100 > 2` triggering `flagged_for_demotion: true`, below-threshold `flagged_for_demotion: false`, and never-observed trust returning `guarantee: "unavailable"` (`plan/alpha.1.md:56`, `answers-r11.md:10,21`) · `p06` tests only `not_useful_pct > 10` and `n04` tests only stale trust > 7d · `p12-friction-false-blocks-and-unobserved-trust`.

## evaluator-trial

Contract: `plan.md §4` ([plan.md:206](../../specs/plan.md#L206)), `CP-0050` ([plan/alpha.1.md:40](../../specs/plan/alpha.1.md#L40)), [kernel.md §2:48-55](../../specs/tech-spec/kernel.md#L48-L55). Files: [history.yaml](../../../pkg/conformance/evaluator-trial/history.yaml), [expected.json](../../../pkg/conformance/evaluator-trial/expected.json).

| Case | Tests (path:line) | Verdict | Problem | Proposed fix to the case or the spec |
|---|---|---|---|---|
| `evaluator-trial` (`history.yaml`, `expected.json`) | `tenet/specs/plan.md:206`, `tenet/specs/plan/alpha.1.md:40`, `tenet/specs/tech-spec/kernel.md:50,54`, `tenet/specs/tech-spec/algorithms.md:130-155` | conflict | `history.yaml` uses claim-keyed `rules: {"AB-1": ...}`, string-array `cases`, `{report_status, expected_tag}` payload, 6-digest `inputs`, and omits `author_of_change`; `expected.json` uses `{evaluations: [{id, verdict, disposition, next}]}` absent from `kernel.md:54` and `ALG-07:154`. No row in `INDEPENDENT.md`. | Align `history.yaml` with `gate/` / `evidence.md §1` / `TS §6.1`, document projection shape in `kernel.md:54`, and add a row in `pkg/conformance/INDEPENDENT.md` (D-5). |

### Untested rules

1. **[Most important] Failed check with `rounds > 0` (`builder/revise`) and unresolved conflict (`owner/resolve`) (`kernel.md:54`, `algorithms.md:139,145`)** · `evaluator-trial` covers only `advance` (`who: null`) and `ci/wait-for-evidence`, leaving three of the five machine actions named in `kernel.md:54` untested · `evaluator-trial-revise-decision-and-conflict`.

## Drift since the cases were written

| Change | Cases affected | What to change |
|---|---|---|
| CP-0066 `AB-C3` (`card.why` / `degraded` note when head changes check command: `src/verify/record.ts:438-453`, `contracts.md §5:105`, `ci.md §2:57`) | Indirectly `events/p08-alpha0-records-read-compat`, `events/n06-unsupported-legacy-version`, `full-board/p05-alpha0-legacy-records-read` | Those cases store synthetic `proof/` records (`{"conclusion": "success"}`) rather than real `ProofCard` objects (`kit/schemas/proof-card.json:472-499`), which can carry `why: [{text, class: "not-tenet"}]` (`AB-C3`). Update those three fixtures to real `ProofCard` JSON and add a `not-tenet` `why` entry on at least one `p08` / `p05` card. |
| CP-0066 `AB-A11` (`read.main` from `origin/HEAD`/candidates, branch+commit header, file-grouped specs, indented open items: `contracts.md §5:107`, `ux-spec.md:193-205`, `src/views/specs-board.ts:153-186,522-579`) | Indirectly `full-board/p01`, `p02`, `p03`, `p06`, `p07` | Existing `full-board/` cases skip `renderBoard(board).markdown` and `read.main` resolution. Add a `full-board/` Markdown rendering case checking `<repo> · <branch> <rev> · level <level>`, file-grouped specs, and indented `Open conflicts:` / `Open questions:`. |
| CP-0066 `AB-E2` (`.anchors.json` sidecar stores `{hash, start, end, blessed_at_rev}` without cited source text: `contracts.md §3:76`, `algorithms.md:61,68`) | None in `kernel-schemas/`, `events/`, `gate/`, `decisions/`, `full-board/`, or `evaluator-trial/` | No action needed in the alpha.1 suites (anchors live in `alg-03/`, `install/`, and `scenarios/`). |
| `0.1.0` and `0.1.1` now write real `refs/tenet/records` files (`src/verify/records.ts:18,31-59`: `proof/...json` = `ProofCard`, `latest` = `RunLocator {id, attempt, startedAt, evaluation_id}`, `rules/*.jsonl` = `run: {id, attempt}`) | `events/p08-alpha0-records-read-compat`, `events/n06-unsupported-legacy-version`, `full-board/p05-alpha0-legacy-records-read` | Replace `conclusion: "success"` with full `ProofCard` JSON (`kit/schemas/proof-card.json`), replace `latest` `{"started_at", "path"}` in `events/p08` with `{"id", "attempt", "startedAt", "evaluation_id"}`, and replace `"run": "1001-1"` / `"100-1"` with `{"id": ..., "attempt": 1}` in `events/p08` and `full-board/p05`. |

## Evaluator trial runbook

### Inputs

1. Start from a clean build of the repository (`npm ci && npm run build`) so `dist/sdk.js` and `dist/core/hash.js` exist.
2. Open two fresh, isolated sessions (**Session A** and **Session B**) of the same model family and effort level. Neither session may read the other's outputs, `pkg/conformance/evaluator-trial/expected.json`, `pkg/conformance/gate/`, `pkg/evals/`, or earlier trial logs.
3. Give each session **only**:
   - Fixture input: `pkg/conformance/evaluator-trial/history.yaml`
   - Normative rules:
     - `tenet/specs/tech-spec/kernel.md` §1–§2 (`lines 15–55`)
     - `tenet/specs/tech-spec/algorithms.md` `ALG-06`, `ALG-07` (`lines 115–156`)
     - `tenet/specs/tech-spec.md` §3–§4, §6.1 (`lines 74–126, 145–190`)
     - `tenet/specs/tech-spec/contracts.md` §1, §11 (`lines 26–41, 147–150`)
     - `tenet/specs/tech-spec/ci.md` §1, §3, §6, §10 (`lines 31–54, 149–160, 194–212, 225–246`)
4. Have Session A and Session B write their JSON output and assumption log outside git-tracked paths (for example `.tenet/cache/evaluator-trial/session-a.json` + `.tenet/cache/evaluator-trial/session-a-notes.md`, and `session-b.json` + `session-b-notes.md`). `.tenet/*` is git-ignored.

### Session prompt

Paste this prompt into each fresh session, replacing `<SESSION>` with `a` or `b`:

```text
You are an independent evaluator for Tenet alpha.1 (Session <SESSION>).

Rules:
- Read ONLY these files:
  1. pkg/conformance/evaluator-trial/history.yaml
  2. tenet/specs/tech-spec/kernel.md (§1 and §2)
  3. tenet/specs/tech-spec/algorithms.md (ALG-06 and ALG-07)
  4. tenet/specs/tech-spec.md (§3, §4, and §6.1)
  5. tenet/specs/tech-spec/contracts.md (§1 and §11)
  6. tenet/specs/tech-spec/ci.md (§1, §3, §6, and §10)
- Do NOT read pkg/conformance/evaluator-trial/expected.json, pkg/conformance/gate/, pkg/evals/, or src/.
- Do NOT modify any tracked repository file.

Task:
1. Evaluate each entry in pkg/conformance/evaluator-trial/history.yaml under evaluations[] in exact order using the normative rules above.
2. Project the results to JSON matching this shape and write it to .tenet/cache/evaluator-trial/session-<SESSION>.json:
   {
     "evaluations": [
       {
         "id": "<evaluation.id>",
         "verdict": "advance | human gate | refuse",
         "disposition": "records | advises | blocks",
         "next": {
           "who": "<string or null>",
           "action": "<string>",
           "command": null
         }
       }
     ]
   }
3. Write every rule, default value, field meaning, or missing input you had to infer or invent (naming the evaluation ID and exact uncertainty) to .tenet/cache/evaluator-trial/session-<SESSION>-notes.md.
```

### Scoring

1. Serialize `expected.json`, `session-a.json`, and `session-b.json` using the repository's RFC 8785 implementation: `jcs(value)` in `src/core/hash.ts:88-90` (re-exported by `src/sdk.ts:6` and built to `dist/sdk.js`).
2. Run this comparison from the repository root:

PowerShell (Windows):

```powershell
@'
import { readFileSync } from "node:fs";
import { jcs } from "./dist/sdk.js";

const expected = jcs(JSON.parse(readFileSync("pkg/conformance/evaluator-trial/expected.json", "utf8")));
const sessionA = jcs(JSON.parse(readFileSync(".tenet/cache/evaluator-trial/session-a.json", "utf8")));
const sessionB = jcs(JSON.parse(readFileSync(".tenet/cache/evaluator-trial/session-b.json", "utf8")));

console.log({
  a_matches_expected: sessionA === expected,
  b_matches_expected: sessionB === expected,
  a_matches_b: sessionA === sessionB,
  expected_bytes: Buffer.byteLength(expected, "utf8"),
});
if (sessionA !== expected) console.error("Diff A vs expected:\n", sessionA, "\nvs\n", expected);
if (sessionB !== expected) console.error("Diff B vs expected:\n", sessionB, "\nvs\n", expected);
if (sessionA !== expected || sessionB !== expected || sessionA !== sessionB) process.exit(1);
'@ | node --input-type=module -
```

POSIX shell (`bash` / `zsh`, macOS and Linux):

```bash
node --input-type=module - <<'EOF'
import { readFileSync } from "node:fs";
import { jcs } from "./dist/sdk.js";

const expected = jcs(JSON.parse(readFileSync("pkg/conformance/evaluator-trial/expected.json", "utf8")));
const sessionA = jcs(JSON.parse(readFileSync(".tenet/cache/evaluator-trial/session-a.json", "utf8")));
const sessionB = jcs(JSON.parse(readFileSync(".tenet/cache/evaluator-trial/session-b.json", "utf8")));

console.log({
  a_matches_expected: sessionA === expected,
  b_matches_expected: sessionB === expected,
  a_matches_b: sessionA === sessionB,
  expected_bytes: Buffer.byteLength(expected, "utf8"),
});
if (sessionA !== expected) console.error("Diff A vs expected:\n", sessionA, "\nvs\n", expected);
if (sessionB !== expected) console.error("Diff B vs expected:\n", sessionB, "\nvs\n", expected);
if (sessionA !== expected || sessionB !== expected || sessionA !== sessionB) process.exit(1);
EOF
```

3. **Recording each invented rule:** Read `.tenet/cache/evaluator-trial/session-a-notes.md` and `session-b-notes.md`. Log every rule, default, or missing input either session invented in a scorer log (`tenet/packets/CP-0050-gate-rule-modes-level-and-rules/evidence/evaluator-trial-log.md` or equivalent) using one row per item:

   `| Item | Session (A/B/Both) | Evaluation ID | Rule or input invented | Changed behavior between A & B? | Spec fix (path:line) |`

### Pass rule

The trial passes only when all four conditions hold (per `tenet/specs/plan.md:206` and `tenet/ledger/L-0037-trial-accepted.md:18,28`):
1. `jcs(sessionA)` equals `jcs(expected.json)` byte for byte (`a_matches_expected: true`).
2. `jcs(sessionB)` equals `jcs(expected.json)` byte for byte (`b_matches_expected: true`).
3. `jcs(sessionA)` equals `jcs(sessionB)` byte for byte (`a_matches_b: true`, exit code `0`).
4. Every invented rule logged by Session A or B is either fixed in the specifications before freezing `alpha.1`, or shown to be purely defensive with **zero divergent behavior** between A and B. Any rule that causes divergence between A and B, or differs from `expected.json`, fails the trial and requires a spec fix and a fresh re-run.

### Mismatches with today's contracts

1. **`policy.rules` and `policy_revisions[].modes` key by claim ID (`history.yaml:4, 28-33, 40-41`)**: They use `{"AB-1": "advise"}` / `{"AB-1": "enforce"}`, and `claims[0]` (`history.yaml:6`) has no `rule` field. Today's `tech-spec.md:151,176` and `gate/` fixtures key `policy.rules` by rule registry ID (`"acceptance-passed"`) and carry `claim.rule`.
2. **`evidence[].cases` uses string arrays (`history.yaml:9-11`)**: `E-missing`, `E-old-pass`, and `E-fresh-pass` set `cases: {expected: ["case-1"], executed: [...], passed: [...], skipped: []}`, whereas `evidence.md:78`, `kit/schemas/proof-card.json:108-136`, `kernel-schemas/p02`, and `gate/` fixtures use integer counts (`expected: 1`, etc.).
3. **`evidence[].payload` uses `{report_status, expected_tag}` (`history.yaml:9-11`)**: `evidence.md:21` defines `kind: "check"` payloads as `{report_digest, log_hash, fix_hints}`.
4. **`evaluation_inputs` / `evidence[].inputs` key names (`history.yaml:4, 9-11, 28-33`)**: Uses `{requirement_digest, policy_digest, check_definition_digest, runner_image_digest, lock_digest, acceptance_digest}` (matching `gate/`), whereas `tech-spec.md:83` lists `{runner_image, lockfile, check_definition}` and `contracts.md:37` defines `Evaluation ID` from `{repository, work, tested_commit, base, acceptance_digest, implemented, policy_blob, tenet_version}`.
5. **Implicit non-self-waiver and omitted `valid_until` / `strength` (`history.yaml:3-6, 10-11, 14`)**: `work` and `D-waive` omit `author_of_change` (leaving non-self-waiver implicit); `E-old-pass` and `E-fresh-pass` omit `valid_until`; `policy` omits `strength` minimums for `lane: "careful"` (`tech-spec.md:98` defaults to `different-definition`, which `E-old-pass`/`E-fresh-pass` happen to satisfy).
6. **Projection schema unstated in specs (`history.yaml:27`, `expected.json:1-64`)**: `expected.json` emits `{"evaluations": [{"id", "verdict", "disposition", "next": {"who", "action", "command"}}]}`, whereas `ALG-07:154` outputs `{claims, verdict, disposition, lead, reasons, next, blocking?, evaluated_at, snapshot}`. Neither `kernel.md:54` nor `algorithms.md:154` specifies the `evaluations[]` outer wrapper.
7. **Missing index entry (`pkg/conformance/INDEPENDENT.md`)**: `evaluator-trial/` is referenced by `plan.md:206` and `plan/alpha.1.md:40` without a row in `INDEPENDENT.md`.

## Owner decisions

- **D-1** · Should `kit/schemas/finding.json` add an optional `pointer` field for `migratePacket`, or should `kernel-schemas/n06-migrate-malformed-legacy-packet` drop `"pointer"`? · Options: `(a)` Keep `finding.json` strict without `pointer` and remove `"pointer"` from `n06/expected.json` (putting the pointer inside `TN-SCHEMA`'s `message` per `messages.md:77`, or `x-pointer`); `(b)` Add optional `pointer?: string | null` to `kit/schemas/finding.json` and `contracts.md:135`. · Recommendation: `(a)` Keep `finding.json` strict and fix `n06/expected.json`. · Why: `finding.json` already ships across all `0.1.0`/`0.1.1` commands, and `messages.md:77` already places `{pointer}` in `TN-SCHEMA`'s `message`.
- **D-2** · Does `reduce()` (`CP-0007`) enforce `pack.legal_edges` on `work.moved` events, and does a `resolve` event itself become the conflict head (`events/p04`, `events/p05`)? · Options: `(a)` Enforce `legal_edges` in `reduce()` and rewrite `p04`/`p05` to legal step-by-step moves; `(b)` Keep `reduce()` purely causal on `work.moved` (checking `legal_edges` in `tenet move`/`gate`), clarify `kernel.md:28`, and state in `kernel.md:31` / `ALG-05:110` whether the `resolve` event itself (`05`) is the active head. · Recommendation: `(b)` Keep `reduce()` causal without rejecting edges, and state `resolve` head semantics in `kernel.md:31` / `ALG-05:110`. · Why: Forge state jumps (`ready_for_review` / `converted_to_draft`, `p06`) and partial histories must reduce cleanly without blocking state replay.
- **D-3** · What literal string goes in `blocking.rule` for `ALG-07` rows 1–4 (`gate/p02`, `gate/p03`)? · Options: `(a)` Document `"always-enforce"` in `algorithms.md:154`; `(b)` Use `null` or row-specific synthetic rule names (`"frozen"`, `"conflict"`, etc.) and update `gate/p02`–`p03`. · Recommendation: `(a)` Document `"always-enforce"` in `algorithms.md:154`. · Why: Avoids changing `gate/p02`–`p03` and keeps `blocking.rule` a non-null string.
- **D-4** · Should `CP-0008` expand `kit/schemas/board.json` and `contracts.md §5` to include the alpha.1 board fields while fixing inconsistent `full-board/` cases? · Options: `(a)` Expand `kit/schemas/board.json` and `contracts.md:107` in `CP-0008` (`justified_station`, `tentative`, `self_accepted`, `flow`, `friction`, `conflicts: [{work, heads}]`, `findings`, `modes?`, `since?`) and fix `full-board/p03` (`claims` IDs vs counts), `p05` (remove invented counts), and `p06` (`items[].self_accepted`, `"refusals"`); `(b)` Keep alpha.0 `kit/schemas/board.json` strict and move alpha.1 fields under `x-` keys. · Recommendation: `(a)` Expand `kit/schemas/board.json` and `contracts.md §5` in `CP-0008`, and align `p03`/`p05`/`p06` with `answers-r11.md`. · Why: Alpha.0 `board.json` intentionally left `flow: {}` and `conflicts: [string]` as stubs awaiting `CP-0008`.
- **D-5** · Should `events/p08`, `events/n06`, `full-board/p05`, and `evaluator-trial/history.yaml` be refreshed to `0.1.0`/`0.1.1` record formats and `gate/` conventions before running the evaluator trial? · Options: `(a)` Update those four fixtures and `INDEPENDENT.md` before `CP-0007`/`CP-0050`/`CP-0008` start and before running the evaluator trial; `(b)` Keep the existing fixtures untouched and add separate `0.1.1` compatibility fixtures. · Recommendation: `(a)` Refresh the fixtures and add the `evaluator-trial/` row to `INDEPENDENT.md` first. · Why: Builders must validate against real `src/verify/records.ts` outputs, and `plan.md:206` gates the `alpha.1` freeze on the evaluator trial matching today's contracts.
