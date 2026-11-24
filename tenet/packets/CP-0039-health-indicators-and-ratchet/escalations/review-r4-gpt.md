# CP-0039 independent definition review · round 4 (GPT)

Reviewed `shape/cp-0039` at `8d6aec7` against `origin/main` at `7400a0e`. Read the v4 definition, cited research, `response-r3.md`, all previous GPT reviews, and MAI reviews for rounds 2 and 3 from the shaping branch. The MAI round 1 review remains unavailable in the shaping tree and available review refs. Definition line numbers below refer to v4.

## Earlier GPT findings

| Round 1 | Status | Reason |
|---|---|---|
| F1 | Maintained | The baseline uses signed-first writes, universal eligibility and basis-bound IDs. Recovery after a reset and authority at the instant of merge remain open (round 4 F1–F2). |
| F2 | Maintained | §3.4 disqualifies self-declared coverage. The supervised path still confuses requested work with proven work and lacks a receipt binding (F3). |
| F3 | Resolved | §3.2 keeps enforced scalar comparisons on the area baseline and uses exact tolerance arithmetic. |
| F4 | Maintained | Pinned operands, referenced paths and per-file multisets are present. Strict zero-credit hunk enforcement can still refuse unchanged recorded debt (F4). |
| F5 | Resolved | §3.3 removes the universal 20-line skip and AB-6 checks a one-line regression. |
| F6 | Resolved | §§3.2 and 4 now specify target-owned module mapping, the complete directed edge input, cyclic-edge identity and bounded hints. Admission of that graph is part of F3. |
| F7 | Maintained | §3.4 closes the selector-layer loophole. The indicator mode and required-check precedence from v3 are absent or inconsistent in v4 (F5). |
| F8 | Maintained | Approval and recovery records are now required. The integration inventory and expiry interface still lack the data needed to enforce readiness (F1, F6). |
| F9 | Maintained | §3.5 defines first-parent streams, source-specific times and budget gaps. Exact window projection and resumable line lineage remain undefined (F7). |
| F10 | Resolved | Stable change keys, sorted owner sets, adjudication and sample handling are explicit in §3.6 and AB-10. |
| F11 | Resolved | §2 retains tool-neutral interfaces, CP-0036 ownership, and the R-227 and DEC-38 deferrals. |
| F12 | Resolved | §3.6 and AB-11 preserve unknown status, budget shared heads and overflow to a stored card. |
| F13 | Resolved | §1 attributes the fix-rate result and limits the model figures to benchmark conditions. |

| Round 2 | Status | Reason |
|---|---|---|
| F1 | Maintained | Policy and receipt epochs are named. The old pointer can prevent authorized reset recovery, and a fresh check run is not an atomic merge permit (F1–F2). |
| F2 | Maintained | Actual scope moves into a runner receipt, but the document does not establish how the independent receipt proves completion or binds report bytes (F3). |
| F3 | Resolved | Area-only scalar enforcement and exact arithmetic are retained. |
| F4 | Maintained | Diff attribution gained explicit operands and dependency paths. Hunk enforcement no longer needs absent line locations but now loses legacy-debt credit (F4). |
| F5 | Resolved | SCC-based cyclic edges, complete graph inputs and target-owned module maps define the architecture comparison unit. |
| F6 | Maintained | Report thresholds are prohibited and inherited exclusions cannot narrow scope. V4 leaves competing rules for required reports, missing baselines and effective mode (F5). |
| F7 | Maintained | `waived` remains separate from verification and `Decision.expiry` is canonical. Fresh merge authority and complete exception replay remain open (F1, F6). |
| F8 | Maintained | Integration receipts and a bounded cursor are introduced. Daily aggregates cannot reconstruct arbitrary exact windows and line state is unspecified (F7). |
| F9 | Resolved | §3.4 routes only attributed suppressions and established weakening to the gate. Unrelated markers and clean tests are diagnostic. |
| F10 | Resolved | Rolling window, stable keys and minimum sample handling remain specified. |

| Round 3 | Status | Reason |
|---|---|---|
| F1 | Maintained | Universal `canTighten` and versioned `health_basis_digest` close the retry predicate and ID defects. Reset recovery and integration-time freshness still need an implementable transition (F1–F2). |
| F2 | Maintained | Self-declared receipts are now expressly advisory. A supervised invocation still does not prove per-unit completion or output ownership (F3). |
| F3 | Maintained | The new strict-hunk algorithm is computable. It can now block a pre-existing unchanged diagnostic and can miss repeated reference regressions (F4). |
| F4 | Resolved | The graph payload carries acyclic edges and the target owns module identities. Hint work is bounded separately. Evidence trust is tracked under F3. |
| F5 | Resolved | The population digest covers effective area source and membership selectors, and inherited narrowing or added exclusions are refused. |
| F6 | Maintained | Attested integration, waiver and recovery records are specified conceptually. No complete admission/sequence interface tells the reader an exception is missing, and the forge refresh does not close the time race (F1, F6). |
| F7 | Maintained | Gap-aware checkpoints and dated buckets address the previous full-rescan problem. The snapshot still cannot reproduce exact window and rewrite results (F7). |
| F8 | Maintained | All SARIF runs and producer exclusivity are covered. The declared matrix policy does not map required shards or define their value reduction (F8). |
| F9 | Resolved | §3.4 and AB-9 distinguish attributed suppression from unrelated markers and avoid a routine quick-lane review step. |

## Round 4 findings

### F1 · blocker — Asynchronous status refresh does not make merge authorization atomic

**Definition lines 40–42 and AB-4/AB-8 lines 106, 110:** “**Atomic integration trigger (`tenet.yml` + `CP-0035`):**” and “Merge-time gate evaluates the exact candidate against `<base>`, live signed `health/baseline.json`, active exceptions, and injected `now`, **failing closed** if status refresh is unavailable or marks **`stale-baseline` / `TN-WAIVER-EXPIRED`**.”

A required check can pass for candidate C at time T. A records-only tightening or waiver expiry can occur after T and before the forge merges C. C's Git revision is unchanged. The named push, schedule and PR events are asynchronous, and a records-only write need not trigger the default-branch push sweep at all. Internal `evaluation_id` freshness does not invalidate the previous forge success. GitHub merge limits can even delay merging a group after it has satisfied its checks. There is no named actor or authority at the irreversible transition that checks the current basis and expiry. A passing test that changes the baseline before `merge_group` starts does not exercise this race. See R-152/R-175 (`tenet/specs/prd/catalog.md:16,35`), R-203 (`tenet/specs/prd.md:85`), `tenet/specs/tech-spec/kernel.md:40,72`, CP-0035 (`tenet/specs/plan/0.1.x.md:21`). [GitHub merge queues](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), [GitHub scheduled workflow limits](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)

**Acceptance.** Define and demonstrate a host capability that validates live candidate, basis and deadline at the transition, or serialize basis updates and admission under a demonstrated merge authority. If the reference forge cannot provide the needed concurrency guarantee, report this as detected for that binding and seek approval for the narrower guarantee, or withhold unattended merges for claims that require it. Use an independent race fixture where a candidate already holds success, the basis changes or the waiver reaches its deadline, and no asynchronous refresh has executed before the merge attempt.

### F2 · blocker — An authorized reset can strand the writer and signed recovery has no unique successor

**Definition lines 29–39:** “`committed` wins (`reset`)”; “Inside the 8-retry CAS loop … check tip `(base_reset_seq, base_config_digest, base_scope_digest)` match”; “retry recovers `health/baseline.json` forward from the signed snapshot matching `main_commit`”.

With a committed reset at epoch 2 and the records tip at epoch 1, effective evaluation correctly uses the floor at epoch 2. A new valid run for epoch 2 cannot meet the described compare-and-swap check against the old tip unless the writer has an explicit authorized epoch transition. The same ambiguity appears when an authorized config/scope reset changes the tuple but does not bump the sequence. On crash recovery, two signed snapshots can validly exist for the same main commit after different attempts. Matching only the commit does not select a unique successor or prove the signed snapshot was derived from the currently authorized parent/reset. Whole-entry metadata can also churn `health_basis_digest` for a retry with identical effective limits if the hash input is unspecified. See R-175 (`tenet/specs/prd/catalog.md:16`), `tenet/specs/tech-spec/ci.md:159–169,179–192`, `tenet/specs/tech-spec/kernel.md:34–40`.

**Acceptance.** Specify the authorized per-key reset transition from an old tip to the new floor before ordinary tightening, and require a generation identity for config/scope changes. Bind signed successors to their predecessor pointer, reset/policy, and ordered attempt. Recover only a valid descendant of the current pointer or recompute on CAS conflict. Define the semantic evaluation hash projection so an identical limit refresh does not invalidate unchanged work unless planned policy says it should. Test an initial floor without a pointer, the first run after reset, a stale run racing it, and two signed orphans for one commit.

### F3 · blocker — Runner supervision still has no verifiable completion and report binding

**Definition lines 70, 73–75 and 105:** “`health_reports?: [{id, format, report, report_sha256, runner_receipt}]`”; “runner directly spawning pinned binary with explicit `--files <expected_paths>` & `<base>` config without project build hooks”; “`expected_paths ⊆ runner_receipt.actual_analyzed_paths` sets `coverage_verified = true`”.

The new boundary correctly excludes generic self-reported coverage. The supervised example specifies invocation over a requested file list, which is not evidence that the tool processed every file or edge. An adapter can copy the requested list after a clean exit and produce the same result when a file was silently skipped. Likewise, an architecture graph with all module IDs but a missing acyclic edge satisfies the module subset check and prevents Tenet from finding a cycle. The receipt lists executable and config hashes but lacks a canonical binding to its subject, producer slot, run and actual report bytes. The existing outer bundle identifies a run; the definition does not say how the attest job verifies that the protected producer made this receipt for this report, including a standalone health check at lines 69–70. See R-100/R-110 (`tenet/specs/prd/tooling.md:101–102`), R-176 (`tenet/specs/prd/catalog.md:17`), `tenet/specs/tech-spec/ci.md:173–185`, `tenet/specs/tech-spec/kernel.md:36–40`, `evidence/research-code-health.md:53–55,63`.

**Acceptance.** Define a protected producer protocol that records completed units and per-kind completeness from its own analyzer or a verified tool-specific mechanism. State how a clean result proves full edge extraction for an eligible graph. Bind the receipt to the report digest, producer slot, subject and run, including both admitted bundle shapes, and prevent subject-side output from replacing it. Launch arguments may select scope but cannot prove completion. Test only requesting every file, a positively verified empty result, an omitted permitted edge with all module IDs present, and swapped reports or receipts between slots. Keep the supervised route advisory until that producer proves the contract.

### F4 · blocker — The strict hunk rule refuses unchanged legacy debt as a regression

**Definition lines 60–64 and AB-6 line 108:** “Evaluate every finding whose `[line, end_line]` overlaps a new-side added/modified hunk **directly (`0` baseline subtraction inside touched hunks)**” and “editing a pre-existing violating line re-enters review scope unless switched to `touched_files`”.

An analyzer can legitimately report the same legacy finding with the same fingerprint and count before and after a harmless edit inside its reported range. At `max_new: 0`, `touched_lines` fails solely because the range intersects the edit. R-175 requires comparison with the target's baseline and adoption credit for existing debt. Changing project scope to `touched_files` is a policy change, not a remedy for the false refusal. In the reference-only branch, checking `!baseline.allowed_counts[fp_key]` instead of the occurrence count has the inverse problem: one allowance can cover multiple introduced duplicates selected by the reference change. See R-175 (`tenet/specs/prd/catalog.md:16`), R-216 (`tenet/specs/prd/tooling.md:91`), `evidence/research-code-health.md:31–35,61`.

**Acceptance.** Keep enforced health scopes baseline-relative. Implement old/new occurrence comparison with pinned old evidence, fall back to an explicitly specified comparable baseline projection, or cap strict hunk checks at `advise`. A separately named no-existing-debt-on-touch policy would require an explicit approved scope. Use count-based matching for reference-only scope or declare no enforcement without adequate observations. Test a harmless edit inside an unchanged allowed diagnostic range and a reference edit that adds an occurrence beyond existing credit.

### F5 · blocker — The same missing input can be optional or blocking

**Definition lines 29, 69–70, 79–81 and 119:** “An enabled indicator missing from **both** committed floor and `records` fails … `failure` at `verify`/`assure`”; “Missing `required !== false` secondary report emits `TN-REPORT-MISSING`”; “Optional (`observe`/`advise`) … without failing `verify`”; `indicators` still has `mode?`.

V4 drops v3's effective-mode formula and new-indicator admission rules while keeping the two mode-dependent outcomes. It does not resolve how `required` for a slot interacts with every consuming indicator, a check independently required by a lane, the rule override and an advisory metric cap. In a `verify` project, a new observed indicator with no baseline and a shared report whose `required` is omitted can be treated as either a blocking failure or a diagnostic. A valid enforce policy referencing a `required: false` slot has the reverse ambiguity. These choices affect both adoption and the gate's ability to refuse missing evidence. See R-214/R-215 (`tenet/specs/prd/tooling.md:89–90`), R-204 (`tenet/specs/prd.md:91`), ALG-06/07 (`tenet/specs/tech-spec/algorithms.md:94–121`), `tenet/specs/tech-spec/ci.md:229–245`.

**Acceptance.** Restore a deterministic level/rule/indicator/cap precedence, new-indicator default and target-pinned promotion authority. Specify independently when the underlying check or report is required and how missing baseline/evidence affects each mode. Add cases for new observe at `verify`, a shared report with one enforce consumer, an `enforce` indicator on an optional slot, and a lane-required check with only advisory health indicators.

### F6 · blocker — Exception replay cannot distinguish no exception from a missing integration record

**Definition lines 87–91 and 122:** “Derive active exception state strictly from attested immutable records (`work.integrated` + binding `Decision` with Kernel **`expiry`** …)”; “Missing/corrupted exception/recovery records force `area` health **`unknown`”; “immutable exception/recovery events”.

Immutability authenticates records that are present. If the integration and waiver link for a waived merge never arrives, reducing a list of available records can yield exactly the same empty exception set as a repository with no waived merges. The draft names `work.integrated`, but kernel §1 currently specifies `work.closed` and no `work.integrated` event contract. The proposed amendments do not add its identity, fields, source authority, event admission or replay behavior. No authoritative integration inventory and coverage boundary tell the reducer when to refuse instead of reopening an area. CP-0037's attribution dependency does not itself define that exception ledger. See R-143/R-175 (`tenet/specs/prd/catalog.md:16,18`), R-203 (`tenet/specs/prd.md:85`), `tenet/specs/tech-spec/kernel.md:25–40,46–50`, `tenet/specs/plan/0.1.x.md:21,23`.

**Acceptance.** Define the versioned integration and recovery receipts or bind exactly to an existing admissible record. Require a trusted integration inventory or anchored sequence/checkpoint that accounts for each protected integration and its waiver decision IDs. Give the reducer exact handling for missing entries, delayed delivery, duplicates and integration without waiver. Test the same main history with a missing waived-merge receipt versus an observed no-waiver integration, and prove that expiry and later recovery are deterministic under replay.

### F7 · blocker — Daily aggregates cannot answer an exact rolling durability window

**Definition lines 91–92 and AB-12 line 114:** “`buckets[UTC_YYYY_MM_DD][agent_definition][work_type] = {cohort_commits, lines_added, lines_rewritten_or_reverted_30d}`”; “`processed_head, pending_gaps`”; “cohorts age out of `[as_of - 60d, as_of - 30d]` identically in incremental and full-history runs!”

With injected `as_of` at noon, two integrations on the same UTC date at 11:00 and 13:00 can lie on opposite sides of the maturity cutoff. The dated aggregate cannot split them. It also has no per-integration deadline or retained line identities for the next run to ascertain which old cohort a later edit rewrote only once. A scan of touched paths in an oversize commit is insufficient to know which tracked lines were actually rewritten. The main stream allows a Git timestamp fallback, but it does not say whether a later trusted receipt replaces that timestamp and how partly finalized state is corrected. These choices can give different rates from the same complete history, depending on when the reducer ran. See R-178 (`tenet/specs/prd/catalog.md:98`), `tenet/specs/tech-spec.md:224`, `tenet/specs/tech-spec/kernel.md:34`, `tenet/specs/plan/0.1.x.md:23,25`.

**Acceptance.** Either define a UTC-day view with explicit boundary semantics or persist sufficient per-integration precision to evaluate exact windows. Specify the carried line state and deadlines, exact completeness and rate denominators, replacement or immutability of fallback times, and when a bounded parse gap makes impacted line outcomes unknown. Test same-day integrations on opposite sides of a cutoff, a rewrite after checkpoint resume or an oversize gap, and a late timestamp receipt. Incremental and full reducers should agree under the same pinned inputs and time.

### F8 · blocker — Matrix policy defines shard coverage without defining a usable reduction

**Definition lines 69–71, 77–78 and 119:** “`shard_mode: "single" | "matrix-agree" | "matrix-distinct"`”; “`"matrix-agree"` requires all expected shards complete & identical (except `sampled_runs` aggregating `samples`)”; “`"matrix-distinct"` requires disjoint shard `scope_globs` whose union covers `expected_paths`”.

The check/report policy and receipt shape do not declare an authoritative shard roster or map each required shard to scope. A complete set of paths cannot establish a missing required platform for `matrix-agree`. Even with disjoint selectors, there is no operation for aggregating scalars. If one shard reports 1/1 and another 0/9, an average of the reported ratios gives 50%, while combining counts gives 10%. Ratios with additive counts have a natural reduction; duration, complexity maxima and arbitrary tool-neutral scalars do not share it. Per-shard architecture SCC results also cannot reveal a cross-shard cycle unless the complete edge input is composed before evaluation. See R-175/R-176 (`tenet/specs/prd/catalog.md:16–17`), `tenet/specs/tech-spec/ci.md:139–147`, `tenet/specs/tech-spec/evidence.md:12`, `tenet/specs/tech-spec/kernel.md:36–40`.

**Acceptance.** Provide a pinned expected shard identity and scope map and an allowed reducer per indicator kind, including the unknown or incompatible outcome when no valid reducer exists. Compose complete graph inputs before deriving cyclic edges. A smaller acceptable contract supports `single` and defers the unproved matrix modes. Test missing expected but redundant coverage, unequal shard denominators, order permutations and a cross-shard cycle. All-SARIF-run parsing and the producer uniqueness rule should remain.

VERDICT: BLOCKING 8
