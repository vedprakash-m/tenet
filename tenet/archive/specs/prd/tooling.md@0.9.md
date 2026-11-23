# Tenet requirements: work, views, kit, agents and conformance

> Level L1 · Version 0.9 · Part of [prd.md](../prd.md) · Status: **draft, awaiting the Owner's approval** · Budget: 7,000 tokens · Split from `prd.md` §4.3–§4.4 under the rollover rule (L-0014, L-0016) · Previous version: `archive/specs/prd/tooling.md@0.8.md`

**Context card.** Requirements for work items and views, how the standard is written and versioned, how the kit is installed and kept current, how agents and engines bind to it, and how conformance is tested. Columns and guarantee levels follow [prd.md §4](../prd.md#4-requirements). The spec process (§4.0), the kernel (§4.1), trust (§4.2) and adoption (§4.5) stay in `prd.md`.

## 0. Work, views and operations

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-032 | `tenet board` reduces events, pull-request state and evidence for a named as-of time into a versioned `board.json` (refs read, phases on a shared vocabulary, dependencies, typed next actions with the command and an optional `dispatch` payload, optional `active_runs`) and `now.md`; the default view is what waits for you, what is blocked and what changed since you looked; a single-file HTML viewer ships with it; generated views are never committed; a fixture gallery ships for UI builders | V-V2 | 0.1.0 | — | proposed |
| R-035 | `tenet close` computes the endpoint and writes a ledger entry; from 0.1.x it turns the packet's preservation items into continuing promises with their proving cases | V-P2, V-P9 | 0.1.0; 0.1.x | enforced* | proposed |
| R-037 | **Leases** (exclusive work locks, optionally over `paths`) are advisory in a working copy and exclusive only where an engine provides an atomic update; strength is shown; resuming an interrupted station is idempotent | V-P5, V-P12 | 0.1.0; M3 | advisory | proposed |
| R-038 | Hooks catch violations early; CI reruns the same checks | V-P2 | 0.1.0 | detected | proposed |
| R-072 | `tenet metrics` computes vision and diagnostic metrics with units, sample sizes and bounds | V-M3, V-M4 | M2 | — | proposed |
| R-073 | The board shows flow from 0.1.0: verified changes per week by lane, lead time (median, 85th percentile), work in progress, decision wait, cost per outcome with source, autonomy share beside escapes | V-V2, V-M3, V-M4, V-M7, V-M9 | 0.1.0 | — | proposed |
| R-074 | `tenet audit sample` draws a random sample of verified changes for independent rerun or review and reports the rate with its bound | V-M2 | M2 | — | proposed |
| R-075 | The decision-reconstruction exercise is a published procedure run in every pilot | V-M1 | M0; 0.1.x | — | proposed |

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
| R-012 | Reference agent cards for the core roles (shaper, planner, builder, verifier, judge): builder and judge in 0.1.0, shaper and verifier in 0.1.x, planner with the standard pack; Part II gives examples of a spec gardener and specialist critics (security, architecture, test oracle) | V-V1, V-P2 | 0.1.0; 0.1.x; M2 | — | proposed |
| R-013 | One judge protocol; criteria as structured data; critics differ by criteria and required inputs | V-P2 | 0.1.0 | — | proposed |
| R-014 | Loops `station` and `fix` (0.1.0); `triage`, `upgrade`, `qualify` later; tunable by narrowing | V-P4 | 0.1.0 | — | proposed |
| R-015 | A reviewer that passes the 5-case activation test is **advisory**; satisfying an enforced gate needs the larger risk-tiered suite (M2); smoke suites at M3; qualification at M5 | V-P2, V-H4 | 0.1.0; M2; M5 | enforced | proposed |
| R-016 | Packs are data: `minimal` (intake, define, build, verify, integrate, close; quick and careful lanes, express in 0.1.x) by default, **pull-request native** (catalog R-186); `software-standard` at M2. Each pack lists its standard claims, selectors, work types and methods, and maps its stations onto a shared phase vocabulary (discover, define, build, verify, release, operate, learn) that every board and UI uses; a short pack-authoring contract says how | V-P7 | 0.1.0; M2 | — | proposed |
| R-017 | A skills library in the open agent-skills format; project skills pinned by hash | V-P4, V-V1 | 0.1.0 | detected | proposed |
| R-018 | Agents change state only through commands that write events | V-P10 | 0.1.0 | detected | proposed |
| R-020 | `tenet init` starts a project at the `observe` level. In an existing repository it detects checks, owners (CODEOWNERS), the forge and existing specification documents and asks for one confirmation; in a new project it asks what is being built and its kind, and writes `tenet/intent.md` from that kind's template. It writes five files or fewer, says what to do next, and never reports a missing trust assumption as a failure | V-V3, V-P7, V-B10 | 0.1.0 | — | proposed |
| R-221 | **Getting Tenet takes one step.** One command from npm, or straight from a GitHub tag before the npm release; a prompt a coding agent can follow; a template repository that starts a new project with Tenet set up; standalone downloads from 0.1.x. Each is listed on the first screen of the GitHub page, verifiable (checksums, package provenance, `tenet doctor`), and needs no account; nothing is installed by piping a script into a shell | V-V3, V-B10 | 0.1.0; 0.1.x | — | proposed |
| R-021 | Existing repositories: `init` imports existing documents by reference, and an agent may draft the starter ladder from the README, docs, code and issues, marking what it inferred `reported` for the Owner to confirm by exception | V-V3 | 0.1.0 | — | proposed |
| R-022 | `init` and `adopt` are idempotent and repair only with `--repair` | V-B6 | 0.1.0 | — | proposed |
| R-023 | Every file written by `init`, `adopt` or `upgrade` is listed in the output and an `ops` packet | V-B3 | 0.1.0 | — | proposed |
| R-024 | Base footprint: `tenet.yaml`, `tenet.lock`, an `AGENTS.md` block, the CI workflow when chosen, and the host's skill files; the kit is loaded from the pinned package (`init --vendor` copies it for offline use); other integrations offered one by one | V-V3, V-P7 | 0.1.0 | — | proposed |
| R-025 | `tenet eject` removes what Tenet installed, keeping policy, records and user overlays; until then `init` lists every file it wrote so they can be deleted | V-V3 | M2 | — | proposed |
| R-026 | `tenet doctor` reports kit integrity, hand-edited generated files and the latest trust observation, offline | V-B6, V-B8 | 0.1.0 | — | proposed |
| R-027 | Behavior found at adoption is `reported`, never `built` | V-B7 | 0.1.0 | — | proposed |
| R-028 | Records from other tools enter as packets keeping a reference to their source | V-P4 | 0.1.x | — | proposed |
| R-050 | The lock records version and integrity; the kit is verified against it wherever it is loaded from; edits to a vendored kit fail `tenet check` | V-V3, V-B6 | 0.1.0 | enforced* | proposed |
| R-051 | `tenet upgrade` updates the lock to the installed version, regenerates the `AGENTS.md` block and skills, lists what changed for this project and runs `tenet check`; it never changes the level or starts a new rule beyond `observe` (0.1.0). From M4 it also stages migrations, swaps atomically and resumes or rolls back when interrupted | V-V3, V-B6 | 0.1.0; M4 | — | proposed |
| R-052 | Upgrades classify themselves from structured fields; below 1.0 every minor needs review | V-B6 | M4 | enforced* | proposed |
| R-053 | Overlays may only narrow | V-B2 | 0.1.0 | detected | proposed |
| R-054 | A scheduled CI job opens the upgrade pull request; `tenet check` reports a package version that differs from the lock (0.1.0) | V-V3 | 0.1.0; M4 | — | proposed |
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
| R-206 | **Agent card.** One definition format. Required: name, role, purpose, inputs (spec levels and sections), outputs (result schema). Optional: tools and side effects, `acts_as`, sponsor, stop rules, evaluation suite. Reviewers add criteria, independence, a finding schema and `abstain_when`. Bindings compile cards to host formats. A card is a subject; its qualification is a continuing claim on (definition, model, harness, toolset, task class), so changing any of them makes it stale; promotion and retirement are decisions | V-P2, V-P11, V-H4 | 0.1.0 (card); M5 (qualification) | detected | proposed |
| R-048 | The package exports an SDK with the CLI's functions, and a JSON file contract for writing evidence, results and decision requests that engines can use without the SDK | V-V4 | 0.1.0 | — | proposed |
| R-049 | A local MCP server (no network) exposes `context`, `check`, `status`, `next` and proposals; with skills it is the main way agents use Tenet | V-V4, V-B10 | 0.1.0 | — | proposed |
| R-060 | `tenet-conformance.yaml` declares version, classes, packs, mode and guarantee levels | V-V4 | M4 | — | proposed |
| R-061 | `tenet conform` runs the tests for each declared claim | V-V4 | M4 | — | proposed |
| R-062 | Implementations are tested on their outputs, not their source | V-P4 | M4 | — | proposed |
| R-063 | Fixtures cover positive, refusal, overlapping, concurrent, late-arriving and interrupted cases | V-H3 | 0.1.0; M4 | — | proposed |
| R-064 | An independent reader written from the kernel text alone reaches the same decisions | V-H3, V-V4 | 0.1.x | — | proposed |
| R-070 | `tenet agent qualify` scores an adapter-run suite deterministically | V-H4 | M5 | — | proposed |
| R-071 | `tenet agent promote` stages versions only when thresholds hold | V-H4 | M5 | — | proposed |
| R-081 | Every command runs on Windows, macOS and Linux with Node 22+; a CI action needs no local install, and standalone binaries ship from 0.1.x | V-V3 | 0.1.0; 0.1.x | — | proposed |
| R-082 | `board` and `check` within 3 s warm and 10 s cold for 500 packets, 10,000 event files and 5,000 commits | V-V2 | 0.1.0; M2 | — | proposed |
| R-083 | Every error leads with plain words (what happened, why the rule exists, the fix or `tenet fix`), then the file and rule ID | V-V1, V-B10 | 0.1.0 | — | proposed |
| R-084 | Every command supports `--json` with the same facts | V-V4 | 0.1.0 | — | proposed |
