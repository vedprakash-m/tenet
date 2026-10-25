# Specification: Offline Campaign Reporting

> **Spec type:** API contract
> **Load-bearing frameworks:** F2 (acceptance criteria), F3 (scope), F4 (executor context) | **Supporting:** F5 (failure conditions), F6 (ambiguity audit)
> **Date:** 2026-10-25 | **Author:** GitHub Copilot | **Decision owner:** Tenet repository owner
> **Status:** Owner approved bounded implementation under decisions 38 A and 39 A. The exact input-byte digest is preserved; only completed attempts establish known outcomes. Reporting consumes local records only; it grants no execution, qualification, support-matrix or publication authority.
> **Zero-Question Score:** 0 unresolved questions required for implementation sign-off; reviewer findings and their dispositions are recorded in §6.

## How to Read This Spec

| Role | Must read | Reference as needed |
|---|---|---|
| Engineer / executor | Outcome, scope, acceptance criteria, dependencies | Failure conditions, implementation guidance |
| QA / test | Acceptance criteria, failure conditions | Input and output contracts |
| Decision owner | Outcome, scope, open tensions, assumptions, self-critique | Acceptance criteria |

## Notation Key

- `[Validated]` names a canonical requirement or owner decision.
- `[Assumed: verify]` names a conservative design choice requiring review before implementation sign-off.
- `[Unknown: TBD]` names a blocking unresolved question and owner.
- Acceptance score 3 means binary-testable.

## 1. Outcome Statement

After implementation, a maintainer can turn one bounded, locally stored `CampaignReportInputV1` into deterministic JSON, Markdown, or JUnit XML without launching a subject, grader, model, process, network request, or host action. The report preserves every planned slot and recorded attempt, publishes each metric with its numerator, denominator and unknown coverage, and labels its eligibility result as an offline calculation rather than qualification.

**Verification:** Run identical input bytes twice and compare exact output bytes. For semantically equivalent inputs with reordered arrays, compare all derived report content and verify each exact-byte input digest separately; test missing, failed, cancelled, blocked, invalid, unknown, and unplanned records; prove no external effects.

**Outcome rubric score:** 3. Output equality, row preservation and exit status are binary-testable.

## 2. Scope

### IN Scope

| # | Capability | Description | Acceptance Criteria |
|---|---|---|---|
| S-1 | Strict report input | Validate a bounded, versioned snapshot of a frozen plan, its planned slots and retained attempts. | AC-1, AC-2 |
| S-2 | Deterministic aggregation | Calculate descriptive metrics and gate comparisons from validated input without dropping unknown or unsuccessful evidence. | AC-3, AC-4, AC-5 |
| S-3 | Three output formats | Emit JSON, Markdown and JUnit XML from the same normalized report model. | AC-6 |
| S-4 | Offline CLI | Read one local input and write one selected format to stdout; report status is reflected in documented exit codes. | AC-7 |

### OUT of Scope

| # | Excluded Capability | Rationale | Where/When Addressed |
|---|---|---|---|
| X-1 | Scheduling, capture, admission, execution, grading or retry authorization | A report is a read-only projection; owner decision 32 A authorizes only offline implementation. | Separate reviewed contract and approval before live action. |
| X-2 | Proving the snapshot was frozen before outcomes were observed, signed, authentic or complete at source | Local JSON and hashes do not establish trusted provenance. | Separate authorization and provenance contract; no such approval exists. |
| X-3 | Passing a campaign, qualifying a requirement, changing support status, release eligibility or publishing results | Reporting eligibility is necessary evidence at most, not authority or qualification. | Canonical PRD and separate owner-approved campaign/release process. |
| X-4 | Statistical inference or confidence intervals | PRD supplies no campaign confidence-interval method; descriptive rates avoid inventing one. | Separate metric/statistical design if needed. |
| X-5 | Dashboard, account meter, public report, private-archive access or report-file writes | Harness §7.9 requires CLI outputs; stdout avoids extra persistence and disclosure. | Not part of this slice. |

### Scope Dependencies

The input is a declarative snapshot, not a trusted execution record. It must include its own frozen plan and observed attempt records. Current `StaticProtocolV1` defines `cases`, not planned slots, thresholds or run-result records; this contract defines a distinct `CampaignReportInputV1` shape and does not extend or reinterpret the static protocol. `[Validated: current `eval-protocol.md` schema; future protocol-shape changes trigger review below.]`

### Open Scope Tensions

None. The output field `eligibility` is strictly an offline, input-derived gate; the report cannot call a campaign qualified or supported.

## 3. Acceptance Criteria

| # | Type | Criterion | Score | Annotation |
|---|---|---|:---:|---|
| AC-1 | Behavioral | A valid `CampaignReportInputV1` has strict fixed-object schemas, unique campaign/slot/attempt IDs, a declared protocol digest, nonempty planned slots, and bounded slots/attempts; duplicate slot/attempt IDs, unknown fields, malformed JSON/UTF-8 and duplicate JSON keys reject before rendering. | 3 | [Assumed: verify bounds and parser reuse in review] |
| AC-2 | Integrity | Every planned slot appears exactly once, including slots with no attempt; every attempt appears exactly once, including cancelled, blocked, invalid, unknown and unplanned attempts. Missing required observations are named in diagnostics. Dangling/unplanned records remain visible and make eligibility `inconclusive`; duplicate identity keys reject as invalid input. | 3 | [Validated: harness §7.9 requires all planned slots and attempts retained] |
| AC-3 | Metric correctness | Every ratio includes numerator, denominator, per-metric unknown count with reason codes, unit and method. Missing/unknown outcomes remain in the planned denominator. First-run counts only attempt 1; independent repetitions are separate planned slots; retries never replace or inflate them. | 3 | [Validated: PRD §6.2; denominator definitions below] |
| AC-4 | Completeness | Failed, cancelled, blocked, invalid and unknown attempts remain in totals and failure distributions. Exclusions appear in a separate output section with reason, adjudication and linked attempt measurements; they never disappear from denominators or resource totals. Missing data is never converted to zero or inferred. | 3 | [Validated: harness §7.9 and PRD §6.2] |
| AC-5 | Safety and interpretation | Safety is required per slot by an explicit frozen flag; any known violation fails the safety gate, while any required unknown/not-run result makes it inconclusive unless a known violation already fails it. `eligibility: pass` means only declared offline completeness and threshold checks passed; it never means qualified, supported, release-ready, owner-approved or host-observed. | 3 | [Validated: harness §7.9; owner decision 32 A] |
| AC-6 | Output consistency | JSON, Markdown and JUnit XML are deterministic projections of one normalized report. JSON is authoritative; Markdown summarizes by case/stratum/role and lists all exceptions; JUnit retains Tenet status/count properties, but is expressly not a qualification gate because consumers may treat skipped tests differently. | 3 | [Assumed: verify JUnit mapping in review] |
| AC-7 | Negative / CLI | `npm run eval:report -- --input <path> --format json|markdown|junit` reads one bounded local input and writes the selected format to stdout only. Usage errors exit 1; invalid input exits 2; a valid report with `eligibility: fail` or `inconclusive` exits 3 after emitting the report; `pass` exits 0. It launches no process, grader, model, network or host action and writes no file. | 3 | [Assumed: verify CLI convention in review] |
| AC-8 | Metric scope | Include first-run and repeated-run success, failure distribution, safety pass/unknown counts, seeded-defect recall and precision by severity only when complete truth/attempt coverage exists, false-friction controls, intervention counts, wall/active/wait time with visibility gaps, retries/delegations/check counts, and cost grouped by unit and scope. Unsupported measures render `not measured` with a reason, not zero. | 3 | [Validated: harness §7.9 and PRD §6.2] |

**Complexity:** Medium; eight criteria. **Definition of done:** every criterion passes; output formats agree; no unknown or excluded evidence disappears; the report cannot authorize or qualify a campaign.

### Input Contract: `CampaignReportInputV1`

The input is strict UTF-8 JSON no larger than 10 MiB. Fixed objects reject unknown keys. IDs match `^[a-z0-9]+(-[a-z0-9]+)*$`; SHA-256 digests are 64 lowercase hexadecimal characters. Limits are 5,000 planned slots, 20,000 attempts, 100 seeded defects per campaign, 256 UTF-8 bytes per ID, 1,024 bytes per opaque source reference, and nesting depth 32. These bounds are proposed and require independent review. Duplicate IDs are invalid input (exit 2), not an eligibility diagnostic.

Top-level fields:

| Field | Required meaning |
|---|---|
| `schemaVersion` | Literal `1`. |
| `campaignId` | Stable ID for this report input. |
| `purpose` | `formative` or `qualification`, copied as declared intent only. |
| `protocolSha256` | Exact-byte digest declared by the input; the report does not find or validate a protocol file. |
| `plannedSlots` | Frozen list of unique slot IDs, case IDs, stratum IDs, positive repetition numbers, role (`primary`, `negative-control`, `safety`), `safetyRequired`, positive `wallBudgetMs`, required observation declarations (`id`, `kind`, `required`), and for controls the expected result. Repetition numbers are contiguous from 1 per case/stratum/role; each repetition is a distinct independent slot. |
| `thresholds` | Nonempty frozen list with unique selectors: supported `metricId`, exact `groupScope`, comparator (`min`, `max`, `equals`), finite value and unit. Supported IDs are `first-run-success-rate`, `repeated-run-success-rate`, `safety-violations`, `false-friction-rate`, `review-recall`, `review-precision`, and `observed-cost`. `groupScope` is exactly `{ "level": "campaign" }` or `{ "level": "case-stratum-role", "caseId": "...", "stratumId": "...", "role": "..." }`. Units are `ratio`, `count`, `usd`, `credits`, `tokens`, or `requests`, with metric-specific validation. An `observed-cost` threshold additionally requires one `measurementScope` (`attempt`, `campaign`, `shared-window`, or `unknown`); other metric IDs require `measurementScope: null`. Each selector must match exactly one emitted row; zero or multiple matches make eligibility inconclusive. Cost thresholds never sum or apply across scopes. A campaign-level safety threshold `safety-violations max 0 count` is mandatory whenever any planned slot requires safety evidence. The report cannot prove thresholds predate results. |
| `seededTruth` | Optional frozen defect IDs and severities for recall/precision; absent or incomplete truth makes those metrics `not measured`. |
| `attempts` | All recorded attempts, including unique attempt ID, slot ID or null for unplanned work, positive attempt number, terminal status, contract outcome, safety result, observation states keyed by declared observation ID, defect findings, failure codes, interventions, retry/delegation/check counts, time measurements and attempt-scoped cost observations. Attempt number >1 is a retry of the same slot, not an independent repetition. |
| `resourceMeasurements` | Optional campaign/shared-window cost observations with explicit approved unit, source reference and scope. Campaign/shared-window values are not distributed across attempts. |
| `exclusions` | Optional references to unique attempt IDs with frozen reason codes, adjudication (`pending`, `accepted`, `rejected`) and opaque disposition reference. An accepted exclusion never erases the attempt, denominator entry or resource measurements. |

Attempt statuses are `completed`, `blocked`, `cancelled`, `invalid`, or `unknown`. Contract outcome is `pass`, `fail`, or `unknown`; safety result is `pass`, `violation`, `unknown`, or `not-run`. Required observations use `present`, `missing`, or `unknown`. The report emits every declared required observation for each attempt; absence is rendered as `missing` with `(attemptId, slotId, observationId)` in diagnostics. A slot requires safety evidence exactly when `safetyRequired` is true or a declared required observation has `kind: safety`. Terminal and evidence states are separate: a non-completed attempt may retain observations and cost, but its contract outcome is unknown for success/failure metrics regardless of any supplied `contractOutcome`; only a `completed` attempt establishes a known pass or fail. A completed attempt may still have unknown observations. A measurement's finite unit enum is `usd`, `credits`, `tokens`, `requests`, `milliseconds-wall`, `milliseconds-active`, or `milliseconds-wait`; cost entries cannot use duration units and duration entries cannot use cost units.

Each measurement is nullable and typed: wall/active/wait duration is nonnegative integer milliseconds; retries/delegations/checks/interventions are nonnegative integer counts; costs are finite nonnegative values with a whitelisted unit, opaque source reference, and scope (`attempt`, `campaign`, `shared-window`, or `unknown`). Shared-window and campaign totals are itemized separately and never allocated to attempts. Different units or scopes are never added. Missing measurements remain null and contribute to that metric's unknown count.

### Output Contract: `CampaignReportV1`

The normalized report contains exact input-byte SHA-256, declared campaign/protocol identity, purpose, every planned slot, every attempt, exclusions with reason/adjudication, required-observation results, diagnostics (including missing required observations and unplanned attempts), metric rows, cost-by-scope/unit rows, gate comparisons and `eligibility` (`pass`, `fail`, `inconclusive`). Every metric row identifies its group: campaign total or exact `(caseId, stratumId, role)`; campaign ratios aggregate counts and never average subgroup rates. Every source-supplied claim is labeled declared or observed as supplied; the renderer does not imply external verification. Metric `unknown.count` is per metric and overlaps are not de-duplicated; `unknown.slotsAnyMetric` is a separate union count.

Each threshold names `metricId`, metric group scope, unit, comparator and value; cost thresholds additionally name exactly one `measurementScope`. The comparator applies only to the uniquely matched row. A threshold cannot aggregate or fan out across cost scopes, units, cases, strata or roles. Diagnostics identify any threshold with no matching row or more than one match.

Metric rules:

- **First-run success:** numerator is planned slots whose attempt 1 is `completed`, has `contractOutcome: pass`, and satisfies its declared wall-time budget; denominator is all planned slots, including repetitions. Missing attempt 1, any non-completed status, unknown outcome or unavailable required budget remains in the denominator and increments this metric's `unknown.count` with a reason. A completed `contractOutcome: fail` is a known failure. Later attempts do not change this numerator.
- **Repeated-run success:** report separately for planned slots with `repetition >= 2`; numerator is those whose attempt 1 is completed, passes, and satisfies its declared wall-time budget; denominator is all such planned slots. If none exist, value is `not measured`. An attempt numbered >1 is a retry, never a repetition. Missing attempts, non-completed statuses, unknown outcomes or unavailable budgets remain in the denominator and increment the metric's unknown count.
- **Failure distribution:** count attempts by supplied failure code and terminal status, including cancellations, blocks, invalids, unknowns and retries. Preserve failures from earlier attempts.
- **Safety:** count pass, violation, unknown and not-run for every attempt, plus required-slot counts. A known violation fails the gate. Otherwise, any required unknown/not-run makes it inconclusive. Pass requires a known pass for every slot where `safetyRequired` or a required `kind: safety` observation is true, and the frozen zero-violation threshold.
- **Recall and precision:** compute only when seeded truth, attempt-1 findings and required observations are complete for every planned slot in the relevant case/stratum. Otherwise retain partial TP/FP/FN and unknown counts but render the ratio `not measured`; do not compute a possibly inflated attempted-only rate. Match stable seeded IDs and report counts/denominators per severity. Never infer seeded truth or treat an unseeded finding as a true positive. If the source cannot distinguish an unseeded finding from a false positive, report precision as not measured.
- **False friction:** count negative-control slots whose recorded result contradicts the frozen expected result. Missing expected/result values are unknown, not non-friction.
- **Effort and activity:** sum only reported values with compatible units/scopes; expose measured, missing and visibility-gap counts. Never infer active human effort or comprehension from tool time.
- **Retries/delegations/checks/interventions:** show totals and per-slot distributions across all attempts, with missing data counts.
- **Cost:** emit separate totals for each `(unit, scope)` pair and supporting observation count/source coverage, plus unknown attribution. Do not combine scopes, convert tokens/requests to money or claim exact per-run cost from shared-account/window totals.
- **Uncertainty:** report descriptive counts and denominators only. Do not emit confidence intervals, significance claims, or population estimates in v1.

`eligibility` rules: `fail` takes precedence if a known safety violation or known threshold breach exists. Otherwise `inconclusive` applies when required records/observations/measurements are absent or unknown, an attempt is unplanned/dangling, an exclusion is pending, or the plan-to-attempt mapping is incomplete. Otherwise `pass` requires all required evidence complete and every declared gate passing. The report must always state in a visible banner/property that this is computed from untrusted local declarations and is not qualification. This label cannot stop an external consumer from misusing the report; no consumer integration or automatic approval is in scope.

### CLI and formats

`--format` is required and accepts exactly `json`, `markdown`, or `junit`. JSON emits one compact UTF-8 JSON document plus newline and is the authoritative detailed report. Markdown includes all metric/count tables grouped by case/stratum/role and an exception table listing every non-pass, missing, unknown, excluded and unplanned slot/attempt; passing row-level detail remains in JSON/JUnit. JUnit XML uses one testcase per planned slot, expanded for each recorded attempt; an unattempted slot is one skipped testcase. Each testcase has a `tenet-status` property preserving the original Tenet state and each suite has explicit planned/pass/fail/skipped/unknown counts. Failed contract/safety outcomes use `<failure>`; blocked, cancelled, invalid, unknown, missing and not-run outcomes use `<skipped>`. Unplanned attempts appear in a separate suite and are never omitted. JUnit is a convenience format, not a qualification/merge gate; external consumers can interpret `<skipped>` differently. Output rows are sorted lexicographically by stable IDs, then numeric attempt/repetition, independent of input array order. No timestamp, hostname, absolute path, locale-sensitive number or random ID is emitted; source references are opaque identifiers, not filesystem paths.

Markdown exception rows include each non-pass outcome, missing required observation, exclusion, unplanned attempt and slot without an attempt. Diagnostic details are bounded and never contain request or file content. For example, if case `c1` in stratum `local` and role `primary` has two planned first attempts (one pass, one missing), the summary is:

```markdown
> Offline report from untrusted local declarations. Not qualification or support evidence.

## Eligibility
inconclusive

## Metrics
| Metric | Group | Unit | Numerator | Denominator | Unknown | Value |
|---|---|---|---:|---:|---:|---:|
| first-run-success-rate | c1 / local / primary | ratio | 1 | 2 | 1 (missing-attempt-1) | 50% |

## Exceptions
| Slot | Attempt | Status | Detail |
|---|---:|---|---|
| slot-2 | 1 | missing | no attempt record |
```

## 4. Context and Decisions

### Executor Profile

| Field | Value |
|---|---|
| Executor type | Senior TypeScript engineer |
| Domain familiarity | High |
| Codebase familiarity | High |
| Available for questions? | Decision owner resolves blocking contract questions before implementation sign-off. |

### Glossary

| Term | Definition | Why non-obvious |
|---|---|---|
| Planned slot | One frozen case/stratum/repetition/role combination. | It remains in the denominator even if no attempt exists. |
| Attempt | One numbered execution record for a planned slot, or an explicitly unplanned record. | A retry is not an independent repetition and cannot overwrite attempt 1. |
| Unknown coverage | Required evidence that is missing, ambiguous, unavailable or not measured. | Unknown is never treated as a pass, zero, or exclusion by default. |
| Report eligibility | Result of the report's declared completeness/threshold checks. | It is not campaign qualification or trusted approval. |

### Decisions Already Made

| # | Decision | Rationale | Date | Decided by |
|---|---|---|---|---|
| D-1 | Keep reporting local and read-only; emit JSON, Markdown and JUnit XML to stdout. | Harness §7.9 requires these formats and excludes dashboards/meters; stdout avoids persistence. | 2026-10-25 | Owner decision 32 A plus this draft |
| D-2 | Preserve all planned slots and attempts and never allocate shared-window costs. | Missing evidence and attribution uncertainty must remain visible. | 2026-10-25 | PRD §6.2; owner decisions 21-22 |
| D-3 | Treat report eligibility as an untrusted descriptive gate, not qualification. | A local report cannot authenticate a frozen campaign or owner disposition. | 2026-10-25 | Owner decision 32 A; harness §7.9 |
| D-4 | Preserve exact input-byte SHA-256; permutation invariance applies to derived report content, not that raw-byte digest. | Reordered JSON arrays are different source bytes and must retain distinct exact identities while producing the same normalized metrics. | 2026-10-25 | Owner decision 38 A |
| D-5 | Only `completed` attempts establish known contract outcomes. Non-completed statuses remain unknown regardless of supplied `contractOutcome`. | Terminal status is required to interpret outcome evidence; do not infer success or failure from partial/blocked execution. | 2026-10-25 | Owner decision 39 A |

### Dependencies

| # | Dependency | Type | Status | Owner | Blocker? |
|---|---|---|---|---|---|
| DEP-1 | `StaticProtocolV1` and shared qualification tuple | Technical | Implemented locally; protocol does not contain planned slots or thresholds | Maintainer | No, input is separately hash-labeled |
| DEP-2 | Trusted frozen campaign and run-result provenance | Data / authority | Not specified or authorized | Decision owner | Yes for qualification; not needed for an untrusted offline projection |
| DEP-3 | Existing `yaml` duplicate-key detector, Zod and local CLI conventions | Technical | Present in repository | Maintainer | No; verify reuse in review |

### Constraints

| # | Constraint | Type | Source |
|---|---|---|---|
| C-1 | No host/model/capture/account/spend/network actions or private archive access. | Policy | Owner decision 32 A and decisions 27-31 |
| C-2 | No package dependency, kernel payload, verdict, budget, support matrix or release-policy change. | Technical / policy | Owner decision 32 A and repo architecture |
| C-3 | No report file write; one selected format goes to stdout. | Technical | Harness §7.9 plus this conservative design |

### Stakeholders

| Role | Name | Involvement |
|---|---|---|
| Decision owner | Tenet repository owner | Signs scope and resolves findings before implementation. |
| Technical reviewer | Independent reviewer | Read-only review of contracts, metrics and failure behavior. |
| Executor | Maintainer | Implements only after separate owner sign-off. |

## 5. Failure Conditions

| # | Type | Assumption at Risk | Deviation Signal | Escalation Action | Severity |
|---|---|---|---|---|---|
| FC-1 | Data | Supplied attempts represent the complete retained record. | Duplicate/dangling IDs, missing slots, unknown required observations, truncation. | Emit all parseable records and diagnostics; mark inconclusive; do not repair or infer. | Critical |
| FC-2 | Integrity | Declared hashes/thresholds are exact and frozen. | Input gives a digest but no trusted pre-run binding. | Label them declared; keep output non-authoritative; never claim qualification. | Critical |
| FC-3 | Metrics | The fixed denominators match PRD §6.2 and harness §7.9. | A consumer wants to drop missing/failed/cancelled slots or pool retries. | Stop implementation and obtain an owner-approved contract revision. | Major |
| FC-4 | Cost | Cost observations have compatible scopes and units. | Shared-window totals are assigned to attempts or unlike units summed. | Preserve separate observations; mark per-attempt attribution unknown. | Major |
| FC-5 | Output | Format consumers interpret skipped/failed tests consistently. | JUnit consumers drop skipped cases or count retries as separate planned slots. | Keep JSON authoritative; add consumer compatibility evidence before relying on JUnit. | Major |
| FC-6 | Authority | A report status is mistaken for live approval or product support. | Any CLI, document or consumer says `qualified`, `supported`, or `release-ready`. | Stop; remove the claim and require separate provenance/owner process. | Critical |

**Worst Misinterpretation Test:** An executor treats locally supplied `eligibility: pass` as proof the protocol was frozen before the run or that the native host passed. The report is explicitly untrusted and its result is not qualification; tests assert the source/evidence disclaimer in every format.

## 6. Ambiguity Audit

| # | Ambiguity Type | Question | Resolution | Confidence |
|---|---|---|---|---|
| AMB-1 | Definitional | What counts as first-run success? | Attempt 1 only, within declared wall budget, over every planned slot; later attempts do not replace it. | H |
| AMB-2 | Denominator | Are absent attempts excluded? | No. Every planned slot remains in every applicable denominator; missing counts as unknown. | H |
| AMB-3 | Definitional | Can retries count as independent repetitions? | No. Repetition is frozen in the slot; attempt number is separate. | H |
| AMB-4 | Cost | Can account/window cost be divided among cases? | No; group by scope/unit and report unknown per-attempt attribution. | H |
| AMB-5 | Statistical | What confidence interval should the report use? | None in v1. Output descriptive counts only; a later metric contract must select a method before inferential claims. | H |
| AMB-6 | Authority | Does eligibility pass qualify a campaign? | No. It is an untrusted local calculation and is necessary at most, never sufficient. | H |
| AMB-7 | Integration | Does `StaticProtocolV1` supply slots, thresholds or result provenance? | No. `CampaignReportInputV1` is a separate self-contained snapshot; hash values are declarations and not authenticated by this contract. | H |

**Zero-Question Score:** 0 unresolved implementation questions after independent review dispositions. The report does not satisfy the separate trusted-provenance/qualification requirement.

### Independent Review and Dispositions (2026-10-25)

Reviewer: fresh-context read-only reviewer. Findings and dispositions:

| Finding | Severity | Disposition |
|---|---|---|
| Per-metric unknown count was not explicitly orthogonal to its denominator. | Blocker | **Accepted.** Every metric carries its own unknown count/reasons; unknown slots remain in denominator. Global union coverage is separately named. Added E1. |
| Safety completeness and which slots require safety evidence were ambiguous. | Blocker | **Accepted.** `safetyRequired` and required observation `kind: safety` define the set; unknown/not-run is inconclusive unless a known violation already fails. Added E5. |
| Duplicate planned slot IDs had conflicting reject/inconclusive behavior. | Blocker | **Accepted.** Duplicate campaign/slot/attempt IDs are invalid input and exit 2; dangling/unplanned attempt records remain visible and make eligibility inconclusive. Added E9. |
| JUnit `<skipped>` semantics vary by consumer. | Blocker | **Partially accepted.** Add `tenet-status` properties and explicit suite counts; JSON remains authoritative and JUnit cannot be a qualification/merge gate. A compatibility test against a concrete CI importer is deferred until a consumer is selected; this spec makes no claim that XML controls consumer behavior. Added E13. |
| Exclusions were not explicit in the normalized output. | Blocker | **Accepted.** Output has a separate exclusions list with reason/adjudication and retains linked attempt measurements. Added E4. |
| Recall with unattempted seeded cases could produce an inflated attempted-only rate. | Major | **Accepted.** Ratios are not measured unless truth/findings cover all planned slots for the metric; partial TP/FP/FN and unknown coverage remain visible. Added E6. |
| Cost units needed a finite vocabulary. | Major | **Accepted.** Added finite unit enum and reject unknown or mismatched cost/duration units. |
| Repetition versus retry was not sufficiently formal. | Major | **Accepted.** Independent repetitions are separate planned slots; attempt numbers >1 are retries and cannot count as repetitions. Added E2. |
| Missing required observations were not enumerated in output. | Major | **Accepted.** Each missing required observation appears in diagnostics by attempt/slot/observation ID. Added E3. |
| Cost totals needed explicit scope itemization. | Major | **Accepted.** Group costs by `(unit, scope)` with no cross-scope/unit addition or allocation. Added E8. |
| Unknown coverage needed global versus per-metric semantics. | Minor | **Accepted.** Per-metric counts may overlap; `unknown.slotsAnyMetric` is a separate union. |
| Determinism across input-array reorder was not tested. | Minor | **Accepted.** Sorting rules are input-order independent; E10 compares reordered inputs. |
| Markdown detail level was unspecified. | Minor | **Accepted.** Markdown groups complete metrics and lists all exceptions; JSON/JUnit retain row detail for passing cases. |
| Eligibility disclaimer could be ignored by downstream consumers. | Minor | **Partially accepted.** Required disclaimer appears in every output and is tested. No report can prevent an external consumer from ignoring it; external approval/merge integrations remain out of scope. Added E14. |
| Ephemeral paths/timestamps could destabilize output or disclose local paths. | Minor | **Accepted.** Omit timestamps/hostnames/absolute paths and accept only opaque source references; deterministic output is tested. |

### Owner Resolution (2026-10-25)

Decision 38 A resolves a spec contradiction: exact-byte source identity is retained, while order invariance applies to normalized derived report content. E10 compares derived content after removing only the input-byte digest and verifies both digests against their respective exact source bytes. No other report field is excluded from the comparison.

Decision 39 A resolves attempt interpretation: `completed` is required for a known success/failure. Blocked, cancelled, invalid and unknown terminal statuses remain unknown and in the planned denominator, even if the input also supplies a contract outcome.

Reviewer recommended no implementation until blocker/major findings were resolved. The listed contract changes disposition those findings. The two partial dispositions remain explicit limitations, not claims that a CI consumer honors JUnit properties or the disclaimer.

### Follow-up Review (2026-10-25)

The reviewer confirmed B-1 through B-3, B-5 and M-1 through M-5 resolved; B-4 remains explicitly bounded. Follow-up findings:

| Finding | Severity | Disposition |
|---|---|---|
| Cost thresholds did not select one scope. | Blocker | **Accepted.** Each threshold matches one exact metric row, including unit, group and, for cost, `measurementScope`; zero/multiple matches are inconclusive. Added E15. |
| Markdown grouping/exception details lacked a worked example. | Major | **Accepted.** Added a case/stratum/role example and exact exception categories; E16 checks golden structure and E10 checks reorder-stable bytes. |
| Separation from `StaticProtocolV1` was not independently confirmed. | Major | **Accepted.** Confirmed the current protocol schema has cases but no slots/attempts/thresholds; added a revision trigger requiring report review if those identities are added. |

Follow-up blocker disposition: accepted and resolved by exact threshold-to-row selectors. No new blocker remains for owner review. JUnit consumer interpretation and trusted provenance remain excluded, disclosed limitations.

## 7. Implementation Guidance

### Suggested Approach

Use a pure strict schema/aggregator to produce one normalized result. Keep the CLI as a thin local-file/stdout adapter. Render JSON first, then derive Markdown and JUnit from the same normalized object. Reuse the existing fatal UTF-8 and duplicate-key pattern; do not import CLI modules with side effects. Keep the report outside `packages/kernel` and the shipped plugin bundle.

### Known Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Input is incomplete but plausibly shaped | H | H | Keep planned slots separate from attempts and mark coverage unknown. |
| JUnit consumers interpret retries/skip outcomes differently | M | M | JSON is authoritative; test generated XML structure and known consumer compatibility before use as a gate. |
| Metrics drift from canonical PRD | M | H | Name metric formulas in tests; update this contract when PRD rules change. |

### Milestones / Checkpoints

| # | Milestone | Checkpoint Criteria | Estimated Effort |
|---|---|---|---|
| M-1 | Pure schema and aggregate | Adversarial fixtures preserve all records and calculate exact counts. | M |
| M-2 | Deterministic renderers and CLI | JSON/Markdown/JUnit parity, stdout-only behavior, exit-code tests. | M |
| M-3 | Full required gates | Focused tests, typecheck, full `npm run ci`, docs/changelog/plan updates. | M |

## Open Tensions

None within the authorized offline reporting boundary. A trusted frozen-campaign source is deliberately excluded and remains a prerequisite for using any report as qualification evidence.

## Assumption Registry

| # | Assumption | Section | Confidence | Evidence | What Would Invalidate |
|---|---|---|:---:|---|---|
| A-1 | The report input should be a self-contained local snapshot, not a reader for private run archives. | §2-3 | H | Harness §7.9 and owner decisions 27-31 restrict access. | A separately approved, reviewed data-source contract. |
| A-2 | A descriptive report can calculate gate results from supplied records without claiming provenance. | §3 | M | Report is explicitly labeled untrusted and non-qualifying. | A consumer relies on this output as owner approval or qualification. |
| A-3 | JUnit XML is the intended standard test-report format. | §3 | M | Harness §7.9 says “standard test-report output” but does not name a format. | Owner or independent reviewer identifies another required format or incompatible consumer. |
| A-4 | Proposed input bounds are sufficient for initial offline reports. | §3 | M | Bounds are finite and well above currently expected small campaigns. | A canonical campaign exceeds these limits. |

## Adversarial Self-Critique

**Weakness 1: A hash is not a frozen-time proof.**
- **Assumption being made:** The report can safely calculate declared thresholds without authenticating when they were chosen.
- **What happens if wrong:** A user could present post-hoc thresholds as pre-registered.
- **Watch indicator:** Any consumer describes a passing report as a qualification result.

**Weakness 2: The input schema duplicates a future run-result contract.**
- **Assumption being made:** A self-contained report snapshot can be designed before campaign execution records exist.
- **What happens if wrong:** The report API becomes a second, incompatible evidence source.
- **Watch indicator:** A future admission/run spec defines different slot, attempt or observation identities.

**Weakness 3: JUnit may distort evidence.**
- **Assumption being made:** One testcase per slot/attempt and skipped mapping are portable enough for a standard report.
- **What happens if wrong:** CI consumers may omit skipped rows or miscount retries.
- **Watch indicator:** A target CI consumer's imported totals differ from JSON.

## Revision Triggers

| # | Trigger | Affected Section | Why |
|---|---|---|---|
| 1 | PRD changes the definition or denominator of campaign success/safety. | §3 | Metric formulas must follow canonical meaning. |
| 2 | Trusted campaign provenance or execution authorization is separately specified. | §2-3 | Input hashes and eligibility may need a provenance binding, without granting authority. |
| 3 | A concrete CI consumer rejects the JUnit mapping. | §3 | Standard-report output must not misrepresent planned slots or attempts. |
| 4 | `StaticProtocolV1` adds slot, attempt, threshold or observation identities. | §2-3 | Reconcile report input with the canonical protocol before implementing either consumer. |

## Appendix: Test Ownership

All tests belong in `packages/eval/test/report.test.ts`; no live or host test path is added.

| # | Example | Expected result |
|---|---|---|
| E1 | Ten slots: seven first attempts pass, two fail and one is missing; include an unknown outcome variant. | Numerator, denominator and per-metric unknown reasons are exact; unknown remains in denominator and union count is separate. |
| E2 | A failed first attempt followed by a passing retry; another case has distinct scheduled repetition slots. | Retry cannot change first-run or repeated-run results; only repetition slots >=2 enter repeated-run denominator. |
| E3 | A planned required observation is absent from an attempt. | Eligibility is inconclusive and diagnostics name attempt, slot and observation. |
| E4 | Excluded attempt with pending/accepted/rejected adjudication, plus cancelled, blocked, invalid and unknown attempts. | All remain visible; exclusions are separate; linked time/cost is retained; no outcome is inferred. |
| E5 | Required safety result missing, unknown, not-run, and one known violation. | Required missing results are inconclusive; a known violation fails; output gives counts and required-slot denominator. |
| E6 | Seeded truth spans attempted and unattempted slots, with complete and incomplete attempt-1 findings. | Incomplete coverage renders ratio `not measured`, while partial TP/FP/FN and unknown counts remain visible. |
| E7 | Incomplete or absent seeded truth. | Defect metrics render `not measured` with reason, not zero. |
| E8 | Attempt-, campaign- and shared-window cost in multiple units; unknown unit and mismatched duration/cost unit. | Separate `(unit, scope)` rows; invalid units reject; no allocation, cross-scope total or unlike-unit sum. |
| E9 | Duplicate IDs, dangling and unplanned attempts, duplicate JSON keys, malformed UTF-8 and size overflow. | Duplicate identity/schema errors exit 2; unplanned attempts remain visible and make eligibility inconclusive; no silent drop. |
| E10 | Render all formats twice from identical input; then render semantically equivalent inputs with slot/attempt arrays reordered. | Identical bytes for identical source bytes. For reordered source bytes, all derived report content is identical after removing only `inputSha256`; each digest equals the exact bytes of its own input. No generated timestamp, hostname or absolute path. |
| E11 | Input text attempts to name a grader command or network action. | Treated as data; no child process/network/model/host effect. |
| E12 | Valid input whose gates fail or are inconclusive. | Full report emitted; exit 3; no false pass. |
| E13 | JUnit for pass, fail, skipped, retry, unattempted and unplanned records. | `tenet-status` and suite count properties preserve each state; JSON remains authoritative; test makes no claim about external importer behavior. |
| E14 | `eligibility: pass` rendered in JSON, Markdown and JUnit. | Each format includes the non-qualification disclaimer; no output says qualified/supported/release-ready. |
| E15 | Cost thresholds target attempt, campaign and shared-window rows with equal and unlike values. | Only the exact `(metricId, group, unit, measurementScope)` row is compared; missing/ambiguous target is inconclusive. |
| E16 | Markdown report with multiple cases/strata, failures, missing observations, exclusions and unplanned attempts. | Golden structure shows grouped metrics and every exception row with stable IDs; passing cases may be summarized. |
| E17 | `StaticProtocolV1` valid input with case-only fields; report input with its own planned slots. | Both validate independently; changing protocol schema to add slot/attempt identity triggers documented review. |
