# CP-0039 independent definition review · round 3 (GPT)

Reviewed `shape/cp-0039` at `284458b` against `origin/main` at `7400a0e`. Read the definition, cited research, Gemini's `response-r2.md`, both round 2 reviews, and the round 1 GPT review from the shaping branch. `review-r1-mai.md` remains unavailable on the shaping branch and in the available review refs. Definition line numbers below refer to v3.

## Earlier GPT findings

| Round 1 | Status | Reason |
|---|---|---|
| F1 | Maintained | Per-key overlays, signed snapshots and a live stale check are now specified. Update eligibility and evaluation identity still disagree (round 3 F1). |
| F2 | Maintained | Tenet computes expected scope independently, but the definition still trusts the report to declare the actual scope (F2). |
| F3 | Resolved | §3.2 compares like-for-like area scalars against a stable baseline. Touched and sampled scalars grant zero enforcement credit. Exact comparison replaces rounding at the boundary. |
| F4 | Maintained | §§3.2–3.3 address duplicates, pure renames and diff operands. The baseline does not contain the old occurrence locations that per-hunk credit requires (F3). |
| F5 | Resolved | §3.3 removes the automatic small-diff exemption. The low-sample label does not affect enforce decisions. |
| F6 | Maintained | §3.2 defines cyclic edges and hints. The normalized input cannot supply the full graph, and module-to-area membership is still mutable from the subject (F4). |
| F7 | Maintained | §§3.4 and 4 separate optional results and enforce failures. A policy layer can still shrink the effective population through exclusions (F5). |
| F8 | Maintained | §3.5 uses the kernel's `waived` disposition and defines live expiry. The durable exception cannot be reconstructed and validated from its declared fields (F6). |
| F9 | Maintained | §3.5 chooses first-parent diffs and bounded incremental state. The closure event does not establish an authoritative integration receipt, and the reducer cannot reliably resume (F7). |
| F10 | Resolved | §3.6 names typed owners, a rolling window, stable work keys, separate adjudicated counters and minimum sample labels. |
| F11 | Resolved | §2 preserves the R-227 deferral, keeps R-151 in CP-0036 and treats tool choices as examples. |
| F12 | Resolved | §3.6 and AB-11 retain unknowns, verdict, ordering and an overflow record under the shared-head budget. |
| F13 | Resolved | §1 attributes the fix rates and distinguishes benchmark stress tests from predicted Tenet outcomes. |

| Round 2 | Status | Reason |
|---|---|---|
| F1 | Maintained | §3.1 addresses reset isolation and store precedence. Same-commit retries can still take a less guarded path and live re-evaluation lacks a new bound identity (F1). |
| F2 | Maintained | §3.4 verifies target-derived expected paths against analyzed paths, but still lacks independent evidence for the analyzed side and consumed inputs (F2). |
| F3 | Resolved | The area-only enforcement boundary closes the rolling touched-baseline loophole, and AB-5 tests a cumulative change and the exact tolerance boundary. |
| F4 | Maintained | Defined diff operands and reference paths close the earlier ambiguities. The new exact-hunk credit rule requires old locations the baseline cannot provide (F3). |
| F5 | Maintained | Cyclic edges close the representative-cycle ambiguity. AB-7 cannot be implemented faithfully from the stated graph input (F4). |
| F6 | Maintained | Optional and mandatory outcomes and report override rejection are defined. `exclude_globs` and effective area membership remain outside tightening/identity checks (F5). |
| F7 | Maintained | Explicit `waived` disposition, open-PR expiry and readiness address the display-only issue. Persisted authority and exception replay remain open (F6). |
| F8 | Maintained | First-parent history fixes double counting feature-branch commits. A replayable progress and integration contract is still missing (F7). |
| F9 | Maintained | Clean new tests and mechanics are diagnostic. A new suppression is still treated as established weakening without showing whether it weakens a pinned check (F9). |
| F10 | Resolved | Counter keys, rolling window and minimum sample handling address repeated evaluations and no-data cases. |

## Round 3 findings

### F1 · blocker — A baseline retry or re-evaluation can escape the intended safety checks

**Definition lines 37–40, 138–139:** “if `main_commit === tip.main_commit` (same-commit retry): tighten `element-wise`/scalar only when `run_id`/`run_attempt` is newer, never loosening”; “(iv) … AND `exit_code === 0`, `complete === true` covering 100% of `expected_scope`, `population === "area"` … and no unrecovered `accept-health-regression`”; “any change marks `E` **`stale-baseline`**”.

The complete/clean/unwaived predicates are attached to branch (iv) only. A later incomplete same-commit result with zero reported findings can shrink legitimate allowances if branch (i) is implemented as stated, even as the outcome table says an incomplete run never tightens. `finding_set` also has no `population` in the declared model, so the same rule can either prevent it from ever tightening or admit it without a full-area report. Separately, a records-only tightening can advance the baseline while the target Git commit and policy remain unchanged. Contracts §1's current evaluation ID does not include the baseline. The proposed changes omit that contract, allowing historical and refreshed evaluations to share an ID and a previously issued decision or required status to be mistaken for current authority. Sources: R-175 and R-152 (`tenet/specs/prd/catalog.md:16,35`), `tenet/specs/tech-spec/contracts.md:18`, `tenet/specs/tech-spec/kernel.md:34–40,48–50,72`, `tenet/specs/tech-spec/ci.md:159–169`.

**Accept:** Put the same verified full-area input predicates ahead of every write branch, explicitly including findings and same-commit retries. Specify missing floor/overlay initialization and the signed snapshot/pointer recovery path on an interrupted write. Version the evaluation or bound decision/merge basis so a records-only update cannot reuse the previous result or waiver as current authority. Test a newer incomplete retry, a full-area finding-set tightening, and a baseline-only update between a passing required status and merge. Preserve historical replay in each case.

### F2 · blocker — The checked report still attests to its own actual coverage

**Definition lines 73–74 and 78–81:** “Native `coverage` + `expected_paths ⊆ analyzed_paths` check”; “`invocations` clean AND artifact list if emitted”; “Test job records `pinned_inputs_digest` … before execution”; “`complete === true` requires **both** clean tool completion AND **`expected_paths ⊆ analyzed_paths`**”.

The expected scope is now independent. The actual scope can still be supplied by the subject-side report, including for the native format explicitly eligible for enforcement. A clean exit and a manifest listing every expected path do not establish that the checker analyzed them. A SARIF artifact list is also insufficient evidence that every referenced artifact was analyzed. Hashing config inputs before and after verifies bytes at two points, while a tool selected via the subject's dependency/configuration machinery need not have consumed those bytes. A protected signature attests to what the verifier received, so a complete-looking report from an inadequately isolated checker can still count as holding or permanently remove debt. Sources: R-100/R-110 (`tenet/specs/prd/tooling.md:101–102`), `tenet/specs/tech-spec/ci.md:173–185`, `tenet/specs/tech-spec/kernel.md:36–40`, `evidence/research-code-health.md:53–55,63,75–77`.

**Accept:** Define a tool-neutral eligibility contract and at least one realizable reference producer. To enforce or tighten, require the protected verifier or a proven checker binding to supply the analyzed scope, pin the execution and effective inputs, and associate that receipt with the exact report bytes and subject. A report's self-declared scope alone stays diagnostic even when it lists every expected path. Keep generic adapters useful at their measured trust level. Test a clean but self-reported complete empty result, a legitimate protected empty result, and an approved tool configuration that differs from what was actually used.

### F3 · blocker — Exact-hunk baseline credit cannot be computed from the stored baseline

**Definition lines 27, 47 and 60:** “`allowed_counts?: Record<fp_key, int>=0`”; “Credit from baseline applies **1:1 only inside the exact paired replacement hunk** (`oldStart..oldEnd`) for identical `(rule_id, file, symbol, snippet_hash)`.”

A count keyed by a path-based fingerprint has no old-side location or occurrence identity. Suppose a baseline allows one matching finding in a file. With the same committed count and the same new finding, the prior allowed occurrence might have been within the paired old hunk or in a distant unchanged line. The definition requires opposite decisions and provides no authoritative old occurrence input. An old report, if an implementation invents one, must match the correct allowance and retain its lineage across later tightenings. Reference-only findings selected by deletion also have no stated pairing when the finding's own file has no hunk. Sources: R-175 (`tenet/specs/prd/catalog.md:16`), ALG-14 (`tenet/specs/tech-spec/algorithms.md:186–194`), `evidence/research-code-health.md:35,61,65`.

**Accept:** Bind a comparable old-side occurrence map to the baseline and projection or choose a count-only rule with an explicit scope and its trade-offs. Define how tightening prunes locations, what happens when an old report is unavailable, and how dependency/reference-only findings match. Include two fixtures with identical allowance counts but old occurrences inside versus outside the paired hunk. Their outputs must differ if the rule stays hunk-based.

### F4 · blocker — The architecture report cannot supply the graph the evaluator must inspect

**Definition lines 48–50 and 67–68:** “Report MUST carry `modules: [{id, root_globs: [glob]}]`, full directed edges, and `analyzed_modules`”; “Attribute affected areas via `from_file` (edges) and `modules[u].root_globs ∪ modules[v].root_globs`”; `finding_set` “`{kind, indicator, area, rule_scope, modules?, findings: [{rule_id, file, line?, end_line?, symbol?, snippet_hash, referenced_paths?, from_module?, to_module?, to_file?, cycle_nodes?, cycle_edges?, hint}]}`”.

The entry has optional module definitions and findings but no complete edge list. A normal acyclic edge produces no finding, yet the evaluator needs it to discover when a later edge closes a cycle. Using delivered cycle findings as graph input would reintroduce the reporter dependence SCCs were meant to fix. Module root globs are supplied by the report, with no target-side mapping or validation contract, so alternative mappings can change the attributed area. SCC discovery is linear, but generating a separate BFS witness for every cyclic edge does not share that bound. Sources: R-176/R-204 (`tenet/specs/prd/catalog.md:17`, `tenet/specs/prd.md:91`), ALG-06 (`tenet/specs/tech-spec/algorithms.md:94–104`), `evidence/research-code-health.md:11,22,61`.

**Accept:** Add an explicit full-graph entry or a separately pinned graph input, with canonical module and edge records, independent completeness checks, path/area attribution and target-owned identity or exact mapping verification. Derive SCC findings from that input, bound or paginate display witnesses, and keep rendering cost claims separate from SCC cost. Test a complete graph with previously permitted edges that become cyclic after one addition, a graph missing a permitted edge, conflicting module mapping, and a large SCC.

### F5 · blocker — A layer can shrink the population through exclusions without a baseline reset

**Definition lines 45, 79 and 85:** “`scope_digest = sha256(RFC 8785 {kind: "area", area, scope_globs, exclude_globs, unit})`”; “`expected_paths` (`area.paths ∩ scope_globs \ exclude_globs` on `<tested>`)”; “diverging `scope_globs` beyond literal path-prefix specialization -> `TN-POLICY-LOOSEN`.”

An area ID is not its membership policy. The scope digest ignores `area.paths` and any CODEOWNERS fallback used to produce the expected population. Two different configured populations can share the digest and compare unlike values. The layer rule also omits exclusion edits; an override keeping the same inclusion glob and adding `exclude_globs: ["**"]` can reduce coverage to nothing. Literal-prefix specialization of an inherited indicator narrows its domain too unless the parent indicator remains independently applicable. Protected review of policy does not make a prohibited layer loosening valid under R-204. Sources: R-175 (`tenet/specs/prd/catalog.md:16`), R-204 (`tenet/specs/prd.md:91`), ALG-06 (`tenet/specs/tech-spec/algorithms.md:94–104`), `evidence/research-code-health.md:35,61`.

**Accept:** Hash the effective membership rules and their authorized source revision, without hashing the evolving tracked-file list. Reject inherited domain shrinkage via either include or exclude rules, or leave the inherited claim intact and add a narrower independent child. Couple permitted membership changes to a compatible reset rather than silently reusing the old baseline. Test an exclude-all override, a narrowed prefix, a changed area path rule with the same area name, and an ordinary new file under unchanged rules.

### F6 · blocker — The exception record lacks replayable evidence and authority

**Definition lines 104–107:** “mandatory `expiry` defaulting `issued_at + 30d <= waiver_max_days`”; “appends an independent record `{exception_id, pr, integration_commit, area, indicator, baseline_digest_at_waive, shortfall, expires_at, status: "active"}`”; “Each `exception_id` closes **only** on verified `main` recovery meeting `baseline_digest_at_waive` or committed `reset_seq`”.

The exception record contains no bound decision ID, claim/evaluation ID, policy revision, or reset epoch at issuance. A reader cannot tell whether the exception came from an admissible waiver on the integrated result, whether a later reset applies to this exception, or what verified observation closed it. Status and recovery live only on the records ref as described. R-143 now consumes the result for readiness, so dropping an expired row or replacing it with a closed row must not be enough to reopen lanes at `verify`/`assure`. The expiry rule also needs one canonical time field at the kernel boundary and a live gate trigger when no push occurs. Sources: R-203 (`tenet/specs/prd.md:85`), R-143/R-175 (`tenet/specs/prd/catalog.md:16,18`), `tenet/specs/tech-spec/kernel.md:34,46–50`, `tenet/specs/tech-spec/ci.md:179–192,194–209,245`.

**Accept:** Derive current exceptions from authenticated, immutable waiver, integration and recovery/reset observations with exact claim/baseline/epoch binding. Define handling of several exceptions and mismatched integration commits, including how missing or altered records affect enforceable readiness. Specify a merge-time or required-status refresh path at expiry for an unchanged open PR. Use the shared `Decision.expiry` for verification and map it explicitly to a display field if needed. Test wrong-evaluation recovery, missing expired exception data, a same-head expiry, overlapping exceptions and historical replay.

### F7 · blocker — Bounded durability can skip history and produce a different mature rate on retry

**Definition lines 109–110 and AB-12 line 132:** “`work.closed` integration commits + `recorded_at`”; “keyed by `(state_main_commit, state_digest)`”; “`250`, `max_diff_bytes = 50 MB`, `max_lines_per_commit = 20,000`, `60s` timeout”; “retiring cohorts at `merged_at + 30d < as_of` into immutable `(agent_definition, work_type)` totals”.

`work.closed` is a closure observation, which can occur later than integration or without an integration. `recorded_at` can be delayed. Using either as merge time can move a line into a different cohort even when Git history is identical. A single cursor at a main commit also does not explain how processing resumes when a budget stops before that commit, an oversized revision is encountered, or an integration event arrives after the commit was observed. Advancing past a gap loses later rewrites of already tracked lines. Replaying the whole interval on each retry defeats the new bound. Aggregates keyed only by agent and type cannot age cohorts out of a rolling 30-day mature window. Sources: R-178 (`tenet/specs/prd/catalog.md:98`), `tenet/specs/plan/0.1.x.md:23,25`, `tenet/specs/tech-spec/kernel.md:25–34`, `tenet/specs/tech-spec.md:224`.

**Accept:** Specify the binding for integration commit and authoritative integration time, including closed-without-merge, direct push and late observations. Define a gap-aware, idempotent checkpoint and dated cohort buckets with an exact rate and completeness denominator. Pin which state may advance on a budget stop and which results stay unknown until repaired. Test a first-parent run covering more than 250 commits, a rewrite on a later batch, a permanent oversize gap, a delayed merge event, and a cohort aging out. Incremental and full reducers must agree on complete history.

### F8 · blocker — Matrix and multi-run reports can produce opposite enforced values

**Definition lines 65–76 and AB-3 line 123:** “`readHealthEvidence(bundles, policy, proposed?)`”; “`health_reports?: [{format, report, report_sha256}]`”; “`runs[0].tool.driver.{name, semanticVersion|version}`”; “byte-identical cross-adapter normalization”.

A checked matrix can deliver multiple reports for the same indicator. The collector has no rule for which check/shard is required, when scope is disjoint, or how to combine duplicates and conflicts. Two complete reports for one area, one holding and one regressed, can yield a pass or failure depending on first/last selection. Summing overlapping LCOV/Cobertura populations can double-count, and taking only a first SARIF run can omit a later run's findings. Report equivalence is a useful goal for equivalent normalized facts. The implementation cannot infer that all source formats or repeated observations express those same facts. Sources: `tenet/specs/tech-spec/ci.md:139–147,159–167`, `tenet/specs/tech-spec/kernel.md:36–40`, `tenet/specs/tech-spec/evidence.md:12`, and the existing matrix input checks in `src/verify/record.ts:94–105,407–409`.

**Accept:** Specify the health aggregate key, required report slots selected by pinned policy, the equivalence and deduplication rule, and explicit handling of missing, overlapping and conflicting reports. A first implementation may require one authoritative producer per indicator and reject ambiguity. Cover all supported SARIF runs or reject a multi-run report explicitly. Define cross-format golden parity only for equivalent normalized facts. Test permutation of conflicting reports, exact duplicates, partially overlapping coverage and a finding in a second SARIF run.

### F9 · should — Treat a suppression marker as a signal until Tenet can attribute its effect

**Definition lines 94–97 and AB-9 line 129:** “**Established weakening:** `ALG-09` test weakening … OR added comment-anchored suppression directives”; “mechanics/clean tests to advisory `! Tamper watch:`”.

The distinction between real test weakening and routine mechanics is clearer. A legitimate localized suppression can still be a marker for a tool or rule that is outside any pinned check. Its syntax alone does not establish that a required check became weaker. Tool-neutral scope matters more than growing a list of language tokens. Sources: R-003/R-214/R-216 (`tenet/specs/prd/tooling.md:26,89,91`), R-103 (`tenet/specs/prd/catalog.md:14`), `evidence/research-code-health.md:63,75–77`.

**Accept:** Flag unsupported or unattributed markers on the card, and use the existing weakening gate when a pinned rule or configuration shows the effect. Allow policy to explicitly protect a broader suppression surface. Test the same new marker under a pinned applicable rule and under an unrelated tool without introducing a manual step for routine quick work.

VERDICT: BLOCKING 8
