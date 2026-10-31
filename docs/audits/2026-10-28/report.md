# Tenet implementation audit — October 28, 2026

> Synchronized update: read [synced-reassessment.md](synced-reassessment.md) first. GitHub main advanced to `8b7bbc4`; this report’s baseline measurements are historical. The update corrects storage-policy, documentation and approved-repair progress and controls the next implementation order.

## Assessment

Tenet has a substantial, tested local engineering kernel and a partially implemented product around it. It is **not yet an R1 candidate**. Finish the existing safety and continuity workflows before expanding the execution surface. Preserve the current kernel, ports, tests and starter platform; a rewrite would discard valuable preservation and crash-recovery work.

The initial source baseline is `159caab650dbf38a50409c32ade3d29c0cd98efb` on `main`, with pre-existing modifications to `specs/plan.md` and `specs/sealed-baseline.md`. Those modifications record owner decisions 40–42 and inherited worktrees; they were preserved. This audit includes subsequent local repairs described below, not a new commit or a remote CI result.

The review covered the canonical requirement/mechanism/UX contracts and current handoffs; all production areas (111 kernel TypeScript files, about 12,750 physical lines), the evaluation helpers, plugin instructions, starter platform, CI/build/release tools, test evidence and inherited-work inventory. Detailed tracing concentrated on evidence production/consumption, authority, effects/recovery, Git preservation, configuration and release honesty. This is a broad source and execution audit, not a claim that every path is proved or that no additional defects exist. It did not run native-host spikes, model calls, human studies, release publication or protected evaluation campaigns. This report also does not supply independent review of its own repairs.

## Continued counterexample repairs

The continuation found three additional existing failures, all reproduced before the repair:

- **Output definition (AC-07/AC-27, raised immediately):** stable-ID output additions/removals retained an old red and reached checked-local after fresh review. Outputs also did not change check-input identity when no output existed. Identity and baseline comparison now include the declaration. Real workflows prove invalidation, unchanged-definition preservation, no premature locking and recovery through a new red.
- **Recovery refusal revision:** a killed forget followed by an unknown effect produced a refusal at revision 5 while disk had reached 8. Rendering now uses the actual published transaction state; repeated uncertainty does not publish again.
- **Incomplete forgetting:** unreadable packet files/directories, failed deletion, oversized records and inaccessible temp parents could be treated as no copies, permitting successful forgetting with residual copies. Packet reads now reuse bounded no-follow private reads; only absence is ignored, and other errors retain the lesson and unresolved intent until recovery succeeds. Invalid UTF-8 also refuses safely.

These repairs do not activate schema 2 or complete the remaining product workflows. Current continuation evidence is recorded separately in continuation-validation.json. The [protocol review packet](protocol-review.md) identifies the remaining typed-launch, ownership, acknowledgment, settlement, reference, recovery and capacity obligations; it is preparation for independent review, not a self-issued sign-off.

## Starter account UI update

The October 28 starter slice supersedes the earlier “API only/no React UI” finding for account access. `ts-web-api@0.2.0` now has the specified React/Vite shell, fresh server-confirmed sign-in/out, reload persistence, retained-input validation/errors, loading/retry and duplicate guards, with axe and keyboard/focus assertions. Eleven real browser/API cases pass on current and minimum Node; 45 starter unit/integration cases and actual kernel scaffold/receipt/commit/Chromium-cancel controls pass. The existing loan backend evolution remains valid. Exact final full gates, the 78-file payload and dual-runtime UAT are in [starter-ui-validation.json](starter-ui-validation.json).

The following local domain increment adds the fixture-only Equipment journey, actor-scoped paginated own-loan reads, fresh reserve/return confirmation, real two-context conflict/owner/role checks and admin overview. Four domain browser scenarios preserve the eleven platform/server cases; 53 unit/integration cases, types/lint/build and all 15 browser cases pass on current/minimum runtimes in targeted checks. Final full CI passes 1,237/202; 148 built UAT scenarios plus the complete built-CLI domain journey pass on each runtime. See [domain-ui-validation.json](domain-ui-validation.json) for identities and failed-run dispositions. Manual screen-reader evidence, full ASVS/WCAG/workload/OpenAPI and changed-journey obligations remain open. Matching Chromium was already cached; clean-host installation and browser identity binding remain explicit prerequisites/gaps. No schema, kernel authority/cap, native Copilot observation or qualification changed.

The OpenAPI follow-up completes generation in `ts-web-api@0.3.0`: shared runtime schemas, cookie/CSRF declarations and deterministic real-app export without ambient configuration, development database or listener. Both runtimes pass 48 neutral cases and 11 browser cases; the evolved app passes 57 cases and 15 browser cases through the built CLI. Final CI 1,237/202 and 149 built UAT scenarios pass on each runtime; the payload has 81 files and the kernel bundle is unchanged. [Exact evidence](openapi-validation.json) includes equal cross-runtime neutral exports and eleven-path feature discovery. Compatibility comparison/trait/semver consumers remain unimplemented. Clean install reports upstream deprecation of retained ESLint 9.39.1; the checked audit reports zero advisories, not ongoing support or security qualification.

The contention follow-up reproduced and repaired three correctness escapes: five authorized return processes falsely acknowledged one transition, and HTTP session maintenance/sign-out returned 500 under a held SQLite writer. The example return operation now shares one immediate transaction; recipe 0.3.1 uses bounded writes for the two HTTP paths, preserving cookies/sessions on 503 and permitting retry. Both runtimes pass 61 evolved cases/15 browser cases and 149 built UAT scenarios plus the complete feature loop; final full CI passes 1,237/202. Neutral checks are 50/11, the payload has 82 files, and the kernel bundle/dependency lock are unchanged. [Exact counterexamples and final evidence](return-concurrency-validation.json). Workload and broader quality/qualification remain open.

The schema-history follow-up (recipe 0.3.2) closes known-name-only restore validation, retroactive migration admission and postflight-after-commit escapes. A frozen prior-data workflow and destructive-upgrade control now supply the missing local QLT-07 evidence. Final CI passes 1,237/202; both runtimes pass 149 built UAT scenarios and the complete feature loop (neutral 56/11, evolved 68/15 app/browser cases). Payload has 83 files; kernel bundle/dependency lock are unchanged. [Exact provenance, counterexamples and scope](schema-history-validation.json). AC-17 recovery review/platform qualification remains release-blocking; no owner evidence disposition or core migration activation is inferred.

## Measured progress

| Cumulative milestone | Must requirements | Test-tag mapped | Host-evidence bucket | Unmapped | Qualified |
|---|---:|---:|---:|---:|---:|
| M0 | 34 | 30 | 4 | 0 | 0 |
| Alpha | 100 | 90 | 9 | 1 | 0 |
| Beta | 158 | 113 | 13 | 32 | 0 |
| R1 | 181 | 115 | 16 | 50 | 0 |

There are also **19 Shoulds due by R1**, requiring passing evidence or individual owner-signed omissions. `npm run coverage` checks M0 structural mapping, not all R1 obligations. Even the R1 structural report cannot establish semantic completion. For example, LFC-04 is mapped because unsupported-schema admission is tested; migration/rollback is not implemented. Conversely, SEC-15 is unmapped even though envelope consent exists. Neither the tagged count nor the unmapped count is an application completion percentage.

`docs/audits/evidence-ledger.json` still contains zero records. Thus all 181 Musts remain semantically unreviewed in that authoritative ledger and none is qualified. Do not fill it with blanket “complete” entries: its contract requires reviewed evidence and owner approval references. The [200-row inventory](requirements.md) and [machine-readable inventory](requirements.json) are draft working documents, deliberately separate from that ledger.

### What is already useful

| Area | Current implementation | Limit of the evidence |
|---|---|---|
| Kernel architecture | One pipeline, pure core, typed ports, thin CLI, centralized verdict and budget logic; all current architecture/skills/quality gates pass | Lints are structural scanners, not proofs of semantics or host behavior |
| Work and intent | Contracts, confirmed basis/examples, stable IDs, plans, assumptions, decisions, protected paths, lane floors, lessons and impact view | Cross-file projection, external-edit reconciliation and loss reconstruction incomplete |
| Evidence | Behavioral baseline checks, acceptance/support locks, candidate identity, Vitest normalization, static checks, Playwright server checks, conservative verdicts, rerun/flaky controls and declared-output handling | Full configured execution, full effective-input binding, sealed classification and committed checks incomplete; additional Playwright defects reproduced in this audit |
| Effects and recovery | Atomic store, process-aware locks, ownership, journal/accounting recovery, imported-record quarantine, guarded external jobs, many real killed-step tests | Backup reconfirmation and full migration unavailable; incomplete launches/accounting and unsupported programs remain |
| Git | Temporary-index commits, human-index preservation, exact postconditions, bounded hooks/filters, undo/integration, shadow prototypes and layout admission | Configured signing/integration programs, ID-aware shared merges and complete large-repo/hook-manager qualification remain |
| Plugin | Three agent definitions, five skills, commands, bounded manifests, coverage/independence checks, focused review and Deep passes | Real-host tool enforcement, isolation, interruption and complete UX are not qualified |
| Starter | Fastify API, SQLite, validation, session/CSRF/password controls, logging/errors/health, migrations/backups, crash-safe restore | API platform only: no React/Vite UI, browser journeys, accessibility evidence or workload/trend harness |
| Evaluation | Ten public golden fixtures, negative controls, static protocol validation, synthetic helper replay and offline reports | No full six-port/pipeline replay, authorized native driver/protected campaign or human evidence |
| Release engineering | Explicit 66-file payload, exact checksums, pinned CI actions, size gate, two empty-output repeat builds, MIT/NOTICE drafts | Same-source/toolchain repeatability is narrower than independent clean rebuild, installed integrity or authenticity |

## Reproduced defects and local repairs

Priority P1 means evidence/privacy controls can be wrong in a supported path. P2 means incorrect admission/error behavior that prevents a reliable workflow. These are counterexamples, not speculative style findings.

### F01 — P1: Playwright metadata bypassed the protected metadata reader

**Source:** `adapters/playwright.ts#playwrightArgv`, `adapters/node-ts.ts#metadata`.

The Playwright command builder used unbounded `readFileSync` and a catch-to-null parser rather than the stack's exclusion-aware, bounded, regular-file/UTF-8/depth-validated reader. A `no-read` exclusion did not prevent that read. A symlinked, oversized or malformed UTF-8 package metadata file could still select an executable command. Tests reproduced all four cases against the initial source.

**Repair:** command construction receives the version through the existing bounded stack metadata reader. Removed the second parser. Missing/unsupported versions remain unavailable; excluded/unsafe metadata is refused. This repairs kernel-controlled reads; it does not create an OS sandbox or prove arbitrary installed package bytes.

### F02 — P1: Playwright inputs did not invalidate evidence

**Source:** `adapters/node-ts.ts#fingerprint`, `core/obligations.ts#CONFIG_INPUTS`.

Installed Playwright versions were absent from the fingerprint. Changing its package version with no npm installed-lock record left the fingerprint identical. Playwright configuration was absent from declared configuration inputs, allowing an ignored configuration file to appear/change without changing the candidate or baseline-support identity.

**Repair:** fingerprint Playwright's installed version; include the six existing configuration-extension spellings in the shared declared-input set, including absences. A real Git fixture verifies an ignored configuration appearance changes check identity while Git status remains identical. This is deliberately conservative and still does not establish package-manager version, transitive configuration closure, browser binary identity or arbitrary package-file integrity.

### F03 — P1: Playwright receipts identified the wrong runner

**Source:** `verbs/check-evidence.ts#e2eReceipts`.

The end-to-end normalization path passed Vitest's fingerprint fields to receipt production. A passing Playwright run consequently carried a Vitest tool/reporter identity. The new receipt-consumer regression reproduced this.

**Repair:** e2e receipts name `playwright@<observed version>` and `playwright-json`. Shared receipt-context construction removes duplicated identity assembly and keeps the existing central module budget intact. `node-ts@11` invalidates old evidence and uses the existing adapter-version pause/reconciliation. No state schema changed; no old receipt is relabeled.

### F04 — P2: inherited object properties passed closed registry checks

**Source:** `pipeline.ts#runVerb`, `verbs/decide.ts`, `core/config.ts#isSettingKey`, `core/reasons.ts#isReasonCode`.

`constructor`, `toString`, `__proto__` and `hasOwnProperty` were inherited from ordinary object prototypes. Setting/reason guards returned true; verb dispatch threw before the pipeline's error boundary; decision dispatch returned an internal error instead of an unknown-kind error. There was no demonstrated authority bypass, but this violates predictable structured-input admission.

**Repair:** own-property membership at each boundary. Regression tests verify structured errors, no configuration changes and no access to ports for unknown verbs.

The initial regression run had 16 failing cases and one passing control after adding the provenance case. Final result and full verification are in [validation.json](validation.json). The F01–F04 regression set is supplemented by the separately reproduced F05 and redaction-format controls. These repairs stay `◐` until committed and independently/CI validated; no qualification is inferred.

### F05 — P1: structured proposals could persist secret-shaped text

**Source:** `pipeline.ts#runVerb`, `core/input.ts`, `adapters/store-fs.ts#publishState`.

The pipeline redacted top-level requests and quoted user words, and rendered responses were redacted deeply. Other parsed structured inputs could still reach state unchanged. A synthetic credential embedded in a decision proposal was accepted and found verbatim in a private record; output redaction concealed that persistence error.

**Repair:** retain existing request/quote redaction; reject other secret-shaped structured input before any state, backup, lock or journal mutation, with a generic `invalid-input` response asking for placeholders. Structured meaning is never silently rewritten. The check uses likely-secret heuristics on values and serialized content, with red-first repairs for the documented GitHub fine-grained token and Cookie/Set-Cookie formats; it cannot detect arbitrary unknown credentials and does not purge historical records. No real credential was used in reproduction. The real-process regression compares every private record byte before and after refusal; the built CLI has the same scenario.

## Remaining implementation gaps and mistakes

The following combines newly traced source limitations with previously acknowledged but still-open work. “Known” does not mean fixed. All requirement IDs and candidate tests remain visible in the inventory.

### 1. Evidence and execution safety — first implementation priority

- **Incomplete check identity (EVD-01/03, SEC-04/15).** `facts.ts#checkInputId` still hashes a fixed Vitest argv/`CI=1` envelope rather than each admitted command/environment/value-hash/data-target contract. Command and non-default check declarations are safely blocked, but storing them is not executing them. Complete the reviewed configuration/evidence protocol before allowing those consumers.
- **Incomplete toolchain closure (EVD-03/05/11).** The repaired version/installed-lock fingerprint is useful but excludes package-manager version and arbitrary installed-file changes. External/transitive TypeScript configuration is refused, not supported. Other config inputs, browser versions and wider dependency graphs still need declared conformance. Current supported-major claims require actual SP-10 fixtures; a parser accepting a major is not a conformance campaign.
- **Sealed baseline absent (EVD-04).** `baselineFailures` is always empty in the real verdict input. Broader candidate failures are not classified against a neutral starting tree. Keep unknown classification truthful. A regular planned TDD baseline is a different mechanism.
- **Committed checks absent.** `check --stage committed` explicitly refuses. Ordinary clean-tree receipts can support the existing committed scope, but there is no implementation of the separate sealed committed-tree stage. Do not confuse the two claims.
- **Declared outputs partial (EVD-09).** Only constrained untracked data outputs are supported. Tracked fixture rewrites, full cache semantics and broader output treatment remain deferred.
- **Launch accounting partial (RSC-04, CON-12).** `check-evidence.ts#account` updates at finalization; exceptions/stopped runs can discard accounting, and `runE2e` discards intermediate EADDRINUSE attempts. Complete durable per-launch accounting under the signed schema/binding protocol; do not patch only the displayed count.
- **Do not weaken safeguards to complete features.** Configured signing, integration hooks/signing and branch checkout hooks currently refuse where a consented bounded effect path is missing. Those are intentional safe restrictions and unfinished product capability, not evidence that the full Git-program requirement is complete.

### 2. Configuration, recovery and migration — largest shared-contract dependency

- Typed catalog, restrictions, task/project overrides and a settings inspector exist. Ordinary-language setting changes, validated resets, immutable provenance, read-back and command/check confirmation are incomplete (CFG-01/03/04/08/09/10).
- `resource_mode` is stored but has no dispatch/scheduling consumer in `manifest.ts`; Serial/Conserve must not suppress mandatory review (RSC-05).
- Required static checks compose into obligations, but arbitrary required-check/command contracts remain unavailable. Configuration revision alone is not a full evidence dependency graph.
- Backup recovery suspends grants and execution consents. The system cannot reconfirm and continue a recovered workspace under the intended protocol. Preserve this refusal until `recovery-reconfirmation.md` is closed; do not restore old grants to make resume pass.
- Schema admission/version pins exist; actual previewed migration, protected recovery set, rollback, publication/binding protocol and unknown-field preservation do not (LFC-04, CON-05).
- These contracts affect store, state, receipts, budgets, question binding, recovery and rendered results together. Implementing one consumer while ignoring the others would create a second round of corruption/staleness defects.

### 3. Shared files and continuity

- `INTENT.md` and policy adoption previews exist, but accepted changes are not fully projected back to all shared documents. External edits are detected more broadly than they are adopted/reconciled.
- Decisions exist locally and as intent blocks; the complete MADR `docs/decisions/` file lifecycle is missing (INT-09).
- ID-aware collision detection, merged-content preview and application on integration are missing (GIT-09). Ordinary Git conflict prediction is not ID reconciliation.
- Loss of `.tenet/` does not reconstruct accepted intent/IDs from repository sources and Git (CON-07). Reconstruction must never restore grants, receipts or budgets by guesswork.
- Prototype snapshots and endpoint exist, but declared data limits and per-prototype hardening-gap projection remain missing (WRK-06, QLT-17). A starter hardening file does not satisfy every prototype.
- Storage has journal reduction, protected admission and project run caps, but no full specified eviction order, shadow-Git snapshot pruning, archive compaction or complete machine cap. The October 26 owner decision resolved eviction ordering in favor of PRD §5.15; the remaining retention implementation is incomplete.

### 4. Review, delegation, results and resource behavior

- Freshness, explicit coverage, cross-module coverage, rechecks, native-versus-focused review and Deep evidence have substantial tests. Actual native isolation, tool restrictions and cancellation remain host evidence gaps.
- Caller/importer selection, shared-round split-review semantics, child trace violation detection, normative disagreement handling and user-invisible specialist lifecycle are incomplete (AGT-06/07/10/12, REV-08/09).
- Review axis failure is intentionally **not** an automatic endpoint blocker: TS §8.3 makes evidence and dispositions controlling. Do not “fix” this by overwriting axis verdicts or preventing accepted-risk majors from closing.
- Finish exposes outcome, receipts, review, limits and usage, but lacks a dependable demo path, screenshots for UI changes and a complete reading guide (RES-05). Envelope unknowns are not fully summarized in the final result.
- Active-time accounting includes call duration and does not fully separate tool/provider/network/user waits (NFR-05). Unknown provider usage must remain unknown.
- Requested/unknown model records exist; golden-suite-derived qualification and the complete Deep warning flow do not (RSC-08).
- Redaction exists; a complete requested, previewed diagnostic export/feedback workflow does not (NFR-07, OSS-06). Source/history privacy review remains a distinct release gate.

### 5. Starter quality — local vertical slices and remaining evidence gaps

- The platform now has real auth/session/CSRF/data/restore tests, a React/Vite account shell and eleven account/server browser scenarios. The generated loan fixture adds four real UI persistence/conflict/authorization scenarios with axe/keyboard checks. See the dated validation records for exact source/runtime scope.
- Implemented locally: shared-schema OpenAPI generation and isolated export in recipe 0.3.0, with account and generated feature contracts. Missing: automatic breaking-change/trait/semver consumers; a generated document alone does not close that gap.
- Missing: full ASVS 5.0 L1 applicability/methods/results and manual screen-reader observations. Account/domain journey registries, UI-state, axe and keyboard checks exist locally; complete WCAG 2.2 AA applicability/conformance remains unqualified (QLT-02/03/14).
- Missing: reference workload, fitness functions, baseline/trend records and threshold-triggered attention (QLT-05).
- Partial: trait detection/correction and per-trait obligation generation, threat/data notes and generated security acceptance cases (QLT-06/11/13).
- Local QLT-07 progress now includes a populated frozen application schema-1 upgrade/automatic-backup/auth/restore/re-upgrade workflow, history/checksum/FK refusal and transaction-level postflight rollback, preserving existing owner/journal/crash controls. Independent review, each future migration fixture and supported-platform qualification remain open. Domain behavior stays outside the template.

### 6. Evaluation and real-host qualification

- Ten public task fixtures and offline validator/replay/report slices exist. Need the required 30 public plus 10 reserved tasks, complete protected graders and campaign protocol, six-port/pipeline replay, successive-change cases, controlled regressions and the bounded maintainer experiment.
- Offline synthetic replay is not replay of a complete kernel session. Offline report eligibility is derived from untrusted declarations and is not authorization, evidence authenticity or qualification.
- SP-01/02/08 are only partly observed; SP-06/10 need complete disposition; SP-12 has not selected transport through its prescribed measurement. Do not add MCP/hooks speculatively or use Copilot CLI observations as the VS Code tuple.
- Separate authorization and verified account/no-overage/isolation/storage boundaries are required for native runs. Existing approvals for offline helpers do not permit live capture, execution of protected graders, model spend or human recruitment.
- Discovery interviews, six formative sessions and the 8–12-person counterbalanced pilot remain real human work. Scripted users cannot replace them. All 19 Shoulds still need evidence or signed omissions.

### 7. Release and documentation

- `README.md` remains a draft with name/publisher/URL placeholders. Native zero-setup installation and installed update/disable/uninstall preservation are unqualified. Upstream `8b7bbc4` corrected partial-observation wording in plugin and host documentation. Exact native qualification remains incomplete.
- License, SECURITY, CONTRIBUTING and draft notices exist. Code of conduct, finalized supported-version policy, namespace/publisher, full template/dependency notices and the solo-maintainer release review process remain unfinished.
- Payload verification is local integrity, not installed startup/doctor verification, independent clean source/dependency rebuild or authenticity. Signed provenance/tag/publication and the public review window remain open.
- No actual release job currently invokes the full qualification chain. The current requirement release audit intentionally checks Must qualifications only and explicitly excludes Should omissions, residual risks and owner approval; treat it as one prerequisite rather than a release certificate.

## Code quality and delivery process

The overall architecture matches the stated preferences better than the unfinished feature count suggests: strict TypeScript, explicit boundaries, real process/Git preservation tests and no recorded oversized-function offenders. Keep that discipline. Avoid introducing a generalized orchestration framework or reimplementing existing adapters to finish isolated features.

The quality ratchet measures `packages/kernel/src`; it does not provide the same function/module enforcement for the evaluation package, tools or plugin text. The template has its own lint/build checks, but maintainability of the large evaluation/report and UAT modules still needs direct review. Passing the kernel ratchet must not be reported as a whole-repository complexity proof.

The principal maintainability risk is **near-zero module headroom**. Before this repair, the central pipeline/verbs/decisions group had only five non-whitespace characters spare; `core/schemas` had 36, `git-cli` 42 and `core/budget` 55. Moving functions to another file in the same group does not create space. Small behavior-preserving consolidation at the affected boundary is appropriate; renaming/minifying or raising limits to hide growth is not. The receipt-context consolidation in this repair leaves 182 characters in the central group. Larger approved slices need explicit budget feasibility and simpler contracts before coding.

The plan is too large to use as a current task list without a concise handoff: more than 2,100 lines include historical “not built” statements that later entries supersede. Keep its history, but update the dashboard and current ordered checklist; use this audit's links for current gaps. Do not convert historical checkbox completion into current full-requirement completion. Also, its “five-state” wording in the Copilot instructions differs from the actual seven-row status table; the real meanings/evidence thresholds are clear and were preserved.

### Inherited work is not integrated progress

| Worktree | Recorded base | Current state | Treatment |
|---|---|---|---|
| config-completion | `ddd6e78` | Clean checkout; work committed on its own branch | Review against current signed scope and exact state/budget contracts before selective porting |
| reconstruction | `b55a86a` | Four modified tracked files and three untracked source/test files | Preserve; finish source/allocator/provenance decisions and validate before porting |
| sealed-baseline | `5841fac` | Fourteen modified tracked files and two untracked source files | Preserve; materialization ownership/cleanup and remaining decisions gate implementation |
| shared-files | `5841fac` | Eight modified tracked files and six untracked source/test files | Preserve; schema/projection/adoption contracts and review gate implementation |

No worktree was merged, reset, removed or archived. These older bases overlap state, Git and decision contracts. Merge them serially by approved vertical slice after reviewing the delta against current main; do not treat a clean worktree or a large diff as completed functionality.

## Efficient completion plan

Use one active implementation slice, one contract decision at a time, and keep exact-host/human preparation on its own track. The sequence below refines plan §12.12; it does not amend canonical requirements or authorize withheld activities. [completion-plan.md](completion-plan.md) provides the execution checklist and binary exits.

1. **Stabilize truth and safety.** Land the F01–F05 repairs only after red/green, full CI and built UAT; review all partial evidence consumers; propose requirement dispositions for owner review. Do not spend time adding tags without assertions.
2. **Close configuration/migration/reconfirmation together at the contract boundary.** Finish review/dispositions, exact publication/binding protocol and budgets; obtain outstanding sign-off. Implement the smallest end-to-end config change → dependency invalidation → safe crash/recovery slice, then the next.
3. **Finish continuity.** Shared projections/adoption → external edits → ID-aware integration → loss reconstruction, then deferred retention under the resolved canonical order. Preserve unowned bytes and never import authority.
4. **Finish sealed execution.** Resolve sealed D4–D8 and committed-slice review, then neutral materialization, matching/classification and committed-tree receipts. Neutral cleanup must prove ownership before deletion.
5. **Complete user-facing vertical slices.** Resource-mode consumers/accounting and result/demo behavior; starter shell and one increment-generated journey, followed by denial/conflict/persistence/accessibility/workload evidence. Reuse the current platform.
6. **Complete exact-host feasibility.** Separately authorize and observe SP-08, SP-01/02, dependent SP-06/10 and installed M0; only then SP-12. Record the full tuple and failures. Preparatory documents can proceed while local code is being fixed; no live run is inferred.
7. **Freeze qualification.** Complete tasks, protected grading and replay/live gates; run authorized campaigns, formative sessions, experiment and pilot; disposition all Musts/Shoulds and residual risks.
8. **Verify and release the installed artifact.** Independent clean rebuild, notices/privacy/history, installed integrity/lifecycle, namespace, provenance and public review; owner approvals then publication. Qualification belongs to that exact artifact/tuple.

Do not estimate completion from test count or assign calendar dates before the shared contracts and exact-host failures are measured. The likely critical path is contract closure → shared/evidence workflow integration → installed-host feasibility → qualification. Documentation and task-authoring can advance alongside it, but cannot substitute for those exits.

## Validation and handoff

The unchanged baseline passed `npm run ci`: **1,177 tests / 192 suites, zero failures/skips**, plus typecheck, architecture/skills/quality lints, M0 mapping, build, payload and repeat-build gates. The initial sandboxed attempt could not use `ps` and failed because mutation was safely refused; it is not evidence of a product regression. The successful local run used normal process/loopback access. Host behavior remains unobserved by this audit.

Final repair validation passes **1,196 tests / 195 suites**, zero failures/skips, and all CI gates. The same **776,152-byte** bundle passes **133 built UAT scenarios on each of Node 26.3.0 and 22.12.0**; SHA-256 `7de9a0ce8096b16cb92520a166e9087f1c4cbfe9e8a58ae6e7e2a42a99b724b2`. The final privacy/admission subset passes 31 tests on both runtimes. Actual-addition privacy scanning, audit links and whitespace checks pass. See [validation.json](validation.json) for exact results, repeat-build details and limitations. Full CI/UAT must be rerun after material changes. All new state remains local; there is no commit, push, remote CI result or release qualification from this work.

## October 29 continuation: workload evidence remains partial

A fixture-only executable workload now measures the production API with the canonical dataset/timing and independent server metrics/database checks. Fourteen behavioral controls include real-process smoke/cleanup and full seed ownership, plus rejection of misleading fast-refusal, absent-sample and missing-coverage results. The first full local run failed under the existing rate limiter and exceeded the memory target; it also identified and corrected a client-inventory defect in the driver before repeating measurement. Local Apple silicon has 38,654,705,664 bytes of memory, so it is not the specified 16 GB reference tuple. Full reports remain explicitly unqualified.

This replaces “no workload implementation” with “measurement tooling implemented locally; workload target/consumer/qualification gaps remain.” The kernel still has no workload receipt/trend consumer/threshold attention. No ledger acceptance or release-readiness claim follows. Final observations and immutable source/artifact identities are recorded in [the October 29 validation record](../2026-10-29/workload-validation.json): full CI 1,237/202 and both final built feature loops pass, while both full workload observations fail their traffic/coverage targets. These remain separate claims.

## October 29 continuation: additive abuse-control escape

The route-specific sign-in limit replaced the default IP ceiling; real controls reproduce 401/503 after IP exhaustion instead of 429. Recipe 0.3.3 composes the unchanged limits before expensive work; a naive-hook mutation is caught. Browser checks preserve all assertions against a fresh production UI build after the development cohort exposes request-121 refusals. This is local implementation progress, not a new admission policy or accepted qualification. [Current findings](../2026-10-29/abuse-findings.md) and [memory diagnosis](../2026-10-29/memory-diagnosis.md) retain failed observations and their limits. Final gates/artifact identity are recorded separately in the linked validation record.
