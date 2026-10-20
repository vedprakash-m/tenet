# Changelog

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
