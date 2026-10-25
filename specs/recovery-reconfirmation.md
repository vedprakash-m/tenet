# Specification: Backup Recovery Reconfirmation

> **Spec type:** Product/feature; F1-F4 load-bearing, F5-F6 supporting.
> **Date:** 2026-10-24 | **Author:** GitHub Copilot | **Decision owner:** repository owner, plan Section 3.1.
> **Status:** DRAFT, unreviewed, unapproved. No implementation permission.
> **Zero-Question Score:** 3 named blocking decisions; not executable until resolved.

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

[Assumed: verify, owner D1] An owner with a verified, effect-resolved backup can answer one fact-bound recovery question and proceed through fresh authorization, without restoring old grants, trusting old passing evidence or replaying an uncertain effect.

Verification: corrupt a scratch repository's primary state, inspect the recovered preview, confirm the unchanged facts, then prove that work still needs fresh authorization and checks. Unknown accounting or ownership must prevent confirmation. Outcome score: 3, conditional on D1-D3 approval.

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
| Reactivating prior grants/consents | Recommended exclusion, not decided; D1 controls |
| Changing NODE_OPTIONS, configuring commands or adding host transport | Independent owner gate / RC1 / RC5 |
| Complete effective configuration graphs and aggregate retention | Separate RC1 work; unsupported revalidation refuses |

### Scope Dependencies

[Validated: TS Sections 7.3/7.4] Accounting must be verified and process/effect ownership settled before confirmation. OUT [depends-on: effect/process reconciliation when unresolved; status: incomplete]. This feature must refuse those cases, not close their requirements.

[Unknown: TBD, owner D2 before implementation] The exact supported revalidation manifest must be reviewed. If current restrictions or required candidate inputs cannot be admitted, no confirmation is offered. A partial loader is not proof of complete restriction revalidation.

### Open Scope Tensions

The canonical phrase "grants suspended until reconfirmed" permits a reading that old grants return. This proposal instead requires fresh grants. D1 must resolve that product meaning before the mechanism is approved; the draft does not amend the canonical phrase.

## 3. Acceptance Criteria

All proposed criteria have score 3. Test paths name existing homes; no new tests for this feature are claimed. The owner validates all proposed behavior before implementation.

| ID | Type | Binary criterion / example | Test owner | Score | Status |
|---|---|---|---|---|---|
| AC-1 | Behavioral | Verified fallback, no unresolved effects/processes, valid sources: one recovery question names the recovered revision, lost authority/evidence and required fresh authorization. No effect executes while presenting it. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Assumed: verify] |
| AC-2 | Edge | Unknown accounting, conflicting checkpoints, missing process identity, live process or unresolved effect: no actionable confirmation; current diagnostic/refusal remains and records do not change. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/execution-envelope.test.ts` | 3 | [Validated: TS Sections 7.3/7.4] |
| AC-3 | Behavioral | Confirm an unchanged preview: one transaction validates the binding, preserves recovered counters/sequences, and exits diagnostic suspension without restoring grants/consents. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Assumed: verify, D1] |
| AC-4 | Edge | Change a bound primary/backup/journal record, workspace identity, candidate file or policy/restriction source after preview: old confirmation cannot publish or grant authority; a refreshed preview or existing refusal is returned. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Assumed: verify, D2/D3] |
| AC-5 | Negative | Passing receipts, baseline matches, review completion and cached endpoints from the backup cannot satisfy finish after confirmation; their records remain inspectable as stale history. Locked files are not unlocked. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/contract.test.ts` | 3 | [Assumed: verify]; [Validated: TS Section 14 revalidation] |
| AC-6 | Negative | Confirmation performs zero project writes, Git mutations, child launches, installs, network actions or budget resets, and never reconstructs a lost contract from accounting. Unsupported current restrictions/configuration refuse. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Assumed: verify]; [Validated: pipeline/accounting boundaries] |
| AC-7 | Reliability | Kill at each journal/backup/state publication boundary: a valid recoverable snapshot remains; retry cannot clear unknown accounting or duplicate an effect. | `packages/kernel/test/backup-accounting.test.ts`, existing crash fixtures | 3 | [Assumed: verify] |
| AC-8 | Edge | Wait/decline or an identical retry cannot activate authority, spend a new attempt or overwrite the diagnostic history. A successful duplicate answer cannot repeat recovery publication. | `packages/kernel/test/backup-accounting.test.ts` | 3 | [Assumed: verify] |
| AC-9 | Security | Excluded/secret content and raw grant payloads are absent from question text; identifiers/hashes and literal kernel status are used. Answer provenance is chat, never an agent-written summary. | `packages/kernel/test/backup-accounting.test.ts`, `packages/kernel/test/authority.test.ts` | 3 | [Assumed: verify]; [Validated: authority/privacy constraints] |
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
| Reconfirmation | Proposed acknowledgment of one revalidated recovered snapshot; D1 determines authority consequences |
| Binding | Kernel-computed identity of the exact facts being confirmed, rechecked inside the publishing transaction |
| Stale history | Retained evidence whose previous pass/authorization cannot satisfy current work |

### Decisions Already Made

| Decision | Source / rationale | Annotation |
|---|---|---|
| One question, not silent continuation | Plan C0 triage; minimize recovery ceremony without suppressing uncertainty | [Validated] |
| Diagnostic-only unknown accounting | TS Section 7.3; unknown usage/ownership cannot yield editing authority | [Validated] |
| Kernel owns verdict, budgets and facts | Architecture rules; frontends ask/explain only | [Validated] |
| No reconfirmation kind is implemented today | TS Section 7.3 and current code; this draft cannot be invoked | [Validated, 2026-10-24 source review] |

### Dependencies

| Dependency | Status | Owner / blocking condition |
|---|---|---|
| D1 authority meaning | Unresolved | Repository owner, before mechanism review |
| D2 revalidation/binding manifest | Unresolved | Technical/security owner, after D1 and before implementation |
| D3 public decision/question contract | Unresolved | Owner/UX reviewer, after D2 and before implementation |
| Independent review and sign-off | Not performed | Fresh-context reviewer or owner; no self-approval |
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

Worst misinterpretation: "confirm recovery" is not "authorize all previous actions." AC-3/5/6 require empty effective authority and unusable old evidence under the recommended reading. An unknown process is not dead because its contract is absent.

## 6. Ambiguity Audit

| ID | Question | Resolution / owner / deadline |
|---|---|---|
| D1 | Restore prior grants or require fresh authorization? | Recommend fresh authorization. [Unknown: TBD, repository owner before review of mechanism] |
| D2 | What exact sources and snapshot identity are revalidated/bound? | Must include ownership/schema, backup and journal identities, accounting high-water facts, effect/process state, current restriction/policy sources and candidate identities needed to invalidate evidence. Exact manifest and supported-source refusal matrix need review. [Unknown: TBD, technical/security owner before implementation] |
| D3 | Which question/decision fields and stale/retry responses expose confirmation? | Candidate below; existing closed vocabulary remains unchanged. [Unknown: TBD, owner/UX reviewer before implementation] |

Zero-Question Score: 3 blocking decisions; all have owners and deadlines expressed as lifecycle gates, not invented calendar commitments. Draft only, not an implementation handoff. Resolve one decision at a time, starting D1.

## 7. Implementation Guidance

[Assumed: verify, D3] Candidate API: add one workspace-scoped `recovery-confirm` decision and question only after approval. Preview options are `resume` and `wait` (recommended). Candidate answer uses the existing `decide` body with `kind`, `answers` and `propose: { factsHash }`; no stale work handle is authority to confirm workspace recovery. This vocabulary does not exist yet and must not be added to skills before implementation.

[Assumed: verify, D2/D3] Read-only views can describe recoverable facts but cannot publish a pending question. Before implementation, prove how the existing pipeline persists or validates the binding without turning a rendered preview into authority. Hashes are change detectors, not owner authentication or filesystem snapshot isolation.

[Assumed: verify, D1/D2] After acceptance, publish the revalidated snapshot with the recovery marker cleared; retain budget/sequence high-water marks and provenance, leave grants/consents empty, invalidate baseline/evidence/review completion and cached responses, and retain locks. Retained records need an explicit stale representation; if existing schemas cannot express this, review the schema change rather than deleting historical facts.

Risks: unsupported restriction sources (H impact; refuse), stale/concurrent approval (H impact; transactional binding), last-good-copy loss on crash (H impact; killed-step tests), semantic overclaim (H impact; D1 gate). No implementation estimate is asserted before decisions/review.

Checkpoints: D1 disposition; D2/D3 review; independent findings; owner sign-off; red-first implementation; focused/full gates; two-runtime UAT; canonical backfill and archival. None of these review/approval steps has happened through drafting.

## Open Tensions

**D1:** Reinstating grants is convenient but may reactivate stale scope. Recommend fresh authorization; owner decides before D2. Rejected as a default: silently restoring serialized grants.

**D2:** A complete revalidation promise exceeds the current effective-input graph implementation. Recommend explicit supported sources with refusal for unavailable closure; technical/security owner must approve the manifest before implementation. Refusal does not complete unsupported configuration requirements.

**D3:** One question must remain genuinely bound without letting a read-only preview mutate state or a model-written response authorize recovery. Recommend reuse of the pipeline's decision mechanism, not a new frontend approval store; review transport and response vocabulary before implementation.

Alternative: keep diagnostic-only behavior indefinitely. It is the current safe fallback, not completion of the planned one-question recovery workflow.

## Assumption Registry

| Assumption | Confidence / evidence | Invalidation signal |
|---|---|---|
| Fresh authorization matches intended reconfirmation meaning | M, recommendation only; D1 unresolved | Owner expects validated prior grants restored |
| Supported-source revalidation can be narrowly specified | M, current loaders exist but graph closure remains incomplete | A required source cannot be safely identified or admitted |
| Existing question/decision pipeline can carry the binding | M, other bound decisions exist; workspace recovery path unproved | Binding requires an unreviewed state/transport mechanism |

All three assumptions require owner/reviewer validation before execution; none is resolved by this document.

## Adversarial Self-Critique

1. The recommended authority meaning may not match the canonical wording. Implementing it before D1 would silently narrow behavior. Watch for automatic grant restoration or claims that this draft settles D1.
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