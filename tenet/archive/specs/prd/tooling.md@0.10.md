# Tenet requirements: work, views, kit, agents and conformance

> Level L1 · Version 0.10 · Part of [prd.md](../prd.md) · Status: **draft, awaiting the Owner's approval** · Budget: 7,000 tokens · Split from `prd.md` §4.3–§4.4 under the rollover rule (L-0014, L-0016) · Previous version: `archive/specs/prd/tooling.md@0.9.md`

**Context card.** Requirements for work items and views, how the standard is written and versioned, how the kit is installed and kept current, how agents and engines bind to it, and how conformance is tested. Columns and guarantee levels follow [prd.md §4](../prd.md#4-requirements). The spec process (§4.0), the kernel (§4.1) and trust (§4.2) stay in `prd.md`; adoption and friction are §3 here.

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
| R-012 | Reference agent cards: **drafter** (read-only; drafts specifications from the inventory; never blesses) and **spec reviewer** (checks drafts for invented or uncited statements) in 0.1.0-alpha.0; builder and judge in 0.1.0; shaper and verifier in 0.1.x; planner with the standard pack; Part II gives examples of a spec gardener and specialist critics (security, architecture, test oracle) | V-V1, V-P2 | 0.1.0; 0.1.x; M2 | — | proposed |
| R-013 | One judge protocol; criteria as structured data; critics differ by criteria and required inputs | V-P2 | 0.1.0 | — | proposed |
| R-014 | Loops `station` and `fix` (0.1.0); `triage`, `upgrade`, `qualify` later; tunable by narrowing | V-P4 | 0.1.0 | — | proposed |
| R-015 | A reviewer that passes the 5-case activation test is **advisory**; satisfying an enforced gate needs the larger risk-tiered suite (M2); smoke suites at M3; qualification at M5 | V-P2, V-H4 | 0.1.0; M2; M5 | enforced | proposed |
| R-016 | Packs are data: `minimal` (intake, define, build, verify, integrate, close; quick and careful lanes, express in 0.1.x) by default, **pull-request native** (catalog R-186); `software-standard` at M2. Each pack lists its standard claims, selectors, work types and methods, and maps its stations onto a shared phase vocabulary (discover, define, build, verify, release, operate, learn) that every board and UI uses; a short pack-authoring contract says how | V-P7 | 0.1.0; M2 | — | proposed |
| R-017 | A skills library in the open agent-skills format; project skills pinned by hash | V-P4, V-V1 | 0.1.0 | detected | proposed |
| R-018 | Agents change state only through commands that write events | V-P10 | 0.1.0 | detected | proposed |
| R-020 | `tenet init` starts a project at the `observe` level. First a **preflight**: what it found (forge, CI, test commands and their report format, owners, docs, agent hosts and their capability level), what it will write (every repository and host file, and edits to existing files as marked blocks) and what it will never read. In an existing repository it reuses the test reports existing CI produces, or proposes the reporter setting the detected runner needs; in a new project it asks what is being built and its kind. It records an install manifest, says what to do next, and never reports a missing trust assumption as a failure | V-V3, V-P7, V-B10 | 0.1.0 | — | proposed |
| R-221 | **Getting Tenet takes one step.** The npm package `@vedprakash-m/tenet` (command `tenet`) from 0.1.0-alpha.0, with provenance; each GitHub release also carries a prebuilt package and checksums. Documented commands always pin a release (`npx -y @vedprakash-m/tenet@<version>`), never a branch. Node projects add it as a dev dependency and others install it globally, so `tenet` stays available; MCP entries run the pinned package, so they work without it on the path. A template repository starts new projects; standalone downloads arrive in 0.1.x. No account, and nothing is installed by piping a script into a shell | V-V3, V-B10 | 0.1.0; 0.1.x | — | proposed |
| R-021 | Existing repositories are onboarded through R-223: existing documents become `draft` sources, never truth until blessed; an agent drafts the five views from them and from the code | V-V3 | 0.1.0 | — | proposed |
| R-022 | `init` and `adopt` are idempotent and repair only with `--repair` | V-B6 | 0.1.0 | — | proposed |
| R-023 | Every file written by `init`, `adopt` or `upgrade` is listed in the output and an `ops` packet | V-B3 | 0.1.0 | — | proposed |
| R-024 | Base footprint: `tenet.yaml`, `tenet.lock`, an `AGENTS.md` block, the CI workflow when chosen, and the host's skill files; the kit is loaded from the pinned package (`init --vendor` copies it for offline use); other integrations offered one by one | V-V3, V-P7 | 0.1.0 | — | proposed |
| R-025 | `tenet remove` (0.1.0) uses the install manifest to delete only what Tenet created and the blocks it added, keeps specifications and records, and names any branch rule an administrator must remove; `tenet eject` (M2) also handles packets and history | V-V3, V-B6 | 0.1.0; M2 | — | proposed |
| R-026 | `tenet doctor` reports kit integrity, hand-edited generated files and the latest trust observation, offline | V-B6, V-B8 | 0.1.0 | — | proposed |
| R-027 | Behavior found at adoption has origin `observed` and stays `draft` until a person blesses its section | V-B7 | 0.1.0 | — | proposed |
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

## 3. Adoption and friction

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-214 | **One adoption setting.** `level` is `observe` (default: nothing blocks, self-acceptance allowed and labelled, no keys, bots or CI setup beyond one workflow), `protect` (rules the Owner turned on block; native reviews), `verify` (signed evidence, merging requires its status, forge decisions count) or `assure` (person-present decisions, external holdout, strict separation of duties, vision ratified twice). Features such as campaigns or a factory definition are turned on separately | V-P7, V-V3, V-B10 | 0.1.0 (observe, protect); alpha.2 (verify); 0.1.x (assure) | — | proposed |
| R-215 | **Rule modes.** Every rule runs in `observe`, `advise` or `enforce`; the level sets defaults and `tenet.yaml` may override one rule; the board and proof card show what would have been blocked; promoting a rule is a decision | V-P7, V-P12 | 0.1.0 | — | proposed |
| R-216 | **Friction budget.** Tenet records refusals, overrides, waivers and "not useful" marks per rule and the human minutes Tenet takes (V-M11); a rule above its budget (default: over 10% not useful, or over 2 false blocks per 100 changes) is flagged for demotion at the release retrospective | V-B10, V-P7 | 0.1.0 | — | proposed |
| R-217 | **Safe failure.** When a control cannot run (CI unavailable, keys missing, review unobservable, check timed out), the result says so: advisory at `observe` and `protect`; at `verify` and `assure` careful and deep work holds; nothing silently passes | V-B8, V-P12 | 0.1.0 | detected | proposed |
| R-218 | **Proof card.** Every pull request gets one summary: acceptance items proven, unproven or skipped on this commit; tests deleted, skipped or weakened; protected files touched; spec sections affected; what would have been blocked. Each line states its method ("test passed on this commit", "failed as expected on the base", "no weakening detected by these checks"); the acceptance text's digest is bound to the evidence, so editing it re-evaluates. In 0.1.0-alpha.0 it evaluates three built-in rules (acceptance proven, tests not weakened, protected files) for "would have blocked"; weakened tests are found from the diff (deleted test blocks, added skips) with no base run. It is published as a check-run summary, with a comment optional; fork pull requests get a labelled status. Before a baseline is blessed it reads "advisory · intent not yet blessed". Advisory from a plain CI job; signed from `verify` | V-V1, V-P2, V-M1 | 0.1.0 | advisory; enforced* at verify | proposed |
| R-219 | **Tenet does the bookkeeping.** IDs, links, status and events are generated; people never type an ID or digest; `tenet fix` repairs mechanical problems; hooks warn and CI enforces; every refusal leads with plain words and one sentence on why the rule exists | V-B10, V-V1 | 0.1.0 | — | proposed |
| R-222 | **Host capability levels.** Each agent host is described by what it can do with Tenet: passive (its pull requests get proof cards), instructions (`AGENTS.md`), skills, MCP, or enforced (a host binding restricts protected writes); `init` shows the level it detected and lists every host file it writes | V-P12, V-B8 | 0.1.0 | — | proposed |
