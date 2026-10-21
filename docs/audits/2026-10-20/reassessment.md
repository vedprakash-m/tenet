# Tenet implementation reassessment

2026-10-20 · audited GitHub main: `d457714d7ba321b8b5bf533dcf8e9d46e930c22f`

**Later local follow-ups:** the [Git safeguard](filter-jobs.md) passed its 607-test/38-scenario checkpoint. The [static and composition safeguard](static-integrity.md) now passes 641-test CI and all 45 built-CLI scenarios on both runtimes. These are bounded local corrections, not whole-requirement qualification. Counts below describe the earlier reassessment snapshot unless marked as follow-up.

## Assessment and scope

Tenet has a substantial local engineering loop, including a real starter that now runs tests, types and lint through the kernel. It is still an unfinished M0 qualification with Alpha implementation ahead of that gate. No milestone is qualified. Do not interpret the number of tests, registered commands or requirement tags as a completion percentage.

This reassessment includes the cloud agent's work. The initial checkout was `e0bc1a0`; GitHub main and `claude/beautiful-fermat-v2mtbl` were both twelve commits ahead at `d457714`. There were no pull requests in the repository when checked through the GitHub API. The clean checkout was fast-forwarded to that main, without making a new commit or writing remotely. [GitHub run 39511805902](https://github.com/vedprakash-m/tenet/actions/runs/39511805902) passed Ubuntu and macOS jobs, including full CI and built CLI scenarios on development and minimum Node versions. This is actual remote evidence for that commit, not evidence for subsequent local fixes.

Reviewed the canonical PRD, technical and UX contracts, implementation plan, repository quality instructions, earlier audits and their remediation; inventoried every source/test module; traced admission, recovery, authority, policy, Git, execution, evidence, review and result paths; reviewed the twelve cloud commits, plugin guidance, starter changes and engineering gates. The earlier audits remain useful for unchanged code. This is a broad source and behavior review, not a claim to have proved every possible execution or independently reviewed third-party package source. No host/model spike, deployment, vulnerability-database campaign, human study or release campaign ran. Host runs remain deferred.

This chat contributed to earlier corrective implementation, so this is not an independent fresh-context qualification. The reproduced failures and exact gate results are stronger evidence than reviewer confidence; external semantic review and milestone qualification remain necessary.

The [200-requirement inventory](requirement-inventory.json) covers all 181 Musts and 19 Shoulds due by R1 and records current source/test references. A reference is explicitly not a proof. Final local validation and exact artifact identities belong in [reassessment-evidence.json](reassessment-evidence.json); the older October 19 evidence describes older checkpoints.

Initial reassessment outcome: R01–R03 have corrections and twelve new red-first regressions. Full `npm run ci` passes **591 tests / 130 suites**, with no failures/skips. All **33 built-CLI scenarios pass on Node 26.3.0 and 22.12.0** against the same 709,447-byte artifact (SHA-256 `3fb2f15d15e529a70cf698bf71988ad9989e675d652265979d6ffd132a6dcf1e`). Types/lint and the actual starter run in CI; Quick reviewer data and the hostile lint child in UAT are synthetic protocol controls, not host/model qualification. Corrections are uncommitted. R04–R12 remain open.

An intermediate 587-test run caught a helper simplification that unnecessarily published state on repeated finish. Restoring unchanged-contract identity fixed that regression; the existing no-publication control and final full suite pass. No assertion, timeout or quality ceiling was weakened. This failure and the earlier initial-local 545-test baseline are retained in the evidence rather than omitted from validation history.

## Progress that is supported

| Area | Implemented and exercised locally | Still pending |
|---|---|---|
| Architecture and quality | Pure core, ports, common pipeline, one verdict/counter implementation; strict unused-code checking; short-function/complexity/width ratchet; major recovery/check/open/pipeline refactors | Eight grandfathered function offenders; 308 wide lines; group size above the owner's target; semantic conformance and proof review |
| State and recovery | Inode-bound quarantine with fresh/metadata-only choice; private records/artifacts; generation handles; durable accounting; source/run fences; real killed commit/index/adopt/scaffold/undo/integration tests | Backup reconfirmation; unknown-cost/process reconciliation; migration; aggregate retention; bounded log/project reads; remaining branch/init/shadow/manual-repair races |
| Git and human edits | Explicit authorship; human dirty-file decisions; temporary-index commit and journalled index sync; local integrate/undo; filter-neutral inspection; consent before configured filters; locally guarded staging (follow-up); hook consent and foreign-file observations | Transforming filtered commits; complete configuration/signing consent and hook rechecks; guarded checkout; filter-aware integrate/undo; full fault qualification |
| Checks and verdict | Vitest receipts and distinguishing baseline; test/support locks; required TypeScript/ESLint execution; stale/terminated/invalid evidence fences; missing focused review blocks; honest declined-step result | Complete static population/configuration proof; execution envelopes; alternative obligation discharge; Jest/browser/audit/build/manual kinds; sealed baseline and revised-proof restoration |
| Review | Quick focused pass; Standard reservation/result binding; root/recheck coverage; bounds on full contract manifests; named-findings fix intake and stray-file attention | Analyst and required Deep evidence; split coverage accounting; stateless packet bounds; export/caller escalation and type proof; host-observed isolation/tools; stronger selected-finding identity/scope checks |
| Intent/configuration | Basis, overview, plan, decision records, managed-block adoption, restrictions and twelve-setting catalog; current-branch/integration consumers; decline and boundary-example note | Projection round trip; branch-aware shared intent; MADR files; charter and personal settings; full setting consumers; conflicting obligation definitions; lessons/forget/export lifecycle |
| Starter | Fastify/SQLite platform; sessions/CSRF/password controls; migrations with default backup; byte-safe secret comparison; kernel-run tests/types/lint; scaffold reaches checked-local | UI shell, real domain journey and object/role authorization; restore protocol; OpenAPI; browser/accessibility/workload harness; request/startup/shutdown qualification |
| Delivery | Read-only untrusted CI on Ubuntu/macOS; built CLI UAT at minimum Node; ignored build artifact documented; structural coverage and privacy tools | Frozen host tuple, remaining spikes, T2 replay/golden tasks, UX sessions, calibration/pilot, signed release/provenance/install/update chain, owners/licence/name |

The cloud work closes several earlier omissions: types/lint no longer run only in the test harness; unused global LFS configuration no longer blocks inspection; a scaffold no longer becomes permanently uncheckable merely because its own vetted files include authentication/migrations; user-declined steps and named findings now have mechanisms; minimum-Node CI drives the bundle through real repositories. Those should not be reported as wholly unbuilt anymore.

Current structural coverage is:

| Cumulative milestone | Musts | Tagged | Host-only bucket | Unmapped |
|---|---:|---:|---:|---:|
| M0 | 34 | 30 | 4 | 0 |
| M0 + Alpha | 100 | 76 | 9 | 15 |
| Through Beta | 158 | 90 | 13 | 55 |
| Through R1 | 181 | 91 | 16 | 74 |

The fifteen unmapped Alpha-or-earlier IDs are INS-04, INT-03, WRK-10, AGT-03, AGT-05, SEC-04, RSC-01/02/03, QLT-01/09/12, ENG-02/04/10. Mapped rows can still be partial. For example TDD-03 needs a real test-alongside negative-control path; EVD-13 concerns isolated data/server execution, not merely refusing committed-tree checks. The earlier tag criticisms have not been resolved by the refactors or extra tests.

## Disposition of the original audit

This reconciles every F01–F22 row with current work. “Counterexample corrected” is deliberately narrower than “requirement complete.” The original report and red reproduction driver remain historical.

| Finding | Current disposition | Remaining work |
|---|---|---|
| F01 baseline proof | Original false-success cases corrected | Test-alongside and restored revised proof; R05/R06 |
| F02 human attribution | Predicted-path authorship removed; original control corrected | Broader human/hook postconditions; R04/R08 |
| F03 owner/job fences | Shared owner, generation and launch/finalization fences added | Unknown-process reconciliation and remaining Git races; R08 |
| F04 hostile reports | Vitest population/shape controls added; R02 corrects the new lint counterexample | Complete static conformance; R05 |
| F05 input identity | Flagged/declared ignored inputs and known configuration absences covered | Declared outputs, module/nonstandard inputs, case/Unicode; R05/R08 |
| F06 risk/authority | Actual-path floor and protected-grant controls added | Full authority/envelope consumers; R06 |
| F07 store/backup admission | Copied/markerless state quarantined, authority suspended, accounting conserved | Reconfirmation, migration, retention; R07/R08 |
| F08 successive branches | Distinct branches, stacking disclosure and current mode covered | Full branch/init/shadow lifecycle; R08 |
| F09 configured Git effects | Filter-neutral reads, filter/hook consent, bounded commit and journalled index sync added; guarded staging locally validated (follow-up) | Transforming filtered commits and full qualification; signing/hooks/rechecks; R04 |
| F10 policy changes | Malformed policy refuses; R01 closes tightened adopted-policy ordering | Conflicting definitions and full consumers; R06 |
| F11 omitted execution | Kernel types/lint added; unsupported stages refuse; R03 prevents configured substitution | Actual populations/envelopes/browser/build/audit and other consumers; R05/R06 |
| F12 budget admission | Attempt, round, delegation/retry admission controls added | Split rounds, active time and full token accounting; R06/R10 |
| F13 review chains | Root/recheck bindings and required coverage controls added | Semantic callers/exports, split coverage, host observation; R10 |
| F14 revised locks | Revision invalidates proof and retains provenance | Baseline restoration/revised-proof workflow |
| F15 shared intent drift | External blocks preserved and changes reported | Bidirectional projection, branch intent, MADR/charter consumers |
| F16 unknown effects | Uncertain postconditions remain fenced; result replay added | Remaining effects and reconciliation UX; R08 |
| F17 size/privacy | API/stdin/state/report limits, private storage and bounded redaction added | Project/log/blob/aggregate bounds and cleanup; R07 |
| F18 steering/results | Decline, takeover and initial selected-fix mechanisms added | Complete result/progress/checkpoint/active-time UX; R09/R10 |
| F19 advertised surfaces | Unsupported workflows now refuse; schemas/guidance updated | Semantic examples/next-action closure, remaining consumers |
| F20 gates | Quality ratchet, unused-code checks and minimum-runtime UAT in CI added | Semantic proof ledger and qualification; R11 |
| F21 default migration backup | Default backup before later migrations implemented and tested | Verified restore/ownership and wider data qualification; R12 |
| F22 starter gaps | Byte-safe CSRF/session comparisons added | Server lifecycle, request deadlines, real journey and performance; R12 |

## Findings and dispositions

P1 means repair before relying on the affected integrity/completion claim. P2 means material incompleteness to close at the owning milestone. “Source-confirmed” does not mean every failure variant was reproduced.

### R01 · P1 · Tightened adopted restrictions arrive after recovery

**Reproduced on both local and cloud heads.** Adopt `{}`, kill scaffold after its first write, then change the adopted policy to no-read/no-edit that file. `open investigate` returns exit 0 and reports rollback; the partial file is deleted. `planInLock` calls `configurePolicy` before recovery, but `sharedPolicy` returns the old adopted restrictions. Reconciliation of the changed file occurs afterward. Read-only settings similarly omit the new restriction. This violates SEC-08/12 and CON-03, including the non-waivable privacy/recovery intent.

**Correction in this slice:** resolve the existing structural effective policy before adapter admission, including recovery and read-only views. Tightening applies immediately; removed or incomparable restrictions remain pending acceptance. Real SIGKILL and read-only regressions were red first. No new authority, command or permission is inferred.

Locations: `verbs/reconcile.ts` (`sharedPolicy`), `pipeline-mutate.ts` (`planInLock`), `verbs/recover-effects.ts` (`scaffold`).

### R02 · P1 · Contradictory ESLint output can become passing evidence

**Reproduced on the cloud head.** `normalizeStatic('eslint', {exit: 1, raw: '[{"filePath":"src/a.ts","errorCount":1,"messages":[]}]'})` returns `pass`. The parser checks the exit against the summary count, but derives pass/fail from the displayed messages. Negative/fractional counts and malformed diagnostics also escape validation; messages after the five-example cap are not validated.

**Correction in this slice:** require nonnegative integral error counts, validate all diagnostic severity/message fields and compare each file's error count to its actual error population. Only display examples are capped. Contradictions become `report-invalid`/inconclusive, never passing receipts. New controls include malformed messages beyond the display cap and an actual synthetic child through the built CLI.

Locations: `adapters/node-ts.ts` (`normalizeEslint`), `core/receipts.ts` (`staticReceipt`).

### R03 · P1 · Required static configuration/population is silently ignored

**Reproduced with real tsc and finish on the cloud implementation.** A required `types` check declares `configuration: 'tsconfig.required.json'` and `population: 'server/**/*.ts'`. The default config includes only the healthy greeting; the named config contains a type error. Kernel receipt: `pass`; finish: `checked-local`; real tsc with `-p tsconfig.required.json`: exit 2. `wantedStatic`/`isStaticCheck` recognize only ID/tool; `staticArgv` runs the default configuration. Policy fields disappear from the derived obligation. Natural-language names are not a discharge proof (TS §9.1/9.2/9.5).

**Correction in this slice:** keep arbitrary configuration, population, pass criteria and alternatives unavailable until their invocation and receipt matching exist. Block these declarations rather than substitute the default. Default intrinsic types/lint checks and recipe checks remain supported. This is a safeguard, not implementation of configured commands/envelopes.

Locations: `core/obligations.ts`, `verbs/reconcile.ts` (`unsupportedExecution`), `adapters/node-ts.ts` (`staticArgv`).

### R04 · P1 · Consented filters run outside the guarded executable-job path

**Locally validated follow-up:** guarded preparation, ordered consent, monitor suppression and stricter recovery pass sixteen new real Git/process controls, final 607-test CI and 38 built-CLI scenarios on both runtimes. [Mechanism, exact evidence and remaining work](filter-jobs.md). Transforming filters remain explicitly unavailable until committed-tree checks exist. This finding is not whole-requirement qualification.

**Original counterexample, exposed by cloud filter support before the follow-up.** `startCommit` calls `git.expectedTree` inside the transaction before journalling the commit or publishing `inCall`. `expectedTree → buildTree → git add` can now run a consented filter. That command uses raw `execFile`, inherited process environment, no process-group runner and no timeout. The commit job builds the tree again before its guarded `runner.run`, so a filter can run twice. A hanging filter can hold the transaction and remain unavailable to ordinary stop/cancellation. Prior consent is necessary but does not supply cancellation, recovery or a minimal environment.

**Corrective scope (now locally safeguarded):** move program-running preparation into a guarded, recorded job and bind its postconditions, or explicitly refuse filter execution until that path exists. Keep filter-neutral reads. Add real hanging/cancelled/mutating filter tests, not just marker/pass-through tests. GIT-12, TS §6.1/7.3/9.3/10.3. Do not silently defer the safeguard while claiming the operation qualified.

Locations: `verbs/commit.ts` (`startCommit`), `adapters/git-cli.ts` (`expectedTree`, `buildTree`, `run`, `commit`).

### R05 · P1 · Static evidence remains narrower than the promised contract

**Follow-up:** [bounded default populations and conformance](static-integrity.md) now retain workspace files, reject malformed/truncated evidence and refuse unsupported versions/configurations. Complete effective-configuration/dependency graphs and composite/reference handling remain open; this is not full EVD-05 qualification.

**Original counterexample, before the static follow-up.** A static receipt did not retain the actual analyzed file/configuration population. TypeScript invocation omits the specified project selection, explicit incremental disable and composite build-info handling. Installed static-tool versions are fingerprinted but not checked against a qualified range. ESLint still lacks duplicate/outside-path and whole-record conformance comparable to the Vitest parser. TypeScript's parser lacks the specified diagnostic-count bound and cannot prove a nonempty analyzed set from exit 0 and silence. The R02 fix closes one false pass; it does not qualify all of EVD-05.

Complete these in one static-adapter conformance slice with empty/excluded populations, project references, incremental/composite configuration, unsupported versions and hostile records. Do not broaden tools until it passes.

### R06 · P1/P2 · Required-check composition and execution consumers are incomplete

**Original counterexample, before the composition follow-up.** `resolveSetting('required_checks')` kept the first definition for a shared/local ID conflict and records a limit, but check admission does not turn that conflict into a blocking reconciliation decision. A local stricter/different requirement can disappear behind the shared definition. Configured commands and nonstatic checks are honestly refused; generic execution envelopes, credential/network unknowns authorization, output/data isolation, trait obligations, dependency invalidation, active-time accounting and complete token accounting remain unfinished. Treat stored declarations and disclosed limits as partial implementation, not consumer completion.

The [composition follow-up](static-integrity.md) blocks same-ID conflicts at admission/verdict and applies metadata exclusions before stateless doctor reads. Existing green/reset and no-state-write controls cover these corrections. The broader execution, accounting and configuration consumers above remain open.

Locations: `core/config.ts`, `core/obligations.ts`, `verbs/reconcile.ts`, `verbs/check.ts`, `adapters/runner.ts`, `core/budget.ts`. Close through A1b/C2, preserving refusal for unsupported cases.

### R07 · P1/P2 · Storage bounds and journal handling are incomplete

**Source-confirmed.** Project content uses unbounded `readFileSync`; log reads and torn-tail repair read/split the entire log repeatedly, even when the caller asks for a tail. Blob reads are unbounded. Individual state-record limits do not enforce total `.tenet`, per-project run or machine limits. `sweepTemp` is age-based, not the complete protected-data admission/retention protocol. Orphan atomic temporaries remain excluded but uncollected.

`repairLogTail` also preserves an invalid final record ending in newline: its keep-prefix ends at that same newline. `readLog` silently drops malformed lines without schema-validating effects. This needs corruption/torn-write controls before relying on arbitrary journal recovery, not a claim that every malformed line means no effect occurred.

Locations: `adapters/project-fs.ts:content`, `adapters/store-fs.ts:repairLogTail/readLog/readBlob/sweepTemp`. Implement bounded reads and durable bounded compaction while preserving unresolved intents, counters, grants, locks and owners. TS §7.4/7.6/14.2.

### R08 · P1/P2 · Remaining recovery UX and races need explicit qualification

Backup reconfirmation and unknown-cost/process reconciliation remain unavailable. Unknown cases conservatively fence work, which prevents false recovery but can strand it. Quarantine content adoption is explicitly unavailable; this is an honest refusal. Schema migration is not implemented. Manual `repairLock` checks records and later removes by path without a complete exclusion protocol; branch/init/shadow operations and concurrent parent/path replacement still need their scheduled real-process races. Case-insensitive/Unicode path matching is incomplete.

The existing crash suite is valuable evidence for named boundaries, not the entire crash/race matrix. The §12.5 Beta deferrals do not qualify exposed operations against their mandatory safeguards. Preserve fences and keep the residual cases visible.

### R09 · P2 · Named findings are an initial mechanism, not full context/scope reuse

**Source-confirmed.** The cloud implementation accepts copied findings rather than retaining a review identity; duplicate finding numbers are not rejected. The stray-file rule exempts any path present in `vetted`, rather than only unchanged vetted content. An edited vetted file outside the named findings therefore deserves a regression. Unexplained files depend on the separate authorship question rather than this scope check. Test duplicate IDs, stale review context, changed vetted paths and explicit scope extension; then measure the actual review→selected-fix journey. RES-06 remains partial despite four happy/negative source tests.

Locations: `core/schemas.ts:NamedFinding/OpenInput`, `verbs/open-new.ts:draft`, `verbs/check-evidence.ts:attentionOf`, `test/fix.test.ts`.

### R10 · P2 · Review completion and host capability remain incomplete

No Analyst is registered, so required Deep Architect/Security passes cannot be obtained. `findings` settles each partial/full response as a review round; split-coverage follow-ups do not yet share the specified round. Stateless `reviewOnlyManifest` has no equivalent complete packet budget check. Export-driven escalation, caller coverage/type proof, full packet capability fields and host dispatch observation are unfinished. A reported `subagent-fresh` value is not proof of fresh isolation. The reviewer allowlist currently names read/search; `usages`, restrictions, outside-workspace packet access and failed/cancelled/parallel children still need SP-08 observation.

Locations: `verbs/findings.ts`, `verbs/manifest.ts`, `core/review.ts`, `plugin/com.github.copilot/agents/`, `ports/types.ts`. Complete bounded local semantics first; run each host spike only after authorization resumes.

### R11 · P2 · Engineering gates and progress reports still overstate some things

The architecture and quality ratchets pass, but they are structural checks. The group ceiling is 204,790 non-whitespace characters against the declared 172,800 target (about 18.5% over at the audited head). Eight function offenders and 308 wide lines are grandfathered. The new local corrections do not raise any ceiling. Decisions to re-baseline or remove behavior remain owner decisions; do not hide growth by increasing the record.

Coverage sees tags and reason-code string references, not assertion semantics. Review the partial/misleading tags called out in the earlier independent review and maintain full/partial/host proof separately. The October 19 ledger and evidence are historical; the current dashboard and completion plan need links to the cloud CI and this reassessment, with current counts. “569 tests” is stale against the later cloud log's 579. Local fixes require their own evidence.

### R12 · P2 · Starter, release and evaluation remain substantial work

The scaffold's baseline platform now has stronger local checks, backup defaults and safe byte comparisons. It still lacks the promised UI/domain vertical journey, object/role demonstration, restore ownership protocol, OpenAPI, browser/axe and workload measurements. The main server supplies a DB to `buildApp`, whose close hook only closes DBs it creates itself; signal handling and injected/default DB ownership need a real startup/shutdown test. The configured request timeout needs actual slow-handler qualification. Authentication helper tests do not establish the end-to-end product journey or performance targets.

No frozen qualified host tuple, T2 replay campaign, ten Alpha golden tasks, six formative UX sessions, Beta failure campaign, calibrated release/pilot, signed package provenance/update path or named release/UX/security/evaluation owners is established by these local tests. These are real completion dependencies, not more rows that unit tests can turn green.

## Efficient completion sequence

1. **Finish this integrity slice:** R01–R03, targeted negative/positive tests, full CI, built CLI on both runtimes, exact evidence. Do not mix unrelated refactors or tool expansion into it.
2. **Guard Git programs next:** R04 plus changed-hook/signing configuration and postcondition controls. Use the existing runner/job/intent protocol; no new scheduler. Refuse any path whose safeguard is not ready.
3. **Complete one obligation path:** R05–R06, actual static populations/configuration, version/conformance checks, conflict blocking and command/envelope consumers. Keep arbitrary commands unavailable until complete. Reuse it for starter and brownfield work.
4. **Finish bounded recovery/admission:** R07–R08, project/log/blob bounds, corruption controls, retained accounting/effects during compaction, backup reconfirmation and unknown-process UX. Keep broad race qualification and approved Beta deferrals explicit; test each shipped effect under its actual callers.
5. **Finish local review/result and intent consumers:** R09–R10, selected-fix context, split rounds, packet bounds, semantic coverage, charter/configuration projections, checkpoints and active time. Use one registry/path per concept, with proof reviewed as semantics rather than a tag count.
6. **Close C0 against its gate, then qualify M0:** authorized SP-08 first, SP-01/02, SP-06/10 dispositions, exact tuple, installed walking skeleton and SP-12 transport decision. Local work can continue while host authorization is deferred; observation cannot be fabricated.
7. **Complete Alpha vertical product and evaluation:** Analyst/Deep evidence, starter UI and one real persisted journey with denied access as the unauthorized identity, restore/browser/axe/workload checks, T2 replay, golden tasks and UX sessions. Recruit people early because they are an external dependency.
8. **Beta → R1:** finish lifecycle/retention/export/migration/remote safeguards, failure and performance campaign, calibration/pilot, licence/name/owners, signed release/install/update/removal, and the formal acceptance ledger.

The [updated completion plan](completion-plan.md) turns this order into exit criteria; the earlier [C0–C6 plan](../2026-10-19/completion-plan.md) supplies the broader dependency structure. Static checking, decline, selected-fix intake, boundary notes and starter backup have started; they are not wholly missing. Avoid a calendar promise until C0 and the host tuple are measured. Finish one reviewable behavior slice with its safeguard and evidence, then take the next.
