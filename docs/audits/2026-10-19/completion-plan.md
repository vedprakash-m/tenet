# Plan to complete Tenet

**Current follow-up:** the [October 20 reassessment](../2026-10-20/reassessment.md) includes the GitHub/cloud commits through `d457714`; its [updated completion plan](../2026-10-20/completion-plan.md) refines the sequence below. This document's checkpoint counts are historical.

October 19, 2026 · follows [specs/plan.md](../../../specs/plan.md), with the [audit](report.md) supplying corrective work and the [200-row requirement ledger](requirements.md) supplying the full due-by-R1 inventory.

This sequences work already specified by the canonical documents. It does not approve spec changes, new scope, release waivers or paid host experiments. Each host spike keeps its separate authorization requirement. The owner decisions listed in C1 can be resolved while deterministic fixes proceed; they need not block writing counterexample tests.

**Implementation update:** the owner authorized execution after the audit. The first corrective batch is locally validated: [remediation status and exact remaining C0 slices](remediation.md), [validation evidence](remediation-evidence.json). C0 remains `◐`; no C1–C6 gate has been crossed. Keep this dependency sequence; resume at the remaining slices in the status record rather than repeating the original counterexamples.

## Execution rules

1. Correct the shared boundaries before adding more verbs/decision kinds. Retain the current pure-core/ports/pipeline architecture. Introduce no general workflow engine, scheduler, custom parser framework, model router or host replacement.
2. Each slice starts with the failing behavior test, then the smallest correction, then its affected consumers. Use real Git, processes and signals for those boundaries. Unit-only tests cannot establish recovery or index safety.
3. Each implementation PR names requirement IDs, input/output/stored-state impact, failing fixture, passing negative control and UAT. A fixture must prove the requirement, not merely mention its ID. Use exact runtime outputs in evidence.
4. Run targeted checks during the edit loop; run `npm run ci` before calling a slice locally validated. Add artifact/UAT checks relevant to the changed contract. Record local versus CI versus host evidence separately. Run privacy checks before a requested commit/push; never commit or push without the owner's request.
5. Update plan dashboard/checklist and an evidence-linked §13 entry when a gate changes. Preserve old log entries as historical observations. Do not mark qualification from a test count.

## C0 — Restore integrity of the existing slice

Latest local checkpoint (October 20): **532 tests / 113 suites**, twenty-nine built-bundle scenarios on Node 26.3.0 and minimum Node 22.12.0 against the same hash. Project-file admission, atomic publication and policy-aware recovery have local controls. [Corrections, validation caveat and exact remaining slices](remediation.md). C0 remains `◐`; this evidence does not qualify a milestone. All host runs are deferred by the owner’s October 20 steering.

**Priority: immediate.** This is corrective work within the existing implementation, not a new feature phase. In particular, do not use Tenet's current `checked-local` result as the sole assurance for fixing Tenet.

Work through these bounded slices. Split a row only when it has genuinely independent behavior; do not mix cosmetic refactoring into the fixes.

| Order | Slice and files | Required counterexample tests | Exit evidence |
|---|---|---|---|
| 1 | State admission and schemas: `store-fs`, record schemas; F07/F17 | Symlinked `.tenet`/internal files; markerless import; unknown grant/consent; corrupt state with stale grants; oversized input | No unauthorized external write or imported authority; backup mode suspended; precise integrity errors |
| 2 | Pipeline owner/busy/finalization guards and recovery: pipeline, open/stop, every job; F03/F16 | Parked A versus owner B; planning handle attempts edit effect; resume during live check/commit/install; stale generation finalizes; unknown effect on second call | One editing owner, one live job per contract; no late publication; uncertain resources remain fenced |
| 3 | Inventory, authorship and inspection safety: Git adapter, exclusions, facts; F02/F05 and read side of F09 | Concurrent human file inside predicted scope; flagged/ignored input; custom no-read/no-send; stateless clean filter; secret stat drift | Exact human content/index preservation; no configured programs in unconsented review; truthful candidate identities |
| 4 | Receipt and baseline proof: normalizer, receipts, obligations, verdict; F01/F04/F14 | No distinguishing test; fail-on-baseline boundary; skipped example; duplicate/overflow report; killed process; helper/test weakened after red | Every false-success reproduction now fails closed; valid red→green and preservation controls still pass |
| 5 | Existing Git mutations: branch creation, commit/index sync, integration, undo; F08/F09/F16 | Distinct stacked contracts; current mode; hook/signing changes; foreign unstaged edit; hanging hook; kill at index-sync rename; undo preserves later changes | Existing operations carry their full specified safeguards; no duplicate/unknown mutation hidden as absent |
| 6 | Policy/authority/risk and budget admission: config, reconcile, grant, risk, budget; F06/F10/F12 | Malformed policy; tighten protection after open; actual auth/migration diff; chat-only grants; fourth attempt/third review/third retry | No unsupported authority; changed restrictions apply before next action; deterministic caps block admission |
| 7 | Review and result honesty: manifests, findings, verdict, finish; F13/F18/F19 | Broken recheck chain; semantic caller sample without types; unresolved dependencies; missing focused review; all reasons visible; branch review | Coverage cannot be promoted by missing metadata; supported scopes/labels exact; unavailable features explicitly refused |
| 8 | Gate/tool conformance: coverage/lint/example fixtures; F20 | SEC-13 now reachable; malformed decision body; invalid emitted guidance; missing required reason fixture; milestone advancement | CI detects the repaired defects and no longer hides Alpha safety work behind an M0-only tag gate |

Execution dependency: 1 → 2 → 3 → 4. The mutation portions of 5 require 2–4. Policy/authority admission in 6 relies on 1–3; review/result work in 7 relies on 4–6. Gate fixtures grow with each slice; row 8 finalizes them. These dependencies are more useful than completing one entire directory at a time.

**C0 gate:** the audit's reproduced counterexamples are converted to passing regression tests of the correct behavior; source-confirmed P1 issues in affected operations are dispositioned/fixed; the existing walking skeleton and injected failures still pass; no newly shipped operation lacks its safeguard. For an unbuilt optional stage such as committed-tree checks, refuse the stage until implemented or formally cut with its narrower claim. Never produce a receipt for a stage that did not run.

## C1 — Close feasibility and qualify the M0 path

**Start coordination now; run dependent checks after C0.** The remaining uncertainty is product feasibility, not just missing code.

- Name technical, UX/evaluation, security and release owners, plus QA/calibration responsibility. One person may hold multiple roles; record the implications for independence. Resolve evaluation account/budget, license/name and single-maintainer review policy before their dependent campaigns/publication.
- Finish **SP-08 first**: record exact VS Code, Copilot extension, harness, OS/arch, Node/Git, model/configuration and settings. Observe fresh isolation, permitted tools, `usages`, outside-workspace manifest read behavior, native questions, parallel readers and failed/cancelled/dead children. A failed consequential fresh review reopens the documented architecture decision; it is not replaced by same-session review.
- Complete **SP-01/SP-02**: native install/remove/update behavior, long terminal command, stable kernel location, writable run/plugin/user storage, instruction loading, host indexing limits, token-estimator measurements. Record fallback behavior as explicitly as successful behavior.
- Re-run the missing **SP-06** cases after fixes: filters/flagged/sparse files, real hook managers, a second live stager, Tenet killed mid-sync and split-index fallback. Recheck inventory on the frozen 10k/100k fixtures.
- Disposition **SP-10** for the actual shipped adapter range. Narrow unsupported versions/configs until measured; add later normalizers with their conformance fixtures rather than claiming them early.
- Add a small capability descriptor/Host seam using observed/static/probe provenance. Do not infer L4, approval mode, containment or review observation from defaults.
- Drive the **built installed bundle** through the real M0 path: open → basis → baseline → implementation → checks → real fresh review → commit/finish, plus overlapping human edit, killed check and interrupted commit. Verify tool restrictions/isolation, not only a `subagent-fresh` string.

**M0 gate:** all 34 M0 Musts pass their appropriate tiers on the recorded tuple; current safety regressions are included; the starter scaffold's required checks run through the kernel; evidence and recovery statements are truthful. Recalibrate the remaining estimates from this actual gate, not from test count.

Before expanding transport work, run **SP-12**'s safety gate and prescribed feature/bug/review-then-fix comparison. Choose the shipped frontend by the specified rule. Keep the CLI in the repository as the deterministic harness if MCP ships. A working CLI does not authorize skipping the measurement, and a prototype MCP is not a reason to maintain two shipping transports.

SP-04/05/07/11 and participant recruitment can proceed alongside the next stages when separately authorized. Observer hooks remain absent unless SP-03 passes. No host/model behavior is considered observed from documentation alone.

## C2 — Complete the smallest honest build-and-check path

Before widening decision kinds, establish a single reusable obligation/execution path that both brownfield and starter work use.

1. Compose acceptance, recipe, adopted-policy and trait obligations. Validate discharge by kind/population, not command name. Finish semantic envelopes and fingerprints; declare environment/data/output inputs. Commands without a known/authorized envelope cannot produce checked evidence.
2. Add **TypeScript and ESLint** normalization first because TS §12.2 already requires them for scaffold checking. Move their validation out of the external test-only shortcut and into kernel receipts. Add static/build kinds with meaningful analyzed populations/artifacts.
3. Add **Playwright/axe** with fresh run DB, ephemeral loopback port, owned server token, fresh build/source binding and cleanup. Reuse this runner path in starter qualification.
4. Complete npm install effect recovery/postconditions, license/script consent and bypass detection. Add pnpm only with manager-specific fixtures and the specified native consent; Yarn 1 dependency verification remains the documented after-install path. Refuse unsupported manager variants explicitly.
5. Add the missing platform/UI shell and create the first **real local vertical journey** through normal feature work. Demonstrate persistence, validation, object/role authorization and a second read confirming success. Feature domain content still belongs to the per-project plan, not the scaffold template.
6. Wire default migration backup and the tested restore/ownership protocol before relying on data recovery. Fix the small platform request/start/shutdown issues in F22. Add OpenAPI from the shared schemas.

**Exit:** a user can scaffold and build one small runnable slice, with all promised tests/lint/types and affected browser/accessibility checks genuinely receipted. No API/UI/auth assurance comes only from a helper test or hidden test endpoint.

## C3 — Finish intent/configuration as an end-to-end feature

Follow plan §7.2 using consumers, rather than treating a catalog/registry as completion.

- Complete intent projection updates, exact preview/source binding, dirty-file consent, reverse reconciliation and branch-specific adopted intent. Retain amendment/supersession history and compute impact through existing links.
- Write MADR decision files; update architecture/hardening documents from accepted changes. Implement designated sources if retained for R1, with previewed managed regions.
- Finish all twelve catalog consumers and provenance: personal/task/project resolution, active-work restrictions, command invalidation, required-check union, `branching: current`, integration and resource mode. Unavailable durable/user scope must be stated explicitly, not silently given a different meaning.
- Complete the one-call known-answer basis/plan case without weakening facts binding. Record CLI decisions as reported; only qualify elicited capture after observing that transport.
- Add the charter in the observed loaded instruction file and preserve a no-edit prohibition as such. Never replace it with ask-before-edit semantics.
- Finish lesson/forget/delete/cleanup/export kinds only together with their complete storage-copy and privacy behavior in C5. Finish remote/publish only with exact-commit authority, approval-mode gate and effect reconciliation; otherwise keep it unavailable.

**Exit:** a successive-change scenario edits the plan/requirements/settings, updates projections, respects tightened rules immediately, switches branches, loses local state and recovers adopted meaning without transferring grants or passing receipts. Commands and prose examples parse and perform the advertised effect.

## C4 — Complete Alpha behavior and evaluation foundation

- Ship the one read-only Analyst with researcher/architect/security role contracts, bounded assignment context and stale-result reconciliation. Prove independent revision-bound readers; resource mode changes optional dispatch only. Do not split agents before golden tasks show a reason.
- Make required Deep architecture/security evidence real. Add the model/capability records and truthful unknown labels. Do not build a router or paid fallback.
- Implement review-only branch/document/file scopes, retained review context and “fix findings 1 and 3 only.” Make Quick focused review, declined steps, checkpoint/pause/cancel/resume and complete reason reporting executable.
- Return kernel-built demo/reading guide and complete inspection/result/residue views. Test every supported steering action and the four response shapes. Human acceptance stays separate from evidence.
- Build synthetic T2 capture/replay and the **10 Alpha golden tasks**, each with a seeded failure and a negative control. Cover F01–F22 regressions where agent behavior matters. Run **six formative UX sessions**, including screen-reader/keyboard use and the specified interruption/temporary-setting/status scenarios. Correct skill text from those observations.
- Begin dogfooding once the repaired loop can safely support the task. Every escape becomes a regression fixture or golden task with its root cause.

**Alpha gate:** all 100 cumulative Musts pass mapped tiers; SP-12 is resolved; 10 tasks and six sessions are complete; all relevant deterministic safety controls are tested locally rather than labeled host-only. Publish open gaps honestly.

## C5 — Beta hardening and calibrated budgets

Follow plan §8 with no new speculative user surface.

1. Finish Jest/audit/brownfield CLI/library profiles and hostile-parser conformance. Make traits data that contributes obligations/risk/rubrics. Test configuration equivalence and excluded/ignored/output inputs.
2. Complete sealed starting-candidate failure classification and committed-tree checks **or use the authorized cuts below**. Preserve honest `classification-unknown` and working-tree scope. Implement prototype promotion as its own mandatory safeguarded workflow.
3. Complete storage caps/admission/eviction, archive/log compaction, raw-artifact expiry, schema migration with approval/backups/rollback, copied/lost-state reconstruction, pinned-version reconciliation, lessons and all-copy forgetting. Never compact away active authority/effects/findings/locks.
4. Extend every real-OS crash/race/privacy/update case to the full operation set. Finish SP-07 before public Beta. Add observer hooks only if SP-03 qualifies them; prove zero-write stateless suppression if shipped.
5. Freeze fixture sizes and collect latency/storage/token/active-time baselines. Complete resource accounting and Deep preview. Measure before optimizing; remove overhead without demonstrated value.
6. Complete formative calibration and get every required owner sign-off before freezing thresholds. A permissive threshold change after seeing qualification results is not calibration.

**Beta gate:** all 158 cumulative Musts pass, full continuity/fault matrix passes, calibrated protocol is frozen and signed, update/removal is rehearsed. Safety failures cannot be hidden by an aggregate score.

## C6 — R1 qualification and release

Follow plan §9. Plan/recruit these activities early so they are not all waiting on the last code PR.

- Starter: published ASVS applicability/results, all journey states and authorization, automated accessibility plus keyboard/VoiceOver, concurrent separate-process reservation invariant, crash-tested backup/restore, workload and degradation trends, dependency notices and refresh ownership.
- Evaluation: **30 public and 10 reserved tasks**, frozen repetitions/model strata/negative controls, the three-step successive-changes comparison against a competent native baseline, one bounded maintainer improvement experiment, monthly/model-change qualification procedure and model table.
- Human evidence: **8–12-participant counterbalanced crossover pilot**, the specified active-effort/comprehension/misreading metrics, consent/retention and two-week escaped-defect follow-up. Include unsuccessful/blocked/cancelled outcomes and uncertainty. A CLI/SDK proxy cannot replace native-host qualification.
- Release: license/attribution/contribution/security/support/quickstart/troubleshooting/removal docs; exact executable inclusion list; SHA-pinned CI actions; reproducible double build; payload hashes/location verification; signed tag and provenance; independent rebuild/install check; solo-maintainer review window or second-maintainer review; separate source-tree and reachable-history privacy audits. No untrusted CI artifacts flow into live/release trust.
- Obtain release-owner and product-owner approval against **all 181 Musts and all 19 due Shoulds** (or owner-signed Should omissions). The R1 increment itself contributes 23 Musts and 16 Shoulds. Publish unresolved non-applicability and residual risks.

**R1 gate:** plan §9.6 / PRD §4.7 exactly. AC-07/11/16/17/25/27/28 safety cases remain never-waivable. A permitted value/experience exception withdraws the precise claim, disables the affected capability and releases as “R1 (limited).”

Post-release: qualification cadence, separately labeled smokes, monthly starter dependency refresh, security response, escape fixtures and one measured improvement cycle. Python/extra hosts/OSes/deployment wait for their own later conformance gates.

## Cuts and sizing

Use the existing cut list in its stated order when measured capacity requires it:

1. Committed-tree checking → keep the working-tree-with-human-edits scope.
2. External CI import → no `ci-external` capability.
3. Sealed baseline classification → `classification-unknown`, never inferred pre-existing.
4. Recipe upgrade automation → manual migration guidance. Prototype promotion stays mandatory.
5. MCP implementation only if CLI wins SP-12; retain the CLI repository harness if MCP wins.

Do not cut safe state admission, human attribution/index preservation, verdict/receipt integrity, exclusion handling, required review, bounded execution or the actual milestone acceptance evidence.

The original plan's **remaining Alpha + Beta + R1 envelopes total 15–20 weeks**, before reassessing unfinished M0 repairs/host gates, with considerable uncertainty for one maintainer. They are planning ranges, not a fresh estimate from this audit. Re-estimate after C0/C1 using completed vertical slices and observed session throughput. Recruit the pilot cohort and resolve ownership/funding immediately; the two-week follow-up and formal host campaigns cannot be compressed by coding faster. The fastest reliable path is to reduce unsupported optional scope and avoid rework, rather than add more partially guarded operations.

## First concrete handoff

Start with C0 rows 1–4. Convert A02/A03, A08, A16/A14/A15 and A01/A05/A06 into failing tests for the desired behavior. Correct those shared boundaries, run CI and built-bundle UAT, then complete SP-08 and the repaired M0 loop. That establishes the foundation on which the rest of this plan can proceed safely.
