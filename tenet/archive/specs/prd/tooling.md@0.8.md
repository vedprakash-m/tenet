# Tenet requirements: standard, kit, agents and conformance

> Level L1 · Version 0.8 · Part of [prd.md](../prd.md) · Status: **draft, awaiting the Owner's approval** · Budget: 7,000 tokens · Split from `prd.md` §4.4–§4.5 under the rollover rule (L-0014)

**Context card.** Requirements for how the standard is written and versioned, how the kit is installed and kept current, how agents and engines bind to it, and how conformance is tested. Columns and guarantee levels follow [prd.md §4](../prd.md#4-requirements). The spec process (§4.0), the kernel (§4.1), trust (§4.2) and work and views (§4.3) stay in `prd.md`.

## 1. Standard, kit, install and upgrade

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-001 | A normative kernel (Part I) of at most 8,000 tokens; reference packs and practices (Part II) are non-normative | V-P4, V-P7 | M0 | — | proposed |
| R-002 | Every kernel "must" rule has a rule ID: provisional from 0.1.0, stable from 1.0 | V-V4 | 0.1.0; M4 | — | proposed |
| R-003 | The standard names no tool, model or vendor as a requirement | V-P4, V-B1 | M0 | — | proposed |
| R-004 | Each release has a changelog and its migrations | V-V3, V-B6 | 0.1.0 | — | proposed |
| R-005 | A rule or field is deprecated for one minor version before removal | V-B6 | 0.1.0 | — | proposed |
| R-007 | Conformance classes: producer, evaluator, executor, renderer, project, each at `minimal` (R-205) or `full` level; catalog entries become normative for a project once its pack declares them, and are tested for that claim | V-V4 | 0.1.0 | — | proposed |
| R-009 | The kernel is checked against four reference cases: a library with unobservable installs, a regional rollback, a migration with a point of no return, an ML change with no code change | V-V5, V-P4 | M0 | — | proposed |
| R-010 | JSON Schemas with fixtures for the seven primitives, the work item, policy, lock, pack, agent, loop, assignment, result, criteria and board | V-V4, V-P2 | 0.1.0 | — | proposed |
| R-012 | Reference agents for every role a shipped pack binds: builder and judge (0.1.0), shaper and verifier (0.1.x), the rest with the standard pack | V-V1, V-P2 | 0.1.0; 0.1.x; M2 | — | proposed |
| R-013 | One judge protocol; criteria as structured data; critics differ by criteria and required inputs | V-P2 | 0.1.0 | — | proposed |
| R-014 | Loops `station` and `fix` (0.1.0); `triage`, `upgrade`, `qualify` later; tunable by narrowing | V-P4 | 0.1.0 | — | proposed |
| R-015 | A reviewer that passes the 5-case activation test is **advisory**; satisfying an enforced gate needs the larger risk-tiered suite (M2); smoke suites at M3; qualification at M5 | V-P2, V-H4 | 0.1.0; M2; M5 | enforced | proposed |
| R-016 | Packs are data: `minimal` (intake, define, build, verify, integrate, close; quick and standard lanes, express in 0.1.x) by default, **pull-request native** (catalog R-186); `software-standard` at M2. Each pack lists its standard claims, selectors, work types and methods; a short pack-authoring contract says how | V-P7 | 0.1.0; M2 | — | proposed |
| R-017 | A skills library in the open agent-skills format; project skills pinned by hash | V-P4, V-V1 | 0.1.0 | detected | proposed |
| R-018 | Agents change state only through commands that write events | V-P10 | 0.1.0 | detected | proposed |
| R-020 | `tenet init` creates a project on `minimal`, writes a `tenet.yaml` of at most 15 lines (owners and areas read from CODEOWNERS, checks naming existing scripts, everything else defaulted) and reports readiness for advisory or verified work, naming each trust assumption that does not hold | V-V3, V-P7 | 0.1.0 | — | proposed |
| R-021 | `tenet adopt` adds the same files without touching existing ones and writes a discovery packet | V-V3 | 0.1.x | — | proposed |
| R-022 | `init` and `adopt` are idempotent and repair only with `--repair` | V-B6 | 0.1.0 | — | proposed |
| R-023 | Every file written by `init`, `adopt` or `upgrade` is listed in the output and an `ops` packet | V-B3 | 0.1.0 | — | proposed |
| R-024 | Base footprint: `tenet.yaml`, `tenet.lock`, an `AGENTS.md` block, `.tenet/`, the records folder; other integrations offered one by one | V-V3, V-P7 | 0.1.0 | — | proposed |
| R-025 | `tenet eject` removes what Tenet installed, keeping policy, records and user overlays | V-V3 | M2 | — | proposed |
| R-026 | `tenet doctor` reports kit integrity, hand-edited generated files and the latest trust observation, offline | V-B6, V-B8 | 0.1.0 | — | proposed |
| R-027 | Behavior found at adoption is `reported`, never `built` | V-B7 | 0.1.x | — | proposed |
| R-028 | Records from other tools enter as packets keeping a reference to their source | V-P4 | 0.1.x | — | proposed |
| R-050 | The lock records version, integrity and file hashes; local kit edits fail `tenet check` | V-V3, V-B6 | 0.1.0 | enforced* | proposed |
| R-051 | `tenet upgrade` stages, migrates, regenerates and opens an `ops` packet; interrupted upgrades resume or roll back | V-V3 | M4 | — | proposed |
| R-052 | Upgrades classify themselves from structured fields; below 1.0 every minor needs review | V-B6 | M4 | enforced* | proposed |
| R-053 | Overlays may only narrow | V-B2 | 0.1.0 | detected | proposed |
| R-054 | A scheduled CI job opens the upgrade pull request | V-V3 | M4 | — | proposed |
| R-055 | A changed reference agent stays inactive until it requalifies | V-H4 | M5 | enforced | proposed |

## 2. Agents, execution, conformance and quality

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-040 | `tenet agent check` validates definitions, skills, rosters and generated files; widening fails | V-B2 | 0.1.0 | detected | proposed |
| R-041 | Engine adapters implement an open contract: compile, start, status, cancel, workspaces, usage, suspend and resume, next work | V-P4 | M3 | — | proposed |
| R-042 | `--target agents-md` (0.1.0) and host targets (0.1.x, M3) declare per capability whether the host enforces it | V-P4, V-P12 | 0.1.0; 0.1.x; M3 | as declared | proposed |
| R-043 | `tenet run` writes the assignment, invokes the adapter and records the run | V-H2 | M3 | — | proposed |
| R-044 | Loops are checked statically: rounds only rise within a cap; inspection follows creation; refusals outrank convergence; human gates list stop first | V-P2, V-P6 | 0.1.0 | enforced | proposed |
| R-045 | `tenet freeze` / `thaw`; revoking in-flight authority is separate and recorded | V-B2 | M3 | — | proposed |
| R-046 | Critics run after deterministic checks where the lane calls for them; findings are introduced, exposed, inherited or uncertain, and count only once substantiated; invalid findings make a review incomplete, which never converges | V-P2 | 0.1.0 | enforced | proposed |
| R-047 | Runs record independence facts; packets record who wrote their tests | V-P2 | 0.1.0 | detected | proposed |
| R-206 | **Agents are subjects.** An agent definition is a subject; its qualification is a continuing claim on the tuple (definition, model, harness, toolset, task class), so changing any of them makes it stale; evaluation results are evidence; promotion and retirement are decisions. Definitions add `sponsor`, `acts_as` (a bot identity), `side_effects`, `may_propose` (claim types) and, for reviewers, `independence` and `abstain_when` | V-P2, V-P11, V-H4 | 0.1.0 (fields); M5 (qualification) | detected | proposed |
| R-048 | The package exports an SDK with the CLI's functions, and a JSON file contract for writing evidence, results and decision requests that engines can use without the SDK | V-V4 | 0.1.0 | — | proposed |
| R-049 | A local MCP server exposes the SDK, with no network access | V-V4 | M3 | — | proposed |
| R-060 | `tenet-conformance.yaml` declares version, classes, packs, mode and guarantee levels | V-V4 | M4 | — | proposed |
| R-061 | `tenet conform` runs the tests for each declared claim | V-V4 | M4 | — | proposed |
| R-062 | Implementations are tested on their outputs, not their source | V-P4 | M4 | — | proposed |
| R-063 | Fixtures cover positive, refusal, overlapping, concurrent, late-arriving and interrupted cases | V-H3 | 0.1.0; M4 | — | proposed |
| R-064 | An independent reader written from the kernel text alone reaches the same decisions | V-H3, V-V4 | 0.1.x | — | proposed |
| R-070 | `tenet agent qualify` scores an adapter-run suite deterministically | V-H4 | M5 | — | proposed |
| R-071 | `tenet agent promote` stages versions only when thresholds hold | V-H4 | M5 | — | proposed |
| R-081 | Every command runs on Windows, macOS and Linux with Node 22+ | V-V3 | 0.1.0 | — | proposed |
| R-082 | `board` and `check` within 3 s warm and 10 s cold for 500 packets, 10,000 event files and 5,000 commits | V-V2 | 0.1.0; M2 | — | proposed |
| R-083 | Every error names the file, the rule ID and the fix | V-V1 | 0.1.0 | — | proposed |
| R-084 | Every command supports `--json` with the same facts | V-V4 | 0.1.0 | — | proposed |
