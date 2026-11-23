# Tenet product requirements

> Level L1 · Version 0.7 · Status: **draft, awaiting the Owner's approval** · Serves [vision.md](../vision.md) · Normative standard: [kit/TENET.md](../../kit/TENET.md) · Catalog: [prd/catalog.md](prd/catalog.md) · Budget: 9,000 tokens · Previous version: `archive/specs/prd.md@0.6.md`

## 1. Scope and positioning

**Tenet is the decision and evidence layer of a software factory.** It is a small kernel of seven primitives and one gate rule (§4.1), packs that make it usable on day one, and the minimum deterministic tooling to adopt, enforce and stay current with it. Everything else (acceptance items, earlier promises, health indicators, quarantines, campaigns, approvals by risk) is a **standard claim, evidence kind or decision** built on the kernel and listed in the [catalog](prd/catalog.md). Trackers, orchestrators, factory platforms, spec tools, coding hosts and dashboards keep doing their jobs and read from and write to Tenet's records.

| In scope | Out of scope |
|---|---|
| The kernel, its rule IDs and its versioning | A hosted service, dashboard, database or account system |
| Packs: lifecycles, standard claims, reference agents, skills, loops, criteria, templates | Running models; Tenet's own tooling never calls one |
| A deterministic CLI and SDK; a CI verifier | An orchestrator, dispatcher, issue tracker, analyzer, prover, sandbox or context graph of its own |
| A factory definition Tenet validates, records and governs | Executing it (engines and platforms do this) |
| Bindings to forges, hosts and engines through open contracts; a conformance kit | Certifying third parties; paid support |

**Assumptions stated honestly.** The kernel needs a content-addressed history whose records can be signed; git is the reference binding, and records scale in three tiers up to an external append-only store (catalog R-167). The first forge binding is GitHub. Configuration has two planes: `tenet.yaml` (policy) and the optional `factory.yaml` (execution).

**Relationship to other repositories.** Tenet for Copilot (`tenet-copilot`) is an implementation that will declare conformance. govaut supplied the agent-governance patterns. Torus is the first subscribing project after this repository.

## 2. Users

| Persona | Needs | Primary deliverables |
|---|---|---|
| **Owner** (one person or a team with named decision rights) | First verified change in an afternoon; decide only what needs them; trust what the floor says | `minimal` pack, CLI, CI verifier, board |
| **Maintainer** | Know which earlier promises still hold and that the next change stays affordable | Continuing claims, health ratchet, board |
| **Factory operator** | Declare the factory, see readiness and cost per outcome, change it on evidence | Factory definition, campaigns, metrics |
| **Agent** | An unambiguous assignment, the skills for its station, a way to propose results that the tooling accepts or refuses | Agent definitions, skills, assignment and result contracts, SDK |
| **Implementer** | Seven primitives, one gate rule, stable schemas, conformance per claim | Kernel, schemas, conformance kit, catalog |
| **Steward** | Propose, test and release changes safely | This repository run under its own rules |

**First adopter.** A maintainer who already delegates real changes to coding agents, has CI, and regularly has to reconstruct whether an agent's "done" is true (tested in CP-0016).

## 3. Deliverables

| ID | Deliverable | Ships as | Release |
|---|---|---|---|
| D1 | **Kernel standard**: seven primitives, the gate rule, guarantee levels, trust assumptions, conformance classes | `kit/TENET.md` Part I | Draft M0; 1.0 at M4 |
| D2 | **Kit**: schemas, defaults, templates, packs (with their standard claims), reference agents, skills, loops, criteria | `kit/`, vendored into `.tenet/kit/`; checksummed archive | 0.1.0 (`minimal`); 0.2 (standard pack) |
| D3 | **CLI and SDK** `tenet` | One npm package | 0.1.0 onward |
| D4 | **CI verifier**: a no-secrets check job and an attest job that never runs the change | `tenet verify --run-checks` / `--attest`, plus a workflow template | 0.1.0 |
| D5 | **Host and engine bindings** behind open contracts | `tenet build --target <id>`, `tenet run` | 0.1.0 (`agents-md`); 0.1.x; M3 |
| D6 | **Factory definition** schema and platform mappings | `kit/schemas/factory.json`, `docs/mappings/` | 0.1.x |
| D7 | **Conformance kit**: red-team cases, reference cases, fixtures, an independent reader | `tenet conform`, `pkg/conformance/` | 0.1.0 onward |
| D8 | **Documentation** | `docs/` | 0.1.0 onward |

## 4. Requirements

Status: `proposed`, `approved`, `built`, or `reported`. **Guarantee** is the strongest level a requirement may claim in host-driven mode: `enforced`, `enforced*` (only while the trust assumptions are observed to hold, R-110), `detected`, `advisory`, or `—`. `0.1.x` means a point release after 0.1.0. Standard claims, evidence kinds and decisions are in the [catalog](prd/catalog.md).

### 4.1 The kernel

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-200 | **Seven primitives and one gate rule.** Subject, Actor, Claim, Evidence, Decision, Event and Policy are the only normative record types; a work item (packet) groups the claims, evidence and decisions for one intent. **Gate rule:** a transition is allowed when every claim the policy makes applicable to the subject is satisfied by fresh evidence at the required strength, or waived by a fresh decision at the required strength; nothing else advances work | V-P2, V-P4, V-V4 | 0.1.0 | enforced* | proposed |
| R-201 | **Subjects** are content-addressed (`{kind, digest}`); their kinds are pack data (git tree and file set in 0.1.0; artifact, deployment, configuration, data, flag, platform object and multi-repository later); a claim, evidence or decision is fresh only while its subject's digest is current | V-P2, V-B9 | 0.1.0 | enforced* | proposed |
| R-202 | **Claims** state what must hold: scope, claim class, method, pass rule (binary, baseline-relative or probabilistic), lifetime (`packet` or `continuing`) and owner. Acceptance items, earlier promises, health indicators, protected paths, size limits, review convergence and readiness are standard claim types (catalog) | V-P2, V-P9, V-M10 | 0.1.0 | enforced* | proposed |
| R-034 | **Evidence** is an observation about a subject: kind (check, measurement, attestation, observation, review, proof, simulation, differential), dimension, method, the claims it addresses, the cases expected, executed and passed, result, strength and producer. It comes only from checks pinned in the target's policy; each method has a completion rule; a suite that found none of its expected cases is inconclusive | V-P2, V-M2 | 0.1.0 | enforced* | proposed |
| R-203 | **Decisions** have five kinds: `approve`, `waive` (a claim, with scope, reason and expiry), `choose` (an option of a request), `delegate` (a right, with expiry) and `resolve` (a conflict). Every named decision in the catalog is one of these | V-V1, V-P1 | 0.1.0 | enforced | proposed |
| R-101 | **Decisions carry proof**: strengths `person-present`, `forge-verified`, `key` and `channel`; the policy's proof table sets what each decision needs (default `forge-verified`; `person-present` for policy, permission and vision changes). Every answer binds request, subject, choice, actor and policy version; signatures survive squash, rebase and shallow clones | V-B2, V-P12 | 0.1.0 | enforced at the required strength | proposed |
| R-102 | **Decision requests** are durable: subject, question, options with stop first, recommendation, who may decide, deadline, default stop; delivered on the pull request from 0.1.0. An option that changes scope cannot approve the current subject | V-V1, V-V8 | 0.1.0 | enforced | proposed |
| R-124 | **Actors** are people, agents and services; every run records its actor chain (initiator → agent → subagent → tool) with scope and expiry, credential policy, environment, harness, model, factory-definition version and usage with cost source | V-P11 | 0.1.0 | detected | proposed |
| R-039 | **Events** are the source of truth: one immutable file each, carrying `prev`; about eight types (work created, changed, moved, claim stated, evidence recorded, decision requested or made, run started or ended, closed). CI replays each changed packet and labels every state change justified, pending evidence or unjustified; incompatible concurrent state changes create a conflict a `resolve` decision settles | V-P2, V-P10 | 0.1.0 | enforced* | proposed |
| R-109 | **Policy comes from the target, judged at decision time.** The verifier reads `tenet.yaml`, the lock, packs and the Tenet version from the target line, never from the change; every gate evaluation records the policy, evidence-store and trust-observation revisions it used, and replay uses that snapshot | V-P10 | 0.1.0 | enforced* | proposed |
| R-204 | **Policy declares** which claims apply where (packs, stations, lanes, areas, work types), the proof table, approvals by risk, owners and keys, pinned checks, budgets and the protected claims; projects may only tighten what a pack sets | V-P7, V-P12 | 0.1.0 | enforced* | proposed |
| R-006 | Every kernel rule declares its **guarantee level** per execution mode and the trust assumptions it depends on; the board shows the level in effect for each change | V-P12, V-B8 | 0.1.0 | — | proposed |
| R-030 | Work items get a ULID identity and a 6-character alias; duplicate aliases are refused at merge; every existing `CP-NNNN` stays valid | V-P5 | 0.1.0 | detected | proposed |
| R-031 | `tenet move` appends an event and refuses a move the gate rule refuses, naming each unsatisfied claim and the next command | V-P2, V-H1 | 0.1.0 | enforced* | proposed |

### 4.2 Trust and verification

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-100 | **Two-job verifier**: a check job runs pinned checks with no secrets or write access, detects checks that edit tracked files, passes only on exit code 0 with a valid report, and writes its bundle outside the working tree; an attest job never runs the change, verifies the bundle, checks protected claims, replays events and writes evidence to the evidence store | V-P2, V-B7 | 0.1.0 | enforced* | proposed |
| R-110 | The attest job observes and records the trust assumptions (protected verifier source, evidence store written only by it, merging requires it); `enforced*` counts as enforced only while a fresh observation says they hold | V-P12, V-B8 | 0.1.0 | — | proposed |
| R-104 | `holdout.mode` is `external` (outside the build repository) or `in-repo` (always advisory) | V-P11, V-P12 | 0.1.0 (declared); M2 | advisory; enforced* if external | proposed |
| R-105 | A run with both untrusted input and sensitive data gets no network and may change only its worktree; assignment inputs carry source, trust and hash, and the evaluator refuses an assignment that combines all three properties | V-P11, V-B5 | 0.1.0 | advisory (declared); as the host enforces | proposed |
| R-106 | A **red-team suite** runs in CI: forged or misattributed evidence, policy edited on a branch, protected files edited, code under test faking reports or reading credentials, impersonated, replayed or channel-only decisions, agent-answered gates, hand-written or conflicting moves, squash merges keeping signatures, holdout reads, prompt-injected issues, skipped mapped cases, harness-failed baselines, broken earlier promises, quarantines hiding obligations, and (M2) proof escape hatches | V-M2, V-H1 | 0.1.0 | — | proposed |
| R-107 | Run records keep summaries, hashes and costs, not transcripts, unless opted in; secrets are never written | V-B5 | 0.1.0 | detected | proposed |
| R-080 | Tenet's tooling never calls a model; its only network use is fetching a package, reading a configured issue source, and in CI the attest job reading forge protection and reviews, posting decision requests and writing the evidence store | V-B4, V-B5 | 0.1.0 | enforced | proposed |

### 4.3 Work, views and operations

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-032 | `tenet board` reduces events from the main line, matching packet lines and the evidence store, for a named as-of time, into `board.json` (refs read, pack phases, typed next actions) and `now.md`; generated views are never committed | V-V2 | 0.1.0 | — | proposed |
| R-033 | `tenet check` runs structure, traceability, event, alias and budget checks and exits non-zero on any error | V-P2, V-M2 | 0.1.0 | detected | proposed |
| R-035 | `tenet close` computes the endpoint, writes a ledger entry, and turns the packet's preservation items into continuing claims with their proving cases | V-P2, V-P9 | 0.1.0 | enforced* | proposed |
| R-036 | When a stop threshold is met (sessions, repeated failure, appetite, cost or tokens), the refused move also records a stop event; `tenet escalate` writes the escalation | V-P6 | 0.1.0; 0.1.x | detected | proposed |
| R-037 | **Leases** (exclusive work locks) are advisory in a working copy and exclusive only where an engine provides an atomic update; strength is shown | V-P5, V-P12 | 0.1.0; M3 | advisory | proposed |
| R-038 | Hooks catch violations early; CI reruns the same checks | V-P2 | 0.1.0 | detected | proposed |
| R-072 | `tenet metrics` computes vision and diagnostic metrics with units, sample sizes and bounds | V-M3, V-M4 | M2 | — | proposed |
| R-073 | The board shows flow from 0.1.0: verified changes per week by lane, lead time (median, 85th percentile), work in progress, decision wait, cost per outcome with source, autonomy share beside escapes | V-V2, V-M3, V-M4, V-M7, V-M9 | 0.1.0 | — | proposed |
| R-074 | `tenet audit sample` draws a random sample of verified changes for independent rerun or review and reports the rate with its bound | V-M2 | M2 | — | proposed |
| R-075 | The decision-reconstruction exercise is a published procedure run in every pilot | V-M1 | M0; 0.1.x | — | proposed |

### 4.4 Standard, kit, install and upgrade

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-001 | A normative kernel (Part I) of at most 8,000 tokens; reference packs and practices (Part II) are non-normative | V-P4, V-P7 | M0 | — | proposed |
| R-002 | Every kernel "must" rule has a rule ID: provisional from 0.1.0, stable from 1.0 | V-V4 | 0.1.0; M4 | — | proposed |
| R-003 | The standard names no tool, model or vendor as a requirement | V-P4, V-B1 | M0 | — | proposed |
| R-004 | Each release has a changelog and its migrations | V-V3, V-B6 | 0.1.0 | — | proposed |
| R-005 | A rule or field is deprecated for one minor version before removal | V-B6 | 0.1.0 | — | proposed |
| R-007 | Conformance classes: producer, evaluator, executor, renderer, project; a claimed pack's claims become testable for that claim | V-V4 | 0.1.0 | — | proposed |
| R-008 | Every document type has a token budget and rollover (archive, then compact or split); assignments carry sections, not whole files | V-P7, V-V2 | 0.1.0; M2 | detected | proposed |
| R-009 | The kernel is checked against four reference cases: a library with unobservable installs, a regional rollback, a migration with a point of no return, an ML change with no code change | V-V5, V-P4 | M0 | — | proposed |
| R-010 | JSON Schemas with fixtures for the seven primitives, the work item, policy, lock, pack, agent, loop, assignment, result, criteria and board | V-V4, V-P2 | 0.1.0 | — | proposed |
| R-011 | A template for every document type the kernel and shipped packs define | V-V3 | 0.1.0 | — | proposed |
| R-012 | Reference agents for every role a shipped pack binds: builder and judge (0.1.0), shaper and verifier (0.1.x), the rest with the standard pack | V-V1, V-P2 | 0.1.0; 0.1.x; M2 | — | proposed |
| R-013 | One judge protocol; criteria as structured data; critics differ by criteria and required inputs | V-P2 | 0.1.0 | — | proposed |
| R-014 | Loops `station` and `fix` (0.1.0); `triage`, `upgrade`, `qualify` later; tunable by narrowing | V-P4 | 0.1.0 | — | proposed |
| R-015 | Reviewers that can unblock a gate pass a 5-case activation test; smoke suites at M3; qualification at M5 | V-P2, V-H4 | 0.1.0; M3; M5 | enforced | proposed |
| R-016 | Packs are data: `minimal` (intake, define, build, verify, integrate, close; quick and standard lanes, express in 0.1.x) by default; `software-standard` at M2. Each pack lists its standard claims, work types and methods | V-P7 | 0.1.0; M2 | — | proposed |
| R-017 | A skills library in the open agent-skills format; project skills pinned by hash | V-P4, V-V1 | 0.1.0 | detected | proposed |
| R-018 | Agents change state only through commands that write events | V-P10 | 0.1.0 | detected | proposed |
| R-020 | `tenet init` creates a project on `minimal` and reports readiness for advisory or verified work | V-V3 | 0.1.0 | — | proposed |
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

### 4.5 Agents, execution, conformance and quality

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
| R-048 | The package exports an SDK with the CLI's functions | V-V4 | 0.1.0 | — | proposed |
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

## 5. Versioning and release policy

| Change | Version | Subscriber effect |
|---|---|---|
| Wording, clarification, bug fix | Patch | Auto-merge after the conformance check |
| New optional capability; a stricter check conforming projects already pass | Minor | Auto-merge from 1.0; review below 1.0 |
| Changed schema, removed rule, new required gate, any change to authority, permissions, severity or evidence requirements | Major | Waits for a decision-maker |

A release is cut from an `ops` release packet with a `release` decision. **Release gates prove the software works; horizons prove its value.** They are never the same gate.

## 6. Milestones and releases

| ID | Release | Delivers | Release gate | Horizon measured |
|---|---|---|---|---|
| M0 | — | Revised documents; the kernel written as Part I; feasibility spike; problem validation started | The Owner signs the vision and approves the specs and kernel | — |
| M1 | **0.1.0** | **The kernel** (seven primitives, gate rule, replay, snapshots), the `minimal` pack with its standard claims (acceptance items, continuing promises, protected paths, size limits, review convergence), the two-job verifier and evidence store, forge-verified decisions on pull requests, the board, `init`, `check`, `doctor`, `agents-md`, builder and judge, `station` and `fix`, red-team suite, quick start | Red-team cases pass at their levels; quick start on three platforms; a real GitHub run; this repository and Torus each close ≥5 verified changes | — |
| M1 | 0.1.x | Catalog entries marked 0.1.x: adopt, express, campaigns, areas and readiness, approvals by risk, merge queue, quarantine, health ratchet, factory definition, attribution, host bindings, independent reader, external pilot | Each point release: its packets' checks and the red-team suite | V-H1 |
| M2 | 0.2.0 | `software-standard` pack and catalog entries marked M2 | 30 days in 3 projects on the standard pack | V-H2 (part) |
| M3 | 0.3.0 | Engine adapters, MCP server, more hosts, exclusive leases, catalog entries marked M3 | Same packets on 2 engines with the same decisions | V-H2 |
| M4 | 1.0.0 | Upgrade and migrations; stable rule IDs; conformance kit; open proposal process | 3 releases reach 3 projects; 2 implementations agree on every kernel fixture | V-H3 |
| M5 | 1.x | Qualification, staged agent release, scorecards | V-H4 criteria | V-H4 |

## 7. Decisions

| ID | Decision | Why |
|---|---|---|
| DEC-32 | **The kernel is seven primitives and one gate rule** (L-0012); every feature is a standard claim, evidence kind or decision in the catalog | One small thing to implement and verify; features stop adding concepts |
| DEC-33 | "Claim" means something that must hold; exclusive work locks are **leases** | One word, one meaning |
| DEC-01–DEC-31 | Unchanged in substance; the full table is kept in `archive/specs/prd.md@0.6.md`. In short: one package with kit, CLI and SDK; vendored kit with a lock; narrowing overlays; neutral loops; no model calls; TypeScript on Node 22; self-hosting; events as truth; two-job verifier and off-branch evidence; content-signed decisions with a proof table (`forge-verified` default); collision-free IDs; declared guarantee strengths; `minimal` default; open formats; rules from the target; decision and evidence layer; GitHub first; release gates apart from horizons; governed factory definition and factory changes; two configuration planes; campaign approval inheritance; approvals by risk; nothing outside Tenet's role; continuing promises; health ratchet on touched scope; one method list; staged self-verification | Decided across L-0002 to L-0011 |

## 8. Risks

| ID | Risk | Mitigation |
|---|---|---|
| RK-01 | The standard grows too large | Seven primitives; kernel budget of 8,000 tokens; new features must be catalog entries |
| RK-05 | People assume stronger guarantees than they have | Guarantee levels, observed trust assumptions, `doctor` |
| RK-07 | Setup puts people off | `forge-verified` decisions need no hardware; readiness report names what is missing |
| RK-08 | LLM critics are biased | Checks first; activation test; incomplete reviews never converge |
| RK-09 | The problem is not the one adopters feel | Reconstruction exercise; external pilot before V-H1 |
| RK-10 | The trust model depends on forge features | Observed and shown; one forge first |
| RK-11 | Presence may not be provable from signatures | CP-0017 tests it |
| RK-12 | Declaring the factory pulls Tenet toward being a platform | Tenet validates, records and governs only |
| RK-14 | The kernel is too abstract for users | Users see claim types by their own names (acceptance item, promise, health indicator); the generic words appear only in the kernel |

Other risks (RK-02, RK-03, RK-04, RK-06, RK-13) are unchanged; see the archived version.

## 9. Open questions

| ID | Question | Needed by |
|---|---|---|
| OQ-01 | Package name: unscoped or scoped | 0.1.0 |
| OQ-02 | Which issue sources `adopt` reads first | 0.1.x |
| OQ-03 | Whether the conformance kit is also a separate package | M4 |
| OQ-04 | Licence for the standard text versus the code | 0.1.0 |
| OQ-05 | Which external project pilots 0.1.x | 0.1.x |
| OQ-07 | Which engines get the first adapters | M3 |

OQ-06 and OQ-08 were closed in L-0010.
