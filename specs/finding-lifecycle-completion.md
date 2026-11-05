# Finding lifecycle completion

Status: draft; independent review findings dispositioned; owner sign-off pending. Not an
implementation authorization, schema activation or capacity increase.

## 1. Requirement and reproduced gap

PRD REV-04, PRD sections 3.7.2 and 4.5.3, and Tech Spec section 8.4
require an executable finding lifecycle with evidence and the stated
deciders. The current schema enumerates the states, but this is not an
implementation of the transitions.

Current behavior:

Bounded correction checkpoint (2026-11-04 UTC): the parent candidate now
rejects nonempty `rechecked` in full-mode results before application.
Fail-first pure and production-handler controls pass locally; exact-source
supported acceptance is pending. The baseline descriptions below remain
the reproduced gap, not the current claim for that bounded correction.
Recheck-mode follow-through (2026-11-04 UTC) rejects unknown finding IDs,
non-`fixed` current states, duplicate IDs (including contradictory outcomes)
and whitespace-only evidence before application. Pure and direct production-
handler controls cover refusal preservation/accounting and both admitted
outcomes. The corrected pipeline scenario no longer treats a source edit as
an implicit `fixed` transition; current supported-POSIX execution is unobserved.
Immutable named-assignment binding and the proposed decision API remain
incomplete; these corrections are not lifecycle sign-off.

Packet follow-through (2026-11-04 UTC): recheck-only answer templates now
include the existing per-finding `rechecked` shape for every named ID,
both outcome choices and evidence guidance. Empty lists and full-mode
omission are explicit. Direct builder/decoder/admission and populated
token-boundary controls pass locally. This is guidance, not immutable
assignment binding, public fixed-transition implementation or native-use
observation.

- `applyResult` creates findings as `valid`; a reported reviewer recheck
  can set them to `verified` or back to `valid`.
- `dispositionFinding` accepts only `deferred`, `risk-accepted` and
  `wont-fix`, labels the actor `user`, and refuses blockers.
- Direct no-I/O controls against correctly paired `open -> disputed`,
  `valid -> fixed` and `disputed -> withdrawn` all refuse with
  `revision-conflict`; `valid -> deferred` passes.
- There is no runtime route for evidence-backed severity lowering.
- A schema-valid `full` Reviewer result with a `rechecked` entry is
  admitted and changes an existing `valid`, `fixed` or `deferred` finding
  to `verified`, despite an empty named recheck list. Direct controls use
  production schema/admission/application functions; ordinary results
  retain state and a mismatched declared mode refuses. Pipeline/verdict
  reachability is not established by these controls.

The existing blocker and major verdict rules must not be weakened to make
the missing routes appear complete.

## 2. Scope and contract

Complete the finding branch of existing `decide disposition`. Do not add a
verb or use an Analyst report as a Reviewer result. Do not change
attention-item, acceptance-test-lock or basis-element disposition behavior.

Retain the existing `propose.outcome` and `propose.reason` fields for
existing user dispositions. Add an explicitly validated proposal for
finding transitions only:

```json
{
  "outcome": "fixed",
  "by": "coordinator",
  "reason": "The missing boundary is now checked.",
  "expected": {
    "state": "valid",
    "severity": "major",
    "historyLength": 1
  },
  "evidence": "src/example.ts:18",
  "candidate": "<current candidate digest>"
}
```

`outcome` selects an existing state, not an arbitrary stored string. For
severity lowering use `outcome: "severity-lowered"` plus `severity` naming
the proposed lower severity. This is a proposed input action, not a finding
state, registered reason code or shipped skill instruction.

Requirements for the new routes:

- Resolve the finding only within the addressed work. Reject an unknown
  target, unsupported action, blank reason/evidence, or malformed proposal
  before changing state.
- Match expected state, severity and history length to the live finding.
  Bind the proposal to the current candidate captured under the existing
  transaction. Refuse a stale answer; do not silently apply it to a newer
  finding or candidate.
- Kernel-observed candidate identity is a binding, not proof the submitted
  evidence is true. Evidence semantics and coordinator identity remain
  reported/cooperative, as in the existing model; never claim observed
  human authorship or independent verification.
- Record every accepted transition with the real timestamp and declared
  decider. Returning the same proposal again must not append duplicate
  history or accidentally apply to a later state; return a stale refusal.
- Retain the finding, its prior evidence, and all prior history. Never
  erase a finding to withdraw it.
- Return the changed finding and its evidence/history delta. A severity
  decrease is visible in the ordinary result and later `inspect` output;
  storing it without surfacing it does not satisfy the requirement.

`by` is restricted to `coordinator` or `user`; a caller cannot select
`reviewer` in a decision proposal. Omitted `by` retains existing user
disposition semantics only; new transitions require an explicit decider.
Actor selection must not be inferred from `quote` or from a successful
kernel call. Coordinator transitions are reported coordinator actions.
Existing user-only risk dispositions continue to require the coordinator
to obtain the user's choice under the existing cooperative host mechanism.
This feature must neither claim a new authenticated human channel nor
make those choices automatic.

## 3. Transitions and authority

| From | Action/result | Conditions | Recorded decider |
|---|---|---|---|
| `open` | `valid` | Recorded from an admitted result with evidence, not a free-form decision proposal | coordinator, recorded from the result |
| `open` | `disputed` | Matching expected facts and evidence | coordinator or user, reported |
| `valid` | `disputed` | Contrary evidence; normative disagreements remain a user choice | coordinator or user, reported |
| `disputed` | `valid` | Evidence resolves the factual dispute; normative resolution requires the reported user's choice | coordinator or user, reported |
| `disputed` | `withdrawn` | Contrary evidence and current binding; normative withdrawal requires the reported user's choice; no deletion | coordinator or user, reported |
| `valid` | `fixed` | Current candidate and a linked changed location; no verification claim | coordinator |
| `fixed` | `verified` | Matching live Reviewer reservation, candidate, basis and named finding | reviewer |
| `fixed` | `valid` | Matching Reviewer reports still open | reviewer |
| `valid` major | existing user dispositions | Nonblank user reason, existing authority rules | user |
| `valid` minor | existing user dispositions | Nonblank user reason, existing authority rules | user |
| `valid` minor | `deferred` | Nonblank reason; no risk acceptance on user's behalf | coordinator |
| any unresolved state | severity lowered | Evidence, expected finding, current candidate; preserve prior severity | coordinator |

This table does not authorize direct `valid -> verified`, direct blocker
risk acceptance, or automatic withdrawal. The reproduced recheck bypass
from `valid` contradicts the canonical `valid -> fixed -> verified` chain;
the bounded admission correction above refuses it rather than preserving
an implicit compatibility exception. It does not provide the missing
`valid -> fixed` route.
The `open` state remains supported even though current Reviewer ingestion
normally records `valid` directly.

`fixed` is still unresolved: blocker and major findings continue to block
until verified or otherwise dispositioned under the canonical policy.
Changing a finding's severity is not a way to waive an integrity rule,
mandatory evidence or an independently blocking verdict reason.

## 4. Storage and runtime impact

State-only transitions reuse existing `Finding.state` and history fields.
They require no new stored state vocabulary. Do not serialize
`severity-lowered` as a state.

Severity history needs an explicit representation in the reviewed
versioned target schema, retaining legacy entries exactly. A new
severity-history entry keeps `to` equal to the unchanged current finding
state and uses `by: "coordinator"`, nonblank `reason`, and `at`, plus a
strict `severityChange` object containing `from`, `to`, `evidence` and
`candidate`. Its severities must differ and move strictly downward in
`blocker > major > minor > note`; reject equal or upward changes.
The entry's `from` must match the current severity, its `to` the new stored
severity, and its candidate the transaction-bound proposal. Ordinary
state-history entries have no `severityChange`.
Do not silently extend the current persisted schema or encode structured
authority in free-form `reason` text. This subfeature depends on the
coupled migration/schema decision and may remain inactive while
state-only transitions are implemented after sign-off.

Surfaces that must agree:

- strict proposal parsing and existing decision registry/dispatch;
- pure transition validation, with no I/O in core;
- transaction-time current candidate and changed-location evidence;
- Reviewer result validation/application and recheck manifests;
- finding verdict policy and reading-guide/result rendering;
- schema decoder/migration for severity history;
- coordinator and review instructions, within existing token limits;
- plan, requirement worklist, canonical documentation and tests.

No ownership, grant, acceptance basis, budget or receipt is changed by a
finding transition. No project file is written. Fixed code-owner ceilings
remain in force; actual implementation fit must be measured, not assumed.

## 5. Examples and acceptance tests

Add `packages/kernel/test/finding-lifecycle.test.ts` for direct pure and
real pipeline cases. Extend existing `reason-codes.test.ts`,
`review-admission.test.ts`, `verdict.test.ts` and `contract.test.ts` only
where their existing behavior is directly affected.

| Example | Required observation | Test file |
|---|---|---|
| E1 `[REV-04]` | Open finding can be disputed with evidence, then made valid or withdrawn under the agreed authority | `finding-lifecycle.test.ts` |
| E2 `[REV-04]` | Unknown, blank, malformed, wrong-work and stale expected-state/candidate proposals refuse with no history mutation | `finding-lifecycle.test.ts` |
| E3 `[REV-04]` | Fixed finding records a linked change but remains unresolved; no direct decision can verify it | `finding-lifecycle.test.ts`, `verdict.test.ts` |
| E4 `[REV-04]` | Matching admitted Reviewer verifies the named fixed finding; stale/wrong-role/wrong-mode/unnamed results and direct verification from valid do not settle it; same-session admission/disclosure remains governed by existing policy | `reason-codes.test.ts`, `review-admission.test.ts` |
| E4b `[REV-04]` | A full-review result with nonempty `rechecked` refuses before application; a recheck cannot rewrite an existing deferred/risk-accepted/withdrawn disposition or settle a finding outside its declared assignment | `reason-codes.test.ts`, `review-admission.test.ts` |
| E5 `[REV-04]` | Blocker risk acceptance still refuses; minor deferral does not impersonate a user; major user-only dispositions retain their boundary | `finding-lifecycle.test.ts`, `verdict.test.ts` |
| E6 `[REV-04]` | Replayed answer cannot add duplicate history or act on a newer finding | `finding-lifecycle.test.ts` |
| E7 `[REV-04]` | Severity lowering preserves old severity/evidence and is shown to the user; no lowering removes an unrelated integrity/evidence block | `finding-lifecycle.test.ts`, `contract.test.ts` |
| E8 `[REV-04]` | Schema migration retains legacy history exactly; old runtime refuses unsupported schema rather than dropping the new fields; equal/upward or mismatched severity-history entries refuse | `finding-lifecycle.test.ts` plus the migration suite selected by the approved schema contract before implementation |
| E9 `[REV-04]` | Existing attention/lock/assumption dispositions are unchanged | existing workflow and contract suites |
| E10 `[REV-04]` | Built CLI performs dispute, fixed and Reviewer verification on a scratch repository with truthful intermediate endpoints | `tools/uat/uat.mjs` |

Before calling the feature implemented: distinguishing red tests first,
all consumers wired, exact-source full CI and built UAT, independent source
review dispositioned, measured owner budgets passing, canonical docs and
plan updated. Native/human qualification remains separate and unobserved.

## 6. Alternatives, risks and assumptions

**A: add only state names to existing unchecked disposition input.**
Rejected: conflates coordinator and user actions, permits stale decisions,
and does not preserve severity provenance.

**B: complete the existing decision branch with explicit validation and
expected facts; separate schema-gated severity history. Recommended.**
Reuses existing verb, transaction, finding and verdict mechanisms while
making missing authority and storage requirements explicit.

**C: add a new finding-management verb and authenticated actor subsystem.**
Not recommended: expands scope and cannot claim host authentication
without a separately observed mechanism.

Evidence text remains untrusted reported data. A candidate digest cannot
prove that a fix addresses the finding. Semantic verification stays with
the Reviewer, and native effectiveness needs campaign evidence.
Normative disputes cannot be decided merely because the software accepts
an evidence string.

## 7. Owner decisions before implementation

1. Approve the proposed existing-decision API and reported-decider model,
   or request a different mechanism.
2. Approve versioned severity-history schema/migration and actual capacity
   after measurement; no ceiling is proposed from an unimplemented design.

Canonical requirements already settle two other points: require `fixed`
before Reviewer verification, and permit evidence-backed severity
lowering without waiving independent integrity/evidence gates. These are
not requests to approve exceptions or permanent-blocker semantics.

No response or autonomous execution directive substitutes for these
contract decisions. Unsettled rows remain inactive, not success-shaped
fallbacks.

## 8. Independent review dispositions

A fresh-context review of this draft against the canonical contracts and
current runtime reported six findings. All are accepted and corrected:

1. Add the user-authorized minor dispositions, separate from coordinator
   minor deferral.
2. Include reported user dispute/withdrawal and normative-resolution
   authority; never infer user identity from a quote or successful call.
3. Keep `open -> valid` tied to an admitted result, not a decision.
4. Require the canonical `valid -> fixed -> verified` chain; remove the
   recommendation to preserve the contradictory direct transition.
5. Test admitted Reviewer identity and existing independence disclosure,
   not an invented ban on supported same-session reviews.
6. Define strict severity-history representation, unchanged state,
   severity ordering and negative/migration acceptance cases.

Review disposition is not owner sign-off or runtime validation.

After review, direct production-function characterization additionally
confirmed the full-result recheck-admission gap in section 1. Its controls
and E4b must be included in the eventual implementation review. The
Tech Spec §8.4 decider for open-to-valid is coordinator with evidence
recorded from a result; the table uses that canonical wording rather than
the current ingestion history's `by: "reviewer"` label.
