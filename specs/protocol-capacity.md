# Configuration/migration capacity proposal

Date: October 29, 2026. **Proposal only; independent capacity review complete, implementation/budget sign-off pending.**

## 1. Outcome and authority

The owner selected **"Bounded simplification and complete sizing (Recommended)"** after the [independent protocol review](../docs/audits/2026-10-29/protocol-review.md). That authorizes investigation and a sign-off proposal, not runtime refactoring, cap changes, schema activation or another reviewer.

**Result:** two small source consolidations save **180 non-whitespace characters** and **302 bundle bytes** in an in-memory candidate. They do not establish a credible within-cap path for the full protocol. An explicit, reviewed budget proposal is more useful than implementing these small consolidations just to postpone the same decision. Do not remove required safeguards or move code outside measured owners to obtain room.

The complete responsibility inventory below produces a **planning estimate**, not measured target code: **43,290-72,160 net added source characters** after those candidates. Five existing owners exceed their current ceilings in both scenarios. Bundle scenarios span **802,488-819,676 bytes** against 819,200; neither a guaranteed fit nor a measured 476-byte deficit follows.

This is a capacity proposal, not a replacement for the configuration/migration contracts. Settled D1-D8/MC/R1/R2 policies stand. [Configuration sections 14, 16, 18 and 20](config-completion.md), [migration sections 16 and 18](schema-migration.md), and approved [migration closure](migration-closure.md) remain the mechanism inputs. R08 remains deferred. No new product policy is selected.

## 2. Baseline and measurement

Baseline: local `main` at `8b7bbc4190fc76599b51e1fcfe50f23947a2963c` plus preserved uncommitted changes, exactly the source identified by [reassessment-validation.json](../docs/audits/2026-10-29/reassessment-validation.json). Source hash `d77aff0043399b0b10677a72020d12ff2c8c7aad67a8ffffff2d4e4d851e9c85`; runtime source is unchanged by this proposal.

Use the existing `measure`/`budgetChars` exports in `tools/lint-quality.ts:17-34,73-99`. Counts include comments and remove whitespace exactly as that gate does. Existing paths remain in their current matched owners. No cap/baseline is rewritten.

| Existing owner | Measured used | Ceiling | Free |
|---|---:|---:|---:|
| core/schemas | 26,863 | 26,899 | 36 |
| pipeline + verbs + decisions | 241,796 | 241,805 | 9 |
| adapters/store-fs | 24,920 | 25,920 | 1,000 |
| core/budget | 8,585 | 8,640 | 55 |
| adapters/runner | 9,928 | 20,160 | 10,232 |
| core/review | 16,981 | 20,160 | 3,179 |
| core/verdict | 12,549 | 17,280 | 4,731 |
| adapters/git-cli | 37,801 | 37,843 | 42 |
| adapters/node-ts | 17,929 | 20,160 | 2,231 |
| core/risk | 4,779 | 8,640 | 3,861 |

Kernel bundle: **776,837/819,200 bytes**, **42,363 free**, SHA-256 `77378e987b04abbe05799d064b425d15716c7698af87865d246895b3a3093ecb`. An independent in-memory esbuild with the production options reproduces those exact bytes before candidate overrides.

The coordinator is **3,999/4,000 tokens**, not the historical 3,892: measure the current normalized front-matter-free `plugin/skills/tenet/SKILL.md` body with `ceil(length/4)`, matching `tools/lint-skills.ts:11-17,37-47,74-84`. Historical spare tokens are not current capacity.

## 3. Bounded simplifications considered

All candidates were string transformations **in memory**, never installed into the working tree. esbuild used `write:false`; the shipped bundle was not replaced. No candidate child/host execution, refactor test suite or whole-program equivalence is claimed.

### S-A: share the seven identical basis-input field schemas

In `core/schemas.ts:430-441`, reuse `BasisElement.shape.kind`, `.origin`, `.of`, `.test`, `.expect`, `.testFile`, `.outputs` instead of redeclaring those identical validators. Leave input-only `ref`, bounded `text` and the stricter bounded `support` unchanged. Field ordering and the existing input object wrapper remain unchanged; no schema is made stricter or looser.

Measured owner size: **26,863 -> 26,736**, saving **127**; resulting headroom **163**. The candidate input JSON Schema matches the current one after canonical key ordering. **61** selected parse samples match acceptance, parsed data and diagnostics, including invalid values, absent/null fields and unknown-key stripping. These probes are not exhaustive consumer tests.

Recommendation: reasonable only as a reviewed contract-deduplication change, not as the capacity solution. Its future coupling is deliberate: changing a shared field must consider both persisted basis and input semantics.

### S-B: one local unrun-result constructor

`verbs/check-execute.ts:30,42,52` contains three exact copies of:

```ts
return { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, ran: false };
```

Candidate: a local `notRun(ports: Run["ports"]): Omit<RunFacts, "after">` constructor with that object and three call sites. Do not change the separate top-level empty-selection result, clock timing, report paths or return fields.

Measured file size: **3,469 -> 3,416**; central owner **241,796 -> 241,743**, saving **53**, headroom **62**. The helper adds indirection for little gain. Do not implement it solely to manufacture capacity. It preserves today's known EADDRINUSE observation loss; that defect is separately corrected by launch accounting, not concealed by a refactor.

The combined S-A/S-B in-memory bundle measures **776,535 bytes**, saving **302**; candidate SHA-256 `0e8c89fb785554a41323a16a8fb7b61f6cc142971f2ce0aa1b21a3240bdfdc0f`. This is a compilation measurement, not an installed artifact or target-protocol forecast.

### S-C: coordinator prose consolidation

Six possible wording changes shorten output/exits, truth rules, check-ins, Deep estimates and envelope consent without intentionally removing a control. For example, replace "Output is one JSON object; the process exit code equals its `exit`" with "Output: one JSON object; process exit = `exit`."

Measured body saving: **356 characters**, **3,999 -> 3,910 tokens**. A draft **355-character** addition including the two proposed migration decision names and minimal config/migration guidance brings the model back to **3,999 tokens**:

> Config: show the interpreted difference. Ask; confirm repeats the whole proposal with the returned question ID; decline is answer-only. Saving grants no execution or proof. Migration: require its fresh preview and explicit answer; never infer consent. Completion history is not current proof. Stop on uncertainty.

This is still only one token of headroom. It demonstrates a possible fit, not a finished or independently reviewed instruction set. Actual final wording, both lints, command closure and loaded-context totals must pass. Do not install future decision names before their registry/consumers exist. Prose savings are not kernel source-budget savings.

The guidance/registry addition is conditional on **all six** paired prose reductions. Adding it alone models **4,088 tokens**, exceeding the cap by **88**. If any reduction is withheld or changed, remeasure the whole body; never adopt the addition independently or treat a subset as equivalent capacity.

## 4. Complete target responsibility inventory

**Method:** additive engineering estimates by nonoverlapping responsibility, rounded to hundreds except the three small Git call sites. They estimate added source after normal reuse/replacement; no speculative deletion credit is taken. S-A/S-B savings are subtracted once at the owner rollup, not from individual rows. Ranges are neither statistical intervals nor guaranteed bounds. The row list is a coverage inventory, not evidence that the final design is fully specified.

Measured scale anchors: `core/budget.ts:108` checkpoint **706** characters and `:121` recovery **2,439**; `verbs/reconcile.ts:20` reconciliation **2,532**; `pipeline-mutate.ts:191` launch guard **568** and `:207` result publication **1,072**; `verbs/check-evidence.ts:155` accounting **1,080**; `adapters/store-fs.ts:233` acquisition **1,053**, `:392` publication **781**, `:533` reduction **1,151**; `adapters/runner.ts:28` ownership write **555**, `:130` execution **2,744**, `:187` stop **1,540**. These ground the scale of the estimates; no formula converts them into proven implementation bounds.

| ID / existing owner | Required additions, retaining existing checks | Estimated characters |
|---|---|---:|
| S1 schemas | Strict stamps, structured Work/Job/Launch/Effect keys, safe counters and exhaustion validation | 1,200-2,000 |
| S2 schemas | Exact launch union, job settlement/association representation, complete recovery and versioned checkpoint | 1,600-2,600 |
| S3 schemas | Transition/reference inventory, ordered phases, deletion metadata and strict five-key terminal | 1,800-3,000 |
| S4 schemas | Raw version/source decoding before stripping; nine effect variants, cached-response producer classification/refusal and finite upcast | 2,500-4,000 |
| C1 central | Single/batch proposal validation, scope/reset rules, D2 confirmation, D6 subset, interpreted readback | 3,000-5,000 |
| C2 central | All-work refresh, shared reconciliation, read-only view, pre-cache/config-specific identity and publication | 1,800-3,000 |
| C3 central | Job allocation, each ordinal, bounded acknowledgment, ledger settlement before result discard | 2,200-3,600 |
| C4 central | Tests/static/e2e/rerun/port retries capture context; stale finalize preserves observations without proof/attempt credit | 1,800-2,800 |
| C5 central | Review/Analyst packet identity, manifests, reservation/retry/parent admission, findings and stale delegation settlement | 1,200-2,000 |
| C6 central | Issued commit/integration context, normal and recovered completion versus current proof, including `verbs/recover-effects.ts` SETTLE/PUBLISH wiring | 1,200-2,000 |
| C7 central | Stop/recovery traverse every retained association/ordinal; distinguish settled, known later and uncertain units | 1,200-2,000 |
| C8 central | Workspace migration/rollback dispatch, diagnostics/settings/inspection, target recovery-set forgetting wiring | 1,800-3,000 |
| A1 store | Stable bounded no-follow source capture, quiescence, finite edges, reserve calculation and previews | 3,000-5,000 |
| A2 store | Fence/copy/stage/install, directory sync, exact-prefix recovery, pristine rollback, terminal replay | 3,500-5,500 |
| A3 store | Every-writer forfeiture, recovery-set pins/accounting horizon, explicit deletion and forgetting extension | 2,200-3,800 |
| B1 budget | Contiguous settlement, known-later diagnostics, issuance floors, complete recovery checkpoint/high-water recovery | 2,800-4,800 |
| R1 runner | Explicit check/operation domains, bounded spawn handshake, durable ordinal process ownership and complete stopping | 2,000-3,500 |
| V1 review | Full/focused/partial/recheck/Analyst/Deep binding predicates, issued stamps on links, no stale parent shortcut | 900-1,600 |
| V2 verdict | Current validity on receipt/red/preservation/review/Deep/endpoint predicates, historical flags never sufficient | 700-1,300 |
| G1 Git adapter | Explicit non-check operation context at three runner producers, existing authority unchanged | 120-240 |
| O1 core/config | Canonical presence/source/set equivalence, D2 comparison and pure D6 composition | 2,500-4,000 |
| O2 core/policy | Whole-definition/source grouping and strict field/duplicate equivalence | 600-1,000 |
| O3 core/obligations | Full-definition/baseline stamps and fixed-adapter equivalence/collision handling | 450-800 |
| O4 core/journal-reduce | Cumulative recovery snapshot and protected covering suffix, backup-wide horizon | 1,200-2,000 |
| O5 core/state | Fresh initialization versus recovered ineligible history, no historical restamping | 400-700 |
| O6 core/ids | Canonical structured-key encoding and projection version | 100-200 |
| O7 ports/types | Discriminated check/operation, separate acknowledgment/completion, Store/Tx signatures | 1,300-2,200 |
| O8 main/wire/frontends | Early workspace migration routing before ordinary preLock/recovery/handle flow | 400-700 |

O1-O8 remain explicitly counted although the current module matcher does not assign individual ceilings to those existing files. They are not destinations for moving code out of matched owners. Ports are type-only and contribute zero runtime bundle bytes. Node-TS and risk have no planned direct additions: fixed configured execution stays unavailable and lane-policy rules are not expanded. Tests/docs/generated schema output are outside the runtime source estimate, not omitted deliverables.

**Launch producer reconciliation:** current source has **four check call sites** (`check-execute.ts:31,49,61`, `check-rerun.ts:42`) and **seven non-check sites** (Git three; dependency three; scaffold one). Runtime loops create more invocations than call sites. All check invocations, including every port retry/rerun, require admitted context; installs/Git retain operation tracking with zero check units. No CLI/project-selected domain or unsafe default branch.

### Owner rollup, not a cap request

| Owner | Added estimate | Candidate saving | Modeled final size | Modeled excess over current ceiling |
|---|---:|---:|---:|---:|
| schemas | 7,100-11,600 | 127 | 33,836-38,336 | 6,937-11,437 |
| central | 14,200-23,400 | 53 | 255,943-265,143 | 14,138-23,338 |
| store | 8,700-14,300 | 0 | 33,620-39,220 | 7,700-13,300 |
| budget | 2,800-4,800 | 0 | 11,385-13,385 | 2,745-4,745 |
| runner | 2,000-3,500 | 0 | 11,928-13,428 | 0 in either scenario |
| review | 900-1,600 | 0 | 17,881-18,581 | 0 in either scenario |
| verdict | 700-1,300 | 0 | 13,249-13,849 | 0 in either scenario |
| Git | 120-240 | 0 | 37,921-38,041 | 78-198 |
| other existing runtime files | 5,650-9,400 | 0 | Not individually capped | Included in source/bundle model |
| type-only ports | 1,300-2,200 | 0 | Not individually capped | Source only |

Gross source estimate **43,470-72,340**; net after both candidates **43,290-72,160**. These are estimated additions, not an observed deficit. A broader rewrite might save more, but no such measured candidate exists. Do not start it merely because these estimates exceed current caps.

## 5. Bundle and instruction feasibility

A production-option in-memory esbuild metafile attributes current bundled bytes to each input. Divide each owner's measured contribution by its current source-character count. Observed ratios: schemas **0.7052**, central **0.5740**, store **0.6533**, budget **0.5696**, runner **0.5862**, review **0.6553**, verdict **0.5889**, Git **0.6480**, other runtime **0.5778**. Apply each ratio to that owner's estimated additions; subtract the measured combined **302-byte** saving once.

This yields **25,651-42,839 estimated added bundle bytes**, or **802,488-819,676 total**. New validators, cross-module optimization, retained legacy schemas, names and tree shaking can behave differently from today's code. The current ratios are reproducible observations; the target byte figures are scenarios. The high scenario exceeds the cap by 476 bytes, but a 476-byte increase is **not** justified by this model. A full reviewed implementation must be built and measured, and any separate bundle budget request must be explicit.

No dependency is proposed. Do not count migration source sets, runtime reports, generated JSON schemas or the coordinator text as kernel bundle bytes; they still have their separate payload/storage/context gates. Do not delete the schema-1 reader/bridge behavior just to improve the bundle figure.

S-C can provisionally keep the coordinator at its existing ceiling through replacement, not a body-budget increase. Its one-token residual leaves no useful growth margin. Final rendered guidance and the full simultaneously loaded instruction set need measurement, not an assertion that the body-only model qualifies host loading.

## 6. State/contract changes and remaining design uncertainty

This proposal changes **no live state, port, response, decision registry, reason code or stored record**. The target inventory includes every proposed stamp/key, checkpoint/launch record, phase/terminal and their consumers; it does not activate them.

Before final target implementation sign-off, the combined mechanism still needs exact integration, notably:

- The typed runner handshake and retained job-to-root association must obey section 20 without moving command cwd/reports/DB/tmp/envelope paths or putting command/path/user prose into launch accounting metadata.
- Strict decoder acceptance/refusal must be enumerated for actual producer variants. Nonempty archive remains unavailable without its missing producer decoder; opaque cached data cannot be silently discarded. A useful real source fixture must migrate.
- Explicit recovery-set deletion's exposed interface and finite phase validator remain draft work, not an already registered `backup-delete` decision. The estimate includes its store cost; no new public interface is silently chosen.
- CR-4's existing known-later diagnostic rule must become exact representation/restart tests, not another policy poll.
- Paired bridge/target build identities and real kill exits remain qualification obligations; a green schema-1 source suite is not target proof.

Unexpected sources, associations, shapes or mandatory consumers discovered during implementation invalidate the estimate rather than being dropped from scope. Raise them before crossing the approved boundary.

## 7. Examples, test homes and binary acceptance

These are **planned checks**, except the explicitly labeled in-memory sizing probes. Tests belong in existing homes unless the first real migration transition justifies `schema-migration.test.ts`.

| Example / failure condition | Required observation and home |
|---|---|
| S-A input schema reuse | Existing valid/invalid basis input data and diagnostic paths match; omitted/null/unknown keys and support/output bounds unchanged. Add focused schema cases in existing `core.test.ts`, with actual basis-call regressions in `contract.test.ts`/`boundary-example.test.ts` |
| S-B unrun helper | Missing static/e2e and exhausted port retries preserve today's result, field presence and clock calls. `static-checks.test.ts`, `playwright-adapter.test.ts`, `execution-envelope.test.ts`; launch accounting later supersedes retry loss explicitly |
| S-C shorter guidance | Owner/independent reviewer maps every retained instruction; body/description/loaded budgets and command closure pass `npm run lint`, with no future verb published early |
| Atomic configuration and A-B-A | Same all-work transition publishes with config, stale cache never returned as current; equivalent presentation/reorder does not allocate a serial. `config.test.ts`, `settings.test.ts`, `required-composition.test.ts`, `adopt.test.ts` |
| Typed launch/ownership and a hole | Real child, missing executable, lost acknowledgment, uncertain first/known second, cancellation and two restarts preserve honest counts and stop every admitted group. `runner-ownership.test.ts`, `execution-envelope.test.ts`, `project-recovery.test.ts`, `evidence-flaky.test.ts` |
| Full proof consumer closure | Missing/stale stamps block red/receipt/review parent/Deep/effect proof, while landed Git facts and actual usage survive. `verdict.test.ts`, `review-admission.test.ts`, `focused-review.test.ts`, `analyst.test.ts`, `deep.test.ts`, `index-recovery.test.ts` |
| Migration/rollback/privacy | Real generated schema-1 fixture, exact raw bytes/presence, nine effect forms, strict refusals, every real kill prefix, pristine rollback, forgetting and retained recovery snapshot compose. Planned `schema-migration.test.ts`; existing store/boundary/accounting/forgetting/recovery suites |
| Actual source exceeds a signed envelope or a safety test fails | Stop before activation and return measured alternatives; never widen a cap/baseline, omit a consumer, or remove a falsifier |

Named existing test homes were checked for existence; the table is ownership guidance, not a claim that every target assertion exists.

Acceptance of this proposal requires:

1. Independent or owner review dispositions cover the inventory, estimates, no-double-counting and candidate equivalence limits.
2. Any source/bundle/instruction budget change is approved **explicitly**, with a named scope and stop condition; none is approved here.
3. Before runtime changes, the concrete combined protocol and implementation slice receive owner sign-off. Sizing authorization does not supply it.
4. After authorization: red-first controls, all consumers, full `npm run ci`, built dual-runtime scratch UAT and migration kill matrix pass within actual signed caps; update canonical specs, plan, changelog and privacy checks. Native/host qualification, commits and pushes retain separate authority.

## 8. Alternatives, risks and recommendation

| Alternative | Consequence | Recommendation |
|---|---|---|
| Implement only S-A/S-B to make room | Saves 180 characters, leaving central 62/schema 163; does not provision required target work | Do not treat as delivery progress on the target |
| Broader within-owner consolidation first | Could preserve caps, but no measured saving/behavioral-equivalence proposal exists; a larger refactor delays target work and adds regression risk | Only if the owner chooses that larger scope |
| Review the complete inventory, then request bounded owner-approved capacity | Preserves ownership and every safeguard; accepts measured added complexity rather than disguising it | **Recommended next path**, not an authorized cap increase |
| Activate a smaller schema-2 subset missing launch/recovery/proof consumers | Can revive proof, lose usage or orphan processes | Reject |
| Relocate code to unmatched owners or relax tests/bundle/quality gates | Makes measurements misleading and removes the intended constraint | Reject |

Main risks are forecast error, validator/source-form underestimation, instruction semantics changed by compression, and refactoring late-binding consumers before their shared contract is final. No exact cap increase is selected from these ranges. A focused capacity review can challenge the scope/scale before the owner is asked for an implementation or budget decision. No further reviewer is launched without authorization.

## 9. Evidence artifacts

Current session files retain `protocol-capacity-candidates.json` (exact candidate measurements and probe limits; SHA-256 `ae015f56029fdb1342423db95e771c04b304dbbb7742f889c1c4c32543b2ec30`) and `protocol-capacity-model.json` (28 responsibility rows, rollups, observed ratios and six exact prose substitutions; SHA-256 `dd32be64d17c3d8b8a130a61bac16dd58ee525378aa83e05faaa43d14f6d5b9a`). They are analysis artifacts, not new production tools. The repository document preserves the decision-relevant measurements and estimate method; no candidate was installed and the baseline source/bundle identities remain unchanged.

## 10. Independent capacity review and dispositions

The owner authorized **one bounded read-only capacity review**. It is complete: proposal sound/internally consistent, no blocking document defect; no target implementation or budget sign-off. The reviewer independently verifies all rollups, source/bundle arithmetic, five over-ceiling owners, four check/seven operation call sites, coordinator measurement and candidate-limit disclosures.

| Finding | Disposition |
|---|---|
| F1: supporting artifact has an additive-only 4,088-token scenario, not disclosed in S-C prose | Accepted; section 3 now explicitly conditions the 3,999-token outcome on all six reductions, records the 88-token overrun without them, and requires remeasurement for partial adoption |
| F2: effect reconciler work might be implicit rather than included in central sizing | Clarified in C6: its existing normal/recovered commit/integration proof split includes `recover-effects.ts` SETTLE/PUBLISH. C8 covers the existing forget handler's target recovery-set extension. S4 is strict decoding, not runtime settlement. No additional ordinary effect kind is proposed for migration, whose finite descriptor protocol remains separate; launch is its own journal kind with B1/C3/C7 accounting/ownership, not a SETTLE effect. No new row or duplicate estimate is needed |

These dispositions require no new runtime implementation, estimate cycle or reviewer. Exact final protocol/port integration, actual compiled target measurements, bounded budget approval and owner implementation sign-off remain open.
