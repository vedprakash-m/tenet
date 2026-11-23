# Tenet product requirements

> Level L1 · Version 0.6 · Status: **draft, awaiting the Owner's approval** · Serves [vision.md](../vision.md) · Normative standard: [kit/TENET.md](../../kit/TENET.md) · Budget: 12,000 tokens

## 1. Scope and positioning

**Tenet is the decision and evidence layer of a software factory**: a small, testable core that says what a change, a piece of evidence, a decision, an agent and a view of the floor are, what must hold between them and who may act next; packs that make it usable on day one; and the minimum deterministic tooling to adopt, enforce and stay current with it. Trackers, orchestrators, factory platforms, spec tools, coding hosts and dashboards keep doing their jobs; they write to and read from Tenet's records.

**The factory itself is part of the standard.** Tenet defines how a factory is *declared*: its workers, what starts their work, where they run and as whom, which models and harnesses they use, how they reach people, and how runs are scored and compared. Tenet validates, records and governs that definition; engines and platforms run it. Factory platforms such as Warp Factories, Factory.ai or a Symphony-style dispatcher conform by mapping their own definitions onto Tenet's, and gain enforced gates where theirs are advisory. The first mapping target is Warp Factories' `factory.yaml` (R-131).

| In scope | Out of scope |
|---|---|
| The core standard, its rule IDs and its versioning | A hosted service, dashboard, database or account system |
| Packs: lifecycles, reference agents, skills, loops, criteria, templates | Running models; Tenet's own tooling never calls one |
| A deterministic CLI and SDK | An orchestrator, dispatcher or issue tracker of its own |
| A factory definition: workers, triggers, environments, identities, routing, channels, scoring and comparison | Executing that definition: running agents, hosting runners, sending chat messages (engines and platforms do this) |
| A CI verifier that produces the evidence gates trust | A general library of stack-specific skills |
| Bindings to forges, hosts, engines and interfaces through open contracts | Products built on the standard (such as Tenet for Copilot) |
| A conformance kit, red-team cases and fixtures | Certifying third parties; paid support |

**Assumption stated honestly.** The core needs a content-addressed version history whose records can be signed; git is the reference binding. Records scale in three tiers (tech spec §1): event files in git; git with compaction and the evidence store; or an external append-only store under the same schemas and replay rules (M3–M4). The first forge binding is GitHub (DEC-19); others implement the same contract. Configuration has two planes: `tenet.yaml` governs (who decides, what is checked, what is protected, what counts as proof); the optional `factory.yaml` describes execution (workers, routing, environments, tools, identities, channels, triggers, scorers).

**Relationship to other repositories.** Tenet for Copilot (`tenet-copilot`) is an implementation that will declare conformance. govaut supplied the agent-governance patterns. Torus is the first subscribing project after this repository.

## 2. Users

| Persona | Needs | Primary deliverables |
|---|---|---|
| **Owner** (one person, or a team with named decision rights) | First verified change in an afternoon; decide only what needs them; trust what the floor says | `minimal` pack, CLI, CI verifier, board |
| **Operator** (runs the software) | Changes arrive with guardrails, a way back and an owner; incidents enter as changes | Standard pack (M2) |
| **Agent** (a model working in a host or engine) | An unambiguous assignment, the skills for its station, a way to propose results the tooling accepts or refuses | Agent definitions, skills, assignment and result contracts, SDK |
| **Implementer** (builds an engine binding, a dashboard or a product) | A small precise core, stable schemas, an event and read-model contract, conformance per claim | Core, schemas, adapter contracts, conformance kit |
| **Factory operator** (builds and tunes the factory) | Declare the factory once; see what each run did, as whom, where and at what cost; change workers, models or routing only when a comparison shows it is better | Factory definition, run records, scoring and comparison |
| **Steward** (maintains the standard) | Propose, test and release changes safely | This repository run under its own rules |

**First adopter.** A maintainer who already delegates real changes to coding agents, has CI, and regularly has to reconstruct whether an agent's "done" is true. CP-0016 tests this with a timed decision-reconstruction exercise.

## 3. Deliverables

| ID | Deliverable | Ships as | Release |
|---|---|---|---|
| D1 | **Core standard**: records, events, subjects, evidence, decisions and authority, lifecycle outcomes and gates, agent contracts, read model, guarantee levels, trust assumptions, conformance classes | `kit/TENET.md` Part I | Draft M0; 1.0 at M4 |
| D2 | **Kit**: schemas, defaults, templates, packs, reference agents, skills, loops, criteria | `kit/`, vendored into `.tenet/kit/`; checksummed archive | 0.1.0 (`minimal`); 0.2 (standard pack) |
| D3 | **CLI and SDK** `tenet` | One npm package | 0.1.0 onward |
| D4 | **CI verifier**: a no-secrets check job and an attest job that never runs the change | `tenet verify --run-checks` / `--attest`, plus a ready-made workflow | 0.1.0 |
| D5 | **Host bindings**: `agents-md` (0.1.0); Claude Code (0.1.x); others (M3) | `tenet build --target <id>` | 0.1.0, 0.1.x, M3 |
| D6 | **Engine adapters** behind an open adapter contract | `tenet build --target <id>`, `tenet run` | M3 |
| D7 | **Conformance kit**: red-team cases (0.1.0), reference cases, an independent reader (0.1.x), full kit (M4) | `tenet conform`, fixtures in the package | 0.1.0 onward |
| D8 | **Documentation**: quick start, adoption guide, reference | `docs/` | 0.1.0 onward |
| D9 | **Factory definition**: schema, validation, run-record fields, and published mappings from factory platforms | `kit/schemas/factory.json`, `docs/mappings/` | 0.1.x (schema, mapping); M2 (triggers, channels, scoring, comparison) |

## 4. Requirements

Status: `proposed`, `approved`, `built`, or `reported` (recorded at adoption; no evidence yet). **Guarantee** is the strongest level the requirement may claim in host-driven mode: `enforced`, `enforced*` (enforced only when the trust assumptions are observed to hold, §4.5 R-110), `detected`, `advisory`, or `—` for requirements that are not controls. Release `0.1.x` means a point release after 0.1.0.

### 4.1 Core standard

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-001 | A normative **core** (Part I) of at most 12,000 tokens, and non-normative reference packs and practices (Part II); only the core is required for conformance | V-P13, V-P8 | M0 | — | proposed |
| R-002 | Every core "must" rule carries a rule ID (`TN-<area>-<n>`): provisional from 0.1.0, stable from 1.0 | V-V4 | 0.1.0; M4 | — | proposed |
| R-003 | The standard names no tool, model or vendor as a requirement; bindings, examples and mappings are non-normative | V-P4, V-B1 | M0 | — | proposed |
| R-004 | Each release has a changelog of added, changed, deprecated and removed rules, and its migrations | V-V3, V-B6 | 0.1.0 | — | proposed |
| R-005 | A rule or field is deprecated for at least one minor version before removal | V-B6 | 0.1.0 | — | proposed |
| R-006 | Every core rule declares its guarantee level per execution mode and the trust assumptions it depends on; the board shows the level in effect for each change | V-P12, V-B8 | 0.1.0 | — | proposed |
| R-007 | The core defines conformance classes (producer, evaluator, executor, renderer, project); a claimed pack's gates become testable for that claim | V-V4 | 0.1.0 | — | proposed |
| R-008 | Every document type has a token budget and a rollover rule (archive, then compact or split); assignments carry sections, not whole files | V-P8, V-V2 | 0.1.0 (check); M2 (`compact`) | detected | proposed |
| R-009 | The core is checked against four reference cases: a library whose installs are unobservable, a release rolled back in one region, a migration with a point of no return, and an ML system whose data or configuration changed while code did not | V-V5, V-P13 | M0 | — | proposed |

### 4.2 Kit

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-010 | JSON Schemas with valid and invalid fixtures for what each release uses: profile, lock, packet, event (with typed data for every event type, including receipts of every kind — check, measurement, attestation, observation, review, proof, simulation, differential — reviews and decisions), board, pack, agent, loop, assignment, result, criteria (0.1.0); the rest as their features ship | V-V4, V-P2 | 0.1.0 onward | — | proposed |
| R-011 | A template for every document type the core and shipped packs define | V-V3 | 0.1.0 | — | proposed |
| R-012 | Reference agents for every role a shipped pack binds: builder and judge (0.1.0); shaper and verifier (0.1.x); the rest with the standard pack (M2). Each is `draft` until qualified | V-V1, V-P3 | 0.1.0; 0.1.x; M2 | — | proposed |
| R-013 | One judge protocol; criteria as structured data with a rendered view; critics differ by criteria and by the inputs and evidence they require | V-P3 | 0.1.0 | — | proposed |
| R-014 | A loop library in the engine-neutral format: `station` and `fix` (0.1.0); `triage`, `upgrade`, `qualify` later. Usable as is, tunable by narrowing, replaceable by loops that pass the same checks | V-P4 | 0.1.0 | — | proposed |
| R-015 | Any reviewer whose output can unblock a gate passes a 5-case **activation test** (seeded defect, valid alternative, omission, conflicting baseline, abstention) before activation; smoke suites for every reference agent at M3; qualification suites at M5 | V-P3, V-H4 | 0.1.0; M3; M5 | enforced | proposed |
| R-016 | **Lifecycle packs** are data: `minimal` (intake, define, build, verify, integrate, close; lanes quick and standard in 0.1.0, express in 0.1.x) is the default; `software-standard` (discover through operate, `spike`, `hotfix`, deep lane) at M2. Each pack declares **work types** (R-142) | V-P7, V-P8 | 0.1.0; M2 | — | proposed |
| R-017 | A **skills library** in the open agent-skills format: work a packet and review with findings (0.1.0); write a definition and stop and escalate (0.1.x). Project and third-party skills come through overlays, pinned by hash | V-P13, V-V1 | 0.1.0 | detected | proposed |
| R-018 | Agents change state only through commands that write events (for example `tenet task done`); no agent edits a state file | V-P10 | 0.1.0 | detected | proposed |

### 4.3 Install and adopt

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-020 | `tenet init` creates a project on the `minimal` pack and reports whether it is **ready for advisory work** or **ready for verified work**, naming anything missing | V-V3 | 0.1.0 | — | proposed |
| R-021 | `tenet adopt` adds the same files to an existing repository without modifying existing files outside generated blocks, writes a discovery packet for the project's own agent, and makes no semantic claims about existing behavior | V-V3, V-P7 | 0.1.x | — | proposed |
| R-022 | On an intact installation `init` and `adopt` change nothing and say so; on a partial or edited one they report the differences and change nothing without `--repair` | V-B6 | 0.1.0 | — | proposed |
| R-023 | Every file written by `init`, `adopt` or `upgrade` is listed in the output and in the resulting `ops` packet | V-B3 | 0.1.0 | — | proposed |
| R-024 | The base footprint is `tenet.yaml`, `tenet.lock`, an `AGENTS.md` block, `.tenet/` and the records folder; the CI workflow, hooks, update workflow and host files are optional integrations offered one by one | V-V3, V-P7 | 0.1.0 | — | proposed |
| R-025 | `tenet eject` previews and removes what the CLI installed or generated, keeping `tenet.yaml`, the records folder and user-authored overlays | V-V3 | M2 | — | proposed |
| R-026 | `tenet doctor` reports kit integrity, hand-edited generated files, lock-versus-tool mismatch and the latest observation of the trust assumptions, without network access | V-B6, V-B8 | 0.1.0 | — | proposed |
| R-027 | Existing behavior found at adoption is `reported`, never `built`; contradictions are proposed by the discovery agent and confirmed by a person | V-B7 | 0.1.x | — | proposed |
| R-028 | Records from other tools (tracker issues, spec-tool change folders, pull requests, dispatcher tasks) enter as packets that keep a reference to their source | V-P13 | 0.1.x | — | proposed |

### 4.4 Work, events, subjects and evidence

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-030 | Packets get a ULID identity and a 6-character display alias; `tenet check` refuses duplicate aliases at merge; every existing `CP-NNNN` stays valid | V-P5 | 0.1.0 | detected | proposed |
| R-031 | `tenet move` appends an event and refuses a move whose gate fails, naming each failing condition and the next command | V-P2, V-H1 | 0.1.0 | enforced* | proposed |
| R-032 | `tenet board` computes the floor from events on the main line, the packet lines matching the profile's patterns, and the evidence store, for a named as-of time; `board.json` records the content-addressed revisions it read, the pack's phases and typed next actions; `now.md` renders it; generated views are never committed | V-V2 | 0.1.0 | — | proposed |
| R-033 | `tenet check` runs structure, traceability, anti-drift, event, alias and budget checks and exits non-zero on any error | V-P2, V-M2 | 0.1.0 | detected | proposed |
| R-034 | Receipts come only from checks pinned in the target's profile. Each names its **subject**, its **kind** (check, measurement, attestation, observation, review, proof, simulation, differential), the **dimension** it assesses (correctness, compatibility, performance, security, architecture, health, accessibility) and the **method** used (R-174), and lists the test cases expected, executed and passed. Each acceptance item declares a claim class, method and pass rule and maps to case IDs; its gate needs those cases executed and passing. Each method has a completion rule (expected cases discovered, analyzed scope reported, obligations discharged); a test suite that found none of its expected cases is inconclusive. Freshness is computed | V-P2, V-M2 | 0.1.0 | enforced* | proposed |
| R-035 | `tenet close` computes the endpoint (`checked`, `integrated`, `implemented-unverified`, `cancelled`, `superseded`), writes a ledger entry, and promotes the packet's preservation items and invariants into built requirements with their proving cases (R-170); release endpoints come with the standard pack | V-P2, V-M2, V-P17 | 0.1.0; M2 | enforced* | proposed |
| R-036 | When a stop threshold is met (sessions, repeated failure, spent versus appetite, or a per-packet cost or token limit), the refused move also records a stop event; `tenet escalate` writes the escalation | V-P6 | 0.1.0; 0.1.x (`escalate`) | detected; enforced by engines at M3 | proposed |
| R-037 | Claims are advisory in a working copy and exclusive only where an engine or shared store provides an atomic update; the strength is shown | V-P5, V-P12 | 0.1.0; M3 | advisory | proposed |
| R-038 | Hooks catch violations early; CI reruns the same checks | V-P2 | 0.1.0 | detected | proposed |
| R-039 | **Events are the source of truth**: one immutable file each, carrying `prev` (the previous event of its packet the writer saw). CI replays each changed packet and marks every state change justified, pending evidence or unjustified. Incompatible concurrent state changes put the packet into `conflict` until a decision resolves it | V-P2, V-P10 | 0.1.0 | enforced* | proposed |
| R-090 | Decisions and reviews name the subject they cover; an approval goes stale when its subject changes, as receipts do | V-P2 | 0.1.0 | enforced* | proposed |
| R-091 | `packet.yaml` holds only identity fields (alias, ULID, title, type, created); lane, risk, priority and appetite change through events | V-P10 | 0.1.0 | — | proposed |
| R-092 | The **express** lane is requested by an agent or person and granted only by the evaluator within limits (size, denied paths, per-area daily count); it ends at `checked` on a branch and `integrated` after merge; it is reported separately in flow metrics | V-P8, V-P2 | 0.1.x | enforced* | proposed |

### 4.5 Authority, evidence and security

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-100 | **Two-job verifier.** A check job runs the pinned checks with no secrets and no write access, computes the subject before and after each check (a check that changes tracked files is inconclusive), passes only on exit code 0 with a valid report, and writes its bundle outside the working tree; an attest job, which never runs the change's code, verifies the bundle against the subject, checks the protected-file diff, replays events and writes evidence to the evidence store | V-P2, V-B7 | 0.1.0 | enforced* | proposed |
| R-101 | **Decisions carry proof.** A table of decision kind against acceptable proof sets what each decision needs. Strengths: `person-present` (a signature from a security key requiring touch or PIN), `forge-verified` (an approving review or command on the pull request from a listed owner's forge account, with two-factor authentication enforced, checked by the attest job), `key` (an ordinary signature) and `channel` (chat; advisory). Default: `forge-verified` for most decisions, `person-present` for `change-policy`, `widen-permission` and `amend-vision`. Every answer binds request, subject, choice, actor and policy version; signatures survive squash, rebase and shallow clones | V-B2, V-P12 | 0.1.0 | enforced at the strength the table requires | proposed |
| R-102 | Human gates are durable decision requests: subject, question, options with stop first, recommendation, who may decide, deadline, default stop. An option that changes scope cannot approve the current subject: it returns the packet to Define or carries the replacement definition's digest | V-V1 | 0.1.0 | enforced | proposed |
| R-103 | Builders may not change the **protected set**: check definitions, CI and hook configuration, test, coverage, compiler and linter configuration, build scripts, pinned tests, the proving cases of built requirements, health indicators, theorem statements and axiom allowlists, lock, profile, factory definition, and named keys inside files (for example `package.json#/scripts`). A change to it needs a signed `change-policy` decision. Lockfile and dependency changes are flagged in the attest summary | V-B2, V-P17 | 0.1.0 | enforced* | proposed |
| R-104 | `holdout.mode` is `external` (outside the build repository, referenced by ID and hash) or `in-repo` (always advisory) | V-P11, V-P12 | 0.1.0 (declared); M2 (external) | advisory; enforced* if external | proposed |
| R-105 | A run that has both untrusted input and sensitive data gets no network and may change only its local worktree; runs declare these properties and the evaluator refuses an assignment that combines all three | V-P11, V-B5 | 0.1.0 | advisory (declared); as the host enforces | proposed |
| R-106 | A **red-team suite** runs in CI: forged receipt; receipt for another subject; policy edited on the branch; protected file edited; code under test writing fake reports or reading credentials; impersonated or replayed decision; agent-answered gate; hand-written move; conflicting moves on two branches; squash merge preserving signatures; holdout read; prompt-injected issue. Each case states the expected result and the level at which it holds | V-M2, V-H1 | 0.1.0 | — | proposed |
| R-107 | Run records keep summaries, hashes and costs (with source), not transcripts, unless the profile opts in; secrets are never written | V-B5 | 0.1.0 | detected | proposed |
| R-108 | The profile may name several decision-makers with roles, keys and a decision-rights table; delegation with an expiry is a signed decision | V-V1 | 0.1.0 (table); 0.1.x (delegation) | enforced | proposed |
| R-109 | **Rules come from the target, judged at decision time.** The verifier reads the profile, lock, checks, protected set, owners, keys and Tenet version from the target line, never from the change. Every gate evaluation records the policy revision, evidence-store revision and trust observation it used; replay uses that snapshot, and "reevaluate now" is a separate view | V-P10 | 0.1.0 | enforced* | proposed |
| R-110 | The attest job observes and records the trust assumptions (verifier runs from a protected source; evidence store writable only by it; branch protection requires it); `enforced*` becomes `enforced` only while a fresh observation says they hold | V-P12, V-B8 | 0.1.0 | — | proposed |

### 4.6 Agents and execution

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-040 | `tenet agent check` validates definitions, skills, roster bindings and generated files; a definition that widens what it extends fails | V-B2 | 0.1.0 | detected | proposed |
| R-041 | Engine adapters implement an open contract identified by adapter ID: compile, start, status, cancel, prepare and clean up workspaces, stream usage, suspend and resume on decisions, and select next work | V-P4, V-P13 | M3 | — | proposed |
| R-042 | `--target agents-md` writes the `AGENTS.md` block and skills every host reads (0.1.0); host targets add agent files and permission settings and declare, per capability, whether the host enforces it | V-P4, V-P12 | 0.1.0; 0.1.x; M3 | as declared | proposed |
| R-043 | `tenet run` writes the assignment, invokes the adapter and records the run | V-H2 | M3 | — | proposed |
| R-044 | Loops are checked statically: rounds only increase within a total cap; creator steps are followed by inspection; protected changes, missing evidence and required human judgment take precedence over convergence; a refusal can also record a stop; every human gate lists stop first | V-P3, V-P6 | 0.1.0 | enforced | proposed |
| R-045 | `tenet freeze` and `thaw` stop and resume new runs; revocation of in-flight authority is separate and recorded | V-B2 | M3 | — | proposed |
| R-046 | Critics run after deterministic checks and only where the lane calls for them. A finding is `introduced`, `exposed` (the change makes a latent defect reachable or worse), `inherited` (unaffected; tracked as debt) or `uncertain` (goes to a human gate); `exposed` blocks like `introduced`. A finding is `located` when its quote is found and `substantiated` when the evidence its class requires holds (a quote plus the rule it breaks for structural findings; a reproduction or measurement for behavioral ones); only substantiated findings count toward convergence. An invalid finding is kept and marks the review `incomplete`; results may be `inconclusive` or `insufficient-evidence`; the model family reported by the host is recorded | V-P3 | 0.1.0 | enforced (incomplete reviews never converge); advisory (family) | proposed |
| R-047 | Every run records its independence facts (definition, model family, run, whether a person took part), and every packet records who wrote its tests | V-P3 | 0.1.0 | detected | proposed |
| R-048 | The package exports an SDK with the same functions as the CLI | V-V4 | 0.1.0 | — | proposed |
| R-049 | A local MCP server exposes the SDK as typed tools, with no network access | V-V4 | M3 | — | proposed |
| R-111 | In the standard lane, acceptance tests are written by a run other than the builder's before Build and pinned by hash in the approved definition; in the quick lane the builder may write them and the board says so | V-P3 | 0.1.0 | enforced* | proposed |

### 4.7 Subscription and upgrade

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-050 | `tenet.lock` records the exact version, package integrity and a hash per vendored file; `tenet check` fails on any local edit under `.tenet/kit/` | V-V3, V-B6 | 0.1.0 | enforced* | proposed |
| R-051 | `tenet upgrade` stages the new kit, runs migrations, regenerates, validates overlays and opens an `ops` packet; an interrupted upgrade resumes or rolls back without touching user-owned content | V-V3 | M4 | — | proposed |
| R-052 | Upgrades classify themselves from structured fields; auto-merge only for patch or minor with no widened permission, changed gate, changed severity rule or changed evidence requirement; below 1.0 every minor needs review | V-B6 | M4 | enforced* | proposed |
| R-053 | Overlays may only narrow | V-B2 | 0.1.0 | detected | proposed |
| R-054 | A scheduled CI job checks for a new version and opens the upgrade pull request; bot configurations are optional | V-V3 | M4 | — | proposed |
| R-055 | A changed reference agent is installed but inactive until it requalifies on the project's model and host | V-H4 | M5 | enforced | proposed |

### 4.8 Conformance

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-060 | `tenet-conformance.yaml` declares version, classes, packs, execution mode and guarantee levels | V-V4 | M4 | — | proposed |
| R-061 | `tenet conform` runs the tests for each declared claim and reports per rule ID | V-V4 | M4 | — | proposed |
| R-062 | Implementations are tested on their outputs (records, events, decisions), not on source or wording | V-P4 | M4 | — | proposed |
| R-063 | Core fixtures include positive, refusal, overlapping, concurrent, late-arriving and interrupted cases | V-H3 | 0.1.0 (red-team set); M4 | — | proposed |
| R-064 | An independent read-only evaluator, written from the core text alone without the Tenet SDK, reaches the same decisions on the published fixtures; disagreements become spec packets | V-H3, V-V4 | 0.1.x | — | proposed |

### 4.9 Measurement and workforce

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-070 | `tenet agent qualify` asks the adapter to run a suite and scores results deterministically | V-H4 | M5 | — | proposed |
| R-071 | `tenet agent promote` moves a version through shadow, canary and full only when thresholds hold | V-H4 | M5 | — | proposed |
| R-072 | `tenet metrics` computes vision and diagnostic metrics with units, sample sizes and bounds, and marks the rest "not measured" | V-M3, V-M4 | M2 | — | proposed |
| R-073 | The board shows flow from 0.1.0: verified changes per week by lane, lead time (median and 85th percentile, hours), work in progress, decision wait, cost per verified change with its source, and autonomy share beside escapes; express reported separately | V-V2, V-M3, V-M4, V-M7, V-M9 | 0.1.0 | — | proposed |
| R-074 | `tenet audit sample` draws a random sample of verified changes for independent rerun or review and reports the rate with its bound | V-M2 | M2 | — | proposed |
| R-075 | The decision-reconstruction exercise (four questions about real changes, timed and independently scored) is published as a procedure and run in every pilot | V-M1 | M0 (CP-0016); 0.1.x | — | proposed |

### 4.10 Quality attributes

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-080 | Tenet's tooling never calls a model; its only network use is fetching a package (`upgrade`, the update check), reading a configured issue source (`adopt`), and, in CI only, the attest job reading the forge's protection settings and reviews, posting decision requests on the pull request, and writing the evidence store; `--offline` disables the first two | V-B4, V-B5 | 0.1.0 | enforced | proposed |
| R-081 | Every command runs on Windows, macOS and Linux with Node 22 LTS or later | V-V3 | 0.1.0 | — | proposed |
| R-082 | `tenet board` and `tenet check` finish within 3 seconds warm and 10 seconds cold for 500 packets, 10,000 event files and 5,000 commits on the CI runners of all three platforms; a git-ignored cache may speed reads but never change a result | V-V2 | 0.1.0 (measured); M2 (target) | — | proposed |
| R-083 | Every error names the file, the rule ID and the fix | V-V1 | 0.1.0 | — | proposed |
| R-084 | Every command supports `--json`, carrying the same facts as human output | V-V4 | 0.1.0 | — | proposed |

### 4.11–4.13 Factory definition, fleet, operations, assurance and health

Moved to [prd/factory-and-fleet.md](prd/factory-and-fleet.md) at version 0.5 because this document neared its budget.

| Moved | Now at |
|---|---|
| §4.11 Factory definition and operation (R-120–R-131) | [prd/factory-and-fleet.md §4.11](prd/factory-and-fleet.md#411-factory-definition-and-operation) |
| §4.12 Fleet, capacity and operations (R-140–R-167) | [prd/factory-and-fleet.md §4.12](prd/factory-and-fleet.md#412-fleet-capacity-and-operations) |
| §4.13 Assurance and health (R-170–R-185) | [prd/factory-and-fleet.md §4.13](prd/factory-and-fleet.md#413-assurance-and-health) |

**Retired IDs** (not reused): none.

## 5. Versioning and release policy

| Change | Version | Subscriber effect |
|---|---|---|
| Wording, clarification, bug fix | Patch | Auto-merge after the conformance check |
| New optional capability; a stricter check conforming projects already pass | Minor | Auto-merge from 1.0; review below 1.0 |
| Changed schema, removed rule, new required gate, any change to authority, permissions, severity or evidence requirements | Major | Waits for a decision-maker |

A release is cut from an `ops` release packet in the standard lane, needs a `release` decision, and closes once publication is evidenced. **A release gate proves the software works; a horizon proves its value.** They are never the same gate.

## 6. Milestones and releases

| ID | Release | Name | Delivers | Release gate | Horizon measured |
|---|---|---|---|---|---|
| M0 | — | Foundation | Revised documents; core carved out; feasibility spike; problem validation started | The Owner signs the vision and approves the specs and core | — |
| M1 | **0.1.0** | Trust spine | Slice schemas; CLI and SDK; events with replay and conflicts; `new`, `move`, `task`, `close`; two-job verifier and evidence store; decisions with the proof table (forge-verified by default); decision-time snapshots; acceptance items with class, method and pass rule; executed-case manifests; continuing obligations; finding classes; baseline-relative measurements; change-size limits; cross-branch board; `check`, `doctor`, `init`; `agents-md`; builder and judge; `station` and `fix`; red-team suite; quick start | Red-team cases pass at their declared levels; quick start passes on three platforms; a real GitHub run of the two-job workflow; this repository and Torus each close ≥5 verified changes on a pre-release | — |
| M1 | 0.1.x | Verified slice | `adopt` and imports; express; Claude Code binding; shaper and verifier; delegation and escalation; `now.html`; SARIF reports; independent reader; factory-definition schema and the Warp mapping; visual evidence; campaigns and work types; areas, readiness and approvals by risk; merge queue and flaky-test quarantine; check categories and mutation evidence; attribution definitions; scoped rules, session links and steering; health indicators and ratchet; architecture rules; check owners; durability; external pilot | Each point release: its packets' checks and the red-team suite | V-H1 |
| M2 | 0.2.0 | Full lifecycle | `software-standard` pack (discover, operate, release, observe, hotfix, spike, deep); external holdout; metrics; audit; `compact`; `eject`; triggers; chat and tracker channels; sampled scoring; configuration comparison; governed knowledge; campaign waves; reviewer metrics; circuit breakers; hotfix and heal; cleanup sweeps; tool registry; environment services and twins; platform-object subjects; method minimums per claim class; proof audits; check lifecycle; cleanup guardrails; selective-execution disclosure; maintainability audits; cost of the next change; model checking of the evaluator | 30 days in 3 projects on the standard pack | V-H2 (part) |
| M3 | 0.3.0 | Any engine | Adapter contract and reference adapters; `run`, `freeze`; MCP server; more hosts; exclusive claims; routing applied by adapters; local-agent hand-off; context providers; tier-3 store binding | Same packets on 2 engines or hosts with the same decisions | V-H2 |
| M4 | 1.0.0 | Subscribed and interoperable | Upgrade and migrations; stable rule IDs; conformance kit; open proposal process | 3 releases reach 3 projects; 2 implementations agree on every core fixture | V-H3 |
| M5 | 1.x | Managed workforce | Qualification, staged agent release, scorecards | V-H4 criteria | V-H4 |

## 7. Decisions

| ID | Decision | Why |
|---|---|---|
| DEC-01 | Tenet is the standard; the VS Code implementation is Tenet for Copilot | The standard outlives any one host |
| DEC-02 | One npm package holds kit, CLI and SDK; the kit is also an archive | One version to pin; implementations without Node still get the kit |
| DEC-03 | The kit is vendored read-only with hashes in a lock | Agents read local files; upgrades are reviewable |
| DEC-04 | Overlays may only narrow | No upgrade conflicts; no permission drift |
| DEC-05 | Loops use a small engine-neutral format; engine adapters chosen at M3 | Neutral without inventing a workflow language |
| DEC-06 | Tenet's tooling never calls a model | Enforcement a model can talk past is not enforcement |
| DEC-07 | TypeScript on Node 22 | Same runtime as the hosts |
| DEC-08 | This repository dogfoods the standard | Its first critic is its own steward |
| DEC-09 | A small normative core plus packs and bindings | Ceremony optional; core testable |
| DEC-10 | Events, one file each, chained by `prev`, replayed by CI | No merge conflicts; hand-written or concurrent state changes are caught |
| DEC-11 | Evidence comes from a two-job verifier and lives in a store only it writes, never on branches | Agents cannot write or steal it; no CI loops, races or fork failures |
| DEC-12 | Decisions are signed in their content, with `person-present` and `key` strengths | Survives squash and rebase; an agent holding the Owner's ordinary key cannot pass as the Owner |
| DEC-13 | ULID identity plus a 6-character alias; legacy IDs kept | No allocation, no renumbering, collisions caught |
| DEC-14 | Every guarantee declares its strength and assumptions | Honest without building every control first |
| DEC-15 | `minimal` is the default pack | First value in an afternoon |
| DEC-16 | Reuse open formats where they fit: `AGENTS.md`, agent skills, JUnit and CTRF (SARIF in 0.1.x), OpenTelemetry fields, SSH signatures; CloudEvents on export | Hosts already read them |
| DEC-17 | Rules come from the target branch | A change cannot rewrite its own judge |
| DEC-18 | Tenet is the decision and evidence layer beside trackers, orchestrators and spec tools | Smaller to build; useful alongside what teams already run |
| DEC-19 | GitHub is the first forge binding | Most likely first adopters; other forges implement the same contract |
| DEC-20 | Release gates and horizons are separate | Shipping never waits on someone else's calendar |
| DEC-21 | The factory definition is part of the standard; Tenet declares, validates, records and governs it, and never executes it | Platforms can conform without Tenet becoming one |
| DEC-22 | Changes to the factory are `factory` packets with a stated purpose; improvements are adopted on comparison evidence | The factory improves under the same rules as the software, and emergencies still have a path |
| DEC-23 | `forge-verified` is the default decision strength; `person-present` is required for policy, permission and vision changes | Adoptable without hardware; strongest proof where it matters |
| DEC-24 | Two configuration planes: `tenet.yaml` governs, optional `factory.yaml` describes execution | No overlap; simple projects need only one file |
| DEC-25 | One campaign decision covers its in-scope children | Fleet-wide change without hundreds of approvals, each child still verified |
| DEC-26 | Default approvals by risk: 0, 0, 1, 2 human decisions for express, quick, standard, deep; protected changes always `person-present` | Matches leading practice; projects may only tighten |
| DEC-28 | Continuing obligations live in the requirement registry: closing a packet promotes its preservation items, and proving cases of built requirements are protected | Yesterday's promises keep their protection without a new store |
| DEC-29 | Health ratchets on the touched scope against the target's baseline, with a forge-verified exception | Brownfield projects adopt it without being certified healthy; new decay is blocked |
| DEC-30 | One list of verification methods and claim classes; packs set method minimums per class and lane | Matches evidence strength to claims without a separate ladder |
| DEC-31 | Tenet verifies its own evaluator in stages: property tests (0.1.0), model checking (M2), proofs optional later | The decision kernel is the highest-consequence code Tenet ships |
| DEC-27 | Judging whether an action fits its intent, predicting risk with a model, and building context graphs, tool gateways or sandboxes stay outside Tenet | They need a model or a platform; Tenet records their results as evidence |

## 8. Risks

| ID | Risk | Mitigation |
|---|---|---|
| RK-01 | The standard grows too large | Core token budget; `minimal` default; rules removed when cost exceeds benefit |
| RK-02 | Hosts and forges change faster than bindings | Bindings versioned apart; a stale binding is marked unsupported |
| RK-03 | Auto-merged updates break a project | Structured classification; review below 1.0 |
| RK-04 | The name is taken | CP-0002 |
| RK-05 | People assume stronger guarantees than they have | Guarantee levels, observed trust assumptions, `doctor` |
| RK-06 | One steward | Ledger; open proposal process before 1.0 |
| RK-07 | Security-key setup puts people off | `key` strength works and is labelled; `init` creates a security key in one step |
| RK-08 | LLM critics are biased and inconsistent | Checks first; activation test; incomplete reviews never converge |
| RK-09 | The problem is not the one adopters feel | Reconstruction exercise in CP-0016; external pilot before V-H1 |
| RK-10 | The trust model depends on forge features | Observed and shown (R-110); one forge first; same contract for others |
| RK-11 | Presence may not be provable from signatures | CP-0017 tests it; if not, strength is based on key type and labelled so |
| RK-12 | Declaring the whole factory pulls Tenet toward building a platform | DEC-21: Tenet only validates, records, compares and governs; execution stays with engines and platforms |
| RK-13 | Factory platforms see no reason to conform | The Warp mapping (R-131) shows exactly which advisory gates become enforced and what they gain |

## 9. Open questions

| ID | Question | Needed by |
|---|---|---|
| OQ-01 | Package name: unscoped or scoped | 0.1.0 |
| OQ-02 | Which issue sources `adopt` reads first | 0.1.x |
| OQ-03 | Whether the conformance kit is also a separate package | M4 |
| OQ-04 | Licence for the standard text versus the code | 0.1.0 |
| OQ-05 | Which external project pilots 0.1.x | 0.1.x |
| OQ-06 | Closed (L-0010): forge approvals by a listed owner with two-factor authentication count as `forge-verified` | — |
| OQ-07 | Which engines get the first adapters | M3 |
| OQ-08 | Closed (L-0010): `factory.yaml` is a separate, optional file at the repository root | — |
