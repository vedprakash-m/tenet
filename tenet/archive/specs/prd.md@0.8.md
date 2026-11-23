# Tenet product requirements

> Level L1 · Version 0.8 · Status: **draft, awaiting the Owner's approval** · Serves [vision.md](../vision.md) · Normative standard: [kit/TENET.md](../../kit/TENET.md) · Catalog: [prd/catalog.md](prd/catalog.md) · Tooling: [prd/tooling.md](prd/tooling.md) · Budget: 9,000 tokens · Previous version: `archive/specs/prd.md@0.7.md`

## 1. Scope and positioning

**Tenet is a spec-driven development standard for software factories.** Intent is written in levelled specifications that people own and agents work from; every change traces to them; changing them is itself governed (§4.0); and "done" is proven against them with evidence agents cannot fake. It ships as that spec process, a small kernel of seven primitives and one gate rule that makes it checkable (§4.1), packs that make it usable on day one, and the minimum deterministic tooling to adopt, enforce and stay current with it. Every other feature is a standard claim, evidence kind or decision listed in the [catalog](prd/catalog.md). Spec tools, trackers, orchestrators, factory platforms, hosts and dashboards keep their jobs and read and write Tenet's records; tools that draft per-change specs feed the ladder rather than replace it.

| In scope | Out of scope |
|---|---|
| The kernel, its rule IDs and its versioning | A hosted service, dashboard, database or account system |
| Packs: lifecycles, standard claims, reference agents, skills, loops, criteria, templates | Running models; Tenet's own tooling never calls one |
| A deterministic CLI and SDK; a CI verifier | An orchestrator, dispatcher, issue tracker, analyzer, prover, sandbox or context graph of its own |
| A factory definition Tenet validates, records and governs | Executing it (engines and platforms do this) |
| Bindings to forges, hosts and engines through open contracts; a conformance kit | Certifying third parties; paid support |

**Assumptions.** The kernel needs a content-addressed, signable history; git is the reference binding, and records scale in three tiers up to an external append-only store (catalog R-167). The first forge binding is GitHub. Configuration has two planes: `tenet.yaml` (policy) and the optional `factory.yaml` (execution).

**Relationship to other repositories.** Tenet for Copilot (`tenet-copilot`) is an implementation that will declare conformance. Torus is the first subscribing project after this repository.

## 2. Users

| Persona | Needs | Primary deliverables |
|---|---|---|
| **Owner** (one person or a team with named decision rights) | Write intent once at the right level; first governed change in an afternoon; decide only what needs them; trust what the floor says | Spec templates and ladder, `minimal` pack, CLI, CI verifier, board |
| **Maintainer** | Know which earlier promises still hold and that the next change stays affordable | Continuing claims, health ratchet, board |
| **Factory operator** | Declare the factory, see readiness and cost per outcome, change it on evidence | Factory definition, campaigns, metrics |
| **Agent** | The specification sections that apply, an unambiguous assignment, the skills for its station, a way to propose results that the tooling accepts or refuses | Agent definitions, skills, assignment and result contracts, SDK |
| **Implementer** | Seven primitives, one gate rule, stable schemas, conformance per claim | Kernel, schemas, conformance kit, catalog |
| **Steward** | Propose, test and release changes safely | This repository run under its own rules |

**First adopter.** A maintainer who already delegates real changes to coding agents, has CI, and regularly has to reconstruct whether an agent's "done" is true (tested in CP-0016).

## 3. Deliverables

| ID | Deliverable | Ships as | Release |
|---|---|---|---|
| D1 | **Standard**: the spec process (document ladder, ownership, governed change, traceability, escalation), seven primitives, the gate rule, guarantee levels, trust assumptions, conformance classes | `kit/TENET.md` Part I | Draft M0; 1.0 at M4 |
| D2 | **Kit**: schemas, defaults, a template for every level, packs (with their standard claims), reference agents, skills, loops, criteria | `kit/`, vendored into `.tenet/kit/`; checksummed archive | 0.1.0 (`minimal`); 0.2 (standard pack) |
| D3 | **CLI and SDK** `tenet` | One npm package | 0.1.0 onward |
| D4 | **CI verifier**: a no-secrets check job and an attest job that never runs the change | `tenet verify --run-checks` / `--attest`, plus a workflow template | 0.1.0 |
| D5 | **Host and engine bindings** behind open contracts | `tenet build --target <id>`, `tenet run` | 0.1.0 (`agents-md`); 0.1.x; M3 |
| D6 | **Factory definition** schema and platform mappings | `kit/schemas/factory.json`, `docs/mappings/` | 0.1.x |
| D7 | **Conformance kit**: red-team cases, reference cases, fixtures, an independent reader | `tenet conform`, `pkg/conformance/` | 0.1.0 onward |
| D8 | **Documentation** | `docs/` | 0.1.0 onward |

## 4. Requirements

Status: `proposed`, `approved`, `built`, or `reported`. **Guarantee** is the strongest level a requirement may claim in host-driven mode: `enforced`, `enforced*` (only while the trust assumptions hold as observed or attested, R-110), `detected`, `advisory`, or `—`. `0.1.x` means a point release after 0.1.0. Standard claims, evidence kinds and decisions are in the [catalog](prd/catalog.md).

### 4.0 The spec process

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-207 | **Document ladder.** Intent lives in levelled documents: vision (L0); product requirements and the adopted standard (L1); system and experience specifications and the plan (L2); change packets (L3); code and tests (L4); plus holdout scenarios, an append-only ledger of decisions and a generated floor view. Each level has a template, a token budget and an owner; packs may add documents, never loosen a level's rules. In the kernel each document is a subject | V-P18, V-V2 | 0.1.0 | detected | proposed |
| R-208 | **Ownership gradient.** L0 changes only by its decision-makers, ratified twice; L1 and L2 invariant sections only by an approved spec change; other L2 by a reviewer with passing checks, decision-makers notified; L3 by shaping and planning agents, reviewed; L4 by builders through gates. Builders never edit L0–L2 and never read holdout. The level sets who may `approve` and at what strength | V-P1, V-B2, V-P18 | 0.1.0 | detected; enforced* with CI | proposed |
| R-209 | **Governed spec change.** A change to L1 or L2 is a `spec` work item whose definition lists its deltas (added, modified, removed per document), merged at Integrate; a vision change carries a `Tenet-Amendment` trailer naming a ratified packet; a clarification with no change in behavior is a direct edit with a `Tenet-Clarification` trailer | V-P9, V-P18 | 0.1.0 | detected; enforced* with CI | proposed |
| R-210 | **Requirements and traceability.** Every requirement has an ID, a status (`proposed`, `approved`, `built`, `reported`) and the vision items it serves; every packet serves vision items and implements approved requirements; commits carry `Tenet-Task` and `Tenet-Req` trailers. A requirement is a continuing claim and is `built` only with passing proving cases. `tenet check` proves the chain: IDs unique and resolved, every active vision item covered or marked not yet in scope, the vision matching its latest ratified amendment | V-P2, V-M1, V-P18 | 0.1.0 | detected | proposed |
| R-211 | **Agents work from the specifications.** The `AGENTS.md` block and every assignment point to the sections of each level that apply, within budget; an agent that finds a specification wrong, missing or contradictory opens a spec change or escalates (R-036), and never edits it or works around it in code | V-P10, V-P18 | 0.1.0 | detected | proposed |
| R-008 | Every document type has a token budget and rollover (archive, then compact or split); assignments carry sections, not whole files | V-P7, V-V2 | 0.1.0; M2 | detected | proposed |
| R-011 | A template for every level and document type the standard and shipped packs define, each with a worked example and a completeness checklist | V-V3, V-P18 | 0.1.0 | — | proposed |
| R-033 | `tenet check` runs structure, traceability (R-210), change-control (R-209), event, alias and budget checks and exits non-zero on any error | V-P2, V-M2 | 0.1.0 | detected | proposed |
| R-036 | When work and its specifications conflict, or a stop threshold is met (sessions, repeated failure, appetite, cost or tokens), the work stops; the escalation report quotes the conflicting sentences with their IDs and names the lowest level that can resolve it; `tenet escalate` writes it | V-P6, V-P18 | 0.1.0; 0.1.x | detected | proposed |

### 4.1 The kernel

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-200 | **Seven primitives, one container and one gate rule.** Subject, Actor, Claim, Evidence, Decision, Event and Policy are the only normative record types; the work item (packet) groups the claims, evidence and decisions for one intent. Every other record (lease, run, assignment, result, escalation, ledger entry) maps onto them (tech spec §3.2). **Gate rule:** a transition is allowed when every applicable claim is satisfied (by fresh evidence at the required strength, or, for an approval claim, by a fresh `approve` at the required proof strength) or waived (by a fresh `waive` where waiving is allowed); nothing else advances work | V-P2, V-P4, V-V4 | 0.1.0 | enforced* | proposed |
| R-201 | **Subjects** are content-addressed (`{kind, digest}`); their kinds are pack data (git tree, file set and area in 0.1.0; artifact, deployment, configuration, data, flag, platform object and multi-repository later); a claim, evidence or decision is fresh only while its subject's digest is current. Declared inputs (runner image, lockfile, check definitions) are part of the digest | V-P2, V-B9 | 0.1.0 | enforced* | proposed |
| R-202 | **Claims** state what must hold: a **selector** (`station`, `lane`, `work_type`, `paths`, `areas`; globs and enums), class, accepted methods (any one satisfies), pass rule (binary, baseline-relative or probabilistic), lifetime (`packet` or `continuing`), owner and whether it may be waived. Several claims are all required. **Applicability:** policies only tighten and the most restrictive requirement wins; a continuing claim applies when a change touches its paths or the dependencies its area declares (the whole area when none are declared); applicability that cannot be computed refuses with a reason | V-P2, V-P9, V-M10 | 0.1.0 | enforced* | proposed |
| R-034 | **Evidence** is an observation about a subject: kind (check, measurement, attestation, observation, review, proof, simulation, differential), method, the claims it addresses, the cases expected, executed and passed, result, producer, input digests and, for observations, `valid_until`. **Strength has three ordered axes:** provenance (local < CI < CI with trust observed), independence (`self` never satisfies < `same-definition` < `different-definition` < `different-model-family` < `person`) and method (packs list which methods satisfy each claim class; methods are never ranked globally). Policy sets a minimum per axis by claim class and lane. Evidence comes only from checks pinned in the target's policy; each method has a completion rule; a suite finding none of its expected cases is inconclusive | V-P2, V-M2 | 0.1.0 | enforced* | proposed |
| R-203 | **Decisions** have five kinds: `approve`, `waive`, `choose` (an option of a request), `delegate` (a right, with expiry) and `resolve` (a conflict). Every named decision in the catalog is one of these. **A `waive`** names its claim, scope, reason and expiry (an expired waive re-blocks); the actor whose change broke a claim, or an agent acting for them, cannot waive it; claims marked unwaivable (protected paths; safety and security claims in the deep lane) need an `approve`; retiring a continuing promise is an `approve` by its owner, never a waive | V-V1, V-P1 | 0.1.0 | enforced | proposed |
| R-101 | **Decisions carry proof**, in strict order `person-present` > `forge-verified` > `key` > `channel`; the policy's proof table sets what each decision needs (default `forge-verified`; `person-present` for policy, permission, vision and deep-lane release). `forge-verified` means *attributable to the decision-maker's forge account*: it counts as enforced* only where trust assumption 4 is attested (R-110), otherwise as detected, and the forge's two-factor status is recorded as `enforced`, `not-enforced` or `unobservable`. A review approval binds the reviewed commit and is the primary path; a decision comment names the subject digest, and every request carries copy-ready answer lines. Answers bind request, subject, choice, actor and policy version; signatures survive squash, rebase and shallow clones | V-B2, V-P12 | 0.1.0 | enforced at the required strength | proposed |
| R-102 | **Decision requests** are durable: subject, question, options with stop first, recommendation, who may decide, deadline, default stop; delivered on the pull request from 0.1.0. An option that changes scope cannot approve the current subject | V-V1, V-V8 | 0.1.0 | enforced | proposed |
| R-124 | **Actors** are people, agents and services; every run records its actor chain (initiator → agent → subagent → tool) with scope and expiry, credential policy, environment, harness, model, factory-definition version and usage with cost source | V-P11 | 0.1.0 | detected | proposed |
| R-039 | **Events** are the source of truth: one immutable file each, carrying `prev`, in eight families (`work.*`, `claim.stated`, `evidence.recorded`, `decision.*`, `run.*`, `gate`, `lease.*`); station and holding status are separate fields. Gate events record which pack rule linked each piece of evidence to each claim (the argument). CI replays each changed work item and labels every state change justified, pending evidence (**tentative**: never counted by a later gate; unjustified after a timeout) or unjustified; incompatible concurrent state changes create a conflict a `resolve` settles; forge state (ready for review, merged) and decisions read from forge reviews are recorded by the attest job as signed events on the evidence store | V-P2, V-P10 | 0.1.0 | enforced* | proposed |
| R-109 | **Policy comes from the target, judged at decision time.** The verifier reads `tenet.yaml`, the lock, packs and the Tenet version from the target line, never from the change; every gate evaluation records the policy, evidence-store and trust-observation revisions it used, and replay uses that snapshot | V-P10 | 0.1.0 | enforced* | proposed |
| R-204 | **Policy declares** which claims apply where (packs, stations, lanes, areas, work types), the proof table, approvals by risk, owners and keys, pinned checks, budgets and the protected claims; projects may only tighten what a pack sets | V-P7, V-P12 | 0.1.0 | enforced* | proposed |
| R-006 | Every kernel rule declares its **guarantee level** per execution mode and the trust assumptions it depends on; the board shows the level in effect for each change | V-P12, V-B8 | 0.1.0 | — | proposed |
| R-030 | Work items get a ULID identity and a 6-character alias; duplicate aliases are refused at merge; every existing `CP-NNNN` stays valid | V-P5 | 0.1.0 | detected | proposed |
| R-031 | `tenet move` appends an event and refuses a move the gate rule refuses, naming each unsatisfied claim and the next command | V-P2, V-H1 | 0.1.0 | enforced* | proposed |
| R-205 | **Minimal valid records.** Each primitive has three to five required fields and everything else is optional; a producer conforms at the `minimal` level by writing only those | V-V4, V-P7 | 0.1.0 | — | proposed |

### 4.2 Trust and verification

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-100 | **Two-job verifier**: a check job runs pinned checks with no credentials, no write access, network denied by default, an environment-variable allowlist, no cache shared with the attest job and a recorded runner image; it detects checks that edit tracked files, passes only on exit code 0 with a valid report, and writes its bundle outside the working tree; an attest job never runs the change, parses the bundle as data, checks protected claims, replays events and **signs each evidence record with its workflow identity**, so a record verifies wherever it is stored; a store only that job can write is the fallback. Tenet ships one hardened reference workflow | V-P2, V-B7 | 0.1.0 | enforced* | proposed |
| R-110 | The attest job observes and records trust assumptions 1–3: protected verifier source; evidence verifying against that source's identity; merging requires its status (recorded as unavailable on forge plans without merge protection). Assumption 4 cannot be fully observed: it is **declared** in the policy, spot-checked (agent commits from declared bot identities; no decision from the account whose agent session opened the pull request), and supports enforced* only where a host binding attests that agents run without decision-makers' credentials. `enforced*` counts as enforced only while a fresh observation holds | V-P12, V-B8 | 0.1.0 | — | proposed |
| R-104 | `holdout.mode` is `external` (outside the build repository) or `in-repo` (always advisory) | V-P11, V-P12 | 0.1.0 (declared); M2 | advisory; enforced* if external | proposed |
| R-105 | A run with both untrusted input and sensitive data gets no network and may change only its worktree; assignment inputs carry source, trust and hash, and the evaluator refuses an assignment that combines all three properties | V-P11, V-B5 | 0.1.0 | advisory (declared); as the host enforces | proposed |
| R-106 | A **red-team suite** runs in CI: forged evidence; policy or protected files edited on a branch; code under test faking reports or reading credentials; impersonated, replayed, channel-only or agent-answered decisions, **including an agent using the Owner's forge session** and **an approval edited after recording**; cache poisoning or artifact injection between the two jobs; hand-written or conflicting moves; squash merges; holdout reads; prompt injection; **skipped mapped cases, inserted skips, special-cased or deleted tests, substituted reports, planted test hooks**; harness-failed baselines; broken promises and hiding quarantines (0.1.x); proof escape hatches (M2). The list matches the guarantee table | V-M2, V-H1 | 0.1.0 | — | proposed |
| R-107 | Run records keep summaries, hashes and costs, not transcripts, unless opted in; secrets are never written | V-B5 | 0.1.0 | detected | proposed |
| R-080 | Tenet's tooling never calls a model; its only network use is fetching a package, reading a configured issue source, fetching the forge's signing keys when the user asks, and in CI the attest job reading forge protection, reviews and signing keys, posting decision requests and writing the evidence store | V-B4, V-B5 | 0.1.0 | enforced | proposed |

### 4.3 Work, views and operations

| ID | Requirement | Serves | Release | Guarantee | Status |
|---|---|---|---|---|---|
| R-032 | `tenet board` reduces events from the main line, matching packet lines and the evidence store, for a named as-of time, into a versioned `board.json` (refs read, pack phases, dependencies, typed next actions with the command to run; readable from a given revision) and `now.md`; generated views are never committed; a fixture gallery of boards (tentative moves, conflicts, waivers, defeated promises) ships for UI builders | V-V2 | 0.1.0 | — | proposed |
| R-035 | `tenet close` computes the endpoint and writes a ledger entry; from 0.1.x it turns the packet's preservation items into continuing promises with their proving cases | V-P2, V-P9 | 0.1.0; 0.1.x | enforced* | proposed |
| R-037 | **Leases** (exclusive work locks, optionally over `paths`) are advisory in a working copy and exclusive only where an engine provides an atomic update; strength is shown; resuming an interrupted station is idempotent | V-P5, V-P12 | 0.1.0; M3 | advisory | proposed |
| R-038 | Hooks catch violations early; CI reruns the same checks | V-P2 | 0.1.0 | detected | proposed |
| R-072 | `tenet metrics` computes vision and diagnostic metrics with units, sample sizes and bounds | V-M3, V-M4 | M2 | — | proposed |
| R-073 | The board shows flow from 0.1.0: verified changes per week by lane, lead time (median, 85th percentile), work in progress, decision wait, cost per outcome with source, autonomy share beside escapes | V-V2, V-M3, V-M4, V-M7, V-M9 | 0.1.0 | — | proposed |
| R-074 | `tenet audit sample` draws a random sample of verified changes for independent rerun or review and reports the rate with its bound | V-M2 | M2 | — | proposed |
| R-075 | The decision-reconstruction exercise is a published procedure run in every pilot | V-M1 | M0; 0.1.x | — | proposed |

### 4.4 Standard, kit, agents and conformance

Moved to [prd/tooling.md](prd/tooling.md) under the rollover rule: R-001–R-005, R-007, R-009, R-010, R-012–R-028, R-040–R-055, R-060–R-064, R-070, R-071, R-081–R-084 and R-206. IDs are unchanged.

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
| M0 | — | Revised documents; three feasibility spikes; the kernel written as Part I from their results; problem validation started | The ready-for-pilot checklist (plan §1) holds; the Owner signs the vision and approves the specs and kernel | — |
| M1 | 0.1.0-alpha.0 (spec kit) | The spec process with no CI needed: templates for every level, the ladder in the `minimal` pack, the `AGENTS.md` block, spec packets, `init` and `check` (structure, traceability, change control, budgets) | This repository and Torus run their specs under it; a maintainer outside the steward sets it up from the quick start in under an hour | — |
| M1 | 0.1.0-alpha.1 (acceptance receipts) | On every pull request the attest job posts which acceptance items are proven on this exact commit: pinned checks, case tags, distinguishing runs on the base, signed evidence; no events, decisions or board yet | On Torus and with two CP-0016 interviewees: Owner minutes to check an agent's pull request fall; false "done" claims are caught; record overhead under 2 minutes per change; setup under 1 hour | — |
| M1 | 0.1.0-alpha (internal) | Events and the gate rule, moves derived from pull-request state, forge decisions under the trust assumptions, the board and its fixture gallery, `doctor`, the red-team cases | This repository closes ≥3 verified changes on it; red-team cases pass at their levels | — |
| M1 | **0.1.0** | The alpha plus the standard lane (independent tests, an optional advisory critic, activation tests), the `minimal` pack's standard claims (acceptance items, protected paths, size limits, review convergence), `agents-md`, builder and judge, `station` and `fix`, quick start | Red-team cases pass at their levels; quick start on three platforms; a real GitHub run; this repository and Torus each close ≥5 verified changes | — |
| M1 | 0.1.x | Catalog entries marked 0.1.x: continuing promises with defeaters and the health ratchet, adopt, express, campaigns, areas and readiness, approvals by risk, merge queue, quarantine, factory definition, attribution, host bindings, independent reader, external pilot | Each point release: its packets' checks and the red-team suite | V-H1 |
| M2 | 0.2.0 | `software-standard` pack and catalog entries marked M2 | 30 days in 3 projects on the standard pack | V-H2 (part) |
| M3 | 0.3.0 | Engine adapters, MCP server, more hosts, exclusive leases, catalog entries marked M3 | Same packets on 2 engines with the same decisions | V-H2 |
| M4 | 1.0.0 | Upgrade and migrations; stable rule IDs; conformance kit; open proposal process | 3 releases reach 3 projects; 2 implementations agree on every kernel fixture | V-H3 |
| M5 | 1.x | Qualification, staged agent release, scorecards | V-H4 criteria | V-H4 |

## 7. Decisions

| ID | Decision | Ledger |
|---|---|---|
| DEC-01 | Tenet is the standard; the VS Code implementation is Tenet for Copilot | L-0001 |
| DEC-02–04 | One package holds kit, CLI and SDK; the kit is vendored with hashes in a lock; overlays only narrow | L-0002, L-0005 |
| DEC-05 | Loops are an engine-neutral format | L-0003 |
| DEC-06–09 | No model calls; TypeScript on Node 22; self-hosting; a small core plus packs | L-0004 |
| DEC-10–14 | Replayed events; two-job verifier; off-branch evidence; content-signed decisions; ULID aliases; declared strengths | L-0007, L-0008 |
| DEC-15–20 | `minimal` default; open formats; rules from the target; a layer beside other tools (DEC-18, amended by DEC-39); GitHub first; release gates apart from horizons | L-0007, L-0008 |
| DEC-21–22 | The factory definition is part of the standard and never executed by Tenet; factory changes are packets with a stated purpose | L-0009 |
| DEC-23–27 | `forge-verified` default; two configuration planes; campaign approval; approvals by risk; judging and platforms stay outside | L-0010 |
| DEC-28–31 | Continuing promises; health ratchet on touched scope; one method list; staged self-verification | L-0011 |
| DEC-32 | **Seven primitives and one gate rule**; every feature is a catalog entry | L-0012 |
| DEC-33 | "Claim" means something that must hold; exclusive work locks are **leases** | L-0012 |
| DEC-34 | The gate rule counts `approve` for approval claims; applicability has a selector and tighten-only merge; strength has three ordered axes; waivers are limited | L-0013 |
| DEC-35 | `forge-verified` means attributable to an account; a fourth trust assumption (agents never hold decision-makers' credentials) is observed, not assumed | L-0013 |
| DEC-36 | The `minimal` pack is pull-request native, with one human touch in the standard lane | L-0013 |
| DEC-37 | Continuing promises move to 0.1.x with defeaters and the ratchet; 0.1.0-alpha is the first internal slice | L-0013 |
| DEC-39 | **Tenet is a spec-driven development standard.** The spec process is the first value and ships first; evidence and decisions enforce it; spec tools feed the ladder | L-0014 |
| DEC-38 | Scope is frozen until the ready-for-pilot checklist holds; new ideas enter the catalog as `idea` | L-0013 |

## 8. Risks

| ID | Risk | Mitigation |
|---|---|---|
| RK-01 | The standard grows too large | Seven primitives; kernel budget of 8,000 tokens; scope freeze; new ideas are catalog `idea` entries |
| RK-02 | Hosts and forges change faster than bindings | Bindings versioned apart; stale ones marked unsupported |
| RK-03 | Auto-merged updates break a project | Structured classification; review below 1.0 |
| RK-04 | The name is taken | CP-0002 |
| RK-05 | People assume stronger guarantees than they have | Guarantee levels, observed trust assumptions, `doctor` |
| RK-06 | One steward | Time-boxed packets; ledger; open proposal process before 1.0 |
| RK-07 | Setup puts people off | `forge-verified` decisions need no hardware; readiness report names what is missing |
| RK-08 | LLM critics are biased | Checks first; activation test; incomplete reviews never converge |
| RK-09 | The problem is not the one adopters feel | Reconstruction exercise; external pilot before V-H1 |
| RK-10 | The trust model depends on forge features | Observed and shown; one forge first |
| RK-11 | Presence may not be provable from signatures | CP-0017 tests it |
| RK-12 | Declaring the factory pulls Tenet toward being a platform | Tenet validates, records and governs only |
| RK-13 | Factory platforms see no reason to conform | The Warp mapping (R-131) shows which advisory gates become enforced |
| RK-14 | The kernel is too abstract for users | Users see claim types by their own names (acceptance item, promise, health indicator); the generic words appear only in the kernel |
| RK-15 | Agents act through a decision-maker's forge session | Fourth trust assumption observed; bot identities; red-team case; `person-present` for high stakes |
| RK-16 | Specs grow without feedback from use | Ready-for-pilot checklist; spikes first; review running software |
| RK-17 | Trust mechanics crowd out the spec process again | The spec process is §4.0 and Part I's first section; it ships first; every review checks it |


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
