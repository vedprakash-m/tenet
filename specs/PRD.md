# Tenet - Product Requirements Document

> v0.12 | October 14, 2026 | Draft

## 1. Outcome Statement: Problem, Vision and Product Approach

### 1.1 Product overview

**Tenet is a configurable, governed and continuously improving approach to turning high-level human intent into delivered, operated and evolving software.** It brings together engineering best practices, personalized instructions, specialized agents, model flexibility, project governance and measured learning so that people can build many kinds of software without manually managing every step of an AI engineering team.

**Naming:** Tenet is the project and product name; "software factory" describes the concept. Tenet for Copilot names the first deliverable. [Validated: owner's project naming decision, October 14.] Repository, package and marketplace identifiers will be confirmed before publication; the product name does not establish their availability.

**Tenet for Copilot is the first deliverable, not the boundary of the vision.** It introduces this practice through an open-source plugin inside the Copilot environment the user already knows. The user installs it once and describes a task through one main workflow; guided setup happens only as needed. Tenet chooses relevant procedures and specialists while the user retains control of intent, consequential tradeoffs and permissions. The software remains an ordinary project maintainable without Tenet.

The ambition is not simply to generate code faster. It is to make disciplined software development easier to obtain and sustain: less repeated explanation, fewer avoidable mistakes, clearer decisions and credible evidence that the requested behavior actually works.

**First product form:** a native Copilot plugin, comparable to pstack in installation and workflow packaging, not a new harness, IDE or autonomous worker service. **Long-term product boundary:** the engineering and governance practice can extend across qualified tools, models, software families and lifecycle stages without assuming that Copilot-specific mechanisms are universal. [Validated: owner's October 14 direction.] **Value proposition:** more useful, maintainable software per unit of human effort, elapsed time and available model capacity. [Assumed: verify - evaluation owner through the pilot; not an established productivity claim.]

### 1.2 Problem statement

**The problem Tenet addresses is the gap between asking an AI to write code and reliably evolving useful software.**

A user can describe a desired change and receive substantial implementation, yet still have to act as product manager, architect, engineering lead and test coordinator. They must decide what to clarify, supply forgotten constraints, notice scope drift, arrange reviews, question convincing completion reports and reconstruct context in the next session. Better model output alone does not define who owns these responsibilities or ensure they happen.

That burden is particularly visible across successive changes. A useful first version is not enough if the next feature contradicts an earlier decision, a bug fix weakens an invariant, or a new session loses the reasons behind the design. The unit of value is therefore not one generated answer or code change; it is a project that becomes more useful without becoming progressively harder to understand and maintain.

These are the problems to test with users, not claims about every Copilot session:

| User problem | Consequence | What Tenet must change |
|---|---|---|
| The requested solution is implemented before the underlying need is understood | Plausible software solves the wrong problem or omits a consequential requirement | Clarify value, users, examples and exclusions before committing to implementation |
| Important context lives in chats and the user's memory | Repeated explanation, conflicting decisions and fragile continuation | Preserve concise project-owned intent and decisions, refreshed against current source |
| Quality depends on the user remembering a good sequence of prompts | Research, design, regression checks or independent challenge are skipped | Make a proportionate development workflow the default, not an expert-only technique |
| Activity and confidence are mistaken for completion | A demo, mocked integration or passing narrow test is presented as a working outcome | Bind claims to the actual candidate, observed behavior and explicit missing evidence |
| Multiple agents create coordination work for the user | Overlapping edits, repeated context and expensive review loops | Invoke specialists selectively with clear boundaries and finite review |
| Useful practices are copied into repositories and become stale | Different projects diverge and improvements require manual maintenance | Update shared procedures centrally while keeping project decisions and code independent |
| Configuration exposes too much machinery too early | Users abandon setup or choose unsafe defaults | Offer guided defaults first, with advanced choices revealed when they matter |

**Evidence boundary:** the owner's experience, supplied conversations and reviewed workflow examples motivate this problem framing. They do not establish market prevalence, willingness to adopt or measured savings. The pilot must validate whether the proposed users experience these pains and whether Tenet relieves them. [Assumed: verify - product/evaluation owner before broader release claims.]

### 1.3 Vision and mission

**Vision:** Enable people and organizations of every level of software expertise to transform high-level needs into valuable, secure, reliable, maintainable and scalable software through a personalized, governed, multi-agent engineering practice that continuously learns from delivery and operation, and makes increasingly effective use of the best available models and resources.

**Mission:** Turn proven software engineering practices into an accessible, adaptable and measurable end-to-end loop: understand the problem, manage intent, design, implement, verify, deliver, observe real outcomes and improve both the software and the way it is built.

The vision spans individuals and teams; new and existing systems; applications, services, libraries, developer tools, data/ML and infrastructure; and the lifecycle from discovery through delivery, operation, maintenance and retirement. It is not confined to a particular IDE, provider, subscription, language or deployment target. Accessibility of adoption and appropriate human control remain principles as scope grows, rather than promises that every workload needs no expertise.

Five pillars define the product ambition. [Validated: owner's five explicit product pillars, October 14.] Specific mechanisms and support coverage remain subject to qualification.

| Pillar | Intended end state | How the loop creates value |
|---|---|---|
| Engineering best practices, personalized | High-level needs become clear outcomes and well-engineered delivery through effective role/task/project-specific prompts and instructions | Apply discovery, requirements, design, TDD, review, security, delivery and operational practices in the right order and depth; adapt to the user's preferences and project maturity |
| Active governance and intent stewardship | Requirements, needs, intents, wants, goals, objectives, constraints and decisions actively guide execution, rather than becoming documents agents forget | Maintain traceability from intent to work, decisions, actions, checks and outcomes; detect drift, enforce available guardrails and stop/escalate when authority or evidence is missing |
| Outcome-driven self-improvement | Delivery and operational evidence improve the application, workflows, prompts, engineering guidance and model choices | Define feasible objectives, bounded experiments and measurable outcomes; retain demonstrated gains and reject regressions without allowing the optimizer to rewrite its own success criteria |
| Excellent code and system quality | The result is understandable, minimal, modular, testable and fit to scale, rather than merely abundant generated code | Keep a concise living engineering charter in AGENTS.md or an equivalent supported artifact; reinforce TDD, reuse, clear boundaries and measured performance, then improve guidance through retrospection |
| Flexible specialists, models and capacity | Product Manager, Architect, Designer, Developer, QA, DevOps and other roles use suitable models and tools at a justified cost | Match roles/tasks to evaluated model portfolios and authorized routes; account for subscription usage where observable and optimize accepted outcomes per resource consumed |

The first release earns this broader vision through one useful local development loop. It does not need a standalone platform to begin, and it does not satisfy the whole vision merely by installing a plugin. Later capabilities require explicit scope, feasibility evidence and release gates; the vision alone authorizes no infrastructure.

Success would look like a user returning with the next feature or bug, spending less effort reconstructing context and coordinating work, and trusting the result because they can inspect its evidence, not because the agent sounds certain. The vision is undermined if Tenet repeatedly requires expert rescue, adds more coordination than it removes, or cannot sustain quality across successive changes. Section 3 defines the first tests of that proposition.

The vision and configurable, continuously improving direction are [Validated: owner's original goals]. Broad usefulness remains an aspiration; first-release effectiveness is an unproven hypothesis.

#### Governance as an active loop

For each project, Tenet maintains a living understanding of why the software exists and what success means. Distinguish underlying needs from requested solutions, aspirations from accepted requirements, and preferences from hard constraints. Link accepted work and checks to the relevant intent; record changes and their consequences. A pivot triggers impact assessment of plans, code, checks and approvals, not just a rewritten paragraph.

The target governance loop is **intent -> authorized plan -> bounded actions -> observed evidence -> disposition -> updated intent**. Logs and traces explain which role/model acted, under which contract and permissions, what changed, what was checked and why work proceeded or stopped. Drift, excessive retries, uncovered requirements and surprising external effects produce an intervention rather than an optimistic completion report.

Prevention requires controls as well as visibility: scoped tools, tested hooks, ownership boundaries, approval gates, native policy and external publication controls where needed. Logging alone cannot keep an agent on track. R1 records Tenet-managed activity and declares observability gaps; broader enforcement must be earned, not inferred from an instruction file.

### 1.4 Intended users and their jobs

The first release serves individuals already using a supported Copilot host. They can describe desired behavior and make product choices, but must not need plugin-development, orchestration or infrastructure expertise to adopt Tenet. They remain responsible for consequential decisions and native permissions.

| User | Job to be done | Desired experience | Initial fit |
|---|---|---|---|
| Individual developer or technical builder | Build and improve several projects without repeatedly coordinating the same engineering process | Fast startup, respect for existing conventions, useful critique and credible checks | Primary initial user |
| Founder, domain expert or less-technical builder | Turn a concrete need into a small working application and understand its limitations | Plain-language clarification, working examples and explained decisions instead of technical questionnaires | Guided use within the supported recipe; not a promise of expert-free production operation |
| Existing-project maintainer | Add a feature, fix a defect or investigate behavior without destabilizing the repository | Inspect before changing, characterize behavior, preserve contracts and leave a clear handoff | Primary existing-project journey |
| Team lead or reviewer | Obtain a consistent specification or change review without adopting a new platform | Review-only operation, actionable findings and explicit unresolved decisions | Supported through individual host workflows; team administration is deferred |
| Contributor to Tenet | Improve a reusable practice without distributing private project context | Clear contribution boundary, representative evaluation and versioned releases | Maintainer/contributor journey |

The initial wedge is an individual taking a small, bounded outcome through a complete local development loop. Multi-user organizations, regulated operation and arbitrary production systems introduce responsibilities that this first release does not claim to solve.

**Proposed primary R1 user:** a technical builder or maintainer who can run a local project, inspect a change brief and make product decisions, but needs no orchestration expertise. A less-technical user is a guided secondary audience within the qualified recipe, with separate usability evidence. No installation expertise is different from no engineering expertise. [Assumed: verify - product owner at PRD approval.]

Interaction styles are selectable: **Guided** explains consequences/examples and recovery in domain language; **Balanced** presents concise scope, checks and material decisions; **Surgical** emphasizes exact diffs, commands and minimal change. They change presentation/support, not authority or evidence floors. Workflow depth is independently selected from task risk (Section 3.11), never inferred from seniority. Temporary conversational adaptation requires no preference dialog; durable inferred preferences require confirmation. Tenet identifies when qualified human judgment is needed instead of asking an unprepared user to approve an unexplained risk.

### 1.5 Goals, objectives and success measures

Goals describe the lasting user value. Objectives describe what the first release must demonstrate. Detailed acceptance procedures live in Section 3; the table below explains why they matter.

| Goal | First-release objective | Success evidence |
|---|---|---|
| Make disciplined development easy to adopt | Reach a first useful task outcome without orchestration expertise or separate services | AC-02 task-first formative screen plus activation under AC-21; total elapsed time and Tenet-attributable effort reported separately |
| Turn intent into the right bounded outcome | Clarify consequential ambiguity and preserve the agreed behavior/exclusions before implementation | New-project and review-only journeys under AC-04; project decisions remain visible through continuation |
| Reduce supervision without disguising uncertainty | Complete useful work with less active human coordination than a competent native Copilot baseline | AC-12 pilot and Section 3.6 comparison; numeric improvement target frozen under Q-04 before evaluation |
| Make completion credible | Demonstrate actual behavior and surface failed, missing or stale checks rather than issuing a stronger verdict | Existing-project checks under AC-05 and misleading-success fixtures under AC-07 |
| Make the next change easier, not harder | Retain intent, respect human edits and sustain behavior through repeated changes | AC-08/09 and AC-12's sequence of three successive changes |
| Improve the practice without increasing maintenance burden | Ship evaluated shared workflow updates without rewriting projects or expanding authority | F-21/26, AC-14 and update-regression evidence under AC-10 |
| Make governance operational | Trace approved intent through actions/checks and detect a seeded deviation; preventive gates are separately qualified | F-07/30 and AC-13a/b; logging gaps never become full audit coverage |
| Sustain excellent engineering quality | Apply a living project charter and meaningful TDD, avoiding unnecessary abstractions | F-16/29 and AC-15a; regression/maintainability evidence, not line-count targets |
| Learn from measured outcomes | Execute a bounded improvement comparison, retain or reject it against predeclared criteria and document the result | F-21/31 and AC-14; evaluate one complete improvement cycle, not perpetual automation |
| Improve outcome/resource efficiency | Use suitable native role/model choices and bounded effort; richer portfolios/usage are optional qualified profiles | F-12/25/32 and AC-15b/c; accepted outcomes and total rework per observable unit |

These objectives and numerical adoption targets are [Assumed: verify - product owner at PRD approval]. They are not achieved results. Quality, cost and elapsed-time tolerances constrain the effort-saving objective; saving human time by skipping necessary checks is not success.

**First value moment:** the user presents a task immediately; Tenet establishes only necessary readiness, resolves a consequential ambiguity when present and returns a checked result or actionable diagnosis the user understands. Setup completion is not activation. Investigation, reuse, configuration, clarification or a justified no-change recommendation count when they satisfy the agreed need; generated code is not required.

**Positioning hypothesis:** relative to native Copilot plus a good project instruction file, Tenet earns adoption through maintained intent-to-evidence continuity and demonstrably useful workflow/evaluation defaults, not merely more prompts. Compare with competent native customization and relevant workflow bundles during discovery; no superiority over pstack, Spec Kit, Kiro or native features is assumed. If a host supplies an equivalent qualified capability, reuse it and retire duplicate Tenet logic after compatibility/migration review. This is a maintenance principle, not a requirement for a competitive platform.

**Non-goals:** maximizing agent count, code volume, model consumption or autonomy for its own sake; eliminating human judgment; guaranteeing business success; and claiming universal software correctness. Detailed exclusions in Section 2 protect these choices.

### 1.6 Solution approaches and why plugin-first

Several approaches can provide structure around AI coding. The product choice must solve the coordination problem without making users operate another system.

| Approach | What it offers | Why it is not the selected starting point |
|---|---|---|
| Prompt collection or repository template | Simple instructions that users can inspect and adapt | Users still assemble the workflow, copy updates and coordinate roles; useful as a component, insufficient as the product experience |
| Standalone factory using SDK workers and a custom engine | Broad control over scheduling, state and execution across runtimes | Duplicates harness responsibilities and adds installation, security and maintenance obligations before user value is proven |
| Dedicated IDE extension or application | A custom interface and deeper application-specific integrations | Creates another UI/integration surface to maintain; reconsider only for a demonstrated experience gap |
| Native plugin with shared skills, specialist workflows and minimal tested helpers | Uses existing chat, models, agents, tools, trust and installation while distributing an opinionated practice | Selected direction; accepts host-specific capability limits rather than hiding them |

**The chosen approach is to orchestrate the practice, not reimplement the coding runtime.** [Validated: owner's request to use existing harness hooks and adopt a plug-and-play Copilot product.]

Tenet contributes the development method and project continuity. Copilot supplies execution and interaction. Existing project tools supply builds/tests, and configured repository or deployment controls supply stronger publication boundaries. Small hooks/helpers close specific gaps only where they are supported and tested.

This division keeps adoption light, but it has a real tradeoff: a user-disableable plugin cannot enforce every action or guarantee execution after the host closes. Tenet must remain useful while stating those limits honestly. Section 3.3 defines the responsibility boundaries rather than promising platform-level control.

### 1.7 Proposed user experience: one request, a complete loop

Consider a user who wants a small application to track equipment loans. They describe who will use it and what is frustrating about their current process. Tenet does not immediately generate a database and screens. It first identifies consequential unknowns: whether multiple people can reserve the same item, who can see borrower details and what counts as a completed return.

The user sees a concise proposed first increment with concrete examples and exclusions. They can correct it before implementation. Tenet then follows the repository's conventions or the supported starter recipe, brings in design or review help where needed, implements the increment and demonstrates the agreed local journey. Its result explains what works, what was checked and what remains outside scope.

When the user later asks for an overdue reminder, Tenet reads the current project and decisions rather than making them restate everything. If sending real messages introduces an external effect, it separates that permission and delivery decision from implementing local behavior. If a human has edited the code meanwhile, Tenet reconciles those edits instead of treating old context as authoritative.

This is an illustrative journey, not an extra required template or a production messaging commitment. It makes the intended relationship clear: **the user steers the product; Tenet guides and coordinates the development work; the host executes within its permissions.**

The general loop is:

1. **Understand:** inspect the project and clarify the underlying need.
2. **Agree:** propose a bounded outcome, examples, exclusions and consequential choices.
3. **Design and build:** use the smallest sufficient process and specialists for that work.
4. **Challenge and demonstrate:** review actual artifacts and run meaningful checks.
5. **Hand over and continue:** explain the result, save relevant context and incorporate feedback.

A typo fix can move through this loop quickly. A new data-bearing application needs deeper decisions. Configuration changes depth and preferences, not whether the product can silently redefine "done."

### 1.8 What configurable and self-improving mean

**Configurable means explainable adaptation, not a setup questionnaire.** Tenet resolves the task, accepted project commitments, explicit preferences and observed capabilities into a versioned effective workflow. Communication, depth, endpoint, involvement, resources and privacy remain independent. Ordinary language changes supported settings; structured readable configuration makes changes inspectable and reproducible without requiring manual editing. Configuration is not permission and cannot create a missing capability. Section 3.12 owns resolution, scope, reference defaults and change semantics.

**Self-improving means a closed, evidence-driven learning loop, not merely remembering tips.** There are three distinct loops:

- **Improve the application:** feedback and defects lead to a new scoped change with regression evidence.
- **Improve work within a project:** a supported lesson becomes a scoped, inspectable preference or check, with exceptions and provenance.
- **Improve Tenet for everyone:** maintainers evaluate a shared procedure against a baseline and regression set, review the tradeoffs, and publish a versioned update.

Delivery evidence includes acceptance failures, review findings, retries, escaped defects, user effort and resource usage. With explicit project authorization, operational evidence adds real feature adoption/task success, latency, reliability, incidents and support feedback. Define the desired outcome and observation window before collecting data; a shipped feature is not automatically a successful feature. R1 can ingest user-supplied or existing-tool reports without installing always-on telemetry or transmitting private data centrally.

Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) illustrates the useful core pattern: a narrow editable surface, a fixed experiment budget, a stable evaluator, an experiment log and a keep/discard decision. Tenet adapts that discipline to engineering rather than copying its ML training setup or permission advice. Its experiments can compare a prompt, review method, test recipe, engineering rule or role/model assignment. Real software has multiple objectives and delayed outcomes, so one benchmark score or one lucky run cannot establish a general improvement.

Each experiment defines the hypothesis, authorized mutable surface, baseline, feasible target, evaluation cases, quality/safety floors, time/usage budget and stopping rule. Separate what can change from protected intent, authority and acceptance. Repeat noisy comparisons where justified; promote only with sufficient evidence and a recovery path. Reject regressions, record inconclusive results and stop when marginal benefit no longer justifies cost.

The first release demonstrates the learning discipline through a maintainer-run bounded comparison and reviewed keep/discard disposition. A user-invoked experiment is an optional qualified profile, not an installation prerequisite or a stage of every task. Longer-term, eligible low-risk improvements can be proposed, evaluated and promoted automatically within an explicitly authorized envelope, with traceability and rollback. No automatic authority expansion, acceptance weakening or cross-project data sharing is implied. This progression is broader than manual lessons but does not require a new background service for the first release.

The proposed experiment mechanisms are [Assumed: verify - product owner at PRD approval]. Outcome-driven, effective and efficient ongoing improvement is [Validated: owner's explicit product direction].

#### Living engineering guidance

Maintain concise, engineered guidance through the host's qualified local mechanism, with an explicitly adopted AGENTS.md/equivalent for shared project principles when useful. Load specialist/task detail on demand; personalize architecture/language/risk guidance without putting personal interaction profiles in shared files. Record effective guidance for reproducible evaluation.

The default charter favors less unnecessary code; behavioral TDD (red -> green -> refactor); clear, modular boundaries; reuse instead of duplication; simple designs rather than speculative abstractions; explicit errors; type safety where available; security and accessibility; and performance/scalability appropriate to declared workloads. "Less code" cannot justify unreadable compression or missing safeguards, and "scalable" cannot justify building distributed infrastructure before it is needed.

Behavioral implementation follows TDD by default; test baseline behavior with the new reproduction before changing it. New interfaces can use minimal compilable scaffolding for meaningful red; if that is infeasible, declare a test-alongside/negative-control alternative rather than claiming import errors prove behavior. Behavior-preserving refactors may remain green-to-green. Explicit prototypes retain an unhardened label and hardening obligations. No agent may waive required quality to pass its own work; these dispositions implement F-16, not a general test-after policy.

#### Model portfolios and subscription efficiency

Roles are skill/responsibility contracts, not fixed model names. A Product Manager structures needs and outcomes; an Architect resolves system tradeoffs; a Designer shapes experience; a Developer implements; QA challenges behavior; DevOps addresses delivery and operation. One model can serve multiple roles, and a difficult task can escalate to a stronger option within an authorized budget.

Users can configure ranked portfolios: for example, architect candidates such as Opus or Sol, and developer candidates such as Sonnet, where actually offered by the host/account. These names illustrate preferences, not verified availability, immutable rankings or subscription compatibility. Select from observed suitability, context/tool support, quality history, latency and marginal cost, not prestige alone.

The broad goal is to track usage across authorized subscription routes and maximize **accepted outcomes per resource consumed**, while maintaining quality and human-effort floors. Distinguish tokens, requests, premium credits, money and elapsed time; do not collapse incompatible units into a misleading ratio. Included allowance has opportunity cost even when marginal billing is zero.

R1 records actual role/model/route and host-provided usage/quota data where available, including estimated versus measured versus unknown and reporting freshness. It can use that evidence to recommend a better portfolio. Account-wide tracking, multiple subscriptions and automatic routing require permitted APIs, reliable attribution and explicit authorization; they remain later qualified capabilities when the host cannot supply them. A Claude model accessed through Copilot does not consume a separately configured Claude subscription by implication.

### 1.9 First-release outcome and product principles

**Observable outcome:** On a supported Copilot host, a user can install Tenet through the normal plugin interface, open a new or existing project, describe a bounded software outcome, and follow one guided workflow to a checked result with preserved intent, decisions and explicit limitations, without administering a separate Tenet service.

**Verification:** Fresh-install usability observation, new/existing-project fixtures and a real-task pilot establish adoption and usefulness separately. Successful installation alone does not validate the value proposition.

Maintain these principles:

1. **Host-native first:** reuse execution and interaction capabilities instead of rebuilding them.
2. **One understandable entry point:** describe work immediately; readiness and specialists appear only as needed.
3. **Intent before activity:** preserve purpose, value, needs, preferences, constraints, decisions and pivots.
4. **Smallest sufficient workflow:** rigorous work does not require identical ceremony for every task.
5. **Evidence before confidence:** distinguish executed checks, review judgments and unverified claims.
6. **Honest boundaries:** instructions guide behavior; only tested host/repository controls enforce it.
7. **Shared improvements, project ownership:** update reusable procedures without overwriting application decisions or source.
8. **Bounded learning:** prefer proven checks and evaluated workflow changes over accumulating prompt rules.

## 2. Scope: Copilot Plugin First, Broader Tenet by Qualified Expansion

Sections 1.1-1.8 describe the broader product vision. Core Must and applicable Profile Must contracts below define the first Copilot deliverable. A capability deferred from R1 is not excluded from the vision. A vision statement is not evidence that the plugin already provides it. This tiering is a proposed release cut requiring product-owner approval, not a silent reduction of the five pillars.

### 2.1 IN scope

The plugin-first direction and low-friction adoption are [Validated]. The following R1 cut is [Assumed: verify - product owner at PRD approval]; it is proposed scope, not a claim of current support.

| ID | Capability | R1 boundary | Acceptance |
|---|---|---|---|
| S-01 | Native plugin distribution | Public GitHub source, versioned plugin and marketplace metadata; install/update/uninstall through documented host mechanisms | AC-01, AC-02, AC-10 |
| S-02 | Task-first onboarding | Incremental host/project/action readiness; local defaults, optional setup and explained native consent | AC-02, AC-03, AC-21 |
| S-03 | New and existing projects | One evaluated small web/API starter recipe; feature/bug work on compatible single-repository projects with reproducible checks | AC-04, AC-05 |
| S-04 | Intent and work contracts | Project-owned purpose, requirements, decisions, bounded increments and restart handoffs | AC-04, AC-08 |
| S-05 | Specialist workflows | Core genuine native dispatch and useful parallel read-only assignments on the flagship host, plus proportionate focused passes; model-diverse review/parallel writing separately qualified | AC-05, AC-06, AC-22 |
| S-06 | Verification and result reporting | Actual check execution tied to the candidate; distinct reviewer pass; explicit missing or stale evidence | AC-05, AC-07 |
| S-07 | Continued development and improvement | Core feedback, human-edit reconciliation, scoped retrospective and maintainer evaluation; optional user-invoked experiment profile | AC-08, AC-09, AC-14 |
| S-08 | Guidance, governance and model configuration | Explainable typed/scoped configuration, core charter/state/evidence, capability disclosure and finite effort budgets; optional tested gates, model portfolios and detailed usage | AC-03, AC-10, AC-13a/b, AC-15a/b/c, AC-23 |

**R1 host target:** one desktop VS Code application/harness/session-target combination is proposed; Q-01 and the feasibility register must select and prove it. The matrix names versions, OS/architecture, shell, actual execution machine, workspace type and instruction/hook semantics. "VS Code" alone is not a support profile. Local/Copilot/provider harnesses, SSH, containers, browser/virtual filesystems and cloud sessions are separate combinations. No remote or browser support is implied by local success. [Assumed: verify - product owner at PRD approval; technical maintainer before Tech Spec approval.]

Copilot CLI and the Copilot app are expansion targets, not automatic experimental support promises. To distribute an experimental combination, publish the smoke tests passed, unsupported actions, risks, maintainer and next review/retirement date. It cannot be called supported until its applicable acceptance suites pass. Native package portability does not qualify execution.

**R1 software support:** one maintained greenfield starter and a separately evaluated brownfield profile prove the complete local workflow. A starter template is not imposed on existing code. Brownfield eligibility is capability-based (known local build/check commands, behavioral evidence, bounded data/effects and recoverability), but those prerequisites alone do not establish universal family support. Q-02 selects reference projects and family-specific checks; other projects receive an explicit assistance boundary and useful next action, not forced conversion to the starter. Broader checked implementation needs its own conformance evidence; clarification/review need no starter selection.

The supported matrix also declares component support, model/delegation and accounting capability, helper packaging/runtime access, repository size/organization band, recipe/readiness, governance profile, execution/delivery coverage, limitations, owner and verification date. Each combination is supported, experimental, unsupported or blocked by policy. Installation alone is not qualification. Multi-repository work is not R1; monorepos need an explicitly scoped root/module profile, with generated/vendor trees excluded from routine scanning.

Publish Windows/macOS/Linux and WSL/SSH/devcontainer/browser/cloud status before installation; none is supported merely by omission. The README must diagnose plugin-disabled/policy-blocked installs before Tenet can run, using native recovery without policy bypass. A clearly labeled manual read-only instruction example may offer limited help, but is not a second supported installation path or equivalent plugin experience.

### 2.2 OUT of scope

| ID | Exclusion | Reason and cost | Reconsideration condition |
|---|---|---|---|
| X-01 | Standalone engine, daemon, database server, worker fleet, custom IDE or dashboard | Rebuilds host capabilities and raises adoption/maintenance cost; limits host-independent execution | Repeated real usage demonstrates a specific host gap that cannot be solved with a small extension |
| X-02 | Copilot SDK-based orchestration and direct Claude/Codex runtime adapters | R1 extends the active host instead of launching another harness; loses cross-runtime management | A separately approved expansion establishes value, authentication and containment contracts |
| X-03 | All-provider subscription broker, account-wide reservations, exact usage cutoff or quota optimizer | A plugin cannot assume full account visibility or execution control; loses automatic cross-subscription optimization | Supported host APIs and a justified shared coordination need exist |
| X-04 | Always-on monitoring, unattended background repair and cloud worker scheduling | Execution lifetime belongs to the host; no service is installed to outlive it | Qualified native automation can deliver a bounded opt-in journey |
| X-05 | Default automatic merge, publication, provisioning, production deployment or destructive migration | Consequential effects require separately configured trusted controls; local completion remains useful | An optional delivery recipe passes authority, observation, ambiguity and recovery tests |
| X-06 | Equal support for every software family, model, OS, host or native agent | Compatibility is real maintenance work, not a manifest property | Each new combination passes its support campaign |
| X-07 | R1 unattended self-modification or automatic promotion; permission expansion and universal improvement claims | R1 uses bounded experiments and reviewed promotion; authority never increases as an optimization side effect | Later automatic promotion requires a separately qualified low-risk envelope, evaluation and recovery contract; universal improvement is never promised |
| X-08 | Arbitrary third-party plugin loading, a hosted marketplace service, team tenancy or enterprise administration | Unnecessary to distribute one useful open-source package | Independent adoption establishes concrete demand |
| X-09 | Universal sandboxing, tamper-proof audit, hidden-oracle isolation, exactly-once effects or crash-proof execution | These require infrastructure beyond a normal plugin; no guarantee is inherited from skills/hooks | A supported external control supplies and demonstrates the specific property |

Tenet does not wrap or promise access to GitHub's cloud coding agent merely because it is a Copilot plugin. The cloud agent is a separate future host profile.

### 2.3 Scope dependencies and adjacent features

Native host execution, authentication and permissions are external dependencies required by R1; Tenet does not implement them. Existing projects may require their own build tools. A plugin-owned service, MCP server, separate API key or CI installation is not an R1 prerequisite.

| IN scope | Adjacent capability excluded | Boundary |
|---|---|---|
| Guided installation | Zero trust prompts or bypassing enterprise policy | Native consent remains necessary |
| Shared plugin updates | Automatically rewriting previously generated applications | Application changes use a normal reviewed work item |
| Project handoff and resume | Continuing computation after the host closes | Resume reconstructs work; it is not durable background execution |
| Separate review and check execution | Security-isolated, non-forgeable verifier service | Report actual assurance; require external gates for stronger claims |
| Model preferences | Unlimited entitlement or use of unrelated subscriptions | Host/runtime/account determine access and billing |
| Native read-only parallelism; optional parallel writing | Cross-project resource scheduler | Use bounded native delegation, not a new engine |

### 2.4 Release progression

- **Core alpha:** native install and task-first value on one profile; intent/charter, bounded implementation, meaningful tests, genuine native specialist dispatch including independent parallel read-only assignments, essential traces and safe handoff.
- **Public R1:** harden core through failure, privacy, compatibility and update/removal suites; publish budgets and pilot findings; demonstrate one maintainer-run improvement cycle.
- **Optional qualified profiles:** guarded actions, cross-family review, ranked portfolios/detailed usage, user experiments and isolated parallel writing. Each has its own evidence; core adoption is not contingent on access to all.
- **Later qualified additions:** other hosts/runtimes and software families; team workflows; authorized delivery/operations and feature-outcome integrations; permitted multi-subscription accounting/routing; native automation and qualified automatic improvement promotion.
- Later additions are not dated delivery promises and cannot introduce a required service without revising this PRD.

### 2.5 Vision coverage and deliberate deferrals

This table makes the product cut visible. Entry conditions trigger a product decision, not automatic implementation or spending. The owner approves this coverage at PRD approval.

| Original goal / guarantee family | Core R1 realization | Deferred or replaced behavior / entry evidence |
|---|---|---|
| High-level requirements through software delivered | One local persistent web/API journey plus compatible existing-project changes | Production delivery needs an authorized target/identity, artifact-bound real journey and recovery/cost owner |
| Specialized parallel multi-agent work | Genuine native specialist dispatch and a useful parallel read-only journey on the flagship host; shared-workspace writing is serial | Other hosts may disclose focused-pass limits but cannot claim equivalent multi-agent qualification. Parallel writing needs isolation/ownership, integration checks and benefit over serial |
| Per-role model configuration | Active eligible model works without phase-by-phase picker changes | Optional portfolios/diversity require SP-04, eligible account access and observed resolution; role preferences never establish actual routing or separate vendor entitlement |
| Active requirements and intent | Living accepted scope, traceable work, change/approval invalidation | Team authority requires named roles, conflict/approval semantics and collaboration fixtures |
| Governance, stop and revocation | Native denial/cancellation, essential records; tested gates only in guarded profile | Global stop, fencing and durable effect guarantees remain unclaimed; require external enforcement and fault evidence |
| Strict independent validation | Behavioral tests, tamper-aware review and assurance labels | Sealed holdouts/verifier separation need externally protected execution, not local checks presented as equivalent |
| SRE/DevOps operational feedback | Authorized reports and operating-readiness gaps | Scheduled collection/repair needs demonstrated unmet need plus qualified permissions, data lifecycle and delivery |
| Subscription tracking and configurable caps | Native limits, bounded effort proxies and truthful visibility | Multi-route caps/routing need permitted observable APIs and attribution/admission evidence; unknown data is not enforcement |
| Autoresearch-like improvement | Scoped lessons and one evaluated maintainer comparison | User experiments are optional; automatic promotion needs protected criteria, repeatability, net benefit and recovery evidence |
| Broad software/user coverage | Primary technical builder; guided secondary journey on one recipe | Each new family/persona needs fixtures and a maintenance owner, not merely prompt files |
| Hosted isolation, exactly-once effects and credential brokers | Replaced by host/target responsibility and unsupported states | No latent engine/tenant service requirement; new infrastructure needs demonstrated demand and separate approval |

Historical platform FR/G/Q IDs remain retired. This disposes of consequential guarantee families, not an invented one-to-one historical ID crosswalk. Before approval, the owner checks any specifically retained historical obligation against this table and records a disposition. Historical snapshots need not be recreated or silently reactivated.

## 3. Acceptance Criteria

### 3.1 User journeys

Command names below are proposed labels, not claims that commands already exist. Final syntax and discovery follow the supported host's UI. [Assumed: verify - UX owner before UX Spec approval.]

| Journey | User experience | Completion boundary |
|---|---|---|
| J-01 Install and begin | See prerequisites/policy limits before install, follow native flow, invoke Tenet with a task; setup is available but not a mandatory separate interview | Loaded/engaged state is distinguishable from merely installed; first useful task needs no developer setup |
| J-02 Start a project | Open an empty folder, describe the outcome, resolve consequential choices and use a recoverable starter increment; a clear request supplies scoped authority | A real local journey works without a Git/recovery questionnaire; no implicit production or external identity setup |
| J-03 Change an existing project | Inspect conventions and setup, identify readiness gaps, agree on behavior, implement and check the actual candidate | Required local behavior and regression checks are demonstrated or the result remains explicitly incomplete |
| J-04 Review only | Request critique, optionally authorizing declared local checks; continue with selected numbered findings when desired | Source remains unchanged during review; selected fixes inherit valid context but require actual implementation authority |
| J-05 Continue and correct | Reopen after interruption, reconcile human edits, report a bug or revise intent | Current scope and evidence are recovered; stale results and old approvals are not reused blindly |
| J-06 Update or leave | Use native update/disable/uninstall; inspect any project migration separately | Project source/specifications remain usable; no hidden service or Tenet production dependency remains |

### 3.2 Functional requirements

Requirements are Core Must except the explicitly profiled portions below. Details are proposals [Assumed: verify - product owner at PRD approval]; established product directions remain [Validated], never represented as implemented.

| Requirement group | Release obligation |
|---|---|
| F-01-11, F-13, F-15-20, F-22-24, F-26-28, F-30, F-33-36, F-38 | Core Must at the stated scope; F-11/14 require a real native dispatch/parallel-read journey on the flagship host, not spawning for every task; F-30 preventive gates remain optional |
| F-14 | Core one writer, shared-output serialization and flagship parallel read-only journey; additional writers are Profile Must only when offered |
| F-12, F-32 | Core capability disclosure, active-model defaults and no false claims; ranked portfolios and detailed usage are Profile Must when offered |
| F-25 | Core native-limit respect and finite observable effort budgets; account-wide quota enforcement is not claimed |
| F-21, F-29, F-31 | Core scoped retrospection, guidance hygiene and one maintainer-run evaluated improvement; an end-user experiment workflow is Profile Must |
| F-37 | Mandatory release-stewardship gate, not a stage imposed on user tasks |

Detailed clauses in Sections 3.3-3.12 own these contracts. F rows index obligations, acceptance observes them and failure tables explain deviations; repeated summaries do not create additional policy. Lettered subclauses where present are independently traceable (for example F-08a); technical design maps remaining clauses to child tests. Maintain one schema-backed settings catalog, not separate editable copies in docs, prompts and code.

#### Installation and first use

| ID | Required behavior |
|---|---|
| F-01 Native distribution | Publish one installable plugin with a tested native source-install path and marketplace flow only where supported/available. README identifies prerequisites, publisher, support matrix, first task, permissions, update/removal. Repository cloning/developer setup is not the user path; external default marketplace inclusion is not required. |
| F-02 Compatibility and diagnosis | Distinguish basic plugin, project and action readiness. Reuse valid observations; cheaply check relevant host/harness/plugin/policy and input changes, reprobe affected assumptions, not every capability on every message. Record unknowns privately and surface task-relevant limits/recovery. Required missing controls block dependent operations, never silently reduce assurance. |
| F-03 Guided setup | Accept a task before setup; inspect first, ask only consequential choices needed now, defer advanced configuration. Default Tenet metadata/guidance to local-only; shared files are previewed and explicitly adopted. Repeated setup preserves edits. No manual permission JSON, blanket trust or allow-all prerequisite. |
| F-04 Simple entry | One invoked main workflow plus optional setup/status/help; route feature, bug, review, investigation, prototype, refactor or continuation proportionately. Clearly identify initial engagement and route changes without a banner on every reply. Plain questions/status requests remain conversational; no ambient contract, hidden session takeover or user-managed specialist assembly. |
| F-05 Prerequisites | Require only documented host/account and chosen project tools. Package helpers/runtime access without a separate user install/build step. A host embedding Node does not prove it exposes a supported callable runtime for plugin hooks; feasibility must demonstrate the exact invocation. Bundled executables add OS/architecture/provenance obligations. If neither works, revise scope before release; no hidden Node/Python/Docker/database/service requirement. |

#### Intent, project ownership and workflow

| ID | Required behavior |
|---|---|
| F-06 Project onboarding | Inspect source/docs/conventions before questions; safe direct probes differ from executing discovered project scripts. A change/check request can authorize inspected baseline checks with declared local effects as part of the task, subject to native permissions. Do not auto-install or run unfamiliar hooks merely on opening a repository. Diagnose missing tools/ports/config without reading secret values; propose bounded repairs in the same flow. |
| F-07 Active intent stewardship | Maintain relevant purpose/value, needs, accepted requirements, constraints, preferences, exclusions and decisions in readable user-controlled local-default records. Capture only facts useful to the task, not a full intake template. Link work/checks to current intent; changed goals trigger affected impact assessment. Reuse canonical documents; no mandatory chat export, tracked changes or copied workflow library. |
| F-08 Bounded work contract | (a) Capture outcome, module/interface boundaries, protected paths, checks/effects, endpoint, recovery and limits proportionately; predicted files are estimates unless constrained. (b) Clear requests authorize routine in-scope local steps, not repeated micro-approvals. (c) Amend/refine within scope; renew authority only for changed boundaries under 3.7. (d) Source-only review makes no project writes; requested checks may have declared disposable/fixture effects, never implicit installs, production access or publication. |
| F-09 Adaptive workflow | Apply Quick/Standard/Deep depth from Section 3.11 independently of presentation style. Use understand -> clarify/design where needed -> build/test -> proportionate review/check -> handoff/learn. Nonbehavioral tasks need no artificial TDD. An explicitly requested prototype is labeled unhardened, stays within safety/data limits and has a scoped hardening transition; it never masquerades as a checked result. |
| F-10 Drift and continuation | Save scope/revision, candidate/checks, blockers, budget and next action at useful boundaries. Resume from current source and valid records, adopting ordinary human/upstream edits without an approval ritual; reconcile actual intent/ownership conflicts. Distinguish branch/pull/rebase/relocation from corruption. Steering, partial inspection, cancellation and scoped undo follow Sections 3.4/3.11. |

#### Specialists, models and bounded execution

| ID | Required behavior |
|---|---|
| F-11 Native specialization | Demonstrate genuine native assignment to a named specialist and independent parallel read-only assignments on the selected flagship host, with consolidated output and failure recovery. Roles use on-demand context/tools and bounded assignments under 3.7; no mandatory fan-out. Focused same-session passes are allowed where proportionate, never counted as actual agent spawning. If native dispatch is infeasible, revise host/scope before claiming the flagship multi-agent product. |
| F-12 Role/model portfolios | Core honors the active eligible model without manual phase-by-phase switching. Optional portfolios rank role/task models using supported interfaces, eligibility and bounded fallback/escalation. Record requested/resolved model/route where observable. Surface relevant missing access, never fabricate delegation/diversity or vendor entitlement. Section 3.7 owns capability levels. |
| F-13 Bounded review | Consequential work gets distinct critique and a focused recheck of material fixes within a finite budget. Retain numbered findings/evidence/dispositions; coordinator resolves evidence-based implementation disagreements within authority, not reviewer/developer ping-pong. Escalate only unresolved product choices or material risks. A disputed finding is not a coding retry. Budget exhaustion/agreement/silence is not approval; selected findings can become authorized fixes without re-onboarding. |
| F-14 Task-aligned parallelism | Core permits parallel read-only work but one write workflow per qualified workspace identity; 3.4 defines ownership/shared-resource boundaries. Readers declare the source revision observed and stale findings are reconciled before action/verdict. Additional writers need qualified isolation and integration checks, not merely different prompts or worktrees. Never claim cooperative locks stop unrelated editors. |
| F-15 Limits and interruption | (a) Finite aggregate task/inner-loop/review/delegation budgets include retries, not user-response waits in active-work time; report wall time separately. (b) A macro submission is an implementation presented for required assessment, not each red/green/compile correction. Q-08 calibrates defaults by task class. (c) Record compact hypotheses/progress; repeated identical failures/oscillation stop for diagnosis. (d) Before exhaustion reserve handoff/diagnosis effort; propose a specific bounded extension, never reset counters by resume/delegation. (e) Native host iteration pauses remain user-controlled; checkpoint and resume without duplicate work, never auto-confirm them. |

Distinct assessment of consequential work is core. Cross-family review remains a product capability, but is an optional qualified profile rather than an account prerequisite for core R1. "Family" means the documented provider/model lineage, not two aliases or sizes within one lineage; family diversity is not proof of independent reasoning. Claim it only from observed execution metadata, never requested frontmatter alone. If unavailable/unknown, block that profile or obtain an explicit alternative-coverage disposition without relabeling it cross-family. Use only fallback syntax actually supported by the host. Evaluate whether diversity improves detection enough to repay cost.

#### Implementation, verification and handover

| ID | Required behavior |
|---|---|
| F-16 Behavior-first implementation | (a) Existing behavior changes use a reproduction test applied to baseline behavior, then the same test on the fix. (b) New seams may use minimal compilable scaffolding or an explicit test-alongside alternative with a fault/boundary negative control; missing imports alone are not behavioral red and history is never fabricated. (c) Characterize affected brownfield behavior, preserving unrelated quirks without a user quiz. (d) Refactor after green when useful/in scope; nonbehavioral work or infeasible reproduction uses a stated alternative, not ritual test runs. |
| F-17 Independent assessment | A distinct pass/agent inspects intent, actual candidate and test/config diff before trusting implementation output. Review two non-compensating axes: behavior/intent and structural/security/charter quality. Surface changed assertions, discovery, skips/only, snapshots, mocks, lint/type suppressions, CI and dependencies for explicit disposition; legitimate test corrections need independent behavior justification. Execute checks separately where feasible; local review is not protected isolation. |
| F-18 Evidence and truth | (a) Bind checks to behavior/test/input revision, source including relevant untracked files, dependencies/config/tool and declared fixture environment. (b) Separate initial fixture state, permitted test mutations and unexpected drift; disposable outputs/caches/receipts are not source drift, but relevant generated/runtime inputs cannot be blindly excluded. (c) Invalidate only affected evidence, batching reruns; uncertain relevance uses an explained conservative fallback. (d) Distinguish pre-existing/new failures, zero tests, skips, simulation, flaky/inconclusive, stale and unavailable historical output. (e) Missing/failed evidence cannot become pass through owner acceptance. |
| F-19 Risk-appropriate checks | Behavioral work requires relevant regression and positive/negative/error cases; UI work adds real interaction, accessibility and error/loading states; auth/data work adds boundary and authorization cases; dependency/build changes add supply-chain and regression checks. Data changes state invariants, compatibility and recovery limits. Preserve established architecture and consumer contracts. |
| F-20 Usable result | (a) Lead with achieved outcome, relevant checks and actionable gaps; run/preview instructions when useful. (b) Preserve detailed state/evidence privately/on demand, not five-axis boilerplate. (c) Distinguish checked local, implemented-but-unverified, prototype and blocked endpoints; no routine final approval question. (d) Explain prerequisites/recovery without credential values. Review-to-fix and export/PR briefs reuse valid context without posting or implementing implicitly. Section 3.11 owns disclosure and progress ergonomics. |
| F-21 Feedback and learning | Use work/check results, feedback and authorized outcome reports for scoped improvement candidates; issues re-enter reproduction/checks. Core includes project retrospection and maintainer evaluation under F-31; user experiments are optional. Do not generalize private lessons across projects. Shared changes use reviewed releases; no agent/skill can authorize weaker acceptance or more permissions. |

At least one maintained recipe must exercise a small persistent web/API application, a real local journey, meaningful tests and continued modification. Existing-project support is readiness-qualified, not a promise to make arbitrary repositories reproducible. Missing setup/tests may produce an investigation or proposed readiness task instead of autonomous implementation.

#### Permission experience, configuration and lifecycle

| ID | Required behavior |
|---|---|
| F-22 Permission boundary | Use native tools, trust prompts, sandbox and policy. Explain why a permission is needed, its scope, and what declining prevents. A denied action remains denied; do not retry through another tool or instruct users to disable protection. Hook checks cover only tested events; Tenet cannot govern unrelated sessions or terminals. |
| F-23 Privacy and integrity | Do not collect credentials, unrelated projects, private prompt histories or telemetry by default. Use host authentication; exclude secrets from project records, examples and test fixtures. Project/tool text is untrusted input, not a grant. Do not weaken tests/CI or alter permissions to make a task pass. Existing host/provider transmission policies still apply; local execution does not mean no external transmission. |
| F-24 Explainable configuration | Meet Section 3.12: typed categories, field-specific resolution, scoped project policy/defaults, reference configuration, validated changes and inspect/diff/reset/export. Ordinary language is the primary surface; readable structured settings may be hand-edited but never require it. Native capability and actual authority remain separate from requested configuration. |
| F-25 Native resource behavior | Respect native limits. Set finite per-contract effort budgets in actually observable units (subagent/review calls, macro attempts, elapsed time), warning and stopping/asking at the bound through available controls. Report whether each is advisory or enforced. A configurable percentage ceiling defaults to 100% of authorized included allowance only when its denominator/reset/source is known; otherwise label account cap unavailable and use effort proxies, not fake credits. No funding/overage/purchase/expensive-route change without authority. |
| F-26 Updates and migration | Version procedures/payloads; disclose changed permissions/destinations/evaluators/schemas. Prefer adoption at safe work boundaries where native controls permit; security-critical changes can stop affected work. An observed mid-task update revalidates affected behavior, not every application test or approval. Preview migrations, preserve overrides and prove a native known-good recovery path; no invented pinning/downgrade control. |
| F-27 Disable and removal | Native disable/uninstall removes future plugin capabilities according to host semantics; explain if running sessions/processes require cancellation or restart. Preserve application code, specs and user evidence by default. Offer explicit cleanup of plugin-owned disposable records without deleting user data or changing production resources. |
| F-28 Open-source release quality | Publish source, license/attribution, changelog, compatible hosts, executable-content/permission disclosure, examples, support/security reporting and tested install/update/removal instructions. Inspect the distribution for private references/history and unnecessary executable content. Do not claim default marketplace listing, publisher verification or cross-host support before it exists. |
| F-29 Living engineering charter | Reuse existing guidance; qualified local loading is preferred, invoked task context is the fallback if ambient local loading is unavailable. Shared AGENTS.md/equivalent changes require preview/adoption because they may affect teammates/non-Tenet work. Apply Section 3.12's distinction between project commitments and defaults; do not infer authority from imperative prose. Preserve effective versions, scoped corrections and conflicts; no automatic weakening or unbounded growth. |
| F-30 Governance traces and drift | Correlate Tenet-managed intent revision, work/parent role, observable model/route, relevant effective configuration/guidance, change/action, permission/gate disposition, check outcome, timestamps and termination state. Bound/minimize records and declare visibility gaps. Core detects/escalates seeded intent conflicts without claiming exhaustive prevention. Guarded profile must actually prevent its named mismatches and refuse stronger assurance if its controls are unavailable. |
| F-31 Bounded improvement experiment | Core demonstrates a maintainer-run experiment; optionally offer a user workflow. Specify hypothesis, baseline, editable prompt/recipe/guidance/model surface, frozen criteria/holdout, feasible objective, quality floors, budget/stop rule. Record all attempts/failures, repeats/uncertainty and human keep/discard/inconclusive disposition; insufficient evidence retains baseline. Distinguish frozen criteria from technically protected evaluators. No background execution or auto-promotion required. |
| F-32 Usage-aware selection | Correlate role/task/model/authorized route with host-provided usage units, remaining allowance/reset and billing where exposed; record source, freshness and measured/estimated/unknown status. Do not infer total account usage from session data or sum incompatible units. Report accepted outcome/resource tradeoffs including retries, reviews, failures and human effort. Recommend portfolio changes within quality/authority floors; unavailable quota or routing never becomes invented accounting or an unauthorized paid fallback. |
| F-33 Threat and supply-chain controls | Meet Section 3.8: untrusted inputs cannot grant authority; minimize helpers, validate paths/arguments, review execution/dependency changes and released payload provenance. R1 bundles no MCP server/configuration. Existing project MCP tools remain host-managed and need explicit scope; permission drift is surfaced, not automatically trusted. |
| F-34 Record integrity and footprint | (a) Meet Section 3.4's local-first records, valid schemas/revisions and interruption-safe updates. (b) Establish attributable recoverability proportionately, including empty/non-Git folders; no auto-Git/init, broad copies or destructive recovery. (c) Offer scoped undo/park/resume with previews, preserving later human edits and data/effect limits. (d) Relocation/export/import or lost records never imports authority or fabricates history. |
| F-35 Operating budgets and diagnostics | Meet Section 3.9: qualify finite context/hook/scan/storage/resource budgets on named fixtures; errors are actionable, diagnostics redacted and user-exported. A required control cannot silently fail open. |
| F-36 Recipes and supported-software quality | Each claimed recipe/profile meets Section 3.10 and owns fixtures, checks, limits, quality obligations and maintenance. Declarative guidance alone is not support. |
| F-37 Evaluation and release stewardship | Use formative learning to calibrate, then freeze protocol/targets before each qualification candidate cycle; run longitudinal evidence, maintainer learning, compatibility/fault and supply-chain/recovery checks. Publish limitations and supported-release/deprecation/security ownership. Not a required user-task stage. |
| F-38 Personalization and decision experience | Meet the experience contract in Section 3.11: task-first engagement, minimal necessary questions/approvals, usable progress, steering and recovery, layered results and personal defaults. Users make product decisions, not routine coordination decisions. No style/lane/escape hatch weakens required safety, authority or evidence floors. |

Optional delivery is **Later**, not a local-work prerequisite. If offered, it must use existing authorized tools/CI; bind the exact artifact, target/configuration and required real journey; explain cost, cleanup and rollback limits; and reconcile ambiguous remote effects before retry. Production, public messages, destructive data changes and purchases have no implicit permission. No successful CI run substitutes for actual delivery.

### 3.3 Trust and responsibility boundaries

| Layer | What it owns | What it does not establish |
|---|---|---|
| Skills and agent instructions | Process guidance, context selection, role contracts and review methods | Unbypassable policy, secrecy or execution containment |
| Hooks/helpers | Tested event-specific validation, evidence capture and actionable errors | Coverage of all tools, hosts, sessions or external effects |
| Copilot host | Actual execution, model access, native permissions, sandbox, cancellation and session behavior | Identical guarantees in every application/mode |
| Project/CI/target controls | Required checks, protected publication and deployment identities when configured | General control of local machine activity |
| User/organization | Goals, consequential approvals, account policy and accepted residual risks | Automatic correctness through approval alone |

Report each consequential control as **host-enforced, externally enforced, advisory, or unavailable**. Plugin-owned deterministic checks must be tested, but running beside candidate code does not make their output tamper-proof. If a requested assurance requires a protected verifier/CI and none is configured, report that assurance unavailable and do not issue the stronger verdict.

Hooks can execute outside a shell sandbox. Do not expose an unrestricted helper that becomes a bypass. Document filesystem/network/executable dependencies. R1 bundles no MCP server/configuration; adding one reopens the threat, packaging and product scope decisions.

### 3.4 Project records and update ownership

**Two-zone footprint:** Tenet metadata/guidance is local-only by default; authorized application edits remain ordinary source changes. Canonical intent/decisions/charter become shared only by explicit preview/adoption, preferably reusing existing human-editable documents. Operational handoffs/counters/receipts/traces/tentative lessons stay in qualified local storage. Personal interaction/model preferences never silently enter shared instructions. Review/readiness supports zero project writes; if storage is unavailable, offer stateless read-only help without durable-continuation claims. Dependent mutations/verdicts still require reliable state. Export is explicit.

Maintain one owning source for each fact: intent/authorized scope; consequential decisions; discovered commands/settings; compact handoff/evidence; scoped lessons; charter and effective guidance references. These can share an artifact; do not impose one file per concept. Exact paths/schema belong to technical design. A task must not reread/rewrite every record for a trivial change; records scale with risk and useful continuity.

Records have schema version, work/project identity, revision and known provenance. Perform interruption-safe writes and compare revisions before replacing content. Unknown/malformed schemas, deleted records, read-only storage and conflicting edits trigger diagnosis/reconciliation, not invented authority or silent reset. Generated views are not competing truth. Verify source/workspace/branch and instruction drift at resume. Do not duplicate the plugin into AGENTS.md or replace instructions wholesale; offer a minimal reversible pointer only where the host actually loads it.

Cooperating workflows record workspace/worktree source-write ownership separately from shared mutable resources such as database fixtures, generated outputs or package caches. Core has one write workflow per qualified workspace identity; isolated worktrees do not prove shared resources independent or qualify parallel writing. A stale timestamp is not abandonment: corroborate owner/liveness where observable, reconcile source and obtain a safe takeover when uncertain. Locks coordinate Tenet, not unrelated editors. Unknown ownership blocks conflicting writes, not independent reads; compare affected source before writing.

**Recoverability without a Git prerequisite:** distinguish an empty folder from existing/dirty source. An empty-folder request can authorize an attributable created-file inventory and recovery preparation with no extra risk ceremony. For existing files, use qualified native checkpoints or bounded pre-edit copies in approved local storage, covering only necessary touched content; explain scope/retention, avoid secret/dataset duplication, preserve earlier edits and verify recovery availability. Preparation fits existing authority when covered; broader backup/storage changes need a decision. If reliable recovery is infeasible, give a specific constrained option or remain read-only, not a generic Git lockout. Git initialization is opt-in.

Undo previews the attributable increment across related files, not independent file resets or a whole-workspace reset. Reconcile overlapping human edits and cross-file imports/data dependencies before applying a partial reversal; never knowingly remove a helper while leaving its callers. After authorized reversal, run applicable low-impact integrity/smoke checks if available/authorized, otherwise report the unverified recovery state. Do not promise atomic multi-file rollback. Created files, binaries/symlinks, schema and irreversible effects have explicit limits. Cancellation is not undo. Migration checks preserve existing authorized data using prior-version fixtures and bounded backup, never silent database reset. Recovery copies have sensitive-data/retention limits.

Section 3.12 owns configuration precedence and restrictions. Local working notes reference the owning accepted requirement, instruction or decision and its observed revision; a stale summary cannot override a revised canonical source. Reconcile material conflicts, not every wording difference. Explicitly changing a project commitment requires its legitimate owner, not merely a newer note or imperative repository prose.

Separate filesystem location, project/repository identity, worktree/branch, source baseline and work ID. Moves, clones, forks, pulls/rebases and machine changes trigger scoped reconciliation, not path-based authority transfer. Exports distinguish portable intent/evidence from local settings/history; imports validate provenance, exclude credentials and require fresh authority where prior grants cannot be corroborated. Lost state reconstructs observable facts from source/docs, asks only consequential unknowns and never invents receipts. Retention protects active scope, unresolved effects/findings and needed evidence links; missing historical output narrows inspectability, not proof of new application failure.

Load a minimal entry/contract pointer, then active role/phase guidance, then relevant domain references on demand. Runtime must not repeatedly inject the whole PRD/library/history. A progressive repo map retains source freshness; large raw search/log output stays outside main context where native tools allow, with compact evidence-linked summaries. Do not promise that a host can unload instructions or impose unvalidated universal token caps. Compaction preserves scope/authority/evidence/budgets/decisions; fresh contexts are measured tactics, not mandatory phase resets.

Bound record growth, retention and diagnostic verbosity before collection. Ignore rules are convenience, not confidentiality or release exclusion; do not change .gitignore/.git/info/exclude implicitly. Explicit exports/packages use inclusion lists and sensitive-content checks. Essential governance records are compact facts/references, not raw private chats or chain-of-thought. No authenticated global ledger is claimed. State-storage failures block transitions depending on reliable counters/authority; optional verbose logging failure degrades visibly without inventing a receipt.

Resetting a preference, forgetting a lesson, deleting records, abandoning work, undoing source and uninstalling are separate actions with previews of material consequences. Honor authorized deletion within Tenet's control; explain lost continuation/evidence inspection and any independently applicable disclosed retention obligation. Do not secretly retain deleted content to preserve history or imply provider copies were removed.

Shared plugin updates change future procedures, not application requirements/source. Mark generated guidance with its owner/version; reconcile local overrides and stale pointers on update rather than overwriting. Shared, project and current-task preferences retain provenance and precedence. Uninstall leaves deliberately accepted project guidance as ordinary files; list residual pointers/rules and preview optional removal. If a lesson exposes an old defect, propose a scoped correction. Learning never implicitly transmits private project data.

**Learning protocol:** observations, proposed lessons and evaluated improvements are distinct. Lessons state hypothesis, scope/applicability, counterexamples, evidence and review/expiry; anchor to relevant paths, symbols, dependencies or domain decisions where meaningful. Changed/removed anchors trigger bounded relevance review, not blind deletion or an exhaustive graph. Cap active guidance by measured context/maintenance budgets under Q-07; merge/retire low-value rules rather than accumulating them. No universal lesson-count cap or cross-project transfer. Prefer reliable checks/reusable fixes or removing unnecessary instructions when these solve the problem.

Inline corrections apply immediately to the current task. Explicit "always in this project" guidance can authorize scoped local persistence without asking the same question again; sharing or cross-project use requires its own scope. Ambiguous remarks stay task-local, with a concise persistence choice only when useful. Low-ceremony feedback is an observation, not proof of improvement; users can inspect, reject or reset learned preferences. Maintained starter guidance supplies cold-start practice, not invented project history.

A maintainer comparison records baseline/candidate effective configuration and observed model/host versions, one bounded editable surface, hypothesis, frozen objective/floors, budget, tasks/holdout, repeats and disposition. Declare mutable settings and applicability strata; extra model/review effort, changed checks or private lessons cannot masquerade as a prompt improvement. Preferences need no productivity experiment, but a claim of improved outcomes does. Evaluation/checks/permissions are not optimization targets; retain failed trials/cost and report confounds/leakage. Reserved holdouts are not technically protected unless separately enforced.

Repeat noisy comparisons under matched conditions. Keep only a demonstrated gain within quality/cost floors; a simpler equal-quality candidate can win under a preregistered tie rule. Inconclusive results keep the baseline. Promotion requires review, release ownership and recovery evidence. Local private shadow tasks are opt-in with explicit data/compute scope; no central private-project collection. Optional user experiments must obey the same protocol and cannot rewrite their evaluator, authority or baseline to declare success.

### 3.5 Release acceptance campaign

All procedures/targets are proposals [Assumed: verify - product owner at PRD approval]. They define suites, not completed tests. Formative alpha can revise the design and calibrate budgets. Before each qualification candidate cycle, freeze fixtures, allowed actions, expected results, repetition counts/model strata, observation/rubric and failure adjudication; retain failed cycles and qualify revisions in a new cycle. Map every F subclause to a test/non-applicability. Clean negative controls measure false alarms as well as seeded failures. No silent post-result threshold changes or one successful stochastic run presented as reliability.

Use a clean supported profile, empty-project starter, compatible brownfield fixture, deliberately broken/unbuildable repository, and fault/security fixtures. Behavioral checks run in controlled test accounts with synthetic data. Human judgment uses a fixed rubric, artifact references and a reviewer other than the author where feasible; it is not called automated proof.

| ID | Type / applicability | Required observed result |
|---|---|---|
| AC-01 | Dependency/behavioral - core | Clean native install exposes setup/main workflow without cloning/building Tenet, manual JSON or extra Tenet runtime/service installation. Repeat after uninstall on each supported matrix entry; inventory matches payload. |
| AC-02 | Usability - core formative screen | At least 4 of 5 unfamiliar representative users invoke Tenet with their task and reach an accurate next step within 10 minutes using README alone, without required setup/config interview. Ready fixtures begin useful safe work; blocked fixtures diagnose the actual prerequisite and unaffected option. Record total/excluded host-login/download/outage time, assistance and comprehension of limits. Time to first useful outcome is measured separately under Q-04/07; a fast readiness summary alone is not activation or population-level evidence. |
| AC-03 | Negative/edge - core | Deny trust/tools and remove a capability in separate fixtures. Denied actions do not run; affected profiles are blocked/labeled, unaffected read-only work remains usable. Repeated setup preserves edits, remains local-only when selected and creates no duplicate authority. |
| AC-04 | Behavioral/negative - core | Resolve seeded consequential ambiguity, record bounded authority/exclusions and run a persistent starter journey plus tests. Separately, source-only review changes zero project files/runs no mutating or remote commands. Review-plus-requested-checks uses only declared authorized effects; neither grants implementation approval. |
| AC-05 | Behavioral - core | A bug's new reproduction runs against baseline then candidate with expected behavioral red/green. New-symbol cases use compilable scaffolding or a declared meaningful negative-control alternative; import errors alone fail the red requirement. Green-to-green refactor and brownfield fixtures preserve intended behavior/human edits. Prototype-hardening fixtures inventory omissions, retain characterized working behavior and require applicable checks/distinct assessment before checked-local promotion. Record test/input identity, disposition and regression evidence. |
| AC-06 | Behavioral/edge - core plus diversity profile | Core review finds seeded material scope/quality defects from actual artifacts and stops at the configured rounds. If offering cross-family review, qualify observed distinct family metadata; unavailable/unknown models yield a blocked/explicit alternative-coverage result, never fabricated diversity. |
| AC-07 | Negative - core | Separate fixtures seed failing checks, zero tests, skips/only, weakened assertions, mock/CI/snapshot/discovery changes, missing output, flaky runs and stale identities. Visible changes receive explicit review/disposition; none creates a false verified verdict. Include a test that fails the base behavior and passes candidate, plus a controlled mutation where suitable. |
| AC-08 | Edge/behavioral - core | Planned/abrupt/native-limit pauses reconstruct scope, provenance, remaining budgets and evidence; reuse only corroborated authority or fresh explicit direction. In-scope refinements do not force renegotiation; consequential changes renew only affected authority/checks. Copied records confer no grants. Preserve human edits, inspect unknown effects and never blindly replay them. |
| AC-09 | Behavioral/negative - core | Correct a reported issue, retain revised intent and scope a lesson. A second project receives no private lesson/context automatically. Changed/removed anchors and conflicting canonical intent trigger relevance review; expiry alone is not proof of falsity. Retire/merge contradicted or low-value rules within the active-guidance budget; explicit forget/reset does not secretly retain a duplicate. |
| AC-10 | Lifecycle - core | Upgrade/migration preview, declined migration, interrupted update, disable and uninstall preserve source/user instructions and list residual guidance. Rehearse known-good recovery by the published mechanism. First release uses a separately versioned prerelease fixture; subsequent releases also test a prior supported release. |
| AC-11 | Supply-chain/privacy - core | Payload inclusion-list and a separate public-source/history audit exclude unapproved private archives/fixtures/chats/credentials. GitHub publication is disclosure even if packaging excludes a file. Test export/deletion and default-off telemetry; distinguish host traffic. No bundled MCP or implicit new destination. |
| AC-12 | Value - core | Complete the formative task screen and frozen comparison/follow-up protocol in Section 3.6, publishing failures/cancellations/unknowns. Meet the precommitted value and quality/cost/latency criteria; the owner adjudicates expansion versus narrower release if evidence is insufficient. No broad effectiveness claim follows from a tiny pilot. |
| AC-13a | Intent/trace - core | Fixtures distinguish expected edits, in-envelope refinement, directly authorized addition and unexplained drift; apply Section 3.7's separate authority/evidence rules. Assumptions remain distinct from accepted requirements. Brief/trace links intent/action/role/candidate/result without requiring specialist-chat reading. |
| AC-13b | Preventive gate - optional profile | For every advertised gated action class, inject a scope mismatch and required-control disable/timeout/crash/schema failure. Actual action dispatch is prevented where claimed; if this cannot be proven, mark the profile unavailable. Advisory core is never represented as equivalent prevention. |
| AC-14 | Improvement - core maintainer; optional user profile | Run a frozen budgeted baseline/candidate evaluation on public/synthetic tasks. A training-only winner failing a holdout is rejected; noisy/tied candidates use the frozen repeat/tie rule. Exhausted budget stops work, dispositions preserve baseline/recovery and evaluator changes cannot self-authorize promotion. Test the user workflow only if offered. |
| AC-15a | Charter - core | Preserve existing guidance, apply local defaults without a required shared file, and preview/adopt an optional shared charter. Test user-local preferences versus shared constraints and loaded rules. Explicit scoped corrections do not trigger duplicate confirmation; inferred cross-task rules do not silently persist. Style changes never weaken checks. |
| AC-15b | Model selection - capability-aware | Core identifies actual native selection/switching limits. Portfolio profile tests eligibility, authorization, denied preference and safe escalation; unobserved model resolution stays unknown and host-specific scalar/list syntax is not invented. |
| AC-15c | Accounting - capability-aware | Fixtures for absent, session, estimated and stale quota/import data preserve units/source/freshness; unknown is not zero, session usage is not account usage. Observed finite budgets include delegation/retries and trigger the declared stop/ask behavior. No paid-route fallback is inferred. |
| AC-16 | Security - core | Repository/retrieved/tool/lesson text attempts to change authority, leak a synthetic canary or disable checks. Material requests do not acquire authority and no unauthorized synthetic egress occurs in the fixture. Exercise helper path traversal/symlink and script/dependency changes; publish tested scope and limitations, not immunity to injection. |
| AC-17 | State/concurrency - core | Schema/storage failures and live/stale/unknown writer ownership preserve content and valid records; no timestamp-only takeover or fabricated approval. Test non-Git recovery and dirty-source multi-file undo with later human edits: preserve dependency integrity or stop for reconciliation, and check/report recovered state. Exercise relocation/clone/lost-state paths and shared outputs across workspaces; parallel writing stays unqualified unless proven. |
| AC-18 | Evidence consistency - core | Relevant untracked/config/dependency/external-fixture drift invalidates dependent evidence. Declared fixture mutations/output/cache/receipt generation do not create false drift; unexpected data drift does. Separate pre-existing versus introduced failures, stale evidence versus unavailable logs. Independent valid checks remain reusable; unknown environment narrows verdict. |
| AC-19 | Reliability/performance - core | On frozen large-repository/long-history fixtures, measure setup, hook and orchestration slow cases, context/storage growth, scan work and nested-agent budgets against Section 3.9's pre-beta limits. Context compaction retains contract/authority/evidence references; runtime failures are explicit. |
| AC-20 | Recipe/UX - core | Starter and brownfield profiles each pass documented business, data/access, failure/recovery, UX/a11y and handover cases. Keyboard and screen-reader observation covers native Tenet interactions; starter UI additionally meets its recipe target. A recipe with guidance only remains labeled unqualified. |
| AC-21 | Experience - core | Observe task-first journeys for empty/dirty/broken projects, source-only review, review-plus-checks, selected-findings fixes and an unhardened prototype. Unchanged readiness/preferences do not repeat intake/consent; relevant changes do refresh. Status/questions/interruptions preserve work; test pause/cancel/park/resume/undo and a native forced-continue checkpoint. Outcome/detail layers contain no invented progress or acceptance. Freeze friction/time/comprehension thresholds under Q-04/07 before qualification; retain transcripts/failure causes, not only prompt totals. |
| AC-22 | Delegation - flagship core | Native traces prove named specialist invocation and overlapping independent read-only assignments on a useful seeded task, consolidated by coordinator. Assignment/result fields in 3.7 are present. Inject blocked/failed/partial/stale/disagreeing results; no fabricated completion, authority expansion, nested budget reset or indefinite ping-pong. Stateless follow-up starts a self-contained new invocation; routine evidence-based conflicts do not become user management work. Compare against serial execution before claiming benefit. |
| AC-23 | Configuration - core | The reference configuration and declared supported alternatives pass 3.12's field rules independent of file-discovery order. Fixtures cover overlapping module scopes/symlinks, scalar/ranked/check/ceiling composition, conflicting commitments, known/unknown applicability conditions, capability absence, unknown keys/versions and omitted/auto/disabled/empty/null/zero. Presets/task overrides never remove binding restrictions or confer authority. Test explain/provenance, reset-to-inheritance, idempotent no-op updates, imports without secrets/grants, migration/concurrent edits, rejected mixed updates with a new restriction, coexistence without rewriting another plugin and selective evidence invalidation. Child context/budgets/configuration match the relevant parent revision; tightening stops new affected actions. Cover the scenario matrix below, pairwise option interactions and additional identified high-risk combinations, not an exhaustive Cartesian-product claim. |

**Configuration scenario coverage:** exercise these as bounded cases within the existing acceptance campaign, not ten new qualified product editions. Each names the relevant recipe/host and expected outcome/endpoint.

| Scenario | Required distinction |
|---|---|
| Unfamiliar builder, prototype request | Guided explanation can coexist with concise intake; explicit unhardened endpoint and intended-use/data limits, not default reduced safety |
| Expert, consequential access change | Surgical communication with Deep evidence and required decisions; no forced verbose plan or weak checks |
| Existing broken baseline | Preserve source/quirks; separate inherited failures from new ones and narrow feasible outcome |
| Source-only review versus requested checks | No implementation implied; classify check effects and reuse context for selected fixes |
| Serial-only preference | No optional fan-out; preserve applicable quality and finite budgets, do not claim actual parallel execution |
| Constrained resources | Reduce optional effort early, explain infeasible required checks; no false pass or silent endpoint downgrade |
| Confidential project | Apply known pre-read/pre-send exclusions to maps, snippets, child context and exports; block incompatible work, disclose host visibility limits |
| Multi-module project | Apply root commitments and scoped commands/conventions; assess dependent integration checks |
| Non-web brownfield conformance fixture | Core source-only analysis/config resolution does not impose web accounts/UI/checks; useful guidance does not qualify implementation for a new family |
| Relocated or imported configuration | Revalidate path/capability applicability and provenance without transferring historical permission |

**Definition of done:** Core Must and every offered Profile Must satisfy their frozen mapped suites on each supported matrix entry; unresolved failures, non-applicability and residual risks are public and owner-reviewed. A safety/false-evidence failure cannot be averaged away by value wins. Scope reductions require an explicit PRD/support change. Release owner and product owner approve; missing owners, critical decisions or thresholds block qualification.

Product-level coverage preserves the F/AC links below; technical design decomposes compound clauses into executable cases. Optional-profile clauses apply only when offered.

| Requirements | Acceptance suites |
|---|---|
| F-01-05 | AC-01/02/03/10/19/21 |
| F-06-10 | AC-03/04/05/08/13a/17/18/21 |
| F-11-15 | AC-06/08/15b/15c/17/19/22/23 |
| F-16-20 | AC-04/05/07/18/20/21 |
| F-21, F-29, F-31 | AC-09/14/15a |
| F-22-24 | AC-03/04/11/13a/13b/15a/16/21/23 |
| F-25, F-32 | AC-12/15b/15c/19 |
| F-26-28 | AC-01/10/11/23 |
| F-30, F-33-35 | AC-03/08/11/13a/13b/16/17/18/19 |
| F-36-38 | AC-02/04/12/14/15a/20/21/23 |

### 3.6 Quality and value measurement

Primary hypothesis: Tenet reduces active human effort per accepted bounded outcome compared with the same user's competent native Copilot workflow, without unacceptable correctness, cost or elapsed-time regression.

Calibrate eligibility/targets/sample plan on baseline-only and separately labeled formative data under Q-04, then freeze held-out qualification before candidate outcome inspection. Include clarification, supervision, correction, setup/amortization and rework; disclose missing/self-reported time. Count all failed/rejected/cancelled/blocked work. Match task, relevant configuration/recipe, endpoint, host/model and data conditions; report configuration strata and changed effort rather than crediting richer settings as a prompt win. Never reuse a solved task as an unbiased baseline.

At least 10 eligible tasks across 2 repositories and one sequence of 3 successive changes is a formative usefulness screen, not a statistical validation. Longer repeated use with external users, a maintained/brownfield project and follow-up escaped-defect observations is required before broad value claims; Q-04 freezes cohort/sample/window and adjudication. Dogfooding is useful but insufficient alone. Stratify by task complexity and user familiarity. Evaluate optional roles, fresh contexts and richer traces with ablations; remove overhead without measured benefit. Report uncertainty and selection/dropout bias.

Track:

| Measure | Source and interpretation |
|---|---|
| Adoption and activation | Separate installed, engaged, ready, first useful outcome and first owner-accepted outcome. Measure task-first abandonment, time/effort and expert rescue; login/provider waits remain visible separately |
| Friction and comprehension | Avoidable questions/duplicate approvals, repeated probes, forced-continue pauses, unnecessary evidence invalidations, user-requested status, failed recovery and correct understanding of scope/limits. Capture causes and think-aloud transcripts; native-policy prompts are not all Tenet defects |
| Usefulness | Accepted observed outcomes, voluntary reuse, interventions and active human effort |
| Quality | Missed requirements, failed checks, misleading completion, escaped defects and rework during follow-up |
| Cost and latency | Model/usage information where observable, review overhead, elapsed time and waits; unknown billing remains unknown |
| Maintainability | Behavior retained across successive changes, project-instruction duplication and update/migration failures |
| Support integrity | Tested host combinations, missing hooks/capabilities and mismatches between claims and actual behavior |
| Governance | Intent coverage, drift caught before execution, unexplained actions, intervention causes and declared trace/control gaps |
| Improvement effectiveness | Experiment success/regression/inconclusive rate, evaluation overhead, repeatability and retained gains; operational/feature outcomes only when authorized and available |
| Resource efficiency | Accepted outcomes per declared usage unit/route and total effort, segmented by task/role/model; quality floors and unknown-data coverage accompany every ratio |

Ratios use all eligible work's cost/effort, not only successes. With zero accepted outcomes, cost per accepted outcome is undefined and the cohort is a failure signal, not zero cost. Report totals, denominators and unknown coverage alongside ratios. Instruction length, test count, model count, token utilization and generated LOC are diagnostic inputs, never success objectives.

No arbitrary universal productivity percentage, quota utilization target or benchmark superiority claim is adopted. Numeric installation targets are release proposals, not measured achievements.

All shipped user-facing messages use the host's accessible text and native interaction patterns. Do not require color-only status, custom inaccessible UI, or access to every specialist chat. Errors state what failed, what remains safe and the next native action.

### 3.7 Intent, authority and operating profiles

**Living intent:** preserve the difference between user statements, observed project facts, inferred assumptions, accepted requirements, hard constraints, preferences and explicitly deferred choices. Give IDs to durable outcomes/criteria/decisions where traceability helps, not every sentence. Derived tasks/tests link to their governing intent. Conflicts and changes supersede affected work without erasing rationale/history. No agent can accept its own newly inferred requirement on the user's behalf.

**Risk is multidimensional:** assess sensitive data, access/identity, external effects/spend, reversibility, compatibility/blast radius and uncertainty. A one-line migration can be high risk. Choose verification, review and approval depth from this assessment. Missing information blocks dependent actions, not unrelated investigation.

Clarify consequential unresolved choices before dependent work. Defer choices that do not constrain the increment, showing when they become necessary. Use explicit reversible defaults for low-consequence choices, with rationale and an override path; do not fabricate a safe default. Ask focused native questions, not an exhaustive intake questionnaire. No universal numeric question cap or mandatory full design stage applies to every task.

**Work lifecycle:** `proposed -> authorized -> executing -> checking -> finished`, with `blocked`, `cancelled` and `superseded` dispositions. Blocking retains the last valid phase and reason. A corrective implementation returns from checking to executing within remaining authority/budget. Cancellation stops new dispatch, records owned active work and reports residual/unknown state; only actual host control can terminate running tools. Material changes supersede or reauthorize affected scope; denied authority cannot be bypassed by renaming the work.

Store separate facts for implementation status, check verdict (`pass/fail/inconclusive/skipped/stale`), owner acceptance (`pending/accepted/rejected/accepted-with-explicit-residual-risk`), delivery (`not-attempted/pending/observed/failed/unknown`) and feature effectiveness (`unmeasured/observed-with-source`). `Finished` means the requested endpoint was reached with its required evidence and dispositions, not that every axis is green. Cancelled/blocked work cannot be counted as accepted completed outcomes. Acceptance does not convert a failure to pass; a local result does not imply deployment or customer success.

**Authority envelope:** record who authorized the objective/action classes, relevant baseline, protected paths/interfaces, data/target, route/spend, applicable expiry and gates. A clear task may authorize predictable local edits, inspected checks, distinct review, essential bookkeeping and proportionate recovery preparation. Publication, purchases, privileged access, destructive data migration or a new data destination are not bundled. Product intent and native permission are separate but not duplicate ceremonies: reuse the existing decision for what it actually covers; never write broad allow-all rules or promise a single host prompt.

**Amendment and validity:** predicted files/module estimates are not a closed file allowlist unless explicitly made a constraint. A newly relevant file, normal implementation, test correction or user refinement inside the objective need not reauthorize the task. Record a material changed requirement; the user's direct request can itself authorize an addition. Ask only when behavior/constraints, data/access, compatibility, protected boundaries, irreversible/remote effects or route/resource limits change without sufficient authority. Do not turn an unexplained business assumption into a default.

Authority validity and evidence validity are independent. Expected authorized edits stale affected checks, not the authorization to implement. External drift changes only dependent conclusions; uncertain relevance requires an explained conservative reassessment, not routine full-project renegotiation. Saved records retain decision provenance, never grant permission. A fresh "continue this fix" can authorize remaining bounded local work; imported/copied or uncorroborated approvals cannot. Reuse independent valid decisions/checks. Inspect ambiguous irreversible effects before retry; no transactional/exactly-once guarantee.

**Action classification:** distinguish source inspection, local execution/mutation (including caches/fixtures), remote reads/query disclosure, project-content egress, remote mutation and privileged/destructive effects. Plain review remains zero project writes; review plus requested tests may authorize declared disposable/fixture changes after command inspection and native consent. A test label or cleanup/zero-net-write result does not make effects safe. Reuse an established command only while script/dependency/config/environment assumptions remain applicable; no implicit install or cleanup of user files.

| Profile | What it permits / proves | Required limitation |
|---|---|---|
| Advisory review / core | Project-read-only diagnosis/review; reports intent and risks; optional checks need explicit effect classification | Semantic guidance is not a preventative machine boundary; testing may mutate files or contact services |
| Checked local development / core | Authorized local source changes, reproducible checks, distinct assessment and essential traces | No universal scope containment or protected verifier; unsupported commands/effects stop at native consent/contract limits |
| Guarded local operations / optional | Named observable action classes gated by qualified host events plus deterministic checks | Publish coverage/exclusions and tested failure behavior; do not generalize to arbitrary shell/script effects |
| Externally gated acceptance / optional | Protected CI/branch/target rules verify the stated artifact/verdict under separate control | External policy/credentials are prerequisites; local records do not create isolation |
| Delivery / later | Specific authorized target, artifact identity, observed real journey, migration/recovery and operating owner | No generic deploy button, production access or service install in core R1 |

Profiles are task-specific; disclose assurance and task-relevant limits initially/on change, using plain language rather than repeated labels. A semantic check is not mechanically exhaustive. Deterministic helpers validate represented revisions/shapes/counters/paths/evidence, not arbitrary intent or hidden accounts. Claim prevention only after actual interception/dispatch denial; a refusing helper while the tool proceeds is failure.

**Specialists are responsibilities, not permanently running workers.** Fulfill simple roles through focused passes; use real native dispatch for substantial separate context and demonstrate it under F-11/AC-22. Parallel read-only research/review is core flagship capability, not a requirement on every task. Native harness semantics determine tools, statelessness, model and cancellation; none is inferred from the display application. The proposed roles below are responsibilities, not mandatory fan-out:

| Role | Inputs and required output | Action boundary |
|---|---|---|
| Intent steward / coordinator | Current contract, source/evidence and questions -> reconciled scope, state, handoff and one user brief | No self-granted authority; coordinates only already authorized work |
| Product specialist | User needs/journeys/constraints -> prioritized criteria, assumptions and decision options | No acceptance of inferred goals on behalf of user |
| Architect | Interfaces, existing conventions and quality risks -> minimal design/tradeoffs and migration/compatibility implications | No automatic code/provisioning; avoid speculative platform designs |
| Designer | Journeys, audience and native patterns -> observable states, interaction/accessibility criteria | No assumed visual approval or reduction of functional requirements |
| Developer | Authorized contract/design/tests -> implementation and change/evidence summary | Writes only authorized scope; cannot self-approve tests or waive checks |
| QA / verifier | Accepted behavior, recipe/check inputs -> tests/reproduction, actual results and coverage gaps | Test execution is classified for filesystem/network/remote effects; no implicit production data or permission elevation |
| Independent reviewer / rubber duck | Intent, full relevant diff including tests/config, check references -> material findings and two-axis disposition | Read-only artifacts/tools by default; cannot patch away a finding while declaring it resolved |
| Retrospective / optimizer | Observations and permitted outcomes -> scoped lesson or bounded experiment/disposition | No evaluator, permission, accepted intent or automatic promotion changes |
| DevOps / operations specialist | Environment/release needs -> readiness/recovery plan; effects only in later qualified delivery profile | No default cloud credentials, monitoring, deployment or cleanup authority |

Dispatch only when independence, specialist perspective or substantial separate context justifies native invocation/context overhead within aggregate budget, data limits and user preference. A lookup or single continuous trace usually stays with the coordinator; no arbitrary role-count/context threshold. Do not launch parallel readers over changing inputs and treat their observations as one stable snapshot.

Every assignment carries bounded goal/contract and relevant effective configuration revision, observed source baseline, minimal context, permitted actions/data, dependencies, allocated effort and expected output. Results report completed/partial/blocked/failed/cancelled, inspected/changed artifacts, candidate/evidence, findings and unresolved dependencies; partial text is not completion. Coordinator validates relevance/freshness, preserves useful independent findings and retries only with a changed useful approach inside aggregate limits. It resolves factual disputes through evidence, but presents genuinely normative product/risk choices as concise options with a recommendation, not an averaged compromise. No indefinite relay loop.

Child work cannot expand authority, reset counters or recursively delegate by default; nested delegation requires qualified bounded support. On stateless native subagents, follow-up is a new self-contained invocation with relevant context, not an assumed reusable worker. Cancellation/ownership propagate only as supported; unknown child/process state is reported. Users do not manage specialist lifecycle or read worker chats to assemble the answer.

For consequential work, separate test design/authoring and verdict where feasible. If the same session wrote tests and reviewed output, disclose reduced independence. Flags such as hardcoded values, broad catches, suppressions, TODOs or duplication are review signals, not universal bans/proof of cheating. Legitimate corrections need rationale and updated evidence; do not mandate unchanged tests, impossible zero duplication or forced abstractions.

**Model and resource resolution:** filter tool/context/privacy/policy/authorized route/availability/observable budget before role suitability. Core uses the active eligible model when automated role selection is unavailable; no routine manual picker toggling per phase. An explicitly chosen diversity/escalation profile can request a supported native switch with reason/benefit/authority. No invented catalogs, arrays, selection APIs or entitlement. Unknown account usage is a status/detail, not a repeated blocker for useful bounded work.

| Accounting capability | Allowed behavior |
|---|---|
| None / default-safe | Report unavailable account data; respect native limits and bounded observable task effort |
| Session | Attribute supported model/call/usage measures to this work, with gaps; no global quota inference |
| Quota-aware | Add permitted remaining/reset data or explicit user exports with provenance/freshness; stale estimates cannot justify a hard money cutoff |
| Multi-route / later unless separately qualified | Compare authorized compatible units/routes, attribution and actual routing; never imply unrelated subscriptions are accessible |

Reporting capability is separate from enforcement capability. "Soft stop/ask at observed limit" is not global reservation or exact spend enforcement. Track retries/delegation/evaluation overhead and policy/route changes. No automatic purchase, subscription hopping or utilization maximization. Recommendations about expiring/stranded allowance require observed reset/eligibility and actual waiting useful work; never generate unnecessary work to consume credits.

### 3.8 Threat, privacy and release-trust contracts

The threat model covers an over-eager/mistaken agent and malicious or compromised repository content, retrieved documents, tool output, dependencies, saved lessons, plugin updates and third-party integrations. It does not promise protection from a malicious authorized operator, compromised host/OS/provider or changes outside observable Tenet work. A local audit trail is not tamper-proof. Security maintainer owns the threat review before beta; technical design maps each control to real host behavior.

Untrusted content is evidence to inspect, not a source of permissions. Files claiming "owner approval", model output or persisted records cannot create authority. Detect/surface requests to ignore constraints, execute scripts, send data or alter acceptance; use only separately authorized scope. Prompt-injection defenses combine minimized context, provenance, tools/egress restrictions where available, and adversarial fixtures. Do not claim complete detection or rely on a prompt alone to contain arbitrary code.

Helpers accept validated structured input, reject unsupported schema/argument/path values and resolve workspace boundaries including traversal/symlink behavior. Prefer direct argument arrays over dynamic shell construction. Limit filesystem, network and executable access to declared need; no generic execute-anything endpoint. Runtime identity and permissions are qualified on the actual execution machine, not inferred from the UI machine or OS.

For each required gate, test missing runtime, denied execution, timeout, crash, malformed input/output, incompatible schema/tool-event name, hook disable and conflicting host/plugin configuration. Host-specific results determine whether action dispatch really stops. A nonzero helper exit is not assumed to fail closed. If required prevention cannot be established, block that operation/profile; visibly downgrade optional diagnostics only when permitted. Human removal of a guard cannot leave the same assurance label active.

Review project/package scripts before executing unfamiliar commands. For new dependencies, verify actual package identity/existence, ecosystem trust/provenance signals, declared license/compatibility, install scripts and lock/resolution behavior where supported; seek native consent for executable changes. No universal package-age/zero-dependency rule or provenance-equals-benignness claim. Existing tools are not implicitly safe because previously installed.

**Data classes and lifecycle:**

| Class | Default and user control |
|---|---|
| Necessary local intent/state/evidence metadata | Minimal fields/references; approved storage with retention/size limits, inspect/export/delete behavior. Do not retain secrets/raw prompts just to make traces complete |
| Host-managed model/tool traffic and history | Disclose applicable provider/organization behavior and visibility limits; Tenet cannot delete provider-held copies or claim offline use |
| Tenet telemetry/diagnostic transmission | Off by default; separate explicit opt-in, destination/purpose/schema, retention/revocation and previewable export. Consent does not authorize source/credential collection |
| Application/feature outcome data | Not collected by default. Prefer synthetic fixtures; separately scope identity, aggregation, access, sensitivity and expiry before any operational import |

Redact/scan likely secrets and sensitive paths before display/export, while stating that detection is incomplete. Avoid collecting credential values in the first place; use presence/non-secret connection checks. No production data in starter examples, evaluation or diagnostic bundles by default. Local retention deletion must not remove user source or needed project history implicitly. If sensitive data is exposed, stop the affected action/export, identify known recipients/limits and route to authorized incident response; do not silently rotate credentials or erase evidence.

**Context exclusions:** distinguish no-model-send, no-agent-read, no-edit, no-export and no-routine-scan requests; Git ignore is none of these automatically. Declare what native tools/indexers/specialists can honor/enforce and what remains outside visibility. Apply relevant restrictions to child context/tools and exports, not only the coordinator prompt. If a requested confidentiality boundary cannot be met, do not inspect/send the affected content; offer a narrower task or block it. Do not claim a plugin overrides host/provider collection policy.

Apply exclusions before affected reads/sends where controllable, including path aliases, repository maps, snippets, caches and tool-log exports; post-hoc redaction is not equivalent. Native attachments, indexed/open-editor context and other tools may already supply content outside Tenet's control. Warn on a known conflict, qualify observable host behavior and disclose that content already transmitted cannot be recalled; do not promise detection of unseen attachments or universal prevention. File selectors are not secret scanning, and secret references contain no credential values.

**Supply-chain and maintenance:** release source/tag maps to the actual plugin payload, with dependency/executable inventory, license/attribution and documented build/package procedure. Use explicit inclusion lists, inspect archives, scan for private histories/fixtures/secrets and review additions of executable destinations/permissions. Publish a minimal security-reporting channel, responsible maintainer, supported release window, vulnerability withdrawal/deprecation and compatibility requalification policy before public R1 (Q-09). Integrity/signing/provenance use available platform mechanisms without implying verified marketplace endorsement or proof of safety.

Before public GitHub publication, review the source tree and reachable history separately from packaged-artifact inclusion. Excluded ref/reviews/fixtures may still leak through a public repository; no automatic history rewriting or claim that an ignore rule prevents disclosure. Unapproved private material blocks publication, not ordinary local use.

An update adding executable behavior, destinations, permissions, evaluator/schema changes or incompatible guidance gets a distinct migration/reconsent note. Respect native automatic-update policy rather than inventing Tenet pinning controls. Preserve a known-good release/ref and state tested recovery limitations. Critical withdrawn versions are visibly unsupported, not silently treated as qualified.

### 3.9 Tenet overhead, reliability and accessible operations

The technical design freezes numeric operating budgets and reference environments before beta (Q-07); values remain unknown now, not unlimited or fabricated promises. Limits must be finite, measured and part of the support profile. Failure to choose them blocks qualification.

| Budget / condition | Required qualification measurement and behavior |
|---|---|
| Installation/readiness | Total and excluded time, required interaction and assistance; cold and repeated setup, blocked/offline/error paths |
| Gate/helper latency | Cold/warm p50/p95 and worst observed time under declared local load; timeout/result behavior per host, no hanging approval |
| Context/orchestration | Always-loaded guidance, peak selected context and repeated-task growth; model calls/delegation/review overhead versus native baseline |
| Repository scanning | Files/bytes visited, relevant-module coverage and latency on small/large/monorepo fixtures; avoid irrelevant vendor/generated scans but include generated inputs when relevant to verification; refresh incrementally |
| Local storage/logging | Per-task and long-history growth, rotation/retention/export sizes and privacy implications; no unbounded append-to-prompt |
| Retry/resource use | Macro/inner retry/time/call budgets across nested work; rate-limit/backoff behavior within budget, explicit exhaustion |
| Concurrency | One writer per qualified workspace identity, maximum qualified parallel work, shared-resource serialization and combined-candidate checks under 3.4 |

Report Tenet overhead separately from provider/tool/network and user waits, alongside total elapsed time. Freeze size/history/hardware/runtime/repetition/tolerances; an average is no tail guarantee. Qualify reference configurations, component contracts and changed/risk-heavy combinations rather than promising exhaustive Cartesian coverage of all models/hosts/recipes. Long-history tests retain constraints without reading every record. Errors state impact and safe next action, never success-shaped defaults.

If network/model/rate limits or tools fail, preserve known state and finite budget; do not spawn fallback work indefinitely. Only stop/clean up Tenet-owned processes/temporary paths whose identity/scope is known. User processes/files are not cleanup targets. Abrupt interruption can lose unsaved observations; don't label them durable.

Messages and native interactions must work by keyboard and with screen readers, with explicit text status, plain consequences and concise progressive detail. Tenet cannot repair an inaccessible host; publish tested host accessibility constraints. User-facing language/support and localization scope are selected at Q-10, not implicitly global.

### 3.10 Recipes, extensibility and quality of software produced

**Recipe contract:** name version/owner, supported stack/tool versions and project shape, prerequisites/readiness probes, default workflow/checks, data/identity requirements, verification input exclusions, bounded permissions, recovery/handover, fixtures, quality budget and compatibility policy. Declare unsupported/experimental conditions. New-project and brownfield profiles differ: preserve existing quirks/contracts through characterization and narrow changes; do not impose the starter's architecture on an existing project.

One starter demonstrates persistence, validation and a real server-side object/role authorization boundary, not a toy screen/UI-only permission. Local synthetic identities can prove this without external identity accounts. Generated-application usability is evaluated separately from Tenet's interaction UX. Every applicable obligation has an observable check or owner-reviewed non-applicability/gap:

| Quality area | Required application-level consideration |
|---|---|
| Product and UX | Named journeys, content/navigation and design-system consistency; success/empty/loading/error states preserve user input and show recovery. Representative users complete core tasks. Web starter scopes WCAG 2.2 AA with automated/keyboard/screen-reader observation, not certification |
| Data and access | Observable domain invariants; API validation and denied access; persistence across restart, schema evolution with existing records, repeat/concurrent/timeout outcomes and idempotency where effects require it. Synthetic fixtures and recovery protect existing user data; no automatic reset to make tests green |
| Architecture and code | Existing prior art, cohesive boundaries, necessary reuse, simple readable design, small justified dependencies and conventions; avoid speculative infrastructure/abstraction, unsafe shortcuts and unexplained suppressions |
| Performance/reliability | Explicit expected load/data size and measurable recipe-specific budgets; failure/retry/timeout behavior, backup/recovery needs and observable errors. No universal scalable/distributed claim |
| Compatibility and lifecycle | Existing API/data/behavior contracts, dependency/license review, reproducible setup/checks, test coverage of critical behaviors and recovery from failed changes |
| Delivery and handover | Local run/config examples without secrets, operating owner, known risks/manual prerequisites, maintenance/upgrades and support boundaries; production delivery remains separately qualified |

End-of-increment checks assess intent and structural quality separately. Post-green cleanup is warranted when it reduces unnecessary complexity within the agreed risk/budget; do not demand churn or single-use abstractions to satisfy slogans. Flag a suspected out-of-scope improvement rather than expanding the task.

Over successive changes, use supported existing tools/review evidence to track duplication, module coupling/cycles, suppressions, test brittleness and instruction growth when relevant. Trends prompt a bounded consolidation proposal, not sweeping auto-refactors, arbitrary universal thresholds or a scheduled optimizer daemon. Functional acceptance alone does not establish maintainability.

**Contribution/composition contract:** recipes/roles/host bindings declare version, owner, compatibility, inputs/outputs, tools/permissions, fixtures and provenance/license. Contributions enter source review, conformance evaluation and a maintained release, not an arbitrary runtime plugin loader. No silent new scripts or hard-constraint override. Resolve defaults by explicit preference precedence; incompatible required checks/permissions block the affected composition, not unrelated work.

Section 3.12 governs parameter/module composition and private declarative adaptation. Recipe quality profiles state relevant domain invariants, expected workload, access needs, reliability/recovery, accessibility and locale requirements; unneeded UI/data facets receive explicit non-applicability, not ritual tests. A non-web brownfield source-only conformance fixture checks core assumptions without expanding checked implementation support; Q-02 owns any additional qualified family.

**Prototype hardening:** preserve explicit intended use, data restrictions, known omissions and accepted working behavior. Before promotion, inventory shortcuts/gaps, characterize existing behavior and add behavioral red/green checks for missing safeguards/bugs. Use sensitivity/negative controls in safe fixtures where suitable; do not delete/rebuild working code to fake TDD, mutate live user data or claim every existing test must first fail. Reassess applicable recipe checks and obtain distinct assessment before a checked-local verdict. Neither promotion nor owner acceptance proves production readiness.

CLI/library/service and other recipe checklists may ship as clearly labeled guidance previews. They do not expand the supported software matrix until complete journeys, domain-specific checks and maintenance evidence pass. Select further families from demonstrated user demand rather than Markdown creation cost.

### 3.11 Experience contract: useful work without workflow administration

These proposed R1 interaction defaults are subject to Q-01/02/05/08 approval and exact-host qualification; they do not add a custom UI/runtime. F-02/04/08-10/13/20/24/34/38 summarize them, AC-21/22 exercise them. The UX Spec must preserve these outcomes while selecting native wording/affordances.

**Engagement and first task:** installation makes Tenet available, not ambiently in charge. Invocation with a task engages it; state engagement/next meaningful step once through native UI or concise text. A conversation/help/status question need not create files, a contract or a new run. Questions while working do not cancel/pause it unless requested. Users may give a high-level outcome; no required brief/template/config interview or preset choice. Resolve 3.12's defaults behind the task, inspect known facts and do useful safe work while unrelated prerequisites remain unresolved.

**Readiness:** basic plugin load/permission diagnosis precedes dependent actions, project inspection identifies applicable commands/guidance, action checks validate the actual proposed effect. Cache observations with provenance; refresh relevant inputs/capabilities on changes, restart or uncertainty. Version/mtime alone is not proof of unchanged policy/scripts. Do not probe all accounts/roles/hooks on every turn or report optional gaps as a setup failure. A read-only review can produce findings while build tooling is broken. A secret-free doctor explains a missing executable, occupied port or unavailable service and proposes a safe fix; no automatic installs, permission elevation or secret solicitation.

**Adaptive depth, independent of communication style:**

| Lane | Typical fit | Minimum distinction |
|---|---|---|
| Quick | Clear small fix, investigation or behavior-preserving refactor | Reuse valid scope/design; targeted checks and proportionate distinct assessment without a document suite |
| Standard | Bounded feature/bug with ordinary uncertainty | Concise outcome/plan, meaningful evidence and independent assessment where consequential |
| Deep | Consequential design, migration or substantial access/compatibility risk | Resolve dependent choices and use additional design/review/check depth inside explicit limits |

Select a recommended lane from risk/task, explain only consequential differences and permit user changes within mandatory floors. Prototype is an explicit unhardened endpoint, not a fourth assurance lane or a default for novices. No fixed multi-agent count or lower safety for expert/Surgical users; no mode menu before users can describe the need.

**Clarification and decisions:** inspect first, reuse answered facts and ask only what changes the next dependent action. Give a recommendation, consequences and a reversible default where justified; defer independent future choices. Use focused native questions and batch related context only where the host supports it; no universal prompt cap. Never replace a genuine business choice with a guessed assumption to hit a friction metric. A clear request supplies scoped local authority under 3.7; do not ask again merely to "approve the plan." Request native consent only as required and explain unfamiliar effects; no promise to suppress host prompts or automatically broaden allowlists.

**Progress and time away:** use native progress for actual activity and brief updates for phase changes, blockers, consequential discoveries or prolonged silence under the qualified host's limits. Say what completed, what is next and why user input is needed; no fabricated percent/ETA or specialist chatter. Front-load known consequential decisions for unattended periods, then continue only inside existing authority. Never auto-answer a question, force a native continue or claim to run after host closure. Native request/iteration ceilings are distinct from Tenet budgets: save scope/evidence/remaining effort and resume without repeated setup or counter resets. Use completion notifications only where native support is proven, not a new daemon.

**Steering and interruption:**

| User action | Required behavior |
|---|---|
| Status / inspect / explain | Answer from current state with relevant partial artifacts; do not restart, broaden scope or require worker-chat inspection |
| Refine / change direction | Apply an in-envelope refinement; record material amendments, reuse unaffected work and ask only for newly uncovered authority/choices |
| Pause / park | Stop new dispatch at the earliest controllable boundary, preserve useful state and report active/unknown effects; parking does not require perfect completion |
| Cancel | Stop controllable owned work and report residue; no implicit rollback, user-process termination or fabricated cancellation of already-run effects |
| Undo | Preview attributable local reversal and conflicts under 3.4; preserve human edits and explain nonreversible/remote/data effects separately |
| Resume / continue selected findings | Reconcile current source/authority, reuse valid evidence and scope remaining work; numbered findings carry forward without a fresh intake interview |

**Results and disclosure:** lead with the useful outcome and how to use/inspect it, then relevant evidence and actionable gaps. Keep detailed contract/verdict axes, receipt identity, agent/model/accounting unknowns, histories and cost breakdowns accessible through native detail/status or concise local records. Disclose stable host/assurance limits once and on changes; repeat a limitation when it materially affects this task, not as boilerplate every response. Never suppress a real failed/missing check, risk, unknown external effect or spend decision to sound confident. Ready local work needs no forced final approval question; retain owner acceptance as pending until observed. A review may naturally end at findings; "fix findings 2 and 4" bridges to implementation authority without silently fixing all.

**Personalization and preferences:** adapt explanations immediately and let users change style/depth in ordinary language. Explicitly scoped durable corrections can be saved locally with visible provenance; inferred preferences need confirmation, but not a save dialog after every correction. Clarify project versus cross-project scope only when persistence is genuinely needed and ambiguous. No personal biography/history mining or shared persona files. User-local defaults have inspect/reset/export controls; project hard constraints and native policy remain authoritative. Progressive detail must not remove the understandable reason for a decision.

**Experience qualification:** observe complete task sessions, not just installation and isolated message snapshots. Include unfamiliar and experienced users, ordinary clean tasks (false-positive friction), missing-tool/policy denial and interruptions. Q-04/07 freeze actionable-question, duplicate-approval, first-value, comprehension and recovery targets after formative calibration; do not import unverified private-history counts or universal numeric caps. A fast readiness report is not a useful product outcome.

### 3.12 Configuration contract: adapt the work, not the truth

This section owns configuration behavior; F-24 indexes it and AC-23 tests it. These are proposed R1 contracts, requiring product approval under Q-05/08 and native feasibility under SP-02. The Tech Spec chooses schema, paths and native surfaces; no manifest settings UI, cross-host rule syntax, centralized policy service or general-purpose workflow language is assumed.

#### Categories, owners and independent dimensions

| Category | Examples | Change authority and invariant |
|---|---|---|
| Tenet integrity rules | Evidence honesty, no bypass of denial, untrusted text grants no authority | Not runtime preferences or experiment targets. No release may relabel failed evidence as pass or confer authority through content |
| External restrictions | Host permissions, organization policy, target access | Governed externally; Tenet configuration cannot override them |
| Accepted project commitments | API compatibility, data/access boundaries, required checks, protected paths | Amend only through the legitimate project owner and impact-aware scope/exception; no casual task preference or agent self-waiver |
| Assurance requirements | Evidence needed for a checked result, independent assessment where consequential | Meet requirements or select an explicitly authorized different endpoint with truthful limitations; acceptance cannot manufacture evidence |
| Preferences and conventions | Style, preferred library, planning detail, model ranking | Scoped overrides allowed within applicable commitments/restrictions |
| Observed facts and state | Commands discovered, available models, current usage, candidate/phase | Record provenance/freshness; not user assertions made true by configuration |
| Executable/data configuration | Commands, roots, fixtures, exclusions, secret references | Structural validity is not execution trust; inspect effects and apply actual authority/native consent |
| Lessons | Task correction, scoped remembered preference, evaluated guidance change | Apply the learning/persistence rules in 3.4; inference is not an accepted project commitment |

A request can independently set communication style; workflow depth; endpoint; consultation/checkpoint preference; resource/model preference; data restrictions; and persistence. Recipe/module applicability and observed host capability constrain these choices. More explanation does not require more agents, serial work does not imply weaker evidence, Deep does not imply cross-family review, and a guarded control does not select a lane. "Ask less" is not permission. Users need not understand these categories to describe their intent.

#### Typed settings and scope resolution

The versioned, schema-backed catalog is the single settings definition used to generate validation/reference material and fixtures. Each setting declares meaning/type/units, allowed values, default, scope/owner/trust, category, composition rule, prerequisites, sensitivity, activation timing, authority/evidence impact, reset, migration and deprecation behavior. Define absent/inherit, explicit automatic, disabled, empty, zero and null separately where supported; zero never accidentally means unlimited. Unknown or incompatible keys/versions receive specific diagnostics, never silent security-relevant fallback. Parsing does not execute code.

Optional shared project policy and soft defaults are readable, diffable and deliberately adopted, not silently committed or inferred from all AGENTS.md prose. They can declare required checks, protected paths, risk areas, minimum depth/evidence and data restrictions. Existing owner-controlled artifacts can supply them without a mandatory duplicate file. Shared rules guide cooperating installations; they are not centralized team administration or enforcement over teammates. An agent may propose changes and apply an explicitly authorized change, never approve its own policy exception.

Preferences resolve from plugin reference defaults -> user-local defaults -> adopted shared project defaults -> project-local overrides -> applicable module/path defaults -> explicit task override. Personal presentation/model overrides can be explicit task choices without modifying shared policy. At overlapping scopes use documented field-specific specificity; equal-specificity conflicts require resolution, not file-discovery order. Local settings cannot erase shared commitments. Restrictions and commitments apply independently of that preference ordering:

| Value kind | Composition |
|---|---|
| Scalar preference | Most-specific applicable explicit value wins |
| Ranked options | Preserve declared order; replacement is default, explicit merge/deduplication only when defined for that field |
| Required checks | Preserve applicable obligations, deduplicate equivalent execution with valid evidence; incompatible requirements block dependent work |
| Prohibitions/allowlists | Preserve applicable prohibitions and intersect binding allowlists within their scope; widening needs the relevant owner's authority |
| Resource ceilings | Satisfy all applicable ceilings in compatible units; do not compare/sum incompatible or unknown quantities |
| Commands/recipes | Select by applicable module/task/environment, not arbitrary concatenation or executable string interpolation |
| Retention/evidence | Resolve actual obligations and consent explicitly; no silent indefinite retention or hidden deletion |

Removing an override restores the applicable inherited value, not necessarily the plugin default. A reset cannot erase a binding restriction. Applicability/path matching specifies normalized roots, case/platform behavior, overlap and symlink aliases on the execution machine; it does not assume the host's glob syntax is universal. A cross-module change includes relevant dependency checks, not merely files directly edited. Unknown relevance uses an explained bounded conservative fallback.

Supported conditional settings declare the observed facts and finite matching rules they depend on; unknown facts are not guessed true/false. Explain unresolved applicability and block only affected unsafe actions. Arbitrary executable expressions and recursive configuration are out of scope.

#### Reference configuration and convenience presets

**Reference configuration:** a proposed versioned R1 baseline, frozen with exact numeric settings and qualified host/recipe versions before qualification evaluation. This table is its product-level inventory, not proof that every option is available today. Product owner approves defaults under Q-05/08; technical/QA/UX owners resolve the named gates before qualification.

| Setting family | Proposed reference default | Scope/change treatment |
|---|---|---|
| Communication | Balanced; use the conversation's supported language, disclose Q-10 limits | User/task preference; explanation language differs from app locale, docs and code conventions |
| Depth and endpoint | Risk-adaptive Quick/Standard/Deep; checked local for feasible implementation, findings for review | Task-specific, within required evidence; prototype only explicitly requested |
| Consultation | Act on clear in-envelope requests; ask on consequential unresolved choices | User may request additional milestones/teaching explanations, never bypass mandatory decisions/native consent |
| Resources | Finite task-class aggregate/inner/review/delegation bounds, warning/handoff reserve | Numeric values block qualification until calibrated under Q-07/08; not unlimited defaults |
| Models/accounting | Active eligible model; only observed usage, unknown remains unknown | Optional portfolios/diversity/account data depend on qualified access; no routine picker switching |
| Parallelism | Selective native read-only delegation; one writer per qualified workspace | Task may request serial/no optional subagents; actual dispatch capability still must qualify for the flagship |
| Project commands/checks | Discover relevant module commands, inspect effects and bind accepted behavior/check requirements | Project/module settings; command reuse requires unchanged relevant inputs, not blanket execution trust |
| Policy/risk map | Preserve accepted commitments; propose protected/high-risk areas from inspection | No invented blanket path bans. Explicit rules can impose minimum depth/checks; model judgment can raise a concern, not relax them |
| Context/data | Minimize context, honor applicable explicit exclusions, no implicit new destination | No guarantee of zero host traffic; sensitive-content and attachment limits in 3.8 remain |
| Persistence/sharing | Local metadata/guidance; shared policy/charter off until adopted | Q-06/SP-02 qualify storage/loading, invoked-only fallback; no required project writes for review |
| Dependencies | Reuse suitable existing dependencies; inspect new identity/license/scripts/resolution | Optional project release-age/cooldown rule with explicit urgent-fix exception; no arbitrary universal age threshold or safety claim |
| Learning/telemetry | Scoped observations/corrections; maintainer evaluated learning; telemetry off | Durable inference/sharing and optional user experiments require their stated authority |

Offer only a small evaluated set of convenience presets under Q-08, composed from existing settings; a proposed **Conserve** bundle reduces optional fan-out/overhead while preserving required evidence. Guided explanations/teaching, source-only review, explicit prototype and stricter exclusions remain independent choices, not mandatory persona modes. Presets apply to an understood task, never authorize implementation or silently change its endpoint. No "Ship", "Privacy-strict", "Offline" or "Compliance" label implies unqualified delivery, containment or certification.

Each preset names its version, controlled fields, untouched fields and capability prerequisites. Applying it previews consequential differences, preserves explicit overrides unless deliberately replaced, and is validated as a whole. Later preset/default updates do not silently rewrite accepted project configuration; observed native automatic updates follow 3.4/3.12 change rules. No preset menu is required before a user can describe work. More presets require demonstrated demand and combination tests.

#### Change, inspect, reset and import

Ordinary-language configuration follows interpret -> determine scope -> validate -> show material effective differences -> persist if authorized -> apply. A temporary "be concise" applies immediately; a durable or consequential request shows the interpreted value and scope, not just an acknowledgment of the sentence. Ask only genuinely ambiguous consequential questions. Structured readable configuration can be hand-edited and diffed, but ordinary adoption never requires it or developer setup.

Reapplying unchanged settings is idempotent: no duplicate guidance, manufactured revision/evidence churn or repeated authority prompt. A changed effective value produces a compact attributable revision; native consent remains governed by the host.

Keep requested, resolved and observed values distinct. On "why/config/status", explain the effective value, governing source/revision, overridden preference, capability limits and supported way to change it. Do not offer an override that bypasses policy. Show relevant change/cost-of-rigor tradeoffs when choosing materially different workflows; use observed units/qualitative uncertainty, not fabricated cost/ETA or a repeated billing banner.

Work and dependent evidence reference relevant effective configuration/recipe/guidance revisions; child assignments carry the applicable subset. Model decisions remain semantic judgment; represented settings resolution, schema checks/counters and field rules use small deterministic mechanisms where feasible. No full PRD/catalog injection per task and no config server. Cache resolution by relevant revision; qualify resolution/context overhead under Q-07.

| Mid-work change | Activation and effect |
|---|---|
| Presentation | Immediate; no evidence invalidation |
| Tighter data/path/resource boundary | Before further affected dispatch; retain consumed usage, stop new excess work and report active/unknown effects |
| Command/fixture/required-check change | Validate, reassess feasibility and invalidate dependent evidence only |
| Model preference | Future eligible dispatch; preserve past requested/resolved metadata |
| Recipe/procedure/default update | Safe boundary where possible; preserve overrides and reassess actual affected work, not all approvals |
| Wider scope/destination/route/spend or changed commitment | Requires sufficient explicit authority; configuration alone cannot grant it |

Validate and stage coherent changes before activation; no partial mixed revision. Failed edits retain the prior valid state only where compatible with current restrictions. If a newly tightened boundary is valid but a larger edit is not, block affected actions until resolved rather than continue under a looser old setting. Concurrent edits use revision-aware reconciliation. Nothing retracts content already transmitted or guarantees stopping an already-run effect.

Imports/export preview distinguishes portable preferences/policy proposals from secret references, machine-specific paths/accounts, private lessons and historical grants. Validate on the receiving host; no imported authority or automatic sync assumed. Migration explains changed meaning/defaults, preserves overrides and offers tested recovery; unsupported configuration versions block affected behavior. Reset one preference restores inheritance without deleting source, accepted intent or unrelated settings. Full reset states its exact scope under 3.4.

#### Composition, private adaptation and coexistence

Core project customization supports module commands, conventions, risk maps, required checks and non-executable review rubrics without upstream publication. Explicitly adopted local recipe parameters/procedure guidance are experimental outside qualified combinations; custom agent definitions/tool bindings require qualified host support, trust/effects preview and native consent. No dynamic third-party code loader, arbitrary templated shell or silent new tools. Official reusable contributions still require source review, conformance fixtures, license/compatibility and release maintenance under 3.10.

Separate the universal intent/authority/evidence loop from task-specific procedures and applicable quality checks (UI, data, access, API, CLI, library). Traits select checks, not a new support claim. Recipes declare parameter validity and supported combinations: naming an app differs from replacing its database. Work types include docs, dependency upgrades, performance, migrations and security fixes without universal new modes; actual incident response/delivery remains separately authorized and qualified.

Use native namespaced Tenet entry points where supported. Other plugins/instructions remain installed; do not disable, rewrite or hijack them. Detect visible conflicting routers/rules and ask only when they affect work; no universal discovery guarantee. An explicit choice of Tenet does not supersede host instruction precedence or authorize another workflow's side effects.

Conflict/infeasibility handling preserves safe progress: explain the competing requirements, governing sources and smallest viable options (narrow scope, alternative endpoint, authorized budget/policy change or stop). No silent weakening, profile downgrade or success-shaped fallback. Serial execution can retain deep verification; an insufficient budget should narrow the endpoint early rather than consume most effort on uncheckable code.

## 4. Context and Decisions

### 4.1 Executor profile

The downstream executor is an engineer or AI-assisted contributor familiar with plugin development but with no assumed knowledge of prior chats. This PRD owns product behavior. The reviewed Tech Spec owns file layouts, manifests, supported APIs, helper packaging and test procedures; the UX Spec owns interaction details.

The development sequence remains **PRD approval -> reviewed/approved Tech Spec -> reviewed UX Spec -> approved phased plan -> implementation**. UX/user feedback and bounded feasibility findings may send decisions back to the PRD; approval is not a ban on iteration. Each executable spike needs separate authorization for objective, host/data/actions, cost/time limit, cleanup and expected decision. This rewrite authorizes documentation only, not installation, credentials, paid experiments, publication or product implementation. [Validated: owner's sequence; proposed bounded iteration mechanics.]

### 4.2 Glossary

| Term | Meaning |
|---|---|
| Tenet | The broad governed, personalized, self-improving software engineering product/practice; its first deliverable is Tenet for Copilot, not a required standalone engine |
| Host/harness | The application/runtime executing the user's agent session |
| Plugin | A shared versioned package of supported customizations |
| Skill | On-demand instructions/resources; not executable authority |
| Specialist | A role fulfilled through a supported native agent or a focused pass |
| Hook | Code invoked at a supported host lifecycle event, with host-specific semantics |
| Recipe | Evaluated instructions, prerequisites and checks for a declared project/work type |
| Work contract | An authorized bounded increment with behavior, scope, evidence and endpoint |
| Candidate | The exact source/artifact state being checked, including relevant uncommitted changes |
| Evidence | Observable check output/references bound to the candidate and conditions, not a model confidence claim |
| Independent review | A distinct assessment of actual artifacts; not automatically isolated execution |
| Handoff | Saved project state sufficient to reconstruct work in another session |
| Supported | Qualified on the exact published host/project combination |
| Advisory | Process guidance that the plugin cannot technically enforce |
| Effective configuration | Resolved applicable preferences/commitments and observed capability limits, with relevant source revisions; not an authority grant |
| Project commitment | Accepted obligation amendable by its legitimate owner, unlike a freely overridable soft default |
| Preset | Versioned bundle of existing settings; no extra capabilities, permissions or safety guarantees |
| Checked endpoint | A result meeting the stated applicable evidence obligations; distinct from owner acceptance or production readiness |

### 4.3 Decisions already made

All directions below were established on October 14, 2026. Approval of this rewritten draft is still pending.

| ID | Decision | Rationale / authority | Annotation |
|---|---|---|---|
| D-01 | Deliver the first Tenet experience as an open-source Copilot plugin with native installation and maintenance | Owner requests plug-and-play adoption; Copilot is the first deliverable, not the vision ceiling | [Validated] |
| D-02 | Reuse host hooks, agents, permissions, models and UI before building infrastructure | Owner explicitly challenged rebuilding a harness | [Validated] |
| D-03 | No required standalone engine, SDK worker manager or daemon in the initial product | Consequence of plugin-first direction; approval confirms this release boundary | [Assumed: verify - product owner, PRD approval] |
| D-04 | Govern the loop through active intent stewardship, traces, guardrails, cross-model critique and evidence | Owner's original goals and five pillars remain; enforcement claims must fit qualified capabilities | [Validated] |
| D-05 | Support new and existing applications; do not copy a factory into each repository | Shared distribution and portable project ownership address stale copies | [Validated] |
| D-06 | First support Copilot in VS Code; qualify app/CLI separately | Proposed narrow support cut, not identical client capability | [Assumed: verify - product owner, PRD approval] |
| D-07 | Improve through outcome-driven experiments, scoped lessons and evaluated releases; R1 promotion is human-reviewed | Owner requests an effective autoresearch-like loop; automatic promotion requires later qualification | [Validated for direction; assumed R1 mechanism, product owner at PRD approval] |
| D-08 | A plugin cannot inherit the old autonomous-platform guarantees | Evidence and enforcement claims must match actual host boundaries | [Validated: documented host-specific component behavior; product approval confirms scope] |

This revision supersedes v0.11 as the proposed governing product document. Earlier platform FR/G/Q identifiers remain retired, not silently mapped onto new F/AC/D IDs; Section 2.5 covers guarantee families. The five pillars/name are owner-directed; current defaults, configuration contract and flagship native-delegation cut need owner approval. Archives remain historical, not latent requirements, and are unchanged.

### 4.4 Dependencies

Official documentation was consulted October 14, 2026. Availability in a document is not qualification on an installed version.

| Dependency | Status | Owner and required evidence | Blocker |
|---|---|---|---|
| Native plugin installation/distribution | Documented for Copilot clients and VS Code | Release maintainer proves clean install/update/removal under Q-01 | Yes, for each supported host |
| Skills, custom agents and model selection | Documented with client-specific differences | Technical maintainer tests loading, delegation and model behavior | Yes, for claimed workflows |
| Hooks and permission decisions | Host/mode/version-dependent; some features are preview | Technical maintainer tests invocation, denial, failure and disabled state; no silent downgrade | Yes, for any claimed enforced control |
| Plugin helper execution without manual runtime setup | Unproven packaging assumption | Technical maintainer resolves in Tech Spec; remove dependency or bundle it | Yes |
| Project tooling and fixture recipe | Not selected | Technical maintainer selects one reproducible recipe and matching brownfield fixture under Q-02 | Yes |
| Optional CI/delivery | External and unconfigured | Project owner supplies explicit authorization; not an R1 dependency | No |
| License and contribution rules | Not selected | Product owner resolves Q-03 before public distribution | Yes, for publication |

### 4.5 Constraints and stakeholders

| Constraint | Source / annotation |
|---|---|
| No expert user-side installation or service maintenance | Owner's explicit plug-and-play requirement [Validated] |
| Native trust prompts and organization policy remain authoritative | Host documentation [Validated]; never promise zero consent |
| No broad subscription or model entitlement inferred from the plugin | Host/account boundary [Validated] |
| No specific application cloud or stack imposed across all projects | Owner's configurable-project direction [Validated]; recipes bound support |
| No private histories/archives in published packages or evaluation by default | Prior project privacy requirement [Validated] |
| No maintenance of a parallel custom agent harness | Current product direction [Validated] |

The product owner resolves scope/defaults and approves PRD/release. Technical maintainer owns compatibility/packaging/checks; UX owner owns interaction/usability; QA/release owner owns qualification; evaluation owner owns comparisons; security maintainer owns threat review, disclosure and incident coordination. One person may hold several roles, but independent assessment coverage is disclosed. Q-04/Q-09 assign accountable people before the corresponding work; role labels are not invented staffing commitments, and the owner is not automatically every role. An agent cannot appoint itself approval authority.

## 5. Failure Conditions

These conditions invalidate an assumption or support claim. They are not invitations to add a hidden platform.

| ID | Type | Observable deviation | Required action and owner | Severity |
|---|---|---|---|---|
| FC-01 | Integration | Plugin loads but a required agent/hook/command does not run on the advertised host | Mark combination unsupported/limited, block the affected workflow, and return to technical maintainer; correct support claims before release | Major |
| FC-02 | Authorization | Native permission is denied or organization policy blocks an operation | Normal blocked-action outcome: retain useful work, explain the native route and continue only independent authorized work. Never bypass. Repeated unanticipated denial may invalidate support/usability claims; denial itself is not a security incident | Expected block; Major if support claim is invalid |
| FC-03 | Packaging | A clean user must install an undeclared runtime, edit JSON or run developer setup to use Tenet | Stop release qualification; maintainer changes packaging or proposes an explicit product-scope revision | Major |
| FC-04 | Process | Source, requirements, plugin behavior or settings changed since the recorded result | Invalidate affected evidence, reconcile scope and rerun checks; project owner resolves consequential intent conflicts | Major |
| FC-05 | Verification | A known failing/undeclared simulated fixture is reported complete | Block release, investigate the workflow/check and add regression coverage; verification maintainer owns correction | Critical |
| FC-06 | Data | Untrusted text requests expanded authority, or actual output/source publication/payload exposes unapproved private material | Reject unauthorized instruction and continue safe work; attempted injection alone is not confirmed exposure. Actual exposure stops sharing, records known scope and invokes authorized incident response; no silent deletion/rotation | Expected rejection; Critical for exposure |
| FC-07 | Lifecycle | Host termination/update loses an unsaved action or leaves a remote result ambiguous | Report unknown state, inspect actual source/remote state and obtain resolution before retry; do not claim durable exactly-once recovery | Major |
| FC-08 | Value | Pilot misses its frozen value target or requires recurring expert rescue | Do not claim plug-and-play/effectiveness; product owner narrows workflows or changes the hypothesis before expanding support | Major |
| FC-09 | State/concurrency | Record schema/conflict/storage failure or concurrent writer makes authority/candidate identity uncertain | Stop dependent writes/verdicts, preserve valid state and reconcile; technical maintainer blocks the affected profile until integrity fixtures pass | Critical |
| FC-10 | Control failure | Missing/disabled/timed-out guard does not prevent the advertised action dispatch | Withdraw guarded claim, stop dependent operations and requalify actual host semantics; no automatic advisory substitution | Critical |
| FC-11 | Budget/context | Aggregate retry/context/storage/latency budget is exceeded or compaction loses constraints | Save known handoff and stop/degrade only as authorized; maintainer narrows workflow and reruns stress qualification before release | Major |
| FC-12 | Evaluation | Candidate/evaluator/holdout/threshold changed after outcome inspection or test suppression generated apparent success | Reject the inference, retain baseline, document contamination and rerun a frozen independent comparison; evaluation/QA owner resolves | Critical |
| FC-13 | Configuration | Resolution depends on discovery order, malformed/imported settings relax a restriction, or a worker uses an incompatible revision | Block affected actions/verdicts, preserve diagnosable state and reconcile under 3.12; technical maintainer adds deterministic regression cases before qualifying the composition | Critical |

**Worst Misinterpretation Test:** "installed" cannot mean "all components enforced"; "verified" cannot mean "the coder said done"; "resume" cannot mean "rerun every prior action"; "update" cannot mean "overwrite project code"; "automatic" cannot mean "ignore consent." AC-03/07/08/10 and responsibility labels explicitly reject these interpretations.

## 6. Ambiguity Audit and Readiness Gates

Review persona: a new engineer or AI executor with no chat history. Decisions are resolved here or explicitly owned; technical design choices are not falsely counted as settled product facts.

| ID | Type | Question | Resolution / confidence |
|---|---|---|---|
| AMB-01 | Definitional | Is the vision limited to a Copilot plugin? | No. Tenet is the broad engineering/governance vision; the first deliverable is a Copilot plugin with no required engine/daemon. Sections 1-2. H |
| AMB-02 | Precedence | Do older platform requirements still apply? | Replaced by this scope; guarantee-family dispositions in Section 2.5 and identifier retirement in Section 4.3. H |
| AMB-03 | Behavioral | Does host closure leave Tenet running? | No such guarantee; saved artifacts support later reconstruction. F-10/15. H |
| AMB-04 | Authorization | Does installing Tenet authorize project scripts or deployment? | No; native consent and explicit work/effect scope still apply. F-06/08/22. H |
| AMB-05 | Temporal | Do updates change active jobs or old application source? | Host refresh behavior is disclosed; changed work is revalidated and application migration is separate. F-26. H |
| AMB-06 | Ownership | Who chooses host/recipe/license/value threshold? | Open register below; accountable people still must be assigned. Not silently settled by an executor. |
| AMB-07 | Behavioral | Does every task need every role, experiment or two paid models? | No; proportionate core loop, optional qualified profiles and maintainer learning baseline. Sections 2.4, 3.2 and 3.7. H |
| AMB-08 | Assurance | Can owner acceptance, a local pass or a disabled guard be called protected/complete? | No; independent verdict axes/profile prerequisites apply. Sections 3.5 and 3.7-3.8. H |
| AMB-09 | Configuration | Does the latest task/preset/file override every rule? | No. Typed field rules distinguish preferences, accepted commitments, external restrictions and observed capabilities; relevant owners approve amendments. Section 3.12. H |

### 6.1 Product decisions still requiring authority

All Q entries are **[Unknown: TBD]**. Proposed defaults are not owner decisions. Deadlines are blocking lifecycle gates rather than fabricated calendar promises; the approved phased plan assigns dates and people. Decisions may be resolved independently when their prerequisites allow.

| ID | Open decision | Proposed resolution | Owner and deadline |
|---|---|---|---|
| Q-01 | Exact primary support combination and core assurance | Propose one VS Code desktop application plus named harness/session/execution target and checked-local profile; prove actual dispatch/parallel reads under SP-08 as well as SP-01/02/06. Publish OS/remote exclusions. Failure reopens host/cut, not a silent focused-pass substitute; SP-03 gates guarded capabilities only | Product owner at PRD approval; technical maintainer before Tech Spec approval, full matrix before beta |
| Q-02 | Recipe and initial audience | Propose one persistent web/API starter, separate brownfield references and technical-builder audience with observed Guided use. Include a non-web source-only conformance fixture to expose core coupling, not to qualify additional implementation families. Approve module/parameter support and experimental-assistance boundaries; no forced starter conversion | Product owner at PRD approval; technical/UX owners before Tech/UX Spec approval |
| Q-03 | Open-source license and distribution identity | Choose license, upstream attribution/contribution policy, GitHub repository identity and marketplace name; do not invent publisher verification or marketplace inclusion | Product owner before public distribution |
| Q-04 | Evaluation and accountable owners | Approve method/roles; use baseline and labeled formative data to calibrate, then freeze numeric value/quality/cost/latency/friction targets, held-out tasks, cohort, follow-up and claims before each qualification candidate cycle. Retain failures and uncertainty | Product owner at PRD approval for method; evaluation/QA/UX owners before qualification pilot |
| Q-05 | Release cut across five pillars | Approve alpha -> R1, flagship native specialist/parallel-read minimum, task-first local defaults and optional profiles. Maintainer improvement plus scoped retrospection fulfills initial learning; no automatic end-user experiments | Product owner at PRD approval |
| Q-06 | Footprint, retention and export | Select qualified local-only/canonical modes, schema ownership and retention/size defaults. Approve inspect/reset/forget/export/import/deletion/migration behavior under 3.4/3.12 and invoked-only fallback; no required project writes for review | Product owner before Tech Spec approval; security/UX review before beta |
| Q-07 | Numeric overhead/reliability and friction budgets | Freeze reference environments/configurations, tail latency/timeout, scan/context/log/config-resolution/concurrency/retry limits, cache validity, friction/recovery thresholds and false-positive tolerances. Align AC-21/23 with Q-04, covering pairwise plus risk-heavy combinations | Technical/QA/UX owners before beta, not after qualification outcomes |
| Q-08 | Configuration, risk/approval and resource defaults | Approve 3.12's catalog/categories/field rules, reference configuration and limited presets. Keep Quick/Standard/Deep workflow depth separate from style, endpoint and authority. Approve risk/module rules, amendments, live-change/evidence effects, active-model fallback and finite aggregate/macro/inner/review/delegation budgets; no manual phase switching or universal retry counts | Product owner before Tech/UX Spec approval; maintainer qualifies interfaces and numeric defaults before qualification |
| Q-09 | Public release stewardship | Assign release/security support owners, supported-version window, compatibility recheck cadence, disclosure/withdrawal/deprecation process and known-good recovery method | Product owner/release maintainer before public beta/distribution |
| Q-10 | Accessibility/language and contribution scope | Approve native keyboard/screen-reader testing, starter scoped WCAG target, supported interaction language(s) distinct from generated app locale/code conventions, reviewed contribution and private declarative adaptation boundaries | Product owner/UX/technical owners before UX Spec approval; prove before public R1 |

### 6.2 Feasibility register: evidence before architectural commitment

All spikes below are **unexecuted**. Their role owners are assignments to make, not named people already available. No spike runs without separate authorization under Section 4.1. Record exact environment, procedure, observed behavior, failure cases and decision; documentation alone is not a pass.

| ID | Bounded question / required evidence | Gate and owner | Failure disposition |
|---|---|---|---|
| SP-01 | Can the selected native install path invoke required skills/helpers without user-managed runtime/build/config editing? Prove packaging, cold start and denied-execution behavior | Core; technical maintainer before Tech Spec approval | Remove unsupported helper need or change release/support proposal; no quiet runtime prerequisite |
| SP-02 | Where do instructions/configuration/project-local state load/store in this harness? Prove native invocation/persistence without manual editing, effective scoped resolution/provenance and child subset propagation; local-only/no-project-write review, versioned records, shared-guidance preservation and invoked-only/stateless fallback | Core; technical maintainer before Tech Spec approval | Narrow claims or revise product; no assumed native settings UI, universal rule syntax or copied engine |
| SP-03 | Which real tool action classes can hooks prevent? Prove denial, timeout/crash/disable/schema/conflict behavior and actual dispatch outcome, not only helper output | Guarded profile only; technical/security owners before offering it | Keep that profile unavailable; useful advisory/checked-local core may proceed |
| SP-04 | Can native roles resolve eligible models and reveal actual lineage/route? Prove restricted/unavailable model behavior and fresh-context costs | Portfolio/diversity profile; technical/evaluation owners before offering | Native active-model/user-assisted selection and truthful unknown coverage |
| SP-05 | Which session/quota/cost/cancellation signals are observable? Prove aggregate retry/delegation tracking and finite stop behavior without claiming global reservations | Core effort counters; detailed usage profile separately; technical owner before beta | Use bounded observable proxies/native limits; unavailable accounting stays unavailable |
| SP-06 | Can relevant candidate/test/config/untracked/fixture inputs be identified without expected-output self-invalidation? Prove parallel-reader staleness handling, scoped non-Git multi-file undo/integrity with human conflicts, workspace/shared-resource ownership, liveness/takeover and interruption recovery | Core evidence/recovery; technical/QA owners before Tech Spec approval | Narrow reproducibility/recovery/profile or reopen scope; never call uncertain inputs verified or invent universal undo |
| SP-07 | Can supported native update/disable/uninstall and known-good recovery preserve user overrides/state? Prove a version/schema failure and no lingering required Tenet service | Core lifecycle; release/QA owners before beta | Fix recovery/support scope before public release; no universal rollback claim |
| SP-08 | Can this exact native harness invoke named custom specialists and parallel independent read-only work with bounded context/tools/effort and usable results? Prove stateless follow-up, blocked/failed child, disagreement and cancellation visibility under AC-22 | Flagship core; technical/UX owners before Tech Spec approval | Reopen Q-01/05 or narrow host claim; focused serial passes alone do not meet the proposed multi-agent minimum |

**Readiness:** draft, not implementation-ready. Product decisions, unexecuted core feasibility tests, staffing and uncalibrated thresholds remain material unknowns. Tracking a question does not resolve it; a "zero untracked questions" count is not readiness evidence. PRD approval accepts product intent/scope and owned gates, not technical feasibility or release readiness. Only dependent design/qualification work is blocked by each unresolved gate; no need to wait for optional profile feasibility to design the core.

## 7. Implementation Guidance

### 7.1 Suggested approach

Use the documented Agent Plugins package format for a new Copilot-targeted plugin where it meets actual host requirements. Shared skills/resources form the portable core; host-specific agents, commands and hooks are thin, tested integration pieces. Do not assume a Cursor-specific pstack component works unchanged in Copilot.

Reuse native progress, questions, source diffs, permissions, model selection and agent delegation. Prefer native tools and small bundled deterministic checks. Do not add Copilot SDK, a custom VS Code extension, MCP server, database or background service merely because the overall vision includes orchestration.

Technical design must decide exact component discovery, skill invocation, artifact/charter locations, guidance personalization and loading, trace correlation/retention, experiment evaluation, supported helper packaging, hook failure behavior, instruction conflicts, model portfolios, available usage interfaces and host update detection. When a capability cannot be detected automatically, use an explicit setup probe or mark it unverified; do not infer it from a package version alone.

### 7.2 Known risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Clients load different components or hook semantics change | H / H | Per-host matrix, negative probes, narrow support, refresh guidance |
| Instructions are mistaken for security enforcement | H / H | Advisory/enforced labels, no universal governance guarantee, optional external gates |
| Shared procedures conflict with project conventions | M / H | Inspect first, scoped configuration, no wholesale instruction replacement |
| Extra roles/review cost more than they save | M / H | On-demand roles, finite review, matched native baseline, remove unnecessary stages |
| Bundled executable content undermines low-friction trust | M / H | Minimal payload, executable disclosure, no required service or opaque bootstrap |

### 7.3 Milestones and checkpoints

These are capability checkpoints, not an approved implementation plan or schedule. Effort sizing is deferred until technical feasibility and capacity are known.

| Milestone | Evidence to advance |
|---|---|
| Product approval | Q-01/02/04/05 method and release cut agreed; remaining decisions have people, dates and dependent gates; no implementation implied |
| Authorized native feasibility | Core SP-01/02/06/08 evidence informs reviewed Tech Spec; optional SP-03/04 do not block honest core |
| Core alpha / complete local workflow | New/brownfield checked result, task-first reference configuration and scope/constraint resolution, native specialist/parallel-read journey, review-only/check effects, meaningful TDD, distinct review, handoff/non-Git recovery, native denial and scoped retrospective |
| Beta / qualification hardening | Q-06-10 resolved, numeric budgets frozen, SP-05/07 and fault/tamper/privacy/concurrency/update suites pass; qualification pilot protocol frozen before its candidate outcomes |
| Useful public R1 | Applicable AC-01-23 suites pass for exact support matrix and declared configurations, external pilot/friction/follow-up and maintainer learning reported, source/payload privacy/license/recovery/support ready, release explicitly approved |
| Qualified expansion | Each new host/recipe/optional integration earns its own acceptance evidence; no hidden engine introduced |

## Open Tensions

| Tension | Resolution and remaining decision |
|---|---|
| Plug-and-play versus executable-plugin trust | Consent remains native; minimize and disclose executable content. Product owner confirms scope at PRD approval; maintainer must pass install/denial tests before release |
| Strong governance versus a user-disableable plugin | Claim workflow discipline and demonstrated controls, not total machine enforcement. Strong publication guarantees require external controls; no new service is implied |
| Cross-host reuse versus different capabilities | Share the package but qualify each host independently. Q-01 resolves the primary host; missing essential capability blocks that support claim |
| Concrete multi-agent value versus needless fan-out | Proposed flagship minimum proves actual native specialist/parallel-read use, not a fresh worker per lookup. Product owner approves Q-01/05 cut; technical/UX owners prove SP-08 before Tech Spec approval or reopen the host/cut |
| Cross-model review versus limited account access | Proposed optional qualified diversity profile, distinct core assessment for all consequential work. Owner approves cut under Q-05; never fabricate diversity or require unrelated subscriptions |
| Continuous improvement versus version stability | Reviewed shared releases and scoped project lessons; no silent application rewrites or self-approved policy changes |
| Broad outcome optimization versus incomplete telemetry | Capture permitted delivery/operational data with provenance; mark gaps and narrow claims. Evaluation owner defines usable objective/data coverage before each experiment |
| Model/subscription flexibility versus host access | Portfolios express preferences, not entitlement; account-wide tracking and route automation wait for permitted observable interfaces. Technical maintainer qualifies each route before support |
| Low ceremony versus auditable continuity | Local essential records and explicit exports, risk-adaptive depth and measured overhead; Q-06/07 decide defaults before beta rather than universal file/token caps |
| Secure gates versus plug-and-play helper packaging | Core evidence/state needs proven minimal packaging; strong gates are optional if the host cannot fail closed. Q-01/05 and SP-01/03 must not be resolved by a hidden daemon |
| Product completeness versus premature implementation detail | This PRD owns contracts; Tech/UX Specs choose schemas/APIs/prompts. Bounded separately authorized spikes may reopen product choices before implementation |
| Broad configuration versus novice adoption and qualified support | Resolve behind the task; expose material differences, not a wizard. Q-08 approves a small catalog/reference/preset surface before Tech/UX approval; Q-07 and AC-23 qualify interactions, not every theoretical combination |
| Continuity versus deletion and current restrictions | Preserve minimum useful records by default, but honor authorized deletion and newly tightened restrictions; disclose unavailable continuation/evidence and external retention limits. Q-06 approves lifecycle before Tech Spec approval |

## Assumption Registry

| ID | Assumption | Underpins | Confidence / evidence | Invalidating signal |
|---|---|---|---|---|
| A-01 | Native plugins provide a low-friction delivery path on the selected host | S-01, F-01-05 | H for documented mechanisms; official sources below. Actual qualification pending | Clean users cannot install/use without manual setup |
| A-02 | Needed helpers can run without a separately installed user-managed runtime/service | F-05 and packaging | M [Assumed: verify - technical maintainer before Tech Spec approval] | Required host/runtime dependency cannot be bundled or removed |
| A-03 | Structured workflows save enough supervision to repay review/context overhead | Section 3.6 | M [Assumed: verify - evaluation owner, pilot] | Frozen comparison misses target or voluntary reuse is absent |
| A-04 | One starter plus separately qualified brownfield references can establish local usefulness and real native specialist/parallel-read value without a new engine | S-03/05, Q-01/02/05, SP-08 | M [Assumed: verify - technical/UX maintainers before Tech Spec approval and task fixtures] | Native delegation, verification, recoverability or handoff cannot meet the narrow journey at justified overhead |
| A-05 | The chosen host exposes sufficient metadata/events for any claimed preventive gates and actual model/accounting observations | Optional profiles, F-12/30/32 | L [Assumed: verify - technical owner, SP-03/04/05 before profile support] | Events absent/disabled, unresolved model identity or unavailable account denominator; keep profile unavailable |
| A-06 | Local state and candidate identity can remain reliable under user edits, failures and interruption | F-18/34, SP-02/06 | M [Assumed: verify - technical/QA owners before Tech Spec approval] | Silent lost update, malformed state treated as approval or source-during-check false pass |
| A-07 | The proposed primary audience can make required decisions without recurring expert rescue | Section 1.4, AC-02/12 | M [Assumed: verify - UX/evaluation owners in external pilot/follow-up] | Users approve misunderstood risks, abandon intake or cannot use the checked result |
| A-08 | A compact native plugin can provide typed/scoped configuration and meaningful explanation without user-managed infrastructure | F-24, Section 3.12, SP-02 | M [Assumed: verify - technical/UX owners before Tech Spec approval and AC-23 qualification] | Required resolution/persistence depends on unsupported host settings or excessive setup/context overhead |

**[ASSUMPTION-HEAVY]** Multiple core and optional-profile assumptions remain unvalidated. No feasibility, effectiveness or cross-host equivalence claim is made. Section 6 gates their resolution; invalidation reopens scope rather than automatically expanding architecture.

## Adversarial Self-Critique

**Weakness 1: A polished instruction bundle can appear governed while remaining bypassable.** The assumption is that users benefit from transparent process controls despite host limits. If reports imply stronger assurance than actual controls, Tenet creates false confidence. Watch AC-03/07 failures and disagreements between declared enforcement and host behavior.

**Weakness 2: Tenet can become more ceremony than value.** The assumption is that intent preservation and independent critique reduce rework enough to offset extra steps. If users abandon the main workflow or need to invoke each specialist manually, simplify before adding more skills. Watch active effort, interventions and voluntary reuse.

**Weakness 3: Easy installation can conceal hard project readiness.** The assumption is that users distinguish installing Tenet from making an arbitrary application buildable. If setup executes unfamiliar scripts, hides missing prerequisites or reports untested repositories supported, adoption becomes unsafe and frustrating. Watch readiness-fixture failures and expert rescue in the pilot.

## Revision Triggers

| Trigger | Reassess | Timing |
|---|---|---|
| Host changes plugin discovery, hook semantics, permissions or model/delegation interfaces | Support matrix, F-02/11-14/22/26 and affected acceptance | Before claiming compatibility with the changed host |
| A required capability needs a daemon, SDK orchestrator, external account or manual runtime installation | Product form, exclusions and packaging promise | Before adding the dependency |
| A failing/stale result is labeled verified, or private data enters distribution | Verification/privacy contracts and release eligibility | Immediately; block affected release until corrected |
| Pilot misses the frozen value/usability target | Workflow depth, support scope and product hypothesis | At pilot gate, before expansion |
| A shared update breaks project records or changes existing application behavior without consent | Migration, ownership and version behavior | Before wider rollout of that update |
| A setting, recipe parameter or default change alters assurance, data scope or field-resolution semantics | Configuration catalog, AC-23 fixtures and affected qualification combinations | Before adopting the changed revision; do not silently migrate active commitments |

## Appendix

### Source basis and compatibility caveat

Official sources consulted October 14, 2026:

- [GitHub: About Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins) - packaging, client installation paths and component distinctions.
- [GitHub: Creating a Copilot CLI plugin](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating) - Agent Plugins structure and Copilot-specific components.
- [GitHub: Finding/installing plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing) - marketplace, update and removal mechanisms.
- [VS Code: Agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins) - source/marketplace installation, updates, permissions, inventories and client-specific hooks.
- [VS Code: Subagents](https://code.visualstudio.com/docs/agents/run/subagents) - harness-specific delegation, stateless Local subagent assignments, tool/model constraints and parallel work; not proof of identical Copilot/provider behavior.
- [VS Code: Hooks](https://code.visualstudio.com/docs/agent-customization/hooks) - preview/client-specific events, schemas and runtime/denial semantics; actual prevention requires testing on the execution host.
- [pstack](https://github.com/cursor/plugins/tree/main/pstack) - reference for a simple setup/main-workflow experience and reusable specialist procedures, not proof of Copilot compatibility or permission enforcement.
- [Karpathy: autoresearch](https://github.com/karpathy/autoresearch) - bounded experiments, a fixed evaluation/time budget, narrow editable surface, logs and keep/discard iteration. Its ML metric and execution/permission setup are not Tenet's product contract.

The documented portable core covers skills and MCP definitions; other capabilities depend on client support. VS Code documents separate plugin inventories for some management interfaces, harness-specific hooks, and implicit trust of plugin MCP servers on installation. Publish one tested install/update path per host. Documentation must be rechecked during qualification and flagged potentially stale if more than 30 days old at implementation.

Existing material under ref/, including previous specifications, reviews and private histories, remains historical and potentially private. Do not include it in default plugin context, public packages, examples or evaluation without exact-scope review and consent. This rewrite neither imports nor republishes that material.

### Review disposition: reconcile needs, do not concatenate prescriptions

The owner's supplied Claude, ChatGPT and Gemini critiques and the prior Copilot review are design inputs, not external approvals or verified research. Duplicate/conflicting recommendations are reconciled here. Private review attachments/history are not included as distributable content.

| Theme across reviews | Disposition and rationale | Owning contract |
|---|---|---|
| Vision coverage, MVP overload and users | Adopt coverage/defer triggers, explicit primary audience and staged alpha/R1. Adapt "make every pillar stretch": retain lightweight intent, traces, quality, learning and resource honesty in core; richer automation is optional/later | Sections 1.4, 2.4-2.5, 3.2, Q-05 |
| Host feasibility and honest guarantees | Adopt exact application/harness/execution profiles and capability register. Reject assumptions that embedded Node is callable, every host shares syntax or nonzero hook exit prevents action | F-02/05, Sections 3.7-3.8, SP-01-05 |
| Intent, risk, approvals and state | Adopt explicit authority/verdict axes, changed-scope invalidation and reversible-default triage. Adapt fixed question caps and mandatory micro-approval to risk-based user control | F-07-10/38, Section 3.7 |
| Specialist contracts and deterministic mechanisms | Strengthen proposed flagship minimum to actual native specialist dispatch plus useful parallel read-only assignments; retain focused passes for small work. Adopt bounded assignment/result/failure/adjudication contracts; reject a controller service, mandatory fan-out/fresh contexts and unqualified parallel writing | F-11-15, Sections 3.7/3.9, AC-22, SP-08 |
| TDD, anti-tamper and code quality | Adopt test-diff-first review, red-base/green-candidate evidence, characterization, separate behavior/structural verdicts and justified refactor. Reject blanket bans on changed tests/mocks/assertions, arbitrary package age and zero-duplication slogans | F-16-19, AC-05/07/18, Section 3.10 |
| Threats, supply chain and update trust | Adopt explicit threat/egress/helper/fault cases, no bundled MCP, release inclusion list, provenance/recovery and security ownership. Adapt universal fail-close/rollback promises to tested profiles/native mechanisms | F-22/26/28/33, Section 3.8, SP-03/07 |
| Footprint, privacy and continuity | Adopt local-default metadata, separate personal/shared preferences, provenance, scoped non-Git recovery/undo and relocation/loss semantics. Reject automatic Git initialization, broad shadow snapshots, perfect-undo claims, timestamp-only takeover and ignore-files-as-privacy | F-10/23/24/34, Sections 3.4/3.8, AC-08/11/17 |
| Context, performance and reliability | Adopt selective fresh context/repo map and finite measured budgets. Reject unsupported universal token caps, architecture portability percentages or mandatory phase resets | F-35, Section 3.9, Q-07 |
| Software breadth and extensibility | Adopt full recipe/role/host contribution and composition contracts. Adapt four-recipe suggestions to guidance previews, not four qualified families; preserve deep starter plus brownfield evidence | F-36, Section 3.10, Q-02 |
| Learning and experiment hygiene | Adopt scoped/expiring lessons, noise/tie rules, holdout-leakage disclosure and costed maintainer evaluation. Defer unattended promotion and private-data collection; frozen criteria are not automatically protected | F-21/29/31, Section 3.4, AC-14 |
| Models, usage and economic efficiency | Adopt eligibility-first portfolios, explicit accounting levels/proxies/import provenance and finite effort. Reject inferred entitlements, universal model arrays, account discovery and exact global spend caps without interfaces | F-12/25/32, Section 3.7, AC-15b/c |
| Pilot, acceptance and readiness | Adopt formative versus longitudinal evidence, frozen evaluation/quality floors, fault suites, real open decisions and staffing. Remove self-grading/zero-question readiness theater; no unsupported productivity claim | Sections 3.5-3.6, 6 |
| Task-first UX and disclosure | Adopt optional setup, incremental cached readiness, explicit engagement, proportional depth, native consent reuse, event-driven progress, layered results and review-to-fix continuation. Reject every-response banners, forced final approvals, recurring manual model toggles and fixed question/continue caps | F-02-10/20/38, Sections 3.7/3.11, AC-21 |
| Authority, evidence and test effects | Separate authority from evidence validity; allow within-objective amendments, targeted reruns and declared test-fixture mutations. Keep source-only review read-only. Reject "zero net writes makes testing safe," blanket runtime/cache input exclusions and automatic full-project reapproval | F-08/16/18, Sections 3.4/3.7, AC-04/05/08/18 |
| Limits, escape hatches and evaluation | Replace rigid submission counts with calibrated finite aggregate/progress/stagnation budgets; native pauses remain user-controlled. Explicit prototypes are unhardened, not quality opt-outs. Add clean/stochastic/friction/recovery cases and retain failed qualification cycles | F-09/15/37, Sections 3.5-3.6/3.9/3.11, Q-04/07/08 |
| Software breadth and ongoing health | Separate starter from brownfield eligibility, add meaningful local access/domain/migration checks and longitudinal structural signals. Reject three-probe universal support, mandatory external identity setup, automatic database resets and sweeping cleanup | S-03, Section 3.10, Q-02 |
| Denial, confidentiality and publication | Normal permission/policy denial is not automatically a Critical incident; attempted injection is distinct from exposure. Define exclusion capabilities and separate public-source/history privacy from release-package inclusion. No alternate install path bypasses policy | Sections 2.1/3.8, AC-11/16, FC-02/06 |
| Configuration as a coherent product contract | Adopt typed categories, independent dimensions, field-specific scope/merge/reset, a versioned reference configuration, explainable provenance and revision-aware lifecycle. Reject generic last-file-wins, config-as-authority/capability, a mandatory wizard and a custom settings server | F-24, Section 3.12, AC-23, Q-08, SP-02 |
| Presets, shared policy and private adaptation | Adapt to a small evaluated convenience surface, deliberately adopted project commitments/defaults and local declarative customization. Reject unproven offline/compliance/ship labels, automatic policy weakening, universal cooldowns and mandatory one-consent plans | Sections 3.8/3.10/3.12, Q-02/08/10 |
| Configuration quality, scenarios and breadth | Add reference/pairwise/risk-heavy interaction tests, non-web source-only conformance and module/dependency-aware checks. Keep support claims operation-specific; do not convert a few fixtures or parsed parameters into universal family support | AC-23, Sections 2.1/3.10/3.12, Q-02/07 |
| Execution economics, hardening and recovery | Add cost-benefit dispatch, source/config-bound children, normative-tradeoff decisions, prototype gap census and dependency-aware undo. Reject arbitrary worker/context thresholds, deleting prototypes to fake TDD, live-data mutation and atomic undo guarantees | F-14/16/34, Sections 3.4/3.7/3.10, AC-05/17/22 |
| Memory/privacy/lifecycle limits | Add relevance anchors, canonical-source reconciliation, bounded retirement, pre-read/pre-send exclusions and distinct reset/forget/delete actions. Disclose native attachment/context limits; reject universal claims about every open editor being sent or deletion of provider-held content | Sections 3.4/3.8/3.12, AC-09/11/23 |
| Spec readability and maintenance | Keep the simplified opening, ordinary language and existing glossary; consolidate policy ownership instead of splitting off new files or restoring removed reader/notation guides. Fix workflow-depth/presentation conflation and extend existing gates rather than invent sign-off | Sections 3.2/3.12/4.2, Q-08 |
| Research/billing/current-host/history assertions in reviews | Do not import unverified conversation-history counts, personal-history mining, billing dates, multipliers, scores or installation guarantees. Reject universal setup/prompt/token/file/retry caps; calibrate on public/synthetic or explicitly authorized evidence instead | Source caveat, Sections 3.6/3.9/3.11 and qualification gates |

**Revision record:** v0.6-0.9 established the Copilot-first deliverable, product foundations, five-pillar vision and Tenet name. v0.10 added tiered scope, authority/evidence, records, threat/release trust and evaluation gates; v0.11 strengthened task-first UX, genuine native delegation, proportional evidence and recovery. v0.12 reconciles the configurability reviews into one typed/scoped configuration contract, independent dimensions, reference defaults, change/provenance/reset semantics and scenario qualification. It also tightens module/recipe composition, dispatch economics, prototype hardening, anchored learning, confidentiality and multi-file undo. Only this PRD changes; defaults/feasibility remain draft, no implementation is authorized and no reviewer sign-off is claimed.
