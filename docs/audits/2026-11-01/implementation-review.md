# Implementation review and completion order — November 1, 2026

Reviewed the in-place `main` checkout starting at `35216fa` (two unpublished commits ahead of origin, initially clean). No branch or worktree was created. Four inherited worktrees were inventoried and preserved; their overlapping, partly unsigned prototypes are not accepted main implementation. The current request explicitly authorizes disjoint parallel agent work in this checkout; it does not change Tenet's product concurrency policy.

## What is complete, and what the counts mean

The [fresh 200-requirement inventory](requirements.json) is generated from PRD rows and the current coverage report. It contains every due Must/Should, its canonical text and AC references, and current structural/ledger status. It supersedes the October 31 inventory's misleading “current” label; that older dated observation is retained as history.

| Cumulative milestone | Musts | Test-mapped | Host-only | Unmapped | Qualified |
|---|---:|---:|---:|---:|---:|
| M0 | 34 | 30 | 4 | 0 | 0 |
| Alpha | 100 | 91 | 9 | 0 | 0 |
| Beta | 158 | 129 | 13 | 16 | 0 |
| R1 | 181 | 139 | 16 | 26 | 0 |

Report integrity has no errors; fixtures reference 92/119 reasons. The semantic ledger still has zero entries, so all 181 Musts remain unreviewed there. None of the 19 Shoulds has a closed disposition. **76.8% test mapping is not 76.8% product completion.** No milestone is qualified. The implementation includes a substantial deterministic kernel, plugin and working starter; local checks do not establish its native-host or release claims.

All 26 unmapped Musts: INS-05; AGT-10, AGT-12; EVD-04; RES-05; GIT-09; CON-07; CFG-01, CFG-03, CFG-04, CFG-08; RSC-08; LFC-01, LFC-02; QLT-05, QLT-11, QLT-13; ENG-05, ENG-07, ENG-08, ENG-09, ENG-11; OSS-01; NFR-01, NFR-05, NFR-07. The other 155 Musts can also have incomplete ACs/consumers; mapping is not semantic acceptance.

## Confirmed implementation gaps and their dependencies

| Workstream | Exact remaining behavior / evidence | Dependency and exit |
|---|---|---|
| Configuration and execution accounting | Effective identity/readback/source revisions; all-work proof/cache invalidation; real durable launch, acknowledgment, settlement, stop/restart and checkpoint recovery consumers. | Final combined configuration/migration/trait contract review and owner sign-off; complete target fit first. Red-first vertical lifecycle tests, actual-process kill prefixes and repeated recovery. |
| Migration and continuity | Schema 2 is inactive; source/reference/process closure, backup/reconfirmation, shared-file reverse reconciliation/projection, ID-aware integration, loss reconstruction, aggregate protected retention remain unfinished. | Resolve each remaining contract decision; no inferred grants/receipts or wholesale historical-worktree import. Preserve unowned bytes and protected records through real recovery faults. |
| Evidence and quality | `facts.ts` supplies an empty baseline-failure set; committed checks refuse. Sealed baseline materialization, failure equivalence and excluded listing are missing. Complete trait/risk/obligation consumers, changed-journey/manual/API compatibility/performance/trend workflows remain. | Signed materialization and dependency/launch safeguards before running neutral trees. No unknown failure may become “pre-existing.” |
| Result and resource workflows | RES-05 now has an owner-directed, independently reviewed proposed contract for command sources, proposal/idempotency and screenshot transport; RD-1–RD-5 and production prerequisites remain unsigned; RSC-08 lacks qualification-table behavior. NFR-05 does not separate provider/tool/network time. | Review/sign the concrete result contract; preserve review in Serial/Conserve and report unknown provider values honestly. |
| Starter | ASVS: 46 pending, 19 scoped non-applicable, 5 gaps, zero passed. Supported-runtime workload/memory acceptance remains failed; the experimental runtime also loses sign-in/busy acceptance. Accessibility manual observations and independent security dispositions remain. | Preserve crypto, transaction and quota behavior. Meet actual declared workload targets on each supported runtime; passing API/browser examples do not establish conformance. |
| Host and evaluation | Exact tuple, installation/update/removal, permissions/storage/isolation, front-end choice, native capture/protected execution, 30 public + 10 reserved tasks, successive-change/ablation campaigns, six formative sessions and participant pilot remain. | Separately authorized host/account/run/study prerequisites. Synthetic users, replay and local CI cannot replace observations or human studies. |
| Release | Every Must's AC review/qualification; every Should disposition; independent clean source/dependency rebuild; installed integrity; notices/privacy/namespace/support matrix; signed provenance and product/release approvals. | Frozen implemented artifact, authorized campaign, published residual limitations, explicit release approval. Git publication is not product release. |

The latest recorded scratch target does **not** fit: store 38,277/25,920 characters; accounting 23,047/8,640; central 293,390/247,219; bundle 814/800 KiB. Its 1,656/1,658 passing tests do not implement the missing source closure or establish target feasibility. These are retained historical scratch measurements, not remeasured main sizes. Next capacity work must replace complete duplicated responsibilities and measure the whole target; another tiny helper cannot establish feasibility. Fixed budgets and safeguards remain controlling.

Main's current measured accounting ceiling is **8,870**, including the previously authorized RSC-04 increment; the older scratch comparison used **8,640**. Reconcile scratch thresholds to the current approved main limits before the next fit decision. Even the recorded scratch accounting source exceeds the current ceiling by 14,177 characters; this discrepancy does not establish fit.

Fresh main measurements after these repairs (non-whitespace characters):

| Owner | Used | Current ceiling | Free |
|---|---:|---:|---:|
| Central pipeline/verbs/decisions | 247,214 | 247,219 | 5 |
| Schemas | 26,371 | 26,899 | 528 |
| Store | 25,706 | 25,920 | 214 |
| Accounting | 8,806 | 8,870 | 64 |
| Git | 37,801 | 37,843 | 42 |
| Node adapter | 20,033 | 20,160 | 127 |

These measurements pass the existing gates; the very small remaining capacity explains why main passing does not imply the complete target fits. No owner budget or matcher changed.

## Reproduced defects repaired in this continuation

1. Vitest accepted a passed assertion with failure messages, even an empty message. The normalizer now rejects that contradiction with no normalized population; an explicit empty list remains valid.
2. Empty, workspace-directory and NUL-containing report names could become test evidence identities. They now fail normalization. Adapter identity advances to `node-ts@13`, preventing reuse under the previous normalization semantics.
3. Configuration reset bypassed setting/scope validation and could delete a project protected-path override when given an invalid scope. Reset now validates the catalog and scope before changing state; rejection preserves the complete configuration record.
4. Configuration reset also treated truthy nonbooleans such as `"false"` as reset requests, bypassing value validation and deleting overrides. Only literal `true` triggers reset now; malformed markers without a value refuse and preserve configuration. This does not activate the unsigned strict proposal-envelope contract. The redundant `Object.keys` type assertion is removed because the existing truthiness guard already narrows the value.
5. Campaign qualification accepted a Git directory as the frozen protocol because existence alone was checked. It now requires a blob from the frozen commit. A directory regression fails before the fix; the valid protocol-file control remains. This checks object type, not regular-file Git mode or the truth of campaign contents.

Each behavior repair has a failing-first control. These repairs strengthen existing requirements and do not add mapping links, accepted ledger entries or qualification.

## Inherited work disposition

Read-only inspection of the inherited local changes found these integration blockers. No source was changed or test run in those worktrees; none is a new development surface.

- **Configuration (`ddd6e78`, clean):** retain the historical prototype; it is not the current approved/integrated configuration protocol.
- **Reconstruction (`b55a86a`, four modified/three untracked files):** a pure parser, work-label port and schema additions exist, but open/inspect/adopt/fence wiring demanded by its tests is absent. Review parser examples after the reconstruction decisions close; do not import its schema or pretend its scenario suite proves an implemented path. Preserve main's existing slice-0 undo safety repair.
- **Sealed baseline (`5841fac`, fourteen modified/two untracked files):** materialization/classifier/receipt fragments lack check execution/finalization/accounting/decision wiring. Its older adapter identity would regress current normalization. The materializer accepts an existing destination with recursive directory creation and later recursively deletes that entire destination without exclusive ownership. Its failure ID truncates the whole composite at 300 characters, potentially losing kind/signature for long test names. These are unsafe salvage boundaries, not main runtime defects; fix and regression-test them only in a reviewed signed main implementation.
- **Shared files (`5841fac`, eight modified/six untracked files):** adoption imports a missing `adopt-shared.ts`; the snapshot is incomplete. S1 trust/replay/directory/format additions remain unsigned. Pure format/parser examples can inform a reviewed S1 slice, preserving main's already authorized S2/hardening behavior.

## Documentation mistakes corrected

Plan §12.16 retained an obsolete HEAD/uncommitted-work description and stale Alpha/Beta counts. The older inventory says 117 mapped/48 unmapped and calls later-repaired behavior missing. They are historical evidence, not the current baseline. This dated report and inventory replace those current-status claims; append-only progress history is retained. Development parallelism is expressly authorized by this request and uses disjoint ownership with one final integration checkpoint.

## Efficient delivery plan

1. **Stabilize and account:** preserve main and inherited work, run full CI/built UAT, fix reproduced existing-contract defects, draft AC-level semantic dispositions alongside each slice. Obtain genuine ledger approval references before acceptance.
2. **Resolve the actual critical path:** develop one complete responsibility-preserving capacity replacement, in parallel with resolving the finite protocol decisions. Freeze schema-1 producers/behavior and measure all owners, bundle and instructions together. Do not install an oversized/incomplete prototype.
3. **Integrate signed vertical slices:** configuration identities → durable launches/settlement → all proof/cache consumers → retained migration/recovery. One shared-contract writer; independent review and actual kill/restart tests at every publication boundary.
4. **Complete continuity and evidence:** shared projection/reconciliation → stable IDs/reconstruction/retention → safe neutral-tree materialization/classification/committed checks. Keep unknown and unavailable claims conservative.
5. **Complete user workflows:** result/resource/trait/quality consumers and supported-runtime starter workload acceptance, with browser/manual/security evidence recorded separately.
6. **Schedule external work early:** request exact-host, account and participant access in parallel; execute only authorized runs after prerequisites, against frozen artifacts.
7. **Qualify and release:** reconcile all 181 Musts and 19 Shoulds, publish failures/limitations, verify clean rebuild and installed lifecycle/provenance, obtain product/release approval.

Phase A's +15 links is a traceability checkpoint, not the implementation critical path. No defensible time-to-completion follows while capacity feasibility and external scheduling remain unresolved. Full plan completion includes decisions, observations and human studies that code edits cannot supply.

## Next capacity experiment: replacement, not another helper

A further read-only owner-boundary review found no demonstrated fitting design. Main already shares descriptor reads/writes, settings resolution and counter inventories; effect-specific recovery has distinct authority and publication semantics. The only substantial hypothesis identified for independent design review is one durable lifecycle model replacing duplicated normal/recovered bookkeeping:

| Owner | Replacement to investigate | Proof of removed responsibility required before coding |
|---|---|---|
| Central | One issued-job context and settlement path across normal, stale and restart completion; retain typed effect-specific postconditions. | Map deleted preparation/finalization/recovery implementations at all four check and seven operation producers, retries and delegation consumers. |
| Accounting | One target replay reducer plus explicit schema-1 decoder. | Remove target recovery/history/settlement traversals while retaining legacy conflicts, maxima and restoration semantics. |
| Store | One publication engine with explicit migration/recovery phases and separate admission rules. | Preserve ordinary and migration copying/install/recovery durability barriers; do not count already-shared descriptor mechanics as new savings. |
| Schemas | Actual unchanged validators with explicit legacy/target overlays. | Preserve producer acceptance, defaults, strictness, unknown-key handling, diagnostics and necessary legacy decoding. |

Before implementation, prepare a responsibility-to-function **deletion map for all 28 capacity rows plus QLT-11**. Reject the hypothesis without coding if it cannot name substantial removed store/accounting/central implementations. This is an experiment proposal, not a selected architecture or demonstrated capacity benefit. It needs independent review and the existing final implementation sign-off.

Freeze actual schema-1 producer records and observable traces (cached responses, nine effects, clock/random calls and fsync/publication ordering). A candidate must replace the old target paths, retain the legacy bridge, cover settlement holes/stale-result non-authority/all process associations/repeated recovery/no-follow and UTF-8 bounds/human-byte preservation/every kill prefix, and measure all original owners, bundle and instructions together. Stop on any missing responsibility, changed proof/authority semantics, unexplained differential or failed fixed cap. No budget, matcher, deadline or population change is proposed.

## Validation

Final local `npm run ci` passes **1,314/1,314 tests across 207 suites**, zero failures/skips/cancellations, plus typecheck, all lints, M0 mapping, build, payload and reproducibility. **81/81** focused source checks pass on Node 22.12.0 with its TypeScript flag inherited by child source CLIs. Final bundle: **782,742/819,200 bytes**, SHA-256 `a1b09218977fa9f7b22010b3c99535fd325607a3757b72b099a7273c4364be13`.

The [retained built-CLI UAT](reset-bundle-uat.mjs) passes on Node 26.3.0 and 22.12.0: seven invalid scope/reset cases preserve the full configuration and revision; literal `true` removes the intended override, preserves unrelated preferences, and a new repeated request is a no-op. Run it from the repository root with optional additional Node executable arguments. The full general CLI UAT also passed on both runtimes before the final marker repair (152 minimum-runtime observations); the earlier artifact and source hashes are preserved separately, not claimed as a general campaign on the final bundle. [Exact identities, scopes and limits](validation.json).

Initial sandboxed integration tests refused because macOS denied `ps` and therefore process-owner inspection. The safety refusal is retained; process tests used approved inspection access. An initial Node22 source-test invocation omitted the TypeScript flag in a child CLI; inherited flags give the final pass. A scratch UAT assertion initially confused an exact cached response with a new call; the retained script uses the documented `again:true` for new reapplication. No runtime behavior was changed for either invocation correction. No assertion, deadline, budget or qualification condition is weakened. Final whitespace/privacy checks cover actual additions, including untracked audit artifacts. Hosted CI, installed/native-host behavior and release qualification remain unobserved on this source.

## Final continuation checkpoint — November 1, 2026

The measurements and five repairs above are an earlier checkpoint, preserved for audit history. The later [continuation validation](continuation-validation.json) records the final source and artifact identities: full CI **1,367 tests / 209 suites**, zero failures/skips/cancellations; Node22 **100** focused runtime checks and **3** probe controls; full built CLI UAT **152** observations on each Node26/22 against the same bundle. Current central/node adapter sizes are **247,182/247,219** and **20,044/20,160**; all unchanged gates pass.

Additional red-first repairs retain complete diagnostic failure kinds, enforce whole-run exit and supplied-total consistency, protect active run/review/packet resources during cleanup, and provide the independently reviewed bounded strict-UTF-8 source-reader foundation. Adapter **node-ts@15** makes previous normalization evidence stale. The [public catalog](public-catalog-validation.json) now contains the canonical thirty tasks and 122 controls, with pinned original Alpha ten and exact source hashes; these are offline author-visible controls, not native/model qualification. Probe summaries normalize only known workdir prefixes, not arbitrary private diagnostics.

The [capacity investigation](capacity-deletion-map.md) documents why no complete-target fit has been demonstrated; the historical candidate location remains unavailable. Result-demo§19 retains unresolved capture-only accounting, bounded inline-body extraction, retention and recovery requirements. The selected policy is five currently retained screenshots replacing stale captures. Configuration/migration/traits and result activation, reserved/protected/native/human campaigns, semantic ledger/Should dispositions and release approvals remain incomplete. Fresh R1 is **139 mapped / 16 host-only / 26 unmapped / 0 qualified**, with no integrity errors. No branch/worktree, fixed-budget change, commit or push occurred in this continuation.
