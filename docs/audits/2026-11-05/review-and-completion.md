# Implementation review and completion plan — November 5, 2026

The kernel, plugin, starter and offline evaluation system are substantially built. R1 is incomplete. Structural mapping is **141/181 Musts (77.9%)**, with **16 host/human buckets and 24 unmapped**; this is not a percentage of completed product behavior. **Zero Musts are qualified**, the semantic evidence ledger has zero records, and all **19 Shoulds** lack final dispositions. All 200 due Must/Should requirements and acceptance-case links are in [requirements.md](requirements.md); exact source fingerprints, counts and enforced sizes are in [status.json](status.json).

This review compares the plan's active dashboard, RC0–RC8, handoffs and outstanding feature contracts with current source and tests. Historical audit entries are evidence for their own source, not the current checkout. This is a source review with targeted counterexamples, not an independent review or a claim that every defect has been discovered. The local ignored plan and feature proposals remain local; this report does not activate them.

## Current implementation and evidence

| Cumulative milestone | Musts | Tagged tests | Host/human bucket | Unmapped | Qualified |
|---|---:|---:|---:|---:|---:|
| M0 | 34 | 30 | 4 | 0 | 0 |
| Alpha | 100 | 91 | 9 | 0 | 0 |
| Beta | 158 | 130 | 13 | 15 | 0 |
| R1 | 181 | 141 | 16 | 24 | 0 |

Implemented foundations include the pure rules, ports, single pipeline, contracts and basis/plan decisions, candidate-bound checks, bounded Vitest/Playwright/static adapters, execution consent, process ownership, private store, crash/effect replay, temporary-index Git operations, review/Analyst packets, settings/restriction composition, prototype/shadow workflows, recipe scaffolding, starter API/browser journeys and restore safeguards, and bounded offline catalog/replay/reporting. The public R1 catalog has 30 tasks; its existence and deterministic controls do not establish a live campaign result.

The 16 host/human buckets are INS-01/03/09/10, INT-01/11, WRK-05/11, REV-06, RES-03/07, SEC-01/16, OSS-02 and NFR-02/06. AGT-10, monthly qualification and release practices also require real observations even though they appear in the unmapped group. A tag does not exempt a requirement from its other acceptance cases or evidence tiers.

## Reproduced defects repaired in this work

The changes preserve the existing state schema and public verbs. The owner explicitly approved strict UTF-8 refusal on November 5 after review of the prior legacy-decoding compatibility rule; the canonical specification and legacy test now reflect that decision.

| Defect | Consequence | Repair and control |
|---|---|---|
| Invalid registry dates produced `NaN`; age comparisons then passed | `unknown_age: deny` could admit a package whose age was never verified | Normalize invalid dates to unknown and reject non-finite ages at the policy boundary. Pure invalid/valid/future-date controls plus the real decision pipeline prove rejection without publishing output or installing. |
| npm compared only version and resolved URL | Same-version integrity, script, license or link changes bypassed the verification population | Compare every normalized policy-relevant metadata field; retain unchanged-package control. |
| npm trusted cast JSON and accepted future/mistyped versions | Invalid metadata could throw unexpectedly or enter normalization as trusted values | Validate the consumed metadata and root dependency maps with Zod; admit only lockfileVersion 2/3. Unknown non-consumed package metadata remains compatible. |
| pnpm treated every identical package key as unchanged | Changed resolution integrity/source under the same name/version disappeared | Compare resolution fields independently of key identity. |
| pnpm upgrade matching depended on package order and could guess among multiple new versions | Preview could attribute a retained version as an upgrade predecessor | Group only versions absent from the other snapshot; match one old to one new, otherwise report additions without guessing. Two permutation/ambiguity controls. |
| pnpm accepted unknown lockfile versions and overwrote duplicate keys | Unsupported or contradictory records could be presented as supported | Require the supported v9 lock shape and reject duplicate/invalid package identities. |
| pnpm reported a removed version as a removed package while another version remained | Preview incorrectly claimed that the package was dropped | Filter removal names against all remaining package names. |
| Legacy project text reads decoded malformed UTF-8 with replacement characters | Adopting or re-projecting a managed file could silently corrupt its original bytes | Owner-approved strict-read refusal preserves original bytes, raw-byte hashing, valid Unicode and absence semantics. The canonical spec and old compatibility test are updated; valid literal replacement characters remain readable. |
| npm rescanned every output package for each removed package | Removal-heavy lock diffs incurred quadratic work | Build a remaining-name set once. Also append pnpm prior-version groups without copying each growing array. No benchmark qualification is inferred. |

Nine new dependency-core cases reproduced failures before their fixes. The decision-pipeline regression supplements those controls. A separate filesystem counterexample also reproduced; its strict-read repair was applied after explicit owner approval of the compatibility change. See `packages/kernel/test/dependencies.test.ts`, `dependency.test.ts`, `project-boundary.test.ts` and `project-bounded-read.test.ts`. The supplemental [seeded property check](dependency-properties.mjs) passes 500 cases for order independence, retained predecessors, removals and complete unique new-version accounting.

## Remaining work, including partial tagged implementations

| Workstream | Exact remaining obligations | Dependency / exit evidence |
|---|---|---|
| Evidence truth (RC0) | Review all 181 Musts against actual ACs; populate semantic ledger with passing/partial/failing evidence, uncovered ACs and retained history. Resolve every Should. | Evidence-ledger mechanism exists; owner-approved dispositions and actual campaign manifests are still required. No automatic conversion of tags to complete. |
| Execution and recovery (RC1) | Complete configured-command/required-check consumers and effective tool/config graphs; uncertain process/cost reconciliation, backup reconfirmation; aggregate eviction with protected retention; outstanding Git/signing/checkout, lock/path replacement and effect races. | Signed mechanism, capacity, real-process crash/race controls and built UAT. Existing safe refusals remain until a supported path exists. |
| Dependency assurance (RC1/RC2) | Recipe license-list consumer; effective manager/config/registry provenance; bind normalized source and version-age lookup to the actual resolved artifact (current HTTP/integrity heuristics alone do not establish that identity); complete pnpm parser conformance and real CLI UAT; per-version age caching/deduplication and a whole-job lookup deadline; after-the-fact verification; current-file race during the two publication/restoration writes and install launch. | Do not equate the repairs above with SEC-05 completion. Do not describe the two-file publication as atomic. |
| Intent and continuity (RC2) | Re-project adopted intent after changes; accept external blocks with a bound preview; MADR files and shared-ID merge proposals; branch reconciliation; reconstruction after state loss; remaining lesson/forget copy closure and charter adoption. | GIT-09, CON-07 and partial INT/QLT/CON obligations; shared-file S1/S3 and reconstruction contracts need sign-off; personal/charter storage needs SP-02. |
| Configuration and migration | Complete readback/confirmation, source conflicts, setting enforcement labels, personal layer and provenance. Finish strict schema-2 decode, actual durable migration/rollback, launch/accounting and trait consumers together. | CFG-01/03/04/08; partial CFG-09/10, CON-05, LFC-03/04, RSC-04 and QLT-11/14. Archived candidate is not shipping implementation. Integrated review, final mechanism decisions and measured capacity precede activation. |
| Review and results (RC3) | Changed-export/caller investigation; complete split-round/packet semantics; selected-fix context; configured resource mode, exact time separation, qualified-model warning and kernel-backed demo contract. | AGT-12, RES-05, RSC-08, NFR-05 and partial REV/RES/RSC. Keep reported independence distinct from observed isolation. |
| Starter quality (RC4) | Requirement-specific ASVS behavior/manual results; critical-journey accessibility/manual evidence; workload receipt/baseline/trend and degradation attention; trait-bound threat/data notes; performance and restored-data qualification. | QLT-05/11/13 and partially mapped QLT/EVD; revised workload and threat-note proposals need their specified review/decisions. Existing UI/restore tests do not close security/accessibility conformance. |
| Host and lifecycle (RC5) | Full SP-08, SP-01/02, SP-06/10 dispositions and exact installed tuple; SP-12 transport comparison; install/update/disable/removal and capability re-probe semantics; optional hooks only after SP-03. | INS-05, AGT-10 and host buckets; each spike retains its separately scoped authorization. Record installed artifact, host, extension/model versions and failures. |
| Evaluation and usability (RC6) | Protected candidate/grader execution, isolation and no-overage enforcement; SP-11, native capture/replay and campaigns; 10 protected tasks; successive changes; one ablation; six formative sessions and 8–12 participant pilot. | Offline fixtures/tools exist. Live/capture/account activity and research consent remain separate gates. Report cancellations/unknowns and matched native baseline. |
| Diagnostics/performance (RC7) | Privacy-reviewed diagnostic export, runtime timings split by provider/tool/network, frozen small/large/history fixtures, storage/latency measurements. | NFR-01/05/07, partial ENG-06/09. Revised diagnostic proposal needs re-review and decisions. No platform-wide performance claim from unit timing. |
| Release and operations (RC8) | Installed integrity/authenticity, independent clean rebuild, signed tag and provenance, protected release workflow, SemVer rationale, actual public review window; final contacts/namespace/support docs; monthly full native suite. | LFC-01, ENG-05/07/11, OSS-01 and host/practice evidence. Existing payload hashes, reproducibility and draft notes are partial. Product/release approval closes release. |

The other unmapped Must is ENG-08: the experiment tool now exists, unlike the November 3 audit; its frozen live baseline/candidate/holdout experiment and evidence remain outstanding. Similarly LFC-02 now has draft-release-notes coverage; this mapping change does not prove a released artifact's disclosure.

The 19 Shoulds needing passing evidence or individual signed omission are INS-08, INT-13/14, AGT-09, TDD-05, EVD-14, RES-08/09, GIT-06/07/14, CFG-07, RSC-05, LRN-04, QLT-08/15, ENG-06 and OSS-03/06. Existing draft recommendations do not count as signed omissions.

## Every currently unmapped Must

These are the 24 structural gaps. Partial obligations behind tagged Musts remain in the workstream table above.

| ID | Smallest outstanding delivery / gate |
|---|---|
| INS-05 | Capability reprobe/cache identity and host/plugin version source are unspecified; define the measured probe contract, then observe it on the installed tuple. |
| AGT-10 | Observe actual native specialist dispatch without exposing specialist management to the user; instruction presence cannot prove this. |
| AGT-12 | Capture changed exports/callers/linked acceptance tests in the bounded investigation list; current manifest primarily knows changed paths and tests. |
| EVD-04 | Sealed external baseline materialization/rerun/classification remains unsigned and unbuilt; unknown classification must stay unknown. |
| RES-05 | Kernel demo-path/command-source/artifact contract remains pending despite existing coordinator guidance and partial draft implementation. |
| GIT-09 | Shared-ID collision/reconcile/merge proposal needs shared-files S1/S3; prototype hardening S2 is already approved and is a separate slice. |
| CON-07 | State-loss reconstruction requires signed import/preview/fence rules and wiring; reconstruction may never restore grants or passing receipts. |
| CFG-01 | Natural-language correction readback and bound confirmation, plus remaining consumers; the combined configuration/binding contract needs closure. |
| CFG-03 | Finish source conflicts and non-equivalent command/obligation handling; personal layer waits for its host storage observation. |
| CFG-04 | Setting enforcement and layer revision labels plus precise “why setting” routing remain incomplete. |
| CFG-08 | Personal/project-local privacy closure, including free-text preferences reaching shared intent projection; complete both prevention and publication-preview obligations. |
| RSC-08 | Populate a real qualification table from authorized campaign results and bind the Deep warning to it; unknown is not qualified. |
| LFC-01 | Choose and justify an actual release SemVer bump against the compatibility contract; version-string syntax alone is insufficient. |
| QLT-05 | Implement workload obligation/receipt/baseline/trend and attention after the reviewed contract is settled; run reference workload qualification separately. |
| QLT-11 | Activate project/change trait state only with complete configuration/migration/accounting consumers and the versioned decoder; schema-1 strings are not that protocol. |
| QLT-13 | Finish trait-bound threat/data note records, linked test/constraint evidence and review resource after QLT-11; revised proposal needs its independent re-review. |
| ENG-05 | Run the full native suite at the agreed cadence on the qualified tuple; smoke wording does not waive PRD full-suite requirements. |
| ENG-07 | Complete protected release workflow, signing/provenance and independent installed-artifact rebuild/authenticity checks; local hashes are partial integrity evidence. |
| ENG-08 | Use the implemented bounded experiment tooling for a frozen live baseline/candidate/holdout experiment and record its outcomes. |
| ENG-11 | Actually operate and record the required public review window; a policy sentence or unit test does not supply elapsed public review. |
| OSS-01 | Finalize publication identity, conduct/security contacts and supported-release policy for the actual artifact; retain draft/unsupported status until then. |
| NFR-01 | Freeze reference fixtures/hardware and measure latency/storage/token budgets; finish aggregate retention so the storage bound can be qualified. |
| NFR-05 | Separate provider, tool and network time with explicit missing values; current active-time/call durations do not establish this decomposition. |
| NFR-07 | Implement the revised privacy-preserving diagnostic export contract only after review/owner choices; no automatic raw workspace/credential export. |

## Efficient execution order

1. **Stabilize evidence and repair exposed safety defects.** Run the existing full gate on supported POSIX, retain failures, and use targeted red controls for parser/identity/effect counterexamples. Complete the present dependency repairs with built CLI UAT. Audit semantic evidence by behavior slice rather than tagging missing IDs.
2. **Close the shared capacity and schema contract once.** Review the preserved complete configuration/launch/accounting/migration/trait candidate against current main, not its old baseline. Measure all consumers and the installed payload. Obtain exact owner budget/mechanism decisions; do not approve a chain of tiny increases or move responsibilities outside measured owners. Then port the integrated signed slices with schema-1 preservation and kill/restart coverage.
3. **Finish recovery/storage and intent continuity vertically.** Protect counters, grants, human index/content and unresolved effects under pressure/crashes first. Then test adopt → intent edit → projection → external edit → confirmation → branch change → resume. Add reconstruction only with its signed loss-of-authority rules. Reuse the one pipeline and existing effect protocol.
4. **Finish review/results, configured checks and generated quality.** Wire existing ports and registries; complete export/caller and split-round coverage, resource consumers, workload trend and trait-bound threat notes. Every new consumer needs candidate-bound proof and a refusal control. Complete the real starter journey before tuning polish.
5. **Run authorized host qualification and research alongside local development.** Freeze the actual tuple and comparison protocol; recruit/consent separately. SP-08 precedes installed skeleton and SP-12. Reuse deterministic fixtures for native controls, without substituting scripted reviewers for observations. No live campaign starts before verified account/isolation/spend limits.
6. **Close release from exact artifact evidence.** Freeze calibration, run the full campaigns and pilot, resolve all 19 Shoulds, independent rebuild/sign/provenance and public review window. Publish unresolved failures/non-applicability/risks; obtain product and release approvals. Plan §9.6 controls completion.

For each slice: red test → smallest implementation → focused green → typecheck/lints/full CI → built-bundle scratch UAT → semantic evidence review → tracker update. Re-run broad checks after final changes; do not repeatedly run heavyweight suites on unchanged source. Avoid speculative MCP/hooks, a new host/ecosystem, extra orchestration or an unrelated redesign.

## Independent reviews and candidate reproducibility

The owner authorized three fresh reviewer subagents during this work. Their findings are retained in [protocol-review.md](protocol-review.md), [workload-and-threat-review.md](workload-and-threat-review.md) and [diagnostics-and-repairs-review.md](diagnostics-and-repairs-review.md).

The protocol review confirms **22 partial responsibility rows, seven missing, zero closed** in the preserved candidate. C5, C6, R1, V1, G1, O4 and O8 are missing. The candidate is not a complete sizing target. Its exact archived base/patch/additive overlay was reconstructed successfully in a separate temporary directory and typechecks/builds ([exact reconstruction evidence](protocol-reconstruction.json)); no archived candidate source was copied into main. A bounded safe next candidate slice is C5/V1 issued review/Analyst configuration binding. Complete C5 additionally needs a reviewed durable native-dispatch issuance/retirement/settlement mechanism: current stale-reservation removal discards identity, and the process-check launch ledger cannot supply once-only native dispatch accounting. Follow with recovered-operation proof and a reviewed runner association/acknowledgment boundary. Existing D1–D8, MC policies and trait-shape choices are settled; they must not be polled again. Runtime activation and exact production capacities remain separate decisions.

Reconstructed partial-candidate measurements fail four unchanged source-owner ceilings: store/migration **43,421/25,920**, budget/accounting **18,754/8,870**, schemas **51,291/26,899**, and central **251,031/247,219** characters. Its bundle is **814,039/819,200 bytes** (94 old-base payload files), with consumer work still missing. This is not complete-target capacity and cannot justify an exact production increase. Typecheck/build success does not close the failing quality gate or import later main safety repairs.

The workload/threat review finds eight material contract gaps plus a supporting-element privacy case. These include contradictory null-measure classification, nonconsecutive series reuse, reset-boundary disagreement, unstored environment disclosure, unbounded retained series, missing measurement/protocol identity, undefined Analyst transport and dependence on unbuilt reverse reconciliation. Neither draft is sign-off-ready.

Diagnostics has three blockers and three major findings: save-intent/temp creation ordering, restart ownership, free-text visibility gaps, free-text capability values, unbounded existing-target reads and uncertain post-link classification. Those must be corrected before export runtime wiring; a redaction pass alone cannot remove ordinary private text. The review also caught mixed/duplicate pnpm version declarations bypassing the new version guard. That runtime counterexample is repaired and independently rechecked; no other actionable defect was established in the scoped changed-code review.

Local §13 amendments propose corrections to the three draft contracts. Focused re-reviews retain unresolved identity/provenance/accounting and filesystem race limitations; none is sign-off-ready. The current local draft headers and plan record these findings without pretending they are owner approval or silently selecting the open alternatives.

## Capacity and decision boundary

Current enforced headroom is **central 140 characters, Git 0, Node adapter 13, store 45, schemas 309**. Central is already **897 characters above the last approved 247,219 ceiling** although lint enforces the proposed 248,256 value. The defect repairs here add no central/schema/store/Git/Node-adapter code and change no ceiling. This mismatch is an existing governance defect; green lint cannot settle it.

Outstanding contracts are concrete local proposals: configuration/migration/capacity, shared-files S1/S3, reconstruction, sealed baseline, recovery reconfirmation, finding lifecycle, workload, threat/data notes and diagnostic export. Their approval and review requirements are recorded in plan §12.9–12.19 and the proposal status headers. No generic “finish everything” instruction is recorded here as agreement to their unresolved alternatives, waived safety gates, paid activity, signing or publication.

## Validation

Full local CI passes **1,718 tests / 263 suites**. Final approved-source typecheck/lints/build, complete 97-file payload and same-toolchain reproducibility pass. The identical **799,293-byte bundle** passes all **152 CLI scenarios on each of Node 26.3.0 and Node 22.12.0**, plus the focused real-npm/synthetic-registry dependency/adoption walkthrough. Supplemental pnpm properties pass 500 seeded cases. Exact artifact hashes, intermediate failures and scope limits are recorded in [validation.json](validation.json). Local success stays **in progress** without exact-source CI/commit evidence. No host campaign, human study, qualification, commit/push, or release was performed by this work.
