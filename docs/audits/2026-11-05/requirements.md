# Requirement inventory, November 5, 2026

Generated from the canonical PRD and existing coverage tool. Mapping means a tagged test exists; it does not mean the entire requirement passes. All semantic dispositions are unreviewed; all qualification remains open. Should dispositions are not inferred. Exact input fingerprints: [status.json](status.json).

| ID | Priority | Due | Mapping | Acceptance cases | Canonical requirement |
|---|---|---|---|---|---|
| INS-01 | Must | M0 | host-only | AC-01 | Tenet shall install as one plugin through the qualified native install path without cloning, building, editing JSON or installing a runtime. |
| INS-02 | Must | R1 | mapped | AC-01, AC-11 | The README shall state, before installation, prerequisites, publisher and verification steps, the support matrix and assistance levels, permissions and executable content, a first task, and update and removal steps. |
| INS-03 | Must | M0 | host-only | AC-02, AC-21 | When invoked with a task, Tenet shall accept the task before any setup and run only the readiness checks that task depends on. |
| INS-04 | Must | A | mapped | AC-03, AC-21 | Tenet shall distinguish plugin-ready, project-ready and action-ready states and report only those relevant to the current task. |
| INS-05 | Must | B | unmapped | AC-19, AC-21 | When the host version, plugin version, policy or relevant project inputs change, Tenet shall re-probe only the affected capabilities; otherwise it shall reuse cached observations with provenance. |
| INS-06 | Must | A | mapped | AC-03 | If a required capability is missing, Tenet shall block only dependent operations, name the missing prerequisite, and offer the safe next action and unaffected alternatives. |
| INS-07 | Must | M0 | mapped | AC-01 | The installed product shall require no runtime, service, database, MCP server, API key or CI beyond the documented host account and the project's own tools; Tenet helpers reuse the project's Node.js. |
| INS-08 | Should | R1 | disposition pending | AC-01 | If policy blocks plugin installation or required features, the README shall explain the native recovery path. |
| INS-09 | Must | A | host-only | AC-21 | Tenet shall answer questions, help and status requests conversationally without creating a work contract or files. |
| INS-10 | Must | A | host-only | AC-21 | Tenet shall announce its engagement and next step once when a task starts, not on every reply. |
| INS-11 | Must | B | mapped | AC-03, AC-21 | When a project needs Node.js, a package manager or Git that is missing, Tenet shall explain the prerequisite, link the official installer and re-check, without installing software itself. |
| INS-12 | Must | A | mapped | AC-03, AC-21 | Before implementation, Tenet shall state the assistance level (Section 2.3) for the current project and task. |
| INT-01 | Must | M0 | host-only | AC-04, AC-21 | Before asking questions, Tenet shall inspect existing source, docs and conventions and reuse established facts. |
| INT-02 | Must | A | mapped | AC-13a | Tenet shall record intent with separate sections for purpose and value, users, accepted requirements with examples and invariants, constraints, preferences, non-goals, assumptions, deferred choices and plan items. |
| INT-03 | Must | A | mapped | AC-04, AC-21 | Tenet shall ask only questions whose answers change the next dependent action, each with a recommendation, its consequences, and a reversible default where one is justified. |
| INT-04 | Must | M0 | mapped | AC-24 | For behavioral work in Standard and Deep lanes, Tenet shall express the agreed outcome as concrete examples in the user's domain language; when the request already states unambiguous cases, Tenet shall record them as confirmed and show them in the contract summary, and otherwise shall obtain the user's confirmation before implementation. |
| INT-05 | Must | M0 | mapped | AC-05, AC-24 | Tenet shall implement the acceptance basis as executable acceptance tests before the production behavior they cover, tag them with their IDs, and lock each test once its verification result is recorded (Section 3.7.2). |
| INT-06 | Must | A | mapped | AC-07, AC-24 | When a locked acceptance test must change, Tenet shall record the reason and obtain user confirmation for a behavior change, or an independent review disposition for a test defect; related mechanical corrections may share one disposition. |
| INT-07 | Must | A | mapped | AC-13a | Tenet shall keep inferred requirements as assumptions until the user confirms them. |
| INT-08 | Must | B | mapped | AC-13a | When intent changes, Tenet shall identify affected requirements, examples, plan items, tests, decisions and in-flight work and present the impact before proceeding. |
| INT-09 | Must | B | mapped | AC-13a | Tenet shall record consequential decisions in MADR format with context, options, choice and consequences, linked to the IDs they affect. |
| INT-10 | Must | A | mapped | AC-13a, AC-25 | Tenet shall assign stable, branch-safe IDs to durable plan items, requirements, examples, constraints, assumptions and decisions (Section 3.7.3). |
| INT-11 | Must | R1 | host-only | AC-21 | While style is Guided, Tenet shall present examples and choices without technical jargon and explain consequences in domain terms. |
| INT-12 | Must | A | mapped | AC-04, AC-12 | When a request spans several increments, Tenet shall propose an ordered, editable plan of independently checkable increments with dependencies, track progress against it, and propose the next item on request. |
| INT-13 | Should | R1 | disposition pending | AC-04 | Tenet shall let the user designate existing planning documents as intent, plan and status sources instead of creating `INTENT.md`. |
| INT-14 | Should | R1 | disposition pending | AC-20 | Tenet shall keep `docs/architecture.md` describing current components, data model and integration points. |
| INT-15 | Must | A | mapped | AC-24, AC-27 | Tenet shall define each work's acceptance basis (Section 4.5.1) and propose at least one boundary or negative example for each new requirement. |
| WRK-01 | Must | M0 | mapped | AC-04, AC-13a | Tenet shall record a work contract for each implementation task containing outcome, acceptance basis, scope, protected paths, checks, execution envelopes, endpoint, budget, branch and base, pinned versions and recovery point. |
| WRK-02 | Must | M0 | mapped | AC-21 | A clear user request shall authorize routine in-scope local steps (edits, inspected checks, review, bookkeeping, recovery preparation) without further approval prompts. |
| WRK-03 | Must | A | mapped | AC-08, AC-13a | Tenet shall request new authority only when behavior, data or access, compatibility, protected paths, irreversible or remote effects, or resource limits change beyond the contract. |
| WRK-04 | Must | A | mapped | AC-21 | Tenet shall recommend a lane from the Section 5.2 assessment of the change, re-assess it after inspection, state the reason in one line, and let the user raise it, or lower it no further than the floor. |
| WRK-05 | Must | A | host-only | AC-21 | Tenet shall route feature, bug, review, investigation, refactor, prototype, plan and continuation requests through the main workflow without the user choosing a mode. |
| WRK-06 | Must | B | mapped | AC-05, AC-21 | When the user explicitly requests a prototype, Tenet shall label it unhardened, keep it within declared data limits, record its gaps in `docs/hardening.md` and never report it as checked. |
| WRK-07 | Must | B | mapped | AC-05 | When an unhardened prototype is promoted, Tenet shall inventory shortcuts, characterize working behavior, add distinguishing checks for missing safeguards and obtain independent review before a checked-local verdict. |
| WRK-08 | Must | M0 | mapped | AC-15c, AC-19 | Tenet shall apply the per-contract limits of Section 4.4.2 at the boundaries their mechanism class allows, warn at 80%, and at the bound stop with a diagnosis. For the active-time check-in the stop also carries a specific extension proposal; for attempts, review rounds and delegations it carries the next step instead (Section 4.4.2). |
| WRK-09 | Must | A | mapped | AC-15c | If the same operational failure recurs twice in a row, or attempts oscillate, Tenet shall stop retrying and present a diagnosis; planned failing tests in TDD do not count as failures. |
| WRK-10 | Must | A | mapped | AC-08, AC-21 | Tenet shall checkpoint at declared boundaries and before known host limits where observable, so an iteration pause or interruption loses at most the work since the last checkpoint, and shall never auto-confirm a host pause. |
| WRK-11 | Must | B | host-only | AC-21 | Tenet shall support status, refine, pause, cancel, undo, integrate, decline and resume as defined in Section 3.4. |
| WRK-12 | Must | A | mapped | AC-08 | Tenet shall reserve enough budget to write a handoff and diagnosis before exhaustion. |
| WRK-13 | Must | B | mapped | AC-21, AC-27 | If the user declines a mandatory step, Tenet shall proceed only to an endpoint whose label reflects the missing evidence (Section 4.5.2), state it once, and never lower the floor silently. |
| AGT-01 | Must | A | mapped | AC-22 | Tenet shall define roles as responsibility contracts (Section 3.9) independent of model names. |
| AGT-02 | Must | M0 | mapped | AC-06, AC-22 | On the R1 tuple, Tenet shall dispatch the Reviewer as a native subagent with fresh context for consequential work and record observed dispatch metadata. |
| AGT-03 | Must | A | mapped | AC-22 | Tenet shall dispatch independent read-only Researcher assignments in parallel when they observe one declared source revision. |
| AGT-04 | Must | A | mapped | AC-22 | Each assignment shall carry goal, contract and config revision, source baseline, minimal context, permitted actions, budget and expected output. |
| AGT-05 | Must | A | mapped | AC-22 | Each result shall report completed, partial, blocked, failed or cancelled, plus artifacts inspected or changed, findings and open dependencies; partial output shall not count as completion. |
| AGT-06 | Must | B | mapped | AC-22 | Child work shall not expand authority, reset budgets or delegate further; violations found in traces are findings (mechanism: cooperative plus detected, Section 5.4). |
| AGT-07 | Must | B | mapped | AC-22 | The coordinator shall resolve factual disagreements by evidence and present normative product or risk choices to the user as options with a recommendation. |
| AGT-08 | Must | A | mapped | AC-17 | Tenet shall hold an atomic write-ownership claim (Section 5.11) before writing and run at most one write workflow per workspace. |
| AGT-09 | Should | B | disposition pending | AC-22 | For small tasks, Tenet shall use a focused same-session pass instead of dispatch and shall not describe it as a separate agent. |
| AGT-10 | Must | B | unmapped | AC-21, AC-22 | Users shall obtain results without managing specialist lifecycles or reading subagent transcripts. |
| AGT-11 | Must | B | mapped | AC-22 | When parallel readers return findings against a revision that has since changed, the coordinator shall reconcile them before acting. |
| AGT-12 | Must | B | unmapped | AC-19, AC-22 | When an assignment changes a non-private interface or symbol, selected context shall prioritize direct importers and callers and linked acceptance tests (Section 3.8.7). |
| TDD-01 | Must | M0 | mapped | AC-05 | For changed behavior, Tenet shall run at least one distinguishing reproduction test that fails on the baseline and passes on the candidate, and shall record the expected results of preservation, boundary and negative cases, which may pass on both. |
| TDD-02 | Must | M0 | mapped | AC-05 | For new interfaces, Tenet shall add minimal compilable scaffolding so the failing test is behavioral; a compile or import error alone shall not count as a failing test. |
| TDD-03 | Must | A | mapped | AC-05 | If a behavioral failing test is infeasible, Tenet shall use a test-alongside approach with a negative control and disclose it in the result. |
| TDD-04 | Must | A | mapped | AC-05, AC-20 | In existing code, Tenet shall characterize affected behavior before changing it and preserve unrelated behavior. |
| TDD-05 | Should | B | disposition pending | AC-05 | After green, Tenet shall refactor when it reduces complexity within scope, then rerun affected checks. |
| TDD-06 | Must | B | mapped | AC-05 | For nonbehavioral work, Tenet shall state the alternative check instead of writing artificial tests. |
| EVD-01 | Must | M0 | mapped | AC-18 | Tenet shall bind every check result to the candidate (base commit, digest of relevant uncommitted and untracked files, lockfile, configuration, toolchain, execution envelope) without hashing or storing secret values. |
| EVD-02 | Must | M0 | mapped | AC-07 | Tenet shall record each check's verdict, qualifiers, freshness and source as defined in Section 3.7.2; zero tests executed shall be inconclusive. |
| EVD-03 | Must | A | mapped | AC-18 | When an input changes, Tenet shall mark dependent evidence stale; an input of unknown relevance shall invalidate conservatively or make the result inconclusive. |
| EVD-04 | Must | B | unmapped | AC-18, AC-19 | Tenet shall run the distinguishing reproduction and targeted checks on the baseline before changing code; when a broader check fails on the candidate and is not already recorded as a baseline failure, Tenet shall rerun it on the baseline in a sealed checkout outside the workspace (Section 5.13) to classify it as pre-existing or introduced. |
| EVD-05 | Must | A | mapped | AC-18, AC-20 | Tenet shall normalize evidence through ecosystem adapters under the contract of Section 3.8.3. |
| EVD-06 | Must | M0 | mapped | AC-07, AC-27 | Owner acceptance shall never convert a failed or missing check into pass. |
| EVD-07 | Must | M0 | mapped | AC-07, AC-13a | Tenet shall state each consequential control's mechanism class (Section 5.4) and assurance level (Section 5.3.4). |
| EVD-08 | Must | B | mapped | AC-07, AC-18 | Tenet shall distinguish flaky, simulated, partial and unavailable-history results from pass and fail; a result is classified flaky only under the Section 4.4.1 rerun policy. |
| EVD-09 | Must | B | mapped | AC-18 | Declared fixture mutations, caches and outputs shall not invalidate evidence; unexpected changes to relevant inputs shall. |
| EVD-10 | Must | A | mapped | AC-07, AC-24 | Tenet shall detect any change to a locked acceptance test by comparing it with the lock manifest at every check and review, and report undisposed changes as blocker findings. |
| EVD-11 | Must | B | mapped | AC-18 | If a relevant input changes while a check runs, Tenet shall treat that result as inconclusive. |
| EVD-12 | Must | A | mapped | AC-18 | Each check result shall keep an execution receipt (Section 3.8.3); a model-written summary is not a receipt. |
| EVD-13 | Must | A | mapped | AC-18, AC-20 | Integration and end-to-end checks shall use a dedicated test database and a server instance verified as Tenet-started for this candidate, never the user's development data or an unverified process on the port (Section 5.13). |
| EVD-14 | Should | R1 | disposition pending | AC-25 | Tenet shall classify imported CI results as externally produced, and as protected acceptance evidence only after the verification in Section 5.3.5. |
| REV-01 | Must | M0 | mapped | AC-06 | Consequential work shall receive a fresh-context native review of intent, the acceptance basis, the full diff including tests and configuration, and evidence receipts. |
| REV-02 | Must | M0 | mapped | AC-06 | Review shall give separate verdicts for behavior and intent, and for structure, security and charter; neither compensates for the other. |
| REV-03 | Must | A | mapped | AC-07 | Review shall list changes to assertions, test discovery, skips or focus markers, snapshots, mocks, suppressions, CI and dependencies for explicit disposition. |
| REV-04 | Must | A | mapped | AC-06, AC-27 | Findings shall carry severity, evidence and a disposition under Sections 3.7.2 and 4.5.3. |
| REV-05 | Must | A | mapped | AC-06 | Review shall stay within the lane's review-round budget (Section 4.4.2) plus one focused recheck; exhausting it is not approval and leaves unresolved items under the verdict policy. |
| REV-06 | Must | A | host-only | AC-06 | Tenet shall disclose reduced independence whenever it actually occurred, including same-session review or tests written and reviewed by the same session. |
| REV-08 | Must | B | mapped | AC-06, AC-27 | When the change exceeds the Reviewer's context budget, Tenet shall split review coverage, narrow the increment, or report the uncovered parts, and shall not issue a whole-change verdict from partial coverage. |
| REV-09 | Must | B | mapped | AC-24 | Review shall challenge the sufficiency of the acceptance basis and the fidelity of each acceptance test to its example, and propose missing behavior as assumptions or requirements without expanding scope. |
| RES-01 | Must | M0 | mapped | AC-21 | The result shall lead with the outcome and how to use it, then checks, limits and next actions, with details on demand (Section 3.3). |
| RES-02 | Must | M0 | mapped | AC-07, AC-27 | The result shall state the endpoint chosen by the verdict policy (Section 4.5.2) and every condition that prevented a stronger one. |
| RES-03 | Must | A | host-only | AC-21 | Tenet shall not ask a routine final approval question; owner acceptance stays pending until the user accepts or rejects, or integrates the work. |
| RES-04 | Must | M0 | mapped | AC-08 | At contract end, pause or budget stop, Tenet shall write a handoff sufficient to resume in a new session without re-explanation. |
| RES-05 | Must | B | unmapped | AC-20 | For user-facing changes, the result shall include a demo path: run instructions, the steps that show the confirmed examples and, for the `ui` trait, screenshots. |
| RES-06 | Must | A | mapped | AC-04 | A review-only request shall end at findings; "fix findings N and M" shall implement only those findings and reuse the review context. |
| RES-07 | Must | B | host-only | AC-21 | Tenet shall disclose stable host and assurance limits once and when they change, and repeat a limit only when it materially affects the current task. |
| RES-08 | Should | R1 | disposition pending | AC-21 | While style is Guided, Tenet shall offer to start the local app under native consent and confirm the local URL responds. |
| RES-09 | Should | B | disposition pending | AC-15c | Before Deep work, Tenet shall show the expected budget envelope and its main cost drivers. |
| GIT-01 | Must | M0 | mapped | AC-17, AC-25 | Checked implementation shall require a Git repository; in a non-Git folder Tenet shall offer to initialize one (only after the user chooses it), proceed read-only, or build a prototype backed by a snapshot. |
| GIT-02 | Must | M0 | mapped | AC-25 | Tenet shall create a work branch from the current HEAD per contract unless the user chooses the current branch, record the base, state when work is stacked on an unintegrated branch, and never rewrite published history. |
| GIT-03 | Must | M0 | mapped | AC-25 | Tenet shall commit at green boundaries, staging only changes it authored in scope while preserving the user's index, following the project's commit convention, with `Tenet-Work` and `Tenet-Req` trailers whose names are fixed in R1 (recovery and undo find commits by the exact name). |
| GIT-04 | Must | A | mapped | AC-17 | Undo shall preview the inverse of the work's commits against current state, preserve later human changes, apply only after confirmation and run applicable checks afterwards. |
| GIT-05 | Must | M0 | mapped | AC-04, AC-25 | Tenet shall push, open or merge remote pull requests, or publish only on explicit request. |
| GIT-06 | Should | R1 | disposition pending | AC-25 | On request, Tenet shall draft a pull request description from the contract, examples, evidence and open findings. |
| GIT-07 | Should | R1 | disposition pending | AC-20, AC-25 | The starter recipe shall include a CI workflow running the same check obligations. |
| GIT-08 | Must | M0 | mapped | AC-17, AC-25 | Tenet shall include uncommitted human edits in the candidate it checks, and shall never stage, commit, stash, reset or discard them without explicit consent. |
| GIT-09 | Must | B | unmapped | AC-17 | When Tenet's shared files conflict on integration, Tenet shall reconcile by ID, detect same-ID different-content collisions, and propose the merged content for user confirmation. |
| GIT-10 | Must | M0 | mapped | AC-17, AC-25 | When work starts on a dirty working tree, Tenet shall record the starting HEAD, index and dirty paths and ask whether to commit the user's changes separately, include named files in scope, or leave them untouched. |
| GIT-11 | Must | A | mapped | AC-25 | When the user accepts a result, Tenet shall offer to integrate the work branch into its base branch locally, following the `integration` setting, as a reversible step distinct from push or publication. |
| GIT-12 | Must | A | mapped | AC-16, AC-25 | Tenet shall treat Git hooks, signing and configured Git programs as executable effects: inspect them before the first commit, run them under native consent, never bypass them, and rerun affected checks when hooks modify files. |
| GIT-13 | Must | B | mapped | AC-25 | Tenet shall report a specific readiness outcome for detached HEAD, rebase or merge in progress, unresolved conflicts, shallow clones, submodules, LFS and linked worktrees before implementing. |
| GIT-14 | Should | R1 | disposition pending | AC-25 | Tenet shall offer to delete a work branch after integration or abandonment, and never delete unintegrated work without consent. |
| GIT-15 | Must | A | mapped | AC-17, AC-25 | If a checkpoint commit cannot be made under existing authority, Tenet shall keep the candidate uncommitted, report the recovery limitation and not claim the work is committed. |
| CON-01 | Must | B | mapped | AC-08, AC-15a | At the end of the first successful increment, or on request, Tenet shall offer once, with a preview, to add the shared files of Section 3.2 to the repository, warn when the remote is public, and remember the answer. |
| CON-02 | Must | M0 | mapped | AC-17 | Tenet shall keep operational state in `.tenet/` with its own `.gitignore`, user-only permissions where the OS supports them, an ownership marker, and no files with source, test or build-configuration extensions (snapshots stored as content-addressed blobs). |
| CON-03 | Must | M0 | mapped | AC-08 | On resume, Tenet shall reconcile current source, branch and human edits with recorded state and reuse only valid evidence and corroborated authority (Section 5.14). |
| CON-04 | Must | A | mapped | AC-17 | Records shall carry schema version, project and work identity, revision and provenance, and be updated inside an atomic ownership boundary (Section 5.11). |
| CON-05 | Must | B | mapped | AC-17 | If records are malformed, of unknown version or conflicting, Tenet shall diagnose and reconcile, never silently reset or infer authority. |
| CON-06 | Must | A | mapped | AC-08, AC-16 | Copied, imported, relocated or pre-populated records shall confer no authority and no behavior until reviewed (Section 5.6). |
| CON-07 | Must | B | unmapped | AC-08 | If `.tenet/` is lost, Tenet shall reconstruct from repository memory and Git history, ask only consequential unknowns and never fabricate evidence. |
| CON-08 | Must | B | mapped | AC-19 | Tenet shall keep `.tenet/` within the storage budget using the eviction order of Section 5.15. |
| CON-09 | Must | M0 | mapped | AC-04 | Review-only and readiness requests shall create no files in the project, including `.tenet/`; by default they run as a single stateless kernel call, may use host plugin storage outside the workspace where available, and export durable results only on request. |
| CON-10 | Must | B | mapped | AC-09, AC-10 | Reset a preference, forget a lesson, delete records, abandon work, undo and uninstall shall be separate actions, each previewing its consequences. |
| CON-11 | Must | B | mapped | AC-17 | When the project moves, is cloned, or changes branch or machine, Tenet shall reconcile scope instead of transferring authority by path. |
| CON-12 | Must | B | mapped | AC-17 | Tenet shall record intended, dispatched and observed effects so a crash between an effect and its record is detected and reconciled before any retry. |
| SEC-01 | Must | M0 | host-only | AC-03 | Tenet shall use native permissions, explain why each is needed, its scope and what declining prevents; a denied action stays denied and is not retried through another tool. |
| SEC-02 | Must | M0 | mapped | AC-16 | Tenet shall treat repository, retrieved, tool-output and lesson content as untrusted data that cannot grant authority, change acceptance or trigger egress; adopted shared files follow Section 5.6. |
| SEC-03 | Must | A | mapped | AC-11 | Tenet shall collect no credentials, unrelated projects, private chat histories or telemetry by default. |
| SEC-04 | Must | A | mapped | AC-04, AC-16 | Before first execution, Tenet shall classify each command by its declared execution envelope (Section 5.8), not by its name. |
| SEC-05 | Must | A | mapped | AC-16 | For new dependencies, Tenet shall verify identity and existence, license, install scripts including transitive lifecycle scripts, and lock resolution, and seek native consent for executable changes. |
| SEC-06 | Must | A | mapped | AC-16 | Bundled helpers shall accept only validated structured input, resolve workspace boundaries including symlinks, and expose no generic execution endpoint. |
| SEC-07 | Must | A | mapped | AC-11 | R1 shall bundle no MCP server or MCP configuration, except the Tenet kernel front-end of Section 5.7.1 when SP-12 selects it. |
| SEC-08 | Must | B | mapped | AC-16, AC-23 | Tenet shall honor declared exclusions (no-model-send, no-read, no-edit, no-export, no-routine-scan) before affected reads where controllable, disclose host limits and block incompatible work. |
| SEC-09 | Must | B | mapped | AC-16, AC-20 | Review shall flag new network destinations, telemetry calls, credential handling and permission changes introduced in generated code. |
| SEC-10 | Must | A | mapped | AC-07 | Tenet shall never weaken tests or CI, bypass hooks, or alter permissions to make a task pass. |
| SEC-11 | Must | A | mapped | AC-11, AC-16 | Tenet shall redact likely secrets from displayed output, traces and exports, and never write credential values into records or fixtures. |
| SEC-12 | Must | A | mapped | AC-16 | Shared project files and imported or pre-populated `.tenet/` content may add restrictions and obligations but shall never grant authority, add egress, relax floors or authorize commands; changes made outside Tenet need user acceptance before they relax anything (Section 5.6). |
| SEC-13 | Must | M0 | mapped | AC-03, AC-16 | If host tool auto-approval is enabled or unknown, Tenet shall ask in chat before remote mutation, project-content egress and destructive actions, and label that gate advisory. |
| SEC-14 | Must | A | mapped | AC-16, AC-23 | Tenet shall apply the default exclusions of Section 5.10.2 for common secret files. |
| SEC-15 | Must | B | mapped | AC-16 | If a check's execution envelope has unknown network, data or credential exposure, Tenet shall obtain the user's authorization to run with the stated unknowns and disclose them in the result. |
| SEC-16 | Must | B | host-only | AC-21 | When work concerns regulated, safety-critical, clinical or financial-transaction functions, Tenet shall state that its verdicts cover software checks only and that qualified human expertise is required. |
| CFG-01 | Must | B | unmapped | AC-23 | Users shall change settings in ordinary language and receive the interpreted value and scope; persistence, read-back and confirmation follow Section 7.5. |
| CFG-02 | Must | B | mapped | AC-23 | R1 shall expose the catalog in Section 7.3 and no others. |
| CFG-03 | Must | B | unmapped | AC-23 | Tenet shall resolve settings as defined in Section 7.4; project commitments and external restrictions shall apply regardless of preference order. |
| CFG-04 | Must | B | unmapped | AC-23 | `/tenet why` shall explain the effective value, its source and adoption state, overridden values and capability limits. |
| CFG-05 | Must | A | mapped | AC-23 | Configuration shall never grant authority or create a capability. |
| CFG-06 | Must | B | mapped | AC-15a, AC-21 | Style and checkpoints shall change presentation and pacing only, never depth, authority or evidence floors. |
| CFG-07 | Should | R1 | disposition pending | AC-09 | Explicit "always in this project" corrections shall persist locally with provenance without re-asking; inferred preferences shall need confirmation. |
| CFG-08 | Must | B | unmapped | AC-15a | Personal preferences shall never be written into shared files. |
| CFG-09 | Must | B | mapped | AC-23 | Tenet shall coexist with other plugins, instruction files and host memory features without rewriting or disabling them (Section 7.9). |
| CFG-10 | Must | B | mapped | AC-23 | Reapplying unchanged settings shall be idempotent. |
| CFG-11 | Must | B | mapped | AC-23 | Unknown or malformed configuration whose intended effect may be a restriction shall block dependent actions until resolved (Section 7.7). |
| RSC-01 | Must | A | mapped | AC-15b | Tenet shall use the active model without asking the user to switch models per phase. A disclosed economy-tier model preference for the read-only researcher role is permitted once release qualification shows it meets that role's thresholds, and the user can decline it in words; the Reviewer and authority-bearing roles always inherit the active model. |
| RSC-02 | Must | A | mapped | AC-15b | Tenet shall record the requested and observed model per assignment where observable; unknown stays unknown. |
| RSC-03 | Must | A | mapped | AC-15c | Tenet shall respect native limits and never fund, purchase, enable overage or switch to a paid route without explicit authority. |
| RSC-04 | Must | B | mapped | AC-15c, AC-19 | Tenet shall report per-contract counts of attempts, review rounds, delegations, Tenet-launched checks and active work time; comparative overhead is an evaluation metric (Section 6.6). |
| RSC-05 | Should | R1 | disposition pending | AC-15c, AC-23 | While resource mode is Conserve, Tenet shall prefer focused passes for optional roles; while it is Serial, Tenet shall dispatch no optional or parallel subagents; the review required by the Section 5.2 floors still runs. |
| RSC-08 | Must | R1 | unmapped | AC-15b, AC-26 | Tenet shall label the active model qualified, unqualified or unknown from golden-suite results (Section 6.4.4) and warn before Deep work on an unqualified or unknown model. |
| LRN-01 | Must | A | mapped | AC-09 | Tenet shall apply an explicit correction to the current task immediately. |
| LRN-02 | Must | B | mapped | AC-09 | Project lessons shall be scoped, inspectable and resettable, carry provenance, and never transfer to another project without explicit scope. |
| LRN-03 | Must | A | mapped | AC-05, AC-09 | Tenet shall turn a reported defect into a reproduction test before fixing it. |
| LRN-04 | Should | R1 | disposition pending | AC-09 | At contract end, Tenet shall propose lessons only when supported by evidence from that work, for user confirmation. |
| LRN-05 | Must | B | mapped | AC-09, AC-14 | Learning shall never weaken acceptance, add permissions or change evaluators. |
| LFC-01 | Must | R1 | unmapped | AC-10 | Tenet shall version releases with SemVer against the public compatibility contract of Section 6.5. |
| LFC-02 | Must | R1 | mapped | AC-10, AC-11 | Release notes shall disclose changed permissions, destinations, executable content, evaluators, schemas and evaluated behavior changes. |
| LFC-03 | Must | B | mapped | AC-10 | Each contract shall record the Tenet package, recipe, adapter and schema versions it uses; when an update is observed mid-contract, Tenet shall pause at the next boundary and reconcile or migrate the contract explicitly, never mixing versions silently. |
| LFC-04 | Must | R1 | mapped | AC-10 | Schema migrations shall be previewed, preserve overrides and unknown fields where safe, and have a tested path back to the previous known-good release. |
| LFC-05 | Must | R1 | mapped | AC-10 | Disable and uninstall shall preserve code, specs and evidence, list residual files and offer optional cleanup of `.tenet/`. |
| QLT-01 | Must | A | mapped | AC-20 | The starter shall demonstrate persistence, validation, server-side object and role authorization, and a real local journey. |
| QLT-02 | Must | R1 | mapped | AC-20 | The starter shall meet its published list of applicable OWASP ASVS 5.0 Level 1 requirements, each with a verification method (automated, behavioral test or manual review), non-applicability reasons and results; scans alone shall not be presented as ASVS conformance. |
| QLT-03 | Must | R1 | mapped | AC-20 | The starter UI shall meet WCAG 2.2 AA on its declared critical journeys and their states, verified by automated, keyboard and screen-reader checks; claims shall name the journeys covered. |
| QLT-04 | Must | R1 | mapped | AC-20 | The starter shall include structured logging with redaction, a health endpoint and consistent non-leaking error responses. |
| QLT-05 | Must | R1 | unmapped | AC-19, AC-20 | Each application recipe shall declare a reference workload and fitness functions (Section 5.16); checks shall report trends across changes without claiming whole-application conformance from changed flows, and a trend crossing its declared degradation threshold across consecutive checks shall raise an attention item rather than only appear in a report. |
| QLT-06 | Must | B | mapped | AC-20 | Tenet shall apply the obligations contributed by the project's and the change's traits (Section 3.8.4). |
| QLT-07 | Must | R1 | mapped | AC-20 | Schema changes shall include a migration tested against prior-version fixture data and, where user data exists, a consistent backup through a supported mechanism with a tested restore; Tenet shall never reset data to make tests pass. |
| QLT-08 | Should | R1 | disposition pending | AC-20 | As part of handover, Tenet shall keep README run instructions, decision records, the architecture doc and CHANGELOG current. |
| QLT-09 | Must | A | mapped | AC-15a | Tenet shall apply the project charter, or the default charter (Section 1.8) when none exists. |
| QLT-10 | Must | B | mapped | AC-13a | Tenet shall flag a suspected out-of-scope improvement instead of expanding the task. |
| QLT-11 | Must | B | unmapped | AC-20 | Tenet shall detect, record and let the user correct project and change traits (Section 3.8.5). |
| QLT-12 | Must | A | mapped | AC-16, AC-20 | The starter shall follow the identity, exposure and data model of Section 5.16. |
| QLT-13 | Must | B | unmapped | AC-20 | For changes with `auth`, `persistence`, `personal-data` or `external-effects` traits, Tenet shall record a short threat and data note whose security items become tests or constraints. |
| QLT-14 | Must | B | mapped | AC-20 | For the `ui` trait, Tenet shall cover the states listed in Section 3.8.4 for each changed flow. |
| QLT-15 | Should | R1 | disposition pending | AC-10, AC-20 | Tenet shall record each project's recipe version and offer recipe upgrades as ordinary work items with a diff preview. |
| QLT-16 | Must | R1 | mapped | AC-11 | Maintainers shall refresh starter dependencies monthly and respond to critical vulnerabilities in starter dependencies within the release-stewardship window (Q-09). |
| QLT-17 | Must | B | mapped | AC-20 | The starter and every prototype shall keep `docs/hardening.md` listing what must change before shared, networked or production use. |
| ENG-01 | Must | A | mapped | AC-01, AC-26 | Tenet's core shall ship in Agent Skills format with thin host bindings (Section 3.8.1). |
| ENG-02 | Must | A | mapped | AC-03, AC-26 | Each host binding shall ship a capability descriptor, and core logic shall branch on capabilities only (Section 3.8.2). |
| ENG-03 | Must | M0 | mapped | AC-19, AC-26 | Tenet's CI shall lint skills and agents for validity and enforce the context budgets of Section 4.4.3. |
| ENG-04 | Must | A | mapped | AC-26, AC-28 | Tenet shall run its evaluation tiers as defined in Section 6.4.3, blocking merges on deterministic-tier regressions and releases on full-suite regressions. |
| ENG-05 | Must | R1 | unmapped | AC-26 | Maintainers shall rerun the native-host suite monthly and when a host model change is observed; until then the support matrix shall label the combination "not yet evaluated with the current model". |
| ENG-06 | Should | R1 | disposition pending | AC-13a | Trace fields shall follow the pinned OpenTelemetry GenAI subset (Section 3.8.8). |
| ENG-07 | Must | R1 | unmapped | AC-11 | Releases shall satisfy the verification chain of Section 5.9.2. |
| ENG-08 | Must | R1 | unmapped | AC-14 | Before R1, maintainers shall complete one bounded improvement experiment under Section 6.10. |
| ENG-09 | Must | B | mapped | AC-13a | Trace events shall link intent revision, work, role, observed model, action, permission outcome, check outcome, timestamps and termination state, and shall declare visibility gaps. |
| ENG-10 | Must | A | mapped | AC-28 | Tenet's own CI shall follow the security tiers of Section 5.9.3. |
| ENG-11 | Must | R1 | unmapped | AC-11 | Until two maintainers exist, changes to executable content, hooks, helpers or permissions shall follow the solo-maintainer review rule of Section 5.9.2, disclosed in release notes. |
| OSS-01 | Must | R1 | unmapped | AC-11 | The repository shall publish a license, attribution, CONTRIBUTING, code of conduct, SECURITY.md and the supported-version policy. |
| OSS-02 | Must | R1 | host-only | AC-02 | Documentation shall include a quickstart, an examples gallery (new app, brownfield bug, review) and troubleshooting. |
| OSS-03 | Should | R1 | disposition pending | AC-20 | Recipe, role and host-binding contributions shall follow an RFC process and carry a certification level (experimental, community, official). |
| OSS-04 | Must | R1 | mapped | AC-11 | Using Tenet shall not require disclosure of application source or give Tenet any ownership of the application; obligations from incorporated templates, snippets, assets and dependencies remain and are listed for the starter. |
| OSS-05 | Must | R1 | mapped | AC-11 | Before publication, maintainers shall review the source tree and reachable history for private material separately from package inclusion. |
| OSS-06 | Should | R1 | disposition pending | AC-11, AC-21 | `/tenet feedback` shall produce a redacted, previewable report the user can attach to an issue. |
| NFR-01 | Must | R1 | unmapped | AC-19 | Tenet shall meet the system budgets of Section 4.4.3 on the frozen reference fixtures. |
| NFR-02 | Must | B | host-only | AC-21 | Tenet's own messages shall be usable by keyboard and screen reader, use text rather than color-only status, and state what failed, what remains safe and the next action. |
| NFR-03 | Must | A | mapped | AC-03, AC-13b | A required control shall never fail open silently. |
| NFR-04 | Must | A | mapped | AC-17, AC-19 | If network, model or tools fail, Tenet shall preserve known state and budgets, avoid spawning fallback work, and clean up only Tenet-owned processes and temporary paths. |
| NFR-05 | Must | B | unmapped | AC-19 | Tenet shall report its active work time separately from provider, tool, network and user waiting time. |
| NFR-06 | Must | R1 | host-only | AC-21 | R1 interaction language shall be English; generated application locale, time zone and code conventions are independent project decisions. |
| NFR-07 | Must | B | unmapped | AC-11 | Diagnostics shall be redacted and exported only on user request, with the included content previewed. |
