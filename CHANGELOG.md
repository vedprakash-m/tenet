# Changelog

## 2026-10-20 — Project-file admission, atomic writes and recovery (`◐`, uncommitted)

Accepted-fact writes and recipe creation use exclusive no-follow temporary files, inode checks, durable publication and directory sync. Project access applies normalized exclusions and refuses link aliases/non-files; reads and hashes distinguish absence from unreadability. Unreadable adoption/scaffold effects stay unresolved. Stop handles process cancellation while deferring project reconciliation to a policy-aware call. Orphan atomic files cannot enter source identity or content access.

Modified the project/Git adapters, exclusions, ports, pipeline/stop/recovery callers and canonical documentation. Added `project-boundary.test.ts`, `project-recovery.test.ts`, a competing-process fixture and six adoption/scaffold SIGKILL cases; expanded built-CLI UAT by seven scenarios. Final `npm run ci`: **532 tests / 113 suites pass**. The 691,372-byte bundle passes twenty-nine scenarios on Node 26.3.0 and minimum Node 22.12.0. The first full run had one unclassified starter receipt failure; isolated and full reruns pass, and the assertion now includes receipt diagnostics. Retention, read bounds, complete filesystem races and other C0 gates remain open. Host runs deferred; no commit, push or remote CI.

## 2026-10-20 — Journalled index recovery and checkout-hook admission (`◐`, uncommitted)

Index sync journals process/inode ownership before making Git's lock visible. Recovery removes only dead matching owners, preserves competing locks and newly staged human content, and reruns only against the recorded commit. A directory-fsync failure after rename stays uncertain. Work-branch creation refuses the unbuilt checkout-hook execution path; explicit current-branch use and commit-only hooks remain usable.

Modified schemas/ports, Git adapter, commit/manual-sync/recovery callers and canonical documentation. Added `index-recovery.test.ts`, `branch-admission.test.ts` and a real-process crash fixture; extended built-CLI UAT with filesystem fault injection. Full `npm run ci`: **507 tests / 111 suites pass**. The 689,604-byte bundle passes twenty-two scenarios on Node 26.3.0 and minimum Node 22.12.0. Storage retention, guarded checkout and other C0/milestone gates remain open. Host runs deferred; no commit, push or remote CI.

## 2026-10-20 — Quarantine and durable recovery (`◐`, uncommitted)

Added resumable inode-bound quarantine/fresh-start with a bound metadata-review choice; strict lock/process identities; inode-aware index cleanup; durable spent-counter and allocated-sequence recovery with opaque failure signatures. Backup diagnostics disclose suspended authority and accounting status; unknown accounting refuses editing admission. A landed undo with a lost contract stays uncertain. Content adoption, reconfirmation, full index crash recovery and other C0 gates remain open.

Modified filesystem/Git/process adapters, budget/state/schemas, pipeline, open/recovery/adoption paths, ports, coordinator guidance and canonical documentation. Added quarantine and backup-accounting suites with real SIGKILL/concurrency/competing-index fixtures and expanded built UAT. `npm run ci`: **487 tests / 109 suites pass**. The 686,177-byte bundle passes fourteen scenarios on Node 26.3.0 and minimum Node 22.12.0 against the same hash. Host runs deferred; no commit, push, remote CI or milestone qualification.

## 2026-10-20 — Readiness, input identity and recovery follow-up (`◐`, uncommitted)

Checks re-probe the installed runner and respect stack-metadata exclusions; declared ignored acceptance/support/configuration inputs and configuration absences bind evidence. Linked/excluded proof inputs and hostile reporter fields refuse. State records have byte/depth bounds and private permissions; temp/artifact writes reject links. Recovery validates process records, retains unknown-orphan/cancellation fences and atomically distinguishes prepared from starting runs. Integration and undo use guarded bounded process groups; integration hooks/signing remain unavailable until their consent path exists.

Modified the store, Git, runner and Node adapters, ports, pipeline, obligations/schemas, facts/check/recovery/integration/undo paths and corresponding tests/fixtures. Added readiness-boundary, declared-inputs, runner-ownership and store-boundary suites; expanded the portable UAT and canonical mechanism/progress documentation. Full `npm run ci`: **457 tests / 107 suites pass**, no failures or skips. The 674,084-byte bundle passes ten UAT scenarios on Node 26.3.0 and minimum Node 22.12.0 with the same recorded hash; the official minimum-runtime archive checksum was verified. C0 and later milestone gates remain open; no commit, push, remote CI or new host spike.

## 2026-10-20 — C0 safety follow-up (`◐`, uncommitted)

Integrated Quick's required same-session focused review without native delegation charges; added active-chat takeover confirmation, atomic runner spawn admission, bounded report ownership checks, strict stored restrictions, review-chain and coverage validation, baseline-definition invalidation, NUL index sync, foreign hook-edit detection and uncertain-commit fencing. Configured signing/execution and missing Deep passes refuse stronger results until their consumers exist. Modified the corresponding adapters, ports, pipeline, core, verbs/decisions, workflow fixtures, plugin guidance and canonical progress records; added takeover, runner-artifact and focused-review regression suites.

Local `npm run ci`: **435 tests / 103 suites pass**, no failures or skips; bundle 666,340 bytes within 750 KB. Six built-bundle scratch-repository UAT scenarios pass. Synthetic review results establish protocol behavior only. C0 and every milestone/host/release gate remain open. No commit, push, remote CI or new host spike.

## 2026-10-19 — First audit correction batch (local, uncommitted)

Corrected shared state/authority admission, source ownership and late-job publication, recovery uncertainty, human-file attribution, operation exclusions, flagged Git inputs, receipt/baseline integrity, lock revision provenance, risk and budget admission, per-work branches and bounded commit hooks. Abandonment now previews in advisory chat before confirmation; removed the obsolete SEC-13 unreachable exemption. Unbuilt committed-tree checks, scoped review and specialized profiles explicitly refuse. Fixed CLI equals syntax, input bounds, and plugin/README guidance.

Modified: kernel adapters, core schemas/obligations/verdict/config/exclusions, pipeline and ports, affected verbs/decisions/frontend/wiring and their tests; plugin coordinator/intake/review-command text; coverage tooling; specs and audit documentation. Added `core/input.ts`, `decisions/abandon.ts`, and audit, CLI-input, review-admission and stop-approval tests. Local `npm run ci`: **408 tests / 100 suites pass**, no failures or skips, bundle within 750 KB. Five built-bundle scratch-repository UAT scenarios pass. See `docs/audits/2026-10-19/remediation.md` and `remediation-evidence.json`; C0 and all milestone/host/release gates remain open. No commit, push or remote CI in this batch.

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
