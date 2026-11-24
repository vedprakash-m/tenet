# CP-0039 independent definition review · round 2 (GPT)

Reviewed `shape/cp-0039` at `afcc6c0` against `origin/main` at `a64fdf2`. The definition and cited research were available on the shaping branch. The round 1 GPT review was available at `review/cp-0039-gpt-r1` (`883a8a7`). The shaping branch has no `escalations/response-r1.md`, `escalations/review-r1-gpt.md` or `escalations/review-r1-mai.md`. The response and MAI review were also absent from the available review refs and shaping worktree. The dispositions below use the committed revision, including its inline responses, and the original GPT review. They make no claim about MAI's verdict.

## Round 1 GPT finding dispositions

| Round 1 | Status | Reason |
|---|---|---|
| F1 | Maintained | §§3.1 and 5 separate recorder writes from committed policy approval. Per-indicator precedence, reset synchronization and fresh merge eligibility still have competing interpretations (round 2 F1). |
| F2 | Maintained | §3.4 adds a receipt and an outcome matrix. It still does not establish who determines completeness or whether a report can supply its own evidence of coverage (F2). |
| F3 | Maintained | §3.2 separates populations and handles zero. The two permitted numeric comparisons and the unanchored touched-PR comparison can still change the verdict (F3). |
| F4 | Maintained | §§3.2–3.3 fix simple duplicates and pure renames. Touched-line matching, dependency attribution and diff endpoint selection remain under-specified (F4). |
| F5 | Resolved | §3.3 and AB-6 remove the blanket 20-line exemption from enforced checks and test a one-line regression and a sequence of changes. |
| F6 | Maintained | §§3.2–3.3 now pin the rule, require a hint and canonicalize one cycle. They do not establish the complete comparison unit across equivalent cycle reports (F5). |
| F7 | Maintained | §3.4 defines a minimum effective mode but its outcome table can still block advisory or newly observed indicators. Some gate-controlling parameters have no policy source (F6). |
| F8 | Maintained | §3.5 adopts shared `Decision.expiry`, constrains authorization and preserves historical replay. Current gate disposition and post-merge exception state still need a contract (F7). |
| F9 | Maintained | §3.5 adds a cohort, attribution fields and line tracking. It does not identify the evidence for integration ordering and time, or handle incomplete lineage sufficiently to make the rate reproducible (F8). |
| F10 | Maintained | §3.6 separates waivers, flags and adjudicated false refusals. The review window and unique change identity remain unspecified (F10). |
| F11 | Resolved | §§2, 3.4 and 6 distinguish the neutral input from optional area/report adapters and dogfooding. R-227 remains an idea, CP-0036 keeps mutation and its unit, and dogfooding remains an Owner question. |
| F12 | Resolved | §3.6 and AB-11 add unknown and waived totals, order and an overflow record for a shared head. The existing CI overall summary cap still applies. |
| F13 | Resolved | §1 attributes the comparison to Meta and frames the model figures as benchmark stress tests. |

## Round 2 findings

### F1 · blocker — An overlay can survive the wrong reset or authorize a stale merge

**Definition lines 28–30:** “If committed `.tenet/health-baseline.json` has a higher `reset_seq` or a newer `config_digest` commit than `records`, committed wins (`reset`)”; “the effective baseline per `(area, indicator)` is the **strictly tighter** of committed `.tenet/health-baseline.json` and `records`”; “An in-flight PR keeps its evaluation's pinned baseline across replay until pushed/re-evaluated.”

The overlay is a single mutable path with an unresolved signed-copy relationship. Scalar order works only on a comparable metric. Two finding multisets can be incomparable, and applying a reset to one indicator must not discard another indicator's tightening. A reset turning `reset_seq` 1 into 2 can race a run started against 1, including a re-run of the same commit. The strict-ancestor condition does not order the same commit, non-ancestors or inputs read before the winning CAS. A PR that keeps its old pass when the governed baseline tightens can merge against an obsolete floor. Historical replay should keep that pass; eligibility for a new governed merge has a different input. Sources: R-175 (`tenet/specs/prd/catalog.md:16`), R-152 (`catalog.md:35`), `tenet/specs/tech-spec/kernel.md:34,36–40`, CI `tenet/specs/tech-spec/ci.md:159–169,179–192`.

**Accept:** Bind each overlay to its indicator, baseline/reset epoch, config digest, trusted default-branch subject and receipt. Define a signed authoritative record or pointer at `verify`/`assure`, with immutable digest lookup for replay and precedence if a ref points elsewhere. A finding overlay may only reduce authorized occurrence allowances from its own floor; reject an incomparable overlay. Define CAS revalidation, duplicate attempt arbitration, rewrites of default-branch history, and scope-specific reset behavior. State which governance step invalidates a stale pass before merge without altering historical results. Test same-commit retries, mismatched reset, competing writes for different indicators, stale merge eligibility and disagreement between signed evidence and the mutable records pointer.

### F2 · blocker — Completeness and report provenance still depend on an unspecified trust decision

**Definition lines 55 and 60–64:** “Test job records `{tested_commit, base_commit, check_id, run_id, adapter_version, exit_code, complete, analyzed_scope, report_sha256, tool, tool_version, config_digest, pinned_inputs_digest}` from target `base` configs (`inputs[]`, lockfiles).”; “Valid empty findings, `complete: true`, `analyzed_scope` covers target”.

The expanded receipt lists claims a verifier needs. It does not define how a protected producer determines which paths or graph nodes the checker was supposed to analyze, whether it analyzed them, or which executable, adapter and effective inputs it actually used. Populating a digest from the target tree can agree with policy while the check consumed different working-tree bytes. If an adapter takes `complete` or the list of analyzed paths from arbitrary subject-side output, a syntactically valid no-findings report can still pass and prune the baseline. The honest-limit caveat is appropriate and needs an explicit result class and consequence. Sources: R-100/R-110 (`tenet/specs/prd/tooling.md:101–102`), `tenet/specs/tech-spec/ci.md:43–45,173–185`, `tenet/specs/tech-spec/kernel.md:36–40`, `evidence/research-code-health.md:53–55,63,75–77`.

**Accept:** For each enforcement-capable adapter, identify the independent source of expected scope, the trusted source of actual coverage and the verification of the tool and input bytes consumed. Require the attest job to verify those bindings and the report digest and distinguish valid empty, not applicable and unknown. Explicitly restrict a check whose coverage or effective inputs cannot be established to the appropriate limited result and prohibit it from tightening. Test a valid complete empty report, an empty report whose self-declared scope is complete but omits work confirmed by independent metadata, and a mismatch between declared and consumed inputs. Keep reports usable in advisory mode where their limitations are visible.

### F3 · blocker — Touched scalar comparison and numeric boundaries can defeat the ratchet

**Definition lines 35–39:** “`touched` metrics evaluate against a declared ceiling OR paired recomputation”; “`1e-6` rounding or exact rational comparison when `numerator`/`denominator` exist”.

Feasible implementations can disagree twice. The definition gives no policy field or precedence to choose the comparison strategy. With a one-point tolerance and paired recomputation against each new target commit as the only baseline, 90→89→88 can pass repeatedly even though R-175 specifies a ratchet against the target's baseline. A fixed ceiling is also a threshold unless its relationship to adoption and main tightening is defined. When a ratio lies just past the boundary by less than the rounding unit, exact comparison can refuse what rounding admits. A scalar's `scope_digest` is present but not explicitly checked for shared population identity. Sources: R-175 (`tenet/specs/prd/catalog.md:16`), ALG-06 (`tenet/specs/tech-spec/algorithms.md:98–104`), `tenet/specs/tech-spec/evidence.md:12`, `evidence/research-code-health.md:35,61`.

**Accept:** Define a single pinned strategy per indicator with its config shape or omit `touched` from enforcement until a comparable monotonic baseline exists. If it remains enforceable, specify how the stable allowance is projected across additions and deletions and which pinned scopes are comparable. Choose arithmetic by input type, including numeric representation and ratio scale, tie handling and whether rounding is presentation-only. Test a cumulative same-scope decline, a changed scope version and a value immediately beyond tolerance where a six-decimal round would pass.

### F4 · blocker — Touched matching can borrow unrelated credit and conflate target changes

**Definition lines 40–41 and 47–52:** “Comparisons match **multiset occurrence counts** per `fp_key` in canonical appearance order”; “`base_sha` = pinned merge-base SHA, never floating branch name”; “`touched_lines` overlaps new-side added/modified hunks **and** matches deletion/edit breaks”.

The simple excess example is fixed, but comparing counts gives no equivalence between a particular old allowed occurrence and a new occurrence in the touched hunk. Removing an allowed occurrence and introducing an identical one elsewhere can net to zero, including across scope boundaries if credit is rekeyed on a rename. Filtering by line first can instead discard the legitimate allowance when a touched occurrence shifts without changing. For a merge candidate, diffing from a fork merge-base can include unrelated target-side commits if that base refers to the PR head's fork. The definition does not define separate pinned operands for change selection versus target baseline versus paired scalar comparison. Deletion-only reference attribution also needs a referenced-path input that the declared finding record cannot represent. Sources: R-175 (`tenet/specs/prd/catalog.md:16`), `tenet/specs/tech-spec/ci.md:145–147`, ALG-14 (`tenet/specs/tech-spec/algorithms.md:186–194`), `evidence/research-code-health.md:35,61,65`.

**Accept:** Decide whether the unit is net in-scope occurrences or introduced occurrences, then specify when old-side credit follows a surviving occurrence and when relocation needs a fresh judgment. Define the normalized report fields for fingerprint ingredients and affected paths/ranges, old/new hunk mapping, attribution when only a referenced path changed, case and unusual path handling, and fallback when available metadata cannot prove the mapping. Pin and name separate diff operands for merge candidates and head-only reports, exclude unrelated advanced target changes, and declare when head-only evidence is inadequate. Test identical removed/added occurrences, insertion before an allowed occurrence, pure/cross-area rename, deletion-only link break and a target that advanced before candidate creation.

### F5 · blocker — Canonical rotation cannot make equivalent graph reports comparable

**Definition lines 43–44 and 52:** “Normalize `cycle_nodes` to the **minimal rotation starting at the lexicographically smallest module ID**”; “Missing/partial graph completeness -> `inconclusive` / `unknown`”; “attributes affected areas from `from_file`/`to_module` on new edges and touched edges in new cycles”.

Rotation makes one ordered cycle stable. A complete analyzer may enumerate any representative cycle, every simple cycle or a strongly connected component. Those choices disagree about whether new debt exists on an unchanged graph, especially when cycles share nodes or a new edge goes into a previously cyclic component. Enumerating every simple cycle can grow exponentially. The canonical record has optional edges and no complete module-ID-to-path mapping for the stated area lookup. Sources: R-176 (`tenet/specs/prd/catalog.md:17`), ALG-06 (`tenet/specs/tech-spec/algorithms.md:95–97`), `evidence/research-code-health.md:11,22,61`.

**Accept:** Define the required directed graph or equivalent violation set and how the check proves its coverage. Choose a bounded, deterministic comparison unit that catches a newly cyclic edge without requiring exhaustive enumeration. For example, the contract can compare canonical directed edges whose endpoints share a cyclic component, while showing a bounded cycle witness as a hint. Define endpoint-to-area joins, explicit unknown handling, capabilities for third-party optional adapters and fixtures for overlapping cycles, a new edge inside an existing cyclic component, cross-area module IDs, and two valid reporter presentations of the same graph.

### F6 · blocker — Missing observations and policy promotion can bypass the declared mode precedence

**Definition lines 60–64, 68–70, 101 and 106:** “Evaluate ratchet (blocks if `enforce` & unwaived)” versus “`failure` (`unknown`, never silent pass)”; “Effective mode = `min(rules["health-ratchet"], indicator.declared_mode, metric_cap)`”; “raising `tolerance`/`max_new`, lowering `samples` floor”.

The outcome table can make a missing newly observed or optional advisory-only indicator block a `verify` PR despite the cap. For a non-zero exit it does not separate a failing reported health observation from a pinned check that is independently mandatory. The proposed schema lists `tolerance` for all indicators and omits `max_new` and the sample floor, while §3.2 puts `max_new` in `measurement`. A reader can take it from producer-controlled data and silently loosen the gate. The layer rule also lacks a deterministic test for whether a new `scope_globs` policy narrows a parent scope. Sources: R-214/R-215 and R-204 (`tenet/specs/prd/tooling.md:89–90`, `tenet/specs/prd.md:91`), ALG-06/07 (`tenet/specs/tech-spec/algorithms.md:94–110`), `tenet/specs/tech-spec/ci.md:229–245`.

**Accept:** Separate observation status, applicability, effective mode and required-check CI conclusion. Keep CI §10's failure for missing required controls, while retaining diagnostic-only output with no false credit for optional observe/advise indicators. Define policy discriminants, defaults and ownership for `max_new`, comparative tolerance and sample floors. Require target policy to supply gate parameters and reject report-provided overrides. Freeze inherited scope or define a decidable compatible selector change and reject unresolved inclusion. Test missing new-at-verify and mandatory-at-verify side by side, a report with its own tolerance, approved promotion and removal or narrowing of inherited scope.

### F7 · blocker — Waivers can be mistaken for verification and expire only in the display

**Definition line 73 and AB-8 line 92:** “Unexpired waiver passes **only that evaluation**”; “once `now >= expiry` without fix or `change-policy` re-baseline, area health flips to `declined / expired-waiver`”; “re-surfaces expired area decline on `board`”.

The evaluator must distinguish a valid exception from a satisfied evidence claim. R-203 requires expiry to re-block, and R-143 changes readiness when an area declines. A board-only outcome leaves eligibility unresolved when the same exception expires on an open PR, or a merged exception is still active when another packet reaches a readiness gate. The draft does not define the integrated receipt link and the recovery condition for a specific area/indicator shortfall, especially when several waivers overlap or a partial observation appears to fix one. The question on assure strength can use the current CI §6 proof minimum until approved otherwise. Sources: R-203 (`tenet/specs/prd.md:85`), R-143/R-175 (`tenet/specs/prd/catalog.md:16,18`), `tenet/specs/tech-spec/kernel.md:34,46–50`, `tenet/specs/tech-spec/ci.md:199,245`.

**Accept:** Use the kernel's `waived` disposition and exclude it from verified-change credit. Bind active debt to its measurement, waiver and integration records and define how verified comparable repair, authorized reset, and overlapping exceptions affect current area health. Define live re-evaluation on the same open subject at expiry and apply post-merge decline to R-143's lane/readiness rules without rewriting past decisions. Add separate fixtures for an open PR at expiry, merged decline reaching an intake or next gate, partial fix, and historical replay of the earlier waived verdict.

### F8 · blocker — Durability cannot be scored from a fixed authoritative history yet

**Definition line 74 and AB-12 line 96:** “Mature cohort = integrated default-branch commits `M` in `[as_of - 60d, as_of - 30d]`”; “`git diff -U0 -M <parent>..<M>`”; “along default-branch history”; “Join `{agent_definition, work_type}` from immutable run/work events (`CP-0037`)”.

`<parent>` is ambiguous for merge commits, and counting both a merge diff and its component commits would attribute the same lines twice. `M.merged_at` has no selected source or rule for direct push, amended/rewritten history or a missing merge event. Commit timestamps can be author-supplied and create a different maturity result from the integration record. The plan names CP-0037's attribution deliverable but gives CP-0039 no dependency or replay input shape, and known missing attribution is distinct from absent line history. The latter can misread a truncated window as perfect durability. The rate formula, zero denominator and generated-file exclusions also lack fixed inputs. Sources: R-178 (`tenet/specs/prd/catalog.md:98`), `tenet/specs/tech-spec.md:224`, `tenet/specs/plan/0.1.x.md:23,25`, `tenet/specs/tech-spec/kernel.md:34`.

**Accept:** Define one ordered default-branch integration stream, parent choice, and trusted timestamp/attribution join with CP-0037 or a named input adapter. Specify boundaries, path-policy snapshot, retained line identity including pure moves or formatting, completeness requirements, denominator and empty values. If history is partial, emit explicit coverage or unknown and exclude it from a full rate. Cover normal two-parent merges without double counting, malformed or missing integration timestamps, shallow history, zero eligible lines and conflicting or absent attribution.

### F9 · should — Tie tamper warnings and approvals to the actual kind of change

**Definition line 66:** “tests (`ALG-09`) or added inline suppression tokens … -> `weakening` / `health-tamper`”; “`mechanics` (`! Tamper watch:` + requires non-author review)”.

R-103 gives weakening an owner approval, trust-surface changes `change-policy`, and ordinary mechanics normal review. A touch to a test or a token in a string can be worth showing on a card without proving weakening or imposing a new review step. Actual weakening must reach its proper gate, even when the health indicator is in `observe`. Sources: R-103 (`tenet/specs/prd/catalog.md:14`), R-214/R-216 (`tenet/specs/prd/tooling.md:89,91`), `evidence/research-code-health.md:63,75–77`.

**Accept:** Map observed touches to diagnostic warnings and separately map established weakening and protected changes to the existing gates. Explain which markers are detected only and which configurations are protected inputs. Add fixtures for a new test, a marker in a string, a removed assertion and an approved mechanical change, without putting routine quick work through an extra step.

### F10 · should — Stable denominators need change identity and an observation window

**Definition lines 77 and 119:** “deduplicated per unique `(evaluation_id, finding_id)` across retries”; “adjudicated wrong refusals per 100 evaluated changes”.

A description edit, changed target basis or fresh health snapshot can yield a new evaluation for one change. Counting distinct evaluations as distinct changes, or letting an old useful/unuseful mark attach to a replaced finding, can paint a different noise picture without a different human experience. The packet still leaves the retrospective window and no-data reporting incomplete. Sources: R-177 (`tenet/specs/prd/catalog.md:39`), R-216 (`tenet/specs/prd/tooling.md:91`), `tenet/specs/tech-spec/kernel.md:66–68`, `evidence/research-code-health.md:39–45`.

**Accept:** Define an observation-window anchor and a stable change/finding association. Count unique changes with in-scope observations and count a false block only after adjudication. Keep per-evaluation detail and distinguish insufficient sample from a zero rate. Add a fixture with the same PR evaluated against two baselines and one reviewed refusal.

VERDICT: BLOCKING 8
