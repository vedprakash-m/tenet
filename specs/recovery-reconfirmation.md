# Specification: Backup Recovery Reconfirmation

> **Spec type:** Product/feature; F1-F4 load-bearing, F5-F6 supporting.
> **Date:** 2026-10-24 | **Author:** GitHub Copilot | **Decision owner:** repository owner, plan Section 3.1.
> **Status:** DRAFT, independently reviewed; mechanism revisions and final sign-off pending. Owner approved D1 (fresh authorization), D2 scope (bounded, fail-closed revalidation) and D3 interaction (workspace confirmation with durable retry acknowledgment) on 2026-10-24. No implementation permission.
> **Decision status:** All three named owner policy decisions resolved; concrete manifest/protocol review, finding dispositions and final mechanism sign-off still block implementation. This is not an executable zero-question specification yet.

## How to Read This Spec

| Role | Start here | Then read |
|---|---|---|
| Owner | Outcome, Open Tensions | Assumptions, Self-Critique |
| Engineer | Scope, Acceptance Criteria | Context, Implementation Guidance |
| Reviewer / QA | Acceptance Criteria | Failure Conditions, Ambiguity Audit |
| UX reviewer | Outcome, Scope | D1/D3 and examples |

## Notation Key

`[Validated]` identifies a current canonical constraint, not qualified behavior. `[Assumed: verify]` identifies a recommendation requiring owner approval. `[Unknown: TBD]` identifies a blocking decision, owned by the repository owner before implementation. H/M/L are confidence in assumptions, not completion states. AC scores of 3 mean binary-testable proposed criteria; they do not mean the tests exist or pass.

## 1. Outcome Statement

[Validated: owner D1/D2/D3, 2026-10-24, decisions 2-4 option A] An owner with a verified, effect-resolved backup can answer one fact-bound workspace recovery question and proceed through fresh authorization, without restoring old grants or execution consents, trusting old passing evidence or replaying an uncertain effect. Exact manifest and publication mechanics remain subject to review and final sign-off.

Verification: corrupt a scratch repository's primary state, inspect the recovered preview, confirm the unchanged facts, then prove that work still needs fresh authorization and checks. Unknown accounting or ownership must prevent confirmation. Outcome score: 3, conditional on mechanism review and final sign-off; this is not observed runtime behavior.

## 2. Scope

### IN Scope

| Capability | Boundary | Criteria |
|---|---|---|
| Recovery preview | One question for the owned workspace after all preconditions hold; no per-grant restoration questions | AC-1, AC-2 |
| Fact-bound confirmation | Current fallback identity, accounting, effects, restrictions and candidate facts; changed facts invalidate the answer | AC-3, AC-4 |
| Diagnostic-mode exit | Publish a revalidated snapshot with no imported authority or usable stale evidence | AC-5, AC-6 |
| Failure-safe publication | Preserve the last valid backup through interruption and retry | AC-7, AC-8 |

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

[Validated: owner D2 scope, 2026-10-24, decision 3 option A] Implement a bounded, fail-closed recovery path rather than wait for complete configuration/dependency-graph support. Confirmation must bind workspace and backup/journal identities, accounting high-water marks, effect/process ownership, current restrictions, relevant candidate/obligation/support-input/toolchain identities, and the disposition of stale evidence and pending permission questions. Missing, unsupported, changed or uncertain required facts prevent confirmation; unsupported configurations stay diagnostic-only, not recovered best effort. Bounded program-neutral read-only Git inspection is permitted; checks, installs, configured hooks, Git mutations and project writes are not recovery-validation steps.

[Assumed: verify, mechanism review before implementation] The exact supported manifest, source/refusal matrix and publication protocol still need independent review and final sign-off. A partial loader is not proof of complete restriction revalidation. Facts must be revalidated before publication; a changed binding invalidates the old answer.

### Open Scope Tensions

Resolved by owner D1/D2/D3 on 2026-10-24: no old authority reactivates; validation is bounded and fail-closed; confirmation is workspace-scoped, bound to displayed facts and durably acknowledged for retry. TS Section 15.2 requires fresh authorization. The exact manifest, pending-question disposition, stale-evidence representation and publication protocol remain subject to mechanism review and final sign-off; policy approval does not approve implementation.

## 3. Acceptance Criteria

All proposed criteria have score 3. Test paths name existing homes; no new tests for this feature are claimed. The owner validates all proposed behavior before implementation.

| ID | Type | Binary criterion / example | Test owner | Score | Status |
|---|---|---|---|---|---|
| AC-1 | Behavioral | Verified fallback, no unresolved effects/processes, valid sources: one workspace recovery question names the recovered revision, lost permissions/evidence and remaining limits, offering "Confirm recovery" or "Wait". No usable contract handle is required. No project execution or mutation occurs while presenting it. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D3 interaction]; [Assumed: verify, concrete dispatch] |
| AC-2 | Edge | Unknown accounting, conflicting checkpoints, missing process identity, live process or unresolved effect: no actionable confirmation; current diagnostic/refusal remains and records do not change. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/execution-envelope.test.ts` | 3 | [Validated: TS Sections 7.3/7.4] |
| AC-3 | Behavioral | Confirm an unchanged preview: one transaction validates the binding, preserves recovered counters/sequences, and exits diagnostic suspension without restoring grants/consents. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: no restored authority, owner D1]; [Assumed: verify, D2/D3 transaction] |
| AC-4 | Edge | Change a bound primary/backup/journal record, workspace identity, candidate file or policy/restriction source after preview: old confirmation cannot publish or grant authority; a refreshed preview or existing refusal is returned. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Assumed: verify, D2/D3] |
| AC-5 | Negative | Passing receipts, baseline matches, review completion and cached endpoints from the backup cannot satisfy finish after confirmation; their records remain inspectable as stale history. Locked files are not unlocked. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/contract.test.ts` | 3 | [Assumed: verify]; [Validated: TS Section 14 revalidation] |
| AC-6 | Negative | Recovery validation permits bounded program-neutral read-only Git inspection, but performs zero project writes, Git mutations, project checks, installs, configured-hook executions, network actions or budget resets, and never reconstructs a lost contract from accounting. Unsupported current restrictions/configuration refuse. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D2 scope]; [Assumed: verify, exact inspection protocol] |
| AC-7 | Reliability | Kill at each journal/backup/state publication boundary: a valid recoverable snapshot remains; retry cannot clear unknown accounting or duplicate an effect. | `packages/kernel/test/backup-accounting.test.ts`, existing crash fixtures | 3 | [Assumed: verify] |
| AC-8 | Edge | Wait/decline or an identical retry cannot activate authority, spend a new attempt or erase diagnostic history. Successful acknowledgment is durable: after a lost response or restart, retrying the accepted binding reports acknowledgment without repeating recovery publication or resetting counters. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Validated: owner D3 retry behavior]; [Assumed: verify, durable protocol] |
| AC-9 | Security | Excluded/secret content and raw grant payloads are absent from question text; identifiers/hashes and literal kernel status are used. The question uses chat routing; command-line answer capture remains `reported`, never claimed to authenticate human identity. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/authority.test.ts` | 3 | [Validated: owner D3 interaction/provenance]; [Assumed: verify, implementation] |
| AC-10 | Dependency | All above controls, full `npm run ci`, and the same built artifact on Node 26 and 22.12.0 pass; unknown/live process negative controls are retained. No local result is called host qualification. | `tools/uat/uat.mjs` and source gates | 3 | [Validated: repository lifecycle] |

Complexity: complex, ten criteria. Definition of done: approved D1-D3, independent review with dispositions, all ACs passing, canonical backfill, archive, changelog and plan update. No qualification claim follows from source or scratch UAT alone.

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
| One workspace-level confirmation with "Confirm recovery" / "Wait", changed-fact invalidation and durable success acknowledgment; CLI capture stays reported | Owner chose decision 4 option A, 2026-10-24; concrete schema/protocol and final sign-off remain pending | [Validated: D3 interaction] |
| Bounded fail-closed revalidation; unknown/unsupported facts keep recovery diagnostic-only; bounded read-only Git inspection permitted | Owner chose decision 3 option A, 2026-10-24; concrete manifest/protocol review and final sign-off remain pending | [Validated: D2 scope] |
| Fresh authorization after recovery; no old grants or execution consents reactivate | Owner chose decision 2 option A, 2026-10-24 | [Validated: D1] |
| One question, not silent continuation | Plan C0 triage; minimize recovery ceremony without suppressing uncertainty | [Validated] |
| Diagnostic-only unknown accounting | TS Section 7.3; unknown usage/ownership cannot yield editing authority | [Validated] |
| Kernel owns verdict, budgets and facts | Architecture rules; frontends ask/explain only | [Validated] |
| No reconfirmation kind is implemented today | TS Section 7.3 and current code; this draft cannot be invoked | [Validated, 2026-10-24 source review] |

### Dependencies

| Dependency | Status | Owner / blocking condition |
|---|---|---|
| D1 authority meaning | Resolved: fresh authorization only | Owner chose A, 2026-10-24; no mechanism or implementation approval inferred |
| D2 revalidation/binding scope | Resolved: bounded, fail-closed path | Owner chose A, 2026-10-24; concrete manifest/source matrix/protocol still need review and final sign-off |
| D3 public decision/question contract | Resolved: workspace confirmation and durable retry acknowledgment | Owner chose A, 2026-10-24; concrete schema/dispatch/publication protocol still need review and final sign-off |
| Independent review and sign-off | Review performed; eight findings accepted as blockers/clarifications; revisions and sign-off pending | Launch completion review Section 5; no self-approval |
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
| D2 | What scope and snapshot identity are revalidated/bound? | Bounded fail-closed path with the facts in Scope Dependencies; missing/unsupported/changed/uncertain facts prevent confirmation. Bounded read-only Git inspection allowed; no project execution/mutation. [Validated: owner chose A, 2026-10-24]. Exact manifest/source matrix/protocol still need independent review and final sign-off. |
| D3 | Which interaction and stale/retry responses expose confirmation? | One workspace-level confirmation with displayed recovery facts, "Confirm recovery" / "Wait", refreshed preview after bound-fact changes and durable acknowledgment preventing duplicate publication/counter reset. CLI capture remains reported. [Validated: owner chose A, 2026-10-24]. Concrete schema/protocol review and final sign-off remain pending; runtime vocabulary is unchanged. |

All three named owner policy decisions are resolved. Concrete manifest/protocol review, finding dispositions and final sign-off remain blocking technical dependencies; this draft is not an executable zero-question handoff or code permission.

## 7. Implementation Guidance

[Validated: owner D3 interaction; Assumed: verify, concrete API] Design one workspace-scoped recovery decision and question, with no required surviving contract handle. Display "Confirm recovery" and "Wait"; acknowledgment grants no prior authority. Candidate internal name `recovery-confirm`, answer tokens and `decide` payload remain subject to concrete schema/protocol review. A successful accepted binding needs durable acknowledgment so a retry after response loss cannot repeat recovery publication or reset counters. This vocabulary does not exist at runtime and must not be added to skills before implementation.

[Assumed: verify, D2/D3] Read-only views can describe recoverable facts but cannot publish a pending question. Before implementation, prove how the existing pipeline persists or validates the binding without turning a rendered preview into authority. Hashes are change detectors, not owner authentication or filesystem snapshot isolation.

[Validated: owner D1, no restored authority; Assumed: verify, D2/D3 mechanism] After acceptance, publish the revalidated snapshot with the recovery marker cleared; retain budget/sequence high-water marks and provenance, leave grants/consents empty, invalidate baseline/evidence/review completion and cached responses, and retain locks. Retained records need an explicit stale representation; if existing schemas cannot express this, review the schema change rather than deleting historical facts.

Risks: unsupported restriction sources (H impact; refuse), stale/concurrent approval (H impact; transactional binding), last-good-copy loss on crash (H impact; killed-step tests), semantic overclaim (H impact; D1 gate). No implementation estimate is asserted before decisions/review.

Checkpoints: D1/D2/D3 policy resolved (owner 2026-10-24); independent review performed with eight findings recorded in the launch completion review. Remaining: concrete manifest/protocol review, finding disposition, revised mechanism sign-off, red-first implementation, focused/full gates, two-runtime UAT, canonical backfill and archival.

## Open Tensions

**D1 resolved:** Owner selected fresh authorization on 2026-10-24. Neither acknowledgment of recovery nor serialized grant validity reactivates old grants or execution consents. D2/D3 must implement this without discarding accounting or weakening safety fences.

**D2 scope resolved:** Owner selected bounded fail-closed revalidation on 2026-10-24, not best-effort confirmation or waiting for complete graph support. Unsupported cases remain diagnostic-only. The concrete manifest and publication protocol require review/sign-off; refusing unavailable closure does not complete unsupported configuration requirements.

**D3 interaction resolved:** Owner selected workspace confirmation with changed-fact invalidation and durable retry acknowledgment on 2026-10-24. Reuse of the pipeline's decision mechanism, exact schema/vocabulary and publication behavior still require review. Inspection cannot publish approval state; reported CLI capture cannot authenticate a human answer.

Alternative: keep diagnostic-only behavior indefinitely. It is the current safe fallback, not completion of the planned one-question recovery workflow.

## Assumption Registry

| Assumption | Confidence / evidence | Invalidation signal |
|---|---|---|
| Fresh authorization is the required reconfirmation meaning | H, owner D1 approved 2026-10-24 | Later explicit owner amendment; never infer grant restoration |
| Supported-source revalidation can be narrowly specified | M, current loaders exist but graph closure remains incomplete | A required source cannot be safely identified or admitted |
| Existing question/decision pipeline can carry the binding | M, other bound decisions exist; workspace recovery path unproved | Binding requires an unreviewed state/transport mechanism |

D1 is owner-validated; the remaining two assumptions require owner/reviewer validation before execution. No mechanism is approved by this document.

## Adversarial Self-Critique

1. The approved authority meaning does not yet have a complete mechanism: old pending questions or prepared payloads could still recreate authority. D2/D3 must cover those consumers; D1 alone is not permission to implement a partial recovery path.
2. The binding manifest is not yet executable. A hash of too few sources could accept a stale snapshot. Watch for a hard-coded partial source list described as complete revalidation.
3. Publication and retry must preserve the last valid copy, not merely produce a happy-path response. Watch for crash tests that assert only the final exit code, not surviving state/backup bytes and effect count.

## Revision Triggers

| Trigger | Revision required |
|---|---|
| Owner chooses prior-grant restoration | Outcome, scope, AC-3/5/6 and binding semantics |
| D2 review exposes unsupported required sources | Scope dependencies, refusal matrix and acceptance tests |
| Current decision/publication protocol cannot meet AC-4/7/8 | D3, state/API changes, failure handling and new review |
| A canonical spec changes recovery or authority meaning | Reconcile before implementation; canonical spec wins |

## Appendix

Current controlling code: `core/state.ts` constructs suspended fallback state; `core/budget.ts` establishes accounting verification; `adapters/store-fs.ts` reads/publishes owned snapshots; `verbs/open.ts` fences unknown accounting; `pipeline-render.ts` discloses diagnostic mode. Paths are relative to `packages/kernel/src/`. This draft changes none of them.