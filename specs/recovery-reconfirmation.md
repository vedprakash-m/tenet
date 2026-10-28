# Specification: Backup Recovery Reconfirmation

> **Spec type:** Product/feature; F1-F4 load-bearing, F5-F6 supporting.
> **Date:** 2026-10-24; revised 2026-10-27 | **Author:** GitHub Copilot | **Decision owner:** repository owner, plan Section 3.1.
> **Status:** DRAFT; the 2026-10-27 fresh-context review found three blocking design gaps. The owner approved D1-D3 on 2026-10-24 and D4-D5 on 2026-10-27, then chose to defer R08 sign-off and implementation until the schema-migration contract is approved. No implementation permission.
> **Decision status:** Policy choices are resolved. This revision tightens source closure, stale-evidence consumers, question/authority fencing, and schema-migration coordination. A fresh independent spec-only review and final owner sign-off are still required; no runtime or schema implementation is authorized.

## How to Read This Spec

| Role | Start here | Then read |
|---|---|---|
| Owner | Outcome, Open Tensions | Assumptions, Self-Critique |
| Engineer | Scope, Acceptance Criteria | Context, Implementation Guidance |
| Reviewer / QA | Acceptance Criteria | Failure Conditions, Ambiguity Audit |
| UX reviewer | Outcome, Scope | D1-D5 and examples |

## Notation Key

`[Validated]` identifies a current canonical constraint, not qualified behavior. `[Assumed: verify]` identifies a recommendation requiring owner approval. `[Unknown: TBD]` identifies a blocking decision, owned by the repository owner before implementation. H/M/L are confidence in assumptions, not completion states. AC scores of 3 mean binary-testable proposed criteria; they do not mean the tests exist or pass.

## 1. Outcome Statement

[Validated: owner D1-D3, 2026-10-24; D4-D5, 2026-10-27] An owner with a verified, effect-resolved backup can answer one fact-bound, workspace-scoped recovery question and proceed through fresh authorization. The confirmation action is journaled; its accepted binding is retained in state and journal for idempotent retry. Old grants, consents and approval-bearing answers are not restored; old evidence remains inspectable but cannot satisfy current verdicts; uncertain effects are never replayed. Exact manifest, schema and publication mechanics remain subject to review and final sign-off.

Verification: corrupt a scratch repository's primary state, inspect the recovered preview, confirm the unchanged facts, then prove that work still needs fresh authorization and checks. Unknown accounting or ownership must prevent confirmation. Outcome score: 3, conditional on mechanism review and final sign-off; this is not observed runtime behavior.

## 2. Scope

### IN Scope

| Capability | Boundary | Criteria |
|---|---|---|
| Recovery preview | One question for the owned workspace after all preconditions hold; no per-grant restoration questions | AC-1, AC-2 |
| Fact-bound confirmation | Current fallback identity, accounting, effects, restrictions and candidate facts; changed facts invalidate the answer | AC-3, AC-4 |
| Diagnostic-mode exit | Publish a revalidated snapshot with no imported authority or usable stale evidence | AC-5, AC-6 |
| Failure-safe publication | Journal the accepted binding, persist its acknowledgment in state, preserve the last valid backup, and make retries idempotent | AC-7, AC-8 |

### OUT of Scope

| Excluded capability | Rationale / owner |
|---|---|
| Inferring missing costs or declaring an unknown process dead | Separate RC1 reconciliation; absence of data is not proof |
| Repairing lock ownership, schema migration or quarantine content adoption | Separate RC1/RC7 protocols |
| Replaying installs, commits, undo or other uncertain effects | Existing effect recovery must settle them first |
| Reactivating prior grants/consents | Excluded by owner D1, 2026-10-24; confirmation is acknowledgment, not permission to repeat prior actions |
| Changing NODE_OPTIONS, configuring commands or adding host transport | Independent owner gate / RC1 / RC5 |
| Complete effective configuration graphs and aggregate retention | Separate RC1 work; unsupported revalidation refuses |

### Scope Dependencies

[Validated: TS Sections 7.3/7.4] Accounting must be verified and process/effect ownership settled before confirmation. OUT [depends-on: effect/process reconciliation when unresolved; status: incomplete]. This feature must refuse those cases, not close their requirements.

[Validated: owner D2 scope, 2026-10-24, decision 3 option A] Implement a bounded, fail-closed recovery path rather than wait for complete configuration/dependency-graph support. Confirmation binds workspace and backup/journal identities, verified accounting high-water marks, effect/process and host-reservation ownership, current restriction inputs, candidate/obligation/support-input/toolchain identities, and the exact pre-recovery question set. Candidate facts are captured when the recovery question is issued and recomputed at confirmation; a change invalidates that question. Missing, unsupported, changed or uncertain required facts prevent confirmation; unsupported configurations stay diagnostic-only, not recovered best effort. Bounded program-neutral read-only Git inspection is permitted; checks, installs, configured hooks, Git mutations and project writes are not recovery-validation steps.

Confirmation is an all-or-nothing workspace action. Every retained work item is included in one binding and transitions together; a user cannot selectively recover one contract while leaving others suspended. Per-contract recovery is out of scope.

[Assumed: verify, mechanism review before implementation] The exact supported manifest, source/refusal matrix and publication protocol still need independent review and final sign-off. A partial loader is not proof of complete restriction revalidation. Facts must be revalidated before publication; a changed binding invalidates the old answer.

### Open Scope Tensions

Resolved by owner D1/D2/D3 on 2026-10-24 and D4/D5 on 2026-10-27: no old authority reactivates; validation is bounded and fail-closed; the workspace-scoped action is journaled; accepted acknowledgment is stored in state and journal; pre-recovery evidence remains inspectable with a stale marker and is excluded from verdicts. TS Section 15.2 requires fresh authorization. The exact manifest, schema, pending-question handling and publication protocol remain subject to mechanism review and final sign-off; policy approval does not approve implementation.

## 3. Acceptance Criteria

All proposed criteria have score 3. Test paths name existing homes; no new tests for this feature are claimed. The owner validates all proposed behavior before implementation.

| ID | Type | Binary criterion / example | Test owner | Score | Status |
|---|---|---|---|---|---|
| AC-1 | Behavioral | Verified fallback/accounting, supported sources, and no unresolved effect, in-flight call, pending envelope, focused review or budget reservation: one handle-free workspace question names the recovered revision, lost authority/evidence and limits, offering "Confirm recovery" or "Wait". It runs no project-controlled command or mutation; bounded neutral Git reads are allowed. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D3 interaction]; [Assumed: verify, concrete dispatch] |
| AC-2 | Edge | Unknown accounting, conflicting checkpoints, missing/live process identity, unresolved effect, pending envelope, active review reservation, unsupported restriction source, or unknown authority surface: no actionable confirmation; diagnostic/refusal remains, with no authority, accounting or effect changes. Old questions cannot be answered. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/execution-envelope.test.ts` | 3 | [Validated: TS Sections 7.3/7.4]; [Assumed: verify, exact refusal matrix] |
| AC-3 | Behavioral | Confirm an unchanged preview: one locked transaction revalidates the binding, journals the action, persists its acknowledgment in state, preserves recovered counters/sequences, and exits diagnostic suspension without restoring grants, consents or approval-bearing answers. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D1/D5]; [Assumed: verify, schema/transaction] |
| AC-4 | Edge | Change any bound backup/journal identity, workspace marker, effect/accounting ownership, candidate/obligation/support/toolchain input, restriction input, or pre-existing question identity/binding after preview: old confirmation cannot publish; return a refreshed preview or the existing refusal. A question-issuance checkpoint may be accepted only as a verified no-spend suffix with unchanged high-water values. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D2]; [Assumed: verify, exact manifest] |
| AC-5 | Negative | With fresh authorization and otherwise-valid evidence, restore old passing receipts, baseline projections, completed reviews/analyses, accepted finding/attention dispositions, validated integration state and cached endpoints. They remain inspectable and recovery-stale but cannot satisfy finish; stale unresolved findings remain blocking. A fresh check/review/disposition can satisfy its gate; locked files remain locked. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/contract.test.ts`, `packages/kernel/test/verdict.test.ts` | 3 | [Validated: owner D4]; [Assumed: verify, schema and every verdict consumer] |
| AC-6 | Negative | Recovery validation allows only bounded program-neutral read-only Git inspection and current restriction reads. It launches no project-controlled commands, checks, installs or configured hooks; performs no project writes, Git mutations, network actions or budget resets; and never reconstructs a lost contract from accounting. Unsupported restrictions/configuration refuse. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D2; TS §9.4]; [Assumed: verify, exact inspection protocol] |
| AC-7 | Reliability | Kill after journal intent fsync, result fsync, `state.tmp` fsync, `state.prev` link/rename, state rename and directory fsync. At each boundary, a valid recoverable snapshot remains; unresolved accounting is not cleared; no effect is duplicated; a completed result applies idempotently. | `packages/kernel/test/backup-accounting.test.ts`, existing crash fixtures | 3 | [Validated: TS §§7.3/7.4/15.1]; [Assumed: verify, recovery publisher] |
| AC-8 | Edge | Wait/decline or an identical retry cannot activate authority, spend a new attempt or erase diagnostics. After lost response/restart, the same accepted binding returns the durable acknowledgment without repeating publication or resetting counters. Compaction retains the journal result while `state.prev` lacks the acknowledgment; after both state copies contain it, compacting that result still leaves fallback/retry acknowledged. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D3/D5]; [Assumed: verify, compaction/retry] |
| AC-9 | Security | Excluded/secret content and raw grant payloads are absent from question text; only safe identifiers/hashes and literal kernel status are used. The chat answer is recorded as reported input, not proof of human identity; CLI capture remains `reported`. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/authority.test.ts` | 3 | [Validated: TS §11.3 and owner D3]; [Assumed: verify, output regression] |
| AC-10 | Dependency | All above controls, full `npm run ci`, and the same built artifact on Node 26 and 22.12.0 pass; unknown/live process negative controls are retained. No local result is called host qualification. | `tools/uat/uat.mjs` and source gates | 3 | [Validated: repository lifecycle] |

Complexity: complex, ten criteria. Definition of done: approved D1-D5, fresh independent review with dispositions, owner sign-off, a compatible state-schema path approved through the schema-migration contract, all ACs passing, canonical backfill, archive, changelog and plan update. No qualification claim follows from source or scratch UAT alone.

### AC-2 refusal fixtures

| Fixture | Example state/source | Required outcome |
|---|---|---|
| Accounting conflict | Two adjacent validated-looking checkpoints disagree on revision, work/generation high-water, counters or in-flight IDs. | Existing accounting diagnostic/refusal; no confirmation question or authority change. |
| Prepared or live authority | Any `WorkContract.pendingEnvelope`, `session.inCall`, `focusedReview` or `budget.reservations` entry remains. | No actionable question; preserve diagnostic suspension and reservation/accounting state. |
| Unknown restriction source | `tenet.policy.json` is unreadable/invalid, contains an unknown key, excludes its own governing read, or effective settings produce a non-empty unsupported-execution result. | Existing restriction/capability refusal; never omit the source or substitute defaults. |
| Unknown pending authority | An unrecognized pending-question purpose, a colliding recovery-question ID, or any persisted authority-bearing field not covered by the recovery projection is present. | Refuse before generic question handling; no old answer is recorded. |

These are refusal-condition examples, not new reason codes. Tests must assert the repository's existing refusal response and the unchanged state/journal effects.

## 4. Context and Decisions

### Executor Profile

Target: an AI coding agent or engineer in this repository, TypeScript/Node familiarity, no assumed session history. Read canonical TS Sections 7.3/7.4 and Section 14 failure matrix first. Owner is asynchronous; unanswered questions are not permission.

### Glossary

| Term | Meaning |
|---|---|
| Backup | Valid owned `state.prev`, not an arbitrary imported document |
| Verified accounting | Contiguous, consistent checkpoint facts with complete usage and no unresolved in-flight ownership; not trust in evidence or permissions |
| Reconfirmation | Acknowledgment of one revalidated recovered snapshot; owner D1 excludes reactivation of old grants/consents; D2/D3 determine the mechanism |
| Binding | Kernel-computed identity of the exact facts being confirmed, rechecked inside the publishing transaction |
| Stale history | Retained evidence whose previous pass/authorization cannot satisfy current work |

### Decisions Already Made

| Decision | Source / rationale | Annotation |
|---|---|---|
| One workspace-level, journaled confirmation with "Confirm recovery" / "Wait", changed-fact invalidation and durable success acknowledgment; no contract handle is required and CLI capture stays reported | Owner chose decision 4 option A, 2026-10-24, and confirmed the journaled workspace action, 2026-10-27 | [Validated: D3 interaction] |
| Bounded fail-closed revalidation; unknown/unsupported facts keep recovery diagnostic-only; bounded read-only Git inspection permitted | Owner chose decision 3 option A, 2026-10-24; concrete manifest/protocol review and final sign-off remain pending | [Validated: D2 scope] |
| Fresh authorization after recovery; no old grants or execution consents reactivate | Owner chose decision 2 option A, 2026-10-24 | [Validated: D1] |
| Keep old evidence in place, add explicit recovery-stale markers, and exclude marked evidence from verdict/finish consumers | Owner selected mark-and-ignore, 2026-10-27; stale marking is separate from fresh authorization | [Validated: D4 evidence disposition] |
| Persist the accepted binding acknowledgment in both state and journal; journal-only is insufficient because completed journal history is compacted | Owner selected state-plus-journal acknowledgment, 2026-10-27 | [Validated: D5 durability] |
| One question, not silent continuation | Plan C0 triage; minimize recovery ceremony without suppressing uncertainty | [Validated] |
| Diagnostic-only unknown accounting | TS Section 7.3; unknown usage/ownership cannot yield editing authority | [Validated] |
| Kernel owns verdict, budgets and facts | Architecture rules; frontends ask/explain only | [Validated] |
| No reconfirmation kind is implemented today | TS Section 7.3 and current code; this draft cannot be invoked | [Validated, 2026-10-24 source review] |

### Dependencies

| Dependency | Status | Owner / blocking condition |
|---|---|---|
| D1 authority meaning | Resolved: fresh authorization only | Owner chose A, 2026-10-24; no mechanism or implementation approval inferred |
| D2 revalidation/binding scope | Resolved: bounded, fail-closed path | Owner chose A, 2026-10-24; concrete manifest/source matrix/protocol still need review and final sign-off |
| D3 public decision/question contract | Resolved: workspace-scoped journaled confirmation; no contract handle required | Owner chose A, 2026-10-24 and confirmed the journaled workspace action, 2026-10-27; concrete schema/dispatch/publication protocol still need review |
| D4 evidence disposition | Resolved: retain pre-recovery evidence, mark it recovery-stale and exclude it from verdicts | Owner selected mark-and-ignore, 2026-10-27; schema and all consumers still need review |
| D5 acknowledgment durability | Resolved: persist accepted binding in state and journal | Owner selected state-plus-journal, 2026-10-27; exact crash/retry protocol still needs review |
| Independent review and sign-off | Earlier review completed; eight findings are dispositioned below; fresh review of this revision and owner sign-off remain pending | Launch completion review Section 5; no self-approval |
| Existing accounting/effect recovery | Partial implementation | RC1; unresolved cases are refused, not waived |

### Constraints

[Validated: repository rules] Pure core, existing ports, one pipeline, existing budget ceilings and Node minimum. All effects require their existing protocol. Read-only inspection never republishes state. Real `.tenet/` is never edited by hand; fault injection is confined to scratch fixtures. New vocabulary, schema changes and plugin wording wait for sign-off.

### Stakeholders

Repository owner holds technical, security and release roles named in plan Section 3.1. An independent reviewer recommends corrections; the owner approves product meaning and implementation. Contact is this repository's review process/chat, not a fabricated external identity. No host or paid campaign is authorized here.

## 5. Failure Conditions

| Failure | Signal | Action / severity |
|---|---|---|
| Data-model mismatch | Revalidation cannot name every fact required by D2 | Stop confirmation; retain diagnostics; owner reviews missing source. Critical |
| Authority mismatch | Old grants/consents or stale passes become effective | Stop rollout; failing negative regression; owner resolves D1. Critical |
| Publication failure | Crash loses the last valid backup, clears uncertainty or repeats an effect | Stop implementation progression; repair publication protocol and repeat killed-step checks. Critical |
| Workflow mismatch | Current decision transport cannot bind a workspace-level preview without a write during inspect | Stop; resolve D3, do not add an unreviewed stateless approval path. Major |

Worst misinterpretation: "confirm recovery" is not "authorize all previous actions." Owner D1 requires no reactivated old grants or execution consents. The remaining mechanism must also make stale evidence unusable for current claims. An unknown process is not dead because its contract is absent.

## 6. Ambiguity Audit

| ID | Question | Resolution / owner / deadline |
|---|---|---|
| D1 | Restore prior grants or require fresh authorization? | Fresh authorization required; old grants/consents do not reactivate. [Validated: owner chose A, 2026-10-24] |
| D2 | What scope and snapshot identity are revalidated/bound? | Bounded fail-closed path with the facts in Scope Dependencies; missing/unsupported/changed/uncertain facts prevent confirmation. Bounded read-only Git inspection allowed; no project-controlled execution or mutation. [Validated: owner chose A, 2026-10-24]. Exact manifest/source matrix/protocol still need independent review and final sign-off. |
| D3 | Which interaction and stale/retry responses expose confirmation? | One workspace-level, journaled confirmation with displayed facts, "Confirm recovery" / "Wait", refreshed preview after bound-fact changes, durable acknowledgment and no required contract handle. CLI capture remains reported. [Validated: owner chose A, 2026-10-24; journaled action confirmed 2026-10-27]. Concrete schema/dispatch/publication review remains pending. |
| D4 | How should pre-recovery evidence remain inspectable without satisfying new claims? | Retain it, mark it recovery-stale and exclude it from verdict/finish consumers. The negative control must use fresh authorization and otherwise-valid old evidence. [Validated: owner selected mark-and-ignore, 2026-10-27]. |
| D5 | Where must a successful recovery acknowledgment survive? | Persist the accepted binding in state and journal; journal-only is insufficient because completed entries are compacted. [Validated: owner selected state-plus-journal, 2026-10-27]. |

All five named owner policy decisions are resolved. Concrete manifest/schema/protocol review, a fresh independent review, finding dispositions and final sign-off remain blocking technical dependencies; this draft is not code permission.

## 7. Implementation Guidance

[Validated: owner D3; Assumed: verify, concrete API] Design one workspace-scoped recovery question/action, with no required surviving contract handle. The new question has a dedicated recovery purpose and binds its answer to the preview hash; identifying it by display text is not sufficient. Display "Confirm recovery" and "Wait"; acknowledgment grants no prior authority. The action is journaled and its deterministic binding acknowledgment is stored in both state and journal. Exact input vocabulary and dispatch remain subject to review and are not implemented.

### 7.1 Authority gate and question lifecycle

Use the existing `State.recovered` marker as the recovery-active gate; do not add another boolean for the same condition. While it is present:

- The only answerable question is the newly issued question tagged with `purpose: "recovery"` whose `bind.factsHash` equals the current preview binding. `decide` with any pre-recovery question ID returns a non-success refusal before generic pending lookup; it records no answer and creates no grant or authority.
- Apply a recovery-active gate in the shared pipeline before ordinary envelope/reconciliation code can create a question or perform a mutation, and again at the `decide` input boundary before generic pending-question lookup. Permit only recovery preview/confirmation, read-only inspection, and the existing safe stop path. Existing effect/process recovery remains governed by its own protocol. Do not silently skip restriction reads or adapter exclusions.
- Bind every pre-existing pending question by its ID and `bind.factsHash` (never its user-facing text). They remain unanswerable while recovered and are removed only after successful confirmation; any needed question is issued afresh. No unrelated question may be issued during recovery.
- Do not issue an actionable recovery question if any work has a `pendingEnvelope`, `session.inCall`, `focusedReview`, or outstanding `budget.reservations`. A present `pendingEnvelope` is a prepared execution envelope awaiting a decision or settlement; its presence is unresolved regardless of whether a user is currently active. These ownership IDs must be empty in the binding. An unknown process, unresolved effect, or reservation without a verified terminal result remains diagnostic-only; recovery must not assume a host agent or process has stopped.
- Recovery also clears old approval-bearing values: all work grants, global consents, `acceptance` (reset to `pending`), and `git.switchConsent` (removed). `acceptance` can authorize automatic integration, and `switchConsent` authorizes carrying edits across a branch switch; neither may survive as an old answer. Existing cached `session.last` and `lastCheck` are not authority and are cleared.
- Preview computation is read-only. Issuing the tagged question persists only that question using the normal state publication path; it does not acknowledge recovery. The confirmation action, not question issuance, is the journaled recovery effect. "Wait" leaves diagnostic recovery active and provides no acknowledgment.
- Compute the binding and question under the transaction lock; return the preview from that same snapshot. The answer names the generated recovery question ID. A changed binding invalidates the old question and requires a newly computed preview.

An unrecognized pending/authority surface is a refusal condition, not an empty set. Do not add a new reason code or treat chat/CLI provenance as authentication without separate review.

Issuance and answer ordering are:

1. Acquire the existing store transaction lock; read the current state/revision, verify the workspace marker, fallback, accounting and effect recovery, then apply the recovered-state gate.
2. Refuse if an ownership list is non-empty or any required restriction source cannot be revalidated. Read current restrictions and exclusions before inventory; do not run ordinary reconciliation that can create a non-recovery question.
3. Compute the complete binding, including the kernel-computed candidate identities defined in §7.2. Generate a unique recovery question ID; if it collides with any pre-existing pending ID, refuse issuance rather than replacing that question.
4. Create the purpose-tagged question with `bind.factsHash` equal to the binding hash and publish it against the exact state revision read in step 1. If optimistic revision validation fails, discard the binding and restart from step 1; never publish a question made from a stale state snapshot.
5. Return the binding preview and the question from that same successful publication, then release the lock. At confirmation, acquire the same lock, match the exact recovery question ID/purpose/hash, recompute the binding, and publish only if it is unchanged.

A pre-existing question ID is always refused while recovery is active, regardless of its `factsHash`; ID identifies the old question, while the hash is separately bound to detect mutation. If the ID/hash pair changes or a non-recovery question appears, confirmation refuses. The recovery question can never shadow or answer an old question.

### 7.2 Proposed binding manifest

Use a strict, versioned `RecoveryBindingV1` projection. These are field names and meanings for review, not an approved runtime schema:

| Field | Bound value |
|---|---|
| `version` | Literal `1`; a change to required sources or interpretation requires a new manifest version. |
| `workspace` | Marker `workspaceId` and `tag`. |
| `fallback` | `state.prev` revision and SHA-256 of its exact validated bytes. |
| `accounting` | Hash and revision of the verified checkpoint-chain prefix captured before question issuance, plus the recovered budget/sequence high-water hash. Revalidation verifies the prefix and permits only a question-issuance suffix with identical high-water values and no in-flight IDs. |
| `effects` | Hash of the ordered validated effect intents/results and reconciliation outcomes at question issuance; any new, unresolved or uncertain effect before confirmation refuses. |
| `ownership` | Sorted IDs for live calls, pending envelopes, focused reviews and outstanding review/analyst reservations; every list must be empty. |
| `restrictions` | Hash of the effective restriction projection and sorted `(sourceId, sourceHash)` entries for every required current source. |
| `inventory` | Existing neutral Git inventory's `head`, `branch` and digest from the TS §9.4 inspection profile. |
| `work` | Sorted entries for every retained work ID, binding candidate, basis, obligation, locked support-input, pinned/toolchain and unsupported-execution identities. For `git.mode === "none"`, the candidate is the existing deterministic `no-git` identity. |
| `preRecoveryQuestions` | Sorted `{ id, factsHash }` pairs for every pending question present before the recovery question is issued. |

Serialize the strict projection deterministically and hash it with the existing canonical hash helper. Sort every list by its stable key before hashing. The binding excludes question text, grant payloads, and excluded project content; the preview renders only safe identifiers, hashes and literal kernel status. Missing, unsupported, unreadable, inconsistent or unbounded inputs refuse confirmation. Do not silently omit a field or treat unavailable data as an empty list.

The required restriction source set is closed for this version:

1. `tenet.policy.json`: hash its current bytes, or a distinct absence value, and bind the parsed/effective result from `sharedPolicy`. Invalid JSON, an unknown key, unreadability or an unsupported exclusion is a refusal.
2. `State.trust`: bind the complete structured trust projection. If it says `INTENT.md` is adopted, bind the current file hash/absence and the existing reconciliation result; if it is not adopted, bind that non-adopted state and do not treat the file as trusted.
3. `State.config.local`, `State.project.adoption`, and `State.project.recipe.checks`: bind their complete structured values.
4. For every retained work item, bind `WorkContract.settings`, its resolved `settingsFor` result (all catalog settings, including exclusions, protected paths, required checks, commands, dependency and integration policy), the obligation projection, and `unsupportedExecution` result.
5. Bind `State.project.intent`/traits and each work basis hash where they affect the candidate, obligations or verdict; bind `ports.stack.fingerprint(ports.root)` and the existing check-input identity.

These are the current inputs read by `sharedPolicy`, `settingsFor`, `unsupportedExecution`, `configurePolicy`, reconciliation and `facts`. Optional file absence is a value, not an omitted source. Any non-empty unsupported-execution result, restriction source not covered above, required source that cannot be read, or configuration graph outside this bounded profile refuses confirmation. Do not add a second Git-command allowlist; use only the existing TS §9.4 inventory.

`candidateHash` is the kernel-computed `Facts.candidate` from `facts.gather`: the `Inventory.digest` produced by the existing bounded Git inventory for `git`/`shadow` work, or the existing deterministic `NO_GIT.digest` for `git.mode === "none"`. It is not a user-authored candidate string. `obligationsHash` covers the canonical obligation definitions and baseline projection; `supportInputsHash` covers the existing lock/support-input identities; `toolchainHash` binds `ports.stack.fingerprint` and the existing check-input identity. Include one sorted entry for every `WorkContract` in `State.work`; historical `State.archive` remains history and is bound by the exact fallback bytes, not reactivated as work.

The proposed structural contract is:

```ts
type RecoveryBindingV1 = {
  version: 1;
  workspace: { workspaceId: string; tag: string };
  fallback: { revision: number; stateHash: string };
  accounting: { checkpointPrefixHash: string; checkpointRevision: number; highWaterHash: string };
  effects: { recordChainHash: string; unresolvedIds: string[] };
  ownership: {
    liveCallIds: string[]; pendingEnvelopeWorkIds: string[];
    focusedReviewIds: string[]; reservationIds: string[];
  };
  restrictions: { effectiveHash: string; sources: Array<{ sourceId: string; sourceHash: string }> };
  inventory: { head: string | null; branch: string | null; digest: string };
  work: Array<{
    id: string; candidateHash: string; basisHash: string; obligationsHash: string;
    supportInputsHash: string; toolchainHash: string; unsupportedExecutionHash: string;
  }>;
  preRecoveryQuestions: Array<{ id: string; factsHash: string }>;
};
```

The implementation must enforce empty `unresolvedIds` and all `ownership` lists, and sort every array before hashing. An unknown required source is a refusal, not an omitted optional field. A future required source or changed interpretation requires a reviewed manifest version change.

### 7.3 Preview and final revalidation

The preview returns its manifest version/hash and a recovery question bound to that hash. Candidate and restriction inputs are captured when that question is issued, not earlier in the diagnostic flow. Under the existing transaction lock immediately before publication, recompute candidate, obligation, support-input, toolchain and restriction projections from the same existing readers. Compare the full binding and exact pre-recovery question pairs; a change refuses the old answer without publication and requires a refreshed preview or the existing refusal.

At confirmation, re-verify the complete accounting chain. The captured checkpoint prefix must remain byte-for-byte identical. Any records appended after its cursor must be attributable solely to recovery-question publication and must preserve the captured high-water values and empty in-flight set; if the store cannot prove that, refuse. The effect-history prefix must remain unchanged, with no new external effect before the confirmation intent. This avoids treating the question's own state publication as a changed candidate or as new spending.

Use only current supported read paths: the existing Git inventory with the neutral inspection profile in TS §9.4 and the current restriction/admission readers. Do not enumerate a second set of Git commands or loosen that profile here. No project-controlled commands, checks, installs, configured hooks, network actions, Git mutations or project writes run. If a required fact cannot be obtained through the existing bounded readers, recovery remains diagnostic-only.

### 7.4 Journal, state publication and retry

The action ID is the manifest hash. In one transaction:

1. Revalidate the complete manifest, recovery-purpose tag and question ID under the lock.
2. Append and fsync the recovery intent, then its deterministic result, using the existing effect protocol.
3. Publish one state revision through the existing temp/backup/rename/fsync path. The revision clears diagnostic suspension, records the acknowledgment, preserves counters/sequences, clears old approval-bearing values and marks old evidence stale.
4. Return success only after state publication.

If interrupted with an intent but no result, inspect the exact postcondition. A matching state acknowledgment means completed; because state publication follows the result in this ordering, an intent-only record proves publication did not begin. Record not-performed, retain diagnostic mode and require a fresh question. If a result exists but state publication did not complete, the existing effect-replay path applies the same deterministic transition idempotently. If state already contains the same acknowledgment, an identical retry returns it without republishing or changing counters. A different manifest is not a retry; an ambiguous or malformed postcondition remains unresolved and diagnostic-only.

The acknowledgment is retained in every later state revision. Compaction may remove the recovery result only after both current `state` and `state.prev` contain the same acknowledgment; until then the existing protected-revision rule must retain the result needed to replay after fallback. Test both sides of that boundary, including the first subsequent publication that rotates an acknowledged state into `state.prev`. The journal only needs to support replay until both durable state copies contain the acknowledgment.

Test process termination after each durable boundary: journal intent fsync, journal result fsync, `state.tmp` fsync, `state.prev` link/rename, state rename and directory fsync. Assert the exact surviving `state`, `state.prev`, journal records, acknowledgment, accounting high-water values and effect count. A refusal must not clear unknown accounting or replace the last valid backup. Use the existing crash-recovery semantics in TS §7.4; R08 adds no second effect-replay protocol.

| Kill point | Required recovery outcome |
|---|---|
| After intent fsync, before result | No external effect has run. The matching acknowledgment is absent; record/retain not-performed under the existing protocol, remain diagnostic, and require a new question. |
| After result fsync, before state publication | Replay the deterministic transition once; preserve counters and the last valid `state.prev`. |
| After `state.tmp` fsync or `state.prev` link/rename, before state rename | Treat the published state as absent unless it validates with the matching acknowledgment; replay from the durable result. Keep a valid fallback copy. |
| After state rename, before directory fsync | Re-read and validate both copies. If the current state has the matching acknowledgment, report/replay as completed; otherwise use the durable result to complete publication. Never infer success from the rename attempt alone. |
| After directory fsync, before response | Return the durable acknowledgment on the identical retry without another publication, counter change or effect. |

AC-5 is logically independent of AC-3: it may use a separate fixture or a shared fixture only if the test explicitly proves the prior evidence was present before confirmation, fresh authorization is available, and staleness—not missing authority—causes the old evidence to be rejected.

### 7.5 Evidence and consumer audit

On successful publication, keep locks and stale records for inspection; do not let old evidence satisfy a current claim. The following is the minimum consumer contract, not permission to stop searching call sites during implementation review:

| Record / consumer surface | Recovery behavior |
|---|---|
| `Receipt` and `Obligation` baseline projection (`baselineTestHash`, `baselineMatched`, `baselineInputs`) | Add `recoveryStale` to receipts and obligations. `core/verdict.ts` must ignore stale receipts and stale baseline proof; `core/obligations.ts`, `verbs/check-evidence.ts` and `verbs/check-finalize.ts` may replace stale baseline state only after a fresh baseline succeeds. A stale receipt remains inspectable but never counts as a pass or coverage. |
| `ReviewLink` and `AnalystLink` | Mark old links stale. `core/review.ts`, `core/controls.ts`, `verbs/manifest.ts` and `core/verdict.ts` must not select stale links for review chains, rechecks, completed-review status or Deep passes. `core/review.ts` must omit stale receipts from active evidence in new review packets. |
| `Finding` and `AttentionItem` | Mark old records `recoveryStale`. An old settled finding state (`verified`, `withdrawn`, `risk-accepted`, `deferred` or `wont-fix`) and old attention disposition cannot settle a current claim. Stale findings remain unresolved/blocking until a fresh review rechecks or disposes them; stale attention requires a fresh disposition. Fresh results clear the marker only on the records they actually revalidate. `core/verdict.ts`, `core/review.ts`, `verbs/findings.ts` and `verbs/check-evidence.ts` must not carry old dispositions forward as current. |
| Integration validation | Mark old `git.integrated` validation recovery-stale. `verbs/facts.ts`/`core/verdict.ts` must treat a previously validated moved integration as unvalidated after recovery; a fresh successful integrated-stage check may clear the marker. |
| `session.last`, `lastCheck`, and finish/handoff summaries | Clear cached response/check fields. `verbs/finish.ts` reports only current receipts/review as current; `core/handoff.ts` and inspection retain old records only with an explicit stale label. |
| `State.pending`, `pendingEnvelope`, grants, consents, `acceptance`, `git.switchConsent` and in-flight work | Fence old question IDs before generic answer handling; refuse unresolved pending envelopes, calls and host reservations; clear old pending questions only on confirmation. Reset approval-bearing answers and never restore grants/consents. |
| Budget reservations, counters and locks | Refuse confirmation while any focused or outstanding reservation exists. Preserve all spent counters/sequences and all locks; do not release or reduce them as a recovery shortcut. |
| `declined` and other conservative findings | Preserve prior refusals/blockers; they cannot create authority or pass evidence. A fresh user decision is required to change them. |

#### Current-source consumer audit (2026-10-27)

This matrix records the source audit for the current tree. The implementation must preserve these decisions; it must not defer discovery of current consumers to implementation time. A new consumer introduced before implementation requires a spec update and review.

| Current call site | Record use | Required recovery handling |
|---|---|---|
| `verbs/facts.ts` `verdictInput` | Assembles receipts, obligations, reviews, analyses, findings, attention, grants, `lastCheck`, integration and budget into verdict input. | Preserve stale markers into verdict input; mark prior integration validation stale; keep fresh authorization false until newly granted. |
| `core/verdict.ts` `fresh`, `judgeObligation`, `judgeRed`, `reviewChain`, `fullTypesPassed`, `judgeDeepPasses`, `judgeFindings`, `judgeAttention`, `reasonsOf` | Selects passing receipts, baseline proof, review chains, Deep passes, finding/attention dispositions and integration validity. | Exclude stale receipts/reviews/analyses/baselines; produce existing stale/missing reasons; treat stale resolved findings as unresolved and stale attention as undisposed; reject old integration validation. |
| `core/obligations.ts` obligation projection; `verbs/check-evidence.ts` `receiptsOf`, `matchBaseline`, `attentionOf`; `verbs/check-finalize.ts` `finalizeCheck` | Builds obligations and baseline proof; records receipts; carries attention dispositions; updates `lastCheck` and integrated validation. | Do not merge stale baseline as current or carry stale dispositions; only a fresh successful baseline/check clears the marker for the record it replaces. |
| `verbs/check.ts` selection; `verbs/check-rerun.ts`; `verbs/check-outputs.ts` | Selects checks and declared inputs/outputs; gates on questions, grants and envelopes. | Recovery gate refuses launches while recovered; stale run data is never selected as a current pass. |
| `core/review.ts` `reviewMode`, `continuesReviewRound`, `buildManifest`, `checkResult`, `applyResult`; `verbs/manifest.ts` `issueReview`, `issueAnalyst`; `verbs/findings.ts` result ingestion | Selects completed reviews, builds packets, validates reservations, records review/analyst results and dispositions. | Ignore stale links for continuation/chains; exclude stale receipts from active packet evidence; mark stale findings as re-review targets; no pre-recovery reservation can be accepted after confirmation. |
| `core/controls.ts` controls; `core/handoff.ts` handoff; `verbs/finish.ts` finish/close/result | Reports latest review, receipts, open findings, controls, endpoint and handoff. | Report only fresh evidence as current; retained stale history is explicitly labeled stale and never changes the endpoint. |
| `verbs/inspect.ts` status/why; `verbs/packet.ts` packet/handoff output; `verbs/review.ts` stateless review | Displays state, reasons, handoff, attention and review-only context. | Inspection may show stale history with explicit labels; it cannot activate it. A stateless review does not create stored contract evidence. |
| `verbs/commit.ts` commit admission; `verbs/integrate.ts` integration/idempotent postcondition; `verbs/recover-effects.ts` integration recovery | Uses `lastCheck`, consents, pending questions, `git.integrated`, external-effect results and branch state. | Refuse commit/effect continuation while recovery is active; clear old consents; require settled effects; stale moved-integration validation cannot satisfy the verdict. |
| `core/authority.ts` authorization helpers; `verbs/reconcile.ts` filter consent; `core/execution-envelope.ts` envelope recovery/consent | Uses grants, global consents, pending envelopes and interrupted execution state. | Grants/consents are cleared and never restored; pending envelopes or unresolved execution refuse confirmation; ordinary question/consent creation is gated while recovered. |
| `core/state.ts` `recoveredState`; `pipeline-mutate.ts` recovery/fence; `verbs/open.ts` resume/takeover; `verbs/common.ts` cleanup | Reconstructs fallback state, fences stale sessions/ownership, uses response cache and cleans run/review artifacts. | Keep effect/process fences; do not treat cached responses or leftover artifacts as evidence; clean only under existing ownership rules. |
| `core/budget.ts` summaries, reservation and accounting recovery | Counts attempts/delegations/reservations and reconstructs counters. | Refuse while any reservation remains; preserve all verified counters/high-water values and never free capacity by deleting a reservation. |
| `pipeline-render.ts` rendering; CLI default inspect/help | Renders responses and redacts output. | Show only safe recovery identifiers/status; do not render excluded content, raw grant payloads or stale output as current. |

The stale marker semantics are exact: a stale `Receipt`, `Obligation` baseline, `ReviewLink`, or `AnalystLink` cannot satisfy evidence/review; a stale resolved `Finding` or disposed `AttentionItem` is unresolved until fresh disposition; a stale moved-integration validation is unvalidated; cached `lastCheck` and `session.last` are cleared. Current refusal/diagnostic reason codes are reused. AC-5 must use fresh authorization and otherwise-valid old evidence so missing grants alone cannot make the negative regression pass.

### 7.6 State contract and migration

The proposed state delta is a dedicated acknowledgment record `{ version: 1, bindingHash, acknowledgedAt, publishedRevision }`; `purpose: "recovery"` on the question; and `recoveryStale` markers on obligations, receipts, review links, analyst links, findings, attention items and integration validation. Reset `acceptance` to `pending` and remove `git.switchConsent`. Keep the acknowledgment through later revisions; do not hide it in `_ext`.

This spec does not choose a schema version or compatibility mechanism. The owner chose to defer R08 sign-off and implementation until the schema-migration contract is approved. Before either may proceed, that contract must explicitly disposition every field above against the strict current state schema, existing `state.prev`, marker/state schema agreement, older/newer kernels, state parsing/publication and the journal-compaction rule. Do not silently add optional fields under schema 1, rely on `_ext`, or assume old kernels preserve them. The recovery acknowledgment and stale markers must have one reviewed compatibility path; an unknown schema/manifest version refuses rather than being interpreted best-effort.

Risks: unsupported restriction sources (H impact; refuse), stale/concurrent approval (H impact; transactional binding), unresolved host reservation (H impact; refuse), last-good-copy loss on crash (H impact; killed-step tests), schema compatibility (H impact; coordinated migration sign-off), semantic overclaim (H impact; D1 gate). No implementation estimate is asserted before decisions/review.

Checkpoints: D1-D3 policy resolved (owner 2026-10-24); D4-D5 resolved (owner 2026-10-27). The 2026-10-27 fresh review's binding-source, complete consumer-audit and schema/compaction blockers are addressed as explicit contracts and gates, pending a new independent spec-only review. Remaining: disposition new findings; complete the schema-migration coordination and owner sign-off; then red-first implementation, focused/full gates, two-runtime UAT, canonical backfill and archival.

## Review Findings and Dispositions

The first independent review is recorded in [launch-completion.md §5](../docs/audits/2026-10-24/launch-completion.md#5-partial-obligations-and-decisions). All eight findings are accepted as required corrections or clarifications; the table below records how this revision addresses them. A fresh review is still required.

| # | Finding | Disposition |
|---|---|---|
| 1 | Recovery confirmation is a legitimate state/journal write, despite diagnostic recovery otherwise being read-only. | Accept. Scope the write to the journaled workspace acknowledgment and its state publication. No project mutation is allowed. |
| 2 | The exact binding and final validation boundary were missing. | Accept. Propose a canonical manifest and require reconstruction under the transaction lock immediately before publication; any mismatch refuses the old answer. |
| 3 | A stale-evidence negative test could pass only because recovery cleared grants. | Accept. Require otherwise-valid evidence and fresh authorization in the regression, isolating the stale-evidence filter. |
| 4 | Pending/prepared authority questions could recreate old authority. | Accept. Make all old questions unanswerable while diagnostic recovery is active; refuse unknown prepared authority; clear old questions on confirmation. |
| 5 | The workspace interaction had no handle-free dispatch path. | Accept. Specify a workspace-level question/action with no surviving work handle; exact dispatch and wire schema remain review gates. |
| 6 | A duplicate success needs a durable workspace acknowledgment. | Accept. Persist the binding acknowledgment in state and journal; state survives journal compaction and the journal supports interrupted publication recovery. |
| 7 | "Zero child process" wording conflicts with permitted Git inspection. | Accept. Prohibit project-controlled command execution, not the bounded neutral Git reads needed to inspect the workspace. |
| 8 | Chat routing does not authenticate human identity. | Accept. Record the answer as reported input; neither chat nor CLI capture is described as identity proof. |

### Source-grounded clarifications

- Accounting verification reuses TS §7.3; this feature does not invent a separate accounting rule or standalone audit trail.
- Read-only inventory and exclusion limits reuse TS §9.4; a source outside that supported profile keeps recovery diagnostic-only.
- Output redaction reuses TS §11.3 and gets a direct question-output regression; no duplicate redaction mechanism or unrelated lint rule is proposed.
- Durable retry uses the existing journal/effect protocol in TS §7.4 and the state acknowledgment selected by the owner; it does not depend on retaining compacted journal history.

The eight prior findings map to proposed controls as follows: #1 AC-7/8; #2 AC-4; #3 AC-5; #4 AC-2; #5 AC-1; #6 AC-8; #7 AC-6; #8 AC-9. These are test plans, not tests that already exist.

### 2026-10-27 first fresh-context review and dispositions

The first fresh review found two design blockers and four non-blocking issues. Their recommended design safeguards were incorporated; the focused follow-up correctly noted that code and tests remain absent, which is an implementation gate rather than a spec defect. A later spec-only review found three further blockers; its findings and current dispositions are recorded below. A fresh independent review must assess the current revision.

| Finding | Disposition in this revision |
|---|---|
| Old questions/prepared authority lacked an enforceable exclusion point. | Accept as a design finding. §7.1 specifies that the future kernel must use existing `State.recovered` as the gate before generic `decide` handling, allow only the distinctly tagged recovery question ID, reject old IDs without recording an answer, and refuse `pendingEnvelope` or unresolved `inCall` state. This is not implemented; AC-2 remains a code/test gate after owner sign-off. No redundant `recoveryActive` field is proposed. |
| Binding manifest was not explicit/versioned enough to test. | Accept as a design finding. §7.2 defines `RecoveryBindingV1`, stable ordering, hashes and fail-closed missing-source behavior; §7.3 requires full recomputation under lock. A source change requires a reviewed manifest version change. This is not implemented; AC-4 remains a code/test gate after owner sign-off. |
| Stale-evidence consumers were not auditable. | Accept. §7.5 lists the evidence-bearing state surfaces and known current consumer files, and requires a complete call-site audit plus focused tests before implementation. This audit does not invent new evidence types or semantics. |
| Schema compatibility was not concrete enough. | Accept as a required coordination gate. §7.6 proposes the acknowledgment fields and stale/purpose markers; schema version, pre-existing backup compatibility and rolling-version behavior remain for the schema-migration review, not an unapproved schema-2 decision here. |
| Retry/compaction crash semantics were underspecified. | Accept. §7.4 defines intent-only, result-before-state and matching-state outcomes; AC-8 tests compaction while `state.prev` lacks the acknowledgment and after both copies contain it. |
| Read-only Git boundary could expand into an unreviewed command allowlist. | Accept the boundary; reject the proposed second command list. §7.3 binds the existing TS §9.4 inventory/restriction readers and refuses facts unavailable through them. No project-controlled commands or Git mutation are admitted. |
| Question invalidation scope was ambiguous. | Accept. §7.1 binds every pre-recovery pending question ID; no unrelated question is issued during recovery; all old entries are removed after confirmation and any needed question is reissued. |
| Each prior finding should map to a test. | Accept. The mapping above connects all eight findings to proposed ACs; it does not claim tests exist. |

### Focused follow-up scope disposition

The follow-up checked the revised design but treated the intentional absence of runtime code as proof that the design findings remained open. The feature lifecycle requires review and owner sign-off before code, and this draft explicitly claims no implementation. Therefore:

| Follow-up claim | Disposition |
|---|---|
| The `State.recovered` gate and recovery-question-ID checks do not exist in `decide.ts`. | Correct source observation; not a spec defect. §7.1 now gives the required pre-handler behavior and AC-2 is the post-sign-off implementation/test gate. A spec-only reviewer must assess whether that contract is sufficiently precise. |
| `RecoveryBindingV1`, revalidation code and AC-4 tests do not exist. | Correct source observation; not a spec defect. §§7.2-7.3 now define the versioned structure and re-read boundary; AC-4 remains unimplemented by design until sign-off. A spec-only reviewer must assess whether the contract is complete enough to implement. |
| The spec claims those mechanisms are already implemented. | Reject. The status, AC table, implementation guidance and plan state that the mechanism is proposed, not implemented, and no code/tests are claimed. |

### 2026-10-27 subsequent spec-only review and dispositions

A subsequent independent review found three blocking design gaps and two non-blocking clarifications. The following changes address the design contract, but do not close review or authorize implementation. In particular, schema compatibility remains a hard dependency: the migration contract must approve a concrete path before R08 sign-off.

| Finding | Current disposition |
|---|---|
| Binding-source completeness, including candidate capture timing and pending/prepared authority. | Addressed for re-review in §§7.1-7.3: candidates are captured at question issuance and recomputed under lock; the closed source list names the current policy/settings readers; ownership lists are explicit and must be empty; unknown or unsupported inputs refuse. |
| Stale-evidence consumers were not exhaustively audited. | Addressed for re-review in §7.5: the source audit covers verdict, baseline, review/analyst selection, findings/attention dispositions, integration validation, finish/handoff output and reservations. Any consumer found during implementation must be added before code is considered complete. |
| State schema and compaction coordination was incomplete. | Partially addressed as a blocking dependency in §§7.4 and 7.6: compaction's two-state-copy boundary is explicit, and every proposed schema field is enumerated. The exact version/compatibility path remains unresolved in `schema-migration.md`; R08 cannot receive final sign-off or runtime implementation until that contract explicitly approves the fields and compatibility behavior. |
| Pending-question and active-reservation semantics needed precision. | Addressed for re-review in §7.1: bind IDs plus `factsHash`, gate before generic dispatch/reconciliation, refuse pending envelopes and active reservations, and clear old approval-bearing values only on successful confirmation. |
| AC-5 needed to isolate stale evidence from missing authority. | Addressed for re-review in AC-5: the test requires fresh authorization and otherwise-valid prior evidence, and covers prior accepted dispositions and integration validation as well as receipts/reviews. |
| Publication fault coverage needed concrete boundaries. | Addressed for re-review in AC-7 and §7.4: enumerate journal, temp-state, backup, rename and directory-sync boundaries; verify both state copies and journal retention. |

### Fresh review outcome and dispositions (2026-10-27)

A fresh independent review of the then-current draft returned **NOT SIGN-OFF-READY** with three blockers and four non-blocking issues. The following edits were made afterward; they are dispositions for a new review, not claims that the reviewed draft or current revision is approved.

| Finding | Disposition after review |
|---|---|
| B1: Schema/version/compaction path was not approved by `schema-migration.md`. | **Open blocker.** The current §7.6 enumerates the exact proposed fields and requires explicit migration-contract approval for schema position, `state.prev`, older/newer kernels and compaction. No R08 sign-off or runtime implementation until the owner resolves this dependency. |
| B2: Question issuance and candidate capture lacked a complete atomicity contract. | Addressed for re-review in §§7.1-7.3: lock/read/gate/compute/unique-ID/publish/return ordering is explicit; candidate identity is the kernel-produced `Facts.candidate`; revision conflicts restart the whole computation; old question IDs are refused regardless of `factsHash`; question-publication checkpoint suffixes are constrained. A fresh reviewer must confirm this closes the finding. |
| B3: Stale-evidence consumer audit was deferred to implementation. | Addressed for re-review in §7.5 by the 2026-10-27 source consumer matrix, including verdict-active, check, review/analyst packet, finish, commit/integration, recovery/cache, budget, inspection and rendering consumers. The matrix is part of this spec and is linked from plan §12.9; a fresh reviewer must verify completeness. |
| N1: AC-5 independence from AC-3 was unclear. | Addressed: AC-5 must use an independent fixture or explicitly prove the prior evidence existed before confirmation and that fresh authorization is available. |
| N2: Workspace confirmation could be mistaken for selective per-contract recovery. | Addressed: scope dependencies now state confirmation is all-or-nothing across every `State.work` item. |
| N3: AC-2 refusal cases lacked concrete examples. | Addressed with a refusal-fixture table. It reuses existing refusal responses and does not add reason codes. |
| N4: AC-7 listed kill points without per-point outcomes. | Addressed with a kill-point outcome table aligned to TS §7.4; R08 does not define another replay protocol. |
| S1: `pendingEnvelope` meaning was unclear. | Addressed: §7.1 treats its presence as an unresolved prepared envelope regardless of current user activity. |
| S2: AC-3/AC-4 lacked a changed-fact example. | Addressed in AC-4 with declared-source and policy-file change examples. |

The independent review's verdict applies to the pre-follow-up revision. The current text still needs a fresh review after the schema dependency is resolved; B1 remains open now.

## Open Tensions

**D1 resolved:** Owner selected fresh authorization on 2026-10-24. Neither acknowledgment of recovery nor serialized grant validity reactivates old grants, execution consents, acceptance or branch-switch consent. D2/D3 must implement this without discarding accounting or weakening safety fences.

**D2 scope resolved:** Owner selected bounded fail-closed revalidation on 2026-10-24, not best-effort confirmation or waiting for complete graph support. Unsupported cases remain diagnostic-only. The concrete manifest and publication protocol require review/sign-off; refusing unavailable closure does not complete unsupported configuration requirements.

**D3 interaction resolved:** Owner selected workspace confirmation with changed-fact invalidation on 2026-10-24, then confirmed a journaled workspace action on 2026-10-27. Exact schema/vocabulary and publication behavior still require review. Inspection cannot publish approval state; reported CLI capture cannot authenticate a human answer.

**D4 evidence disposition resolved:** Owner selected retaining old evidence with explicit stale markers and excluding it from verdicts on 2026-10-27. Every consumer must be identified in review; a marker without complete consumer filtering is insufficient.

**D5 durability resolved:** Owner selected state-plus-journal acknowledgment on 2026-10-27. The proposed state fields and crash/compaction behavior are specified, but schema/version compatibility remains a blocking dependency on `schema-migration.md`; on 2026-10-27 the owner chose to defer R08 sign-off and implementation until that contract is approved.

Alternative: keep diagnostic-only behavior indefinitely. It is the current safe fallback, not completion of the planned one-question recovery workflow.

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| Remain diagnostic-only indefinitely | Safe fallback, but does not deliver the owner-approved workspace recovery action. Use whenever required facts or sources are unknown. |
| Journal-only acknowledgment | Rejected: completed journal entries are compacted, so it cannot carry the durable acknowledgment by itself. |
| State-only acknowledgment | Rejected: it cannot recover an accepted publication interrupted between journaled effect result and state publication. |
| State-plus-journal acknowledgment | Recommended: the state carries the durable binding; journal intent/result supports crash-safe idempotent publication. |
| Delete old evidence or move it to a new archive | Rejected in favor of the owner's mark-and-ignore choice, which preserves existing records in place and gives every consumer an explicit invalidation bit. |
| Per-contract confirmation | Rejected: the owner selected one workspace-scoped action that does not require a surviving work handle. |

## Assumption Registry

| Assumption | Confidence / evidence | Invalidation signal |
|---|---|---|
| Fresh authorization is the required reconfirmation meaning | H, owner D1 approved 2026-10-24 | Later explicit owner amendment; never infer grant restoration |
| Supported-source revalidation can be narrowly specified | M, current loaders exist but graph closure remains incomplete | A required source cannot be safely identified or admitted |
| Existing question/decision pipeline can carry the binding | M, other bound decisions exist; workspace recovery path unproved | Binding requires an unreviewed state/transport mechanism |

D1-D5 are owner-validated policy choices; the assumptions about source closure, schema compatibility and pipeline dispatch still require fresh independent review and owner sign-off before execution. No mechanism is approved by this document.

## Adversarial Self-Critique

1. The question gate is now specified, but the implementation review must verify it runs before every generic answer path and that no persisted authority-bearing surface was omitted.
2. The binding is versioned and explicit, but the source set still needs independent validation against every current restriction, accounting, ownership and candidate reader. A hash cannot compensate for an omitted source.
3. Journal/state ordering and the backup compaction boundary are specified, but only real kill-step tests of the store can establish that the last valid state and acknowledgment survive each interruption.

## Revision Triggers

| Trigger | Revision required |
|---|---|
| Owner chooses prior-grant restoration | Outcome, scope, AC-3/5/6 and binding semantics |
| D2 review exposes unsupported required sources | Scope dependencies, refusal matrix and acceptance tests |
| Current decision/publication protocol cannot meet AC-4/7/8 | D3, state/API changes, failure handling and new review |
| A canonical spec changes recovery or authority meaning | Reconcile before implementation; canonical spec wins |

## Appendix

Current controlling code: `core/state.ts` constructs suspended fallback state; `core/budget.ts` establishes accounting verification; `adapters/store-fs.ts` reads/publishes owned snapshots; `verbs/open.ts` fences unknown accounting; `pipeline-render.ts` discloses diagnostic mode. Paths are relative to `packages/kernel/src/`. This draft changes none of them.