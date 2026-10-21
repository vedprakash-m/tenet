# Changelog

## 2026-10-21 — No function over the limits (`✅`, local)

**Changed.** `judgeReview`, `verdict`, `comparePolicy`, `effectivePolicy` and `resolveSetting` are split into short functions. Behaviour is unchanged; the recorded function offenders go from five to none. 287 over-wide lines remain recorded (296 before).

**Files.** `core/{verdict,policy,config}.ts`, `tools/quality-baseline.json`.

**Tests.** None added or changed: the existing suites are the proof.

## 2026-10-21 — Host port and capability descriptor (`◐`, local)

**Changed.** The plugin ships a capability descriptor and a `Host` port reads it. `inspect doctor` shows it; the review-independence control says what the host binding observed, and nothing it did not; the charter reader takes its candidate files from the descriptor. A host name in core, verbs, decisions or the pipeline now fails `lint-arch`.

**Files.** `core/{capabilities,controls}.ts`, `adapters/host-plugin.ts`, `ports/types.ts`, `wire.ts`, `verbs/{finish,inspect,manifest}.ts`, `plugin/com.github.copilot/descriptor.json`, `tools/{lint-arch,lint-quality}.ts`, specs (TS §4.4, §6.2).

**Tests.** `host-descriptor.test.ts` added (4).

## 2026-10-21 — Project charter in review manifests (`◐`, local)

**Changed.** The Reviewer's manifest carries the project's own charter when `AGENTS.md` or `.github/copilot-instructions.md` has one valid marked block, and the default charter otherwise. Adopting a charter is not built; it waits for SP-02.

**Files.** `core/charter.ts` (new), `verbs/manifest.ts`, `tools/lint-quality.ts`, specs (TS §6.2, §7.8).

**Tests.** `charter.test.ts` added (3).

## 2026-10-21 — Active work time (`✅`, local)

**Changed.** The kernel counts active work time between check-ins (call durations plus the gap after a call that said to keep working), warns at 80% of 15, 60 or 120 minutes, and refuses a new full candidate check at the bound with a proposal to extend. `decide extend --quote <words>` records the user's yes and restarts the count. The tenet skill has the steering row.

**Files.** `core/{budget,schemas}.ts`, `pipeline{,-render,-mutate}.ts`, `verbs/check.ts`, `decisions/{extend,index}.ts`, `plugin/skills/tenet/SKILL.md`, `tools/lint-quality.ts`, specs (TS §6.2, §8.6).

**Tests.** `active-time.test.ts` added (3).

## 2026-10-21 — Model record (`✅`, local)

**Changed.** The contract and each review and analyst result record the model the coordinator reported (`--model` on `open` and `findings`), or `inherited` with source `unknown`; `open`, `inspect status` and `finish` show it. Nothing is inferred. The tenet skill says to pass `--model` only when the host reports it.

**Files.** `core/{schemas,state}.ts`, `verbs/{open-new,open-context,findings,inspect,finish}.ts`, `plugin/skills/tenet/SKILL.md`, `tools/lint-quality.ts`, specs (TS §4.8, §6.2).

**Tests.** `model-record.test.ts` added (3).

## 2026-10-21 — Deep evidence (`✅`, local)

**Changed.** Deep work finishes `checked-local` only after a complete native architect pass and security pass on the current candidate. Before, the verdict ignored Analyst results and Deep could never get there. After the review is recorded, the result lists the passes still owed. The plugin has the spec's `tenet-analyst` agent; `tenet-reviewer` is for reviews only. The size ceiling for pipeline, verbs and decisions is 3,720 lines (+10).

**Files.** `core/verdict.ts`, `verbs/{facts,findings,manifest}.ts`, `plugin/com.github.copilot/agents/{tenet-analyst,tenet,tenet-reviewer}.agent.md`, `plugin/skills/tenet/SKILL.md`, `tools/lint-quality.ts`, specs (TS §6.2).

**Tests.** `deep.test.ts` added (2); `verdict.test.ts` (+2); the lint-skills fixture follows the new agents line. 662 tests.

## 2026-10-20 — Build TDD-03: test-alongside with a negative control (`✅`, local)

Implemented the protocol proposed and approved earlier: a new `disposition` outcome, `alongside`, lets the user record why a behavioral red is infeasible for an obligation (a reason is still required, like every other disposition). A new `--alongside <paths>` flag on `check` (mirroring the existing `--scaffold` flag) exempts named existing source paths from the baseline contamination check, but only once some obligation has a recorded `alongsideReason` — an undeclared `--alongside` bypasses nothing, and the seeded fault still has to genuinely fail the test for the baseline to be proved. Once proved, the verdict discloses `reason("test-alongside", ...)` as a non-blocking note (a reason code that existed in the registry but was previously dead code). Four new tests cover the refusal, the no-bypass-without-a-reason case, a non-failing seeded fault granting no false proof, and the full protocol reaching `checked-local` with the disclosure.

Changed `core/schemas.ts` (`Obligation.alongsideReason`, `WorkContract`/`CheckInput.alongside`), `verbs/check.ts`, `verbs/check-evidence.ts`, `core/verdict.ts`, `decisions/simple.ts` (split `disposition.run` into `reviseLock`/`dispositionAttention`/`dispositionFinding`/`dispositionElement`/`recordAlongside` to keep it under the quality gate after the new branch — this also dropped it from the recorded-offender list), `scenarios.test.ts`. Module budgets re-baselined as recorded feature increments: `core/schemas` 440→445 lines, `pipeline+verbs+decisions` 3,670→3,710 lines. Full `npm run ci` green: **658 tests / 136 suites**; 5 recorded quality offenders left, was 6; built-bundle UAT green; `npm run privacy` clean. Alpha coverage: TDD-03 newly T1-mapped (80/100, was 79).

## 2026-10-20 — Tag WRK-10's checkpoint clause honestly, partial (`◐`, local)

WRK-10 has two distinct clauses: checkpointing so a pause or interruption loses at most the work since the last checkpoint (T1-capable, already proven by two existing tests), and never auto-confirming a host pause (kernel has no concept of this; host territory, unobserved). Tagged only the first clause, on the existing pause/resume and SIGKILL-during-check tests. Considered INS-04 (three-tier readiness) too and left it untagged: the current single-scale assistance level does not actually report three separate tiers, so tagging it would repeat the mis-tagging pattern corrected earlier.

Changed `workflows.test.ts`, `scenarios.test.ts` (test-title tags only, no production code). Full `npm run ci` green: **654 tests / 135 suites**; built-bundle UAT green. Alpha coverage: WRK-10 newly T1-mapped, partial (79/100).

## 2026-10-20 — Verify `branching: current` through `integrate`; correct stale progress notes (`✅`, local)

Added the missing end-to-end test: an editing contract set to `branching: current` stays on its base branch through basis, check and finish, then `integrate` correctly refuses ("committed on the base branch itself") instead of erroring or switching branches. The one existing "nothing to integrate" test used a non-editing profile, which never takes a branch regardless of this setting, so it didn't actually prove this path. Also corrected three stale "not done" notes in the plan: `exclusions`/`required_checks`/`dependency_policy` already have real consumers; `commands` and `resource_mode` consumers genuinely remain open but for different, more current reasons (execution envelopes and an R1 Should, respectively, not "no analyst yet").

Changed `integrate.test.ts`. Full `npm run ci` green: **654 tests / 135 suites**; built-bundle UAT green.

## 2026-10-20 — Reduce `buildPlan`'s complexity below the quality gate's limit (`✅`, local)

Behavior-preserving refactor: split `core/plan.ts#buildPlan` (complexity 35) into `assignIds` (ID validation/assignment), `buildItem` (one proposed item's construction and same-vs-changed check) and a much shorter orchestrating `buildPlan` (complexity 12). No test changed; the full suite passes unmodified.

Changed `core/plan.ts`. Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green. 6 recorded quality offenders left, was 7.

## 2026-10-20 — Reduce `issueReview`'s complexity below the quality gate's limit (`✅`, local)

Behavior-preserving refactor: extracted `admissionGate`, `nextAttempt`, `dispatchNext` and `reserveIssued` out of `verbs/manifest.ts#issueReview`, the single highest-complexity function recorded by the quality ratchet (47). It is now 30 lines, complexity 21, within the per-function limit and no longer an offender (7 left, was 8). No test changed; the full suite passes unmodified.

Changed `verbs/manifest.ts`. Module budget bumped by a small recorded increment (3,650→3,670 lines) for the extracted functions' own declarations — quality-refactor growth, not new scope. Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green.

## 2026-10-20 — Default engineering charter reaches the Reviewer (`◐`, local)

The review manifest now carries a `charter` field (PRD §1.8's default engineering charter, 115/300 tokens), and the reviewer's Stage B is told to judge against it literally. This is the first charter awareness the Reviewer has had at all. Scope: only the default-charter half of QLT-09; a project's own adopted charter (parsed from `AGENTS.md`/`copilot-instructions.md`) remains unbuilt.

Changed `core/review.ts`, `verbs/manifest.ts`, `plugin/skills/tenet-review/SKILL.md`. New assertion in `contract.test.ts` (tagged `[QLT-09]`). Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green. Alpha coverage: QLT-09 newly T1-mapped (78/100).

## 2026-10-20 — Guard `repair-lock` against an unreproduced race (`◐`, local)

`repairLock` checked both lock files for liveness, then unconditionally removed whatever existed in a second pass — unlike the already-safe `breakStale` path, which re-reads and compares the nonce immediately before removing. A fresh live claim landing between the two passes would have been deleted. Fixed to match the existing safe pattern exactly. This is a code-reviewed defensive fix, not one proven by a reproduced race (R08's real-process races remain scheduled, not closed).

Changed `adapters/store-fs.ts`. New idempotency test in `store.test.ts`. Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green.

## 2026-10-20 — Selected-fix integrity fixes (`◐`, local)

`open fix` now refuses duplicate finding numbers instead of silently colliding two findings on the same synthesized ID. `attentionOf`'s stray-file exemption now compares a vetted file's current content hash to its recorded one, instead of exempting any path merely present in `vetted`: an edit to a scaffolded file outside the named findings is no longer silently invisible to review.

Changed `verbs/open.ts`, `verbs/check-evidence.ts`. New tests in `fix.test.ts` (2 added, 6 total). Full `npm run ci` green: **652 tests / 135 suites**; built-bundle UAT green. R09 remains open: review-identity retention, stale-review-context detection, explicit scope extension.

## 2026-10-20 — Bounded project-file reads and a log-repair fix (`◐`, local)

A bounded slice of R07 (storage bounds): project-file reads (policy, intent, manifest, lockfile) now refuse past 20 MB instead of loading unbounded. Found and fixed a real defect: `repairLogTail` never actually truncated a torn log line that happened to end in a newline — the keep-prefix calculation used the file's own trailing newline instead of the newline before the bad line, so corrupted bytes accumulated in `.tenet/log` forever (harmless to past recovery, since `readLog()` already drops the line per-entry, but wasteful and re-parsed every transaction).

Changed `adapters/project-fs.ts`, `adapters/store-fs.ts`, `core/reasons.ts` (new code `project-file-too-large`). New tests in `store.test.ts` and `project-boundary.test.ts`. Full `npm run ci` green: **650 tests / 135 suites**; built-bundle UAT green. R07 remains open: log-entry schema validation, bounded blob/log-tail reads, a total `.tenet` ceiling, and a real `sweepTemp` retention protocol.

## 2026-10-20 — Analyst agent, first slice (`◐`, local)

`packet analyst` dispatches a read-only researcher/architect/security assignment with no basis precondition; `findings` records its result via a new `kind`-discriminated `AnalystResult`/`ReviewResult` union. Several analysts can be live at once on one declared revision (AGT-03), reusing the existing reservation mechanism unchanged. A moved revision between dispatch and result is disclosed as a non-blocking note (AGT-11); non-completed status is never treated as a finished answer (AGT-05). Reuses the existing `tenet-reviewer` subagent; adds `architect.md`/`security.md` rubric resources.

Changed `core/schemas.ts`, `core/review.ts`, `core/state.ts`, `verbs/{packet,findings,manifest}.ts`, `plugin/skills/tenet/SKILL.md`, `plugin/com.github.copilot/agents/tenet-reviewer.agent.md`, `tools/lint-skills.ts`, `tools/uat/uat.mjs`. Module budgets re-baselined as recorded feature increments: `core/schemas` 400→440 lines, `pipeline+verbs+decisions` 3,560→3,645 lines (TS §6.2). New: `analyst.test.ts` (7 tests). Full `npm run ci` green: **648 tests / 135 suites**; built-bundle UAT green. Alpha coverage: AGT-03, AGT-05 newly T1-mapped (77/100). Not committed; not observed on a real host (SP-08 remains deferred).

## 2026-10-20 — Static populations and required-check conflicts (`◐`, local)

Conflicting required-check definitions now block checking and verdicts instead of silently selecting one. Doctor applies metadata exclusions before reading. Default static receipts retain bounded analyzed workspace files and reject unknown, linked, stat-only, malformed or incomplete proof. Supported local TypeScript/ESLint profiles are explicit; unsupported versions/configuration graphs do not execute. TypeScript names the project and disables incremental writes. Runner output is bounded by bytes, preserves UTF-8 across chunks and reports truncation as inconclusive. Adapter `node-ts@2` stales older evidence.

Changed configuration/receipt/schema/pipeline consumers, Node/process adapters, regression suites and built-CLI UAT. Final CI: **641 tests / 134 suites pass**, including 34 new controls. **45 UAT scenarios pass on Node 26.3.0 and minimum 22.12.0 against one 713,587-byte artifact**. [Evidence, fixture corrections and remaining work](docs/audits/2026-10-20/static-integrity.md). No ceiling raised, host run, commit or push. Effective configuration/dependency graphs and composite/reference isolation remain open before broader execution support.

## 2026-10-20 — Guarded Git filter preparation (`◐`, local)

Filter execution now stages through the published, guarded commit job with a recorded process group, minimal environment, timeout and cancellation. Intent preparation disables filters and filesystem monitors. Current consent preserves duplicate command order. Mutations or moved HEAD prevent an ordinary commit result; transformations refuse until committed-tree checks exist. Recovery checks the known work trailer and fails closed on unreadable trees.

Changed `adapters/git-cli.ts`, new pure `core/git-filters.ts`, commit/recovery ports and consumers, `filter-jobs.test.ts`, built-CLI UAT and canonical progress/mechanism docs. **607 tests / 131 suites pass; 38 built-CLI scenarios pass on Node 26.3.0 and 22.12.0** against the same 710,549-byte artifact. Sixteen new real Git/process controls. [Evidence and remaining work](docs/audits/2026-10-20/filter-jobs.md). No quality ceiling raised, host run, commit or push. R05/R06 static population and obligation composition are next; full Git qualification stays open.

## 2026-10-20 — GitHub reassessment and policy/static-evidence corrections (`◐`, local)

Reviewed the twelve cloud commits through `d457714` and their successful GitHub CI; added a current audit, all F01–F22 dispositions, a 200-requirement inventory and an ordered completion plan. Tightened adopted restrictions now apply before recovery/read-only admission. Contradictory ESLint populations are inconclusive, and unsupported static configuration/population/pass/alternatives refuse default substitution.

Changed `verbs/reconcile.ts`, `core/obligations.ts`, `adapters/node-ts.ts`, three regression suites, built-CLI UAT and canonical progress/mechanism documentation. Full CI: **591 tests / 130 suites pass**; **33 UAT scenarios pass on Node 26.3.0 and 22.12.0** against the same 709,447-byte bundle. No quality ceiling changed. Configured-filter preparation and the report's remaining gaps stay open. No host run, new commit or push.

## 2026-10-20 — Boundary-example note (`✅` T1; review plan A3d)

**Changed.** `decide basis` now says which requirement has neither a boundary example nor an invariant (`boundary-example-missing`, a note), except in Quick, so the coordinator proposes one as its own addition (INT-15). The intake skill says what to do with the note.

**Files.** `decisions/basis.ts`, `core/{obligations,reasons}.ts`, `plugin/skills/tenet-intake/SKILL.md`. **Tests.** `boundary-example.test.ts` (2); 579 tests. Alpha Musts with a T1 fixture: 76 of 100.

## 2026-10-20 — "Fix findings N and M" (`✅` T1; review plan A3c)

**Changed.** `open fix` takes the findings the user named, as the review gave them. They become the contract's open findings (`FND-n`) and its scope; a change to a file they do not name raises an attention item (`outside the named findings`) that needs a disposition, and the verdict stays unchecked while a named major finding is open. Before, the `fix` profile was refused. The tenet skill's steering row uses it.

**Files.** `core/schemas.ts`, `verbs/{open,open-new,check-evidence}.ts`, `plugin/skills/tenet/SKILL.md`, specs (TS §2.4).

**Tests.** `fix.test.ts` added (4). 577 tests.

## 2026-10-20 — Starter: backup before migrating, byte-wise secret comparison (`✅` T1; review plan A3b)

**Changed.** The starter takes a verified backup beside its database file before it applies a migration to a database that already holds data (it only happened if the caller passed a path, and the real start path never did). Secrets are compared by bytes through one `safeEqual`: a CSRF token with the same number of characters but different bytes was an unhandled error, and is now a 403. Not done: the restore tool, the UI shell and the first journey.

**Files.** Starter `server/src/platform/{migrate,safe-equal}.ts`, `auth/csrf.ts`, `session/session.ts` and two starter test files.

**Tests.** Two starter tests added (they run inside the kernel's starter suite: 24 tests); 573 kernel tests.

## 2026-10-20 — The starter reaches checked-local; declining a step (`✅` T1; review plan A2a, A3a)

**Changed.** Unchanged files a recipe scaffold wrote no longer raise the lane (they were forcing Deep, which cannot be satisfied yet), so the starter scaffold ends `checked-local` and committed, with its tests, types and lint run by the kernel. `decide decline --target tests|review --quote <words>` records a declined mandatory step: the contract stops with reason `declined` and the result names the step, instead of `finish` answering `continue-required`. The tenet skill's steering table uses it.

**Files.** `pipeline-mutate.ts`, `decisions/{decline,index}.ts`, `plugin/skills/tenet/SKILL.md`, specs (TS §6.5, §8.2).

**Tests.** `decline.test.ts` added; `starter.test.ts` and `scaffold.test.ts` assert the new journey. 573 tests.

## 2026-10-20 — The kernel runs the project's typecheck and lint (`✅` T1; review plan A1a)

**Changed.** `check` runs TypeScript and ESLint as obligations (`OB-types`, `OB-lint`) with their own receipts and normalization, so a passing test run cannot hide a type error. A contract owes them when its recipe names them (`recipe.json` `checks`; the starter does) or when a required check is named `types`, `typecheck`, `lint`, or has tool `tsc` or `eslint`; they apply from the next call after the setting changes. Other required checks and configured commands are still refused. CI runs on every branch push.

**Files.** `adapters/node-ts.ts`, `core/{obligations,receipts,config,schemas}.ts`, `ports/types.ts`, `verbs/{check,check-evidence,check-finalize,reconcile,inspect}.ts`, `decisions/{basis,scaffold}.ts`, `pipeline-mutate.ts`, starter `recipe.json`, workflow, specs (TS §12.2).

**Tests.** `static-checks.test.ts` added (normalization, receipts, which checks are owed, a real `tsc` through the pipeline); `starter.test.ts` now relies on the kernel's own types and lint. 569 tests.

## 2026-10-20 — Stabilise: Git filters, refusals, budgets, UAT in CI (`✅` T1; review plan S0)

**Changed.** Reading never runs a configured Git filter, and a filter no file uses no longer matters (Git LFS installed globally blocked `open`, `check` and `review` with no way forward). A commit that would run an applying filter asks first (`filter-consent`) and runs it only after consent; undo and integration refuse under one. Refusals have their own reason codes and a next step (`handle-required`, `handle-unknown`, `not-a-repository`, `hook-consent-needed`, `filters-not-run`); a refused `open` in a folder with no Git creates nothing. Module line budgets are ceilings in `tools/lint-quality.ts`, counted in lines. One default for a test's baseline expectation. The built-bundle scenarios moved to `tools/uat/` and run in CI on Node 24 and 22.12.0.

**Files.** `adapters/git-cli.ts`, `ports/types.ts`, `decisions/consent.ts`, `verbs/commit*.ts`, `verbs/open*.ts`, `pipeline*.ts`, `core/{errors,reasons,obligations,verdict,risk}.ts`, `tools/lint-quality.ts`, `tools/coverage.ts`, `tools/uat/`, CI workflow, `README.md`, specs (TS §6.2 names the budget checker).

**Tests.** `filters.test.ts` and `refusals.test.ts` added; `quality-gate.test.ts` covers module ceilings; three expectations moved to the new codes. 556 tests; the starter install test needs registry access.

## 2026-10-19 to 2026-10-20 — C0 corrective batch after the audit (committed in `e0bc1a0`, CI green)

**Changed.** Safety corrections found by `docs/audits/2026-10-19`: store and state admission, source ownership and late-job fencing, human-file attribution, operation exclusions and flagged Git inputs, receipt and baseline integrity, lock revision provenance, risk, budget and branch admission, a destructive-stop preview, Quick's focused review, takeover confirmation, guarded runner spawn and report admission, quarantine and fresh start, durable spent-counter recovery, journalled index-sync recovery, checkout-hook admission, atomic project-file writes with policy-aware recovery. Unbuilt committed-tree checks, scoped review and specialised profiles refuse. Later commits split the longest functions and added the quality ratchet (`tools/lint-quality.ts`).

**Files.** Kernel adapters, core, verbs, decisions, pipeline, ports; plugin guidance; tools; specs; `docs/audits/`.

**Tests.** 545 tests / 118 suites at `e0bc1a0`; thirty built-bundle scenarios on Node 26.3.0 and 22.12.0. Details: `docs/audits/2026-10-19/remediation.md` and `remediation-evidence.json`.

## 2026-10-19 — Declared scaffolding, self-sufficient review manifest, plugin loads on Copilot CLI and VS Code

Added `check --stage baseline --scaffold <paths>` (declared scaffolding is not contamination; TS §9.8), a working-tree digest in the call identity (TS §6.4), a review manifest that carries the reviewer's `rubric` and a `resultTemplate` (the reviewer subagent has only read and search tools and cannot load a skill), a YAML-parsing front-matter lint, and the real `$schema` URL in `plugin.json`. Plugin text: every `description` is quoted YAML; the `tenet` skill defines how to run the kernel and says to stop if not started by the agent. Budgets: bundle 750 KB, pipeline/verbs/decisions 2,200 lines with a 250-line cap per file. Observed on Copilot CLI 1.0.99 and VS Code 1.142.0: the standard-lane loop with a real reviewer subagent (see `specs/plan.md` §4.1; partly observed). Tests: 201. Modified: `packages/kernel/src` (schemas, check, manifest, review, recipes), `plugin/`, `tools/` (build, coverage, lint-skills), `specs/tech-spec.md`, `specs/plan.md`. New dev dependency: `yaml`.

## 2026-10-19 — Prototypes, hook and index observations, support locks, integrate and undo

Added the shadow repository for non-Git prototypes, `decide sync-index`, locks on support files and runner configuration, `integrate` and `undo` (with `decide undo-confirm`, `branch-switch` and `config`), `tools/bench-inventory.ts`, and tests against real husky and lint-staged. Tests: 196. Modified: `packages/kernel/src` (git adapter, pipeline verbs and decisions), `plugin/skills`, `specs/plan.md`.

## 2026-10-18 — M0 kernel, plugin, starter recipe

Added the deterministic kernel (ten verbs, one pipeline, six ports), the plugin (agents, commands, five skills), the `ts-web-api` starter recipe and its scaffold effect, the build, architecture, skill and privacy checks, and a requirement-to-fixture coverage report. Tests: 177 across core, verdict, store, Git, scenarios, workflows, scaffold, starter, tools and invariants. Not observed on the real VS Code Copilot host; see `specs/plan.md`.

| Area | Where |
|---|---|
| Kernel | `packages/kernel/src` |
| Plugin | `plugin/` |
| Checks | `tools/` |
| Tests | `packages/kernel/test` |
