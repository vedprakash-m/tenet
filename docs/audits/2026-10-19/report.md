# Tenet implementation audit

October 19, 2026 · baseline `5a022e3` · PRD v0.17 / technical spec v1.3 / UX spec v0.5

**Subsequent implementation:** this report is the baseline audit. Corrections and still-open acceptance cases are tracked separately in [remediation.md](remediation.md), with [local validation evidence](remediation-evidence.json). A finding here remains historical even when its counterexample has been corrected.

## Assessment

Tenet has a substantial deterministic implementation and a working narrow vertical slice. It is **an unfinished M0 with significant Alpha work**, not an Alpha-complete product and not release-ready. The architecture is worth retaining. The immediate priority is correcting integrity and human-work preservation defects before widening the feature set.

The existing suite is green, but it does not establish the product's core safety claims. This audit reproduced a behavior change reaching `checked-local` without a baseline run, an undeclared human file being committed, a parked contract checking beside another source owner, a stateless review executing a configured Git filter, and a store writing through a `.tenet` symlink. Those affect the never-waivable AC-07, AC-16, AC-17, AC-25 and AC-27 gates. They are implementation defects, not candidates for a release waiver.

There is no defensible single completion percentage. A requirement tag, an implemented happy path, a qualified host capability, and a passing user study are different kinds of progress.

## Scope and evidence

Reviewed the canonical specs and plan; repository instructions; every kernel source module; plugin agents, commands, skills and resources; starter source/configuration/migrations; CI/build/lint/privacy/traceability tools; and the tests supporting the main safety and workflow claims. Dependency lockfiles were treated as build inputs, not a source review of third-party packages. No new Copilot host qualification, pilot, remote CI verification or vulnerability research was performed.

Validation performed:

- `npm run ci`: **365 tests passed, 96 suites, zero failures/skips**, plus strict typecheck, architecture lint, skill lint, M0 traceability and the **626 KiB** bundle build. The successful local macOS run took about 72 seconds for the test phase. This is local evidence, not a newly verified remote CI run.
- The first sandboxed run failed because this environment denies `ps`, which the process-liveness tests need. Re-running with process inspection/package access passed. These failures are an execution-environment limitation; they do not explain away the audit defects below.
- Coverage reports run independently for M0, A, B and R1. Alpha and later reports correctly exit nonzero for unmapped requirements.
- [16 reproducible observations](observations.json), driven by [reproduce.ts](reproduce.ts) against disposable local repositories. They require Node 24+, process inspection and the repository's installed development dependencies; they make no network requests. Run `node docs/audits/2026-10-19/reproduce.ts` from the repository root. Assertions deliberately describe the audited defects; convert them to assertions of correct behavior when implementing fixes.
- [Requirement ledger](requirements.md): all **181 Musts and 19 Shoulds** due by R1, including actual tagged fixture locations. The plan's “16 Shoulds” refers to those tagged R1; three other Shoulds are tagged Beta.

Findings labeled **reproduced** have a named A-number in the observations. **Source-confirmed** means the missing or incorrect path is directly visible in code, but this audit did not exercise every failure variant. **Pending qualification** means an observation or campaign is still required, not that code necessarily contains a defect.

## What has actually been built

| Area | Present | Remaining qualification or implementation |
|---|---|---|
| Kernel structure | Pure core, explicit ports, one entry pipeline, 12 registered verbs, 18 decision kinds, strict TypeScript | Shared guards are incomplete; capability/Host seam absent; see F03/F20 |
| State | Atomic document replacement, previous revision, guarded lock breaking, effect log, blob helpers, generation handles | Safe state admission, authority suspension, common recovery fencing, migration, retention, reconstruction |
| Evidence | Vitest execution and JSON normalization, acceptance obligations, receipts, baseline/candidate runs, test locks | Correctness gaps in existing evidence path; static/build/audit/browser/manual kinds; envelopes and data isolation |
| Git | Inventory, temporary-index commits, index sync, shadow prototypes, local integration, inverse-patch undo | Attribution bug, configured-program consent, branch lifecycle, crash/race coverage and unsupported-state handling |
| Intent/config | Basis/overview/plan/decision records, managed-block parser/projector, adoption, policy comparison, 12-setting catalog | Projection round trip, branch-aware accepted intent, complete setting consumers, provenance/history, MADR files |
| Plugin | Coordinator and Reviewer, two commands, five skill folders, self-contained review manifests | Analyst, focused review path, supported review scopes, complete result/recovery/setting UX, host proof |
| Starter | Fastify/SQLite platform, validation, random dev passwords, sessions/CSRF, hashing limits, logging, health, migration/backup helper, CI template | UI shell, first real business journey, object/role authorization demonstration, OpenAPI, restore, quality harness |
| Engineering | Build and schema generation, T1 suite, read-only untrusted GitHub Actions, basic privacy scan | T2 replay, golden tasks, native qualification, studies/calibration, release chain and documentation |

The use of small pure modules, shared Git plumbing, real-process tests, and a single verdict implementation aligns with the owner's simplicity and test-first preferences. Keep these foundations. The failures mostly come from omitted guards or metadata being accepted without a consumer, rather than a need for a larger architecture.

## Progress against plan.md

These are the tool's **tag counts**, not verified semantic coverage:

| Cumulative target | Musts | With a tagged T1 fixture | Classified host-only | Classified unreachable | Unmapped |
|---|---:|---:|---:|---:|---:|
| M0 | 34 | 29 | 4 | 1 | 0 |
| M0 + Alpha | 100 | 68 | 11 | 1 | 20 |
| Through Beta | 158 | 72 | 15 | 1 | 70 |
| Through R1 | 181 | 72 | 18 | 1 | 90 |

The `SEC-13` unreachable classification is obsolete: undo and other consequential operations now exist. Some “host-only” rows also contain deterministic obligations that can and should be tested locally, especially review-round enforcement. Do not turn these buckets into exemptions.

- **Phase 0:** decisions are largely recorded, but named technical, UX/evaluation, security and release ownership remains unchecked. The dashboard's “not started” is stale.
- **Phase 1:** partial observations for SP-01/02/08 and local Git/adapter measurements exist. None closes the full required tuple. The extension version, review restrictions/isolation, long calls, lifecycle, instruction loading and tokenizer measurements remain open. SP-12 remains unrun. The dashboard's “not started” is stale.
- **M0:** the local walking skeleton and several real fault tests pass. The actual host gate, safeguards below, some required contract/result content and the complete starter scaffold checks remain incomplete. Historical `✅` labels should mean “implemented slice with then-current evidence,” not “this requirement is now fully satisfied.”
- **Alpha:** undo, integrate, adoption, settings, overview/plan, protected grants, state decision records and npm dependency decisions are present and committed. The plan's old “uncommitted” notes no longer describe HEAD. Analyst, full config consumers, readiness states, envelopes, selected fixes, TDD alternative, starter journey, capability descriptor, replay/golden tasks and UX sessions remain.
- **Beta:** some building blocks have landed early, such as `inspect why` and parts of drift detection. The hardening milestone is not started as an integrated phase.
- **R1 and operations:** qualification, study, release and stewardship obligations are almost entirely pending. An empty `eval/` is a material missing subsystem.

## Findings to fix

P1 means correct before relying on the affected safety or completion claim. P2 means material incompleteness or maintainability/UX risk to close in its scheduled milestone. Priorities do not replace the milestone gates.

### F01 · P1 · A behavioral change can pass without the required baseline proof

**Reproduced A05/A06.** [judgeRed](../../../packages/kernel/src/core/verdict.ts#L81) iterates existing acceptance obligations rather than requiring at least one distinguishing obligation. No matching obligation means no reason is added. Requirements can link only to review; a passing unrelated suite plus a reported review then reaches `checked-local` with **zero baseline runs**. Boundary examples get category `boundary` in [deriveObligations](../../../packages/kernel/src/core/obligations.ts#L10) and are also omitted by that loop even when explicitly declared `expect: fail`.

Baseline preservation expectations are not required by the verdict either. Baseline contamination checks only attributed source paths; config/support changes are not part of the saved baseline definition. `judgeElement` accepts any manual reference without looking up a manual observation. The negative-control/test-alongside route does not exist.

**Required:** validate the basis as a whole; require distinguishing evidence or the explicitly specified alternative for behavioral work; enforce the declared baseline expectation of every applicable example and bind the complete test/support definition. Nonbehavioral work needs its stated alternative check. **Regression:** no examples, only preservation, fail-on-baseline boundary, changed support/config, fabricated manual reference, valid nonbehavioral alternative. **Rules:** PRD §4.5.1–2, TDD-01/03/04/06, AC-07/24/27.

### F02 · P1 · Predicted scope is treated as proof of authorship

**Reproduced A16.** [gather](../../../packages/kernel/src/verbs/facts.ts#L35) explains a changed file merely because it matches `scope.paths`. A person can create a file under a predicted directory after `open`, never declare it as Tenet's, and have it checked and **committed without a question**. Tests protect unrelated human files outside the predicted scope but miss this case.

**Required:** predicted paths remain an estimate. Only declarations/kernel effects/qualified observations explain authorship; otherwise ask. Keep the last-check comparison. **Regression:** concurrent human edits and new files inside/outside scope, with both staged and unstaged variants. **Rules:** PRD §5.12, GIT-03/08, never-waivable AC-25.

### F03 · P1 · Source ownership, takeover and external-job fencing are incomplete

**Reproduced A08; source-confirmed related paths.** `Verb.editing` is declared but never consulted by [mutate](../../../packages/kernel/src/pipeline.ts#L135). `open` checks the owner on new work; existing handles do not. A parked contract runs a check while another contract owns source. Non-editing contracts can also invoke decision kinds such as scaffold/dependency unless the kind independently guards them.

`open --resume` clears `inCall`, changes generation without the required takeover question, does not restore a parked contract's prior phase, and does not reacquire ownership when another contract owns it. It does not ensure the current branch is the contract's branch. Commit/scaffold/dependency/integrate/undo finalizers lack the run/generation/cancellation guard that `check` has. `decide`, `packet` and `findings` do not consistently reject mutations while a live job runs. `stop pause` can release ownership for a commit whose process it cannot stop or reconcile.

**Required:** one common editing/lifecycle/owner/busy guard and one common finalization fence in the pipeline; effectful decisions declare their class. Takeover and ownership release must respect active/uncertain effects. **Regression:** parked A versus active B; resume during a real slow check/commit/install; late results after pause/cancel/takeover; a planning contract attempting a source effect. **Rules:** TS §6.1/7.3, AGT-08, AC-17/25.

### F04 · P1 · Hostile or incomplete reports can become passing receipts

**Reproduced A01.** [normalize](../../../packages/kernel/src/adapters/node-ts.ts#L58) overwrites duplicate file identities in a Map. A failed file followed by a passing file with the same identity becomes a pass. [receiptsFrom](../../../packages/kernel/src/core/receipts.ts#L23) can accept a passing report from a process terminated by `SIGKILL` with no exit code. File-level/top-level errors and aggregate report counts are not fully reconciled. Mixed skipped/passing tests in an acceptance file can pass without identifying which example ran.

Oversized collections are silently sliced at 2,000 files/20,000 assertions; the omitted tail could contain failures. Duplicate test identities, malformed statuses/counts, paths outside the workspace, reporter/config compatibility and actual obligation populations are not robustly validated. A full-suite receipt largely trusts whichever files appear in the report.

**Required:** bounded, strict normalization and run validation; overflow/duplicates/unsupported shape/termination/population ambiguity yield inconclusive. Preserve bounded diagnostics without truncating the truth being judged. **Regression:** duplicate failures, failure beyond limits, suite error beside passing assertions, skipped required example, outside path, killed runner with complete-looking report. **Rules:** PRD §3.8.3, TS §9.6, AC-07/18/27.

### F05 · P1 · Inventory and exclusions do not cover the declared inputs

**Reproduced A13/A15; source-confirmed remaining cases.** [inventory](../../../packages/kernel/src/adapters/git-cli.ts#L87) does not read assume-unchanged/skip-worktree flags. A real source edit under `--assume-unchanged` leaves the candidate digest unchanged. Ignored-but-relevant inputs have no declaration path. Secret files ignored by Git may therefore have no stat in the identity at all. The code hardcodes SHA-1 blob hashing, not the repository object format.

All main callers use `inventory([])`. Effective custom exclusions never reach inventory, attribution or manifests. `.npmrc` token-bearing entries and adapter-known credential stores are missing from [default exclusions](../../../packages/kernel/src/core/exclusions.ts#L16). Git status receives no exclusion pathspecs. `.tenet/` is permitted by `allowed()` for read/model-send/export, contrary to TS §9.4's operation table. `wholeFile` follows new-file symlinks when reading diff content. Path matching is not normalized for macOS case/Unicode rules. Accepted facts/derived records and declared outputs are not excluded from candidate identities as specified.

**Required:** one operation-aware policy passed to every affected adapter call; stat-only secret handling; explicit ignored inputs/outputs; flagged-file hashing; object-format and path handling or explicit refusal of unsupported variants. **Regression:** flagged/sparse files, ignored test config/secrets, custom no-read/no-send/no-edit, `.npmrc`, symlink paths, case-only names and SHA-256 repositories. **Rules:** TS §8.8/9.4/11.2, AC-16/18/25.

### F06 · P1 · Risk and authority rules are not enforced throughout the task

**Reproduced A11; source-confirmed channel/capture issues.** Risk is raised only at [open](../../../packages/kernel/src/verbs/open.ts#L112), using predicted paths and submitted signals. The actual diff never raises floors. An ordinary Quick task that adds an auth file stays Quick. Empty assessment defaults to Quick even for an ordinary feature; the skill says to pass Standard/Deep only when the user requests more rigor. Missing sketch attention is not implemented. Deep does not require the Architect/Security evidence it promises.

[grantQuestion](../../../packages/kernel/src/verbs/authority.ts#L7) defaults to `channel: native`; protected-path authority must be in chat. A confirmed CLI basis grant is stored as `capture: elicited` in [basis](../../../packages/kernel/src/decisions/basis.ts#L111), although the coordinator relayed it. Some authority/disposition answers need only a reason and are recorded as user decisions without a question/capture protocol. `stop abandon` is destructive under the spec but has no destructive preview. SEC-13 is still exempted as unreachable in coverage.

**Required:** reassess from inspection and actual changes before the next dependent action; implement the stated floor steps or refuse the stronger lane claim. Fix chat channels and report CLI capture honestly. Audit each effectful decision against the action-class table. **Regression:** late auth/migration/dependency paths; protected grant channel; CLI capture; unknown approval mode with destructive action. **Rules:** PRD §5.2–4, TS §8.1/11.4, WRK-03/04, SEC-13.

### F07 · P1 · State admission and schema recovery fail open

**Reproduced A02/A03.** [FsStore](../../../packages/kernel/src/adapters/store-fs.ts#L25) follows `.tenet` symlinks and accepts a pre-existing markerless directory. The reproduction writes its state outside the workspace. It also follows symlinked internal files. A copied marker is detected, but quarantine/fresh-start recovery is not implemented. Existing directory permissions are not checked/tightened.

Authority-bearing schemas use `z.object`, which strips unknown fields: a grant containing an unsupported authority field parses successfully. `State.parse(doc)` validates but its parsed result is discarded on publish; subsequent reads may reinterpret records differently. `tx.recovered` is not used by the pipeline to suspend grants after falling back to `state.prev`. Marker fields and state-to-marker identities are not comprehensively schema-checked.

**Required:** safe admission before any lock/write; refuse symlinks; quarantine untrusted state; strict authority/restriction/consent records; retain safe extension fields explicitly; backup diagnostic mode suspends authority and reconciles effects. **Regression:** symlink directory/internal files, markerless preload, copied/malformed marker, unknown grant/consent fields, corrupt current state with old grants in backup. **Rules:** PRD §5.10.4/5.11, TS §7.5/15.2, AC-16/17.

### F08 · P1 · Successive contracts can share the same work branch

**Reproduced A09.** [basis](../../../packages/kernel/src/decisions/basis.ts#L115) creates a branch only when the current branch does not start with `tenet/`. Opening a second contract on an unintegrated Tenet branch reuses the first branch. It does not create the required distinct stacked branch or disclose stacking. `branching: current` is accepted as a setting but ignored. Branch identity is not checked again at commit/resume, so a handle can operate on an unrelated current branch.

**Required:** one branch decision per contract, rooted at its actual start HEAD; honor current-branch mode and state stacking; guard branch changes. **Regression:** two successive unfinished integrations, human branches named `tenet/...`, explicit current mode, external branch switch. **Rules:** GIT-02, TS §10.7, AC-25.

### F09 · P1 · Configured Git effects and commit recovery are only partly governed

**Reproduced A14.** A stateless `review` runs a configured clean filter through `git status`, without consent; the filter writes a file in the project. This breaks the literal zero-write/no-project-program guarantee. The inspection profile disables some programs but not clean filters and does not pin all diff formatting settings.

[startCommit](../../../packages/kernel/src/verbs/commit.ts#L32) does not implement filter/signing configuration consent, init template inspection or the additional hooks-plus-human-dirty question. Hook inventory covers files in the hooks directory and `.husky`, not all specified manager/signing/filter inputs. [GitCli.commit](../../../packages/kernel/src/adapters/git-cli.ts#L197) ignores `timeoutMs`, has no process-group/run record, and checks foreign committed paths but not all foreign working-tree mutations. Hook-changed content is not automatically rerun/reviewed before closure. `finish` may close after the commit callback with stale/incomplete evidence instead of completing required revalidation.

Index sync lacks the effect's recorded index-lock inode and dead-owner recovery. It serializes `update-index --index-info` records with newlines instead of NUL records, and some tree lookups use unescaped pathspecs. The current kill test covers another client holding a lock, not killing Tenet at its final sync rename. Some failure messages say “nothing moved” even after a successful switch followed by a failed merge.

**Required:** complete the existing protocol, not another Git abstraction. Reject unsafe read paths until filter consent; govern all executable Git configuration; record and bound commit children; verify pre/post tree and foreign changes; complete rechecks or report exact remaining work. **Regression:** stateless filters, signing/hook changes, foreign hook edit without staging, indefinitely hanging hook, crash mid-index-sync, newline/metacharacter filenames. **Rules:** TS §9.4/10.3/15.1, GIT-12/15, AC-16/17/25.

### F10 · P1 · Invalid policy and mid-work restrictions do not reliably constrain work

**Reproduced A04.** [sharedPolicy](../../../packages/kernel/src/verbs/reconcile.ts#L50) turns malformed/unrecognized unadopted policy into `{}`. An adopted unreadable policy gets only a note. A misspelled `protected_pathz` does not block implementation. This contradicts CFG-11 and NFR-03.

Protected paths are copied into a contract at open. A later `decide config protected_paths` update does not change that contract's protection gate. Commands and required checks can be accepted/shown without changing obligations or freshness. Exclusions are accepted without affecting reads. Presentation changes are stored but not surfaced immediately through a changed presentation record. `integrationSetting` reads only project-local config, bypassing the resolver. Mixed valid restriction/invalid updates lack the required restriction-only safe revision.

**Required:** strict validation before affected reads, active-work consumers for every supported setting and shared restriction, dependency-aware invalidation, safe mixed revisions, conflict provenance. Unavailable settings must say unavailable. **Regression:** malformed pulled/unadopted policy; protected path tightened mid-work; required check added after green; exclusion added before next manifest; mixed update. **Rules:** PRD §7.1/7.5–8, TS §8.5, AC-16/23.

### F11 · P1 · `checked-local` omits required execution and check semantics

**Source-confirmed.** [check](../../../packages/kernel/src/verbs/check.ts#L65) runs one Vitest invocation regardless of obligation kind. Obligations contain only examples and `OB-suite`; recipe defaults, adopted required checks, traits, lint/types/build/audit/manual obligations are not composed. There is no execution-envelope record/authorization, test database/port allocation, server identity verification, or command-chain inspection. The cooperative “not sandboxed” disclosure is useful but does not satisfy the envelope requirement.

`check --stage committed` is accepted but runs the dirty working tree and labels its receipts committed (**A07**); it does not materialize the commit. `checkInputId` omits support/declared-environment/data/population fields and package-manager/preload fingerprint information. Unsupported configurations are not detected. The adapter accepts Vitest majors 2–5 although the plan records measurements for only two versions. Readiness hardcodes writable/policy facts, ignores `nodeOk` in the level calculation, and uses L3 for no supported runner where TS §8.2 distinguishes missing readiness from unsupported configurations. No actual host qualification feeds L4.

The starter test runs lint/types via `execFileSync` **outside the kernel**, then calls the kernel's test-only result `checked-local`; its test title overstates the governed path.

**Required:** compose obligations from the approved sources, validate each registered kind and full semantic identity, and record/authorize the execution envelope before running. Isolated server/database checks need a runner implementation. Refuse unbuilt stages instead of producing their receipt label. **Rules:** PRD §4.5/5.8/5.13, EVD-01/13, SEC-04/15, TS §9.

### F12 · P1 · Counters report limits without stopping the next operation

**Reproduced A07.** Four full candidate checks execute under a three-attempt limit. `stopFor` runs after execution; there is no admission guard before the next check. Stage aliases can bypass attempt accounting. Full reviews check delegation capacity but do not enforce the review-round cap; retries lack the specified two-retry bound. Split follow-ups are not modeled as the same round. Tokens omit routine responses; launched-check counts are per receipt, even when one process produced several receipts; active-time accounting is absent. Successful candidate runs append “pass” signatures, and exhaustion tests only whether any signature exists.

**Required:** check limits before admission, preserve the stated counter meanings, implement bounded extension decisions/diagnosis and truthful usage fields. A successful final allowed attempt must not be reported as repeated operational failure. **Regression:** fourth attempt; third Standard full review; third retry; split follow-up; failed run versus invalid configuration; successful final attempt; host-limit pause. **Rules:** WRK-08/09/12, REV-05, RSC-04, TS §8.6.

### F13 · P1 · Review coverage and chains are not fully validated

**Source-confirmed.** [applyResult](../../../packages/kernel/src/core/review.ts#L120) discards inspected paths, sampled callers and open dependencies. [judgeReview](../../../packages/kernel/src/core/verdict.ts#L93) checks only the last link's status/candidate/basis/independence/uncovered list. It does not validate the `basedOn` chain or the semantic-sampling/full-types rule. A completed result can claim zero inspected files and an empty cross-module check. Recheck mode considers paths but does not detect changed exports requiring a full review. Integrated review does not implement the specified import/overlap trigger.

The manifest lacks actual read limits, capability/exclusion/charter/lesson fields, assignment permissions/config revision/budget and a complete findings summary. It caps basis tokens alone, not the whole packet including rubric/instructions. It does not carry inline diffs when affordable. Partial coverage is not accumulated into a proven full chain. These fields are especially important because review independence/capture is currently reported, not observed.

**Required:** retain and judge the specified coverage, dependencies and chain; bound the complete assignment; reject inconsistent completion. Keep semantic judgment with the reviewer rather than inventing an entailment classifier. **Regression:** empty inspected list, semantic sampled callers without types, stale/missing predecessor, new export in finding file, unresolved dependencies, oversized packet and partial follow-up. **Rules:** REV-01/05/08, AGT-04/05/12, TS §8.3/8.7.

### F14 · P1 · Lock revisions can preserve invalid baseline proof

**Source-confirmed.** The lock disposition in [simple.ts](../../../packages/kernel/src/decisions/simple.ts#L53) changes both the lock hash and `baselineTestHash` to the current file while keeping `baselineMatched`. It loses the recorded reason for that lock change and does not require a new red/green or independent test-defect disposition. Baseline support hashes are not saved; a helper changed between red and green is locked only in its new form. Lock violations are discovered in verdict gathering, not raised as blocker findings at every check/review. Support locks remain project-wide blockers indefinitely rather than following their specified post-contract rerun semantics. Ambiguous rewritten-history anchoring does not ask/re-anchor.

**Required:** explicit revised→verified→locked lifecycle with provenance and correct decider. Preserve original receipts and restore proof only through the permitted path. **Regression:** weaken an assertion then disposition it, mutate helper between red/green, later contract changes a support file, rebase/case rename/symlink replacement. **Rules:** INT-06, EVD-10, TS §8.1/9.7, AC-07/24.

### F15 · P1/P2 · Adopted intent can drift from the accepted state

**Source-confirmed.** Managed-block parsing/projection is well isolated and preserves user prose, but accepted changes are not re-projected automatically. `open` only reports externally edited intent; it does not accept a diff back into state or switch branch-specific accepted meaning. Deleted/new managed blocks are not comprehensively compared by `judgeIntentFile`. `decide adopt` binds approval to the output hash rather than both the source preimage and intended output; an external edit that makes the file equal the intended output is adopted as a no-op without the specified changed-file reconciliation. Adoption previews list block IDs rather than the exact proposed text. Human-dirty intent consent and committing post-finish adoption remain absent.

Basis replacement removes old elements instead of retaining supersession history; it can leave references from other intent/plan items dangling. Repeated basis refinements can allocate new IDs when callers do not echo the existing stable IDs. Decision records live in state/INTENT blocks, not MADR files. Impact traversal and designated sources are absent. First-call `basis`/`plan` with an already known confirmation still requires a previously stored pending question, contrary to TD-44's one-call case. CLI confirmation also has the capture issue in F06.

**Required:** one accepted intent model with explicit revision/history and projection/reconciliation consumers, exact preimage+preview binding, branch reconciliation, then complete the remaining decision kinds. **Regression:** adopted plan changes, branch switch, removed/new block, human edit between preview/apply, amendment with cross-contract references, one-call known confirmation. **Rules:** INT-02/08/09/10/12, TS §7.8, AC-13a/17/23.

### F16 · P1 · Uncertainty is sometimes finalized away

**Source-confirmed.** [recover](../../../packages/kernel/src/verbs/recover.ts#L40) can conclude “an interrupted commit did not happen” from a failed positive postcondition, without the specified branch/reflog proof of non-performance. A commit on another branch or with a foreign hook path is not necessarily absent. Unknown/uncertain effects get a result record; `unresolved()` then considers them resolved on the next call. Dependent operations are not consistently stopped. Recovery runs in individual verbs, after some preconditions, and is absent from mutating packet/findings paths; even an identical cached call can bypass it.

Dependency resolution/install jobs have no durable install effect intent or postcondition validation. Exceptions are converted to an error-shaped result and can leave manifests changed while a message says the original files were restored. Failed installs are not restored as TS §9.11 specifies. Install script side effects and the spawn-to-run-record gap need explicit uncertainty. `stop --reason host-limit` is parsed but ignored.

**Required:** distinguish completed/not-performed/unresolved durably, fence resources while unresolved, reconcile every nonrepeatable effect before retry, and report truthful residue. **Regression:** crash on every effect step including install and hook-modified commit, branch moved during recovery, second call after uncertain outcome, backup restoration and cancellation. **Rules:** CON-12, NFR-03/04, TS §7.4/15, AC-17.

### F17 · P1 · Input/output/privacy limits are incomplete

**Source-confirmed, with A13 for a default exclusion.** The CLI reads an unbounded stdin stream; only `request` has the advertised 256 KiB string limit, while `propose` is unknown and review arrays/record text are mostly unbounded. The runner caps captured stdout/stderr independently but reads reports in full before validation and records no truncation flag. There is no report depth/size/mtime/path validation. Git subprocess buffers are 256 MiB and bookkeeping has no common timeout.

Redaction is applied to rendered responses, request/quote, and selected failure messages. It is not applied to every persisted proposal, intent/plan/finding field or manifest artifact. The stated patterns for `github_pat_`, arbitrary Authorization/Cookie values and sensitive paths are incomplete; incident-stop/copy-deletion behavior is absent. Output schemas exist but responses are not checked against them or size-bounded. A generic heuristic must not be presented as “no secrets.”

**Required:** enforce limits before allocating/parsing, record truncation as incomplete evidence, redact at every controlled persistence/send boundary, and implement the specified exposure disposition. Do not scan real user secrets to prove this; use synthetic canaries. **Rules:** SEC-06/11/14, TS §6.6/11.2–3, AC-11/16/18.

### F18 · P2 · Result and steering UX does not yet match the contract

**Source-confirmed.** [finish](../../../packages/kernel/src/verbs/finish.ts#L24) silently returns only eight reasons and an omitted count, while RES-02 requires every material reason and the UX says limits never cap truth. The full list is obtainable with `inspect why`, but the result does not carry a clear full-reason reference. Several headlines omit the exact endpoint term or required failing-check detail; plan/investigate labels can override an actually blocked result. Demo instructions, kernel-derived reading guide, scope-specific limitations and complete usage/model/environment fields are absent.

Quick checks go directly to finish, skipping the specified focused review. The skill describes a focused `findings` submission but there is no Quick manifest/reservation path supporting it. No scoped “fix findings N and M” contract exists. Skip-tests/review steering has no durable declined-step mechanism, so `continue-required` can oppose a user's authorized weaker endpoint. A finished contract cannot be repaired and recommitted after post-finish adoption/declined commit without a lifecycle path. `inspect result/impact/residue` are accepted but unavailable.

**Required:** render only complete kernel facts; implement the four shapes and supported steering with executable paths, not prose alone. Golden tasks must test concise/guided parity and recovery. **Rules:** UX §§3–10, RES-01–07, WRK-13, AGT-09.

### F19 · P2 · Public schemas and instructions advertise unfinished behavior

**Reproduced A10/A12; source-confirmed other examples.** `review` accepts `scope` and `base`, but ignores both and compares only working-tree changes against HEAD. A clean branch with a committed change against `main` yields **zero review files**. The slash command advertises documents, branches and files beyond this implementation. Profiles `promote`, `recipe-upgrade`, `continue` are accepted without their specialized safeguards. Some inspect views similarly parse and then refuse.

The approval snippet in TS §4.6 uses `--kind=basis`; [parseArgs](../../../packages/kernel/src/frontends/cli.ts#L20) treats that as an unknown key, not `kind`. `resolveSetting.howToChange` emits `--scope`, which is not a DecideInput field. The skill's reset example puts `reset` outside `propose`, and its plan example gives an item a dependency on itself. The skill's unconditional accept/integrate wording contradicts `auto-on-accept`/`never` handling. `grant-confirm` native channel further undermines that prose's chat rule.

**Required:** implement advertised scope/profile semantics or reject them at validation with a precise limitation; make examples executable conformance fixtures including decision bodies and returned guidance. **Rules:** TS §5.6/6.7, UX J-04/J-09/J-13, AC-21/26.

### F20 · P1/P2 · The gates are weaker than their descriptions

**Source-confirmed.** `coverage.ts` counts tags on `describe`/`it` titles, including suite-level tags. It cannot determine that a test proves the whole requirement, and does not fail missing reason-code fixtures or budget overruns (except the per-file cap). The default CI checks only M0 even while Alpha surfaces ship. Alpha's report fails independently. The obsolete SEC-13 exemption and several host-only buckets conceal locally testable gaps. 61 of 104 reason codes are merely referenced, not necessarily exercised.

The architecture scanner protects import boundaries but misses semantic omissions such as the unused editing hook; it is not a proof of one-writer safety. Skill lint misses invalid decision bodies, emitted guidance, examples outside its inline-command regex, missing self-contained reviewer fields, action routing mistakes and full task token accounting. The starter skill lacks its own enforced body budget. `npm run ci` typechecks twice. Formatting many transitions onto single long lines makes LOC budgets a poor readability measure; a few explicit blocks would improve review without creating new abstractions.

**Required:** keep lightweight tooling but test actual contracts and counterexamples. Add a milestone-aware evidence manifest with exceptions/partial claims; test never-waivable invariants independently of tags. Do not create metrics that reward adding tags instead of fixing behavior. **Rules:** owner instructions, TS §17.2/19.2, ENG-03/04, AC-26/28.

### F21 · P1 · Starter migrations do not automatically back up existing data

**Source-confirmed.** [migrate](../../../plugin/skills/tenet-starter-ts-web-api/template/server/src/platform/migrate.ts#L32) backs up only if the caller supplies `backupTo`. [buildApp](../../../plugin/skills/tenet-starter-ts-web-api/template/server/src/app.ts#L27) calls it without that option. Normal startup can apply a later migration to existing data with no backup. The helper comment promises more. There is no restore command, server/restore ownership protocol, restore marker or real startup-path restoration test.

The online-copy helper itself is useful and tests exercise it when explicitly requested. That does not establish the mandatory default data lifecycle.

**Required:** wire backup into the real migration path, preserve compatible metadata, implement/qualify restore before claiming data recovery. **Regression:** start a real prior-version database through the production entry path; verify consistent backup and preserved data; kill restore at each step and refuse competing server access. **Rules:** QLT-07, PRD §5.13/5.16, TS §12.5, AC-17/20.

### F22 · P2 · The starter platform has narrower guarantees than its comments imply

**Source-confirmed, with runtime follow-up needed.** CSRF/session comparisons compare JavaScript character lengths before `timingSafeEqual` on UTF-8 buffers; equal character lengths with different byte lengths throw rather than return a clean denial. Development credentials are stored and printed only on the first seed; subsequent-start guidance should point explicitly to that file. `server.ts` injects its DB, so `buildApp` does not register ownership of that connection for close; no graceful shutdown is wired. Login configures an IP+account limit; the comment's additional global per-IP protection across many accounts needs a real runtime test. These were not all exercised through a live HTTP server in this audit.

Architecture lint is based on import strings and its fixtures do not establish path-alias/re-export boundaries. Repositories are exempt from cross-feature rules. There is no OpenAPI compatibility contract, build artifact workflow, license list or prior-version fixture corpus yet. UI/domain content correctly starts empty at scaffold; the problem is missing platform/UI/quality infrastructure and the missing feature-building qualification, not that Tenet should ship the example equipment app prebuilt.

**Required:** small platform fixes with real malformed-request/start/stop tests, then build the planned starter journey through the ordinary Tenet workflow. Avoid expanding this into a generic application framework. **Rules:** TS §12, QLT-01/12, AC-20.

## Remaining work that is planned, rather than a defect in existing behavior

Use [completion-plan.md](completion-plan.md) for execution order; the [requirement ledger](requirements.md) keeps every due requirement visible.

| Workstream | Concrete missing deliverables | Owning plan sections |
|---|---|---|
| Host/platform | Disposition SP-01/02/06/08/10; full tuple; Host descriptor/probe provenance; SP-12 safety+friction experiment and selected transport; SP-04/05 model/usage limits; SP-07 removal/update; SP-11 evaluation procedure | §§3–4, 7.1 |
| Alpha core | All active setting consumers; complete acceptance basis/alternative checks; Analyst and assignments; selected-finding fixes; readiness states; recorded envelopes; charter; durable intent/decision docs; dependency completion; 10 golden tasks, replay CI, six formative sessions | §§7.2–7.5 |
| Adapter and trait hardening | Jest/Playwright/axe/ESLint/tsc/audit; unsupported-config outcomes; trait contributions; dedicated server/DB and semantic identity; bounded hostile parsers; baseline classification or allowed cut; committed-tree check or allowed cut; prototype promotion | §§8.1–8.2 |
| Continuity | State loss/clone recovery, quarantine, migration/backups/rollback, archive/eviction/admission, bounded logs/temp storage, lessons/forget/delete/cleanup/export, live version reconciliation, complete stop/cancel/residue | §§8.3–8.5 |
| Starter quality | React/Vite shell, real first-slice journey and authorization, OpenAPI, prior-version migration/restore, ASVS mapping, journey states, automated/keyboard/VoiceOver checks, workload/trends, notices/dependency refresh | §§6.7, 9.1 |
| Qualification/value | Frozen protocol and calibration/sign-offs; 30 public +10 reserved tasks; successive-changes comparison, negative controls, model strata, maintainer experiment, 8–12-person pilot and two-week escape follow-up | §§7.5, 8.5, 9.2–9.4 |
| Release | Inclusion list, SHA-pinned actions, reproducible build, payload/location verification, signed tag/provenance, independent rebuild/install proof, license/contribution/security/support/removal docs, tree+history privacy audit, owners and published risks | §§9.5–9.6 |

`publish` is absent and remote effects are refused. That is an honest current limitation. A future implementation must carry remote/branch/commit-bound authority and reconciliation before becoming available; a generic refusal is not the final remote-request implementation. Observer hooks remain conditional on SP-03, with absence as the documented fallback. Cross-family model routing, a second host/ecosystem and delivery/deployment are not unfinished R1 work.

## Spec and tracker defects needing explicit disposition

These should be corrected without weakening the PRD. No canonical semantics were changed by this audit.

1. **Milestone inconsistency:** at baseline, plan §6.2 called WRK-10 an M0 Must, while the PRD tags it Alpha. The plan wording was corrected in this audit. M0 remains 34 Musts; do not quietly grow/shrink the denominator.
2. **Transport contradiction:** at baseline, plan §7.1 said delete the other frontend, while TS §4.5 and plan §11.2 retain the CLI harness if MCP ships. The plan wording was corrected in this audit to follow the canonical rule.
3. **Restriction wording:** UX §8.2 rewrites “never touch migrations” into “ask permission”; plan §7.2 and the owner's guidance explicitly reject this weakening. Preserve a no-edit prohibition distinctly from protected-path consent.
4. **Acceptance wording:** UX-D10 says the setting never changes what “accept” does, then describes `auto-on-accept` doing both. TS §10.4's explicit prior disclosure is the adopted mechanism; skill wording must reflect it and offer acceptance without integration.
5. **Observation cadence:** TS §17.5's smoke wording conflicts with PRD ENG-05/full monthly qualification; PH0-3 already records the resolution but the canonical text is not backfilled.
6. **Canonical-source cleanup:** the tech spec says to delete draft schemas/agent text once code exists, but duplicate drafts remain. Some support-input types and receipt/response fields no longer match. Keep normative behavior, link canonical code, and remove competing drafts when finalized.
7. **Plan honesty:** dashboard Phase 0/1, Node 22 observation, starter presence, host-run statements and several “not built”/“uncommitted” notes are stale. README says no starter exists and nothing ran on VS Code; both contradict recorded work. Five skills ship, not four. Fix current summaries; preserve append-only historical entries as history.
8. **Safeguards scheduled after operations:** the plan acknowledges missing envelopes, payload verification, policy consumers and other safeguards while labeling operation slices implemented. Apply its own “operation with safeguard or absent” rule. The audit repairs this sequencing; it does not authorize waiving Musts.

## Quality conclusion

Retain the architecture and the useful tests. The next investment should be a small sequence of failing counterexample tests and corrections to the shared pipeline, evidence and Git/store boundaries, followed by re-running the real vertical slice. Completing more decision kinds before those guards work would increase the audit surface and rework. Full R1 still includes substantial product behavior, quality infrastructure and external evaluation; passing more unit tests alone cannot finish it.
