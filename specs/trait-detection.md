# Specification: Project and change trait detection (QLT-11)

> Status: Behavior contract and QLT-11 schema 2 addition signed off by owner (2026-10-31). Implementation remains blocked on independent review, budget measurement and final sign-off of the complete schema 1 → 2 migration design. Date: 2026-10-31.
> Sources: PRD §§3.8.4–3.8.5, QLT-11, AC-20; Tech Spec §§8.2, 8.7, 12.9 and 13.

## 1. Outcome

Tenet proposes project traits from inspected repository evidence and change traits from the planned change. It records the evidence and uncertainty, allows the user to correct the proposal, and makes a missed applicable trait found during review a finding. Trait composition is conservative: project traits retain regression obligations, change traits add design and specialist work, and uncertainty never silently removes an obligation.

Trait detection does not create a support claim, infer user intent, or let an agent change kernel-owned traits or verdicts.

## 2. Current state

- `State.project.traits` is an unannotated `string[]`. It can raise risk dimensions, but it has no inference, evidence, status, correction provenance or change-trait counterpart.
- `open` receives predicted scope paths and caller-supplied risk signals. These are not a kernel-observed planned diff and do not establish trait applicability.
- The Tech Spec describes a static trait registry (`traits/<name>.json`) with path/dependency applicability and contributions, but no such registry exists in the repository.
- Review results and findings have no typed missed-trait representation. A reviewer can report ordinary findings, but the trait gap is not part of its declared review contract.
- The PRD requires unknown possibly-applicable traits to be disclosed and treated as applicable for the verdict.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| TD-1 | Project-trait proposals are derived only from inspected, bounded repository evidence and the versioned static trait registry. | QLT-11; Tech Spec §§12.9, 13 |
| TD-2 | Before each check, the kernel captures the candidate diff from the contract-start snapshot to the current project tree and derives change-trait proposals from that observed diff, not solely from caller-provided scope or model classification. | QLT-11; PRD §3.8.5 |
| TD-3 | Each proposal records its scope, evidence references, registry version and a safe registry-owned reason identifier; unavailable evidence is explicit, and the registry maps reason identifiers to static explanation templates. | EVD-01–04; QLT-11 |
| TD-4 | The user can correct proposed traits through an existing decision/pipeline path. A correction is bound to the project evidence and work/plan revision it addresses; stale corrections do not silently apply to changed evidence. | QLT-11; INT-08; PRD §3.8.5 |
| TD-5 | Project traits contribute regression obligations; change traits add only their declared design, specialist and check obligations. Equivalent obligations are deduplicated only when equivalence is proven. | PRD §3.8.5 |
| TD-6 | A possible trait that cannot be resolved is disclosed and its potentially applicable obligations remain in the verdict. | PRD §3.8.5 |
| TD-7 | A reviewer who finds an applicable trait missing from the recorded set submits a finding; reviewer output cannot directly mutate traits, obligations, receipts or verdict. | QLT-11; AGT-02; EVD-07 |
| TD-8 | A changed trait proposal or correction invalidates dependent evidence and causes the lane and obligations to be reevaluated before further checks or finish. | PRD §3.8.5 |
| TD-9 | The static registry explicitly declares supported traits, inference signals, contributions and applicability rules; unknown names and malformed entries fail closed. | Tech Spec §13 |
| TD-10 | A change with `auth`, `persistence`, `personal-data` or `external-effects` records a short threat-and-data note; each security item becomes a test or constraint. | QLT-13; PRD §5.9.3 |
| TD-11 | For each changed flow carrying `ui`, the selected obligations cover every state in PRD §3.8.4; screenshots are presentation/evidence only as separately qualified. | QLT-14; PRD §§3.8.4, 3.8.5 |

## 4. Proposed behavior and examples

| Example | Expected behavior | Test |
|---|---|---|
| E1: repository evidence contains an explicit supported authentication marker | The kernel proposes the `auth` project trait with the inspected path and evidence identity; it does not infer a support claim. | `packages/kernel/test/traits.test.ts` |
| E2: repository evidence is insufficient to decide whether `personal-data` applies | The result records the trait as unknown, names the missing evidence, and keeps its potentially applicable obligations in the verdict. | `packages/kernel/test/traits.test.ts` |
| E3: a planned change touches an API route in a project whose `auth` project trait is already present | `auth` regression obligations remain; change-trait work is selected only by the change evidence and registry, not merely by the project trait. | `packages/kernel/test/traits.test.ts` |
| E4: a user corrects a proposed project or change trait | The kernel records the correction with its bound evidence and revision. Repeating the same decision is idempotent; a changed binding requires a new decision. | `packages/kernel/test/trait-decisions.test.ts` |
| E5: the planned change changes after a trait decision or receipt | The old correction/evidence is stale; dependent obligations and receipts cannot be reused until reevaluated. | `packages/kernel/test/traits.test.ts` |
| E6: a reviewer identifies an applicable trait missing from the recorded proposal | The reviewer submits a typed or otherwise unambiguous finding linked to evidence. The kernel records it as a finding and does not let the reviewer relabel trait state. | `packages/kernel/test/trait-review.test.ts` |
| E7: two traits declare the same check obligation with the same identity and contract | The obligation appears once with all trait sources retained; a merely similar check is not deduplicated. | `packages/kernel/test/trait-composition.test.ts` |
| E8: a registry entry has an unknown trait name, malformed signal, undeclared reason ID or obligation | Registry admission refuses the entry before it can affect a work contract or verdict. | `packages/kernel/test/traits.test.ts` |
| E9: an entry declares complete evidence coverage for the supported profile and every required input is safely inspected, but no signal matches | The result records `not-indicated` with the coverage and inspected evidence identity; that trait's obligations do not apply to this profile. It does not claim that the trait is impossible in general. | `packages/kernel/test/traits.test.ts` |
| E10: an entry declares partial coverage, a required input is unreadable, or evidence is ambiguous | The result records `unknown`, states why, and keeps potentially applicable obligations in the verdict. | `packages/kernel/test/traits.test.ts` |
| E11: a trait is added to a project, then a later change touches a different file | The trait's project invariants remain obligations for the later work; a prior project correction remains valid if its registry and relevant evidence identities still match. | `packages/kernel/test/traits.test.ts` |
| E12: a project and its change both carry the same trait | Project regression obligations remain, and change-specific obligations are added once where exact equivalence is proven. | `packages/kernel/test/trait-composition.test.ts` |
| E13: a changed flow carries `ui` | Its selected obligations cover empty/loading/success/error/invalid-input/repeated-submission/permission-denied states, keyboard focus and scoped WCAG 2.2 AA journeys; screenshots are tied only to confirmed examples. | `packages/kernel/test/trait-composition.test.ts` |
| E14: a `persistence` change is detected | Its declared contribution includes invariant/transaction checks, prior-version migration, backup/restore, restart persistence and busy/lock behavior. | `packages/kernel/test/trait-composition.test.ts` |
| E15: `auth`, `personal-data`, `public-api` or `external-effects` applies | Its declared security, privacy, compatibility or effect obligations are included as listed in PRD §3.8.4; trait presence alone does not claim those obligations passed. | `packages/kernel/test/trait-composition.test.ts` |
| E16: `background-jobs`, `i18n`, `cli` or `library` applies | Its declared schedule/retry, locale, CLI contract or public API/package obligations are included as listed in PRD §3.8.4. | `packages/kernel/test/trait-composition.test.ts` |
| E17: `auth` + `public-api` + `persistence` apply together | One composed review sees the cross-cutting interaction; only identical check obligations with the same execution contract are deduplicated, and conflicting requirements are escalated. | `packages/kernel/test/trait-composition.test.ts` |
| E18: a detector recognizes only some evidence for a trait, or the project is outside its supported profile | It cannot return `not-indicated`; the result reports `unknown` and does not claim the unsupported trait/profile is covered. | `packages/kernel/test/traits.test.ts` |
| E19: a project appears to use an R2 trait (`data-pipeline`, `infra`, `ml` or `mobile`) | R1 does not claim a complete detector or conformance for that trait; it discloses the deferral and does not treat the trait as disproven. | `packages/kernel/test/traits.test.ts` |
| E20: a change carries `auth`, `persistence`, `personal-data` or `external-effects` | Record a short note naming actors/trust boundaries, protected objects/operations, sensitive data/retention, and abuse cases. Every security item is linked to a test or constraint; an unlinked item remains open. | `packages/kernel/test/trait-threat-data.test.ts` |
| E21: a change trait first appears in the candidate diff after `open` and raises the lane floor | Before any check launches, the kernel recomputes the lane, reports the raised floor and applies the existing review/consent gates; no check or receipt precedes that decision. | `packages/kernel/test/traits.test.ts` |
| E22: a migrated work has a legacy basis-trait snapshot, then current project trait evidence changes | The legacy snapshot remains inert historical data. Typed trait state alone determines current risk/obligations; dependent evidence is invalidated and recomputed before further checks/review/finish, without a basis reconfirmation solely for the trait change. | `packages/kernel/test/traits.test.ts` |

## 5. Proposed contract and alternatives

### Recommended contract for review

1. **One static registry is authoritative.** Each R1 entry declares its canonical trait ID, project evidence signals, change evidence signals, supported profile, evidence requirements, coverage (`complete` or `partial`), registry-owned reason identifiers mapped to static templates, obligations, questions, review rubric items and change-only lane/risk contributions. Persist only reason identifiers, never arbitrary free text, source text, model output or user quotes. Project traits contribute regression obligations but never raise lane risk. Registry entries are versioned with the shipped Tenet build; no runtime discovery or arbitrary user code is allowed. The R1 supported set is `ui`, `persistence`, `auth`, `personal-data`, `public-api`, `external-effects`, `background-jobs`, `i18n`, `cli` and `library`. `data-pipeline`, `infra`, `ml` and `mobile` remain R2 and are explicitly disclosed as deferred rather than reported as absent.
2. **Evidence, not model judgment, establishes a positive.** Supported signals are deterministic repository facts such as a declared dependency, a checked-in manifest, a recognized route/schema marker, or a path in the kernel-captured candidate diff. A signal must be declared in the registry and tested. A coordinator may explain evidence but may not create a positive trait without it.
3. **Project and change evidence are separate.** Project evidence is inspected from the repository snapshot and describes continuing invariants. Before each check, the kernel captures the candidate diff between the contract-start snapshot and the current project tree; change evidence is computed from that exact diff and adds only change-specific work. The diff identity includes changed paths and their before/after content identities. Caller scope paths and free-text descriptions may guide inspection but are not proof. Recompute the candidate diff before each later check, review and finish; if it changes, re-resolve traits and invalidate dependent evidence before acting. Paths whose ownership or contents cannot be safely inspected remain unknown, not absent.
4. **Represent three outcomes:** `present`, `not-indicated`, and `unknown`. A `not-indicated` result is allowed only if the registry declares complete evidence coverage for the supported profile and every required input was safely inspected with no matching signal. It excludes that trait's obligations only within the declared profile and does not claim the trait is impossible in general. Partial coverage, unsupported profiles, unavailable inputs and ambiguous evidence yield `unknown`; its possible obligations remain verdict-relevant as the PRD requires.
5. **Corrections are explicit, not inferred preferences.** A project correction records the trait, selected outcome, registry version and hashes of the inspected evidence relevant to that trait. It persists across work generations while those facts match and becomes stale when relevant project evidence changes. A change correction additionally binds to the current work generation, intent/plan revision and captured candidate-diff identity. A changed binding requires a new user decision; no stale correction is silently carried forward. The work binding pins the resolved project trait-state identity, including current assessment outcomes and corrections, not only raw repository evidence; changing a project correction therefore invalidates dependent work evidence without requiring basis reconfirmation.
6. **The kernel owns resolution.** The pipeline produces the proposal and binding identity, the existing decision mechanism records the user's correction, and the kernel recomputes obligations/lane and invalidates dependent receipts. Only change traits matched to the candidate diff contribute `raises`; project traits do not raise the lane. If the check-time diff reveals a new risk-raising trait after `open`, the kernel recomputes and enforces the floor before any check starts. Reviewers can submit missed-trait findings with evidence, but cannot write trait state.
7. **Composition preserves provenance.** Obligations with identical canonical obligation IDs and identical execution contracts are represented once with all contributing traits. Similar names or different populations/configurations remain separate. Conflicts follow the existing normative-choice path.
8. **Basis trait snapshots are historical.** A schema-1 `basis.traits` list is retained as inert `basis.legacyTraits`. New basis records do not copy trait names; the typed work trait state is the sole current authority. A trait-state change invalidates dependent trait evidence and receipts, but does not by itself require a new basis confirmation.

This draft deliberately leaves concrete per-trait signal definitions and the final persisted schema/migration strategy to detailed design, constrained by the complete/partial coverage rule above. No detector may claim complete coverage until its evidence domain and negative cases are enumerated and tested. QLT-13 notes are required for every change carrying any of the four named traits; all four cases must be tested, including when traits compose.

### Tech Spec §13 reconciliation (owner approved 2026-10-31)

The existing static `traits/<name>.json` contract remains authoritative. Its `applies` field continues to describe change evidence. The owner approved a distinct `projectApplies` evidence declaration for project-level inspection, plus `supportedProfile` and `coverage` (`complete` or `partial`) metadata. Complete coverage permits a no-match `not-indicated` only for the declared profile and safely inspected evidence; partial, unsupported, unreadable or ambiguous cases resolve to `unknown`. Registry entries remain statically registered, versioned and tested; no runtime discovery or user executable code is introduced. The Tech Spec §13 registry row has been amended accordingly.

### Alternatives considered

| Approach | Benefits | Costs / reason not recommended |
|---|---|---|
| Model-only inference from repository text and task description | Broad apparent coverage with little registry work | Not reproducible, weak evidence provenance, difficult to bind corrections, and risks silently changing obligations. |
| Ask the user to enumerate every project and change trait manually | Simple detector and no false-positive inference | Does not satisfy the explicit inference requirement and transfers ongoing classification work to the user. |
| Deterministic evidence-backed registry with explicit unknowns (recommended) | Reproducible, reviewable, testable, and fail-closed when evidence is unavailable | Requires bounded evidence signals and an explicit state/correction contract; may disclose many unknowns until the registry is complete. |

## 6. State, compatibility and impact

- The implementation replaces the unannotated `State.project.traits: string[]` with evidence-backed state, adds per-work change assessments and correction provenance, and preserves prior strings as inert legacy data. The owner approved schema 1 → 2 for trait state alongside configuration-evidence binding, including the proposed state shape and conversion in `schema-migration.md` §16.2.1. Independent review, budget measurement and final sign-off of the complete migration remain pending; no schema/runtime code is authorized here. Migration review must cover legacy handling, versioning, upgrade, rollback and compatibility.
- `open`, basis/intent revision, planned-diff inspection, checks, review submission, `inspect why`, finish/verdict, budget accounting and recovery may all consume or invalidate trait evidence. The implementation review must map every consumer before changing shared state.
- Registry obligations affect execution, review rubric, lane floor and verdict. Traits must not discharge existing acceptance tests or override protected-path, exclusion, consent, budget or assistance-level controls.
- The R1 mapping report must change only after a regression proves the complete applicable QLT-11 behavior; a registry-presence or prompt-only test is insufficient.

## 7. Risks and assumptions

- Path and dependency signals can under-detect behavior implemented through indirection, generated code, framework conventions or unrecognized languages. Unknown disclosure and conservative obligations are required; no detector may claim completeness from a path match alone.
- Trait composition can multiply checks and cost. The registry needs stable obligation identities, explicit populations and proven-equivalence rules; it must not deduplicate on labels alone.
- Evidence identity and migration are coupled. Corrections must not survive changed evidence by accident, and historical unannotated trait strings cannot be promoted into verified inference.
- Reviewer findings are advisory inputs until accepted through the normal kernel path. Reviewer presence is not proof that every missed trait will be found.
- Native-host review behavior and model adherence remain unobserved until a separately authorized host campaign.

## 8. Acceptance criteria and gates

Before implementation:

1. Independent review produces findings with dispositions.
2. Owner resolves any remaining behavior and registry choices and signs off this spec, including the proposed Tech Spec §13 amendment.
3. Before implementation, independently review and obtain final owner approval for the complete schema 1 → 2 design. The owner approved the QLT-11 trait-state representation and lossless-but-inert conversion of legacy strings on 2026-10-31; remaining migration sections, budget fit and integration must still pass their gates. This is a hard pre-implementation gate, not permission to improvise migration during coding.
4. Implementation begins red-first with the examples above and follows existing pipeline, state ownership and migration rules.

Implementation is complete only when all examples pass, the complete relevant caller/consumer set is covered, `npm run ci` passes, and built-bundle scratch UAT confirms evidence-bound proposals/corrections and conservative unknown handling. Update PRD/Tech Spec/UX wording only where the approved contract changes them. Do not claim host qualification or QLT-11 qualification from local tests.

## 9. Independent review and dispositions (2026-10-31)

Fresh-context review found four blockers and one contract-alignment issue. Dispositions:

| # | Finding | Disposition |
|---|---|---|
| 1 | Binding all corrections to a work generation makes a project-trait correction stale on the next contract; project and change corrections need different lifetimes. | **Accepted; owner selected separate bindings (2026-10-31).** Project corrections bind to registry version and relevant evidence hashes across work generations; change corrections also bind to the current work/plan and observed diff. |
| 2 | “Kernel-observed planned change” has no defined artifact or lifecycle, so it is unclear when change obligations become available before checks. | **Accepted; owner selected captured candidate diff (2026-10-31).** Before each check, derive change traits from the contract-start-to-current tree diff; bind to its identity and recompute/invalidate when it changes. `scopePaths` remain hints, not proof. |
| 3 | `not-indicated` is described as not proving absence, but its effect on possible obligations is unspecified. | **Accepted; owner selected complete-coverage rule (2026-10-31).** Only a complete, safely inspected, in-profile detector may exclude trait obligations after no match; otherwise result is `unknown` and possible obligations apply. |
| 4 | Examples do not pin the required trait effects, cross-cutting review, or supported R1 trait subset. | **Accepted; revised in §§4–5.** Add contribution examples for the ten R1 traits, cross-cutting review, and explicit R2 deferrals. |
| 5 | Project-evidence signals extend Tech Spec §13, whose `applies` contract is change-oriented. | **Accepted; owner approved (2026-10-31).** §13 now keeps `applies` for candidate-diff signals and adds `projectApplies`, supported-profile and coverage metadata with conservative unknown semantics. |
| 6 | QLT-13's threat-and-data note and test/constraint trace are missing from the trait effects. | **Accepted; revised in §§3–4.** Require the note for every change with the four named traits and test each trait's note plus security-item disposition. |
| 7 | The state migration disposition is unclear and could block feature-spec sign-off. | **Accepted; separated as a pre-implementation gate in §§6 and 8.** Product behavior may be signed off, but migration/legacy-trait handling must receive its own reviewed owner approval before any code implementation. |
| 8 | The scope of trait `raises` is unspecified and conflicts with Tech Spec §8.2's change-only risk signals; current `open` passes project traits to risk assessment. | **Accepted; owner selected change-only risk (2026-10-31).** §8.2 and the registry contract now clarify that project traits retain regression obligations but do not raise the lane; check-time change traits recompute the floor before execution. Correct the existing implementation only after feature-spec sign-off and migration approval. |
| 9 | The prior schema 1 → 2 approval covered configuration binding only; QLT-11 needs persistent trait assessments and corrections. | **Accepted; resolved by owner (2026-10-31).** Include trait state in schema 2. The owner approved the record shape and legacy conversion in `schema-migration.md` §16.2.1; independent review, exact-budget measurement and final sign-off of the complete migration remain required before implementation. |

**Review outcome:** the owner decisions resolve findings 1–3 and 8; the revised examples address findings 4 and 6; findings 7 and 9 are assigned to a separate pre-implementation migration gate; the owner approved finding 5 and Tech Spec §§8.2 and 13 are reconciled.

Fresh review of the behavior spec pair (2026-10-31) found no significant issues and confirmed the risk-scope decision and prior dispositions. The owner signed off the QLT-11 behavior spec and the trait-state addition to schema 2. Independent review, budget measurement and final sign-off of the full migration remain hard gates before implementation.
