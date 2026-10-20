# Changelog

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
