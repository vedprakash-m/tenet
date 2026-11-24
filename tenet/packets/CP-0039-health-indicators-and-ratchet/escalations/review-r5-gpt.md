# CP-0039 independent definition review · round 5 (GPT)

Reviewed `shape/cp-0039` at `fc70253` against `origin/main` at `7400a0e`. Read definition v5, `response-r4.md`, the four earlier GPT reviews, and split stubs CP-0060 through CP-0064 from the shaping branch. This verdict applies to the narrowed core. The split packets carry their own unresolved work.

## Earlier findings

| Round 1 | Disposition | Reason |
|---|---|---|
| F1 | Deferred (accepted) | The committed baseline replaces automatic writes in core. CP-0062 owns tightening and crash recovery. CP-0063 owns live integration freshness. |
| F2 | Deferred (accepted) | CP-0064 owns independently proven completion and report provenance. Core discloses the limits of checks that run subject code. |
| F3 | Resolved | §3.1 preserves exact comparison against a comparable area baseline and caps touched/sampled scalar modes at advice. |
| F4 | Maintained | §3.2 supplies per-file counts and referenced-path comparison. Paired hunk enforcement still depends on old evidence without an input contract (F2 below). |
| F5 | Resolved | §3.2 and AB-5 preserve enforcement on one-line regressions. The low-sample label is advisory. |
| F6 | Resolved | §3.1 keeps the directed graph, SCC comparison unit and target-owned module mapping. F4 below concerns the retained acceptance promise after supervision was removed. |
| F7 | Maintained | §3.3 restores effective mode and optional handling, but a check's mandatory predicate omits applicability to the change (F1 below). |
| F8 | Deferred (accepted) | §3.4 specifies a single-evaluation `waived` result and expiry. CP-0063 owns atomic live admission and readiness after integration. |
| F9 | Deferred (accepted) | CP-0060 takes R-178 and its full measurement contract. |
| F10 | Resolved | §3.3 keeps typed owners, separate adjudicated counters, stable work identities and sample handling. |
| F11 | Maintained | The tool-neutral core and scope freeze are preserved. The retained raw coverage adapters lost the metadata source needed to satisfy AB-3 (F3 below). |
| F12 | Resolved | §3.4 and AB-10 preserve unknown status, fixed section order, shared-head budgets and overflow. |
| F13 | Resolved | §1 attributes the results and separates benchmark conditions from expected Tenet outcomes. |

| Round 2 | Disposition | Reason |
|---|---|---|
| F1 | Deferred (accepted) | Core has one committed authority. Overlay recovery and merge freshness move to CP-0062 and CP-0063. |
| F2 | Deferred (accepted) | CP-0064 carries verified actual scope and checker-input binding. There is no demand to certify self-reported scope in core. |
| F3 | Resolved | AB-4 tests cumulative decline against a fixed floor and exact tolerance boundaries. |
| F4 | Maintained | Definition and AB-5 retain the explicit per-file and reference scope. The paired hunk evidence path remains unspecified (F2 below). |
| F5 | Resolved | Cyclic edges, complete graph shape and target-owned areas define a stable unit. Detecting report omissions is assessed separately against AB-6 (F4 below). |
| F6 | Maintained | Report thresholds are rejected and non-narrowing remains explicit. Requiredness is still not conditioned on whether an indicator applies to this change (F1 below). |
| F7 | Deferred (accepted) | Core preserves evaluation-time expiry and zero verification credit. CP-0063 owns post-merge readiness and live freshness. |
| F8 | Deferred (accepted) | CP-0060 carries integration history, lineage and incomplete coverage. |
| F9 | Resolved | §3.4 distinguishes attributed weakening from unrelated suppression markers and routine mechanics. |
| F10 | Resolved | Window, stable keys and samples remain defined. |

| Round 3 | Disposition | Reason |
|---|---|---|
| F1 | Deferred (accepted) | Removing the mutable overlay removes the core retry or records-only update path. CP-0062 and CP-0063 own those extensions. |
| F2 | Deferred (accepted) | Protected supervision and trusted actual coverage belong to CP-0064, within the stated core limit. |
| F3 | Maintained | V5 reintroduces old-side pairing as an enforce-capable path without naming an admissible old occurrence input (F2 below). |
| F4 | Resolved | The architecture input still contains module and edge sets, with target-owned mapping and bounded witnesses. F4 below addresses only the changed completeness boundary. |
| F5 | Resolved | The effective area/selector identity remains in the digest and inherited narrowing remains refused. |
| F6 | Deferred (accepted) | CP-0063 owns authenticated post-merge exception replay. A core waiver has evaluation-local effect. |
| F7 | Deferred (accepted) | CP-0060 owns bounded durability checkpoints and replay. |
| F8 | Deferred (accepted) | CP-0061 owns cross-shard reduction. Core rejects conflicting reports and reads the SARIF runs inside one admitted file. |
| F9 | Resolved | Scope-attributed suppression is preserved. Unrelated markers and ordinary mechanics are diagnostic. |

| Round 4 | Disposition | Reason |
|---|---|---|
| F1 | Deferred (accepted) | §2 acknowledges the lack of an atomic pre-merge lock. CP-0063 carries the zero-refresh race fixture. |
| F2 | Deferred (accepted) | Core uses a reviewed commit and no speculative update. CP-0062 carries epoch transition and signed recovery. |
| F3 | Deferred (accepted) | CP-0064 carries the protected producer and per-unit completion contract. F4 below asks only that core acceptance reflect that boundary. |
| F4 | Maintained | Per-file and reference allowances are fixed and unpaired hunks are advisory. The optional enforce path still cannot recover baseline-local old occurrences from the declared inputs (F2 below). |
| F5 | Maintained | Optional missing baseline behavior and mode precedence are now explicit. The new mandatory formula can still block unrelated work (F1 below). |
| F6 | Deferred (accepted) | CP-0063 owns the authoritative integration inventory and cross-PR exceptions. |
| F7 | Deferred (accepted) | CP-0060 retains the exact cutoffs, incomplete spans and late attribution cases. |
| F8 | Deferred (accepted) | CP-0061 retains the shard roster and per-kind reducer. No reducer is required in core. |

## Round 5 findings

### F1 · blocker — An inapplicable indicator makes a check mandatory

Definition v5 line 44 says a check is mandatory “iff in `lane_checks` OR any consuming `I` has `effective_mode(I) === "enforce"`”. This is the changed requiredness rule. R-175 restricts the comparison to touched scope, R-204 defines claim applicability and ALG-07 evaluates applicable claims. See `tenet/specs/prd/catalog.md:16`, `tenet/specs/prd.md:91`, `tenet/specs/tech-spec/algorithms.md:94–96,108–121` and `tenet/specs/tech-spec/ci.md:245`.

- **Inputs.** At `verify`, target policy has separate `payments` and `docs` areas. A `payments` indicator consumes `check-payments` in effective `enforce` mode. The current change only modifies `docs/guide.md`, with no payment path or declared dependency touched. The lane does not require `check-payments`; its report is absent.
- **Wrong outcome.** The health indicator's configured mode alone makes `check-payments` mandatory. The unrelated change fails for missing evidence. Treating it as optional by short-circuiting on scope requires adding a condition absent from the stated iff.
- **Acceptable change.** Resolve applicability on pinned facts before calculating health-derived requiredness. Require a report if the lane independently requires it or an **applicable** enforce indicator consumes it. Keep genuinely unknown required applicability visible. Add this negative fixture and a companion deleting a declared dependency of the payments indicator, where the same missing report must fail.

### F2 · blocker — Paired hunk enforcement has no admitted old occurrence input

Definition v5 line 40 says “When paired `<diff_base>` evidence is supplied, pairs old hunks `[oldStart, oldEnd]` bounded by `allowed_counts[k]`”. AB-5 line 64 expects a “harmless edit inside paired range” fixture. This maintains round 4 F4 after the change from unconditional strict hunk evaluation to optional pairing. Kernel §2 requires the subject and required inputs to agree with the evaluation. See `tenet/specs/prd/catalog.md:16`, `tenet/specs/tech-spec/kernel.md:36–40` and `tenet/specs/tech-spec/ci.md:139–147`.

- **Inputs.** `touched_lines`, configured `enforce`, `max_new: 0`; a committed allowance of one occurrence of fingerprint K; one tested-side occurrence of K inside the new hunk. Compare two base observations, one with the allowed K inside the old hunk and one with it outside. Both give the same persisted allowance and tested report. Core admits one report for the tested subject and names no admitted old observation or way to bind it.
- **Wrong outcome.** The two inputs reaching the recorder are indistinguishable, although paired comparison should retain the in-hunk legacy allowance and refuse a new out-of-allowance occurrence. Accepting caller-supplied unbound base data can hide the regression. Treating the paired case as absent makes the promised enforcement path and fixture unreachable.
- **Acceptable change.** Keep all `touched_lines` at `advise` in this core and defer paired enforcement, or define the source, pinned revision/check/scope binding, encoding and matching of old occurrences without relying on matrix reduction or protected supervision. Test inside versus outside old hunk, wrong-base evidence and absent old evidence. Preserve per-file and area enforcement.

### F3 · blocker — Supported raw coverage formats cannot satisfy the mandatory metadata contract

Definition v5 line 45 says “`checks.<name>.report` accepts `tenet-health-json | sarif | lcov | cobertura`” and “Reports MUST supply `{tool: {name, version, config_digest}, coverage: {complete, analyzed_paths/modules}}`”. AB-3 line 62 promises valid normalization and LCOV/Cobertura parity. V5 removes v4's producer receipt while keeping these requirements. See R-003 (`tenet/specs/prd/tooling.md:26`), `tenet/specs/tech-spec/ci.md:43–48`, `tenet/specs/tech-spec/kernel.md:36–40`, [LCOV tracefile grammar](https://github.com/linux-test-project/lcov/blob/master/docs/man/geninfo.rst) and [Cobertura DTD used by gcovr](https://github.com/gcovr/gcovr/blob/main/tests/cobertura.coverage-04.dtd).

- **Inputs.** An exit-zero check declares `report: lcov` and returns `SF:src/a.ts`, `DA:1,1`, `LF:1`, `LH:1`, `end_of_record`. A second fixture has equivalent line facts in Cobertura. The target policy has ordinary `inputs[]`; neither raw report contains a producer configuration digest or a Tenet completeness assertion.
- **Wrong outcome.** Requiring these fields in the raw payload rejects valid inputs that AB-3 says will normalize. Copying the expected tool/configuration from the baseline or treating the observed filepath list as asserted completeness invents facts and makes different adapters produce different admission results.
- **Acceptable change.** Separate observed coverage data from declared or verified identity and completeness, and define where each normalized field comes from. Core can retain raw coverage as advisory area trends with explicit missing metadata and no gate credit, or require a defined metadata envelope whose values validate against pinned policy where applicable. Do not require CP-0064 supervision just to normalize a raw tracefile. Add plain raw positive goldens and make their completeness/eligibility explicit.

### F4 · blocker — Architecture acceptance still promises to detect an omission core cannot observe

Definition v5 line 32 requires reports to “supply complete sorted `architecture_graph: {modules, edges}`”, and AB-6 line 65 says “failing `TN-GATE-UNKNOWN` on partial graphs” with “omitted permitted edge” in the fixtures. V5 removes the independent completion facility from this core. That is an accepted limitation under R3. The contradiction is the retained acceptance claim, not the deferral. See R-176 (`tenet/specs/prd/catalog.md:17`), `tenet/specs/tech-spec/ci.md:185` and the CP-0064 stub at line 14.

- **Inputs.** Target policy defines modules A and B. The report lists both as analyzed, declares `complete: true` and lists only `B → A`. In one fixture that is the actual complete graph. In another, the producer omits an allowed `A → B` edge. The sole admitted graph and coverage metadata are byte-identical.
- **Wrong outcome.** The SCC evaluator sees the same inputs. It either admits both graphs, missing the cycle caused by the omitted edge, or rejects both, including a valid acyclic observation. It cannot deliver AB-6's missing-edge refusal from these inputs.
- **Acceptable change.** Limit core refusal to omissions it can observe, such as declared partial coverage, a missing expected module or an unknown edge endpoint. Update AB-6 so the missing edge fixture supplies an observable incomplete marker, and carry detection of silently omitted edges to CP-0064. State that the core verdict derives from the admitted report within CI §5's honest limit. Retain the existing complete-graph cycle fixture.

### F5 · should — State the below-verify waiver rule explicitly

Definition line 50 says “Rejects … author/diff-committer/`bots[]`/agent self-waive”. PRD R-203 expressly allows a labeled self-waiver below `verify`, with the claim's proof requirements still in force. Clarify whether core follows that rule for a forge-verified human owner at `protect` or relies on an approved, stricter health-specific policy. Include the two level outcomes in AB-7. This clarification does not require CP-0063. See `tenet/specs/prd.md:85`, `tenet/specs/prd/catalog.md:16` and `tenet/specs/tech-spec/ci.md:199–209`.

VERDICT: BLOCKING 4
