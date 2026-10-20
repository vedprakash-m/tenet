# Changelog

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
