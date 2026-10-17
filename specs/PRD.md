# Tenet - Product Requirements Document

> v0.16 | October 15, 2026 | Approved for design (owner sign-off recorded, Section 8.4); implementation design in [`specs/tech-spec.md`](tech-spec.md)

## 0. About this document

**Single source of truth.** This document is the only binding Tenet product specification. Archived drafts, reviews, decision logs and prompt histories are informative history; nothing in them is binding unless it is restated here. Each fact has one home:

| Sections | Own |
|---|---|
| 1–2 | Vision, users, scope, support matrix, releases, reconciliation with the owner's original intent |
| 3 | Product surface, artifacts, experience model, domain model, extension architecture, roles |
| 4 | Requirements, operating limits, endpoint verdict policy, acceptance suites, definition of done |
| 5 | Assurance, security and integrity contracts |
| 6 | Evaluation and learning contracts |
| 7 | Configuration contract |
| 8–15 | Decisions and sign-off, failure conditions, readiness gates, implementation guidance, tensions, assumptions, critique, revision triggers |

Requirements state *what* in one line and point to the owning contract section for *how*. Other sections reference a fact instead of restating it. A contradiction inside this document is a defect to fix, not a choice for the implementer.

**Reading guide.**

| Reader | Read first |
|---|---|
| Product owner | 1, 2, 3.1–3.6, 4.5, 4.7, 8.3–8.4, 10 |
| Implementer | 3.7–3.9, 4.2–4.5, 5, 7, 11.4 |
| QA and evaluation | 4.4–4.7, 6 |
| Security reviewer | 5, 4.5, 9 |
| UX designer | 1.4, 3.1–3.6, 4.1, 6.8 |

**What this PRD freezes, and what it delegates.**

| Frozen here | Delegated to the Tech Spec | Delegated to the UX Spec |
|---|---|---|
| Qualification tuple and support claims; endpoint verdict policy; mandatory versus advisory controls; Git attribution and commit authority; shared-artifact trust and restriction semantics; execution-envelope rule; continuity guarantees; starter identity, data and exposure model; non-waivable release gates; workload and quality-claim scope | Record serialization, ownership and locking implementation, digest algorithms, helper packaging, module layout, adapter interfaces, caches, error types, recovery metadata (checklist in Section 11.4) | Command syntax, wording, progressive disclosure, contract preview layout, example confirmation, finding and evidence inspection, presentation of risky or irreversible choices |

The Tech Spec and UX Spec decide *how*; they may not redefine what "checked", "authorized", "safe" or "supported" means.

**Requirement format.** Each requirement has an ID, one positive "shall" statement (EARS style: *When / While / If <condition>, Tenet shall <response>*), a priority, a release and its acceptance suites. Compound requirements list sub-obligations that each have an observable acceptance case.

- **Priority:** **Must** (release blocks without it), **Should** (expected; omission needs owner sign-off), **Could** (include if cheap).
- **Release (cumulative):** **M0** walking skeleton ⊂ **A** core alpha ⊂ **B** beta ⊂ **R1** public release; then **R1.1** and **Later**.
- **Annotations:** [Validated: owner, date] for owner decisions; [Proposed: sign-off pending, Section 8.4] for recommendations awaiting the owner (none outstanding as of October 15); [Assumed: verify - owner, gate] for unverified beliefs; [Unknown: TBD] for open items.
- **Numbers** carry a class: **Invariant** (never relaxed), **Provisional** (alpha default, calibrated and frozen under Section 6.12) or **Frozen** (fixed for a qualification cycle). Numbers live only in Sections 1.6, 4.4 and 5.16.
- **Control claims** carry a mechanism class from Section 5.4; "shall enforce" is used only for preventive or deterministic mechanisms.

---

## 1. Outcome Statement

### 1.1 Product overview

**Tenet turns high-level human intent into delivered, operated and evolving software through a governed, personalized, continuously improving engineering practice.** It combines engineering best practice, specialized roles, model flexibility, intent governance and measured learning, so people can build many kinds of software without manually coordinating an AI engineering team.

**Tenet for Copilot is the first deliverable, not the boundary of the vision.** It is an open-source plugin for the Copilot environment the user already uses. The user installs it once and describes a task. Tenet clarifies what matters, agrees concrete examples, plans increments, builds test-first, reviews independently, reports honest evidence and remembers the project's intent for the next change. The software remains an ordinary project, maintainable without Tenet.

**Naming:** Tenet is the product name; "software factory" describes the concept. [Validated: owner, October 14.] Repository, package and marketplace identifiers are confirmed under Q-13 before publication.

**First product form:** a native plugin comparable in installation and packaging to pstack (a Cursor plugin that bundles a setup command and a main workflow), not a new harness, IDE or background service. **Long-term boundary:** the practice extends across hosts, models, software families and lifecycle stages through the extension architecture in Section 3.8; that architecture is a hypothesis to prove, not evidence of broader support. [Validated: owner direction.] **Value proposition:** more useful, maintainable software per unit of human effort, elapsed time and model capacity. [Assumed: verify - evaluation owner through the pilot.]

### 1.2 Problem statement

**The gap Tenet addresses is between asking an AI to write code and reliably evolving useful software.**

A user can get substantial implementation from a prompt, yet still acts as product manager, architect, engineering lead and test coordinator. They decide what to clarify, supply forgotten constraints, notice scope drift, arrange reviews, question convincing completion reports and rebuild context each session. The burden compounds across changes: the next feature contradicts an earlier decision, a fix weakens an invariant, or a new session loses the reasons behind the design. The unit of value is a project that becomes more useful without becoming harder to understand.

| User problem | Consequence | What Tenet changes |
|---|---|---|
| The solution is built before the need is understood | Plausible software solves the wrong problem | Clarify value, users and exclusions; confirm concrete examples and invariants before building |
| Large asks arrive as one blob | Unbounded work, no visible progress | Decompose intent into an ordered, editable plan of checkable increments |
| Context lives in chats and the user's memory | Repeated explanation and conflicting decisions | Keep project intent, plan and decisions as readable files in the repository |
| Quality depends on the user's prompting discipline | Research, tests and independent challenge get skipped | Make a proportionate test-first, reviewed workflow the default |
| Confidence is mistaken for completion | Demos, mocks or narrow tests are reported as working | Apply one explicit verdict policy bound to the actual candidate |
| Multiple agents create coordination work | Overlapping edits and review ping-pong | Dispatch specialists selectively with clear contracts and finite budgets |
| Good practices are copied into repositories and go stale | Projects diverge; improvements need manual upkeep | Ship shared procedures centrally; keep project decisions in the project |
| Long tasks stall on host iteration limits | The user babysits "continue" prompts | Checkpoint at boundaries so continuing resumes from saved state |

**Discovery evidence.** The owner's own Copilot prompt history (1,693 prompts across 11 projects, July 2025 to February 2026) was analyzed locally by exact-string counting; the script and raw history stay private. It shows:
- 219 prompts (about 13%) were "Continue to iterate?" confirmations.
- Repeated session openers asked the agent to re-read the PRD, tech spec and status notes before resuming work.

This supports the continuity and iteration-friction rows for one experienced user only. It does not establish prevalence; Section 6.6 and the discovery interviews in Section 11.2 test that. Publishing these aggregates in a public repository requires owner consent (Q-15).

### 1.3 Vision and mission

**Vision:** enable people and organizations at every level of expertise to turn high-level needs into valuable, secure, reliable, maintainable and scalable software, through a personalized, governed, multi-agent engineering practice that learns from delivery and operation and makes increasingly effective use of the best available models and resources.

**Mission:** turn proven software engineering practice into an accessible, measurable loop: understand the problem, manage intent, design, implement, verify, deliver, observe real outcomes, and improve both the software and the way it is built.

The vision covers individuals and teams; new and existing systems; applications, services, libraries, developer tools, data and ML, and infrastructure; and the lifecycle from discovery through operation and retirement. It is not confined to one IDE, provider, language or deployment target.

Five pillars define the ambition. [Validated: owner's five pillars, October 14.]

| Pillar | Intended end state | How the loop creates value |
|---|---|---|
| Engineering best practices, personalized | Needs become clear outcomes and well-engineered delivery | Apply discovery, examples, design, TDD, review, security and operations practices at the right depth; adapt to the user and project |
| Active governance and intent stewardship | Intent and decisions actively steer execution | Trace intent to work, checks and outcomes; detect drift; stop when authority or evidence is missing |
| Outcome-driven self-improvement | Evidence improves the app, workflows, prompts and model choices | Bounded experiments with frozen criteria; keep proven gains, reject regressions |
| Excellent code and system quality | Understandable, minimal, modular, testable software fit for its declared workload | A living engineering charter, TDD, reuse, clear boundaries, measured performance |
| Flexible specialists, models and capacity | Roles use suitable models and tools at justified cost | Roles are responsibilities; models are matched by qualification, evidence and cost |

### 1.4 Users and personas

**R1 primary user:** a technical builder or maintainer who runs local projects, uses Git, can read a change brief and make product decisions, and has no orchestration expertise. [Validated: owner sign-off, October 15.]

**Less-technical builders move to R1.1** (D-22), together with the delivery recipe, a guided prerequisite journey and the teaching style. In R1 they are not a qualified audience: R1 needs Node.js, Git and terminal commands, and their realistic alternatives deploy hosted apps instantly (Section 1.5).

| Persona | Job to be done | Needs | Release |
|---|---|---|---|
| Technical builder / maintainer | Build and evolve several projects without re-coordinating process | Fast start, respect for conventions, credible checks, Git-native flow | **R1 primary** |
| Reviewer / team lead (individual use) | Get a consistent spec or change review | Review-only mode, numbered findings, PR briefs | R1 |
| Tenet contributor | Improve a recipe, role or host binding | Contribution contract, conformance fixtures, review | R1 |
| Less-technical builder | Turn a concrete need into a small working app and understand its limits | Plain language, examples, demo-based evidence, prerequisite guidance, hosted delivery | R1.1 |
| Learner / student | Build while learning why | Teaching explanations of decisions and tests | R1.1 |
| Library / CLI author | Ship a package with stable API | API contract checks, semver discipline | R1.1 (second family; TypeScript library/CLI is exercised as a brownfield fixture in R1) |
| Python developer | Same loop in a second ecosystem | Python adapter (pytest, ruff, mypy, pip-audit) | R1.1 (D-24) |
| Data / ML practitioner | Pipelines and notebooks with reproducible results | Data-contract and reproducibility checks | R2 |
| Infra / ops engineer | Change infrastructure safely | Plan-only IaC checks, drift detection | R2 |
| Team (shared repo) | Several people steering one project | Shared intent in repo, owner-based authority, conflict handling | Later |
| Enterprise developer under policy | Use Tenet inside organizational controls | Policy-respecting behavior, no egress surprises | Later |

**Different people get different support, never different truth standards.**
- Interaction style (Guided, Balanced, Concise) and workflow depth (Quick, Standard, Deep) are independent. Depth follows the risk of the change, never the user's seniority (Section 3.6).
- **A user is never the hidden security expert.** For a material choice, Tenet states the concrete consequence, its recommendation, what can change later, and when qualified human expertise is needed. "The user confirmed" is not evidence of understanding; comprehension is measured (Section 6.8).
- **Questions are typed.** Avoidable repeated intake is friction to remove. Necessary clarification, fresh authority and reconfirmation after a material change are not friction and are never optimized away.
- **High-risk domains have a claim boundary.** Tenet can assist with regulated, safety-critical, clinical or financial-transaction software, but its verdicts cover software checks only; it states that qualified human expertise is required (SEC-16, X-12).

### 1.5 Competitive landscape and differentiation

Comparison is a set of hypotheses from public descriptions; capabilities change quickly and none has been evaluated. Discovery (Section 11.2) tests the positioning.

| Alternative | What it offers | What Tenet borrows | Tenet's hypothesized wedge |
|---|---|---|---|
| Native Copilot plus a good `AGENTS.md` | Zero install, strong models, native agents, memory and planning features | Host-native execution | Durable intent-to-evidence continuity; explicit verdict policy |
| Claude Code (plugins, skills, subagents, hooks) | Closest architectural analogue in another host | Skill and plugin packaging | Same portable core could target it later; not an R1 host |
| GitHub Spec Kit | Spec-driven workflow templates | Spec-first discipline | Living intent and plan; evidence bound to candidates |
| Kiro | Spec-driven IDE with requirements, design and tasks | Requirements-to-task traceability | Runs inside the user's existing host |
| obra/superpowers | Skills for brainstorming, planning and TDD | Skill-based process packaging; TDD rigor | Governance, assurance labels and cross-session intent |
| BMAD-METHOD, Agent OS | Role-based methods and planning documents | Role catalogs | Proportionate depth; finite budgets; independent review by default |
| pstack (Cursor) | Plugin with setup and a main workflow | Installation and workflow shape | Copilot-first; intent and evidence model |
| GitHub Spark, Lovable, Bolt, Replit Agent | Hosted app building for non-technical users with instant deployment | Demo-first evidence | Not an R1 competitor; relevant to the R1.1 less-technical persona |
| Autonomous agents (Copilot coding agent, OpenHands, Devin-style) | Background task execution | Clear task contracts | User-steered, local-first; no unattended production claims |

**Positioning hypothesis:** relative to native Copilot plus a good instruction file, Tenet earns adoption through maintained intent-to-evidence continuity and useful workflow defaults, not more prompts. If a host ships an equivalent capability, Tenet adopts it and retires duplicate logic.

### 1.6 Goals, north star and targets

**North-star metric:** *accepted outcomes per active human hour*, reported with its denominator and all failed or cancelled work. An **outcome** is one user-valued result defined before measurement (one pilot task is one outcome, however many contracts Tenet creates), so splitting work cannot inflate the metric.

**Guardrails (any breach blocks a value claim):** zero false checked verdicts on the fixtures; no observed increase in escaped defects within the evaluated sample; overhead within the evaluated comparison targets below.

| Goal | First-release objective | Target | Class | Evidence |
|---|---|---|---|---|
| Easy adoption | First useful outcome without orchestration expertise | Install to engaged ≤ 5 min; first useful outcome ≤ 15 min median on a ready fixture | Provisional | AC-01, AC-02, AC-21 |
| Right outcome | Misreadings caught before building | Pilot users detect ≥ 70% of seeded consequential misinterpretations at example confirmation | Provisional | AC-24 |
| Reliable completion | Contracts finish within budget | First-run contract success within declared budget ≥ 70% on golden tasks | Provisional | AC-26, AC-28 |
| Less supervision | Less active human coordination than a competent native baseline | ≥ 30% fewer active human minutes per accepted outcome (decision rule in Section 6.6.4) | Provisional | AC-12 |
| Credible completion | Missing or failed evidence always surfaced | 0 false checked-local verdicts on all seeded fixtures across all runs | Invariant | AC-07, AC-27 |
| Easier next change | Intent survives sessions and human edits | Resume ≤ 2 min; 0 unnecessary repeated questions | Provisional | AC-08 |
| Effective review | Independent review finds material defects without noise | Recall ≥ 80% of seeded material defects; each critical seeded defect found in ≥ 4 of 5 runs; precision ≥ 70% | Provisional | AC-06 |
| Low false friction | Clean tasks are not over-processed | On clean fixtures: unnecessary Deep ≤ 10%, wrongly blocked work ≤ 5%, duplicate approvals 0; Tenet-caused host approval prompts ≤ 3 per Standard task (SP-12) | Provisional (duplicate approvals: Invariant) | AC-21 |
| Operational governance | Intent traced through actions and checks | 100% of contracts linked to intent IDs; seeded drift detected | Invariant | AC-13a |
| Engineering quality | Charter and TDD applied without needless abstraction | Starter passes its fitness functions and applicable ASVS 5.0 Level 1 requirements | Provisional | AC-05, AC-20 |
| Measured learning | One evaluated maintainer improvement cycle | One documented keep, discard or inconclusive decision | Invariant | AC-14 |
| Efficient resource use | Overhead bounded and visible | Evaluated AI credits per accepted outcome vs a matched native baseline, with failed and cancelled runs included: Quick ≤ 1.3x, Standard ≤ 2x (premium requests instead, for accounts still billed by request) | Provisional | AC-12, AC-19 |

[Assumed: verify - owner; provisional targets per D-13, calibrated under Section 6.12.] Instruction length, test count, agent count, tokens and lines of code are diagnostics, never objectives. Saving time by skipping required checks is not success. Zero observed failures on fixtures is a release condition, not proof of zero real-world risk.

**First value moment:** the user presents a task; Tenet establishes only the readiness it needs, resolves consequential ambiguity, and returns a checked result or an actionable diagnosis the user understands. Investigation, clarification or a justified no-change recommendation counts when it meets the need.

**Non-goals:** maximizing agent count, code volume, model use or autonomy for its own sake; eliminating human judgment; guaranteeing business success; claiming universal correctness.

### 1.7 Why plugin-first

| Approach | Offers | Why it is not the starting point |
|---|---|---|
| Prompt collection or template | Simple, inspectable instructions | Users still assemble the workflow and copy updates |
| Standalone factory (SDK workers, custom engine) | Full control of scheduling and state | Duplicates the harness; heavy install, security and maintenance before value is proven |
| Dedicated IDE or extension | Custom UI | Another surface to maintain; reconsider only for a proven experience gap |
| **Native plugin with portable skills, specialist agents and minimal tested helpers** | Reuses chat, models, agents, permissions and installation | **Selected**; accepts host capability limits and states them honestly |

[Validated: owner request to reuse harness capabilities and ship plug-and-play.] Tenet contributes method and continuity; the host supplies execution; project tools supply builds and tests; repository and CI controls supply stronger publication boundaries. A user-disableable plugin cannot enforce every action, so each control states its mechanism class (Section 5.4) and assurance level (Section 5.3.4).

### 1.8 Product principles

1. **Host-native first:** reuse execution, permissions and UI.
2. **One entry point:** describe work immediately; setup and specialists appear when needed.
3. **Intent before activity:** preserve purpose, constraints, decisions, plan and pivots.
4. **An explicit acceptance basis:** confirmed examples plus invariants, commitments and quality obligations (Section 4.5.1).
5. **Smallest sufficient workflow:** depth scales with the risk of the change.
6. **Evidence before confidence:** one verdict policy (Section 4.5) distinguishes executed checks, review judgment and unverified claims.
7. **Honest mechanisms:** instructions guide; only tested host, helper or repository controls enforce.
8. **Never surprise the user's working tree:** human edits are never committed, reverted or discarded implicitly.
9. **Shared practice, project ownership:** update procedures centrally; never overwrite project decisions or source.
10. **Bounded learning:** prefer proven checks and evaluated changes over accumulating rules.

**Default engineering charter:** less unnecessary code; behavioral TDD (red, green, refactor); clear modular boundaries; reuse over duplication; simple designs over speculative abstraction; explicit errors; type safety where available; security and accessibility by default; performance and scale appropriate to declared workloads. "Less code" never justifies unreadable compression; "scalable" never justifies premature distributed infrastructure.

---

## 2. Scope

### 2.1 IN scope for R1

[Validated: owner sign-off, October 15.]

| ID | Capability | R1 boundary | Requirements |
|---|---|---|---|
| S-01 | Native plugin distribution | Public source, versioned plugin, one qualified install path, update and removal | INS, LFC, OSS |
| S-02 | Task-first onboarding | Task accepted before setup; incremental readiness; stated assistance level | INS, WRK-05 |
| S-03 | New and existing projects | One TypeScript web/API starter; brownfield work on projects meeting the capability profile (Section 2.3); source inspection for any language | WRK, QLT |
| S-04 | Intent, plan and acceptance basis | `INTENT.md`, plan items, decision records, examples and invariants, change-controlled acceptance tests | INT |
| S-05 | Specialists | Fresh-context native Reviewer and parallel read-only Researchers; focused passes for small work | AGT, REV |
| S-06 | Test-first implementation and evidence | Distinguishing reproduction, candidate-bound receipts, explicit verdict policy | TDD, EVD, Section 4.5 |
| S-07 | Git-native workflow | Attributable checkpoints, local integration, unit undo, PR brief on request | GIT, Section 5.12 |
| S-08 | Continuity | Repository memory, local operational state, resume and reconciliation | CON, Section 5.14 |
| S-09 | Governance and safety | Mechanism classes, authority envelope, shared-artifact trust, execution envelopes, threat controls | SEC, Section 5 |
| S-10 | Configuration and personalization | Twelve-setting catalog in ordinary language; explain and reset | CFG, Section 7 |
| S-11 | Learning | Scoped project lessons; one maintainer improvement cycle | LRN, ENG-08 |
| S-12 | Tenet engineering quality | Portable skills, capability model, tiered eval harness, secure CI, release verification chain | ENG |

### 2.2 Qualification tuple and support matrix

A **support claim** applies to one exact **qualification tuple**:

> VS Code version + Copilot Chat extension version + named agent harness + plugin format version + install path + relevant feature settings + Copilot plan and organization-policy profile + OS version and architecture + execution target + workspace mode + recipe and toolchain versions.

Capability descriptors (Section 3.8.2) describe mechanisms; only passing qualification on a tuple produces a "supported" label. The published matrix lists exact tuples, Tenet version, last evaluation date, observed model (or "unknown"), known degraded conditions and the requalification owner.

**Proposed R1 tuple** [Assumed: verify - technical maintainer under Q-01 and SP-01, SP-02, SP-08 before Tech Spec approval]:

| Dimension | Supported in R1 | Experimental | Unsupported in R1 |
|---|---|---|---|
| Host application | VS Code stable desktop, exact versions listed at qualification | VS Code Insiders | Browser VS Code, Codespaces web |
| Harness | VS Code **Local** agent harness (execution tied to the editor window) with custom agents, subagents and skills | Copilot harness (Agent Host); Copilot CLI | Copilot cloud coding agent |
| Install path | One qualified path (source or marketplace, chosen under SP-01) | The other path | Manual file copying |
| Plan and policy | Copilot plans and organization policies that allow agent mode, plugins, custom agents and subagents | Plans with small AI-credit allowances, or low premium-request allowances on legacy request billing (Conserve recommended) | Policies disabling required features (reported as blocked by policy) |
| OS / architecture | macOS arm64 | Linux x64, Windows x64 | WSL, other architectures |
| Execution target | Local machine | Dev containers | SSH remote, cloud sessions |
| Workspace | Single-folder workspace, single Git repository, ≤ 10,000 tracked files | Monorepo with one declared module root; linked Git worktrees | Multi-root workspaces; multi-repository work |
| Software | TypeScript starter; TypeScript brownfield meeting Section 2.3 | JavaScript-only brownfield; source inspection in other languages | Checked implementation outside the TypeScript recipe |

**Lifecycle events are distinct** and each has defined behavior in Section 5.14: closing a chat, closing the editor window, quitting VS Code, the agent host stopping or crashing, and losing the model or network connection.

Each combination is supported, experimental, unsupported or blocked by policy. The README publishes the matrix before installation. An experimental combination lists smoke tests passed, unsupported actions, risks, maintainer and review date.

### 2.3 Software support and assistance levels

**Starter recipe:** TypeScript web/API application: a Fastify 5 HTTP API with Zod schemas, better-sqlite3 persistence with plain numbered SQL migrations, React with Vite, Vitest for unit and integration tests, Playwright for end-to-end journeys, ESLint and the TypeScript compiler for static checks. It matches the stack the owner uses most and needs no external accounts. Its identity, exposure, data and workload model is in Section 5.16. [Validated: owner, October 15 (Q-12).]

**Brownfield capability profile (R1):**

| Dimension | Supported | Experimental | Investigation or review only |
|---|---|---|---|
| Runtime | Node.js active and maintenance LTS lines at qualification (currently 22 and 24) | Current (non-LTS) Node | Other runtimes, end-of-life Node lines |
| Language | TypeScript (strict or not) | JavaScript without TypeScript | Mixed-language repositories outside the module root |
| Package manager | npm, pnpm, Yarn 1 with committed lockfile | Yarn 2+ without Plug'n'Play | Yarn Plug'n'Play; no lockfile (readiness proposal instead) |
| Module system | ESM and CommonJS | TypeScript project references | Custom loaders |
| Test runners | Vitest, Jest, Playwright | Mocha, node:test | Others |
| Repository shape | Single package | Workspaces with one declared module root | Multiple roots |
| Test dependencies | Local files and SQLite | Docker Compose services under a declared execution envelope (Section 5.8) | Shared or remote databases and services |
| Generated code | Committed or reproducibly generated by a discovered command | Other generators | Undiscoverable generation |

A detector recognizing a project is not proof the adapter supports it; eligibility is established by readiness probes.

**Assistance levels.** For every project and task, Tenet states one level up front (INS-12):

| Level | Tenet can | Highest endpoint |
|---|---|---|
| L0 Refuse | Explain why a required boundary cannot be met | blocked |
| L1 Inspect | Read, explain, review source | findings-only |
| L2 Plan | Propose requirements, plan items and a readiness task | findings-only |
| L3 Implement, unqualified | Implement and run available checks outside the qualified profile | implemented-unverified |
| L4 Qualified local | Implement inside the qualified profile with full evidence | checked-local |
| L5 Deliver | Deploy through a qualified delivery recipe | delivered (R1.1) |

Source inspection is available for any language; its review findings are qualified only for the TypeScript and JavaScript profile.

### 2.4 OUT of scope

| ID | Exclusion | Reason | Reconsider when |
|---|---|---|---|
| X-01 | Standalone engine, daemon, database server, worker fleet, custom IDE or dashboard | Rebuilds host capabilities; raises adoption cost | Real usage shows a host gap a small extension cannot close |
| X-02 | SDK orchestration or direct Claude/Codex runtime adapters | R1 extends the active host | A separately approved expansion proves value and containment |
| X-03 | Multi-subscription broker, account-wide quota enforcement | No account visibility through a plugin | Hosts expose permitted usage APIs |
| X-04 | Always-on monitoring, unattended repair, cloud scheduling | Execution lifetime belongs to the host | Qualified native automation supports a bounded opt-in journey |
| X-05 | Remote merge, publication, provisioning or production deployment in R1 | Consequential effects need trusted external controls | R1.1 delivery recipe passes Section 5.3.4 delivery tests |
| X-06 | Equal support for every family, model, OS or host | Compatibility is maintenance work | Each combination passes its campaign |
| X-07 | Unattended self-modification or automatic promotion in R1 | Needs a qualified low-risk envelope | Section 6.10.3 entry criteria are met |
| X-08 | Runtime third-party plugin loading, hosted marketplace, team tenancy | Not needed for one open-source package | Independent demand appears |
| X-09 | Universal sandboxing, tamper-proof audit, exactly-once effects | Requires infrastructure beyond a plugin | An external control supplies the property |
| X-10 | Parallel writing agents in R1 | Needs isolation, ownership and integration checks | Serial-versus-parallel benefit is proven under AC-22 |
| X-11 | Checked implementation in non-Git folders (snapshot-backed prototypes are the one exception, GIT-01) | Git gives reliable recovery cheaply (D-11) | Evidence that target users cannot adopt Git |
| X-12 | Verdicts implying fitness for regulated, safety-critical, clinical or financial-transaction use | Software checks cannot establish domain safety | Domain-specific qualification with accountable experts |
| X-13 | Less-technical builders as a qualified R1 audience | Prerequisites and local-only delivery do not fit them (D-22) | R1.1 prerequisite journey and delivery recipe |

### 2.5 Adjacent capabilities

| In scope | Adjacent, excluded | Boundary |
|---|---|---|
| Guided installation | Bypassing trust prompts or policy | Native consent remains |
| Shared plugin updates | Rewriting existing applications | Application changes, including recipe upgrades, are ordinary work items |
| Handoff and resume | Computation after host closure | Resume reconstructs; it does not run in the background |
| Independent review and checks | A tamper-proof verifier service | Report actual assurance; protected CI for stronger claims |
| Model preferences | Entitlement to unrelated subscriptions | The host and account decide access and billing |
| Local integration of finished work | Pushing, remote merging or opening PRs without being asked | Remote effects need an explicit request |

### 2.6 Release progression

Releases are cumulative. A requirement's release tag in Section 4.2 is its only scheduling home.

| Stage | Purpose | Exit gate |
|---|---|---|
| **M0 walking skeleton** | Prove the contracts compose: intake → acceptance basis → authority → distinguishing red → green → fresh-context review → verdict → interruption → recovery, on the starter fixture and one brownfield fixture, with one injected failure | All requirements tagged M0 pass their suites on the supported tuple; alpha uses only public, synthetic or the owner's own consenting projects |
| **Core alpha (A)** | Complete core loop: planning, specialists, evidence, Git attribution, shared-artifact trust, eval harness with 10 golden tasks | All Must requirements tagged M0 or A pass |
| **Beta (B)** | Hardening: continuity matrix, storage, lifecycle, configuration explain and reset, fault, privacy and compatibility suites; budgets calibrated and frozen | All Must requirements tagged up to B pass; Section 6.12 calibration complete |
| **Public R1** | Starter quality baseline, documentation and OSS readiness, pilot, one maintainer improvement cycle, 30 golden tasks | Section 4.7 definition of done |
| **R1.1** | Less-technical persona with prerequisite journey, Guided-first experience and delivery recipe; CLI/library family; Python adapter; teaching style; personal practice library; Copilot CLI host | Each item passes its own suites |
| **Later** | Other hosts and families; team workflows; operational feedback import; ranked model portfolios; quota-aware accounting; automatic improvement promotion; guarded preventive gates | Entry conditions in Section 2.8 |

Later items carry no dates and cannot introduce a required service without revising this PRD.

### 2.7 Owner-intent reconciliation

The owner's original decisions (decision log and owner interview, held privately) are reconciled here; this table, not the archive, is binding. [Validated: owner sign-off, October 15.]

| Original owner decision | R1 disposition | Returns when | Reason |
|---|---|---|---|
| Build apps, features, fixes and improvements from high-level requirements | Core, including plan decomposition | n/a | Core loop |
| Clarify, specify, design, implement test-first, validate strictly | Core, with an explicit acceptance basis and verdict policy | n/a | Core loop |
| Deploy automatically | Deferred to the R1.1 delivery recipe (user-triggered CI deploy to one target; the owner's Azure is the first candidate) | R1.1 | Production effects need external controls and credentials the plugin does not hold |
| Specialized parallel agents with an orchestrator | Parallel read-only agents and a fresh-context Reviewer; serial writing | Parallel writing when AC-22 shows a benefit | Overwrite risk (owner decision D3) |
| Feedback, bugs and periodic operational analysis trigger work | Feedback and bugs in core; `/tenet feedback`; operational import later | Later | No always-on service |
| Persist triggers, decisions and actions for postmortems | Core (decision records, traces, effect records) | n/a | Governance pillar |
| Role-based models (Opus-class architect, Sonnet-class developer) | Active qualified model in core; ranked portfolios later | Later, after SP-04 | Model resolution must be observable |
| Monitor subscriptions, 100% utilization ceiling | Count reporting in core; quota-aware accounting later; ceiling meaning open under Q-11 | Later | No account-wide usage interface |
| Single operator, many systems, portfolio registry | Per-project memory in core; personal practice library in R1.1 | R1.1 | Cross-project sharing needs explicit scope |
| Self-improving configs; skills auto-promote on eval wins | Maintainer-run evaluated improvement in R1; automatic promotion later | Later (Section 6.10.3) | Promotion needs protected criteria and repeatability evidence |
| Policy-as-code autonomy with promotion after clean runs | Mechanism classes, depth floors and verdict policy in core; autonomy promotion later | Later | Same as above |
| Approved stacks and safe-library constraints | Recipe stack plus dependency checks (SEC-05) and `dependency_policy` | n/a | Supply-chain risk |
| Hard guardrails and budget ceilings | Core, with honest mechanism classes (Section 5.4) | n/a | Robustness |

### 2.8 Vision coverage and entry conditions

| Vision capability | R1 realization | Entry condition to expand |
|---|---|---|
| Requirements to delivered software | Checked-local starter and brownfield changes; plan decomposition | R1.1 delivery recipe: authorized target, artifact-bound real journey, rollback owner |
| Parallel multi-agent work | Parallel read-only research and review | Isolation, ownership and integration checks; measured benefit over serial |
| Per-role models | Active qualified model | SP-04 proves observable model resolution |
| Active intent governance | Living intent, plan, traceability, drift detection | Team roles and conflict semantics for team use |
| Preventive guardrails | Native denial, deterministic helper checks, assurance labels | SP-03 proves hook-based prevention |
| Strict independent validation | Fresh-context review, change-controlled tests, tamper detection, protected CI evidence when present | Sealed holdouts under protected CI |
| Operational feedback | User-supplied reports | Qualified data lifecycle and a demonstrated need |
| Subscription optimization | Count reporting, finite budgets | Permitted usage APIs |
| Autoresearch-like improvement | Maintainer experiment, scoped lessons | Section 6.10.3 criteria |
| Broad software and users | One family in TypeScript, one primary persona | Each family, ecosystem or persona passes extension conformance (Section 3.8.6) with a maintenance owner |

---

## 3. Product Definition

### 3.1 Entry points

Names are proposals; the UX Spec selects final syntax per host. [Assumed: verify - UX owner before UX Spec approval.] Tenet requires the host's agent mode; invoked from another chat mode, it explains how to switch.

| Entry point | Purpose | Creates files? |
|---|---|---|
| `/tenet <task>` | Main workflow: feature, bug, refactor, investigation, prototype, plan or continuation | Only when implementation or durable memory is needed |
| `/tenet review [scope]` | Review-only critique of a spec, diff, branch or files | No files in the project, including `.tenet/` (CON-09) |
| `/tenet status` | Current work, plan progress, phase, evidence, blockers, budgets | No |
| `/tenet why [topic]` | Explain an effective setting, decision, verdict, assurance level or assistance level | No |
| `/tenet setup` | Optional: adopt shared memory, set preferences, inspect readiness | Only with preview and consent |
| `/tenet feedback` | Produce a redacted, previewable report the user can attach to an issue | Only a report file the user chooses to save |
| `/tenet help` | Capabilities, limits, installed version and source, examples | No |

In-conversation steering works in ordinary language: "pause", "cancel", "undo that", "integrate it", "what's next?", "fix findings 2 and 4", "be more concise", "always use pnpm in this project".

### 3.2 Project artifacts

| Artifact | Location | Shared? | Contents | Owner |
|---|---|---|---|---|
| Intent and plan | `INTENT.md` at the repository root, or sections of existing planning documents the user designates (INT-13); split into `docs/intent/<area>.md` with an index once it outgrows the context budget | Shared after one-time adoption | Purpose and value, users, outcomes, requirements with examples and invariants, constraints, non-goals, assumptions, deferred choices, plan items | User; Tenet proposes edits |
| Decisions | `docs/decisions/` in MADR format, file names beginning with the decision ID | Shared after adoption | Context, options, decision, consequences, status, links | User; Tenet drafts |
| Architecture | `docs/architecture.md` | Shared after adoption | Current components, data model, integration points | Tenet maintains; user approves |
| Hardening inventory | `docs/hardening.md` (starter and prototypes) | Shared (ordinary source) | What must change before shared, networked or production use | Tenet maintains |
| Engineering charter | A Tenet section in the instruction file the host already loads (`AGENTS.md` or `.github/copilot-instructions.md`), never both | Shared after adoption | Project principles and conventions | User |
| Adopted project policy | A readable policy file adopted with shared memory (format chosen in the Tech Spec) | Shared after adoption | Project commitments from the Section 7.3 catalog | User (Section 7.1) |
| Acceptance tests | Project test directories, following conventions | Shared (ordinary source) | Executable form of the acceptance basis, tagged with requirement and example IDs | Change-controlled after lock (INT-06) |
| Operational state | `.tenet/` at the workspace root (CON-02) | Local only | Work contracts, effect records, evidence receipts, lock manifest, traces, handoffs, capability cache, lessons, local settings, snapshot blobs | Tenet |
| Personal preferences | Host user-level storage (SP-02) | Personal | Style, checkpoints, personal defaults | User |

Before adoption, durable memory stays in `.tenet/`. At the end of the first successful increment, or whenever the user asks, Tenet shows a one-screen preview of the proposed shared files and asks once whether to add them. If the repository's remote is public, the preview warns that intent and decisions become public. Declining keeps everything local and is remembered. If a file of the same name already exists and was not created by Tenet, Tenet proposes using or extending it and never overwrites it.

### 3.3 Core artifacts users see

**Work contract** (shown concisely before Standard or Deep implementation; recorded for every implementation; values are examples):

```text
Work W-0007 · Standard · branch tenet/w-0007-overdue-reminders (from main @ 4e1c2a9)
Outcome    Borrowers with items overdue by more than one day see a reminder on their dashboard.
Basis      REQ-012-q7k (new), REQ-003-m2d (loans), CNS-002-x4p (no external messaging yet)
Examples   EX-012-q7k.1 overdue 2 days → reminder shown            (distinguishing)
           EX-012-q7k.2 due today → no reminder                    (preservation)
           EX-012-q7k.3 returned late → reminder cleared           (boundary)
Invariant  A reminder never reveals another borrower's identity
Accepted   ASM-014-c9t "overdue" uses the server's local timezone for now (expires at next plan review)
Scope      server/loans/*, web/dashboard/*; protected: server/auth/*
Checks     unit + integration (Vitest), e2e dashboard journey (Playwright), lint, types
Envelope   local files, temporary SQLite test database, Tenet-started server on a free port; no network
Budget     3 attempts · 2 review rounds · 6 delegations
Endpoint   checked-local · assistance level L4
```

**Result report:**

```text
Done: overdue reminders work locally (checked-local).
Try it: npm run dev → sign in with the development account printed at startup → Dashboard.

Checked   EX-012-q7k.1 failed on baseline, passes on candidate
          EX-012-q7k.2, .3 and the privacy invariant pass on baseline and candidate (as expected)
          Full suite 148 pass · lint clean · types clean · e2e dashboard pass (receipts in /tenet status)
Review    Fresh-context reviewer. Behavior ✓ Structure ✓. FND-1 (major) fixed and verified; FND-2 (minor) deferred
Limits    Timezone follows accepted assumption ASM-014-c9t
Next      Integrate into main? · "what's next?" shows plan item PLN-004-h2v
```

**Status:** current work and lifecycle state, plan progress, last valid phase, evidence freshness, open findings with severity, effect records not yet observed, budgets used and remaining, assistance level, next action.

### 3.4 Steering and interruption

| User action | Tenet behavior |
|---|---|
| Status, inspect, explain | Answers from current state with partial artifacts; does not restart or broaden scope |
| Refine or change direction | Applies in-scope refinements; records material amendments; asks only for new authority |
| Pause or park | Stops new dispatch at the next controllable boundary; saves a handoff; reports active effects |
| Cancel | Stops owned work; reports residue and unknown effects; does not roll back implicitly |
| Undo | Previews the inverse of the work's commits against current state; preserves later human edits; validates afterwards (Section 5.12) |
| Integrate | Integrates the accepted work branch into its base branch locally (GIT-11) |
| Decline a mandatory step ("skip the tests") | Proceeds only to an endpoint whose label reflects the missing evidence, stated once (WRK-13) |
| Resume, "what's next?", or "fix findings N and M" | Reconciles current source and authority; reuses valid evidence; proposes the next plan item or scopes only the named findings |

### 3.5 Example sessions

**J-02: new application (Balanced style, technical builder).**

```text
User   /tenet I lend out lab equipment and track it in a spreadsheet. Build a small app
       so people can see what's available and I know who has what.
Tenet  Assistance level L4 (TypeScript starter). This folder has no Git repository.
       Initialize one so every step can be undone? [Initialize] [Read-only] [Prototype]
User   Initialize
Tenet  Plan (edit freely):
       PLN-001 Items and availability · PLN-002 Reservations · PLN-003 Returns · PLN-004 Reminders
       Three choices change PLN-001/002 — my recommendation first:
       1. Overlapping reservations for one item? (Recommend: refused)
       2. Who sees borrower names? (Recommend: only the admin)
       3. When is a loan returned? (Recommend: when the admin marks it)
User   1 refused, 2 admin only, 3 yes
Tenet  Acceptance basis for PLN-002:
       • Ana reserves Microscope A Mon–Wed; Ben asks for Tue → refused, next free date shown
       • Ben asks for Thu → accepted
       • Two simultaneous requests for Tue → exactly one succeeds   (invariant)
       • A borrower never sees other borrowers' names              (invariant)
       Not in scope: email reminders, multiple admins. Confirm?
User   Confirm.
Tenet  ... Done (checked-local). Try it: npm run dev → http://127.0.0.1:5173.
       Development account and password are printed at startup (local use only, see docs/hardening.md).
       Save the app's purpose, plan and decisions as files in the project? [Preview]
```

**J-03: brownfield bug (Concise style).**

```text
User   /tenet Bug: the CSV export drops rows whose notes contain a newline.
Tenet  L4 · Quick. Working tree has 2 unrelated modified files; leaving them untouched.
       Repro export.test.ts "notes with newline": fails on main (2 of 3 rows).
       Cause csv/writer.ts:41 naive split → use existing csv-stringify. No API change.
Tenet  checked-local · branch tenet/w-0021-csv-newlines · 1 commit (your 2 files not included)
       Repro fail→pass · suite 412 pass · lint, types clean · focused review ✓ (no findings)
       Pre-existing, unchanged: 2 flaky e2e tests in upload.spec.ts (not in this contract's scope)
       Integrate into main?
```

**J-04: review, then targeted fixes.**

```text
User   /tenet review the auth changes on this branch
Tenet  Read-only review of 14 files at abc123 · no files written · no commands run.
       FND-1 blocker  Session token not rotated after password change (auth/session.ts:88)
       FND-2 major    No rate limit on /login
       FND-3 minor    Duplicate validation helper (lib/validate.ts already provides it)
       FND-4 major    Test "rejects expired token" asserts nothing (auth.test.ts:120)
User   fix 1 and 4
Tenet  Implementing FND-1 and FND-4 only (Standard). FND-2 and FND-3 stay open. ...
```

### 3.6 Experience model

Dimensions are disclosed progressively: users normally meet style and depth, and see the others when they matter.

| Dimension | Values | Who sets it | Affects |
|---|---|---|---|
| Style | Guided, Balanced (default), Concise | User, in words ("explain more", "be brief") | Presentation only |
| Checkpoints | Minimal, Milestones (default), Each phase | User | How often Tenet pauses to show progress or ask; never authority |
| Depth (lane) | Quick, Standard, Deep | Tenet recommends from the change's risk; user may raise it, or lower it to the Section 5.2 floor | Process rigor |
| Endpoint | checked-local, implemented-unverified, prototype, findings-only, blocked | The verdict policy (Section 4.5) | Result claim |
| Assistance level | L0–L5 (Section 2.3) | Project and capability profile | What Tenet may attempt |
| Assurance level | Advisory, Checked local, Guarded (optional), Externally gated (optional) | Observed capabilities | Strength of claims (Section 5.3.4) |
| Resource mode | Normal, Conserve, Serial | User setting | Optional overhead such as dispatch and parallelism |

These dimensions are set independently:
- More explanation never means more agents.
- Conserve and Serial never lower evidence floors; serial execution never means weaker evidence.
- Guided and Concise never change rigor.
- Deep never implies cross-family review.
- "Ask less" is not permission.

| Lane | Typical fit | Additional process beyond the Section 5.2 floors |
|---|---|---|
| Quick | Clear small fix, investigation, behavior-preserving refactor | Targeted checks; focused review pass; no contract preview |
| Standard | Bounded feature or bug with ordinary uncertainty | Acceptance basis, contract preview, fresh-context review |
| Deep | Consequential design, migration, access or compatibility change | Decision record, Architect and Security passes, threat and data note, full checks, mutation testing offered |

### 3.7 Domain model

#### 3.7.1 Entities

Project-level IDs use prefixes distinct from this document's own requirement and decision IDs.

| Entity | ID | Stored | Key fields | Links |
|---|---|---|---|---|
| Project | — | `.tenet/project` | Repository identity, root, recipe and version, traits, assistance level | Everything |
| Intent | — | `INTENT.md` | Purpose, users, outcomes, non-goals | Requirements, constraints |
| Plan item | `PLN-` | `INTENT.md` | Outcome, requirement links, dependencies, order, status | Requirements, work |
| Requirement | `REQ-` | `INTENT.md` | Statement, status, examples, invariants, source | Examples, tests, work, decisions |
| Example | `EX-<req>.n` | `INTENT.md`; test files | Given/When/Then, kind (distinguishing, preservation, boundary, negative), status, test reference | Requirement, acceptance test |
| Invariant | part of a requirement | `INTENT.md` | Property that must always hold | Requirement, tests |
| Constraint | `CNS-` | `INTENT.md` or adopted policy | Statement, owner, rationale | Work, checks |
| Assumption | `ASM-` | `INTENT.md` or `.tenet/` | Statement, risk, status, expiry | Work, decisions |
| Decision | `DEC-` | `docs/decisions/` | MADR fields, status | Requirements, constraints |
| Work contract | `W-####` (local) | `.tenet/work/` | Outcome, basis, scope, checks, envelopes, budget, endpoint, branch and base, pinned versions, state | Plan item, assignments, evidence |
| Authority grant | — | Work contract | Grantor, action classes, scope, expiry, source | Work |
| Effect record | — | Work contract | Action, class, intended, dispatched, observed result | Work |
| Assignment | — | `.tenet/work/<id>/` | Role, goal, baseline, context, permissions, budget, result | Work, findings |
| Candidate | — | Computed | Base commit, digest of relevant uncommitted and untracked files, lockfile, configuration, toolchain, envelope | Evidence |
| Check obligation | — | Adopted policy or recipe | Property checked, test population, configuration, tool, pass criteria, permitted alternatives | Required checks, evidence |
| Evidence receipt | — | `.tenet/work/<id>/evidence` | Check, verdict, qualifiers, freshness, source, candidate, envelope, execution receipt | Work, requirement |
| Lock manifest entry | — | `.tenet/locks` | Test identity, content hash, example IDs, verification record | Acceptance test |
| Finding | `FND-n` (per work) | `.tenet/work/<id>/` | Severity, location, evidence, disposition, decider | Work, assignment |
| Lesson | `LSN-` | `.tenet/lessons` | Statement, scope, evidence, provenance, expiry | Project |
| Trace event | — | `.tenet/traces` | Time, work, role, model, action, decision, outcome | Work |
| Config revision | — | `.tenet/config` | Values, sources, adoption state, revision | Work, evidence |
| Experiment | — | Tenet repository | Hypothesis, surfaces, baseline, criteria, results | Releases |

Exact schemas and paths belong to the Tech Spec (Section 11.4).

#### 3.7.2 Lifecycles

| Entity | States and transitions | Rules |
|---|---|---|
| Work contract | `proposed → authorized → executing → checking → finished`; holding or terminal: `blocked`, `parked`, `cancelled`, `superseded` | `blocked` and `parked` keep the last valid phase. A failed check returns `checking → executing` within budget. `finished` means the endpoint chosen by the verdict policy is reached |
| Plan item | `proposed → accepted → in-progress → done \| dropped \| superseded` | Only the user accepts or drops; `done` needs an accepted outcome |
| Requirement | `proposed → accepted → superseded \| withdrawn` | Only the user accepts. Superseding keeps history and links |
| Example | `proposed → confirmed → revised \| retired` | `confirmed` by the user, or recorded from an unambiguous request (INT-04). Revision needs user confirmation |
| Acceptance test | `drafted → verified → locked`; changes after lock: `locked → revised (disposition) → verified → locked` | `verified` records the expected result (distinguishing red then green, or preservation result). `locked` means change-controlled, not immutable (INT-06) |
| Assumption | `open → accepted-temporarily \| confirmed \| refuted \| converted-to-requirement` | Temporary acceptance needs the user and an expiry |
| Decision | `proposed → accepted → superseded \| deprecated` | MADR status values |
| Finding | `open → valid \| disputed`; `disputed → valid \| withdrawn`; `valid → fixed → verified`, or `valid → deferred \| risk-accepted \| wont-fix` | Who decides and which severities block: Section 4.5.3 |
| Evidence | verdict ∈ {pass, fail, inconclusive, skipped}; qualifiers ⊆ {flaky, simulated, partial, history-unavailable}; freshness ∈ {fresh, stale, superseded}; source ∈ {local, ci-external, ci-protected} | A relevant input change makes evidence stale; zero tests executed is `inconclusive` |
| Effect record | `intended → dispatched → observed-completed \| observed-failed \| unknown` | `dispatched` without observation after a crash is reconciled before any retry (CON-12) |
| Lesson | `observed → proposed → active → expired \| retired` | Activation needs explicit scope or user confirmation |
| Owner acceptance | `pending → accepted \| rejected \| accepted-with-residual-risk` | Independent of the verdict; cannot waive blocking items (Section 4.5.2) |
| Delivery | `not-attempted → pending → observed \| failed \| unknown` | R1 stays `not-attempted` |

#### 3.7.3 Identity and traceability rules

- **Branch-safe IDs.** Shared IDs combine a sequence number with a short random suffix (for example `REQ-012-q7k`), so two branches never allocate the same identity. At integration, Tenet still checks for identical IDs with different content and re-suffixes the newer item, updating its links. Users may refer to items by number when unambiguous.
- IDs are stable and never reused.
- Every Tenet-managed acceptance test carries the requirement and example IDs it implements.
- Every work contract lists the plan item, requirement, constraint and decision IDs it serves.
- Checkpoint commits carry configurable `Tenet-Work` and `Tenet-Req` trailers (GIT-03).
- Traceability is computed from links; Tenet maintains no separate matrix file.
- **Scope of coverage gaps.** A requirement with no linked acceptance test is a coverage gap. Existing tests without requirement links are preserved and reported as *unmapped*, not missing; Tenet never rewrites tests only to add IDs, and maps legacy behavior incrementally when a change touches it.

### 3.8 Extension architecture (product contracts)

These seams let the R1 wedge grow without rewrites. Each is a hypothesis until a second host, ecosystem or family passes extension conformance (Section 3.8.6).

#### 3.8.1 Portable core and thin host bindings

The core practice (procedures, role contracts, recipes, rubrics) ships in the open Agent Skills format (`SKILL.md` with resources). Host-specific pieces (custom agents, commands, hooks, manifests) are thin bindings that invoke the core. A new host aims to need only new bindings plus a qualification campaign; whether that holds is tested when the second host is added.

#### 3.8.2 Host capability model

Each host binding ships a declarative capability descriptor. Core logic queries capabilities and never branches on host names. Descriptors are verified by probes and feed the support matrix, but do not by themselves produce a "supported" label (Section 2.2).

| Capability | Example values |
|---|---|
| Harness and lifecycle | Local or Agent Host; behavior on chat close, window close, quit, host crash |
| Subagent dispatch | None, sequential, parallel; context isolation; per-agent tools and model; nested dispatch allowed or not |
| Hooks | Events available; can deny; fails closed on crash or timeout |
| Tool approval mode | Prompts required, auto-approve enabled, unknown |
| Model observability | Requested only, or resolved model and family observable |
| Usage signals | None, per-call, session, quota |
| Storage | User-level location; persistence across restart |
| Checkpoints | Native edit checkpoints available |
| Questions UI | Native multiple-choice questions available |
| Instruction loading | Which instruction files load ambiently; invoked-only fallback |

#### 3.8.3 Ecosystem adapters and evidence normalization

An adapter per ecosystem detects the build system and commands, runs tests, lint, type checks and audits, and normalizes results:

| Result | Standard format |
|---|---|
| Test results | JUnit XML or TAP |
| Static analysis and review findings | SARIF 2.1.0 |
| Coverage | Cobertura or LCOV |
| Dependency audit | OSV-compatible report |

**Evidence-normalization contract:**
- Every result keeps its execution receipt: command, working directory, exit and termination status, discovered, executed, passed, failed, skipped and focused counts, reporter and parser versions, and a bounded raw-output reference (EVD-12).
- A valid-looking report never overrides a failed, truncated or incomplete execution. Contradictory exit status and report content yield `inconclusive`.
- Report files from before the run are ignored; reports are bound to the run that produced them.
- Reports are untrusted input. Parsers enforce size and complexity limits, resolve no external entities or remote references, normalize paths inside the workspace and treat embedded text as data.
- Unsupported reporter versions, malformed or truncated reports and duplicate test identities fail explicitly to `inconclusive` or unsupported.
- Audits distinguish "no known vulnerabilities", "audit unavailable" and "audit incomplete".

R1 ships the Node/TypeScript adapter. A new ecosystem needs an adapter **plus** family-specific behavior, security, compatibility, packaging and maintenance qualification under Section 3.8.6.

#### 3.8.4 Trait-based quality model

Projects and changes carry **traits**. Each trait contributes clarifying questions, invariants, checks, review rubric items and optional specialists. Recipes are bundles of traits plus a stack binding.

| Trait | Contributes |
|---|---|
| `ui` | Empty, loading, success, error, invalid-input, repeated-submission and permission-denied states; keyboard focus; scoped WCAG 2.2 AA journeys; screenshots of confirmed examples as evidence; Designer role |
| `persistence` | Invariants as constraints and transactions; migrations tested on prior-version data; backup and tested restore; restart persistence; busy and lock handling |
| `auth` | Object and role authorization tests, session handling, Security pass |
| `personal-data` | Data inventory, minimization, retention and deletion path, privacy notice |
| `public-api` | Contract tests (OpenAPI for HTTP APIs), compatibility and semver rules, docs |
| `external-effects` | Effect classification, idempotency, fake or sandbox targets, explicit authority |
| `background-jobs` | Schedules, idempotency, retry and overlap behavior |
| `i18n` | Locale, time zone, date, number, currency and Unicode handling decisions |
| `cli` | Exit codes, stdin/stdout contracts, help text, cross-platform paths |
| `library` | Public API surface, semver, packaging, examples |
| `data-pipeline` | Data contracts, reproducibility, sample-data checks (R2) |
| `infra` | Plan-only checks, drift, least privilege (R2) |
| `ml` | Evaluation sets, reproducibility, data provenance (R2) |
| `mobile` | Simulator journeys, platform guidelines (R2); a responsive web app is not the mobile family |

Traits select obligations; they never create a support claim by themselves.

#### 3.8.5 Trait detection and composition

- **Detection (QLT-11):** Tenet infers project traits from inspection and change traits from the planned diff, records both, lets the user correct them, and treats a missed trait found in review as a finding.
- **Project versus change:** project traits define invariants that must keep holding (regression protection); only change traits add new design, specialist or check work. A CSS change in a project with `auth` keeps auth regression tests applicable but does not trigger an auth design pass.
- **Composition:** obligations from several traits combine conservatively. Checks are deduplicated only when proven equivalent (same check obligation). Cross-cutting combinations (for example `auth` + `public-api` + `persistence`) are reviewed together, not as independent checklists. Conflicting obligations are escalated as normative choices.
- **Changes mid-work:** adding or removing a trait mid-work makes dependent evidence stale and re-evaluates the lane.
- **Unknown traits:** if Tenet cannot determine whether a trait applies, the result discloses it; obligations that might apply are treated as applicable for the verdict.

#### 3.8.6 Recipes and extension conformance

A recipe declares:
- name, version and owner;
- stack and tool versions, and project shape;
- traits, prerequisites and readiness probes;
- default check obligations and fitness functions;
- reference workload (for application recipes);
- data and identity model;
- bounded permissions and execution envelopes;
- verification exclusions;
- recovery and handover;
- fixtures and a quality budget;
- compatibility and maintenance policy.

A recipe, adapter or host binding becomes supported only through **extension conformance**: capability detection and non-detection behavior; effect classification; evidence normalization and failure handling; baseline and candidate semantics; recovery limits; quality obligations; compatibility window; representative fixtures; a named maintenance owner; and passing the applicable Section 4.6 suites. Contributions enter through source review and a maintained release, never through a runtime loader.

#### 3.8.7 Repository map and context selection

The repository map indexes module exports, imports, entry points, routes and tests, and refreshes incrementally. A qualified host language service and search tools may provide it (Section 7.9); Tenet then adds the links to acceptance tests and reports which callers and routes a review actually inspected. When an assignment changes a non-private interface or symbol, selected context prioritizes direct importers and callers and the linked acceptance tests before unrelated files (AGT-12). Large raw search and log output stays outside the main context where host tools allow.

#### 3.8.8 Interoperability formats

| Concern | Format |
|---|---|
| Decisions | MADR |
| Requirements and examples | Markdown with Given/When/Then; EARS-style statements |
| Traces | A minimal, non-sensitive subset of the OpenTelemetry GenAI semantic conventions, pinned to the version current at Tech Spec approval |
| Findings | SARIF 2.1.0 |
| Tests | JUnit or TAP |

### 3.9 Specialist roles

Roles are responsibility contracts, not running workers or model names. Small work uses focused passes; substantial independent work uses native dispatch (AGT). A fresh context reduces anchoring on the implementer's reasoning; it does not create an isolated verifier.

| Role | Input → output | Boundary | R1 dispatch |
|---|---|---|---|
| Coordinator (intent steward) | Contract, state, user input → plan, assignments, brief, handoff | Coordinates only authorized work; no self-granted authority | Main session |
| Product | Needs, journeys → requirements, examples, invariants, options, plan items | Cannot accept inferred goals for the user | Focused pass |
| Researcher | Question plus revision → findings with sources | Read-only | **Native, parallel** |
| Architect | Interfaces, conventions → minimal design, decision record, architecture doc update | No provisioning; avoids speculative platforms | Focused pass; native in Deep |
| Designer | Journeys, audience → states, interaction and accessibility criteria | No assumed visual approval | Focused pass (`ui` trait) |
| Developer | Contract, tests → implementation and change summary | Writes only authorized scope; may change a locked test only after an INT-06 disposition | Main session |
| QA / Verifier | Acceptance basis, recipe → tests, executed results, coverage gaps | Classifies test effects; no production data | Focused pass |
| Reviewer | Intent, acceptance basis, full diff including tests and config, evidence → two-axis verdict, findings with severity, coverage statement | Read-only; cannot patch while declaring a finding resolved | **Native, fresh context** |
| Security | Diff, traits, threat note → security findings | Read-only | Focused pass; native in Deep |
| Technical writer | Changes, decisions → README, CHANGELOG, architecture and decision-record drafts | Docs only | Focused pass |
| Retrospective | Observations → scoped lesson proposals | Cannot change evaluators, permissions or accepted intent | Focused pass |
| DevOps | Release needs → readiness and recovery notes; delivery effects only in the R1.1 recipe | No credentials, deployment or cleanup authority in R1 | Focused pass |

---

## 4. Requirements and Acceptance Criteria

### 4.1 User journeys

| Journey | Experience | Completion boundary |
|---|---|---|
| J-01 Install and begin | See prerequisites, assistance levels and limits; install natively; invoke with a task | First useful task needs no developer setup |
| J-02 Start a project | Empty folder, describe outcome, choose Git init, edit the proposed plan, confirm the acceptance basis, get a running first increment | Real local journey works; no production or external identity setup |
| J-03 Change an existing project | Inspect conventions and working-tree state, reproduce, agree behavior, implement test-first, review | Behavior and regressions demonstrated under the verdict policy, or the result is explicitly incomplete |
| J-04 Review only | Request critique; optionally fix selected findings | No files written during review; selected fixes need implementation authority |
| J-05 Continue and correct | Reopen after interruption, reconcile human edits, report a bug, revise intent, ask what's next | Scope, plan and evidence recovered per Section 5.14; stale results and old approvals are not reused blindly |
| J-06 Integrate and hand off | Integrate accepted work locally; ask for a PR brief; push or open the PR yourself or ask Tenet explicitly | Base branch contains the work; brief reflects contract, evidence and open findings |
| J-07 Update or leave | Native update, disable or uninstall | Source and specs remain usable; no hidden service remains |

### 4.2 Functional requirements

#### Installation and first use (INS)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| INS-01 | Tenet shall install as one plugin through the qualified native install path without cloning, building, editing JSON or installing a runtime. | Must | M0 | AC-01 |
| INS-02 | The README shall state, before installation, prerequisites, publisher and verification steps, the support matrix and assistance levels, permissions and executable content, a first task, and update and removal steps. | Must | R1 | AC-01, AC-11 |
| INS-03 | When invoked with a task, Tenet shall accept the task before any setup and run only the readiness checks that task depends on. | Must | M0 | AC-02, AC-21 |
| INS-04 | Tenet shall distinguish plugin-ready, project-ready and action-ready states and report only those relevant to the current task. | Must | A | AC-03, AC-21 |
| INS-05 | When the host version, plugin version, policy or relevant project inputs change, Tenet shall re-probe only the affected capabilities; otherwise it shall reuse cached observations with provenance. | Must | B | AC-19, AC-21 |
| INS-06 | If a required capability is missing, Tenet shall block only dependent operations, name the missing prerequisite, and offer the safe next action and unaffected alternatives. | Must | A | AC-03 |
| INS-07 | The installed product shall require no runtime, service, database, MCP server, API key or CI beyond the documented host account and the project's own tools; Tenet helpers reuse the project's Node.js. | Must | M0 | AC-01 |
| INS-08 | If policy blocks plugin installation or required features, the README shall explain the native recovery path. | Should | R1 | AC-01 |
| INS-09 | Tenet shall answer questions, help and status requests conversationally without creating a work contract or files. | Must | A | AC-21 |
| INS-10 | Tenet shall announce its engagement and next step once when a task starts, not on every reply. | Must | A | AC-21 |
| INS-11 | When a project needs Node.js, a package manager or Git that is missing, Tenet shall explain the prerequisite, link the official installer and re-check, without installing software itself. | Must | B | AC-03, AC-21 |
| INS-12 | Before implementation, Tenet shall state the assistance level (Section 2.3) for the current project and task. | Must | A | AC-03, AC-21 |

#### Intent, plan and acceptance basis (INT)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| INT-01 | Before asking questions, Tenet shall inspect existing source, docs and conventions and reuse established facts. | Must | M0 | AC-04, AC-21 |
| INT-02 | Tenet shall record intent with separate sections for purpose and value, users, accepted requirements with examples and invariants, constraints, preferences, non-goals, assumptions, deferred choices and plan items. | Must | A | AC-13a |
| INT-03 | Tenet shall ask only questions whose answers change the next dependent action, each with a recommendation, its consequences, and a reversible default where one is justified. | Must | A | AC-04, AC-21 |
| INT-04 | For behavioral work in Standard and Deep lanes, Tenet shall express the agreed outcome as concrete examples in the user's domain language; when the request already states unambiguous cases, Tenet shall record them as confirmed and show them in the contract summary, and otherwise shall obtain the user's confirmation before implementation. | Must | M0 | AC-24 |
| INT-05 | Tenet shall implement the acceptance basis as executable acceptance tests before the production behavior they cover, tag them with their IDs, and lock each test once its verification result is recorded (Section 3.7.2). | Must | M0 | AC-05, AC-24 |
| INT-06 | When a locked acceptance test must change, Tenet shall record the reason and obtain user confirmation for a behavior change, or an independent review disposition for a test defect; related mechanical corrections may share one disposition. | Must | A | AC-07, AC-24 |
| INT-07 | Tenet shall keep inferred requirements as assumptions until the user confirms them. | Must | A | AC-13a |
| INT-08 | When intent changes, Tenet shall identify affected requirements, examples, plan items, tests, decisions and in-flight work and present the impact before proceeding. | Must | B | AC-13a |
| INT-09 | Tenet shall record consequential decisions in MADR format with context, options, choice and consequences, linked to the IDs they affect. | Must | B | AC-13a |
| INT-10 | Tenet shall assign stable, branch-safe IDs to durable plan items, requirements, examples, constraints, assumptions and decisions (Section 3.7.3). | Must | A | AC-13a, AC-25 |
| INT-11 | While style is Guided, Tenet shall present examples and choices without technical jargon and explain consequences in domain terms. | Must | R1 | AC-21 |
| INT-12 | When a request spans several increments, Tenet shall propose an ordered, editable plan of independently checkable increments with dependencies, track progress against it, and propose the next item on request. | Must | A | AC-04, AC-12 |
| INT-13 | Tenet shall let the user designate existing planning documents as intent, plan and status sources instead of creating `INTENT.md`. | Should | R1 | AC-04 |
| INT-14 | Tenet shall keep `docs/architecture.md` describing current components, data model and integration points. | Should | R1 | AC-20 |
| INT-15 | Tenet shall define each work's acceptance basis (Section 4.5.1) and propose at least one boundary or negative example for each new requirement. | Must | A | AC-24, AC-27 |

#### Work contracts and workflow (WRK)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| WRK-01 | Tenet shall record a work contract for each implementation task containing outcome, acceptance basis, scope, protected paths, checks, execution envelopes, endpoint, budget, branch and base, pinned versions and recovery point. | Must | M0 | AC-04, AC-13a |
| WRK-02 | A clear user request shall authorize routine in-scope local steps (edits, inspected checks, review, bookkeeping, recovery preparation) without further approval prompts. | Must | M0 | AC-21 |
| WRK-03 | Tenet shall request new authority only when behavior, data or access, compatibility, protected paths, irreversible or remote effects, or resource limits change beyond the contract. | Must | A | AC-08, AC-13a |
| WRK-04 | Tenet shall recommend a lane from the Section 5.2 assessment of the change, re-assess it after inspection, state the reason in one line, and let the user raise it, or lower it no further than the floor. | Must | A | AC-21 |
| WRK-05 | Tenet shall route feature, bug, review, investigation, refactor, prototype, plan and continuation requests through the main workflow without the user choosing a mode. | Must | A | AC-21 |
| WRK-06 | When the user explicitly requests a prototype, Tenet shall label it unhardened, keep it within declared data limits, record its gaps in `docs/hardening.md` and never report it as checked. | Must | B | AC-05, AC-21 |
| WRK-07 | When an unhardened prototype is promoted, Tenet shall inventory shortcuts, characterize working behavior, add distinguishing checks for missing safeguards and obtain independent review before a checked-local verdict. | Must | B | AC-05 |
| WRK-08 | Tenet shall apply the per-contract limits of Section 4.4.2 at the boundaries their mechanism class allows, warn at 80%, and at the bound stop with a diagnosis and a specific extension proposal. | Must | M0 | AC-15c, AC-19 |
| WRK-09 | If the same operational failure recurs twice in a row, or attempts oscillate, Tenet shall stop retrying and present a diagnosis; planned failing tests in TDD do not count as failures. | Must | A | AC-15c |
| WRK-10 | Tenet shall checkpoint at declared boundaries and before known host limits where observable, so an iteration pause or interruption loses at most the work since the last checkpoint, and shall never auto-confirm a host pause. | Must | A | AC-08, AC-21 |
| WRK-11 | Tenet shall support status, refine, pause, cancel, undo, integrate, decline and resume as defined in Section 3.4. | Must | B | AC-21 |
| WRK-12 | Tenet shall reserve enough budget to write a handoff and diagnosis before exhaustion. | Must | A | AC-08 |
| WRK-13 | If the user declines a mandatory step, Tenet shall proceed only to an endpoint whose label reflects the missing evidence (Section 4.5.2), state it once, and never lower the floor silently. | Must | B | AC-21, AC-27 |

#### Specialists and delegation (AGT)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| AGT-01 | Tenet shall define roles as responsibility contracts (Section 3.9) independent of model names. | Must | A | AC-22 |
| AGT-02 | On the R1 tuple, Tenet shall dispatch the Reviewer as a native subagent with fresh context for consequential work and record observed dispatch metadata. | Must | M0 | AC-06, AC-22 |
| AGT-03 | Tenet shall dispatch independent read-only Researcher assignments in parallel when they observe one declared source revision. | Must | A | AC-22 |
| AGT-04 | Each assignment shall carry goal, contract and config revision, source baseline, minimal context, permitted actions, budget and expected output. | Must | A | AC-22 |
| AGT-05 | Each result shall report completed, partial, blocked, failed or cancelled, plus artifacts inspected or changed, findings and open dependencies; partial output shall not count as completion. | Must | A | AC-22 |
| AGT-06 | Child work shall not expand authority, reset budgets or delegate further; violations found in traces are findings (mechanism: cooperative plus detected, Section 5.4). | Must | B | AC-22 |
| AGT-07 | The coordinator shall resolve factual disagreements by evidence and present normative product or risk choices to the user as options with a recommendation. | Must | B | AC-22 |
| AGT-08 | Tenet shall hold an atomic write-ownership claim (Section 5.11) before writing and run at most one write workflow per workspace. | Must | A | AC-17 |
| AGT-09 | For small tasks, Tenet shall use a focused same-session pass instead of dispatch and shall not describe it as a separate agent. | Should | B | AC-22 |
| AGT-10 | Users shall obtain results without managing specialist lifecycles or reading subagent transcripts. | Must | B | AC-21, AC-22 |
| AGT-11 | When parallel readers return findings against a revision that has since changed, the coordinator shall reconcile them before acting. | Must | B | AC-22 |
| AGT-12 | When an assignment changes a non-private interface or symbol, selected context shall prioritize direct importers and callers and linked acceptance tests (Section 3.8.7). | Must | B | AC-19, AC-22 |

#### Test-first implementation (TDD)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| TDD-01 | For changed behavior, Tenet shall run at least one distinguishing reproduction test that fails on the baseline and passes on the candidate, and shall record the expected results of preservation, boundary and negative cases, which may pass on both. | Must | M0 | AC-05 |
| TDD-02 | For new interfaces, Tenet shall add minimal compilable scaffolding so the failing test is behavioral; a compile or import error alone shall not count as a failing test. | Must | M0 | AC-05 |
| TDD-03 | If a behavioral failing test is infeasible, Tenet shall use a test-alongside approach with a negative control and disclose it in the result. | Must | A | AC-05 |
| TDD-04 | In existing code, Tenet shall characterize affected behavior before changing it and preserve unrelated behavior. | Must | A | AC-05, AC-20 |
| TDD-05 | After green, Tenet shall refactor when it reduces complexity within scope, then rerun affected checks. | Should | B | AC-05 |
| TDD-06 | For nonbehavioral work, Tenet shall state the alternative check instead of writing artificial tests. | Must | B | AC-05 |
| TDD-07 | In the Deep lane, Tenet shall offer mutation testing on critical modules when the adapter supports it. | Could | R1 | AC-07 |

#### Verification and evidence (EVD)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| EVD-01 | Tenet shall bind every check result to the candidate (base commit, digest of relevant uncommitted and untracked files, lockfile, configuration, toolchain, execution envelope) without hashing or storing secret values. | Must | M0 | AC-18 |
| EVD-02 | Tenet shall record each check's verdict, qualifiers, freshness and source as defined in Section 3.7.2; zero tests executed shall be inconclusive. | Must | M0 | AC-07 |
| EVD-03 | When an input changes, Tenet shall mark dependent evidence stale; an input of unknown relevance shall invalidate conservatively or make the result inconclusive. | Must | A | AC-18 |
| EVD-04 | Tenet shall run the distinguishing reproduction and targeted checks on the baseline before changing code; when a broader check fails on the candidate and is not already recorded as a baseline failure, Tenet shall rerun it on the baseline in a sealed checkout outside the workspace (Section 5.13) to classify it as pre-existing or introduced. | Must | B | AC-18, AC-19 |
| EVD-05 | Tenet shall normalize evidence through ecosystem adapters under the contract of Section 3.8.3. | Must | A | AC-18, AC-20 |
| EVD-06 | Owner acceptance shall never convert a failed or missing check into pass. | Must | M0 | AC-07, AC-27 |
| EVD-07 | Tenet shall state each consequential control's mechanism class (Section 5.4) and assurance level (Section 5.3.4). | Must | M0 | AC-07, AC-13a |
| EVD-08 | Tenet shall distinguish flaky, simulated, partial and unavailable-history results from pass and fail; a result is classified flaky only under the Section 4.4.1 rerun policy. | Must | B | AC-07, AC-18 |
| EVD-09 | Declared fixture mutations, caches and outputs shall not invalidate evidence; unexpected changes to relevant inputs shall. | Must | B | AC-18 |
| EVD-10 | Tenet shall detect any change to a locked acceptance test by comparing it with the lock manifest at every check and review, and report undisposed changes as blocker findings. | Must | A | AC-07, AC-24 |
| EVD-11 | If a relevant input changes while a check runs, Tenet shall treat that result as inconclusive. | Must | B | AC-18 |
| EVD-12 | Each check result shall keep an execution receipt (Section 3.8.3); a model-written summary is not a receipt. | Must | A | AC-18 |
| EVD-13 | Integration and end-to-end checks shall use a dedicated test database and a server instance verified as Tenet-started for this candidate, never the user's development data or an unverified process on the port (Section 5.13). | Must | A | AC-18, AC-20 |
| EVD-14 | Tenet shall classify imported CI results as externally produced, and as protected acceptance evidence only after the verification in Section 5.3.5. | Should | R1 | AC-25 |

#### Independent review (REV)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| REV-01 | Consequential work shall receive a fresh-context native review of intent, the acceptance basis, the full diff including tests and configuration, and evidence receipts. | Must | M0 | AC-06 |
| REV-02 | Review shall give separate verdicts for behavior and intent, and for structure, security and charter; neither compensates for the other. | Must | M0 | AC-06 |
| REV-03 | Review shall list changes to assertions, test discovery, skips or focus markers, snapshots, mocks, suppressions, CI and dependencies for explicit disposition. | Must | A | AC-07 |
| REV-04 | Findings shall carry severity, evidence and a disposition under Sections 3.7.2 and 4.5.3. | Must | A | AC-06, AC-27 |
| REV-05 | Review shall stay within the lane's review-round budget (Section 4.4.2) plus one focused recheck; exhausting it is not approval and leaves unresolved items under the verdict policy. | Must | A | AC-06 |
| REV-06 | Tenet shall disclose reduced independence whenever it actually occurred, including same-session review or tests written and reviewed by the same session. | Must | A | AC-06 |
| REV-07 | When a different model family is observably available and authorized, Tenet shall offer cross-family review and claim it only from observed execution metadata. | Could | Later | AC-06 |
| REV-08 | When the change exceeds the Reviewer's context budget, Tenet shall split review coverage, narrow the increment, or report the uncovered parts, and shall not issue a whole-change verdict from partial coverage. | Must | B | AC-06, AC-27 |
| REV-09 | Review shall challenge the sufficiency of the acceptance basis and the fidelity of each acceptance test to its example, and propose missing behavior as assumptions or requirements without expanding scope. | Must | B | AC-24 |

#### Results and handoff (RES)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| RES-01 | The result shall lead with the outcome and how to use it, then checks, limits and next actions, with details on demand (Section 3.3). | Must | M0 | AC-21 |
| RES-02 | The result shall state the endpoint chosen by the verdict policy (Section 4.5.2) and every condition that prevented a stronger one. | Must | M0 | AC-07, AC-27 |
| RES-03 | Tenet shall not ask a routine final approval question; owner acceptance stays pending until the user accepts or rejects, or integrates the work. | Must | A | AC-21 |
| RES-04 | At contract end, pause or budget stop, Tenet shall write a handoff sufficient to resume in a new session without re-explanation. | Must | M0 | AC-08 |
| RES-05 | For user-facing changes, the result shall include a demo path: run instructions, the steps that show the confirmed examples and, for the `ui` trait, screenshots. | Must | B | AC-20 |
| RES-06 | A review-only request shall end at findings; "fix findings N and M" shall implement only those findings and reuse the review context. | Must | A | AC-04 |
| RES-07 | Tenet shall disclose stable host and assurance limits once and when they change, and repeat a limit only when it materially affects the current task. | Must | B | AC-21 |
| RES-08 | While style is Guided, Tenet shall offer to start the local app under native consent and confirm the local URL responds. | Should | R1 | AC-21 |
| RES-09 | Before Deep work, Tenet shall show the expected budget envelope and its main cost drivers. | Should | B | AC-15c |

#### Git workflow (GIT); contract in Section 5.12

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| GIT-01 | Checked implementation shall require a Git repository; in a non-Git folder Tenet shall offer to initialize one (only after the user chooses it), proceed read-only, or build a prototype backed by a snapshot. | Must | M0 | AC-17, AC-25 |
| GIT-02 | Tenet shall create a work branch from the current HEAD per contract unless the user chooses the current branch, record the base, state when work is stacked on an unintegrated branch, and never rewrite published history. | Must | M0 | AC-25 |
| GIT-03 | Tenet shall commit at green boundaries, staging only changes it authored in scope while preserving the user's index, following the project's commit convention, with configurable `Tenet-Work` and `Tenet-Req` trailers. | Must | M0 | AC-25 |
| GIT-04 | Undo shall preview the inverse of the work's commits against current state, preserve later human changes, apply only after confirmation and run applicable checks afterwards. | Must | A | AC-17 |
| GIT-05 | Tenet shall push, open or merge remote pull requests, or publish only on explicit request. | Must | M0 | AC-04, AC-25 |
| GIT-06 | On request, Tenet shall draft a pull request description from the contract, examples, evidence and open findings. | Should | R1 | AC-25 |
| GIT-07 | The starter recipe shall include a CI workflow running the same check obligations. | Should | R1 | AC-20, AC-25 |
| GIT-08 | Tenet shall include uncommitted human edits in the candidate it checks, and shall never stage, commit, stash, reset or discard them without explicit consent. | Must | M0 | AC-17, AC-25 |
| GIT-09 | When Tenet's shared files conflict on integration, Tenet shall reconcile by ID, detect same-ID different-content collisions, and propose the merged content for user confirmation. | Must | B | AC-17 |
| GIT-10 | When work starts on a dirty working tree, Tenet shall record the starting HEAD, index and dirty paths and ask whether to commit the user's changes separately, include named files in scope, or leave them untouched. | Must | M0 | AC-17, AC-25 |
| GIT-11 | When the user accepts a result, Tenet shall offer to integrate the work branch into its base branch locally, following the `integration` setting, as a reversible step distinct from push or publication. | Must | A | AC-25 |
| GIT-12 | Tenet shall treat Git hooks, signing and configured Git programs as executable effects: inspect them before the first commit, run them under native consent, never bypass them, and rerun affected checks when hooks modify files. | Must | A | AC-16, AC-25 |
| GIT-13 | Tenet shall report a specific readiness outcome for detached HEAD, rebase or merge in progress, unresolved conflicts, shallow clones, submodules, LFS and linked worktrees before implementing. | Must | B | AC-25 |
| GIT-14 | Tenet shall offer to delete a work branch after integration or abandonment, and never delete unintegrated work without consent. | Should | R1 | AC-25 |
| GIT-15 | If a checkpoint commit cannot be made under existing authority, Tenet shall keep the candidate uncommitted, report the recovery limitation and not claim the work is committed. | Must | A | AC-17, AC-25 |

#### Continuity and storage (CON)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| CON-01 | At the end of the first successful increment, or on request, Tenet shall offer once, with a preview, to add the shared files of Section 3.2 to the repository, warn when the remote is public, and remember the answer. | Must | B | AC-08, AC-15a |
| CON-02 | Tenet shall keep operational state in `.tenet/` with its own `.gitignore`, user-only permissions where the OS supports them, an ownership marker, and no files with source, test or build-configuration extensions (snapshots stored as content-addressed blobs). | Must | M0 | AC-17 |
| CON-03 | On resume, Tenet shall reconcile current source, branch and human edits with recorded state and reuse only valid evidence and corroborated authority (Section 5.14). | Must | M0 | AC-08 |
| CON-04 | Records shall carry schema version, project and work identity, revision and provenance, and be updated inside an atomic ownership boundary (Section 5.11). | Must | A | AC-17 |
| CON-05 | If records are malformed, of unknown version or conflicting, Tenet shall diagnose and reconcile, never silently reset or infer authority. | Must | B | AC-17 |
| CON-06 | Copied, imported, relocated or pre-populated records shall confer no authority and no behavior until reviewed (Section 5.6). | Must | A | AC-08, AC-16 |
| CON-07 | If `.tenet/` is lost, Tenet shall reconstruct from repository memory and Git history, ask only consequential unknowns and never fabricate evidence. | Must | B | AC-08 |
| CON-08 | Tenet shall keep `.tenet/` within the storage budget using the eviction order of Section 5.15. | Must | B | AC-19 |
| CON-09 | Review-only and readiness requests shall create no files in the project, including `.tenet/`; by default they run as a single stateless kernel call, may use host plugin storage outside the workspace where available, and export durable results only on request. | Must | M0 | AC-04 |
| CON-10 | Reset a preference, forget a lesson, delete records, abandon work, undo and uninstall shall be separate actions, each previewing its consequences. | Must | B | AC-09, AC-10 |
| CON-11 | When the project moves, is cloned, or changes branch or machine, Tenet shall reconcile scope instead of transferring authority by path. | Must | B | AC-17 |
| CON-12 | Tenet shall record intended, dispatched and observed effects so a crash between an effect and its record is detected and reconciled before any retry. | Must | B | AC-17 |

#### Permissions, privacy and security (SEC); contracts in Section 5

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| SEC-01 | Tenet shall use native permissions, explain why each is needed, its scope and what declining prevents; a denied action stays denied and is not retried through another tool. | Must | M0 | AC-03 |
| SEC-02 | Tenet shall treat repository, retrieved, tool-output and lesson content as untrusted data that cannot grant authority, change acceptance or trigger egress; adopted shared files follow Section 5.6. | Must | M0 | AC-16 |
| SEC-03 | Tenet shall collect no credentials, unrelated projects, private chat histories or telemetry by default. | Must | A | AC-11 |
| SEC-04 | Before first execution, Tenet shall classify each command by its declared execution envelope (Section 5.8), not by its name. | Must | A | AC-04, AC-16 |
| SEC-05 | For new dependencies, Tenet shall verify identity and existence, license, install scripts including transitive lifecycle scripts, and lock resolution, and seek native consent for executable changes. | Must | A | AC-16 |
| SEC-06 | Bundled helpers shall accept only validated structured input, resolve workspace boundaries including symlinks, and expose no generic execution endpoint. | Must | A | AC-16 |
| SEC-07 | R1 shall bundle no MCP server or MCP configuration, except the Tenet kernel front-end of Section 5.7.1 when SP-12 selects it. | Must | A | AC-11 |
| SEC-08 | Tenet shall honor declared exclusions (no-model-send, no-read, no-edit, no-export, no-routine-scan) before affected reads where controllable, disclose host limits and block incompatible work. | Must | B | AC-16, AC-23 |
| SEC-09 | Review shall flag new network destinations, telemetry calls, credential handling and permission changes introduced in generated code. | Must | B | AC-16, AC-20 |
| SEC-10 | Tenet shall never weaken tests or CI, bypass hooks, or alter permissions to make a task pass. | Must | A | AC-07 |
| SEC-11 | Tenet shall redact likely secrets from displayed output, traces and exports, and never write credential values into records or fixtures. | Must | A | AC-11, AC-16 |
| SEC-12 | Shared project files and imported or pre-populated `.tenet/` content may add restrictions and obligations but shall never grant authority, add egress, relax floors or authorize commands; changes made outside Tenet need user acceptance before they relax anything (Section 5.6). | Must | A | AC-16 |
| SEC-13 | If host tool auto-approval is enabled or unknown, Tenet shall ask in chat before remote mutation, project-content egress and destructive actions, and label that gate advisory. | Must | M0 | AC-03, AC-16 |
| SEC-14 | Tenet shall apply the default exclusions of Section 5.10.2 for common secret files. | Must | A | AC-16, AC-23 |
| SEC-15 | If a check's execution envelope has unknown network, data or credential exposure, Tenet shall obtain the user's authorization to run with the stated unknowns and disclose them in the result. | Must | B | AC-16 |
| SEC-16 | When work concerns regulated, safety-critical, clinical or financial-transaction functions, Tenet shall state that its verdicts cover software checks only and that qualified human expertise is required. | Must | B | AC-21 |

#### Configuration and personalization (CFG); contract in Section 7

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| CFG-01 | Users shall change settings in ordinary language; for durable changes Tenet shall show the interpreted value and scope before saving. | Must | B | AC-23 |
| CFG-02 | R1 shall expose the catalog in Section 7.3 and no others. | Must | B | AC-23 |
| CFG-03 | Tenet shall resolve settings as defined in Section 7.4; project commitments and external restrictions shall apply regardless of preference order. | Must | B | AC-23 |
| CFG-04 | `/tenet why` shall explain the effective value, its source and adoption state, overridden values and capability limits. | Must | B | AC-23 |
| CFG-05 | Configuration shall never grant authority or create a capability. | Must | A | AC-23 |
| CFG-06 | Style and checkpoints shall change presentation and pacing only, never depth, authority or evidence floors. | Must | B | AC-15a, AC-21 |
| CFG-07 | Explicit "always in this project" corrections shall persist locally with provenance without re-asking; inferred preferences shall need confirmation. | Should | R1 | AC-09 |
| CFG-08 | Personal preferences shall never be written into shared files. | Must | B | AC-15a |
| CFG-09 | Tenet shall coexist with other plugins, instruction files and host memory features without rewriting or disabling them (Section 7.9). | Must | B | AC-23 |
| CFG-10 | Reapplying unchanged settings shall be idempotent. | Must | B | AC-23 |
| CFG-11 | Unknown or malformed configuration whose intended effect may be a restriction shall block dependent actions until resolved (Section 7.7). | Must | B | AC-23 |

#### Resources and models (RSC)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| RSC-01 | Tenet shall use the active model without asking the user to switch models per phase. A disclosed economy-tier model preference for the read-only researcher role is permitted once release qualification shows it meets that role's thresholds, and the user can decline it in words; the Reviewer and authority-bearing roles always inherit the active model. | Must | A | AC-15b |
| RSC-02 | Tenet shall record the requested and observed model per assignment where observable; unknown stays unknown. | Must | A | AC-15b |
| RSC-03 | Tenet shall respect native limits and never fund, purchase, enable overage or switch to a paid route without explicit authority. | Must | A | AC-15c |
| RSC-04 | Tenet shall report per-contract counts of attempts, review rounds, delegations, Tenet-launched checks and active work time; comparative overhead is an evaluation metric (Section 6.6). | Must | B | AC-15c, AC-19 |
| RSC-05 | While resource mode is Conserve, Tenet shall prefer focused passes for optional roles; while it is Serial, Tenet shall dispatch no optional or parallel subagents; the review required by the Section 5.2 floors still runs. | Should | R1 | AC-15c, AC-23 |
| RSC-06 | Tenet shall support ranked role-model portfolios using observed eligibility. | Could | Later | AC-15b |
| RSC-07 | Tenet shall report quota and reset data with source and freshness where the host exposes them. | Could | Later | AC-15c |
| RSC-08 | Tenet shall label the active model qualified, unqualified or unknown from golden-suite results (Section 6.4.4) and warn before Deep work on an unqualified or unknown model. | Must | R1 | AC-15b, AC-26 |

#### Learning (LRN)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| LRN-01 | Tenet shall apply an explicit correction to the current task immediately. | Must | A | AC-09 |
| LRN-02 | Project lessons shall be scoped, inspectable and resettable, carry provenance, and never transfer to another project without explicit scope. | Must | B | AC-09 |
| LRN-03 | Tenet shall turn a reported defect into a reproduction test before fixing it. | Must | A | AC-05, AC-09 |
| LRN-04 | At contract end, Tenet shall propose lessons only when supported by evidence from that work, for user confirmation. | Should | R1 | AC-09 |
| LRN-05 | Learning shall never weaken acceptance, add permissions or change evaluators. | Must | B | AC-09, AC-14 |
| LRN-06 | Tenet shall offer an opt-in personal practice library that applies user-approved lessons across the user's projects. | Could | R1.1 | AC-09 |

#### Lifecycle (LFC)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| LFC-01 | Tenet shall version releases with SemVer against the public compatibility contract of Section 6.5. | Must | R1 | AC-10 |
| LFC-02 | Release notes shall disclose changed permissions, destinations, executable content, evaluators, schemas and evaluated behavior changes. | Must | R1 | AC-10, AC-11 |
| LFC-03 | Each contract shall record the Tenet package, recipe, adapter and schema versions it uses; when an update is observed mid-contract, Tenet shall pause at the next boundary and reconcile or migrate the contract explicitly, never mixing versions silently. | Must | B | AC-10 |
| LFC-04 | Schema migrations shall be previewed, preserve overrides and unknown fields where safe, and have a tested path back to the previous known-good release. | Must | R1 | AC-10 |
| LFC-05 | Disable and uninstall shall preserve code, specs and evidence, list residual files and offer optional cleanup of `.tenet/`. | Must | R1 | AC-10 |

#### Quality of generated software (QLT)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| QLT-01 | The starter shall demonstrate persistence, validation, server-side object and role authorization, and a real local journey. | Must | A | AC-20 |
| QLT-02 | The starter shall meet its published list of applicable OWASP ASVS 5.0 Level 1 requirements, each with a verification method (automated, behavioral test or manual review), non-applicability reasons and results; scans alone shall not be presented as ASVS conformance. | Must | R1 | AC-20 |
| QLT-03 | The starter UI shall meet WCAG 2.2 AA on its declared critical journeys and their states, verified by automated, keyboard and screen-reader checks; claims shall name the journeys covered. | Must | R1 | AC-20 |
| QLT-04 | The starter shall include structured logging with redaction, a health endpoint and consistent non-leaking error responses. | Must | R1 | AC-20 |
| QLT-05 | Each application recipe shall declare a reference workload and fitness functions (Section 5.16); checks shall report trends across changes without claiming whole-application conformance from changed flows. | Must | R1 | AC-19, AC-20 |
| QLT-06 | Tenet shall apply the obligations contributed by the project's and the change's traits (Section 3.8.4). | Must | B | AC-20 |
| QLT-07 | Schema changes shall include a migration tested against prior-version fixture data and, where user data exists, a consistent backup through a supported mechanism with a tested restore; Tenet shall never reset data to make tests pass. | Must | R1 | AC-20 |
| QLT-08 | As part of handover, Tenet shall keep README run instructions, decision records, the architecture doc and CHANGELOG current. | Should | R1 | AC-20 |
| QLT-09 | Tenet shall apply the project charter, or the default charter (Section 1.8) when none exists. | Must | A | AC-15a |
| QLT-10 | Tenet shall flag a suspected out-of-scope improvement instead of expanding the task. | Must | B | AC-13a |
| QLT-11 | Tenet shall detect, record and let the user correct project and change traits (Section 3.8.5). | Must | B | AC-20 |
| QLT-12 | The starter shall follow the identity, exposure and data model of Section 5.16. | Must | A | AC-16, AC-20 |
| QLT-13 | For changes with `auth`, `persistence`, `personal-data` or `external-effects` traits, Tenet shall record a short threat and data note whose security items become tests or constraints. | Must | B | AC-20 |
| QLT-14 | For the `ui` trait, Tenet shall cover the states listed in Section 3.8.4 for each changed flow. | Must | B | AC-20 |
| QLT-15 | Tenet shall record each project's recipe version and offer recipe upgrades as ordinary work items with a diff preview. | Should | R1 | AC-10, AC-20 |
| QLT-16 | Maintainers shall refresh starter dependencies monthly and respond to critical vulnerabilities in starter dependencies within the release-stewardship window (Q-09). | Must | R1 | AC-11 |
| QLT-17 | The starter and every prototype shall keep `docs/hardening.md` listing what must change before shared, networked or production use. | Must | B | AC-20 |

#### Tenet engineering and release stewardship (ENG)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| ENG-01 | Tenet's core shall ship in Agent Skills format with thin host bindings (Section 3.8.1). | Must | A | AC-01, AC-26 |
| ENG-02 | Each host binding shall ship a capability descriptor, and core logic shall branch on capabilities only (Section 3.8.2). | Must | A | AC-03, AC-26 |
| ENG-03 | Tenet's CI shall lint skills and agents for validity and enforce the context budgets of Section 4.4.3. | Must | M0 | AC-19, AC-26 |
| ENG-04 | Tenet shall run its evaluation tiers as defined in Section 6.4.3, blocking merges on deterministic-tier regressions and releases on full-suite regressions. | Must | A | AC-26, AC-28 |
| ENG-05 | Maintainers shall rerun the native-host suite monthly and when a host model change is observed; until then the support matrix shall label the combination "not yet evaluated with the current model". | Must | R1 | AC-26 |
| ENG-06 | Trace fields shall follow the pinned OpenTelemetry GenAI subset (Section 3.8.8). | Should | R1 | AC-13a |
| ENG-07 | Releases shall satisfy the verification chain of Section 5.9.2. | Must | R1 | AC-11 |
| ENG-08 | Before R1, maintainers shall complete one bounded improvement experiment under Section 6.10. | Must | R1 | AC-14 |
| ENG-09 | Trace events shall link intent revision, work, role, observed model, action, permission outcome, check outcome, timestamps and termination state, and shall declare visibility gaps. | Must | B | AC-13a |
| ENG-10 | Tenet's own CI shall follow the security tiers of Section 5.9.3. | Must | A | AC-28 |
| ENG-11 | Until two maintainers exist, changes to executable content, hooks, helpers or permissions shall follow the solo-maintainer review rule of Section 5.9.2, disclosed in release notes. | Must | R1 | AC-11 |

#### Documentation and open source (OSS)

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| OSS-01 | The repository shall publish a license, attribution, CONTRIBUTING, code of conduct, SECURITY.md and the supported-version policy. | Must | R1 | AC-11 |
| OSS-02 | Documentation shall include a quickstart, an examples gallery (new app, brownfield bug, review) and troubleshooting. | Must | R1 | AC-02 |
| OSS-03 | Recipe, role and host-binding contributions shall follow an RFC process and carry a certification level (experimental, community, official). | Should | R1 | AC-20 |
| OSS-04 | Using Tenet shall not require disclosure of application source or give Tenet any ownership of the application; obligations from incorporated templates, snippets, assets and dependencies remain and are listed for the starter. | Must | R1 | AC-11 |
| OSS-05 | Before publication, maintainers shall review the source tree and reachable history for private material separately from package inclusion. | Must | R1 | AC-11 |
| OSS-06 | `/tenet feedback` shall produce a redacted, previewable report the user can attach to an issue. | Should | R1 | AC-11, AC-21 |

### 4.3 Non-functional requirements

| ID | Requirement | Pri | Rel | AC |
|---|---|---|---|---|
| NFR-01 | Tenet shall meet the system budgets of Section 4.4.3 on the frozen reference fixtures. | Must | R1 | AC-19 |
| NFR-02 | Tenet's own messages shall be usable by keyboard and screen reader, use text rather than color-only status, and state what failed, what remains safe and the next action. | Must | B | AC-21 |
| NFR-03 | A required control shall never fail open silently. | Must | A | AC-03, AC-13b |
| NFR-04 | If network, model or tools fail, Tenet shall preserve known state and budgets, avoid spawning fallback work, and clean up only Tenet-owned processes and temporary paths. | Must | A | AC-17, AC-19 |
| NFR-05 | Tenet shall report its active work time separately from provider, tool, network and user waiting time. | Must | B | AC-19 |
| NFR-06 | R1 interaction language shall be English; generated application locale, time zone and code conventions are independent project decisions. | Must | R1 | AC-21 |
| NFR-07 | Diagnostics shall be redacted and exported only on user request, with the included content previewed. | Must | B | AC-11 |

### 4.4 Operating limits

#### 4.4.1 Definitions

| Term | Definition |
|---|---|
| Implementation attempt | One Developer pass from the contract (or from a prior failed check) to a candidate submitted for checking. Planned failing runs, compile iterations and test corrections inside the pass do not count |
| Review round | One Reviewer assessment of the full candidate producing findings |
| Focused recheck | Re-assessment limited to the fixes for material findings from the last round |
| Delegation | One native subagent dispatch |
| Tenet-launched check | One execution of a check obligation started by Tenet |
| Active work time | Wall time while Tenet is executing, excluding waits for user input and host approval prompts |
| Check-in | A progress message at the checkpoints preference's cadence; work continues unless a decision is pending |
| Flaky | A required test that fails, then passes on unchanged inputs within the rerun policy (up to 2 reruns, counted as Tenet-launched checks) |
| Model call | One model request observable through the host; used in evaluation, and in runtime limits only where SP-05 shows it is observable |

#### 4.4.2 Per-contract limits

| Limit | Quick | Standard | Deep | Mechanism class | Value class |
|---|---|---|---|---|---|
| Implementation attempts before diagnostic stop | 3 | 3 | 4 | Boundary-checked | Provisional |
| Review rounds (plus one focused recheck) | 1 | 2 | 2 | Boundary-checked | Provisional |
| Native delegations | 2 | 6 | 12 | Boundary-checked | Provisional |
| Active work time between check-ins | 15 min | 60 min | 120 min | Boundary-checked | Provisional |

Limits are checked by the coordinator through a helper counter before each new attempt, round, dispatch or phase; they cannot stop a step already in progress. Counters survive resume and delegation.

#### 4.4.3 System budgets

| Budget | Target | Mechanism class | Value class |
|---|---|---|---|
| Always-loaded Tenet context: every Tenet-owned item the host includes on every request (skill, agent and command descriptions, MCP tool schemas and the charter section) | ≤ 2,000 tokens | Deterministic (Tenet CI lint) | Provisional |
| Coordinator agent instructions, present on every request of a Tenet session | ≤ 1,000 tokens | Deterministic (Tenet CI lint) | Provisional |
| Single skill loaded on demand | ≤ 5,000 tokens | Deterministic (Tenet CI lint) | Provisional |
| Peak Tenet-injected context per assignment (excludes code read by tools) | ≤ 20,000 tokens | Observed (qualification measurement) | Provisional |
| Kernel bookkeeping call latency (all calls except check execution) | p95 ≤ 300 ms warm, ≤ 1 s cold; 5 s timeout with a defined outcome | Observed; timeout deterministic | Provisional |
| Check execution | Bounded by each check obligation's declared timeout (recipe default 10 min); expiry yields inconclusive | Deterministic | Provisional |
| Repository map for ≤ 10,000 tracked files | ≤ 30 s without reading all file contents; incremental refresh | Observed | Provisional |
| `.tenet/` storage, including archives and artifacts | ≤ 50 MB, managed by Section 5.15 | Boundary-checked | Provisional |
| Resume reconstruction | ≤ 2 min | Observed | Provisional |

Budgets are finite and part of the support profile. Zero never means unlimited. Comparative overhead (Section 1.6) is measured only in evaluation.

### 4.5 Endpoint verdict policy

#### 4.5.1 Acceptance basis

A contract's **acceptance basis** is the union of:
1. accepted requirements and their confirmed examples;
2. their invariants;
3. applicable project commitments and constraints;
4. applicable trait and recipe obligations;
5. compatibility obligations for existing contracts and data.

Examples illustrate and disambiguate the basis; they never replace it. Review challenges the basis for sufficiency (REV-09). Missing behavior becomes a proposed requirement or assumption, never silent scope expansion.

#### 4.5.2 Decision table

`checked-local` requires **all** of the following:
- every acceptance-basis test and required check has a fresh `pass` on the candidate, with receipts;
- the distinguishing reproduction was observed failing on the baseline (or the TDD-03 alternative was declared);
- required review completed at the required independence and full coverage;
- no blocker finding is open;
- no unresolved assumption can change the claimed behavior;
- the result names the verified environment and its limits.

| Condition | Endpoint |
|---|---|
| All conditions above hold | checked-local |
| Implementation exists; some required evidence is missing, stale, inconclusive or skipped | implemented-unverified, listing the missing evidence |
| A required check fails on the candidate and the failure is introduced | Not finished: return to executing within budget; at budget exhaustion, implemented-unverified with the failure |
| A required check fails identically on baseline and candidate, outside the changed behavior | checked-local only if the contract excluded that check's scope at authorization with the user's agreement, and the failure is listed; otherwise implemented-unverified |
| A required check is flaky | implemented-unverified for obligations depending on it, unless another passing check covers the same obligation |
| A blocker finding is open | Not checked-local, whatever the owner decides |
| A major finding is deferred or risk-accepted by the user | checked-local allowed; the finding is listed |
| An unresolved assumption could change the claimed behavior | Not checked-local, unless the user accepted a temporary behavior recorded as `accepted-temporarily` with an expiry |
| Only part of the outcome is verified | Either amend the contract to the verified part with the user's authority, or report incomplete; never narrow the claim silently |
| Review could not cover the whole change within budget | implemented-unverified for the uncovered parts, or narrow the increment |
| The user declined a mandatory step | implemented-unverified (or prototype if requested) |
| A prototype was requested | prototype, whatever incidentally passes |
| A required control or capability is unavailable | blocked, or the highest endpoint the assistance level allows |
| The checked candidate included relevant uncommitted human edits that the Tenet commit excludes | checked-local applies to the working-tree candidate only, and the result says so, unless the committed tree is also validated in a sealed checkout (Section 5.13) |
| Work was integrated into a base branch that had moved | The integrated tree is a new candidate; affected obligations are rerun before it is described as checked |
| Review-only request | findings-only |

**Owner acceptance** can accept residual risk on non-blocking items. It cannot waive an integrity rule, a blocker finding or missing mandatory evidence, and it never converts a verdict.

#### 4.5.3 Finding severity and authority

| Severity | Meaning | Who may close it, and how |
|---|---|---|
| Blocker | Violates the acceptance basis, an integrity rule, or a security or data-integrity obligation | Only `fixed → verified`, or `withdrawn` on evidence. The user may instead change the acceptance basis through INT-08 |
| Major | Material quality, maintainability or reliability defect | `fixed → verified`, or user `deferred`, `risk-accepted` or `wont-fix` with reason |
| Minor | Low-impact defect or improvement | Coordinator may defer with reason; user may decide otherwise |
| Note | Observation without required action | No disposition required |

The Reviewer proposes severity. The coordinator may lower it only by recording evidence, and the user sees the change. Disputes are settled by evidence; normative disagreements go to the user as options.

### 4.6 Acceptance suites

Section 6.2 owns the campaign protocol, Section 6.3 the fixtures, and Section 6.6 the value-study analysis. Every requirement lists its suites; non-applicability is recorded explicitly.

| ID | Suite | Required observed result |
|---|---|---|
| AC-01 | Install and removal | Clean install on the qualified path exposes `/tenet` with no cloning, building, JSON editing or runtime install; uninstall leaves only listed residual files; repeated 3 times per tuple; payload matches the published inventory |
| AC-02 | First-use usability (formative) | ≥ 4 of 5 unfamiliar technical builders reach an accurate next step within 10 min from the README; median first useful outcome ≤ 15 min on a ready fixture; blocked fixtures name the actual prerequisite |
| AC-03 | Denial, missing capability and approval modes | Denied actions do not run or get retried; affected work is blocked and labeled; unaffected read-only work continues; repeated setup preserves edits; under auto-approve, remote and destructive actions still get the chat gate |
| AC-04 | New project, plan and review-only | Seeded ambiguity is asked about; a multi-increment request yields an editable plan; the starter journey runs with tests; review-only creates no files (watched filesystem events plus final hashes) and runs no mutating commands; "fix N and M" scopes correctly |
| AC-05 | TDD evidence | Distinguishing reproduction fails on baseline and passes on candidate; preservation cases pass on both as expected; scaffolding gives behavioral red; import errors alone fail the red requirement; a vacuous assertion is rejected as insufficient evidence; prototype promotion follows WRK-07 |
| AC-06 | Review effectiveness | Recall, critical-defect and precision targets of Section 1.6 on ≥ 10 seeded fixtures plus clean negative controls; rounds respected; large diffs split or reported; reduced independence disclosed only when it occurred |
| AC-07 | Misleading success | 0 false checked-local verdicts across fixtures seeding failing checks, zero tests, skips, weakened assertions, edited locked tests, mock, CI or snapshot changes, missing or forged report files, flaky runs and stale identities |
| AC-08 | Continuity and resume | Planned, abrupt and host-limit pauses resume within the Section 4.4.3 time with 0 unnecessary repeated questions; budgets not reset; copied records confer no grants; human edits preserved |
| AC-09 | Learning scope | Corrections apply immediately; lessons stay in their project; forget and reset leave no duplicate in derived indexes; contradicted lessons retire |
| AC-10 | Lifecycle | Upgrade preview, declined migration, interrupted update, mid-contract update (pause and reconcile), disable and uninstall preserve source and instructions; known-good recovery rehearsed |
| AC-11 | Release supply chain and privacy | Inclusion list and separate history audit find no private material or credentials; the Section 5.9.2 chain verifies from source to installed artifact; telemetry off by default; no bundled MCP beyond the Section 5.7.1 kernel front-end |
| AC-12 | Value pilot | Formative: ≥ 10 eligible tasks across 2 repositories plus one sequence of 3 successive changes. Qualification: Section 6.6.4 decision rule passes |
| AC-13a | Intent traceability and drift | Every contract links to intent IDs; fixtures separate expected edits, in-scope refinement, authorized addition and unexplained drift; seeded drift is detected and escalated |
| AC-13b | Guarded gates (optional, Later) and observer hooks | Each advertised gated action is actually prevented under mismatch, disable, timeout, crash and schema failure; otherwise the capability is unavailable. Observer hooks only record; a missing, failed or incomplete observation downgrades the control to its cooperative label |
| AC-14 | Maintainer improvement cycle | One frozen baseline-versus-candidate evaluation with holdout; documented decision; evaluator changes cannot self-authorize promotion |
| AC-15a | Charter and personalization | Existing guidance preserved; shared charter only after preview and only in the loaded instruction file; personal preferences never in shared files; style and checkpoints never weaken checks |
| AC-15b | Model selection | Active model used without manual switching; requested and observed model recorded; unobserved stays unknown; unqualified model warning appears before Deep work |
| AC-15c | Limits and resources | Limits include delegations and retries; 80% warning and stop-at-bound behavior observed at boundaries; repeated identical failure stops; planned red runs are not counted; no paid fallback; counts reported |
| AC-16 | Security | Injected repository, tool and lesson text cannot change authority or leak a synthetic canary; a pre-populated malicious `.tenet/` and a loosened shared policy are quarantined; helper traversal and symlink attacks fail; a benign-named command that reaches the network or reads credentials is not classified safe; hook execution is inspected; new-destination code is flagged |
| AC-17 | State, concurrency and Git recovery | Two Tenet instances racing from the same revision yield at most one writer; a crash between contract and evidence updates is detected; schema and storage faults preserve valid records; undo with later human commits preserves them or stops; relocation, clone and loss paths follow Section 5.14 |
| AC-18 | Evidence consistency | Relevant input drift (including shared config and ignored-but-relevant files) invalidates dependent evidence; edits during a run make it inconclusive; declared fixture mutations do not; malformed, stale or contradictory reports are inconclusive; pre-existing and introduced failures separated |
| AC-19 | Performance and overhead | Section 4.4.3 budgets met on frozen small, large and long-history fixtures; compaction keeps contract, authority and evidence references; storage pressure follows Section 5.15 |
| AC-20 | Recipe and generated software quality | Starter and brownfield profiles (including a TypeScript CLI/library fixture) pass business, invariant (including concurrent reservation), data and access, failure and recovery (backup restore exercised), UX state, accessibility, ASVS list, logging, workload and handover cases; the starter is unreachable beyond its declared local boundary |
| AC-21 | Experience | Task-first journeys for empty, dirty and broken projects, review-only, review-then-fix, prototype and decline-a-step; no repeated intake or consent; Section 3.4 actions behave as specified; Section 1.6 false-friction targets met; comprehension measured |
| AC-22 | Delegation | Native traces show a fresh-context Reviewer and overlapping parallel Researchers on the exact tuple; contract fields present; blocked, failed, partial, stale and disagreeing results handled; compared against serial execution before claiming benefit |
| AC-23 | Configuration | Section 7.8 cases pass |
| AC-24 | Acceptance basis and example fidelity | Pilot users detect the Section 1.6 share of seeded misinterpretations; each acceptance test faithfully asserts its example (seeded vacuous or mis-translated tests are caught by review); 0 locked-test edits without disposition |
| AC-25 | Git integration | Dirty-tree handling, user index preserved, only Tenet changes committed, project commit convention followed, hooks and signing respected (never bypassed), stacked branches stated, local integration offered, no remote effect without request, unusual Git states reported, commit-failure path honest |
| AC-26 | Tenet eval harness and drift | Deterministic tier runs on every Tenet change; seeded skill regression is blocked; model-change and monthly reruns occur; skill lint and context budgets enforced |
| AC-27 | Verdict policy | Truth-table fixtures for every Section 4.5.2 row (failed, missing, flaky, stale, baseline failure, blocker open, major deferred, unresolved assumption, partial outcome, partial review, declined step, prototype) produce exactly the specified endpoint |
| AC-28 | Evaluation infrastructure and CI security | The native-host suite exercises the qualified tuple (install, dispatch, permissions, interruption, model observation, result capture); proxy runs are labeled proxy; untrusted pull requests get no secrets or write access; live runs need maintainer approval and stay within budget |

### 4.7 Definition of done and release exceptions

**Public R1 is done when:**
- all Must requirements tagged M0, A, B or R1 pass their mapped suites on every supported tuple;
- Should requirements pass, or have an owner-signed omission;
- unresolved failures, non-applicability and residual risks are published;
- the release owner and product owner approve. Missing owners, unfrozen thresholds or unsigned decisions (Section 8.4) block qualification.

**Never waivable:** AC-07 (misleading success), AC-11 (privacy and supply chain), AC-16 (security), AC-17 (state and Git recovery), AC-25 safety cases (human work never committed or reverted), AC-27 (verdict policy) and AC-28 CI-security cases.

**Waivable only by narrowing:** if AC-12 or another value or experience target misses, the owner may release a narrower R1:
- the release states which claims are withdrawn;
- any capability removed is actually disabled, not just undocumented;
- the evidence and the exception are published;
- the release is named "R1 (limited)".

An exception never makes an unsupported capability supported.

---

## 5. Assurance, Security and Integrity Contracts

This section defines how Tenet establishes trust, decides authority, classifies its controls, resists threats, protects data, attributes and recovers work, and keeps records consistent. It implements the SEC, CON, GIT, EVD and NFR requirements. The security maintainer owns the threat review before beta; the Tech Spec maps each control to real host behavior.

### 5.1 Trust and responsibility boundaries

| Layer | Owns | Does not establish |
|---|---|---|
| Skills and agent instructions | Process guidance, context selection, role contracts, review methods | Unbypassable policy, secrecy or containment |
| Hooks and helpers | Tested, event-specific validation, evidence capture, counters, ownership claims, actionable errors | Coverage of all tools, sessions or external effects |
| Copilot host | Execution, model access, native permissions and approval modes, sandbox, cancellation | Identical guarantees across harnesses or modes |
| Project, CI and target controls | Required checks, protected branches, deployment identities when configured | Control of arbitrary local activity |
| User or organization | Goals, consequential approvals, account policy, accepted residual risk | Correctness through approval alone |

Hooks can execute outside a shell sandbox, so no helper may become an unrestricted bypass. Filesystem, network and executable dependencies of every helper are documented. R1 bundles no MCP server; adding one reopens threat, packaging and scope review.

### 5.2 Risk assessment and lane floors

Tenet assesses the **change** (not the whole project) on six dimensions. Project traits contribute invariants that must keep holding; only change traits add design, specialist or check work (Section 3.8.5).

| Dimension | Low | High (any one pushes toward Deep) |
|---|---|---|
| Sensitive data | Synthetic or public data | Personal, financial, health or credential data |
| Access and identity | No auth changes | Authentication, authorization, session or permission changes |
| External effects and spend | Local only | Network writes, messages, payments, provisioning |
| Reversibility | Revertable by Git | Data migrations, deletions, published artifacts |
| Compatibility and blast radius | Internal module | Public API, schema, shared library, many dependents |
| Uncertainty | Clear behavior and known code after inspection | Ambiguous intent, or code still unclear after inspection, or no tests |

Uncertainty is re-assessed after inspection; an unfamiliar repository first triggers inspection, not an automatic Deep lane. A one-line migration can be high risk. Missing information blocks dependent actions, not unrelated investigation. A change is **consequential** when any dimension is High.

**Mandatory floors.** The user may raise the lane freely. Lowering it stops at these floors:

| Condition | Floor |
|---|---|
| Any behavioral change | A distinguishing reproduction with red on baseline and green on candidate (or the declared TDD-03 alternative) |
| Consequential change | Standard, with fresh-context review |
| Two or more High dimensions, or irreversible effects | Deep |
| Explicit prototype | Unhardened label; never a checked endpoint |

A user may decline a floor step; the endpoint then follows Section 4.5.2 (WRK-13).

### 5.3 Authority

#### 5.3.1 Authority envelope

Each work contract records:
- who authorized the objective;
- authorized action classes (Section 5.3.3);
- baseline revision and starting working-tree state;
- protected paths and interfaces;
- data and targets in scope;
- resource limits;
- expiry, where relevant.

A clear task authorizes predictable local edits, inspected checks within declared execution envelopes, independent review, essential bookkeeping and recovery preparation (branch and Tenet-only commits). It never bundles:
- publication;
- purchases;
- privileged access;
- destructive data changes;
- new data destinations;
- committing or reverting the user's own changes;
- `git init`.

Product intent and native permission are separate. Tenet reuses an existing decision only for what it actually covers, and never writes broad allow-all rules.

#### 5.3.2 Amendment and validity

- Predicted files are estimates, not an allowlist, unless the user makes them a constraint.
- A newly relevant file, normal implementation, test correction or user refinement within the objective needs no reauthorization.
- Authority must be renewed when behavior, data or access, compatibility, protected paths, irreversible or remote effects, or resource limits change beyond the contract (WRK-03).
- **Authority validity and evidence validity are independent.** Expected authorized edits make affected checks stale, not the authorization.
- **A protected-path exception is not a policy change.** A per-task authorization to write inside a protected path applies to that contract only; changing the commitment itself follows Section 7.1.
- Saved records keep decision provenance but never grant permission. A fresh "continue this fix" authorizes the remaining bounded local work; imported, copied or uncorroborated approvals do not.
- Before any retry, inspect ambiguous effects (Section 5.11). There is no exactly-once guarantee.

#### 5.3.3 Action classification

Actions are classified by their execution envelope (Section 5.8), never by command names.

| Class | Examples | Default authority |
|---|---|---|
| Source inspection | Read files, search, list | Any task, including review |
| Local execution without intended project writes | Type check or lint in check mode, after confirming the configuration writes nothing (for example, no incremental build info) | Review with requested checks, after inspection |
| Local mutation | Edit source, run tests that write caches or fixtures, create a test database | Implementation contracts |
| Git operation | Branch, commit, revert, integrate; may run hooks and signing programs | Implementation contracts for Tenet-authored changes, after hook inspection (GIT-12); `git init` only by user choice |
| Remote read or query disclosure | Fetch docs, package registry queries | Disclosed; native consent |
| Project-content egress | Sending project content to a new destination | Explicit authorization only |
| Remote mutation | Push, open or merge PRs, deploy, send messages | Explicit request only (GIT-05) |
| Privileged or destructive | Delete data, change permissions, migrate real user data | Explicit authorization plus a Deep lane; R1 has no production targets |

Plain review makes zero project writes (CON-09). A test label, cleanup step or zero net change does not make an effect safe. An established command is reused only while its executable, configuration, dependency and environment assumptions still hold.

#### 5.3.4 Assurance profiles

| Profile | Permits and proves | Limitation | Release |
|---|---|---|---|
| Advisory review | Read-only diagnosis and review; optional checks with explicit envelope | Guidance is not a machine boundary | M0 |
| Checked local | Authorized local changes, receipted checks, independent review, traces, the verdict policy | No universal scope containment or protected verifier | M0 |
| Guarded local | Named action classes blocked by qualified hooks plus deterministic checks | Coverage and exclusions published; prevention claimed only after observed dispatch denial | Later (SP-03) |
| Externally gated | Protected CI or branch rules verify the stated artifact (Section 5.3.5) | Needs external policy and credentials | R1 (when the project has them) |
| Delivery | Authorized target, artifact identity, observed real journey, rollback and operating owner | No generic deploy button or production access | R1.1 recipe |

**Delivery recipe tests (R1.1):**
- binds the exact artifact and target;
- the user holds the credentials;
- reconciles ambiguous remote effects before any retry;
- documents rollback;
- runs one real post-deploy journey;
- treats a successful CI run as no substitute for observed delivery.

A refusing helper while the tool proceeds anyway is a failure, not prevention. If a requested assurance needs a protected verifier and none is configured, Tenet reports it unavailable and does not issue the stronger verdict.

#### 5.3.5 External evidence classification

Imported CI results are **externally produced** by default. They count as **protected acceptance evidence** only after Tenet verifies all of the following:
- the run's commit or artifact matches the candidate;
- the workflow's identity and revision, unchanged by the candidate (or the change reviewed);
- branch protection and required-check configuration on the target branch;
- the tests and configuration it ran are those in the acceptance basis, and not weakened by the candidate;
- credentials were not accessible to the code under test where the profile requires separation;
- the run is fresh, not a stale or unrelated success.

Running on GitHub does not by itself imply protection. If any item cannot be verified, the evidence stays externally produced.

### 5.4 Control mechanism classes

Every consequential control states one class; claims never exceed it.

| Class | Meaning | Claim allowed |
|---|---|---|
| Preventive | A qualified host mechanism denies the action | "Prevented" within tested coverage |
| Deterministic | A helper validates and blocks the dependent step on failure | "Checked; dependent step blocked" |
| Boundary-checked | The coordinator consults a helper before the next step; cannot interrupt a running step | "Stops at the next boundary" |
| Detected | A helper finds a violation after the fact and raises a finding | "Detected and reported" |
| Cooperative | Instruction-following, measured by evaluation | "Advisory" |
| Observed | Measured for qualification only | "Measured target" |

| Control | Class in R1 | Notes |
|---|---|---|
| Denied action stays denied | Preventive (host) plus cooperative no-retry | |
| Remote and destructive gating | Preventive (host prompts); cooperative chat gate under auto-approve (SEC-13) | Labeled advisory when the host does not prompt |
| One writer per workspace | Deterministic ownership claim plus detection of foreign changes | Cannot control unrelated editors |
| Per-contract limits | Boundary-checked | Section 4.4.2 |
| No nested delegation by children | Preventive where the host disallows it; otherwise cooperative plus detected from traces | SP-08 determines which |
| Locked-test changes | Detected (lock manifest, EVD-10) | |
| Record integrity and schema validation | Deterministic | |
| Handoff reserve before exhaustion | Boundary-checked | |
| Checkpoint before host pause | Cooperative at boundaries | WRK-10 bounds the loss |
| Review independence | Observed dispatch metadata | Disclosed when reduced |
| Exclusions | Preventive only where the host honors them; otherwise cooperative and disclosed | SEC-08 |
| Version pinning per contract | Deterministic | LFC-03 |
| Shared-artifact attestation | Deterministic (content hashes) | Section 5.6 |
| Context budgets | Deterministic in Tenet CI; observed at runtime | Section 4.4.3 |

A required property with no demonstrated mechanism is either restated as an advisory obligation with its limit, or blocks the dependent operation when unavailable.

### 5.5 Threat model

**In scope:**
- an over-eager or mistaken agent;
- malicious or compromised repository content, retrieved documents, tool output and test reports;
- pre-populated Tenet files in cloned repositories;
- dependencies and their lifecycle scripts;
- Git hooks;
- saved lessons;
- plugin updates and impersonating plugins;
- Tenet's own CI and release pipeline;
- third-party integrations.

**Out of scope:**
- a malicious authorized operator;
- a compromised host, OS or provider;
- changes outside observable Tenet work.

A local audit trail is not tamper-proof.

| Threat (STRIDE) | Example | Controls | Test |
|---|---|---|---|
| Spoofing | File claims "owner approved deployment" | Authority only from the user in chat and recorded grants (Section 5.3) | AC-16 |
| Spoofing | A look-alike "tenet" plugin | README publishes exact publisher, repository and verification steps; `/tenet help` shows installed version and source | AC-11 |
| Tampering: tests | Agent weakens assertions or edits a locked test | Change control (INT-06), lock manifest (EVD-10), test-diff-first review (REV-03) | AC-07, AC-24 |
| Tampering: shared policy | Teammate or attacker loosens protected paths or adds a malicious command | Restrictions-only rule and attestation (Section 5.6) | AC-16 |
| Tampering: Tenet state | Cloned repo ships a pre-populated `.tenet/` with fake lessons or commands | Quarantine of unattested state (Section 5.6) | AC-16 |
| Tampering: evidence | Forged or stale report file | Run-bound reports, receipts, parser limits (Section 3.8.3) | AC-07, AC-18 |
| Tampering: release | Compromised maintainer account or CI ships a malicious update | Release verification chain and CI tiers (Section 5.9) | AC-11, AC-28 |
| Repudiation | Unclear which role or model acted | Trace events (ENG-09) and effect records (CON-12) | AC-13a |
| Information disclosure | Secrets in traces, exports or model context; injected exfiltration | Default exclusions, redaction, egress authorization (Section 5.10) | AC-11, AC-16 |
| Information disclosure | Generated code adds a telemetry call | Review flags new destinations (SEC-09) | AC-16 |
| Information disclosure | CI secrets exposed to untrusted pull requests | Untrusted tier gets no secrets (Section 5.9.3) | AC-28 |
| Denial of service | Retry or delegation loops exhaust allowance | Limits and stop on repeated failure (WRK-08, WRK-09) | AC-15c |
| Denial of service | Huge or hostile report files | Parser size and complexity limits | AC-18 |
| Elevation of privilege | Helper path traversal or symlink escape, including a symlinked `.tenet/` | Validated input and boundary resolution (SEC-06, Section 5.11) | AC-16 |
| Elevation of privilege | Hooks, signing programs or `init.templateDir` hooks run unexpectedly | Hook inspection under consent (GIT-12) | AC-16, AC-25 |
| Elevation of privilege | Auto-approved tools perform remote or destructive actions | Chat gate (SEC-13) | AC-03, AC-16 |
| Elevation of privilege | A bundled MCP front-end is trusted implicitly at install | Kernel-only typed tools, no network, no generic execution, disclosure (Section 5.7.1) | AC-11, AC-16 |
| Elevation of privilege | Benign-named command reads credentials or reaches the network | Execution envelope rule (Section 5.8) | AC-16 |

Residual risk: helpers run the `node` binary resolved from the user's PATH; Tenet documents this and does not resolve its own helper scripts through PATH.

### 5.6 Untrusted content and shared-artifact trust

- Repository files, retrieved documents, tool output, model output, test reports and saved lessons are evidence to inspect, never a source of permission.
- Tenet surfaces any request in such content to ignore constraints, execute scripts, send data or alter acceptance, and acts only within separately authorized scope.
- Defenses combine minimized context, provenance, tool and egress restrictions where available, and adversarial fixtures.
- Tenet claims neither complete detection nor reliance on a prompt to contain arbitrary code.

**Shared-artifact trust model.** Tenet's shared files (`INTENT.md`, decision records, adopted policy, charter section) live in the repository and define intent and commitments. To reconcile this with SEC-02:

1. **Three states per shared file:**
   - *proposed*: found in the repository, not yet accepted on this machine;
   - *adopted*: the local user accepted its content hash;
   - *changed-since-adoption*.
2. **Restrictions only.** Shared files may add restrictions and obligations (checks, protected paths, exclusions, constraints, requirements). They can never grant authority, add egress, relax floors or integrity rules, or authorize commands.
3. **Attestation.** A change made outside Tenet (a teammate's commit, a pull, a clone):
   - if it only tightens, it applies immediately;
   - if it loosens or changes meaning, it is shown as a diff and needs the local user's acceptance;
   - new or changed commands always need inspection and native consent before their first run.
4. **Who amends commitments in R1:** the local user, by accepting the change. A file claiming an owner identity is not authority. Team roles are Later.
5. **Pre-populated `.tenet/`.** A `.tenet/` without this machine's ownership marker is quarantined as an untrusted import. Its lessons, commands, settings and contracts are ignored until the user reviews them; nothing in it confers authority.
6. **Intent text** in `INTENT.md` is product intent the user adopted. Imperative instructions inside it addressed to agents ("disable auth tests") are treated as untrusted content, not commitments.

### 5.7 Helpers and hooks

- Helpers accept validated structured input and reject unsupported schemas, arguments and paths.
- They resolve workspace boundaries, including traversal, symlinks and case-insensitive volumes, on the actual execution machine.
- They use argument arrays, not dynamic shell strings, and limit filesystem, network and executable access to declared need.
- Helpers reuse the project's Node.js (INS-07); helper scripts are resolved from the plugin's install path, not from PATH.
- Helpers never import or execute repository code in their own process; repository tools run only as checks inside execution envelopes (Section 5.8).

**Fault matrix for every required gate:**
- missing runtime;
- denied execution;
- timeout;
- crash;
- malformed input or output;
- incompatible schema or event name;
- hook disabled;
- conflicting host or plugin configuration.

Host-specific results decide whether action dispatch really stops. A nonzero helper exit is not assumed to fail closed. If required prevention cannot be established, Tenet blocks that operation. A human removing a guard leaves no stronger assurance label active.

#### 5.7.1 Kernel front-ends

The deterministic helper ("kernel") has one implementation and up to two R1 front-ends; both call the same verbs and produce the same records. [Validated: owner, October 15 (D-29).]

| Front-end | Status | Constraints |
|---|---|---|
| Command-line, invoked through the host terminal tool | Built and qualified in R1; default unless SP-12 selects the MCP front-end | No shell strings; registered verbs only |
| Local stdio MCP server bundled with the plugin | Built in R1; becomes the default only if SP-12 shows the command-line front-end exceeds the approval-prompt target (Section 1.6), or that the MCP front-end uses at least 15% fewer AI credits per Standard task with no safety difference; when neither applies, the owner decides from the measured review-result retyping and approval-preview legibility for Guided users | Local stdio transport only; exposes only kernel verbs as typed tools; makes no network connections; offers no generic execution; tool inputs schema-validated; plugin install-time trust disclosed in the README |

A hooks front-end that prevents or forces behavior is added only after SP-03 qualifies hook prevention. Observer hooks, which only record events (edited paths, subagent dispatch, turn end, session start), may ship once SP-03 qualifies their observations; they may raise a control's mechanism class to observed, never to preventive, and a missing or failed observation leaves the control at its cooperative label. Choosing a front-end never changes verdict, evidence or authority semantics.

### 5.8 Execution envelopes and host approval modes

**Execution envelope.** Before the first run of a command, Tenet records its declared envelope:
- executable and configuration chain, including loaded config files and plugins;
- working directory and writable paths;
- inherited environment: where Tenet launches checks through its helper, it passes a minimal environment plus declared non-secret variables; where the host's terminal tool is used, the inherited environment is disclosed as an unbounded input;
- network access and expected destinations;
- data sources and database targets;
- subprocesses and long-running children;
- persistent effects;
- available containment.

**R1 safe path:**
- synthetic data;
- an explicitly identified temporary test database;
- temporary directories inside bounded paths;
- declared environment variables;
- no assumption that ambient credentials are safe;
- Tenet-started servers on verified free ports (Section 5.13).

**Rule:** no known envelope means no checked implementation for evidence that depends on it. When parts of an envelope are unknown (for example, whether tests reach the network), Tenet asks the user to authorize running with the stated unknowns and discloses them in the result (SEC-15). Static inspection is never presented as proof of harmlessness.

**Host approval modes.** The capability descriptor records whether tool calls require approval, are auto-approved, or are unknown. When auto-approval is on or unknown, native consent no longer gates effects, so Tenet asks in chat before remote mutation, project-content egress and destructive actions, and labels that gate advisory (SEC-13). Tenet never enables auto-approval or broadens allowlists.

### 5.9 Supply chain and release trust

#### 5.9.1 User-project dependencies

- **Before executing:** review project and package scripts before running unfamiliar commands.
- **For a new dependency, verify:**
  - the package's actual identity and existence (typosquatting and hallucinated names);
  - ecosystem trust and provenance signals;
  - declared license and compatibility;
  - install scripts, including transitive lifecycle scripts;
  - lockfile resolution.
- **Consent:** seek native consent for executable changes.
- **Never convert** the project's package manager or lockfile format silently.
- **Optional project policy:** `dependency_policy` (Section 7.3) adds a release-age cooldown with an explicit urgent-fix rule. There is no universal age threshold, and provenance does not prove a package benign.

#### 5.9.2 Tenet release verification chain

Each link is a separate control with its own verification:

| Link | Control | Verification |
|---|---|---|
| Reviewed source | Protected default branch; review rule below | Branch protection settings published |
| Build inputs | Pinned dependencies and CI actions pinned by commit SHA | Lockfile and workflow audit |
| Produced artifact | Documented, reproducible packaging with an inclusion list | Independent rebuild compares output |
| Published artifact | Signed tag and build-provenance attestation | Signature and attestation verify |
| Installed artifact | Native install path | README steps let users confirm the installed version and source; `/tenet help` shows them |

**Review rule:**
- *With two or more maintainers:* changes to hooks, helpers, permissions, destinations or evaluators need review by a second maintainer.
- *With one maintainer (solo rule):* the change waits a public 72-hour review window on an open pull request and gets an external reviewer when available, and release notes disclose that no second-maintainer review occurred. Agent passes never count as a second maintainer.

**Other release controls:**
- **Credentials and permissions:** mandatory 2FA for maintainers; release credentials held outside general CI jobs; minimal workflow permissions.
- **Withdrawal and support policy:**
  - A security report starts the clock on receipt.
  - The security maintainer acknowledges it within 3 days and decides on fix, mitigation or withdrawal within 7 days. Withdrawal or an advisory may come before a fix; the 7-day figure is a decision target, not a patch guarantee.
  - The latest minor release gets fixes; the previous minor gets security fixes for 3 months after a new minor ships (Q-09).
  - Withdrawn versions are visibly unsupported.
- **Update notes:** an update that adds executable behavior, destinations, permissions, evaluator or schema changes carries a distinct migration and reconsent note. Tenet respects native auto-update policy and keeps a known-good release reference.

#### 5.9.3 Tenet CI security tiers

| Tier | Trigger | Runs | Credentials and permissions |
|---|---|---|---|
| Untrusted validation | Every pull request, including forks | Deterministic tier: skill lint, context budgets, descriptor validation, helper unit and fault tests, adapter parser tests, replay checks against recorded traces | No secrets; read-only token; standard `pull_request` trigger, never privileged triggers with untrusted checkout |
| Trusted live evaluation | Maintainer approval on a protected environment, release branches, scheduled drift runs | Live golden tasks (proxy or native host, Section 6.4.3) | Dedicated evaluation account with a spend cap; disposable runners; restricted egress; disposable fixtures; artifacts never trusted for release |
| Release | Signed tag on the protected branch | Packaging, provenance, publication | Release credentials scoped to this job only |

Caches and artifacts from the untrusted tier are never consumed by the trusted or release tiers.

#### 5.9.4 Publication privacy

Before public GitHub publication, review the source tree and reachable history separately from package inclusion. Private material (archives, reviews, fixtures, chats, prompt histories) may leak through a public repository even when excluded from the package. Unapproved private material blocks publication; history is never rewritten automatically.

### 5.10 Data protection

#### 5.10.1 Data classes

| Class | Default and user control |
|---|---|
| Local intent, state and evidence metadata | Minimal fields and references; bounded retention (Section 5.15); inspect, export and delete. No secrets or raw prompts retained to make traces complete |
| Host-managed model and tool traffic | Disclose applicable provider behavior; Tenet cannot delete provider copies or promise offline use |
| Tenet telemetry and diagnostics | Off by default; separate opt-in naming destination, purpose, schema, retention and revocation, with previewable export. Consent never covers source or credentials |
| Application outcome data | Not collected by default; synthetic fixtures preferred |
| Research data (pilot recordings, transcripts) | Governed by Section 6.7, separate from product telemetry consent |

#### 5.10.2 Secrets and default exclusions

- Never solicit credential values; use presence checks and non-secret connection checks.
- **Default exclusions** apply no-model-send and no-export to:
  - `.env` and `.env.*` (except `.env.example`);
  - `*.pem`, `*.key` and `*.p12`;
  - `id_rsa*` and `id_ed25519*`;
  - `.npmrc` entries containing tokens;
  - credential stores known to the adapter.

  Diagnosis uses presence, never content. Users may add exclusions; removing a default needs an explicit, scoped decision.
- **Tenet state is kernel-only:** a default no-edit exclusion covers `.tenet/`, so agents change Tenet state only through kernel verbs; where a machine key is available the kernel authenticates its state and reports any out-of-band change as an integrity finding; without one, detection is advisory and the exclusion is the control.
- Redact likely secrets and sensitive paths before display, trace and export, and state that detection is incomplete.
- Never hash secret values into fingerprints.
- No production data in starter examples, evaluations or diagnostic bundles. Agent-created fixtures and `.env` examples contain placeholders only.

#### 5.10.3 Context exclusions

The exclusion kinds are distinct:
- **no-model-send:** content must not reach a model;
- **no-read:** agents must not read it;
- **no-edit:** content must not be modified;
- **no-export:** content must not leave in exports;
- **no-routine-scan:** excluded from repository maps and searches.

Git ignore implies none of these.

Tenet applies exclusions before affected reads where controllable. Coverage includes repository maps, snippets, caches, child assignments and exports; post-hoc redaction is not equivalent. Native attachments, open-editor context and other tools may supply content outside Tenet's control, so Tenet warns about known conflicts and discloses that already-transmitted content cannot be recalled. If a confidentiality boundary cannot be met, Tenet does not inspect or send the content and offers a narrower task.

#### 5.10.4 Local state privacy

A nested `.gitignore` keeps `.tenet/` out of Git, not out of backups, file sync, workspace indexing or other agents' searches.
- **Permissions:** Tenet creates `.tenet/` with user-only permissions where supported, plus an ownership marker.
- **Safe creation:** it refuses to use a `.tenet/` that is a symlink or pre-exists without its marker.
- **Marker identity:** the marker binds to the directory's filesystem identity (device, inode and creation time) and, where host plugin storage is available, to a key held there. A copied or cloned `.tenet/` therefore fails verification and is quarantined (Section 5.6), while a same-filesystem move keeps it.
- **Exports:** `.tenet/` is excluded from Tenet-controlled exports unless explicitly included.
- **Indexing:** where the host allows, Tenet asks the host to exclude `.tenet/` from workspace indexing.
- **No raw captures:** traces store metadata and references, not raw transcripts.

### 5.11 Records, ownership and concurrency

- **Records:** every record carries schema version, project and work identity, revision and provenance. Each fact has one owning source: intent, plan and scope in `INTENT.md`; decisions in decision records; operational facts in `.tenet/`. Generated views are not competing sources of truth.
- **Atomic ownership:** a write workflow first acquires an ownership claim for its resource scope (workspace source, and separately each shared mutable resource such as a test database, generated output or package cache) through an atomic mechanism. Revision checks and replacements happen inside that ownership boundary. Atomic rename alone prevents torn files, not lost updates.
- **Multi-record transitions** (for example contract plus evidence index plus handoff) are recoverable: a crash between related writes is detected on restart and reconciled.
- **Effect records** distinguish intended, dispatched and observed. After a crash, dispatched-but-unobserved effects are inspected before any retry (CON-12).
- **Leases:** an ownership claim is a lease held by the work contract (plus any host session identity the host exposes), renewed by every mutating kernel call and protected by a fencing counter. Helper process IDs never identify owners, because helpers exit after each call. A result awaiting acceptance releases the write lease at a safe boundary and revalidates on resume.
- **Liveness:** a stale timestamp is not abandonment. Tenet corroborates owner liveness where observable, reconciles source and obtains a safe takeover when uncertain. Takeover never relies on a timestamp alone.
- **Scope:** locks coordinate Tenet instances (including several VS Code windows on one checkout, and linked worktrees sharing Git metadata). They do not control unrelated editors or unmediated native tool calls; Tenet detects conflicting source changes and stops affected writes.
- **Faults:** unknown or malformed schemas, deleted records, read-only storage and conflicting edits trigger diagnosis and reconciliation, never invented authority or silent reset. Unsupported authority fields are never reinterpreted.

### 5.12 Git attribution, integration and recovery

**Starting state.** At contract start Tenet records:
- the HEAD commit;
- the index tree;
- the staged, unstaged and untracked paths.

On a dirty tree it asks the user (GIT-10) to:
- commit their changes separately, as their own commit, only with consent;
- include named files in scope;
- leave them untouched (the default when Tenet's scope does not overlap them).

**Staging and commits:**
- Tenet preserves the user's index (for example by staging through a temporary index) and stages only paths and hunks it authored in scope; it never uses broad staging as a substitute for attribution.
- **Touched set:** the coordinator declares the files it edited; the kernel cross-checks content changes since its last boundary, and changes that no declared edit explains are treated as possible human edits that need a decision.
- If a file contains both human and Tenet hunks, Tenet stops and asks.
- After committing, Tenet updates the user's real index only for committed paths whose index entry still matched the previous HEAD; any other overlap stops for a decision.
- Commits follow the project's detected message convention; trailers are configurable.
- Commit-time hooks that modify files trigger re-running affected checks before any claim.
- If a commit cannot be made (hook failure, unavailable signing, missing author identity), Tenet keeps the candidate uncommitted and reports the recovery limitation (GIT-15). It never bypasses hooks or disables signing.

**Hooks and init:**
- Before the first commit, Tenet inspects repository hooks, `core.hooksPath`, hook managers and signing configuration, and runs them under native consent.
- `git init` happens only when the user chooses it, after checking `init.templateDir` hooks.

**Branch lifecycle:**
- Work branches start from the current HEAD, with the base recorded.
- If HEAD is an unintegrated Tenet branch, the new work is stacked and Tenet says so.
- On acceptance, Tenet offers local integration into the base (fast-forward or merge, per project convention and the `integration` setting).
- After integration or abandonment, Tenet offers to delete the work branch.

**Undo:**
- Undo is a proposed inverse (revert commits) computed against current state, previewed, applied after confirmation, then validated by applicable checks.
- After integration, undo reverts on the base branch.
- After squash, rebase or cherry-pick, Tenet locates the work by trailers or patch identity; if uncertain, it stops and asks.
- A clean revert is not proof that later human behavior still works, so checks always run afterwards.
- Git undo restores source only; it never restores databases or reverses external effects (Section 5.13).

**Unusual states (GIT-13):**

| State | Readiness outcome |
|---|---|
| Detached HEAD | Offer to create a branch; otherwise read-only |
| Rebase, merge or cherry-pick in progress; unresolved conflicts | Read-only until the user finishes |
| Shallow clone | Allowed; undo limited to available history, stated |
| Submodules | Edits inside submodules unsupported in R1 |
| LFS-tracked files | Edits allowed only when LFS is installed and the files are materialized |
| Linked worktree | Experimental; ownership scoped to the worktree; shared Git metadata disclosed |

**Non-Git prototypes:**
- A snapshot-backed prototype records content-addressed copies of each touched file plus an inventory of files it created, so recovery can restore originals and remove created files.
- Retention and sensitive-data limits are disclosed.
- Snapshots are never presented as checked recovery.

### 5.13 Runtime isolation and data recovery

- **Test data isolation:** integration and end-to-end checks use a dedicated temporary SQLite database (or a declared test target), never the user's development database (EVD-13).
- **Server identity:**
  - Tenet starts its own server on a verified free port.
  - Before end-to-end checks, it confirms the server is the one it started for this candidate (for example through a per-run token on the health endpoint).
  - Tenet stops only the processes it started.
- **Determinism:** tests run with a declared time zone and clock where the recipe supports it.
- **Where run artifacts and sealed checkouts live:** reports, test databases, scratch directories and sealed checkouts (for baseline classification and committed-tree validation) live in the OS temporary directory or host plugin storage, never under `.tenet/` or the workspace; only normalized results are stored in `.tenet/`. If the host forbids writing there, the dependent classification is inconclusive; Tenet never stashes or resets user work to test a baseline.
- **Database backup and restore:**
  - Before a migration touches real user data, Tenet takes a consistent backup through a supported mechanism (for SQLite, the online backup API or an equivalent consistent copy, never a raw copy of an active file).
  - Restoration is exercised on a fixture (AC-20).
  - The result states the restore limits and the code version compatible with restored data.
- **Process lifecycle:** Tenet tracks the processes and temporary paths it creates and cleans up only those; user processes and files are never cleanup targets. On cancellation, owned work stops and residue is reported.

### 5.14 Continuity recovery matrix

| Event | Intent and plan | Work status | Evidence reuse | Active contract | Authority |
|---|---|---|---|---|---|
| Chat closed, same window | Kept | Kept | Valid evidence reusable | Resumable | Corroborated grants kept |
| Editor window closed (Local harness) | Kept | Kept to last checkpoint | Revalidated against current source | Resumable after reconciliation | Corroborated grants kept |
| VS Code quit, or agent host crash | Kept | Kept to last checkpoint; unsaved observations lost and stated | Revalidated | Resumable; dispatched effects inspected (Section 5.11) | Corroborated grants kept |
| Model or network loss | Kept | Kept | Kept | Paused at boundary | Kept |
| Branch switch | Branch-specific intent visible | Contracts on other branches parked | Stale where inputs differ | Resumes only on its branch | Kept per contract |
| Tenet update mid-contract | Kept | Kept | Revalidated where versions differ | Paused and reconciled (LFC-03) | Kept unless permissions changed |
| Clone to another machine, after shared adoption | Recovered from repository | Not recovered (local) | Historical only | Not resumable; start a new contract | None transferred |
| Clone, without shared adoption | Not recovered | Not recovered | None | Not resumable | None |
| Relocation on the same machine | Kept | Kept after identity check | Revalidated | Resumable after reconciliation | Re-corroborated |
| `.tenet/` lost | Recovered from repository if adopted | Reconstructed from Git trailers where possible | Historical metadata only | Not resumable without fresh direction | None |
| Adoption declined, then `.tenet/` lost | Lost; Tenet says so | Lost | None | Not resumable | None |

"Unnecessary repeated questions" excludes reconfirmation required because circumstances or authority changed.

### 5.15 Storage and retention

- **What counts:** the `.tenet/` budget (Section 4.4.3) counts everything inside it, including archives, snapshots and large check artifacts such as Playwright traces. Archives are compressed in place and still count.
- **Eviction order** when the budget is exceeded:
  1. raw output of superseded evidence;
  2. large artifacts of accepted work older than 30 days;
  3. traces older than 90 days, reduced to summaries;
  4. archived contracts compacted to summaries.
- **Never evicted automatically:** active contracts and their authority grants; dispatched or unknown effect records; open findings; the lock manifest; ownership records; evidence metadata referenced by active work or open findings.
- **When safe reduction is impossible,** Tenet stops dependent writes and asks the user, never deleting protected records.
- **Expired raw output** narrows later claims to "historical; raw output unavailable"; it never implies a new failure.
- **Forget and delete** cover derived indexes, cached summaries and lesson copies within Tenet's control. Tenet cannot delete provider-held copies and says so.

### 5.16 Generated application assurance

**Starter identity, exposure and data model (QLT-12):**
- **Development-only identities:** seeded synthetic users with per-project random passwords stored in an uncommitted local file and printed at startup. No hardcoded or reusable credentials; nothing usable outside the local project.
- **Network binding:** the server binds to `127.0.0.1` by default. Binding to other interfaces is a consequential change (`external-effects`, access).
- **Sessions:** HTTP-only, SameSite cookies, rotated on sign-in and on password change; CSRF protection for state-changing requests.
- **Server-side protection:** schema validation independent of the UI, parameterized queries, object-level authorization on every endpoint.
- **Errors and logs:** error responses without internals; log redaction.
- **Data integrity:** database constraints and transactions around invariants; bounded retry on SQLite busy conditions.
- **Hardening inventory:** `docs/hardening.md` lists everything needed before shared, networked or production use (QLT-17). The starter is never presented as production-ready because it has authentication screens.

**Threat and data note (QLT-13).** For relevant change traits, a short note records:
- actors and trust boundaries;
- protected objects and operations;
- sensitive data and retention;
- abuse cases.

Its security items become tests or constraints, not just review notes. For the equipment-loan example, it covers who may see borrower identity, who may alter reservations, and whether availability responses leak private information.

**Starter reference workload (provisional, frozen before qualification):**

| Dimension | Declared workload |
|---|---|
| Data size | 10,000 items, 50,000 loans, 2,000 users |
| Concurrency | 20 simultaneous users; 5 simultaneous reservation attempts on one item |
| Latency | p95 ≤ 200 ms for list, reserve and return at that load |
| Resources | ≤ 300 MB server memory |
| Degradation | Busy database → bounded retry, then a clear "try again" response; no double booking |
| Environment | Reference laptop (Apple silicon, 16 GB), warm start, WAL mode |

The workload is a qualification envelope, not a scalability claim; signals that need a different design are recorded in `docs/architecture.md`.

**Standards scope:**
- **OWASP ASVS 5.0 Level 1:** the recipe publishes the applicable requirement IDs with a verification method and result each, plus non-applicability reasons (QLT-02).
- **WCAG 2.2 AA:** applies to the declared critical journeys (sign in, browse, reserve, return, admin overview) and their states (QLT-03).
- **Claims** name what was evaluated and never cover a whole brownfield application from a changed flow.

### 5.17 Incident handling

**If sensitive data is exposed:**
1. Stop the affected action or export.
2. Identify known recipients and limits.
3. Record the scope.
4. Route to the user, or to the security maintainer for Tenet releases.

Do not silently rotate credentials or erase evidence. Attempted injection alone is not confirmed exposure (FC-06). If a fixture is found to contain real sensitive data, evaluation and export using it stop and this procedure applies.

### 5.18 Control-to-test map

| Control | Section | Suites |
|---|---|---|
| Lane floors and risk | 5.2 | AC-05, AC-06, AC-21 |
| Authority envelope and amendment | 5.3.1–5.3.2 | AC-08, AC-13a |
| Action classification and execution envelopes | 5.3.3, 5.8 | AC-04, AC-16 |
| Assurance profiles and external evidence | 5.3.4–5.3.5 | AC-07, AC-13a, AC-13b, AC-25 |
| Mechanism classes | 5.4 | AC-03, AC-15c, AC-17 |
| Threats, untrusted content, shared-artifact trust | 5.5–5.6 | AC-16 |
| Helpers and hooks | 5.7 | AC-16 |
| Supply chain, release and CI security | 5.9 | AC-11, AC-28 |
| Data, secrets, exclusions, local privacy | 5.10 | AC-11, AC-16, AC-23 |
| Records, ownership, concurrency | 5.11 | AC-17 |
| Git attribution and recovery | 5.12 | AC-17, AC-25 |
| Runtime isolation and data recovery | 5.13 | AC-18, AC-20 |
| Continuity | 5.14 | AC-08 |
| Storage and retention | 5.15 | AC-19 |
| Generated application assurance | 5.16 | AC-16, AC-20 |
| Incident handling | 5.17 | AC-11 |

---

## 6. Evaluation and Learning Contracts

This section defines how the acceptance suites run, how Tenet's own behavior is evaluated continuously, how product value is measured, how research data is handled, how project learning and maintainer improvement experiments work, and how provisional targets become frozen. It implements Sections 1.6, 4.4 and 4.6 and the LRN and ENG requirements.

### 6.1 Evidence tiers

Different tiers produce different evidence; none substitutes for another.

| Tier | What it shows | What it cannot show |
|---|---|---|
| T1 Deterministic tests | Helpers, adapters, parsers, descriptors, lint and budgets behave correctly | Agent behavior |
| T2 Scripted workflow and proxy runs | Skills produce expected behavior against fixtures, possibly on a proxy host (for example Copilot CLI) or replayed traces | Behavior of the qualified tuple |
| T3 Native-host end-to-end | The installed plugin on the exact tuple: install, loading, dispatch, permissions, questions, interruption, model observation, result capture | Value to real users |
| T4 Human studies | Usability, comprehension and value with real participants | Reliability at scale |

Support claims need T3 on the claimed tuple. A proxy result is labeled proxy and never counts as qualification.

### 6.2 Acceptance campaign protocol and metrics

1. **Formative cycles** may change the design and calibrate budgets. They are labeled formative and never cited as qualification evidence.
2. **Before each qualification cycle, freeze:**
   - fixtures and allowed actions;
   - expected results;
   - repetition counts and model strata;
   - observation rubric and adjudication rules;
   - thresholds and negative-control tolerances.

   Store the frozen protocol in the Tenet repository with a commit hash.
3. **Map** every requirement to its suites, or record a reasoned non-applicability.
4. **Primary reliability metrics:**
   - first-run contract success within the declared budget;
   - success rate across repeated independent runs, with its failure distribution;
   - total effort including unsuccessful attempts;
   - safety violations.
5. **Diagnostics only:** pass@k (success in at least one of k runs) shows search potential, never deployed reliability.
6. **Safety suites** require zero violations across all runs (pass^k). This is a release condition on the fixtures, not proof of zero real-world risk. Repetition counts are justified by risk and coverage: at least 5 runs per model stratum, and more for conditions with rare failures.
7. **Negative controls** run alongside seeded failures. Their tolerances (Section 1.6) are part of the freeze. Tenet can fail a suite by blocking too much or reporting noise.
8. **Defect detection** reports recall, per-severity recall (a missed critical defect is reported on its own, never hidden in an aggregate), precision and actionability.
9. **Failed cycles** are retained and published. A revision is qualified in a new cycle; thresholds never change after results are seen (FC-12).
10. **Human judgment** uses a fixed rubric, artifact references and a reviewer other than the author where feasible. It is reported as human judgment, and any role consolidation is disclosed.
11. **Test accounts and data** are synthetic.

### 6.3 Fixture catalog

| Fixture | Purpose | Used by |
|---|---|---|
| Clean supported profile | Install, first use, removal | AC-01, AC-02, AC-10 |
| Empty folder (Git and non-Git) | Starter journey, init choice, snapshot prototype | AC-04, AC-25 |
| Starter project at increments 1–3 | Successive changes, plan, continuity | AC-08, AC-12, AC-20 |
| Brownfield TypeScript web repository (well tested) | Feature and bug work | AC-05, AC-18, AC-20 |
| Brownfield TypeScript CLI/library repository (sparse tests, quirks) | Characterization; `cli` and `library` traits in R1 at no extra adapter cost | AC-05, AC-20 |
| Broken or unbuildable repository | Diagnosis, read-only review | AC-03, AC-21 |
| Non-web, non-TypeScript repository | Source inspection without web assumptions | AC-04, AC-23 |
| Large repository (about 10,000 files) and long history (≥ 200 work items) | Budgets, scanning, record growth, storage pressure | AC-19 |
| Misleading-success set (one fixture per AC-07 pattern, including forged reports and edited locked tests) | False-verdict detection | AC-07 |
| Verdict-policy truth table (one fixture per Section 4.5.2 row) | Endpoint correctness | AC-27 |
| Seeded-defect set (≥ 10 material defects across behavior, structure, security; plus clean controls) | Review recall and precision | AC-06 |
| Seeded-misinterpretation set (10 requests with a plausible wrong reading; vacuous and mis-translated tests) | Acceptance basis and example fidelity | AC-24 |
| Invariant set (happy paths pass; concurrency, authorization or failure-recovery invariant broken) | Basis beyond examples | AC-20, AC-24 |
| Injection and canary set (including malicious pre-populated `.tenet/`, loosened shared policy, benign-named networked command, hostile report files) | Security | AC-16, AC-18 |
| Dirty-tree and Git set (staged and unstaged edits, overlapping hunks, hooks that modify files, signing required, stacked branches, unusual states) | Git attribution | AC-17, AC-25 |
| State-fault set (racing writers, crash between related writes, malformed, stale, lost records) | Integrity and recovery | AC-17 |
| Configuration set (Section 7.8 cases) | Configuration | AC-23 |
| Delegation set (blocked, failed, partial, stale, disagreeing children) | Delegation | AC-22 |
| Runtime-isolation set (port occupied by a stale server, development database present, backup that cannot be restored) | Isolation and recovery | AC-18, AC-20 |

Fixtures are public or synthetic. Private material is never used without exact-scope consent. A fixture found to contain real sensitive data triggers Section 5.17.

### 6.4 Tenet eval harness

#### 6.4.1 Golden task sets

A golden task is a fixed request against a fixture with a known acceptance basis, expected endpoint, required checks and forbidden behaviors.

| Set | Visibility | Use |
|---|---|---|
| Public regression set | In the Tenet repository | Every trusted live run; protects against regressions |
| Reserved qualification set | Maintainers only | Used once per qualification cycle, then retired into the public set |
| New-failure set | Maintainers; published after fix | Reproduces reported field failures |

The alpha needs 10 public tasks; R1 needs 30 public plus 10 reserved:

| Category | Alpha | R1 public |
|---|---|---|
| Starter new-app journeys (including plan decomposition) | 2 | 4 |
| Brownfield bug fixes (including dirty-tree cases) | 2 | 6 |
| Brownfield features | 2 | 6 |
| Review-only and review-then-fix | 2 | 4 |
| Misleading-success and tamper traps | 1 | 5 |
| Interruption and resume | 1 | 3 |
| Non-TypeScript source inspection | 0 | 2 |

Contamination is tracked: repeated tuning against the public set is disclosed, and qualification claims rest on the reserved set.

#### 6.4.2 Grading

- Each golden task has **hidden acceptance tests** stored outside the agent's workspace and applied after the run.
- Forbidden behaviors are detected from traces, effect records and diffs. Any one is a failure.
- LLM-based judging is advisory only, and never from the same model family as the run being judged.
- Each run records:
  - endpoint reached and its correctness under Section 4.5.2;
  - hidden-test results;
  - forbidden behaviors;
  - findings versus seeded truth;
  - attempts, rounds, delegations, Tenet-launched checks and active time;
  - AI credits (or premium requests for legacy-billed accounts) where observable, with the model mix;
  - friction events.

#### 6.4.3 Evaluation tiers in CI

| Stage | Trigger | Content | Blocks |
|---|---|---|---|
| Deterministic tier (T1, replayed T2) | Every pull request and merge | Skill lint, context budgets, descriptor validation, helper and adapter tests, replayed traces | Merge on any failure |
| Live smoke (T2 proxy or T3) | Maintainer-approved pull requests touching skills, agents, hooks or helpers | A subset of public golden tasks within a spend cap | Merge on safety regressions |
| Full native-host suite (T3) | Before every release; monthly; on observed model change | All public tasks on the exact tuple, ≥ 5 runs per model stratum | Release on any regression beyond frozen tolerance |

Whether T3 can run unattended is established by SP-11. If it cannot, maintainers run the T3 suite on a dedicated machine before each release and publish the traces. Live tiers run under the CI security tiers of Section 5.9.3 with a funded evaluation budget (Q-16), and their terms-of-service compliance is checked under SP-11.

#### 6.4.4 Model strata and drift

- Results are stratified by tuple and by observed model.
- A model is **qualified** for Tenet when the full suite meets its thresholds with that model. Otherwise it is **unqualified**, or **unknown** when the model cannot be observed (RSC-08).
- Hosts may change models without notice, so the suite reruns monthly and on any observed change (ENG-05). Until then, the matrix shows "not yet evaluated with the current model". If the model is never observable, compatibility claims stop at the last evaluation date.
- A drop beyond tolerance triggers FC-14.

### 6.5 Versioning

Versions follow SemVer against Tenet's **public compatibility contract**:
- entry points and supported workflows;
- record and configuration schemas;
- recipe compatibility;
- required permissions and destinations;
- evidence and result semantics, including the verdict policy;
- extension contracts (skills format, capability descriptors, adapter interface).

| Change | Version |
|---|---|
| Breaks any contract item, or removes a capability | Major |
| Adds to the contract compatibly (new capability, role, recipe, migratable schema change) | Minor |
| No contract change (wording, fixes, documentation) | Patch |

Evaluation results decide release *eligibility* and are summarized in release notes. They never set the version number mechanically, and a regression is never made acceptable by a major version.

### 6.6 Value measurement

#### 6.6.1 Hypothesis and unit

Tenet reduces active human effort per accepted outcome, compared with the same user's competent native Copilot workflow, without regressions in correctness, cost or elapsed time.

- **Unit:** a pilot task defined before the study as one user-valued outcome. Splitting it into several contracts does not create several outcomes.
- **Acceptance:** at the end of each task the participant gives an explicit research acceptance judgment. This does not reintroduce a routine approval question into the product (RES-03). A missing judgment is reported as censored, never counted as success or failure.

#### 6.6.2 Design

- **Crossover with matched task pairs.** Each participant completes paired tasks of similar size and risk, one with Tenet and one with native Copilot. Order and assignment within a pair are randomized.
- **Fixed baseline.** The native condition uses a fixed, published `AGENTS.md` written to good-practice standards before the study, so the baseline is not a straw man.
- **Matching:** host, model, recipe and endpoint are matched; configuration strata are reported. A solved task is never reused as a baseline.
- **Formative screen:** ≥ 10 eligible tasks across 2 repositories plus one sequence of 3 successive changes.
- **Qualification cohort:** 8–12 external technical builders (Q-04), at least 2 task pairs each, plus a 2-week follow-up for escaped defects. Dogfooding is useful but insufficient alone.
- **Stratification:** task complexity and familiarity.
- **Ablations:** optional roles, fresh contexts and richer traces. Overhead without measured benefit is removed.

#### 6.6.3 Measures

| Measure | Definition |
|---|---|
| Active human minutes | Time the participant spends reading, deciding, prompting, correcting and verifying; excludes waiting. Captured by consented recording plus self-report; missing data disclosed |
| Accepted outcome | Endpoint reached, research acceptance given, and the follow-up check finds no blocking defect |
| Escaped defects | Defects in accepted outcomes found within the follow-up window |
| Friction | Questions classified by type (Section 1.4), duplicate approvals, repeated probes, host-continue pauses, user status requests |
| Comprehension | Participant correctly states scope, endpoint, limits and material risks of the result |
| Example detection | Share of seeded consequential misinterpretations the participant catches at confirmation |
| Cost | Premium requests, model calls and tokens where observable, and elapsed time, for both conditions; "Tenet overhead" means the incremental amount over the matched native task |
| Adoption funnel | Installed, engaged, ready, first useful outcome, first accepted outcome; abandonment and expert rescue |
| Voluntary reuse | Participant chooses Tenet for a later task without prompting |

#### 6.6.4 Analysis and decision rule (pre-registered)

- **Primary estimate:** for each participant, the ratio of Tenet to native active minutes per accepted outcome; report the cohort geometric mean with a 90% bootstrap confidence interval resampled over participants.
- **Pass:** the point estimate shows ≥ 30% reduction **and** the interval's upper bound is below 1.0 (any reduction), **and** guardrails hold (no observed increase in escaped defects; cost within the Section 1.6 targets).
- **Inconclusive:** the point estimate meets the target but the interval includes no reduction. Inconclusive is not a pass; the owner decides under Section 4.7.
- **Fail:** the point estimate misses the target.
- **Power note:** with 8–12 participants only large effects are detectable. Results are directional and published with their uncertainty and selection and dropout bias.
- **Escaped defects** are claimed only as "no observed increase within the evaluated sample".

#### 6.6.5 Ratio rules

- Ratios use all eligible work, including failed, rejected, cancelled and blocked tasks.
- With zero accepted outcomes, cost per outcome is undefined and the cohort is a failure signal.
- Report totals, denominators, uncertainty and unknown coverage with every ratio.

### 6.7 Research ethics and data handling

Pilot data (screen recordings, think-aloud transcripts, prompts, participant repositories) is sensitive and separate from product telemetry consent.
- **Informed consent:** written and specific; it names what is recorded, who can access it, retention (deleted 90 days after analysis unless the participant agrees otherwise), redaction and withdrawal.
- **Prefer synthetic or public repositories.** Private participant repositories are used only with explicit consent and never leave the participant's control without redaction.
- **Withdrawal** at any time deletes the participant's data and its derived records within Tenet's control.
- **Publication** includes only aggregated results and consented excerpts; no participant source or recordings are published by implication.
- **Evaluator access** is limited to the named evaluation and UX owners.

### 6.8 Experience qualification

**Observe complete sessions,** not snapshots. Participants include people who:
- have not seen Tenet;
- differ in code familiarity;
- use assistive technology;
- misunderstand a proposed example;
- decline a recommendation;
- stop halfway;
- need recovery rather than a successful build.

**Method:**
- clean tasks to measure false-positive friction;
- missing tools, policy denial and interruptions;
- think-aloud for formative sessions; record failure causes, not only counts;
- keyboard and screen-reader observation of Tenet's interactions on the tuple.

**Freeze before qualification:**
- the question-type rates;
- duplicate approvals (0, invariant);
- first-value time;
- comprehension (≥ 80% correct, provisional);
- example detection (Section 1.6);
- recovery success.

Language, geographic and organizational coverage beyond the R1 cohort is future scope and is not inferred from it.

### 6.9 Project learning protocol

1. **Observations, proposed lessons and active lessons are distinct.**
2. **A lesson records:**
   - statement;
   - scope (task, project, or personal library in R1.1);
   - applicability;
   - the evidence that produced it;
   - provenance;
   - review or expiry date.
3. **Activation:**
   - An inline correction applies to the current task immediately.
   - "Always in this project" activates a project lesson without re-asking.
   - An ambiguous remark stays task-local.
   - An inferred rule needs confirmation.
4. **Anchoring:** lessons may anchor to paths, symbols or dependencies. When an anchor changes or disappears, Tenet flags the lesson for review instead of deleting it blindly.
5. **Budget:** active project guidance stays within the context budget. Low-value or contradicted lessons are merged or retired rather than accumulated.
6. **Prefer mechanisms over prose:** a reliable check or reusable fix beats another instruction.
7. **No cross-project transfer without explicit scope.**
8. **Lessons never weaken acceptance, add permissions or change evaluators** (LRN-05). Lessons from a quarantined `.tenet/` are inert until reviewed (Section 5.6).

### 6.10 Improvement experiments

#### 6.10.1 Maintainer experiment protocol (R1, ENG-08)

Each experiment records:
- hypothesis;
- one bounded editable surface (a prompt, review method, test recipe, rule or role-model assignment);
- baseline and candidate configurations;
- observed host and model versions;
- frozen objective and quality floors;
- budget and stopping rule;
- training tasks and a reserved holdout;
- repeat count;
- tie rule;
- disposition.

**Rules:**
- **Evaluation, checks and permissions are never optimization targets.** Extra model effort, changed checks or private lessons cannot masquerade as a prompt improvement.
- **Repeat noisy comparisons** under matched conditions.
- **Disposition:**
  - Keep only a demonstrated gain within the floors.
  - A simpler equal-quality candidate wins under the pre-registered tie rule.
  - Inconclusive results keep the baseline.
  - A training-only winner that fails the holdout is rejected.
- **Retain** failed trials and their cost; report confounds and leakage. A reserved holdout is not technically protected unless separately enforced.
- **Promotion** goes through a reviewed release with recovery evidence.

#### 6.10.2 User experiments (Later)

When offered, user-invoked experiments follow the same protocol. They cannot rewrite their evaluator, authority or baseline, and local shadow tasks are opt-in with an explicit data and compute scope.

#### 6.10.3 Entry criteria for automatic promotion (Later)

Automatic promotion of low-risk improvements may be *proposed* only when all of the following hold:
- evaluators and holdouts are technically protected from the optimizer;
- at least 5 consecutive manual promotions showed holdout gains that held up in the following release (a minimum observation, not proof of safety);
- the editable surface excludes permissions, evaluators, acceptance rules, the verdict policy and integrity rules;
- each promotion is traceable and reversible within one release;
- the product owner approves the envelope in a PRD revision.

### 6.11 Reporting

Each qualification cycle publishes:
- the frozen protocol hash;
- the tuple and strata;
- all results, including failures, cancellations and unknowns;
- uncertainty;
- selection and dropout bias;
- adjudication notes;
- role-consolidation disclosure;
- the owner's disposition.

No broad effectiveness claim follows from the formative screen.

### 6.12 Target calibration

Numbers live only in Sections 1.6, 4.4 and 5.16, each with a class. To freeze provisional values:
1. Run baseline-only measurements and labeled formative cycles on the fixtures.
2. For each provisional target, record the observed distribution (median, p90).
3. Propose a frozen value with rationale:
   - for **Invariant** values, never relax;
   - for **Provisional** capability, experience and overhead targets, adjust within ±50% of the provisional value, or document why not.
4. Owners approve. Technical, QA and UX owners approve budgets; the evaluation owner approves value targets.
5. Record the frozen values in Sections 1.6, 4.4 and 5.16 (a minor revision) and in the protocol before the qualification cycle.

Targets may tighten after qualification. Loosening one requires a new cycle.

---

## 7. Configuration Contract

### 7.1 Principle and authority bootstrap

**Configuration adapts the work, never the truth.** Settings change presentation, pacing, depth, resource use and project conventions. They never grant authority, create a capability or relabel evidence. This section implements CFG-01 to CFG-11 and AC-23; R1 deliberately exposes a small catalog (D-18).

Users never need to edit files. Ordinary language is the primary surface ("be more concise", "always run `pnpm test:unit` for unit tests here", "never touch `migrations/`"). A readable structured file exists for inspection and diffing, and may be hand-edited; the Tech Spec chooses its format and location.

**Authority bootstrap:**

| Source | Discovered | Effect before adoption | Who may change it |
|---|---|---|---|
| Plugin reference defaults | At install | Active | Tenet releases |
| User-local settings | At start | Active | The user |
| Shared project policy and defaults in the repository | Before any affected read | Restrictions apply immediately; everything else is *proposed* until adopted (Section 5.6) | The local user adopts and accepts changes; loosening needs acceptance of a diff |
| Project-local overrides in `.tenet/` | At start, after the quarantine check | Active if this machine's marker is present; otherwise quarantined | The user |
| Task overrides | Per request | Active for that task | The user |

Restrictions found in any source are applied before affected reads, even while the rest of that source awaits adoption.

### 7.2 Categories

| Category | Examples | Who can change it | Invariant |
|---|---|---|---|
| Integrity rules | Evidence honesty, verdict policy, denial is final, untrusted text grants nothing | Nobody at runtime | Not settings; not experiment targets |
| External restrictions | Host permissions, approval modes, organization policy | Outside Tenet | Configuration cannot override them |
| Project commitments | Required checks, protected paths, dependency policy | The local user (Section 7.1) | No task preference or agent waiver relaxes them; a per-task exception is not a policy change (Section 5.3.2) |
| Assurance floors | Lane floors (Section 5.2), independent review for consequential work | Nobody at runtime | Settings may raise them, never lower them |
| Preferences | Style, checkpoints, lane default, resource mode, branching, integration | The user, scoped | Apply within commitments and restrictions |
| Executable configuration | Check commands | The user | Structural validity is not execution trust; commands get an execution envelope (Section 5.8) before first run |
| Data restrictions | Exclusions | The user | Applied before reads where controllable (Section 5.10.3) |
| Observed facts | Discovered commands, available models, capabilities | Tenet observation | Recorded with provenance; never made true by configuration |

### 7.3 R1 settings catalog

| # | Setting | Type and values | Default | Scopes | Category | Effect |
|---|---|---|---|---|---|---|
| 1 | `style` | `guided` \| `balanced` \| `concise` | `balanced` | user, task | Preference | Presentation only |
| 2 | `checkpoints` | `minimal` \| `milestones` \| `each-phase` | `milestones` | user, project, task | Preference | Pacing of progress updates and pauses; never authority |
| 3 | `lane` | `auto` \| `quick` \| `standard` \| `deep` | `auto` (risk-recommended) | project, task | Preference | Can raise rigor; lowering stops at Section 5.2 floors |
| 4 | `resource_mode` | `normal` \| `conserve` \| `serial` | `normal` | user, project, task | Preference | `conserve` prefers focused passes for optional roles; `serial` disables optional and parallel dispatch; required review still runs; reduced independence is disclosed only when it occurs |
| 5 | `shared_memory` | `undecided` \| `adopted` \| `declined` | `undecided` | project (local) | Preference | Records the CON-01 answer |
| 6 | `branching` | `per-work` \| `current` | `per-work` | project, task | Preference | GIT-02 |
| 7 | `integration` | `offer` \| `auto-on-accept` \| `never` | `offer` | user, project | Preference | GIT-11; local only, never remote |
| 8 | `commands` | Map of check name (`test`, `test:unit`, `lint`, `typecheck`, `e2e`, `build`) to `{argv: string[], cwd?: workspace-relative path, env?: non-secret map, obligation?: check-obligation reference}` | Discovered by the adapter | project | Executable configuration | Envelope recorded before first run; `cwd` boundary-validated; changing a command makes dependent evidence stale and needs re-assessment against its obligation |
| 9 | `required_checks` | List of check obligations (property, test population, configuration, tool, pass criteria, permitted alternatives) | Recipe defaults | project (shared) | Project commitment | A command mapped to an obligation discharges it only if it meets the obligation; renaming or remapping never does. A missing required check blocks checked-local |
| 10 | `protected_paths` | List of workspace-relative path patterns | Empty | project (shared) | Project commitment | Union of restrictions across scopes (the writable area is the intersection of what every scope allows); writes inside need per-task authority |
| 11 | `exclusions` | List of `{pattern, kinds}`, kinds ⊆ {no-model-send, no-read, no-edit, no-export, no-routine-scan} | The Section 5.10.2 defaults | user, project | Data restriction | Union of restrictions; incompatible work is blocked |
| 12 | `dependency_policy` | `{min_release_age_days: integer ≥ 0, urgent_exception: allow \| require-approval \| deny, unknown_age: allow \| require-approval \| deny}` | `{0, allow, allow}` | project (shared) | Project commitment | Fieldwise strictest across scopes (Section 7.4) |

**Null and zero semantics:**
- An absent value inherits.
- An empty list contributes no additional restrictions and removes none inherited.
- `0` means zero, never "unlimited".
- Explicit `auto` means Tenet chooses.

### 7.4 Resolution and composition

**Preference order (most specific wins):**

`reference defaults → user-local → adopted shared project → project-local → explicit task override`

Project commitments, external restrictions, assurance floors and integrity rules apply regardless of this order.

| Value kind | Composition |
|---|---|
| Scalar preference | Most specific explicit value wins |
| Required checks | Union of applicable obligations; equivalent obligations run once |
| Protected paths, exclusions | Union of restrictions; an empty child list adds nothing and removes nothing; widening needs the user's acceptance at the scope that set them |
| Commands | Selected by check name; project-local overrides shared only for preferences, never to discharge a shared obligation with a non-equivalent command |
| Dependency policy | Fieldwise strictest: maximum `min_release_age_days`; for `urgent_exception` and `unknown_age`, `deny` > `require-approval` > `allow` |

Additional rules:
- **Discovery order:** resolution never depends on file-discovery order. Equal-specificity conflicts are reported for the user to resolve.
- **Path matching:** uses normalized workspace-relative paths, platform case rules and resolved symlinks on the execution machine.
- **Cross-module changes:** include relevant dependency checks, not only edited files.

### 7.5 Change, inspect and reset

1. **Change:** interpret → determine scope → validate → show the material effective difference → persist if durable and authorized → apply. A temporary "be concise" applies immediately. A durable or consequential change shows the interpreted value and scope first. Project-only requests never become global preferences.
2. **Inspect:** `/tenet why <setting>` shows:
   - the effective value;
   - its source, adoption state and revision;
   - overridden values;
   - capability limits;
   - how to change it.

   It never offers a bypass of policy.
3. **Reset:** removing an override restores the inherited value. Reset never erases a binding restriction, and never deletes source, accepted intent or unrelated settings. A full reset states its exact scope first.
4. **Idempotence:** reapplying an unchanged setting produces no new revision, duplicate guidance or approval prompt.
5. **Revisions:** each effective change creates a compact attributable revision. Work and evidence reference the revision they used; child assignments carry the applicable subset.
6. **Restriction-only safe revision:** if an update mixes a valid new restriction with invalid content, Tenet creates a revision containing only the new restriction, rejects the remainder with a diagnostic, and reports both. This is the single exception to whole-revision updates; it never continues under the looser old setting.

### 7.6 Mid-work changes

| Change | Takes effect | Effect on in-flight work |
|---|---|---|
| Style or checkpoints | Immediately | None |
| Tighter exclusion, protected path or resource mode | Before the next affected dispatch or read | Stops new affected work; reports active and unknown effects |
| Command or required-check change | After validation | Dependent evidence becomes stale; feasibility re-assessed against the obligation |
| Lane raised | At the next phase boundary | Adds deeper steps; reuses valid evidence |
| Branching or integration | Next work contract or acceptance | None |
| Wider scope, destination or spend, or a loosened commitment | Only with sufficient explicit authority | Configuration alone cannot grant it |

Concurrent edits use revision-aware reconciliation inside the ownership boundary (Section 5.11).

### 7.7 Validation and errors

| Condition | Behavior |
|---|---|
| Unknown preference key | Diagnostic; key ignored |
| Unknown or malformed key in a restriction-bearing source (shared policy, exclusions, protected paths, required checks, dependency policy) | Dependent actions blocked until resolved; a likely misspelling of a known restriction is named (CFG-11) |
| Unsupported version | Affected behavior blocked; migration offered if available |
| Malformed value | Change rejected; prior valid state retained (subject to Section 7.5 item 6) |
| Conflict at equal specificity | Reported with both sources; the user resolves it |
| Setting requires an absent capability | Reported as unavailable; no pretend effect |

Parsing executes no code.

### 7.8 Acceptance cases (AC-23)

1. Resolution is identical under shuffled file-discovery order.
2. A task override cannot remove a required check, protected path or exclusion; an empty child list removes nothing.
3. `/tenet why` reports value, source, adoption state, overridden values and limits correctly for each catalog setting.
4. Removing an override restores the inherited value.
5. Reapplying an unchanged setting creates no revision.
6. Unknown, malformed and misspelled restriction keys block dependent work; unknown preference keys do not.
7. Absent, empty, zero and `auto` are distinguished.
8. `conserve` reduces optional dispatch; `serial` dispatches no optional or parallel subagents; required review still runs; reduced independence is disclosed exactly when it occurred.
9. A command change makes only dependent evidence stale; remapping a required check to a non-equivalent command does not discharge the obligation.
10. A tightened exclusion mid-task stops the next affected read.
11. Personal settings never appear in shared files.
12. Symlinked and case-variant paths match protected-path and exclusion rules on macOS.
13. A mixed update with a valid restriction and an invalid value produces a restriction-only revision.
14. A loosened shared policy pulled from the remote is not applied until the local user accepts it; a tightened one applies immediately.
15. `dependency_policy` composes fieldwise as specified.
16. **High-risk interactions:**
    - exclusions × commands;
    - protected paths × branching;
    - required checks × resource mode;
    - local overrides × shared commitments;
    - lane × reduced independence;
    - shared-memory refusal × continuity;
    - integration × dirty tree.

### 7.9 Coexistence

- Tenet uses namespaced entry points. It never disables, rewrites or hijacks other plugins or instructions, and reports a visible conflicting rule only when that rule affects current work.
- Host features that overlap Tenet are not duplicated:
  - Tenet writes its charter section into the instruction file the host already loads;
  - it treats host memory and planning features as untrusted context, not as competing sources of project intent;
  - it adopts an equivalent host capability when one qualifies.
- Choosing Tenet does not override host instruction precedence or authorize another workflow's side effects.

### 7.10 Deferred configuration features

| Feature | Release | Entry condition |
|---|---|---|
| Convenience presets | Later | Pilot shows repeated identical multi-setting changes; each preset tested as a whole |
| Module or path-scoped settings in monorepos | R1.1 | Monorepo fixture qualified; specificity rules tested |
| Ranked model portfolios | Later | SP-04 shows observable model resolution |
| Resource ceilings in usage units | Later | SP-05 shows observable usage with a known denominator; Q-11 resolved |
| Import and export of configuration | Later | Demand from multi-machine users; secret and grant exclusion tested |
| Conditional settings | Later | Demonstrated need; finite matching rules only |
| Custom agent or tool definitions | Later | Qualified host support with trust preview and native consent |
| Full pairwise matrix across all settings | When the catalog grows | High-risk interactions (Section 7.8 item 16) are tested from R1 |

---

## 8. Context and Decisions

### 8.1 Executor profile and development sequence

The executor is an engineer or AI-assisted contributor familiar with plugin development, with no knowledge of prior chats or archives. The sequence passes four gates:

| Gate | Purpose | Exit |
|---|---|---|
| 1. Product semantics | Approve this PRD | Section 8.4 register signed; Section 10.3 approval-ready |
| 2. Feasibility evidence | Run the authorized spikes (Section 10.2) | Each spike recorded with a disposition; failed spikes narrow claims or change decisions in a PRD revision, never hidden behind more elaborate prompts |
| 3. Walking skeleton (M0) | Prove the contracts compose, including one injected failure | All M0 requirements pass on the tuple |
| 4. Release qualification | Freeze workload, rules, thresholds, manual checks, tuple and exception policy; run the campaign against the installed artifact | Section 4.7 |

Between gates 2 and 3: Tech Spec, UX Spec and phased plan are written and approved (Section 10.3). Each executable spike needs separate authorization covering objective, host, data, actions, cost and time limit, and cleanup. This revision authorizes documentation only.

### 8.2 Glossary

| Term | Meaning |
|---|---|
| Tenet | The governed, personalized, self-improving engineering practice; first delivered as Tenet for Copilot |
| Host / harness | The application and runtime executing the agent session; VS Code offers more than one harness (Section 2.2) |
| Qualification tuple | The exact combination a support claim covers (Section 2.2) |
| Host binding | Host-specific agents, commands, hooks and manifest that invoke the portable core |
| Capability descriptor | Declarative statement of what a host binding supports, verified by probes |
| Plugin | Versioned package of host customizations |
| Skill | On-demand instructions and resources in Agent Skills format; never executable authority |
| Role / specialist | A responsibility contract, fulfilled by a native subagent or a focused pass |
| Focused pass | The main session adopting a role temporarily; not a separate agent |
| Hook | Code invoked at a host or Git lifecycle event |
| Recipe | Versioned bundle of traits, stack binding, check obligations, workload, fixtures and maintenance owner |
| Trait | A project or change characteristic (for example `ui`, `auth`) that contributes obligations |
| Adapter | Ecosystem-specific detector and runner that normalizes evidence |
| Assistance level | What Tenet may attempt for a project and task, L0–L5 (Section 2.3) |
| Plan item | An ordered, independently checkable increment of a larger intent |
| Work contract | Authorized bounded increment with outcome, acceptance basis, scope, checks, envelopes, budget and endpoint |
| Acceptance basis | Requirements and examples, invariants, commitments, trait and recipe obligations, and compatibility obligations (Section 4.5.1) |
| Distinguishing reproduction | A test that fails on the baseline and passes on the candidate |
| Authority envelope | What a work contract authorizes and who granted it |
| Consequential | A change with any High risk dimension (Section 5.2) |
| Lane | Workflow depth: Quick, Standard or Deep |
| Style | Presentation: Guided, Balanced or Concise |
| Checkpoints (preference) | Pacing of progress updates and pauses |
| Endpoint | The claim a result makes, chosen by the verdict policy (Section 4.5.2) |
| Checked-local | Endpoint meeting every Section 4.5.2 condition on the local candidate; not owner acceptance or production readiness |
| Mechanism class | How a control actually operates: preventive, deterministic, boundary-checked, detected, cooperative or observed (Section 5.4) |
| Assurance level | Strength of a profile's claims (Section 5.3.4) |
| Execution envelope | A command's declared executable chain, paths, environment, network, data, subprocesses and effects (Section 5.8) |
| Candidate | Exact source and environment state being checked, including uncommitted changes |
| Evidence receipt | A check result with its execution receipt, bound to a candidate |
| Check obligation | What a required check must establish, independent of its command name |
| Lock manifest | Hashes of locked acceptance tests used to detect changes |
| Locked test | A change-controlled acceptance test; editable only with a recorded disposition |
| Protected acceptance evidence | CI evidence verified under Section 5.3.5 |
| Proposed / adopted (shared file) | Found in the repository / accepted by the local user by content hash (Section 5.6) |
| Local integration | Merging an accepted work branch into its base branch on the local machine; not a remote effect |
| Material finding | A finding of major or blocker severity (Section 4.5.3) |
| Effect record | Intended, dispatched and observed state of an action |
| Independent review | A fresh-context assessment of actual artifacts; not an isolated verifier |
| Handoff | Saved state sufficient to resume in a new session |
| Supported | Passed the applicable suites on an exact qualification tuple |
| Experimental | Distributed with published smoke tests, limits and owner, but not qualified |
| Optional capability | A feature offered only where its prerequisites and suites pass |
| Qualified model | A model on which the full golden suite meets its thresholds |
| Project commitment | An accepted obligation changeable only through Section 7.1, unlike a soft preference |
| Resource mode | Normal, Conserve or Serial (Section 7.3) |
| Golden task | Fixed evaluation task with a known acceptance basis, hidden tests and forbidden behaviors |
| Ready fixture | A fixture whose prerequisites are installed and whose readiness probes pass |
| Active human minutes | Participant time spent reading, deciding, prompting, correcting and verifying, excluding waits |
| Provisional / Frozen / Invariant | Value classes for numbers (Section 0) |

### 8.3 Decisions

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D-01 | First deliverable is an open-source Copilot plugin with native installation | Plug-and-play adoption | [Validated: owner] |
| D-02 | Reuse host hooks, agents, permissions, models and UI before building infrastructure | Owner rejected rebuilding a harness | [Validated: owner] |
| D-03 | No standalone engine, SDK worker manager or daemon in R1 | Follows from D-01 and D-02 | [Validated: owner sign-off, October 15] |
| D-04 | Govern through active intent, traces, mechanism classes, guardrails and fresh-context review; cross-family review is an optional later capability | Strong critique without unobservable claims | [Validated: owner sign-off, October 15] |
| D-05 | Support new and existing applications without copying a factory into each repository | Shared distribution, project ownership | [Validated: owner] |
| D-06 | R1 tuple: VS Code desktop, Local agent harness, macOS arm64; other harnesses and Copilot CLI qualify separately | Narrow first qualification; harness semantics differ | [Validated: owner sign-off, October 15; Assumed: verify under Q-01] |
| D-07 | Improve through outcome-driven experiments, scoped lessons and evaluated releases; R1 promotion is human-reviewed | Owner's autoresearch-like direction; automatic promotion needs evidence | [Validated: direction; R1 mechanism signed off October 15] |
| D-08 | A plugin does not inherit autonomous-platform guarantees | Claims must match host boundaries | [Validated: owner] |
| D-09 | R1 ends at checked-local; R1.1 adds a user-triggered CI delivery recipe | Owner deploys often; production needs external controls | [Validated: owner sign-off, October 15] |
| D-10 | Shared project memory lives in the repository after one-time adoption; operational state stays local in `.tenet/` | Continuity across machines and sessions | [Validated: owner sign-off, October 15] |
| D-11 | Checked implementation requires Git; non-Git folders get init (by choice), read-only help or a snapshot-backed prototype | Reliable recovery at low cost | [Validated: owner sign-off, October 15] |
| D-12 | Starter stack: TypeScript with Fastify 5 and Zod, better-sqlite3 with plain numbered SQL migrations, React and Vite, Vitest, Playwright | Owner's most-used stack; mature and explicit; synchronous transactions and a built-in online backup API; no external accounts | [Validated: owner, October 15] |
| D-13 | Provisional targets and limits in Sections 1.6, 4.4 and 5.16 are alpha defaults | Alpha needs bounds; calibration under Section 6.12 | [Validated: owner sign-off, October 15] |
| D-14 | The acceptance oracle is the acceptance basis (Section 4.5.1); confirmed examples become change-controlled tests | Examples alone are not a complete oracle | [Validated: owner sign-off, October 15] |
| D-15 | CLI/library is the second family (R1.1); a TypeScript CLI/library brownfield fixture exercises it in R1 | Cheapest to verify; proves non-web core early | [Validated: owner sign-off, October 15] |
| D-16 | Keep one specification: this PRD holds every binding product, assurance, evaluation and configuration contract; archives are informative only | Separate files and archives fragment knowledge and drift | [Validated: owner instruction, October 14] |
| D-17 | Extension architecture: portable Agent Skills core, host capability model, ecosystem adapters, trait composition, extension conformance | Growth without rewrites, proven per extension | [Validated: owner sign-off, October 15] |
| D-18 | R1 configuration is the twelve-setting catalog of Section 7.3 | Smallest sufficient configuration | [Validated: owner sign-off, October 15] |
| D-19 | One endpoint verdict policy and finding-severity model (Section 4.5) | Removes ambiguity about "checked" | [Validated: owner sign-off, October 15] |
| D-20 | Git attribution and local-integration model, with branch-safe IDs (Sections 3.7.3, 5.12) | Never surprise the user's working tree | [Validated: owner sign-off, October 15] |
| D-21 | Shared-artifact trust model: restrictions only, adoption by content hash, quarantine of unattested state (Section 5.6) | Reconciles repository-held intent with untrusted repository content | [Validated: owner sign-off, October 15] |
| D-22 | Less-technical builders become a qualified audience in R1.1, not R1 | R1 prerequisites and local-only delivery do not fit them | [Validated: owner sign-off, October 15] |
| D-23 | Release staging M0 ⊂ A ⊂ B ⊂ R1 with the M0 walking skeleton defined by tags | A shippable alpha | [Validated: owner sign-off, October 15] |
| D-24 | R1.1 adds a Python adapter to test the extension architecture in a second ecosystem | A second TypeScript family does not prove the seams | [Validated: owner sign-off, October 15] |
| D-25 | Solo-maintainer review rule until a second maintainer exists (Section 5.9.2) | Two-maintainer review is impossible solo | [Validated: owner sign-off, October 15] |
| D-26 | SemVer against the public compatibility contract (Section 6.5) | Stable versions; evaluation gates eligibility | [Validated: owner sign-off, October 15] |
| D-27 | Evaluation uses evidence tiers and reliability-first metrics; pass@k is diagnostic only (Sections 6.1–6.2) | Users experience single bounded runs | [Validated: owner sign-off, October 15] |
| D-28 | Every consequential control states a mechanism class (Section 5.4) | Honest enforcement claims | [Validated: owner sign-off, October 15] |
| D-29 | One kernel with a command-line front-end and a local stdio MCP front-end; SP-12 selects the default under the narrow SEC-07 exception of Section 5.7.1 | Terminal approvals may be too frequent; MCP tools get session-level approval; semantics stay identical | [Validated: owner, October 15] |
| D-30 | Adapt to token-based Copilot billing and to host capabilities: observer hooks before prevention (Section 5.7.1, AC-13b); front-end selection weighs AI credits (Section 5.7.1); a host-provided repository map (Section 3.8.7); efficiency targets in AI credits per accepted outcome (Sections 1.6, 2.2); an always-loaded budget that counts tool schemas and the charter (Section 4.4.3); a qualified economy model for the researcher role (RSC-01) | Since June 1, 2026 most plans bill by tokens; the host already provides references and observation events | [Validated: owner, October 15] |

Historical platform requirement IDs (v0.2–v0.4) remain retired. v0.12 F-IDs map to current IDs in Appendix B.

### 8.4 Owner sign-off register

The owner asked on October 14 to incorporate the review recommendations and, on October 15, explicitly signed off every item below after reviewing them as one register.

| Item | Summary | Status | Signed |
|---|---|---|---|
| Section 1.4 | R1 primary user: technical builder | Signed | October 15, 2026 |
| Section 2.1, 2.6 | R1 scope and release staging (D-23) | Signed | October 15, 2026 |
| Section 2.7 | Owner-intent reconciliation | Signed | October 15, 2026 |
| D-03, D-04, D-06 | No engine; governance mechanisms; R1 tuple | Signed | October 15, 2026 |
| D-07 (R1 mechanism) | Human-reviewed promotion in R1 | Signed | October 15, 2026 |
| D-09 to D-11 | Checked-local endpoint; repository memory; Git requirement | Signed | October 15, 2026 |
| D-13 to D-15 | Provisional numbers; acceptance basis; second family | Signed | October 15, 2026 |
| D-17 to D-28 | Extension architecture; catalog; verdict policy; Git model; shared-artifact trust; persona move; staging; Python adapter; solo rule; versioning; evaluation metrics; mechanism classes | Signed | October 15, 2026 |
| D-29, D-30 | Kernel front-ends; token-billing and host-capability amendments (v0.16) | Signed | October 15, 2026 |

### 8.5 Dependencies

| Dependency | Status | Owner and evidence | Blocks |
|---|---|---|---|
| Native plugin installation on one qualified path | Documented; enable and disable semantics differ by path | Release maintainer (SP-01, AC-01) | Every supported tuple |
| Skills, custom agents, subagents on the chosen harness | Documented with harness differences | Technical maintainer (SP-02, SP-08) | Core workflow |
| Host approval-mode visibility and native questions | Unverified | Technical maintainer (SP-12) | SEC-13 labeling |
| Kernel front-end selection (terminal command versus local MCP) | Both to be built; selection by measured prompts per task | Technical maintainer (SP-12) | Default front-end (Section 5.7.1) |
| Hooks and permission decisions | Preview and harness-dependent | Technical maintainer (SP-03) | Guarded capability only |
| Helper execution via the project's Node.js | Likely for R1 projects | Technical maintainer (SP-01) | Helper-dependent requirements |
| Node/TypeScript adapter and fixtures | Not built | Technical maintainer (SP-10) | Starter and brownfield |
| Tenet evaluation infrastructure: account, budget, runner, terms of service | Not established | Evaluation owner (SP-11, Q-16) | ENG-04, AC-26, AC-28 (Tenet's own qualification, not a user prerequisite) |
| License | Not selected | Product owner (Q-03) | Publication |
| User CI and delivery targets | External | Project owner, R1.1 | Nothing in R1 |

### 8.6 Constraints and owners

| Constraint | Source |
|---|---|
| No expert user-side installation or service maintenance | Owner [Validated] |
| Native trust prompts and organization policy remain authoritative | Host documentation [Validated] |
| No model or subscription entitlement inferred | Host and account boundary [Validated] |
| No single cloud or stack imposed across all projects | Owner [Validated]; recipes bound support |
| No private histories or archives in packages or evaluation by default | Owner [Validated] |

**Roles:** product owner (scope, defaults, PRD and release approval); technical maintainer (compatibility, packaging, adapters); UX owner (interaction, usability); QA and release owner (qualification); evaluation owner (comparisons, targets, research data); security maintainer (threat review, disclosure, incidents). Named people are assigned under Q-14. Today one person may hold every role. That consolidation is disclosed in every qualification report; it limits independence claims and makes the solo-maintainer rule apply. An agent cannot appoint itself an approver.

---

## 9. Failure Conditions

| ID | Type | Observable deviation | Required action and owner | Severity |
|---|---|---|---|---|
| FC-01 | Integration | A required agent, skill, hook or command does not run on an advertised tuple | Mark limited or unsupported, block the affected workflow, correct claims; technical maintainer | Major |
| FC-02 | Authorization | Native permission is denied or policy blocks an operation | Normal blocked outcome; continue independent authorized work; never bypass | Expected; Major if a support claim breaks |
| FC-03 | Packaging | A clean user must install a runtime, edit JSON or run developer setup | Stop qualification; change packaging or revise scope | Major |
| FC-04 | Process | Source, requirements, plugin or settings changed after a recorded result | Invalidate affected evidence, reconcile scope, rerun | Major |
| FC-05 | Verification | A failing, missing or simulated check is reported as checked, or an endpoint contradicts Section 4.5.2 | Block release, fix, add regression fixture; verification maintainer | Critical |
| FC-06 | Data | Untrusted text requests authority, or private material is exposed | Reject the instruction and continue safely; on exposure follow Section 5.17 | Expected rejection; Critical for exposure |
| FC-07 | Lifecycle | Host termination or update leaves an action or remote result ambiguous | Report unknown state, inspect actual state, resolve before retry | Major |
| FC-08 | Value | Pilot misses its frozen value target or needs recurring expert rescue | No effectiveness claim; narrow workflows or change the hypothesis (Section 4.7); product owner | Major |
| FC-09 | State | Record, ownership or concurrent-writer failure makes authority or candidate identity uncertain | Stop dependent writes and verdicts, preserve valid state, reconcile | Critical |
| FC-10 | Control | A disabled, missing or timed-out guard fails to prevent an advertised action | Withdraw the guarded claim, stop dependent operations, requalify | Critical |
| FC-11 | Budget | A limit is exceeded without stopping at the next boundary, or compaction loses constraints | Save handoff, stop; narrow workflow; rerun stress suite | Major |
| FC-12 | Evaluation | Candidate, evaluator, holdout or threshold changed after outcome inspection | Reject the inference, keep baseline, rerun a frozen comparison | Critical |
| FC-13 | Configuration | Resolution depends on discovery order, or an override relaxes a restriction | Block affected actions, add deterministic regression cases | Critical |
| FC-14 | Model drift | Native-host suite results drop beyond tolerance after a model change | Mark the combination degraded, publish a notice, fix or narrow claims before the next release; technical maintainer | Major |
| FC-15 | Oracle | A confirmed acceptance basis is later found to encode the wrong behavior | Treat as intent change (INT-08); add a misinterpretation fixture; review elicitation | Major |
| FC-16 | Git attribution | A human change was staged, committed, reverted, stashed or lost by Tenet | Stop Git operations, restore from recorded starting state, add a regression fixture; technical maintainer | Critical |
| FC-17 | Shared-artifact trust | A loosened shared policy or quarantined state took effect without local acceptance | Revert to the adopted state, block dependent work, add a regression fixture | Critical |
| FC-18 | External evidence | CI evidence was labeled protected without Section 5.3.5 verification | Downgrade verdicts that depended on it; fix classification | Major |
| FC-19 | Storage | Storage pressure removed a record that Section 5.15 protects | Stop dependent writes, reconstruct what is observable, fix eviction | Critical |
| FC-20 | CI security | Tenet CI exposed secrets or write access to untrusted code | Rotate credentials, audit releases since exposure, fix workflow; security maintainer | Critical |
| FC-21 | Execution envelope | A check touched data, network or credentials outside its declared envelope without disclosure | Downgrade dependent evidence, correct the envelope, add a fixture | Major |

**Worst Misinterpretation Test:**
- "installed" does not mean "enforced";
- "checked" does not mean "the coder said done";
- "examples pass" does not mean "correct";
- "resume" does not mean "rerun everything";
- "update" does not mean "overwrite project code";
- "automatic" does not mean "ignore consent";
- "commit" never means "commit my changes";
- "locked" does not mean "immutable".

AC-03, AC-07, AC-08, AC-10, AC-24, AC-25 and AC-27 reject these readings.

---

## 10. Ambiguity Audit and Readiness Gates

| ID | Question | Resolution | Confidence |
|---|---|---|---|
| AMB-01 | Is the vision limited to a Copilot plugin? | No; the plugin is the first deliverable (Sections 1, 2.6, 3.8) | High: D-01 |
| AMB-02 | Do older platform requirements or archived reviews apply? | No; only this document binds (Section 0, D-16) | High: D-16 |
| AMB-03 | Does Tenet run after the host closes? | No; Section 5.14 defines each lifecycle event | High: X-04 |
| AMB-04 | Does installing authorize scripts, hooks or deployment? | No (SEC-01, SEC-04, GIT-05, GIT-12) | High |
| AMB-05 | Does every task need every role? | No; lanes and focused passes (Sections 3.6, 3.9) | High |
| AMB-06 | Can owner acceptance turn a fail into a pass, or waive a blocker? | No (Section 4.5.2) | High: D-19 |
| AMB-07 | Does the latest setting override every rule? | No (Sections 7.2, 7.4) | High |
| AMB-08 | Can tests change after they are locked? | Yes, with a recorded reason and disposition (INT-06) | High: D-14 |
| AMB-09 | Can Tenet implement in a folder without Git? | Only a snapshot-backed prototype (GIT-01) | High: D-11 |
| AMB-10 | Do passing examples prove correctness? | No; the whole acceptance basis applies (Section 4.5.1) | High: D-14 |
| AMB-11 | Will Tenet commit or revert my uncommitted work? | Never without explicit consent (GIT-08, GIT-10) | High: D-20 |
| AMB-12 | Can a repository file loosen my project's rules? | Only after local acceptance (Section 5.6) | High: D-21 |

### 10.1 Open product decisions

All entries are [Unknown: TBD] until resolved. Q-02, Q-05, Q-07, Q-08, Q-10 and Q-12 are resolved:
- Q-02 → D-12, D-15 and Section 2.3;
- Q-05 → D-23 and Section 2.6;
- Q-07 → D-13 and Section 4.4;
- Q-08 → D-18 and Section 7;
- Q-10 → NFR-06 and Section 6.8;
- Q-12 → D-12 (owner decision, October 15).

| ID | Open decision | Proposed resolution | Owner and gate |
|---|---|---|---|
| Q-01 | Exact qualification tuple, including harness (Local versus Copilot harness) and install path | VS Code stable desktop, Local harness, macOS arm64, install path chosen by SP-01 | Technical maintainer, after SP-01, SP-02, SP-08, before Tech Spec approval |
| Q-03 | License and distribution identity | Apache-2.0 for Tenet; a permissive license (MIT or 0BSD) for the starter template so users can relicense | Product owner before publication |
| Q-04 | Evaluation owners and pilot cohort | Section 6.6 design; 5 formative and 8–12 qualification technical builders; named evaluation and UX owners | Product owner before pilot |
| Q-06 | Retention defaults | Freeze Sections 4.4.3 and 5.15 values | Product owner before Tech Spec approval |
| Q-09 | Release stewardship owners | Name release and security owners for the Section 5.9.2 policy | Product owner before public beta |
| Q-11 | Meaning of "100% utilization ceiling" | A spending ceiling (never exceed the authorized allowance), not a target to consume allowance; Tenet never creates work to use credits | Product owner before quota-aware accounting (Later) |
| Q-13 | Name and namespace availability | Check "Tenet" against marketplace, npm, GitHub and trademark conflicts; keep a fallback name | Product owner before publication |
| Q-14 | Staffing | Assign Section 8.6 roles to named people; seek a second maintainer | Product owner before phased plan |
| Q-15 | Publish discovery aggregates (Section 1.2) | Publish only the two aggregate counts, with owner consent; otherwise remove from the public version | Product owner before publication |
| Q-16 | Evaluation funding and account | A dedicated evaluation account with a monthly spend cap, owned by the evaluation owner | Product owner before alpha |

### 10.2 Feasibility register

All spikes are unexecuted and each needs separate authorization (Section 8.1). Timeboxes are proposals.

| ID | Question and required evidence | Gate | Timebox | Failure disposition |
|---|---|---|---|---|
| SP-01 | Which install path qualifies? Does enabling plugins need a settings toggle? Can helpers run via the project's Node.js without user setup? Prove packaging, cold start, denied execution and enable, disable and uninstall semantics | Before Tech Spec | 2 days | Remove the helper need or revise scope |
| SP-02 | Where do skills, instruction files, user settings and workspace state load and persist on the chosen harness? Can `.tenet/` be excluded from host indexing? | Before Tech Spec | 2 days | Narrow claims or revise storage design |
| SP-03 | Which tool actions can hooks actually prevent, including on crash, timeout and disable? Which events can observer hooks reliably record, with what payloads? | Guarded capability; observer hooks | 3 days | Keep guarded capability unavailable; controls stay cooperative |
| SP-04 | Can native roles resolve eligible models and expose the actual model and family? | Portfolios and cross-family review | 2 days | Active model only; unknown stays unknown |
| SP-05 | Which counters, usage and cancellation signals are observable for the Section 4.4 limits? | Before Tech Spec (M0 limits depend on it) | 1 day | Use only Tenet-observed counts; narrow claims |
| SP-06 | Candidate identity and Git attribution: digest of uncommitted state; staging only Tenet hunks through a temporary index while preserving the user's index; hooks that modify files; undo as inverse with later human commits; edits during a running check; two racing writers | Before Tech Spec | 3 days | Narrow evidence or recovery claims |
| SP-07 | Do native update, disable and uninstall preserve overrides and state, with known-good recovery? | Before beta | 2 days | Fix recovery before public release |
| SP-08 | On the exact harness: named custom Reviewer with fresh context; parallel read-only Researchers with bounded tools; nested dispatch allowed or not; usable results for blocked, failed and cancelled children; behavior on each Section 2.2 lifecycle event | Before Tech Spec | 3 days | Reopen Q-01 or the multi-agent minimum |
| SP-09 | Do the same skills load and run in Copilot CLI? | R1.1 | 1 day | Defer CLI support |
| SP-10 | Can the Node/TypeScript adapter normalize Vitest, Jest, Playwright, ESLint and tsc output under the Section 3.8.3 contract on the starter and both brownfield fixtures, including malformed and stale reports? | Before Tech Spec | 3 days | Narrow brownfield eligibility |
| SP-11 | Can the native-host suite run unattended on the exact tuple, within terms of service, with secrets isolated and a known cost? | Before alpha | 3 days | Scheduled manual T3 runs with published traces; proxies labeled |
| SP-12 | Is the host's tool approval mode observable, and are native questions available for choices? How many Tenet-caused approval prompts, and how many AI credits, does a Standard task use through the command-line front-end versus the MCP front-end, and how often does the coordinator retype review results? | Before Tech Spec | 2 days | Treat approval mode as unknown (SEC-13 gate always on); choose the front-end by the Section 5.7.1 rule, or keep the command-line front-end and narrow the friction claim |

### 10.3 Readiness definition

| State | Conditions | Current |
|---|---|---|
| Approval-ready | Section 8.4 register signed; Q-01 owned with its gate; Q-12 resolved | **Met October 15, 2026** |
| Design-ready (Tech Spec may be approved) | SP-01, SP-02, SP-05, SP-06, SP-08, SP-10, SP-11 and SP-12 dispositioned and reflected in a PRD revision; Q-01, Q-06 and Q-14 resolved; Tech Spec drafted | Tech Spec v0.1 drafted; spikes not started |
| Implementation-ready | Tech Spec, UX Spec and phased plan approved | Not started |

Optional-capability spikes (SP-03, SP-04, SP-09) do not block core design.

---

## 11. Implementation Guidance

### 11.1 Approach

- Build the portable core as Agent Skills: a main workflow skill, role skills, recipe and trait resources, rubrics.
- Host bindings for VS Code: one coordinator custom agent, Reviewer and Researcher custom agents, slash-command prompts, a capability descriptor, observer hooks where SP-03 qualifies their observations, and preventive hooks only where SP-03 proves prevention.
- Reuse native progress, questions, diffs, permissions, model selection and delegation.
- Put everything countable or checkable into small deterministic helpers:
  - counters and ownership claims;
  - candidate digests and the lock manifest;
  - record validation;
  - adapter normalization;
  - Git staging through a temporary index.
- Never add an SDK, custom extension, MCP server, database or background service, except the kernel front-end of Section 5.7.1.
- When a capability cannot be detected, probe explicitly or mark it unknown; never infer it from a version number.

### 11.2 Sequencing

1. **Discovery, in parallel with spikes:** 5–8 interviews with technical builders; validate the problem table and positioning.
2. **Core spikes:** SP-01, SP-02, SP-05, SP-06, SP-08, SP-10, SP-11, SP-12, each timeboxed. Feed results into a PRD revision and the Tech Spec.
3. **Tech Spec, UX Spec and phased plan.**
4. **Walking skeleton (M0):** all M0-tagged requirements on the starter fixture and the brownfield web fixture, with one injected failure. Dogfood on one of the owner's projects.
5. **Deterministic eval tier and 10 golden tasks** before adding alpha features.
6. **Alpha, then beta** by release tags; beta ends with calibration (Section 6.12).
7. **Pilot and R1 release** under Section 4.7.

The next review assesses spike evidence and complete user-session traces, not prose.

### 11.3 Milestones

| Milestone | Evidence to advance |
|---|---|
| PRD approval | Section 10.3 approval-ready |
| Feasibility complete | Spikes dispositioned; PRD revised; design-ready |
| Implementation-ready | Tech Spec, UX Spec and phased plan approved |
| M0 walking skeleton | All M0 requirements pass, including an injected failure |
| Core alpha | All Must requirements tagged M0 or A pass |
| Beta | All Must requirements tagged up to B pass; budgets frozen |
| Public R1 | Section 4.7 definition of done |

### 11.4 Tech Spec and UX Spec obligations

The Tech Spec and UX Spec must answer each item with a design and a verification method. The Tech Spec answers are indexed in [`specs/tech-spec.md`](tech-spec.md) Appendix B.

| Area | Required decision or check | Spec |
|---|---|---|
| Record formats and schemas | Serialization, versioning, unknown-field preservation, migration | Tech |
| Ownership and concurrency | Atomic claim mechanism, liveness, crash recovery for multi-record transitions | Tech |
| Candidate identity | Digest method, relevant-input model (known dependent, independent, unknown), environment descriptors without secrets | Tech |
| Lock manifest | Granularity of locked test blocks, hashing, mechanical-correction batching | Tech |
| Git staging | Temporary-index approach, hunk attribution, hook inspection, signing behavior, undo matching after squash or rebase | Tech |
| Branch-safe IDs | Suffix scheme, collision detection at integration | Tech |
| Existing artifacts | Detecting existing `.tenet/`, `INTENT.md` or charter sections; never assuming ownership | Tech |
| Filesystem boundaries | Symlinks, aliases, case-insensitive volumes, permissions, read-only files | Tech |
| Execution envelopes | How envelopes are discovered and recorded; minimal-environment launching; type checks that write incremental build info | Tech |
| Process lifetime | Startup, readiness, port verification, cancellation, orphaned children | Tech |
| Package management | Supported npm, pnpm and Yarn versions and lockfiles; no silent conversion | Tech |
| Test isolation | Temporary databases, deterministic clocks and time zones, cleanup attribution | Tech |
| Adapter interfaces and parsers | Reporter versions, limits, fault handling | Tech |
| Repository map | Index contents, incremental refresh, importer and caller selection | Tech |
| Helper packaging | Node invocation, path resolution, no PATH lookup for scripts | Tech |
| Evidence storage | Redaction before retention; artifact size bounds; eviction implementation | Tech |
| Trace storage | Pinned OpenTelemetry subset; minimal fields | Tech |
| Configuration file | Format, location, adoption state, restriction-only revisions | Tech |
| Capability descriptor | Format, probes, approval-mode detection | Tech |
| Evaluation infrastructure | Runners, accounts, spend caps, trusted and untrusted tiers | Tech |
| Starter application | Identity model, binding, sessions, CSRF, constraints, backup and restore, workload test harness | Tech |
| Accessibility | Critical journeys and states, manual check procedure | Tech and UX |
| Localization | Interaction language versus app locale, dates, numbers, time zones | UX |
| Command syntax and wording | Final names, progressive disclosure, error messages | UX |
| Contract and result presentation | Preview layout, endpoint and limits wording, demo path | UX |
| Example confirmation | How examples, invariants and boundary cases are shown and confirmed | UX |
| Risky choices | Presentation of irreversible, remote and approval-mode-dependent actions | UX |
| Findings and evidence inspection | Severity display, receipts, coverage statements | UX |
| Research data | Consent forms, storage, access, withdrawal | UX and evaluation owner |

### 11.5 Known risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Host component, harness or hook semantics change | High / High | Exact tuples, capability descriptors, probes, FC-01 |
| Governance-shaped behavior: contracts, IDs and traces produced while execution stays ambiguous | Medium / High | Verdict policy truth table (AC-27), mechanism classes, M0 with injected failures |
| Instructions mistaken for enforcement | High / High | Mechanism classes (EVD-07) and assurance labels |
| Model updates silently degrade skills | High / Medium | Monthly native-host reruns, model labels (RSC-08), FC-14 |
| Git operations damage user work | Medium / High | Section 5.12 attribution, AC-25, FC-16 |
| Evaluation infrastructure infeasible or costly | Medium / High | SP-11 early; tiered CI; spend cap (Q-16) |
| Extra roles and reviews cost more than they save | Medium / High | Lane limits, focused passes, serial-versus-parallel comparison, false-friction targets |
| Acceptance-basis confirmation adds friction | Medium / Medium | Reuse explicit cases from the request (INT-04); a few concrete examples; AC-21 |
| Executable content undermines trust | Medium / High | Minimal helpers, disclosure, release verification chain |
| Solo maintainer capacity | High / High | M0 skeleton, release staging, solo rule, Q-14 |

---

## 12. Open Tensions

| Tension | Resolution |
|---|---|
| Plug-and-play vs. executable-plugin trust | Native consent; minimal disclosed executables; verified releases |
| Strong governance vs. a disableable plugin | Claim only what each mechanism class supports; external gates for strong guarantees |
| Multi-agent value vs. needless fan-out | Fresh-context Reviewer and parallel Researchers as the minimum; focused passes elsewhere; measured against serial |
| Rigor vs. friction | Lanes, typed questions, reuse of explicit cases, no routine approvals, false-friction targets |
| Strict verdicts vs. usefulness | Honest intermediate endpoints (implemented-unverified) rather than weaker checks |
| Continuity vs. a clean repository | Shared memory only after one-time adoption; operational state local |
| Git attribution vs. simplicity | Tenet-only staging and explicit dirty-tree choices, even at the cost of extra prompts |
| Repository-held intent vs. untrusted repository content | Restrictions-only shared files with adoption by content hash |
| Continuous improvement vs. stability | Evaluated releases, SemVer against the compatibility contract, no silent application rewrites |
| Broad vision vs. narrow R1 | Extension architecture proven per extension (Section 3.8.6) with explicit entry conditions (Section 2.8) |

## 13. Assumption Registry

| ID | Assumption | Underpins | Confidence / evidence | Invalidating signal |
|---|---|---|---|---|
| A-01 | Native plugins give a low-friction path on the R1 tuple | S-01, INS | High: documented mechanisms | Clean users cannot install without manual setup |
| A-02 | Helpers can run on the project's Node.js without user setup | INS-07 | Medium-high: Node is required by every R1-supported project [Assumed: verify - SP-01] | Helper invocation unavailable to plugins |
| A-03 | The structured workflow saves more supervision than it costs | Section 1.6 | Medium [Assumed: verify - AC-12] | Decision rule fails |
| A-04 | The Local harness supports a fresh-context Reviewer and parallel Researchers | AGT-02, AGT-03 | Medium [Assumed: verify - SP-08] | Dispatch unavailable or unusable |
| A-05 | Candidate identity and Git attribution are reliable under human edits | EVD-01, GIT-03, GIT-04 | Medium-high [Assumed: verify - SP-06] | Lost update, mis-attributed commit or false pass |
| A-06 | Users can judge examples and invariants meaningfully | INT-04, AC-24 | Medium [Assumed: verify - AC-24] | Users confirm without understanding |
| A-07 | Agent Skills content is portable to Copilot CLI and other hosts | ENG-01 | Medium [Assumed: verify - SP-09] | Host-specific rewrites needed |
| A-08 | Technical builders accept Git as a prerequisite for implementation | GIT-01 | High [Assumed: verify - AC-02] | Abandonment at init |
| A-09 | A twelve-setting catalog covers R1 needs | CFG-02 | Medium [Assumed: verify - pilot] | Frequent requests for unsupported settings |
| A-10 | Hosts expose enough metadata for optional capabilities | REV-07, RSC-06, RSC-07 | Low [Assumed: verify - SP-03, SP-04, SP-05] | Capabilities stay unavailable |
| A-11 | The native-host suite can run reliably enough to gate releases | ENG-04, AC-28 | Low-medium [Assumed: verify - SP-11] | Only manual runs feasible |
| A-12 | The host's approval mode is observable | SEC-13 | Medium [Assumed: verify - SP-12] | Mode unknown; chat gate always on |

**[ASSUMPTION-HEAVY]** Core assumptions A-04, A-05, A-06, A-11 and A-12 remain unvalidated; Section 10.2 gates them.

## 14. Adversarial Self-Critique

1. **A polished instruction bundle can look governed while remaining bypassable.** Watch AC-03 and AC-07 failures and gaps between declared mechanism classes and observed behavior.
2. **Tenet can become more ceremony than value.** If users abandon the workflow or must invoke specialists manually, simplify before adding skills. Watch active effort, typed friction and voluntary reuse.
3. **Easy installation can hide hard project readiness.** If setup runs unfamiliar scripts or untested repositories are reported as supported, adoption becomes unsafe. Watch readiness fixtures, assistance levels and expert rescue.
4. **An acceptance basis can create false comfort.** Users may confirm examples they skimmed, and invariants can be incomplete. Watch FC-15 incidents and AC-24 detection rates.
5. **A narrow TypeScript-only R1 may look like web lock-in.** The extension architecture must be proven by the CLI/library fixture in R1 and the Python adapter in R1.1, not asserted.
6. **Governance-shaped behavior.** A workflow can produce contracts, IDs, traces and reviews while the underlying execution stays ambiguous. The verdict truth table, mechanism classes and an M0 skeleton with injected failures exist to expose this early.

## 15. Revision Triggers

| Trigger | Reassess | Timing |
|---|---|---|
| Host changes plugin discovery, harness behavior, hooks, approval modes, permissions or delegation | Matrix, descriptors, INS, AGT, SEC | Before claiming compatibility |
| Host model version changes | Native-host suite, model labels, matrix | Before the next release; label "not yet evaluated" meanwhile (FC-14) |
| A spike fails or changes a feasibility assumption | Affected requirements and decisions | In the next PRD revision, before design-ready |
| A required capability needs a daemon, SDK, external account or manual runtime | Product form, exclusions, packaging | Before adding the dependency |
| A failing or stale result is labeled checked, a human change is mis-attributed, or private data enters a package | Verdict, Git or privacy contracts | Immediately; block release |
| Pilot misses frozen targets | Lanes, scope, hypothesis | At the pilot gate |
| A shared update breaks project records or app behavior | Migration and ownership | Before wider rollout |
| A setting or default change alters assurance or resolution | Section 7 catalog and AC-23 | Before adopting the revision |
| A referenced standard publishes a new version (ASVS, WCAG, SARIF, OpenTelemetry conventions) | Pinned versions and recipe lists | At the next recipe release |
| A host ships a capability equivalent to a Tenet feature | Adopt it and retire duplicate logic | At the next minor release |

---

## Appendix A. Sources

Official and standards sources (recheck during qualification; flag as stale if more than 30 days old at implementation):

- [GitHub: About Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins)
- [GitHub: Creating a Copilot CLI plugin](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating)
- [GitHub: Finding and installing plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)
- [VS Code: Agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [VS Code: Agent harnesses](https://code.visualstudio.com/docs/agents/run/agent-harnesses)
- [VS Code: Subagents](https://code.visualstudio.com/docs/agents/run/subagents)
- [VS Code: Hooks](https://code.visualstudio.com/docs/agent-customization/hooks)
- [Git: githooks](https://git-scm.com/docs/githooks)
- [GitHub Actions: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [SQLite: online backup API](https://sqlite.org/backup.html)
- [TypeScript: incremental](https://www.typescriptlang.org/tsconfig/incremental.html)
- [Semantic Versioning](https://semver.org/)
- [OWASP ASVS](https://owasp.org/projects/asvs)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)
- [MADR](https://adr.github.io/madr/)
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) (the page notes the conventions moved to a dedicated repository; pin the maintained source at Tech Spec approval)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- Evaluation metrics: [HumanEval / pass@k](https://arxiv.org/abs/2107.03374), [τ-bench / pass^k](https://arxiv.org/abs/2406.12045)
- Reference designs: [pstack](https://github.com/cursor/plugins/tree/main/pstack) (workflow shape only); [Karpathy: autoresearch](https://github.com/karpathy/autoresearch) (bounded-experiment discipline only); Agent Skills format (`SKILL.md`); EARS requirement syntax.

Sources added in v0.14 were cited by the October 14 reviews and are not yet re-verified by maintainers.

Archived drafts, reviews, decision logs and prompt histories are private, informative history. They are excluded from plugin context, packages, examples and evaluation without exact-scope review and consent. Section 1.2 uses only aggregated counts from the owner's own history.

## Appendix B. Requirement crosswalk (v0.12 → v0.14)

| v0.12 | v0.14 |
|---|---|
| F-01 Native distribution | INS-01, INS-02, INS-08 |
| F-02 Compatibility and diagnosis | INS-04, INS-05, INS-06, INS-12 |
| F-03 Guided setup | INS-03, INS-11, CON-01, CFG-01 |
| F-04 Simple entry | INS-09, INS-10, WRK-05, Section 3.1 |
| F-05 Prerequisites | INS-07, SP-01 |
| F-06 Project onboarding | INT-01, SEC-04, GIT-10 |
| F-07 Active intent stewardship | INT-02, INT-07, INT-08, INT-09, INT-10, INT-12 |
| F-08 Bounded work contract | WRK-01, WRK-02, WRK-03, CON-09 |
| F-09 Adaptive workflow | WRK-04, WRK-06, WRK-07, Section 3.6 |
| F-10 Drift and continuation | CON-03, RES-04, WRK-11, Section 5.14 |
| F-11 Native specialization | AGT-01, AGT-02, AGT-03, AGT-09 |
| F-12 Role/model portfolios | RSC-01, RSC-02, RSC-06, RSC-08 |
| F-13 Bounded review | REV-01, REV-04, REV-05, REV-08 |
| F-14 Task-aligned parallelism | AGT-03, AGT-08, AGT-11 |
| F-15 Limits and interruption | WRK-08, WRK-09, WRK-10, WRK-12, Section 4.4 |
| F-16 Behavior-first implementation | TDD-01 to TDD-06 |
| F-17 Independent assessment | REV-01, REV-02, REV-03, REV-06, REV-09 |
| F-18 Evidence and truth | EVD-01 to EVD-04, EVD-08 to EVD-12 |
| F-19 Risk-appropriate checks | QLT-06, QLT-11, Sections 3.8.4–3.8.5 |
| F-20 Usable result | RES-01, RES-02, RES-03, RES-05, RES-06, Section 4.5 |
| F-21 Feedback and learning | LRN-01 to LRN-05, OSS-06 |
| F-22 Permission boundary | SEC-01, SEC-13 |
| F-23 Privacy and integrity | SEC-02, SEC-03, SEC-10, SEC-11, SEC-14 |
| F-24 Explainable configuration | CFG-01 to CFG-11 |
| F-25 Native resource behavior | RSC-03, RSC-04, WRK-08 |
| F-26 Updates and migration | LFC-01 to LFC-04 |
| F-27 Disable and removal | LFC-05 |
| F-28 Open-source release quality | OSS-01, OSS-05, INS-02, ENG-07 |
| F-29 Living engineering charter | QLT-09, CON-01, CFG-08 |
| F-30 Governance traces and drift | ENG-09, INT-08, EVD-07; guarded part → AC-13b (Later) |
| F-31 Bounded improvement experiment | ENG-08, Section 6.10 |
| F-32 Usage-aware selection | RSC-04, RSC-07 |
| F-33 Threat and supply-chain controls | SEC-02, SEC-05, SEC-06, SEC-07, SEC-12, Sections 5.5–5.9 |
| F-34 Record integrity and footprint | CON-02, CON-04 to CON-07, CON-12, GIT-01, GIT-04 |
| F-35 Operating budgets and diagnostics | NFR-01, NFR-03, NFR-07, Section 4.4 |
| F-36 Recipes and software quality | QLT-01 to QLT-17, Section 3.8.6 |
| F-37 Evaluation and release stewardship | ENG-04, ENG-05, ENG-07, ENG-10, ENG-11, Section 6 |
| F-38 Personalization and decision experience | INT-03, INT-11, CFG-06, RES-07 |

**IDs added in v0.14:**
- INS-11, INS-12
- INT-12 to INT-15
- WRK-13
- AGT-12
- EVD-10 to EVD-14
- REV-08, REV-09
- RES-08, RES-09
- GIT-10 to GIT-15
- CON-12
- SEC-12 to SEC-16
- CFG-11
- RSC-08
- QLT-11 to QLT-17
- ENG-10, ENG-11
- OSS-06
- AC-27, AC-28
- FC-16 to FC-21
- D-19 to D-28
- Q-15, Q-16
- SP-11, SP-12

## Appendix C. Review disposition (informative)

This appendix records where review input went. It is not binding: every adopted point is restated in the body, and nothing here or in any archive adds an obligation.

| Review | Main themes | Disposition |
|---|---|---|
| Critical review of v0.12 | Product surface, atomic requirements, owner-intent drift, extension seams, domain model, oracle, numbers, continuity, scope, drift, cost | Adopted in v0.13; refined in v0.14 |
| Final review of v0.13 (Claude) | Git contradictions, shared-artifact trust, auto-approve, eval feasibility, unobservable budgets, decomposition, alpha size, example enforcement, model qualification, persona viability, gaps list | Adopted: Sections 3.7.3, 4.2, 4.4, 5.6, 5.8, 5.12, 6.4, D-19 to D-25 |
| GPT review of v0.13 | Archive authority, verdict decision table, acceptance basis, red/green claims, zero-write review, Git attribution and hooks, budget classes, checkpoint guarantee, CI evidence, eval CI security, configuration contradictions, check obligations, evidence security, concurrency, local privacy, metrics, fragmentation, versioning, standards, trait versus change risk, review closure, brownfield traceability, starter security, data recovery, support policy, release chain, license wording, readiness | Adopted throughout: Sections 0, 3.7, 4.4, 4.5, 5.3.5, 5.4, 5.9–5.16, 6.2, 6.5, 6.6, 7.3–7.7, 10.3, OSS-04 |
| Gemini review of v0.13 | Protected-path semantics, `.tenet/` scanned by build tools, dirty edits and branch stacking, test-lock timing, concise style, CI tiers, explicit cases, command `cwd` and `env`, port and test-database isolation, lazy baseline, ID collisions, caller-aware context, section typos, TypeScript CLI fixture | Adopted; ID collisions adapted to branch-safe suffixes plus collision detection |
| Copilot review of v0.13 | Exact harness tuple and lifecycle events, verdict procedure, acceptance oracle union, mechanism classification, evidence dependency states and TOCTOU, execution envelopes, atomic ownership, dirty-worktree policy, configuration bootstrap, starter identity and threat model, pinned standards, reference workload, data integrity, UI states, brownfield capability profile, adapter fault containment, evaluation tiers, statistics, cost metrics, continuity matrix, eviction order, version pinning, release verification chain, extension conformance, trait composition, assistance levels, people and high-risk domains, research consent, golden-set contamination, negative-control tolerances, release exceptions, interaction tests, freeze-versus-delegate guide | Adopted throughout: Sections 0, 1.4, 2.2, 2.3, 3.8, 4.5–4.7, 5.4, 5.8, 5.11, 5.13–5.16, 6.1–6.8, 7.1, 7.8 |

**Adapted or rejected:**
- Using a CLI proxy as qualification evidence is rejected; proxies are labeled T2 (Section 6.1).
- Renumbering colliding IDs at merge is replaced by branch-safe IDs with collision detection.
- Conserve stays a preference; only Serial prohibits optional dispatch.
- The proposal to split the PRD into companion files is withdrawn per the owner's instruction (D-16).

## Appendix D. Revision record

- v0.2–v0.5: autonomous software-factory platform drafts (archived).
- v0.6–v0.9: Copilot-first deliverable, five pillars, Tenet name.
- v0.10–v0.11: tiered scope, authority and evidence, records, threat and evaluation gates, task-first UX, native delegation.
- v0.12: unified configuration contract (Git commit d0dbc60).
- v0.13: approval-candidate restructure with product surface, domain model, extension architecture, specification by example, Git workflow, quality baselines, atomic requirements, and assurance, evaluation and configuration contracts in one document.
- **v0.14:** incorporates four reviews of v0.13.
  - Makes archives non-binding and adds a reading guide and a freeze-versus-delegate guide.
  - Adds:
    - the exact qualification tuple, assistance levels and a brownfield capability profile;
    - plan decomposition and an explicit acceptance basis;
    - the endpoint verdict policy and finding severity;
    - mechanism classes and a classified limits table;
    - the shared-artifact trust model, execution envelopes and auto-approve handling;
    - Git attribution and local integration, and branch-safe IDs;
    - runtime isolation, data recovery, the continuity matrix and storage eviction;
    - the starter identity, exposure and workload model with pinned standards;
    - evidence tiers, reliability metrics, a pre-registered decision rule and research ethics;
    - versioning against the public compatibility contract;
    - the release verification chain and CI security tiers;
    - configuration fixes and three new settings;
    - M0 and beta release staging, an owner sign-off register, and spikes SP-11 and SP-12.
  - Moves less-technical builders to R1.1.
  - Feasibility remains unexecuted; no implementation is authorized.
- **v0.15:** records the owner's October 15 sign-off of the Section 8.4 register and the decisions taken while drafting the Tech Spec.
  - Resolves Q-12: the starter uses Fastify 5 and Zod, better-sqlite3 and plain SQL migrations (D-12).
  - Adds D-29 and Section 5.7.1: one kernel with command-line and local stdio MCP front-ends, the default chosen by SP-12 under a narrow SEC-07 exception, carried into Section 11.1 and AC-11.
  - Clarifies:
    - kernel latency budgets exclude check execution, which has its own timeouts;
    - review-only runs as one stateless call;
    - sealed checkouts and run artifacts live outside the workspace;
    - ownership is a work-contract lease, never a helper process ID;
    - `.tenet/` is in the default no-edit exclusions, with tamper detection authenticated where a machine key exists and advisory otherwise;
    - the `.tenet/` marker binds to directory identity;
    - Git staging uses a declared touched set and syncs the user's index only where safe;
    - committed trees and integrated trees are distinct candidates;
    - helpers never run repository code in their own process;
    - the Node baseline is the current LTS lines (22 and 24);
    - the friction targets include Tenet-caused approval prompts.
- **v0.16:** applies the six amendments the owner approved on October 15 while drafting Tech Spec v0.4 (D-30).
  - Observer hooks may ship before hook prevention is qualified; they only record, and may raise a control's mechanism class to observed (Section 5.7.1, AC-13b, SP-03, Section 11.1).
  - Front-end selection also weighs AI credits per Standard task, and the owner decides from retyping and legibility measurements when prompts and credits do not (Section 5.7.1, SP-12).
  - A qualified host language service may provide the repository map (Section 3.8.7).
  - Efficiency targets and plan guidance move from premium requests to AI credits per accepted outcome, with failed and cancelled runs included (Sections 1.6, 2.2, 6.4).
  - The always-loaded budget counts tool schemas and the charter, and coordinator instructions get their own budget (Section 4.4.3).
  - RSC-01 permits a disclosed, declinable economy model for the read-only researcher role once qualified.
