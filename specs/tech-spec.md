# Tenet - Technical Specification

> v0.4 | October 15, 2026 | Draft for technical review | Implements [PRD v0.16](PRD.md)

## 0. About this document

### 0.1 Purpose, scope and precedence

This specification defines **how** Tenet for Copilot delivers [`specs/PRD.md`](PRD.md): architecture, components, data, algorithms, interfaces, security, the starter application, extension contracts, performance, reliability, verification, release and delivery.

**Precedence:** the PRD owns *what*, including the meaning of "checked", "authorized", "safe" and "supported". This document chooses mechanisms and never redefines semantics; if the two disagree, the PRD wins and this document is corrected. Where a better mechanism needs a PRD change, it is listed in Section 20.3 and stays inactive until the owner approves it; PA-1 to PA-6 were approved on October 15 and are in PRD v0.16. The UX Spec (not yet written) owns wording, command syntax, interaction layout and how screenshots are shown; names here are working names. **Scope:** R1 on the PRD Section 2.2 qualification tuple, with the extension seams R1.1 needs.

### 0.2 Status

This is a **pre-spike design**. Elements that depend on host behavior are marked **[SPIKE: SP-xx]** with a fallback; spike protocols are in Section 19.1. v0.5 records the spike results and becomes the approval candidate (PRD Section 10.3).

v0.4 incorporates five reviews of v0.3. Its main change is cost. Since June 1, 2026, Copilot bills by tokens (AI credits) rather than premium requests, so round trips, re-sent responses, tool schemas, retyped bodies and the choice of model now cost money. v0.4 makes routine kernel traffic small, keeps model choice with the host, reports usage honestly, and fixes correctness gaps the reviews found. Section 20.2 lists what was removed; Appendix E records the review points that were adapted or rejected.

### 0.3 Reading guide

| Reader | Start with |
|---|---|
| Owner and reviewers | 1, 2, 4.4, 4.8, 14.4, 20, 22 |
| Kernel implementer | 6–10, 15 |
| Skill and prompt author | 4, 5, 8.7, Appendix F |
| Starter and recipe author | 12, 13 |
| Security reviewer | 2.3, 7, 9.3, 10, 11 |
| QA and evaluation | 17, 19, Appendix A |

### 0.4 Conventions

- **TD-nn:** technical decision (Section 20). **TQ-nn:** open technical question (Section 21). **PA-n:** PRD amendment proposed by this document (Section 20.3). **[SPIKE: SP-nn]:** depends on a feasibility result.
- PRD IDs (for example `EVD-01`) and sections ("PRD Section 5.12") are cited, never restated as new obligations.
- "Kernel" is Tenet's bundled deterministic helper (PRD Section 5.7.1). "Agent" is a Copilot session following Tenet's skills. "Host" is VS Code with Copilot on the Local harness.
- Type sketches show shape, not final field names.

### 0.5 Complexity rule

Every mechanism in this document must meet four conditions:
1. it serves a named PRD requirement;
2. the host does not already provide it in a qualified form (Section 4.4);
3. it is the simplest mechanism found that meets the requirement;
4. it states the simpler alternative it beat, or the requirement that ruled that alternative out.

Mechanisms that only make an edge case more elegant are deferred until a fixture or measurement shows a real cost; the PRD allows such cases to be handled with a question or a narrower claim instead. Reviewers should reject additions that cannot meet the rule.

### 0.6 Native-first rule

The host keeps improving, and Tenet should get those improvements for free. Therefore:
- **Use the host for ordinary engineering work:** search, references, diagnostics, editing, questions, progress display, edit checkpoints, browsing and subagent isolation.
- **The kernel records only binding facts the host does not record:** verdicts, receipts, grants, locks, attribution, ownership, IDs and effect outcomes.
- **Every host-overlapping mechanism has a retirement row** (Section 4.4): what the host lacks today, Tenet's minimal fallback, and the condition under which the fallback is deleted. A new host capability is adopted when it qualifies and the duplicate is retired at the next minor release (PRD Sections 7.9 and 15).
- **Cost is a design input.** Every extra round trip, re-sent response, tool schema, retyped body and fresh subagent session consumes the user's credits (Section 14.4).
- **Host capabilities never change Tenet's semantics.** A native feature can upgrade a control's mechanism class (for example from cooperative to observed); it can never relabel evidence or authority.
- **No private access.** Tenet reaches host capabilities only through documented agent tools, plugin components and settings, never through a custom extension, a private API or transcript scraping.

---

## 1. Prior art and design tenets

### 1.1 What successful systems teach

Sources are listed in Appendix D. Several are secondary summaries, so lessons are taken as patterns, not benchmark claims.

| System | Pattern that worked | How Tenet applies it |
|---|---|---|
| Agentless | A fixed localize → repair → validate pipeline with reproduction tests beat agent loops at lower cost | Quick lane is a fixed pipeline (5.3.1); every behavioral change starts with a distinguishing reproduction |
| SWE-agent | Concise, bounded tool output plus guardrails shape agent quality | Compact kernel responses with drill-down (6.6); host diagnostics as early guardrails |
| Aider | A small, budgeted repository map; separate planning from editing | The host's language services act as the map; review manifests stay small (8.7) |
| OpenHands | An action/observation log decouples agent from runtime | One append-only log of effects and calls (7.1) |
| MetaGPT | Roles exchange structured artifacts, not chat | Roles exchange kernel-built manifests and typed records (5.5) |
| Kiro, GitHub Spec Kit | Linked, testable requirements and governance principles kept as plain files in the repository | `INTENT.md` managed blocks, decision records, charter and policy file (7.8) |
| Claude Code skills and subagents | Progressive disclosure; isolated subagent contexts; enforcement in code | Five skills with on-demand resources; fresh-context Reviewer; kernel as the authority |
| Cline checkpoints | A shadow Git repository gives snapshots without touching the user's repository | Non-Git prototypes snapshot into `.tenet/git` (10.9) |
| obra/superpowers | Two-stage review: spec compliance, then quality | Reviewer stages A and B (5.4) |
| Factory | A plan is the backbone; resumption is tested directly | Plan items as records; resume is a tested journey (AC-08) |
| Copilot coding agent, Codex CLI | Constrained write locations; approval and containment are separate controls | `tenet/` work branches; approval mode and containment recorded separately (11.4) |
| Backstage golden paths | Opinionated templates are products with owners | Recipes with owners, fixtures and monthly maintenance (12) |

### 1.2 Design tenets

| # | Tenet | Consequence |
|---|---|---|
| T1 | **Agents judge; the kernel records truth** | Only kernel verbs write verdicts, transitions, receipts, grants, counters, ownership, adoption and IDs (2.3) |
| T2 | **Pure core, thin edges** | Rules are total functions; Git, files, processes and hosts sit behind ports |
| T3 | **Short-lived and self-contained** | One process per call; no model calls, background work, Tenet network connections or repository code inside it |
| T4 | **One semantics, any front-end** | Every front-end calls the same verbs through the same pipeline (6.1) |
| T5 | **Bounded everything** | Every input, output, scan, run, log, store and response has a limit; routine responses are small (6.6) |
| T6 | **Fail toward honesty** | Uncertainty yields `inconclusive`, `unknown` or a question, never success |
| T7 | **Never surprise the working tree** | Human edits are never staged, committed, reverted or discarded implicitly |
| T8 | **Plain files, owned by the project** | Shared artifacts are Markdown and JSON; local state is small and mostly disposable |
| T9 | **Measure, then optimize** | Optimizations wait for a fixture that shows the cost (Section 14) |
| T10 | **Grow by conformance** | A new host, ecosystem or family is a conformance campaign over existing contracts (13) |
| T11 | **Native first; kernel as the floor** | Host capabilities do ordinary work; the kernel's fallback runs only where the host lacks a qualified capability (0.6, 4.4) |
| T12 | **Static registries for open sets** | Verbs, decision kinds, check kinds and adapters are explicitly registered modules, so extending Tenet adds a file. Closed unions stay simple switches. Nothing is discovered or loaded at runtime |

---

## 2. System overview

### 2.1 Context

```text
User ──chat──▶ VS Code (Local harness) ─── Copilot models (host-managed traffic)
                 │  Tenet plugin: 5 skills · 3 agents · 2 commands · kernel bundle
                 │  native tools: edit, search, usages, problems, terminal, subagents,
                 │                questions, todos, browser, checkpoints
                 ▼
   Project workspace (Git or not)        User config dir       OS temp or plugin storage
   ├─ source, tests, INTENT.md …         ├─ prefs              ├─ check run directories
   └─ .tenet/ (state, log, blobs, git)   └─ key (optional)     └─ sealed baselines (Beta)
   Project toolchain: node, package manager, vitest/jest, playwright, eslint, tsc
                 │ only on explicit request
                 ▼
   Git remote / user's CI
```

Tenet has no server, account or network endpoint. Remote traffic comes only from the host's models and from project tools that Tenet runs inside declared envelopes; those tools may use the network, as disclosed per check (Section 9.3).

### 2.2 Layers

```text
1 HOST BINDING   plugin.json · com.github.copilot/{agents, commands} · capability descriptor · [mcp.json] · [hooks]
2 PRACTICE       skills: tenet · tenet-intake · tenet-build · tenet-review · tenet-starter-ts-web-api
3 KERNEL         front-ends (cli, mcp, hook) → verb pipeline → verbs → pure core (rules) → ports
4 ADAPTERS       state store · git · runner · node adapter
5 PROJECTIONS    INTENT.md managed blocks · docs/decisions · docs/architecture.md ·
                 docs/hardening.md · tenet.policy.json · rendered status and results
```

### 2.3 Binding-fact boundary

| Fact | Written only by | Agents may | Mechanism class (PRD Section 5.4) | PRD |
|---|---|---|---|---|
| Endpoint, scope and reasons | `finish` (verdict) | Explain; never relabel | Deterministic | RES-02, EVD-06 |
| Lifecycle states | Kernel transitions | Request transitions | Deterministic | WRK-07 |
| Evidence receipts | `check` | Use host diagnostics and test views for feedback (never evidence) | Deterministic over observed runs | EVD-01 to EVD-12 |
| User decisions: authority, acceptance, adoption, dispositions | `decide` | Draft proposals and quote the user | **Cooperative** on the command line (the kernel records what the coordinator reports); deterministic capture only through MCP elicitation, if SP-12 confirms the kernel receives the answer (TQ-07) | SEC-02, INT-07 |
| Budget counters | Kernel | Read | Boundary-checked | WRK-08 |
| Work ownership | Kernel | — | Deterministic among Tenet calls | AGT-08 |
| Identifiers | `decide` | Use | Deterministic | INT-10 |
| Locks on acceptance tests | `check` | — | Detected | EVD-10 |
| Attribution of edits | `check`, `commit`, `finish` | Declare edited files | Detected plus cooperative; observed for agent-tool edits where observer hooks qualify (10.2, 4.7) | GIT-03, GIT-08 |
| Review independence and result integrity | `findings` | Dispatch the Reviewer | Observed where the host exposes dispatch (hooks) or the Reviewer submits directly (MCP); otherwise cooperative and disclosed | REV-06 |

**Rules that make the boundary bite:**
- Every status, result and review manifest is rendered from kernel output. A skipped kernel call leaves nothing to render, so it shows up as missing data rather than invented success.
- The kernel records validated *observations* (what ran, what changed, what the user was reported to decide). Schema validity, observed execution and semantic judgment stay separate fields; none is presented as another.
- Kernel state is protected against accidents and injected instructions, not against a process running as the same user that deliberately rewrites it (PRD Section 5.5).

### 2.4 Runtime views

#### 2.4.1 Standard feature

```text
User         Coordinator                     Kernel                          Reviewer
 │ /tenet …      │ open feature ────────────▶ │ readiness, ownership, floors,  │
 │               │◀── next, questions[] ──────│ assistance level, routine grant│
 │◀ examples ────│ (host search and usages in the main session)                │
 │── confirm ───▶│ decide (basis) ──────────▶ │ IDs, acceptance obligations    │
 │               │ writes acceptance tests                                     │
 │               │ check --stage baseline ──▶ │ expected red/green on baseline │
 │               │ implements (host diagnostics between attempts)              │
 │               │ check --touched … ───────▶ │ receipts, locks, attempts;     │
 │               │                            │ review manifest file;          │
 │               │                            │ delegation reserved ───────────┼▶ review
 │               │ findings ────────────────▶ │◀──────── ReviewResult ─────────│
 │               │ (fixes → check → recheck)                                   │
 │               │ finish ──────────────────▶ │ commit, verdict, or            │
 │               │                            │ "continue required"            │
 │◀ result ──────│ (rendered from kernel JSON); integration offer              │
```

About 6 kernel calls (`open`, `decide`, two `check` calls, `findings`, `finish`). A clear request already authorizes routine local steps (WRK-02), so `open` records that grant itself; `decide` is needed only for genuinely new decisions. When the request states unambiguous examples, the basis is recorded without asking again (INT-04). The coordinator mirrors `next` into the host's todo list when it changes. Analysts are dispatched only when a question remains after the coordinator's own search (5.2).

#### 2.4.2 Quick bug fix

`open bug` → localize (host search and usages) → reproduction test → `check --stage baseline` (expect red) → repair → `check` → focused review pass → `finish`. If inspection finds a High risk dimension, the kernel raises the lane (Section 8.2).

#### 2.4.3 Review only

`review` is one stateless call. It returns the review manifest, the rubric and a finding scaffold, and writes nothing in the project: no `.tenet/`, no trace, no Git objects (CON-09). It runs no project tools; if the user wants checks, the coordinator offers an `investigate` contract, which runs them with normal state. "Fix findings 2 and 4" uses the Reviewer's handoff button, which carries the review context into `open fix` with the manifest hash and the chosen finding numbers (RES-06).

#### 2.4.4 Resume after an abrupt stop

`open --resume`:
- reconciles any effect that has an intent record but no result (Section 7.4);
- stops orphaned processes it owns;
- compares the current inventory with the last receipts;
- returns `next: [reconcile…, revalidate…]` before any new work.

One question is asked only if another contract owns the workspace, the source changed in a way the kernel cannot explain, or the previous generation did not leave the work parked, finished or waiting for an answer (an earlier chat may still be editing) (Section 7.3).

#### 2.4.5 Multi-increment request

`open plan` → the coordinator drafts plan items (it may use the host's Plan agent for research) → `decide` records the edited plan → each item later opens its own contract (`open feature --plan-item PLN-…`). `inspect status` renders durable progress; the host's todo list shows the current item. Planning acquires no source ownership.

#### 2.4.6 Prototype without Git

`open prototype` creates a shadow Git snapshot in `.tenet/git` → edits → `check` (each check also snapshots) → `finish` (endpoint `prototype`). `undo` restores a file only where its content still equals Tenet's last snapshot of it (Section 10.9). No verb has to be called before edits.

#### 2.4.7 Without Node.js

If `node` is missing or unsupported, the kernel cannot run. Skills still give **findings-only review**, labeled "advisory: kernel unavailable", with no `.tenet/`, verdict or evidence claims, and explain how to install Node for implementation work (INS-11).

### 2.5 Processes

| Process | Started by | Lifetime | Notes |
|---|---|---|---|
| VS Code and Copilot Chat | User | Session | A Local session stops when its window closes |
| Kernel, command line | Agent through the terminal tool | One call (milliseconds; check calls up to obligation timeouts) | Inherits the terminal environment; check processes get a reduced one (9.3) |
| Kernel, MCP (if selected) | Host, from `mcp.json` | Chat session; idle between calls | Same verbs; keeps only a droppable cache between calls |
| Kernel, hook (once SP-03 qualifies observation) | Host, on a hook event | Milliseconds (`hook.mjs`, a few KB) | Appends one observation line; never takes the transaction lock; never creates `.tenet/` (4.7) |
| Check processes | Kernel runner | Bounded by obligation timeout | Own process group, recorded before launch (9.3) |
| App servers for end-to-end checks | Playwright's `webServer`, under the runner | The check run | Never Tenet-owned beyond the run |
| Local dev server for the user (RES-08) | Agent through a host terminal or task | Until the user stops it | Not a kernel process |

---

## 3. Source repository, build and dependencies

### 3.1 Repository layout

```text
tenet/
├─ specs/                     PRD.md · tech-spec.md · ux-spec.md (later)
├─ packages/kernel/
│  ├─ src/core/               pure rules (no I/O)
│  ├─ src/pipeline.ts         the one verb pipeline (6.1)
│  ├─ src/verbs/              one module per verb
│  ├─ src/decisions/          one module per decision kind (6.5)
│  ├─ src/ports/              Store · Git · Runner · Host · Clock · Random
│  ├─ src/adapters/           store-fs · git-cli · runner · node-ts · host-vscode
│  ├─ src/frontends/          cli.ts · mcp.ts · hook.ts (each thin)
│  └─ test/                   unit · property · real-process · real-filesystem · Git fixtures
├─ packages/fixtures/         builders for repositories, dirty trees, hostile inputs
├─ plugin/                    the published payload
│  ├─ plugin.json · README.md · NOTICE · SHA256SUMS
│  ├─ skills/                 tenet · tenet-intake · tenet-build · tenet-review · tenet-starter-ts-web-api
│  ├─ com.github.copilot/agents/   tenet.agent.md · tenet-reviewer.agent.md · tenet-analyst.agent.md
│  ├─ com.github.copilot/commands/ tenet.md · tenet-review.md
│  ├─ kernel/tenet.mjs        the kernel bundle (command line; --mcp)
│  ├─ kernel/hook.mjs         the hook entry, a few KB with no dependencies (4.7)
│  ├─ descriptors/vscode-local.json
│  ├─ mcp.json                only if SP-12 selects MCP (4.5)
│  └─ hooks/hooks.json        only once SP-03 qualifies observation (4.7)
├─ eval/                      golden tasks, graders, recorded replays
├─ tools/                     build · lint-skills · release-audit · coverage · matrix
└─ .github/workflows/         untrusted · live · release (Section 17.6)
```

### 3.2 Build

| Concern | Choice | Why this and not something smaller or larger |
|---|---|---|
| Language | TypeScript, strict; `tsc --noEmit` in CI, separate from bundling | One language for kernel, adapters, tests and tools; a successful bundle is not a successful type check |
| Runtime | The project's Node: 22.12 or later 22.x, or 24.x (exact minimum patches pinned at approval), the same LTS lines as the brownfield support matrix (PRD Section 2.3) | Every R1 project already needs Node (INS-07); no second runtime |
| Bundle | esbuild to two unminified ESM files: `kernel/tenet.mjs` (command line and MCP) and `kernel/hook.mjs` (hook entry, no dependencies) | One build and one source tree; the hook entry stays tiny because it runs on every edit |
| Startup | `module.enableCompileCache()` with the cache in OS temp; flags parsed with `node:util` `parseArgs` | Keeps the 1-second cold budget without a CLI library |
| Tests | `node:test` with `fast-check` (development only) | No test framework shipped |
| Reproducibility | Pinned lockfile; CI rebuilds and compares every payload hash | PRD Section 5.9.2 |

### 3.3 Dependency policy

**No user-installed dependencies** is the product rule (INS-07). **Bundled, reviewed libraries are allowed** when they remove more code and risk than they add (TD-02).

| Library | Use | Condition |
|---|---|---|
| `zod` 4 | Schemas for every verb input, record and output; types; JSON Schema through the built-in `z.toJSONSchema()` for MCP tools and `review-result.schema.json` | Always. Wire schemas use only JSON-compatible constructs (no transforms), so conversion never weakens them |
| `@modelcontextprotocol/sdk` | MCP lifecycle, version negotiation, cancellation, elicitation | Bundled only if SP-12 selects MCP, imported only through its server and stdio entry points so HTTP transports are never bundled |

Each library is pinned, license-checked (both MIT), listed in `NOTICE` and scanned in CI. The bundle budget (600 KB for `tenet.mjs`, 20 KB for `hook.mjs`) is a CI gate measured on every build, not a reason to replace library code with custom code. Kernel dependencies never include starter dependencies: the starter's native SQLite module and browser downloads are never prerequisites for running Tenet.

**Not needed at all:**
- an XML parser, because adapters use JSON reporters (Section 9.5);
- a JavaScript lexer, because locks are whole-file (Section 9.7);
- an import scanner or graph library, because the host's language services answer reference questions (Section 8.7);
- a tokenizer, because the byte estimate is calibrated in SP-02 (TQ-13);
- a model client or the Copilot SDK, because the kernel never calls a model (T3);
- a database, because the state is one JSON document (TD-04).

---

## 4. Host binding (VS Code, Local harness)

### 4.1 Manifest and packaging

`plugin.json` follows the Agent Plugins 1.0 layout: `$schema` and `name` are required, and `version` is bumped on every release so updates are picked up. `license` and the repository identity are **provisional** until Q-03 and Q-13 are decided. Skills sit in `skills/`; agents and commands sit under `com.github.copilot/`. The README states the host setting that enables plugins, the publisher and verification steps, the support matrix, and that Git-installed plugins can be uninstalled but not disabled. [SPIKE: SP-01] picks the install path (TQ-11).

### 4.2 Agents

| Agent | Role | Tool scope | Notes |
|---|---|---|---|
| `tenet` | Coordinator | A fixed, minimal list: edit, read (including `problems`), search (including `usages` and `changes`), execute (terminal, tasks, `testFailure`), `todos`, `askQuestions`, and subagent dispatch restricted to the two agents below; the Tenet MCP tools if selected. The browser toolset is added only if golden tasks show it pays for its schema tokens | Its body holds the core loop (5.2), so the loop survives context compaction; skills hold the detail |
| `tenet-reviewer` | Fresh-context Reviewer | Read and search (including `usages` and `changes`); the `tenet_findings` tool if MCP is selected | `user-invocable: false`; loads `tenet-review`; a `handoffs` entry "Fix selected findings" returns to `tenet` |
| `tenet-analyst` | Read-only Researcher, Architect or Security analyst, chosen by its packet | Read and search | `user-invocable: false`; dispatched only when a question remains after the coordinator's own search, and natively for Architect and Security in Deep work (PRD Section 3.9) |

One read-only analyst agent covers three roles because their boundaries are identical; the packet carries the role contract. A role gets its own agent only when golden tasks show the shared instructions misroute. Every tool schema is paid on every request, so the tool lists change only through a release, never mid-session (14.4).

**Host facts relied on** (documented; confirmed by SP-08):
- Local subagents have isolated, stateless contexts and cannot use the questions or todo tools.
- Nested subagents are off by default (`chat.subagents.allowInvocationsFromSubagents`), which makes AGT-06 preventive while that setting stays off; the descriptor records the observed value.
- Custom agents restrict tools and allowed subagents, and `handoffs` carry the conversation into another agent.
- A subagent's model is, in order: a model passed to `runSubagent`; the custom agent's `model`; Auto, if the experimental `chat.subagents.defaultToAuto` is on (default off; not limited to the main model's cost tier); otherwise the main model. An explicit model above the main model's cost tier does not run. Section 4.8 sets Tenet's policy.

**Small work** uses focused same-session passes, never described as separate agents (AGT-09).

### 4.3 Entry points

| Working name | Pinned agent | Kernel call | Writes state? |
|---|---|---|---|
| `/tenet <task>` | `tenet` | `open <profile>` (the coordinator picks `feature`, `bug`, `refactor`, `investigate`, `prototype`, `plan`, `continue`, `fix`, `promote` or `recipe-upgrade`) | Yes |
| `/tenet status`, `why`, `help`, `setup`, `feedback` | `tenet` | `inspect`, `decide` or `export` | Only `setup` (preferences) and `feedback` (to a chosen path) |
| `/tenet-review [scope]` | `tenet` | `review` | No (stateless) |

Each command file names its agent, so Tenet's tool restrictions and subagent allowlist always apply. Only review-only gets its own command, because its zero-write guarantee is worth a visible entry point; everything else is an argument, which keeps the ambient budget small. If another agent loads a Tenet skill, the skill tells the user to use `/tenet` instead. Final names belong to the UX Spec.

### 4.4 Capability descriptor and native capabilities

The descriptor (PRD Section 3.8.2) holds one key per capability, each with a source of `static`, `probe` or `observed`. Core code reads it through the `Host` port and never branches on host names (ENG-02). Each control's mechanism class in `controls[]` is derived from these keys, so a host improvement upgrades the label without code changes.

| Key | R1 value | Source |
|---|---|---|
| `harness` | `local` | Static |
| `subagents` (dispatch, parallel, nested, freshContext, modelRule) | yes, yes, no by default, yes, `inherited` (or `auto` when `chat.subagents.defaultToAuto` is on) | SP-08, then observed |
| `hooks` (observe, prevent) | observe: unknown until SP-03; prevent: unused | SP-03 |
| `approval.mode` | `unknown`; `allow-all (inferred)` in a linked worktree, where the host always uses Allow all (11.4) | Probe |
| `containment` | `none-observed`; a denied kernel write outside the workspace is recorded literally as `outside-write-denied`, not as a named sandbox (11.4) | Probe |
| `questions.native` | `askQuestions` available to the coordinator; answers reach the agent, not the kernel | SP-12 |
| `todos`, `checkpoints`, `usages`, `diagnostics`, `browser` | available to the coordinator | Static, confirmed by SP-08 |
| `memory.host` | loads into sessions (user memory always; repository memory per workspace) | Static |
| `instructionFiles` | which of `AGENTS.md` and `.github/copilot-instructions.md` the host loads | SP-02 |
| `model` (observable, qualification table) | `requested-only`; the shipped qualification table from the last golden run (4.8) | SP-04, release qualification |
| `usage` (regime, visibility) | regime `unknown` (AI credits for most plans; legacy premium requests for some annual plans); visibility to plugins `none`; native views: the Copilot usage dashboard, `chat.subagents.showCreditUsage`, GitHub usage reports and budgets | SP-05 |
| `storage` (userDir, pluginData, osTemp) | writability per front-end | Probe |
| `exclusions.honored` | unknown | SP-02 |
| `mcp.elicitation`, `mcp.roots` | unknown | SP-12 |

**Native ownership and retirement.** Each row is a mechanism the host could own. "Fallback" is all Tenet builds; it is deleted when the retirement condition is met (PRD Section 15).

| Concern | Host owns | Tenet adds | Fallback until then | Retire the fallback when |
|---|---|---|---|---|
| Code search, references, routes, entry points (PRD Section 3.8.7) | `search`, `usages`, `codebase` | Changed exported symbols and linked acceptance tests in the manifest; inspected and uncovered lists in coverage (8.7) | Textual search by symbol name (also native) | — (already native) |
| Diagnostics during implementation | `problems`, `testFailure` | Nothing; kernel checks are the evidence | — | — |
| Questions | `askQuestions` | Question content, recommendation and binding (6.6) | Chat text | The answer reaches the kernel directly; then authority questions may use it too |
| Progress display | `todos` | `next` and plan items to mirror | `inspect status` | — |
| Progress cadence (PRD Section 3.6) | — | `progress` field (6.6) | Skill rule | — |
| Agent edit recovery within a chat | Edit checkpoints | Git commits at boundaries (10.3); shadow snapshots without Git (10.9) | — | A checkpoint ID is observable and survives the chat |
| Exploration and demo screenshots | Browser tools | Confirmed journeys and claim limits (9.10) | Playwright screenshots in the run directory | — |
| Draft planning | Plan agent | Accepted plan items as records (7.8) | — | — |
| Memory | Host memory | Nothing; host memory is untrusted context (5.2) | Tenet lessons (8.9) | Host memory offers per-item provenance, scope and previewed forgetting (LRN-02) |
| Containment | Host sandbox (not on Local) | Accurate labels (11.4) | Reduced environment (9.3) | A host sandbox applies to the Local harness and is observable |
| Model routing | Auto with its Efficiency, Balance and Intelligence preferences; agent `model` lists | Policy and qualification labels (4.8) | Inherit the active model | — (already native) |
| Usage and credits | Usage dashboard, subagent credit display, usage reports, budgets | Tenet-attributable counters and estimates (8.6) | `usage: unknown` | The host exposes session usage to plugins; then report it with source and freshness (RSC-07) |
| Prompt caching | Provider caches | Stable tool lists, instructions and models within a session (14.4) | — | — |
| Approval mode | Approval levels | SEC-13 question (11.4) | Mode `unknown` | The host exposes the active level |
| Edit attribution | — | File-level attribution (10.2) | Declared touched set | Observer hooks qualify (4.7), or the host records edit provenance |
| Review dispatch identity | Subagent rendering | `dispatchMode` (5.4) | Reported | Observer hooks or host dispatch metadata qualify |
| Check execution receipts | Terminal and test integrations | Evidence eligibility and candidate binding | Kernel runner (9.3) | A host test or terminal tool returns argv, cwd, exit, population and a run-bound report |

### 4.5 Kernel front-ends

**Command line** (default unless SP-12 selects MCP):

```text
env -u NODE_OPTIONS node "<plugin>/kernel/tenet.mjs" <verb> [--flag value …] [--stdin]  <<'TENET_INPUT'
{ …JSON body for larger inputs… }
TENET_INPUT
```

- **Input:** flags carry short scalar inputs (including answers, `--answer q2=1`), so the host's approval preview shows what the call does and the agent writes few output tokens. Larger bodies (a proposed basis or plan) arrive as JSON on stdin through a quoted heredoc. A quoted heredoc never interpolates, and the delimiter `TENET_INPUT` is rejected if it appears inside the body. Bodies are limited to 256 KB. [SPIKE: SP-12] confirms the terminal tool passes heredocs intact and that auto-approve rules can match them. *Fallback:* the body goes to a file the kernel itself creates in OS temp through a preceding `inspect --new-input` call.
- **Launch environment:** the command clears `NODE_OPTIONS` before Node starts, because a preloaded module would run before any kernel code. The kernel still reports `preload-present` (exit 4) if a preload flag reaches it by another launch path; that check detects accidents and cannot prevent a deliberate preload (PRD Section 5.5).
- **Locating the kernel:** the `tenet` agent runs the kernel by its path relative to the skill folder. The kernel verifies its location and the payload hashes at start. **The kernel never runs from the workspace.** If SP-01 shows skill-relative paths fail, setup installs a pinned copy in the user configuration directory (`<userDir>/kernel/<version>/tenet.mjs`), verified against the hash written in the skill text (TQ-01).
- **Workspace:** `git rev-parse --show-toplevel` from the current directory, or the current directory for non-Git folders.

**MCP** (`node tenet.mjs --mcp`, declared in `mcp.json` only when selected):
- built on the bundled official SDK, so lifecycle, version negotiation, cancellation and message limits follow the specification without custom code; application-level permissions, input bounds and cleanup are still Tenet's and are tested;
- **three tools, not one per verb,** because every schema is paid on every request (14.4): `tenet_read` (`review`, `inspect`, `packet handoff`, `packet resume`; annotated `readOnlyHint`), `tenet` (every other verb, selected by a `verb` field; never annotated read-only) and `tenet_findings` (for the Reviewer only);
- `mcp.json` clears `NODE_OPTIONS` in the server environment, and uses `${PLUGIN_DATA}` as the user directory where the host provides it;
- the workspace comes from MCP roots; without roots, mutating calls are refused until the user confirms the workspace once, which is recorded with a workspace ID;
- the Reviewer gets only `tenet_findings`, so its result reaches the kernel without the coordinator retyping it;
- user decisions use elicitation when the client supports it and the kernel receives the answer;
- time spent waiting for the user never counts toward the 5-second bookkeeping budget;
- cancellation stops owned processes (9.3) and records uncertain effects (7.4).

**Selection (SP-12):**
1. **Safety gate.** Each candidate front-end must show, on the tuple: the kernel's and its children's effective containment; access to the workspace, user directory and OS temp; network behavior; cancellation and disconnect behavior; and behavior when policy denies the server. A front-end that fails the gate is not eligible.
2. **Measurement.** Run 3 representative golden tasks (feature, bug, review-then-fix), 5 times each, through each eligible front-end. Report the distribution of Tenet-caused approval prompts per Standard task, plus: tokens and credits per task, the tool-schema tokens each front-end adds to every request, review results retyped by the coordinator, malformed calls, elapsed time, and approval-preview legibility rated in formative sessions.
3. **Rule (PRD Section 5.7.1).** MCP ships if the command line's 90th percentile exceeds 3 prompts, or if MCP uses at least 15% fewer AI credits per Standard task (median) with no safety difference. Otherwise the command line ships, unless the owner, shown the retyping and legibility measurements, chooses MCP.

Only the selected front-end ships to users. The command-line front-end stays in the repository as the test harness for the deterministic tier and for CI, because it is the same pipeline minus about 100 lines of protocol code.

### 4.6 Approval friction

- **Coarse verbs:** about 6 calls per Standard task (2.4.1).
- **Readable, compact command lines** for flag-only verbs.
- **A per-verb approval snippet.** Setup shows, and never writes, a terminal auto-approve rule that approves low-risk verbs and leaves consequential verbs to the host's own approval. Setup fills in the **exact absolute path** of the installed kernel, so a workspace file that happens to be named `kernel/tenet.mjs` can never match:

```json
"chat.tools.terminal.autoApprove": {
  "/^env -u NODE_OPTIONS node \"<exact plugin path>/kernel/tenet\\.mjs\" (open|review|inspect|packet|check|findings|stop)\\b/": true,
  "/^env -u NODE_OPTIONS node \"<exact plugin path>/kernel/tenet\\.mjs\" (decide|commit|finish|integrate|undo|publish|export)\\b/": false
}
```

  In Manual mode the host then asks before every decision, commit, integration, undo and remote action. This is a host-enforced gate rather than an advisory chat question. A typical Standard task still needs about 3 approvals (one or two `decide` calls and `finish`). With MCP, the equivalent is approving `tenet_read` for the session.
- **Consent remembered:** hook, filter and envelope consent is remembered per project and per configuration hash (Section 7.2), so it is never asked again until the configuration changes.
- **Grouped questions:** the kernel returns all decisions due at one boundary as one grouped `questions[]` (6.6).

### 4.7 Hooks

**No prevention hooks in R1** (TD-14). PreToolUse denial is unqualified, and the Local parser ignores matchers.

**Observer hooks (Beta; PRD Section 5.7.1, shipped once SP-03 qualifies the observations).** Several of R1's largest disclosed residuals are observation problems, not prevention problems. Hooks scoped to the `tenet` agent run only while that agent is active, and they only record:

| Event | Observation | Control upgraded |
|---|---|---|
| `PostToolUse` on edit tools | Edited paths and session ID | Attribution of agent-tool edits becomes observed: a changed file the hook never saw is a possible human edit (10.2) |
| `SubagentStart`, `SubagentStop` | Which agent ran, its model if the payload carries it, and when; the result, if the payload carries it | Review independence becomes observed (REV-06); if the result is carried, `findings --from-observed` records it, so nobody retypes it |
| `Stop` | The turn ended; whether a `finish` preceded it | The next response reports `ended-without-finish`. Hooks never force a turn to continue: that would be prevention, which waits for SP-03 |
| `SessionStart` | The session began | Adds the `inspect status` summary as context (CON-03), and marks the session's observations as complete-able |

**Mechanics:**
- `kernel/hook.mjs` (a few KB, no dependencies) reads the hook payload from stdin, filters it in the script (matchers are ignored), and appends one JSON line to `.tenet/observed`. It never takes the transaction lock and **never creates `.tenet/`**: if the directory does not exist (for example during stateless review, CON-09), it writes nothing.
- The next kernel call merges the lines: it renames `.tenet/observed` to `.tenet/observed.merging`, reads it and deletes it, so a hook appending meanwhile writes to a fresh file and no line is lost.
- **Completeness:** observations for a session count only if that session's `SessionStart` line exists and every edit the coordinator declared has a matching `PostToolUse` line. Otherwise the session's controls keep their cooperative labels. A hook that stops reporting therefore downgrades labels instead of silently upgrading them.
- An observed edit to a path does not prove every change to that path was the agent's; the last-check rule still applies (10.2). Terminal-made edits are not observed by edit hooks and stay cooperative.

The README discloses the hooks and what they record. Plugins with hooks run code on the user's machine, so the hooks file ships only after SP-03 qualifies the observations.

### 4.8 Models

The PRD constrains model choice: use the active model without asking the user to switch per phase, with one qualified exception for the researcher role (RSC-01); record requested and observed models (RSC-02); label models from golden results and warn before Deep work (RSC-08); and leave ranked portfolios for later (RSC-06). The host already routes models well, so Tenet builds **no router and names no models in agent files**.

| Role | Policy | Why |
|---|---|---|
| Coordinator | The user's choice, including Auto and its Optimize-for preference | RSC-01; changing models mid-session also discards the cache (14.4) |
| Reviewer | Inherits the main model: no `model` in its agent file and none passed at dispatch | Review recall is a release metric; a cheaper Reviewer must first show parity on the golden suite |
| Analyst, researcher role | The economy model the qualification table names for research, once release qualification shows it meets the researcher thresholds; otherwise inherits (RSC-01) | GitHub recommends cheaper models for subagents; research is read-only and its findings are reconciled against evidence (AGT-11) |
| Analyst, Architect and Security roles (Deep) | Inherit the main model | Consequential judgment |

**Rules:**
- **The researcher model is data, not configuration.** The qualification table (below) may name an economy model for research. `packet analyst` with the researcher role then returns it, and the coordinator passes it to `runSubagent`; that is the only explicit model the coordinator ever passes. An economy model is never above the main model's cost tier, so the host's tier check never blocks it. The result discloses it once ("research ran on <model>"), and the user can decline it in words for the task, which the contract records.
- The coordinator never changes reasoning effort.
- If the user has enabled `chat.subagents.defaultToAuto`, subagents without an explicit model follow Auto, which may be more or less expensive than the main model. Tenet records `requested: auto (host setting)` and says so once.
- **Qualification table.** Release qualification ships `{ model or configuration → qualified | unqualified | not-evaluated; researcherEconomy?: model; evaluatedAt }` in the descriptor, refreshed with the monthly T3 run. Auto is qualified as a **configuration** (its observed model mix on the golden suite), not as every model it might pick.
- **Recording.** `open` and `findings` accept the requested model the coordinator reports (`--model`); a hook payload may supply the resolved model. Each assignment records `requested`, `resolved` (or `unknown`), `source` and the qualification label. Unknown stays unknown.
- **Deep warning (RSC-08).** When the lane becomes Deep and the active model or configuration is unqualified or unknown, the kernel returns one `model-unqualified-for-deep` question: continue or stop. There is no model menu; the user may change the model themselves before continuing.

---

## 5. Practice layer (skills)

### 5.1 Skills

Five skills. Narrower guidance lives in resource files that load only when referenced, so descriptions stay within the 2,000-token always-loaded budget (ENG-03). The core loop lives in the `tenet` agent body (4.2, at most 1,000 tokens because it is paid on every turn); skills hold everything that loads on demand and never repeat the loop.

| Skill | Loaded by | Covers | Resources (loaded on demand) | Body budget |
|---|---|---|---|---|
| `tenet` | Coordinator | Routing, kernel protocol, rendering, steering, Git narration, continuity, configuration and setup | `git.md`, `continuity.md`, `config.md`, `setup.md`, `traits/*.md`, `guided.md`, `concise.md`, `focused-review.md` | 4,000 |
| `tenet-intake` | Coordinator, Standard and Deep only | Clarification, typed questions, acceptance basis (examples, invariants, boundary and negative cases), plan decomposition, decisions | `plan.md`, `decisions.md` | 4,000 |
| `tenet-build` | Coordinator | Test-first implementation, scaffolding, characterization, refactoring, documentation upkeep | `docs.md`, `promote.md` | 4,000 |
| `tenet-review` | Reviewer and Analyst only | Two-stage review rubric, severity, coverage, analyst role contracts, security and threat-note passes | `security.md`, `threat-note.md`, `architect.md` | 4,500 |
| `tenet-starter-ts-web-api` | Coordinator, starter work only | Starter recipe: scaffold, conventions, template | `template/`, `recipe.json`, `asvs.json`, `journeys.json`, `workload.json` | 2,000 |

- **One phase skill at a time:** the coordinator loads intake, build or the starter skill for the phase it is in, not all of them. The coordinator never loads `tenet-review`; its own focused passes use `focused-review.md` (at most 400 tokens). Lint enforces a ceiling of 12,000 Tenet tokens loaded across a Standard golden task.
- **Style** (PRD Section 3.6): `guided.md` adds explanations, `concise.md` shortens rendering, and Balanced needs no resource. Style never changes rigor.
- A skill is split further only when routing evidence from golden tasks shows the coordinator loading the wrong guidance.

### 5.2 Coordinator loop

```text
1. Route the request to a profile.
2. r = open(profile, request)                         (K: readiness, ownership, floors, routine grant)
3. State the assistance level and lane once. Before Deep work, show the budget preview (8.6).
4. Loop:
     • If the user said something new since the last call, handle it first:
       pause, cancel, undo, refine or presentation change → stop or decide; never continue blindly.
     • Mirror r.next into the host todo list when it changed.
     • Choose an action that r.next permits (the most efficient one, not necessarily the first):
         basis/plan/decision → tenet-intake → ask r.questions → decide                  (K)
         research            → own search first; tenet-analyst (with the packet's model, if any) only if a question remains (K)
         tests/implementation → tenet-build → native edits; host diagnostics between attempts
         check               → check (stage, touched)                                    (K)
         review              → tenet-reviewer with the manifest path → findings          (K)
         checkpoint          → commit                                                    (K)
         finish              → finish; if it returns continue-required, keep going       (K)
     • Exit codes: 3 → ask exactly r.questions; 2 → explain and offer r.next; 4 → stop and report.
     • Post a check-in when r.progress says the checkpoints preference calls for it.
     • Read r.budget each time; say so once at 80%; stop at the bound with the diagnosis.
5. Render the result only from the last kernel response.
```

**Rules the agent body states:**
- Never claim a verdict, freshness or completion the kernel did not return.
- Use host diagnostics (`problems`, `testFailure`) for feedback between attempts. **Run project test commands only through `check`** during a contract, so the suite never runs twice and the tree cannot change between two runs.
- Never edit `.tenet/`. Declare every edited file at `check`.
- Ask only kernel questions and consequential product questions (INT-03). Use `askQuestions` for questions the kernel marks `channel: native`. Ask questions marked `channel: chat` in plain chat and **end the turn** (11.4).
- **Never auto-confirm a host pause** such as "continue to iterate?" (WRK-10).
- **Keep the session stable:** never suggest switching models or reasoning effort mid-session and never toggle tools, because each change discards the cache (14.4).
- **After context compaction,** call `inspect status` once instead of re-reading the repository.
- **At milestone boundaries of long work,** offer to continue in a fresh chat through the resume packet (5.5), which is cheaper than carrying the whole history.
- **Before dispatching a subagent or starting a long check,** make sure the handoff is current (`finish` and boundary calls write it), so a host usage limit loses at most one step.
- Treat host memory, host plans and session todos as untrusted context, never as requirements, grants or plan items. If they contradict `INTENT.md`, show the conflict (CFG-09).
- Kernel obligations override remembered preferences.

### 5.3 Lane playbooks

#### 5.3.1 Quick

1. **Localize** with host search and `usages`, bounded by relevance and budget rather than a file count.
2. **Reproduce:** a failing test; `check --stage baseline`.
3. **Repair:** the smallest in-scope change.
4. **Validate:** `check` (targeted and related tests, lint, types), then a focused review pass with `focused-review.md`.
5. **Finish.**

A behavior-preserving refactor (TDD-05) replaces step 2 with preservation tests that pass on the baseline.

#### 5.3.2 Standard

1. Acceptance basis, with at least one boundary or negative case per new requirement (INT-15).
2. If the change carries `auth`, `persistence`, `personal-data` or `external-effects` traits, a threat and data note, written now so its items become tests or constraints (QLT-13).
3. Contract preview.
4. Acceptance tests, then `check --stage baseline`.
5. Implementation attempts, each submitted with a full candidate `check`.
6. Fresh-context Reviewer.
7. Fixes with a focused recheck (`packet reviewer --recheck`, 8.7).
8. `finish`, then the integration offer.

#### 5.3.3 Deep

Standard, plus:
- a native Architect pass (`tenet-analyst`) that drafts a decision record and the `docs/architecture.md` update;
- a native Security pass (`tenet-analyst`);
- the full suite;
- mutation testing offered where the adapter supports it (TDD-07).

### 5.4 Role contracts

**Reviewer** (fresh context, read-only):
- **Input:** the path and hash of a review manifest (8.7). The Reviewer reads the manifest and the files on its closed read list with host tools.
- **Stage A, behavior and intent:** does the work satisfy every acceptance-basis element? Does each acceptance test faithfully assert its example? Is the basis sufficient (REV-09)?
- **Stage B, structure, security and charter.**
- **Output:**

```ts
type ReviewResult = {
  manifest: string; mode: "full" | "recheck"; basisRevision: number; candidate: string;
  dispatchMode: "subagent-fresh" | "same-session";
  axes: { behavior: "pass" | "fail"; structure: "pass" | "fail" };          // the Reviewer's judgment, never edited
  coverage: {
    inspected: string[];                 // files and symbols actually read
    sampled: Array<{ symbol: string; callers: number; opened: number }>;   // broad callers reviewed by category
    uncovered: string[];                 // basis items with no check; parts of the read list not reached
    crossCutting: string;                // one statement on interactions across modules
  };
  findings: Array<{ severity: "blocker" | "major" | "minor" | "note"; axis: "behavior" | "structure";
    location: { path: string; line?: number }; claim: string; evidence: string; fix?: string }>;
  basisGaps: Array<{ kind: "missing-requirement" | "missing-invariant" | "weak-test"; detail: string }>;
};
```

Findings carry evidence and locations, not a narrative of every search.

**Analyst** (read-only): takes a role (researcher, architect or security), a question and a revision; returns findings with file and line references and the revision observed. The coordinator reconciles findings against the current revision (AGT-11). An Architect returns a decision-record draft, which the coordinator writes.

### 5.5 Manifests and handoffs

Roles exchange kernel-built packets, never summaries of each other's chats:
- `reviewer` (the review manifest, full or recheck, 8.7);
- `analyst` (role, question, revision, relevant basis);
- `handoff` (contract, state, receipts, open findings, next actions, budget);
- `resume` (handoff plus reconciliation).

**Transport:** reviewer and analyst packets are written to a file in the run directory, and the response returns only the path, the hash and a three-line summary, so neither the coordinator's context nor its output carries the packet. The coordinator dispatches with "read the manifest at `<path>` (hash `<hash>`)". [SPIKE: SP-08] confirms subagents can read that path (TQ-21). *Fallback:* the packet is returned inline, under its own 20,000-token cap (6.6).

Packets are rebuilt on demand and not kept beyond their run directory, so forgetting or redaction never leaves stale copies. The handoff holds only facts the harness cannot guarantee: branch, candidate, decisions, outstanding obligations, findings, effects and counters. Conversation history stays with the host.

### 5.6 Skill standards

- **Content:** imperative and short. Each instruction names the kernel verb and what to do on each exit code. Requirement IDs appear in comments for maintainers.
- **Lint** (`tools/lint-skills`): token budgets, broken links, unknown verbs, phrases that claim enforcement the mechanism class does not support, and secrets.
- **Change control:** every skill change runs the deterministic tier and needs a live smoke run before release (17.6).
- **Skeletons:** the `tenet` agent body and the `tenet-review` skill are drafted in Appendix F, so the spikes test real text.

---

## 6. Kernel

### 6.1 Principles and the verb pipeline

1. **Pure core.** `src/core/` holds total functions over typed values. Clock and randomness come through ports, so every rule is property-testable and replayable.
2. **Ports only where there are side effects:** Store, Git, Runner, Host, Clock, Random. No interface exists for pure logic.
3. **Self-contained.** The kernel makes no model calls, opens no Tenet network connections, runs no background work, and never imports or evaluates repository code (PRD Section 5.7). Lint bans `vm`, `worker_threads`, dynamic `import()` of computed paths, and client sockets except the local port probe. Project tools the kernel runs may use the network; that is declared per check (9.3).
4. **Compact, typed, actionable output** (6.6).
5. **Fail closed on integrity.** A revision conflict, stale generation, unknown authority field or malformed restriction stops the operation, and internal errors never yield a success-shaped response. A response always says which effects completed, which are uncertain and how to recover (7.4).

**One pipeline for every verb** (`src/pipeline.ts`, about 150 lines). Lock handling, recovery, envelope checks, the effect protocol, publication and logging exist once:

```text
runVerb(verb, rawInput, frontEnd):
  input = verb.schema.parse(rawInput)                       # zod; size and depth limits
  class = verb.class(input)                                 # decided before any storage is opened (6.3)
  if class == stateless: return render(verb.run(ports, input))
  state = store.read()                                      # read-only and mutating
  if class == read-only: return render(verb.run(ports, state, input))
  with store.transaction() as tx:                           # lock (7.3)
    tx.mergeObserved(); tx.recover()                        # hook lines (4.7); uncertain effects (7.4)
    checkEnvelope(tx.state, input)                          # 6.4
    plan = verb.run(ports, tx.state, input)                 # pure: next state, effects, response
    for e in plan.effects: effects.perform(tx, e)           # intent → act → result (7.4)
    tx.publish(plan.state)
  log.call(...); return render(plan.response)
```

Verb modules contain only their own logic. A front-end is a translation from its transport to `runVerb`, so front-ends cannot diverge.

### 6.2 Module map

| Module | Responsibility | PRD |
|---|---|---|
| `core/schemas` | zod schemas: inputs, records, outputs; limits | CON-04, SEC-06 |
| `core/lifecycle` | Work, plan item, requirement, example, test, finding and effect state machines | WRK-07 |
| `core/risk` | Change-based risk to lane floor | WRK-04 |
| `core/authority` | Grants, scope, amendment, decision binding | WRK-02, WRK-03 |
| `core/budget` | Counters, reservations, warnings, stops, repeated-failure signatures | WRK-08, WRK-09 |
| `core/verdict` | PRD Section 4.5.2 decision table: endpoint, scope, reasons | RES-02, AC-27 |
| `core/findings` | Severity and disposition rules | REV-04 |
| `core/obligations` | Check obligations, kinds, applicability, trait composition, acceptance obligations | QLT-06, INT-05 |
| `core/config` | Resolution, composition, restriction-only revisions, trust comparison | CFG, SEC-12 |
| `core/attribution` | File-level attribution from snapshot, declarations, observations and hashes | GIT-03, GIT-10 |
| `core/ids` | ID formats, allocation, ancestry-aware reconciliation | INT-10, GIT-09 |
| `core/manifests` | Review, analyst, handoff and resume packets; token estimate | AGT-04, REV-08 |
| `core/retention` | Admission and eviction plans | CON-08 |
| `pipeline` | The verb pipeline (6.1) | — |
| `verbs/*` | One module per verb | — |
| `decisions/*` | One module per decision kind (6.5) | INT-07 |
| `adapters/store-fs` | State document, lock, log, observations, blobs, marker | Section 7 |
| `adapters/git-cli` | Git with argument arrays and temporary indexes; the shadow repository for non-Git folders | Section 10 |
| `adapters/runner` | Envelopes, environment, process groups, run directories, ports | Section 9.3 |
| `adapters/node-ts` | Detection, invocation and normalization for Node/TypeScript | Section 9.5 |
| `adapters/host-vscode` | Descriptor, user directory, plugin paths | Section 4.4 |

### 6.3 Operation classes

Each verb call has one class, decided **before** any storage is opened:

| Class | Calls | May write | Behavior |
|---|---|---|---|
| Stateless | `review`; `inspect doctor` before setup | Nothing in the project, including Git objects and traces | No lock, no recovery, no trace; output only |
| Read-only | `inspect` (`status`, `why`, `impact`, `residue`); `packet handoff` and `packet resume` | Nothing | Reads the current state document; reports any needed repair instead of performing it |
| Mutating | All others, including `packet reviewer` and `packet analyst` (they reserve a delegation, 8.6) | `.tenet/`; workspace and Git effects per verb | The full pipeline (6.1) |

`export` reads state and writes only to a path the user chose; it takes no lock and is never annotated read-only.

**Ownership by profile:** `plan`, `investigate` and review-only work never acquire source ownership, because they do not edit source. Only implementation profiles take ownership (7.3).

### 6.4 Mutation envelope and idempotency

Every mutating call except the first `open` carries:

```ts
type MutationEnvelope = {
  request: number;            // increments per call within a generation; a repeat returns the stored response
  generation?: number;        // ownership generation returned by open; stale → refused
  workspaceId?: string;       // defaults to .tenet/marker; if given, must match it
  work?: string;              // defaults to the owned contract; required only when several are active
  expectedRevision?: number;  // optional optimistic check on the state document
};
```

- **Bootstrap:** the first `open` in a workspace needs no envelope; it creates the marker and returns `workspaceId` and `generation`.
- **Few tokens:** defaults keep the envelope to two short flags on most calls (`--req 7 --gen 3`), which also removes copy errors in long IDs.
- **Idempotency (bounded and explicit):** the last 64 responses are kept with an input hash, and the highest request number per generation is recorded. A repeat with the same input returns the stored response and never creates a second contract, consumes another attempt or repeats an effect. A repeat with different input fails with `request-mismatch` (exit 1). A number at or below the highest seen but no longer cached fails with `request-expired` (exit 1), so an old request can never run again as if it were new.
- **Generations:** each `open --resume` returns a new generation. Calls carrying an older generation fail with `stale-session` and write nothing, so a stale chat cannot overwrite newer records. Generations fence kernel calls, not native edits; edits from an older chat surface as unexplained changes (10.2).

### 6.5 Verbs

Class M is mutating, R read-only, S stateless; C marks verbs that may run checks (obligation timeouts apply instead of the bookkeeping budget).

| Verb | Class | Purpose |
|---|---|---|
| `open <profile>` | M | Create or resume a contract: readiness, assistance level, floors, dirty-tree inventory, routine grant from the request, reconciliation, ownership, generation; a shadow snapshot for non-Git prototypes |
| `review` | S | Review-only manifest, rubric and finding scaffold |
| `decide` | M | Record user decisions and content proposals (below) |
| `check [--stage baseline\|candidate\|integrated] [--targeted] [--touched …]` | M, C | Inventory, obligation runs, receipt validation, counters, automatic locking of verified acceptance tests; writes the review manifest when review is the next action (8.7) |
| `packet <role> [--recheck <findings>]` | M or R | Reviewer (full or recheck) or analyst packet, written to the run directory (reserves a delegation); handoff or resume packet (read-only) |
| `findings [--from-observed]` | M | Record a `ReviewResult` or analyst result (directly, or from a hook observation, 4.7); finding transitions; settle the delegation |
| `commit` | M, C | A checkpoint commit mid-contract (10.3) |
| `finish` | M, C | Final commit if needed (10.3), verdict, handoff, integration offer; refuses while policy requires more work |
| `integrate` | M, C | Local integration through normal Git operations; revalidation |
| `undo` | M, C | Inverse plan, preview, apply through the commit protocol, revalidation |
| `publish <push\|pr>` | M | Remote effects on explicit request only (GIT-05) |
| `stop <pause\|cancel\|abandon>` | M | Pause (release ownership at a safe boundary), cancel (stop owned processes), abandon (close the contract); allowed while a check runs |
| `inspect <view>` | R or S | `status`, `why`, `impact`, `doctor`, `residue` |
| `export <feedback\|diagnostics\|evidence>` | Writes outside the project only | Previewed redacted bundle, or JUnit and SARIF export, to a user-chosen path |

`gc` and `migrate` are internal steps of `open` and `finish`, not verbs.

**`decide` has three input forms** over one registry of decision kinds:

| Form | Use | Example |
|---|---|---|
| `{answers: {<questionId>: value}}` | Answer questions the kernel asked; each answer is checked against the pending question and its binding | Dirty-tree choice, consent, risk acceptance, takeover |
| `{propose: kind, content}` | Record content the coordinator drafted with the user | `basis`, `plan`, `decision-record`, `config`, `lesson` |
| `{request: kind, target}` | A user-initiated action; returns a preview question (exit 3), answered with the first form | `forget`, `delete-records`, `cleanup`, `remote`, `acceptance`, `adopt`, `disposition`, `grant`, `dependency` (9.11) |

Each kind is a module in `decisions/` with three functions: `validate(input)`, `preview(state, input) → Question`, and `apply(state, answer) → next state and effects`, registered explicitly in one list. A new decision kind adds a file. Destructive kinds always preview before they apply (CON-10). On the command line, answers are flags (`decide --answer q2=1`); only proposals carry a JSON body.

### 6.6 Response envelope

Responses stay in the conversation and are re-sent with every later request, so routine responses are a small **loop card** and everything else is on demand.

```ts
type KernelResponse<T> = {
  verb: string; exit: 0 | 1 | 2 | 3 | 4 | 5;   // ok · usage · blocked · decision needed · integrity · internal
  revision: number; generation?: number;
  reasons: Array<{ code: string; message: string; refs?: string[] }>;     // Appendix C
  next: Array<{ action: string; why: string }>;                          // at most 3 permitted actions, not a script
  questions?: Question[];                                                // grouped, one boundary
  progress?: { phase: string; boundary?: "phase" | "milestone" };        // drives check-in cadence
  budget: { attempts: string; rounds: string; delegations: string };     // "1/3"; detail via inspect
  effects?: { completed: EffectRef[]; uncertain: EffectRef[]; recovery?: string };   // only when effects ran
  changed?: {                                    // only fields that changed since this generation's previous response
    controls?: Array<{ control: string; mechanism: Mechanism; note?: string }>;   // derived from the descriptor (4.4)
    presentation?: { style: "guided" | "balanced" | "concise"; checkpoints: "minimal" | "milestones" | "each-phase" };
    model?: ModelRecord;                         // 4.8
  };
  data?: T;                                      // verb-specific; references rather than copies
  kernel?: { version: string; payloadHash: string; schemaVersion: 1 };   // on open and inspect doctor only
};

type Question = {          // shaped like the host's askQuestions input
  id: string; header: string; question: string;
  options?: Array<{ label: string; description: string; recommended?: boolean }>;
  multiSelect?: boolean; allowFreeform?: boolean;
  channel: "native" | "chat";             // chat for authority questions (11.4)
  bind: { factsHash: string };            // hash of only the facts this question depends on
};
```

- **Size:** a routine response targets 400 tokens, serialized as minified JSON. Failures list at most 5 tests with references to the bounded report. The cap is 4,000 tokens; the only exception is an inline packet fallback (5.5), capped at 20,000. Detail is reached through `inspect`.
- **Disclosure once, then on change** (RES-07): `controls`, `presentation` and the model record appear on `open` and whenever they change, and `inspect why` shows them in full.
- **Exit 3** returns every decision due at that boundary as one grouped list, and only those that change the next action (INT-03).
- **Binding to facts, not the whole state:** an answer is accepted while the facts behind its question are unchanged, so an unrelated state change never forces reconfirmation, and a relevant file change always does.
- **Check-in cadence** (PRD Section 3.6): with `minimal`, the coordinator speaks only at decisions and at the end; with `milestones`, also when `boundary` is `milestone` (basis accepted, first green, review done); with `each-phase`, at every boundary. Checkpoints never change authority or rigor.

### 6.7 Versioning

Verb names, schemas, exit codes and reason codes are part of the public compatibility contract (PRD Section 6.5): additive changes are minor, semantic changes major. The skills in a plugin version are tested against exactly that kernel.

---

## 7. State

### 7.1 Layout

```text
.tenet/                 mode 0700; no file uses a source, test or build-configuration extension
├─ .gitignore           "*"
├─ marker               workspace ID, nonce, schema, directory identity
├─ state                the single state document (7.2), replaced atomically
├─ state.prev           the previous revision (corruption fallback)
├─ lock                 present only while a mutating call runs (7.3)
├─ log                  append-only JSON lines: effect intents and results, call summaries (7.4, 16)
├─ observed             hook observations, appended by `hook.mjs` (4.7; once SP-03 qualifies observation)
├─ blobs/<sha256>       archived contracts and cached responses
└─ git/                 the shadow repository for non-Git prototypes (10.9)
```

**Not in `.tenet/`:** raw check output, reports, screenshots, test databases and sealed baselines. They live in run directories in OS temp, or in host plugin storage where available (PRD Section 5.13). `.tenet/` keeps only normalized results.

**Why one document:** one writer at a time (AGT-08) and a 50 MB budget make a single small document, replaced atomically, sufficient. Readers always see one consistent revision, multi-record transactions disappear, and so do the journal and reference log they would need (TD-04).

### 7.2 The state document

```ts
type State = {
  schema: 1; revision: number; workspaceId: string;
  owner?: { work: WorkId; generation: number; highestRequest: number; lastCall: { at: string; left: "parked" | "finished" | "awaiting-answer" | "working" };
            inCall?: { runId: string; pid?: number; procStart?: string; verb: string; since: string } };
  project: {                                    // the project record, kept even when adoption is declined
    recipe?: { id: string; version: string }; moduleRoot: string; traits: string[];
    adoption: { intent: AdoptionState; policy: AdoptionState; charter: AdoptionState };
    planItems: PlanItem[];                      // the local copy when INTENT.md is not adopted
    records: Array<{ id: string; kind: "decision" | "constraint" | "assumption"; text: string }>;  // likewise
  };
  capabilities: Capability[];                   // observed values with provenance (INS-05)
  config: { local: Record<string, unknown>; revision: number };
  trust: Array<{ file: string; hash: string; adoptedAt: string; restrictions: object }>;
  consents: Array<{ kind: "hooks" | "filters" | "envelope" | "remote-read"; configHash: string; at: string }>;
  locks: Array<{ path: string; hash: string; obligation: string; work: WorkId }>;  // the project lock manifest: acceptance test files (9.7)
  pending: Question[];                          // questions awaiting answers
  work: Record<WorkId, WorkContract>;           // active and parked contracts only
  archive: Array<{ id: WorkId; label: string; endpoint: Endpoint; blob: string; finishedAt: string }>;
  lessons: Lesson[];                            // the only live copy of lesson text (8.9)
  responses: Array<{ generation: number; request: number; inputHash: string; verb: string; blob: string }>;  // last 64 (6.4)
  recovered?: { from: "state.prev"; at: string }; // set after a fallback; authority suspended (15.2)
  mac?: string;                                 // HMAC when a user key exists (Beta, 7.5)
};

type WorkContract = {
  id: WorkId /* wk_8f3a91c2d4 */; label: string /* W-0007 */; profile: Profile;
  lane: Lane; floor: Lane; state: WorkState; lastValidPhase?: WorkState; stopReason?: StopReason;
  outcome: string; planItem?: string; scope: { paths: string[]; protected: string[]; exceptions: Exception[] };
  basis: { revision: number; elements: BasisElement[]; traits: string[] };
  grants: Grant[]; obligations: Obligation[];   // includes acceptance obligations (9.2)
  receipts: Receipt[]; findings: Finding[]; declined: string[];
  git: { base: string; branch: string; start: StartSnapshot; stacked?: string; commits: string[] };
  touched: Array<{ path: string; hashAtLastCheck?: string; observed?: boolean }>;
  budget: BudgetState; model: ModelRecord; pinned: { tenet: string; schema: number; recipe?: string; adapter: string };
  acceptance: "pending" | "accepted" | "rejected" | "accepted-with-residual-risk";
  handoff?: string; createdAt: string; updatedAt: string;
};

type BasisElement = {
  id: string;                                   // REQ-…, EX-…, CNS-…, ASM-…, DEC-…
  kind: "requirement" | "example" | "invariant" | "constraint" | "assumption" | "decision";
  text?: string;                                // kept locally only when INTENT.md is not adopted
  verifiedBy: Array<{ method: "obligation" | "review" | "manual"; ref: string }> | { notApplicable: string };
};

type StartSnapshot = {                          // small: no full index listing
  head: string | null; branch: string | null;
  staged: Array<{ path: string; mode: string; blob: string }>;          // index entries that differ from HEAD
  dirty: Array<{ path: string; status: string; mode: string; blob?: string; stat?: FileStat }>;  // stat only for excluded paths
};

type BudgetState = {                            // counters of PRD Section 4.4 and RSC-04 (8.6)
  attempts: number; reviewRounds: number; rechecks: number;
  delegations: { reserved: number; dispatched: number; settled: number; byRole: Record<Role, number> };
  checksLaunched: number; kernelCalls: number; tenetTokens: number;   // tenetTokens is an estimate
  activeMinutesSinceCheckIn: number; activeMinutesTotal: number;
};

type ModelRecord = {                            // per assignment, in the log; the latest here (4.8)
  requested: "inherited" | "auto (host setting)" | string; resolved?: string;
  source: "reported" | "observed" | "unknown"; qualification: "qualified" | "unqualified" | "not-evaluated" | "unknown";
};
```

A finished contract moves out of `work` into `archive` as a compacted blob, which keeps the document small. The start snapshot records only what differs from HEAD, so its size depends on the dirty set, not the repository. Expected document size is under 200 KB with several active contracts (Section 14.3).

### 7.3 Transactions and ownership

**Two separate mechanisms** (TD-05):

| Mechanism | What it protects | How |
|---|---|---|
| Transaction lock (`.tenet/lock`) | One invocation publishing the next revision | Exclusive create, holding `{pid, procStart, nonce, verb}`; held only for the call's bookkeeping, never across long runs |
| Work ownership (`state.owner`) | Which contract may coordinate source changes | Work ID plus generation; checked inside every transaction |

**Acquiring the lock:**
1. Create `lock` with exclusive-create semantics. On success, the lock is held.
2. If it exists and its holder is alive (the process ID exists and its start time matches), report `kernel-busy` (exit 2, retryable).
3. If the holder is dead, break the lock under a guard: create `lock.break` exclusively (holding the breaker's own `{pid, procStart, nonce}`), re-read `lock`, unlink it only if it still holds the same dead holder's nonce, then remove `lock.break` and retry step 1. Only the guard holder may unlink a stale lock, and no fresh lock can exist while the stale one does, so two live breakers can never remove a live lock. A `lock.break` is itself stale only when its holder is dead by the same process-ID and start-time test; elapsed time never decides it, because a paused process is still alive.
4. **Backstop:** before the final rename of a publish, the kernel re-reads `state`'s revision; if it moved, the publish aborts with `revision-conflict`. Even a lock failure therefore cannot silently lose an update. Real-OS race tests cover both steps (17.2).

*Rejected simpler-looking alternative:* renaming a fresh lock over a stale one and re-reading the nonce is not race-free: two breakers can each see their own nonce at different moments.

**Publishing a revision:**
1. Read `state` and verify the MAC if a key exists (7.5).
2. Merge observations; recover (7.4); validate the envelope (6.4).
3. Compute and act.
4. Write `state.tmp` and fsync it; hard-link the current `state` to `state.prev.tmp` and rename that over `state.prev`; rename `state.tmp` over `state`; fsync the directory. The canonical path always exists, so readers always see one revision.
5. Remove `lock`.

**Long check runs** are split into two transactions:
- *transaction A* records the run intent with a `runId`, sets `owner.inCall`, then releases the lock;
- the runner spawns the process group and records its process ID and start time in the run directory's `run.json` immediately after spawn; until that record exists, the run counts as busy, never as absent;
- *transaction B* records the receipts and clears `inCall`.

While `inCall` names a live process, other mutating calls on that work get `work-busy`, except `stop`, which is always allowed, and recovery, which only reads. Calls from other contracts are blocked by ownership. Because liveness comes from the running process itself, ownership needs no expiry timer and no takeover prompt while a check runs.

**Ownership rules:**
- **Same contract, new chat:** `open --resume` increments the generation. Unless the previous generation's last call left the work parked, finished or waiting for an answer, one `takeover-check` question asks whether the earlier chat has stopped, because generations cannot stop native edits from a chat that is still running. Elapsed time alone never decides this. With observer hooks, a session's `Stop` line answers the question without asking.
- **Different contract:** blocked while the owner is active. A parked, blocked or finished owner releases ownership.
- **Owner unknown,** for example an `inCall` whose process is dead: `open` reconciles (7.4) and continues; the user is asked only if the inventory shows changes the kernel cannot attribute (10.2).

**Releasing ownership** (pause, park, awaiting acceptance) happens only when no owned process is running and no effect is uncertain.

### 7.4 Effect protocol

Effects are classified by whether repeating them is safe:

| Class | Effects | Protocol |
|---|---|---|
| Not repeatable | Git commits, integration and undo; dependency installs; the scaffold write; prototype restores; remote actions | Intent, act, result, publish |
| Repeatable by envelope | Checks whose envelope declares no network beyond localhost, no data targets and no writes outside the run directory | Run intent only; a crashed run is discarded and rerun |
| Unknown | Checks with any other envelope | Run intent; after a crash the run is uncertain, and rerunning needs the user's confirmation |
| Re-renderable | Projections (managed blocks, decision records, docs) | No effect records; on recovery, re-rendered only where the file still has the hash Tenet last wrote; otherwise a question, so user edits are never overwritten |

1. **Intent:** append `{effect, id, op, expected}` to `log` and fsync. `expected` holds what reconciliation needs, for example the old HEAD, the expected tree and the commit message.
2. **Act.**
3. **Result:** append `{effect, id, outcome, observed}` and fsync.
4. **Publish** the state revision that references the outcome.

**Recovery:** an intent without a result is **uncertain**, never "did not happen". Before anything else touches the same resource, `open` reconciles each one into one of three outcomes: **observed completed**, **observed not performed** or **unresolved** (a question):

| Operation | Completed when | Not performed when |
|---|---|---|
| Commit, integration, undo | Exactly one reflog move on the intent's branch from the old HEAD to a commit whose parent is the old HEAD, whose message starts with the intent's subject, and whose changed paths are within the intent's paths (later commits or hook reformatting do not hide it) | HEAD equals the old HEAD and the reflog shows no such move |
| Install | The lockfile and manifests equal the expected state **and** a readiness re-probe passes; side effects of install scripts remain disclosed as uncertain | They equal the prior state |
| Scaffold, prototype restore | File hashes equal the expected hashes | File hashes equal the prior hashes |
| Push or PR | `git ls-remote` shows the expected commit, or `gh pr list --head` shows the PR (a consented remote read) | The remote shows the prior state |
| Check run | — | The recorded process group is stopped if its process ID and start time match; the receipt is discarded. If the process was never recorded (a crash between spawn and record), the result says an orphan may exist |

Anything else, including several candidate commits or missing reflog history, is unresolved and becomes a question. Every response lists completed and uncertain effects separately (6.6). The kernel never promises that nothing partial happened. **Log compaction never removes an intent that has no result** (PRD Section 5.15).

### 7.5 Marker, user directory and quarantine

- **User directory:** `~/Library/Application Support/tenet/` on macOS (`$XDG_CONFIG_HOME/tenet/` elsewhere), or `${PLUGIN_DATA}` for the MCP and hook front-ends where the host provides it. It holds only user preferences (`prefs`, replaced atomically) and the optional machine key (`key`, created with exclusive create so concurrent projects cannot race). Nothing in it is needed for correctness. [SPIKE: SP-02] confirms writability per front-end (TQ-04).
- **Marker:** `{workspaceId, nonce, schema, dev, ino}`, written when an implementation profile first creates `.tenet/`; `dev` and `ino` identify the `.tenet/` directory itself.
- **Copy and clone detection:** a copied `.tenet/` has a new inode, so its device and inode no longer match the marker, and it is **quarantined**:
  - its lessons, commands, settings and contracts are ignored;
  - its entries are moved into `.tenet/quarantine-<date>/` as inert data, and a fresh state starts beside them;
  - `open` returns a question offering to review the quarantined state through `decide {request: adopt}` or to keep the fresh start.

  A same-filesystem move keeps the inode and only triggers scope reconciliation (CON-11). A Git clone never carries `.tenet/`, because it is ignored.
- **MAC (Beta):** with a key, `state` carries an HMAC, and a mismatch is reported as `state-modified-outside-kernel` (exit 4). The key is readable by any process running as the user, so the MAC catches accidental and naive edits only. Without a key the control is labeled unavailable, and the default `.tenet/` no-edit exclusion, schema validation and the revision check are the protection (PRD Section 5.10.2).

### 7.6 Retention and admission

- **Budgets:** `.tenet/` at most 50 MB (PRD Section 4.4.3). Run directories at most 200 MB per project and 1 GB per machine.
- **What fills `.tenet/`:** the state document, archived contracts, cached responses and prototype snapshots. Raw output and screenshots are not stored there, so admission control is simple:
  - prototype snapshots larger than 20 MB are refused with `snapshot-too-large`, offering `git init` instead;
  - state writes are always admitted, with a 5 MB reserve kept for them.
- **Eviction**, run inside `open` and `finish` within 300 ms, in PRD Section 5.15 order:
  1. cached responses older than the last 64;
  2. shadow snapshots of finished prototypes older than 30 days;
  3. `log` entries older than 90 days, replaced by monthly summaries (unresolved intents are kept);
  4. archived contracts compacted to their summary lines.
- **Protected:** active contracts and grants, unresolved effects, open findings, the lock manifest and ownership records are never evicted. If protected data alone exceeds the ceiling, mutating calls that would add data stop with `storage-protected-full`.
- **Run directories** past their caps or 24 hours old are removed at the next kernel call, except those of live runs, whose processes are reconciled first; there is no background cleanup. When raw output has expired, later claims say "historical; raw output unavailable" and never imply a new failure.

### 7.7 Schema migration

- `state.schema` is upcast by pure functions on read, and the latest version is written.
- **Before a schema-changing write,** the old document is kept as `state.v<N>.bak`.
- **Rolling back the plugin** restores the backup only if no mutation happened since; otherwise the older kernel runs read-only and explains how to update. Work done after the migration is never discarded silently.
- **Unknown fields** are preserved under `_ext`, except in grants, restrictions and consents, where they make the record unsupported (exit 4).
- **Forgetting reaches every copy Tenet controls:** `decide forget` publishes twice (so `state.prev` also lacks the text), removes the text from schema backups, and clears the response cache (CON-10, PRD Section 5.15).

### 7.8 Projections and the policy file

**`INTENT.md` managed blocks:** `<!-- tenet:begin REQ-012-q7k -->` … `<!-- tenet:end REQ-012-q7k -->` around each requirement (with its examples and invariants), constraint, assumption, deferred choice and plan item. Prose outside the blocks belongs to the user.
- **Duplicate, nested, unbalanced or malformed markers** stop with `intent-markers-invalid` and show the region; the kernel never guesses which copy is canonical.
- **Changes outside Tenet:** any block whose content changed since adoption needs acceptance through a diff. The kernel does not classify prose changes as tightening (PRD Section 5.6).
- **Size:** past about 8,000 tokens, Tenet proposes splitting into `docs/intent/<area>.md` with an index.
- **Adoption declined:** accepted intent and plan items stay in the project record (7.2) and are lost with `.tenet/`, which the result says (PRD Section 5.14).

**Designated existing documents** (INT-13): `config.intent.sources` points to an existing document and section. The kernel records the path and its hash, the agent reads it, managed blocks go only into the designated section after a preview, and a hash change triggers a re-read and diff.

**Decision records:** `docs/decisions/NNNN-<id>-<slug>.md` in MADR format, with front matter `id`, `status`, `date` and `links`.

**Tenet's record files are declared outputs.** Files the kernel itself writes (managed blocks in `INTENT.md`, decision records, `docs/hardening.md`, `docs/a11y-checks.md`) are declared outputs of Tenet under EVD-09: they are excluded from check-input identities, so recording a decision or a manual check never makes receipts stale. Their hashes are still tracked, so any change by someone else is detected through adoption (above) and attribution. Agent-written documents such as `docs/architecture.md` remain ordinary inputs.

**Charter:** a section of **at most 300 tokens**, counted in the always-loaded budget because instruction files load into every chat on the project (PA-5), between `<!-- tenet:charter:begin -->` markers in **one** instruction file, the one the host is observed to load (`instructionFiles`, SP-02):
- if the host loads only one of `AGENTS.md` and `.github/copilot-instructions.md`, use it;
- if it loads both, use the one that exists, preferring `AGENTS.md`;
- if neither exists, propose the file the host loads by default;
- never create a second file, and never rewrite text outside the markers.

**Policy file:** `tenet.policy.json` at the repository root holds the shared commitments from the PRD Section 7.3 catalog. It is adopted by content hash. Changes are compared field by field (8.5), and commands in it need an envelope consent before their first run.

### 7.9 Identifiers

- **Work:** an opaque ID `wk_<10 random base32 characters>` for correlation, plus a friendly label `W-####` for people. Labels may repeat after state loss; IDs never do.
- **Shared IDs:** `<PREFIX>-<sequence>-<3-character suffix>`, for example `REQ-012-q7k`. The sequence is the highest seen on the current branch plus one. Prefixes: `REQ`, `EX-<req>.<n>`, `CNS`, `ASM`, `DEC`, `PLN`.
- **Integration reconciliation (GIT-09):**
  - same ID with different content, *and the block existed at the merge base* → a content conflict; the user decides from a three-way view;
  - the block did not exist at the merge base (both branches created it) → re-suffix the newer one and update its links and test tags in one proposed patch.
- **Test tags:** `// @tenet EX-012-q7k.1` in acceptance test files (9.2).

---

## 8. Rules (pure core)

### 8.1 Lifecycles

**Work contract** (PRD Section 3.7.2):

| From | To | Guard |
|---|---|---|
| — | proposed | `open`; ownership acquired for implementation profiles |
| proposed | authorized | A grant covers the outcome and action classes. A clear request grants routine local steps directly (WRK-02); Standard and Deep also need an accepted basis |
| authorized | executing | Floors computed; a dirty-tree choice recorded when the tree was dirty (GIT-10) |
| executing | checking | `check` called |
| checking | executing | An introduced failure and attempts remain, and no stop reason is set |
| checking | finished | `finish` verdict allowed (8.3); handoff written |
| active | blocked or parked | Reason recorded; `lastValidPhase` kept; ownership released only when nothing owned is running and no effect is uncertain |
| blocked or parked | `lastValidPhase` | `open --resume`; reconciliation passed |
| any | cancelled, superseded | `stop cancel` or `stop abandon`; or an intent change (INT-08) |

**Stop reasons** (`stopReason`): `repeated-failure`, `budget-exhausted`, `host-limit` (the host stopped responding or reported a usage limit), `user-stop` and `declined`. A stop reason lets `finish` produce an honest incomplete result even while attempts remain (WRK-09).

**Acceptance obligation** (one per accepted example, 9.2):
- `registered` (when the basis is recorded, *before* any run);
- → `verified`, once the baseline run matched the declared baseline expectation and the candidate run passed;
- → `locked` (an entry in the project lock manifest, 9.7);
- `locked → revised` needs a disposition (a user confirmation for a behavior change, or a Reviewer disposition for a test defect; one disposition may cover a batch of mechanical edits); then `revised → verified → locked`.

Declared baseline expectations by kind:

| Kind | Expected on baseline |
|---|---|
| Distinguishing | Behavioral failure |
| Preservation | Pass |
| Boundary or negative | Declared per case (pass or behavioral failure) |

**Basis elements:** every requirement, example, invariant, constraint, assumption and decision in the basis names how it is verified (an obligation, the review, or a manual check) or why verification does not apply (`BasisElement.verifiedBy`, 7.2).

**Findings:** as in PRD Section 3.7.2, under Section 8.4. **Effects:** intent → result, or uncertain (7.4).

### 8.2 Risk and lane floors

The coordinator submits a structured assessment of the **change**: six dimensions, each low or high, with one line of evidence. The kernel raises dimensions from deterministic signals **about the change**, never about the project as a whole (PRD Section 5.2). It can raise, never lower.

| Signal in the planned or actual diff | Raises | Mechanism |
|---|---|---|
| Edits under paths matched by `auth` trait patterns | Access and identity | Deterministic |
| New or edited migrations, schema or DDL | Reversibility; compatibility | Deterministic |
| `package.json` dependency or lockfile changes | Compatibility; adds dependency obligations (9.11) | Deterministic |
| Edits in `protected_paths` | Compatibility; needs a per-task exception grant | Deterministic |
| Change traits `external-effects` or `personal-data` | External effects; sensitive data | Deterministic |
| No test discovered for the changed modules | Uncertainty (after inspection) | Deterministic |
| Changed exports with more than 10 callers, counted by the coordinator with `usages` | Blast radius | Reported |

At least one High dimension sets the floor to Standard; two or more, or an irreversible effect, set it to Deep. The user may lower the lane to the floor and never below it; declining a floor step is recorded and handled by the verdict (WRK-13).

### 8.3 Verdict

The verdict is computed only by `finish` and `inspect why`.

```ts
function verdict(i: VerdictInput): Verdict {
  const r: Reason[] = [];
  // 1. Required obligations, judged on receipts whose check-input identity matches now (8.8)
  for (const ob of i.requiredObligations) r.push(...judgeObligation(ob, i.receipts, i.baselineFailures, i.excludedScope));
  // 2. Basis: every element has a fresh verification or a recorded reason it does not apply
  for (const el of i.basis.elements) r.push(...judgeElement(el, i));                // basis-element-unverified, locked-test-changed
  // 3. Behavioral evidence
  if (i.behavioralChange) r.push(...judgeRed(i));        // distinguishing red, or a declared alternative with a negative-control receipt
  else r.push(...judgeAlternativeCheck(i));               // nonbehavioral work: its declared alternative check
  // 4. Review: required independence, current basis and candidate, full coverage
  if (i.reviewRequired) r.push(...judgeReview(i.review, i.basis.revision, i.candidate));
  // 5. Findings by disposition, assumptions, declined steps, integration
  r.push(...openBlockers(i), ...undisposedMajors(i), ...unresolvedAssumptions(i), ...i.declined.map(code("declined-step")));
  if (i.integratedAfterMovedBase && !i.integratedReceiptsFresh) r.push(code("integration-unvalidated"));

  const blocking = r.filter(x => !x.note);
  let endpoint: Endpoint =
    i.profile === "review" ? "findings-only" :
    i.prototypeRequested ? "prototype" :
    blocking.length === 0 ? "checked-local" :
    i.implementationExists ? "implemented-unverified" : "blocked";
  endpoint = min(endpoint, ceilingFor(i.assistanceLevel));          // ceiling applied last, never a shortcut
  const scope = endpoint !== "checked-local" ? undefined
    : i.commitExists && i.commitTree === i.checkedTree ? "committed"
    : i.checkedIncludesHumanEdits ? "working-tree-with-your-edits" : "working-tree-uncommitted";
  return { endpoint, scope, reasons: r, coverage: i.review?.coverage, acceptance: i.acceptance,
           integration: i.integrationState, stopReason: i.stopReason };
}
```

**Rules:**
- **Everything is evaluated first.** The prototype, review-only and assistance-level outcomes never skip the checks, so every reason that prevented a stronger endpoint is listed (RES-02).
- **Ceiling:** L3 caps at `implemented-unverified`; L0 to L2 cap at `findings-only`, or `blocked` when nothing exists.
- **Review eligibility comes from evidence and dispositions,** not from the Reviewer's axis labels:
  - blocking: missing required review, reduced independence where independence is required, partial coverage, a review older than the current basis revision or candidate (`review-stale`), an open blocker, an undisposed major finding, an open basis gap;
  - not blocking: a major finding the user accepted as a risk. The Reviewer's `fail` stays visible in the result and is never edited to make room for risk acceptance.
- **Separate dimensions:** endpoint, scope, coverage, controls (with their mechanisms), owner acceptance and integration are separate result fields; none is folded into "done".
- **Scope is part of the label:** when the scope is not `committed`, it is rendered in the endpoint label itself, for example "checked-local (working tree, includes your uncommitted edits)", not as a footnote.
- **`finish` refuses to close** (exit 2 `continue-required`) while an introduced failure remains, attempts remain, and no stop reason is set (PRD Section 4.5.2). With a stop reason, `finish` closes with the honest endpoint and the diagnosis.
- **Owner acceptance** is recorded by `decide` and never removes a blocking reason.
- **Tests:** one AC-27 fixture per PRD Section 4.5.2 row, plus property tests (more fresh passing evidence never weakens the endpoint; removing evidence never strengthens it).

### 8.4 Findings

| Transition | Allowed when | Decider |
|---|---|---|
| open → valid or disputed | Recorded from a review result | Coordinator, with evidence |
| disputed → withdrawn | Contrary evidence recorded; normative disputes go to the user | Coordinator or user |
| valid → fixed → verified | Linked change; a focused recheck reports it resolved | Reviewer verifies |
| valid → deferred, risk-accepted or wont-fix | Major or minor, with a reason | User (the coordinator may defer minor findings) |
| Severity lowered | Evidence recorded, shown to the user | Coordinator |
| Blocker closed other than by verified or withdrawn | Never; the user may change the basis instead (INT-08) | — |

### 8.5 Configuration and trust

- **Resolution:**
  - the five preference layers of PRD Section 7.4, most specific wins;
  - restrictions (protected paths, exclusions, required checks, stricter dependency-policy values) are unioned **from every source, including shared files not yet adopted**;
  - commands are chosen per check name, and a command never discharges an obligation it is not equivalent to;
  - floors and integrity rules always apply.
- **Output:** `{value, sources, adoptionState, overridden, limits, effectsOnActiveWork}`, rendered directly by `inspect why`.
- **Validation:** unknown or malformed keys in restriction-bearing sources block dependent work (CFG-11). A mixed update yields a restriction-only revision plus a rejection (PRD Section 7.5).
- **Trust comparison:** applied automatically **only** to structurally comparable fields of `tenet.policy.json`:
  - `protected_paths` and `exclusions`: superset or not;
  - `required_checks`: obligations added or removed, identified by ID;
  - `dependency_policy`: field by field.

  Anything else (changed globs or populations, commands, `INTENT.md` blocks, the charter) needs acceptance through a diff. There is no semantic implication solver.
- **Mid-work changes:**
  - presentation changes apply immediately and invalidate nothing;
  - restriction changes apply before the next affected action;
  - command or obligation changes invalidate dependent receipts;
  - widening anything needs authority (PRD Section 7.6).
- **Scope estimate versus constraint:** a predicted path list is an estimate. A newly relevant file is not a scope change unless the user made the paths a constraint (PRD Section 5.3.2).

**Where each catalog setting is consumed** (CFG-02; PRD Section 7.3 lists exactly these 12):

| # | Setting | Consumer |
|---|---|---|
| 1 | `style` | `presentation.style` (6.6); `guided.md` or `concise.md` (5.1) |
| 2 | `checkpoints` | `presentation.checkpoints` and `progress` (6.6) |
| 3 | `lane` | Floors (8.2) |
| 4 | `resource_mode` | `packet analyst` refuses optional parallel dispatch under `serial`; `conserve` prefers focused passes for optional roles; `findings` records `dispatchMode`, and `same-session` adds the reduced-independence reason (REV-06). Setup asks one optional question ("is your plan's monthly allowance tight?") and sets `conserve` on yes; at 80% of the delegation limit the result suggests it once. Conserve and Serial reduce optional work; they are not spending guarantees |
| 5 | `shared_memory` | Adoption state in the project record (7.2) |
| 6 | `branching` | Work branches (10.7) |
| 7 | `integration` | `finish` integration offer; `integrate` (10.4) |
| 8 | `commands` | Obligation invocation (9.5) |
| 9 | `required_checks` | Obligation sources (9.2) |
| 10 | `protected_paths` | Risk (8.2); scope checks |
| 11 | `exclusions` | Inventory, manifests, exports, check environments (11.3) |
| 12 | `dependency_policy` | Dependency verification (9.11) |

### 8.6 Budgets and usage reporting

**Counters** (PRD Section 4.4; RSC-04), all in `BudgetState` (7.2):

| Counter | Incremented when | Notes |
|---|---|---|
| Attempt | A full candidate check (`check --stage candidate` without `--targeted`) after edits | Targeted inner-loop checks are compile and test iterations inside a pass, so they never count (PRD Section 4.4.1). Baseline runs never count |
| Review round | `findings` records a full review | A follow-up dispatch for uncovered parts (8.7) belongs to the same round; rechecks are counted separately |
| Delegation | **Reserved** by `packet reviewer` or `packet analyst`; **dispatched** when the coordinator reports the dispatch (observed with hooks); **settled** by `findings` | A reservation stays pending until a result, `stop cancel`, abandonment or reconciliation, so parallel dispatches never expire each other. Dispatch beyond the lane limit is refused at reservation |
| Tenet-launched check | Each obligation execution, including flaky reruns and sealed-baseline runs | Not the number of `check` calls |
| Kernel call | Each verb call | Diagnostic only |
| Tenet tokens (estimate) | Each response and packet, by its token estimate | What Tenet injected; never presented as total usage |
| Active time | Kernel call durations plus gaps between consecutive calls, each capped at 3 minutes; gaps after exit 2 or 3 and waits for native dispatches excluded | Measured **between check-ins** and reset at each one (PRD Section 4.4.2); labeled an estimate. Human active minutes for the pilot come from the PRD Section 6.6 consented observation, not from logs |

**Failures that are not attempts:** configuration and execution failures (`not-executed`, `report-invalid`, `adapter-unsupported-config`) stop for diagnosis at once instead of consuming attempts, and the planned red of a baseline run never enters failure signatures. Repeated-failure signatures (the obligation, the sorted failing tests and the first normalized error line) set `stopReason: repeated-failure` when the same signature appears twice in a row or in an A-B-A-B pattern (WRK-09). At 80% of any counter, the handoff is written proactively (WRK-12).

**Budget preview before Deep work** (RES-09): the response to the lane change lists the expected native sessions (Reviewer, Architect, Security, and Analysts if any), review rounds, full-suite and workload runs, and the main cost drivers in plain words ("about 4 subagent sessions; the full suite twice"). It shows no currency, because prices change monthly and the resolved model may be unknown.

**Usage reporting** (RSC-04 now; RSC-07 later). `inspect status` and the result show, with source and freshness:
- attempts, review rounds and rechecks, delegations by role, Tenet-launched checks, active time;
- Tenet tokens (estimate), labeled as Tenet-injected context only;
- the model record (4.8);
- `usage: unknown` with the reason ("account usage is not visible to plugins") and where to look: the Copilot usage dashboard, the per-subagent credit display (`chat.subagents.showCreditUsage`) and GitHub's usage report and budgets.

Tenet never converts tokens into credits, requests or money, and never shows an allowance it does not know; a false usage number is worse than `unknown`. When a host or permitted read-only source later supplies usage, it is recorded as a `UsageObservation` (16) with scope, source and freshness, never enforced and never used to switch accounts or buy capacity (RSC-03, 11.4).

### 8.7 Review manifest and context

The Reviewer has a fresh context and the host's read, search and `usages` tools, so the manifest is a small **index of what to examine**, not a copy of the repository. The host's language services provide the repository map that PRD Section 3.8.7 describes (exports, imports, entry points, routes and tests), refreshed incrementally by the host; this is adoption of an equivalent host capability under PRD Section 7.9.

| Part | Content |
|---|---|
| Identity | Work, candidate source digest, basis revision, manifest hash, mode (`full` or `recheck`) |
| Basis | Outcome; every basis element with its verification link; obligations and floors. **Never truncated.** If these alone exceed the budget, `packet` returns `narrow-increment` (exit 2) |
| Evidence | Receipt summaries and open findings |
| Changes | Every changed path with its kind (test, configuration, locked, source) and line counts. Test, configuration and source diffs inline with function context (`git diff --function-context`) within the budget, otherwise paths only. Lockfiles and generated snapshots are never inlined; the structured dependency diff from 9.11 replaces them |
| Closed read list | The changed files, their linked acceptance tests, and for each changed exported symbol (taken from the diff's changed lines; context only) its callers to locate with `usages`; changed routes and entry points to locate with search |
| Rubric | Required axes, trait rubric items, the charter excerpt and active lessons (at most 1,500 tokens) |

- **Stopping rule:** the Reviewer works through the closed read list and stops. Where a symbol has more than 10 callers, it opens a sample across distinct modules and records the count in `coverage.sampled`. Anything not reached goes into `coverage.uncovered`. Open-ended exploration beyond the list is a Deep choice, not the Standard default.
- **Recheck mode** (`--recheck <findings>`): only the named findings, their locations, the diff since the last reviewed candidate, the basis elements those findings touch, and the previous coverage summary. A focused recheck costs a fraction of a full review (PRD Section 4.4.1).
- **Budget:** at most 20,000 tokens of Tenet-injected context per assignment, **including** role instructions and rubric (PRD Section 4.4.3). Token estimate: bytes ÷ 3.5 for code, ÷ 4 for prose, plus 10%; calibrated in SP-02 (TQ-13). Packet limits constrain Tenet's injection; they do not bound what the Reviewer reads, total usage, or spending (14.4).
- **Coverage instead of pre-chunking (REV-08):** if `uncovered` is not empty, the verdict has `review-partial-coverage`, and the coordinator either dispatches a follow-up review with the manifest plus the uncovered list (split coverage; same round, one more delegation), or narrows the increment. There is no whole-change verdict from partial coverage. Every full review includes one cross-module statement.
- **Binding:** `findings` rejects a result whose candidate digest or basis revision differs from the current one (`review-stale`).
- **Exclusions** are applied before selection, so excluded content never enters a manifest, and the Reviewer's instructions repeat the exclusions for its own reads (cooperative where the host does not enforce them, SEC-08).
- **Fallback:** where `usages` is unavailable to a subagent (SP-08), the Reviewer uses text search for the symbol names and says so in coverage.

### 8.8 Evidence freshness

- **Identities:**
  - **Source candidate:** the inventory digest (9.4) of all non-excluded workspace inputs (content identity and file mode), plus the stat of excluded inputs and of declared ignored inputs.
  - **Check-input identity:** `sha256(source candidate, obligation definition, toolchain fingerprint, envelope)` for one obligation.
- **Canonical content identity:** every file's content is identified by its Git blob ID (in the repository's object format), whether it is clean, staged, dirty or untracked; dirty and untracked files are hashed in Node in the same format, so committing an unchanged candidate never changes its identity. Files with clean filters or end-of-line conversion may differ after commit and are then conservatively stale.
- **Reuse rule:** a receipt is valid for the current state when its check-input identity equals the current one. Any change to any inventory input therefore makes every receipt stale. This is the PRD's conservative rule (EVD-03); a dependency index waits for measurements showing reruns are a real cost (TD-08).
- **Kept outside identities** so they cause no false invalidation: presentation settings, lock timestamps, declared outputs of a check (EVD-09), Tenet's own record files (7.8) and `.tenet/`.
- **Receipts keep their original identity.** When the verdict reuses one, the reuse decision is recorded beside it; the receipt is never rewritten to imply a new run.
- **Speed in inner loops:** runner-native affected selection (`vitest related`, Jest `--findRelatedTests`) yields `scope: targeted` receipts, which never discharge full-suite obligations at the checked boundary. Host diagnostics give feedback between attempts without running anything.

### 8.9 Lessons

- **Record:** `{id: "LSN-…", statement, scope: task | project, evidence, provenance, anchors, state, expiresAt}`.
- **Activation:**
  - an inline correction applies to the current contract;
  - "always in this project" activates a project lesson through `decide`;
  - inferred lessons stay proposals (LRN-01, LRN-02, LRN-04).
- **Single live copy:** lesson text lives only in `state.lessons`. Packets are rebuilt and archives reference IDs; `decide forget` also purges backups and caches (7.7), so forgetting is complete for every copy Tenet controls (CON-10, AC-09).
- **Not host memory:** Tenet never writes lessons into host memory, because host memory offers no per-item provenance or previewed forgetting (retirement row, 4.4).
- **Constraints:**
  - lessons cannot carry obligations, permissions, evaluators or floors (LRN-05);
  - an anchor that disappears flags the lesson for review;
  - lessons from quarantined state are inert.

---

## 9. Evidence

### 9.1 Check kinds

| Kind | Essential evidence | Validation |
|---|---|---|
| `test` | Discovered, executed, passed, failed, skipped and focused counts; per-test outcomes and failure kinds | Population matches the obligation; zero executed means inconclusive; focus markers make it inconclusive unless declared |
| `static` | Files and configuration analyzed; diagnostics; exit | Exit and diagnostics agree; the analyzed file set is not empty |
| `build` | Target, configuration, completion, artifacts | Expected artifacts exist |
| `audit` | Dependency scope; whether the advisory data is current; findings; completeness | Distinguishes "none known", "unavailable" and "incomplete" |
| `workload` | Environment, load, duration, samples, errors, percentiles, resources | Protocol of Section 12.7 followed; minimum sample count |
| `manual` | Procedure, scope, observer, result, limitations | Recorded by `decide` with the observer named; human judgment, not automation |

Each kind is a module with its own validation in a registry, so a new kind adds a file.

### 9.2 Obligations

- **Sources:**
  - recipe defaults;
  - adopted `required_checks`;
  - trait contributions;
  - **acceptance obligations**, registered when the basis is recorded, before any run: one per accepted example, naming the acceptance test file, the example tag, the declared baseline expectation (8.1) and any declared support inputs (9.7).
- **Applicability:** each obligation has one category, so routine changes never trigger release-level work:

| Category | Runs | Examples |
|---|---|---|
| `candidate` | At every candidate check, targeted where the runner supports it | Unit and integration tests for changed modules; lint and types for changed files |
| `boundary` | Before `finish` claims checked-local | The full required suite; whole-project lint and types |
| `affected` | When a trait or path pattern matches the change | End-to-end and automated accessibility checks for changed journeys |
| `release` | In Deep work and release qualification | Workload |
| `manual-affected` | Once per changed critical journey, at the boundary; asked as one question | Screen-reader check |

  Adopted project commitments keep their category; a required manual check is never silently skipped. Recipe defaults and their categories are shown in the contract preview. A manual receipt's identity is the candidate it observed, so it goes stale on any later change like every other receipt; the coordinator therefore asks for it last, after the final candidate check. One Playwright run produces both the `e2e` and the automated `a11y` receipts when the axe checks run inside the journeys.
- **Acceptance test files:** acceptance tests live in dedicated files, `<module>/<req-id>.acceptance.test.ts` by default, following project conventions for location. New examples added after a file is locked go into a new file (`<req-id>.<n>.acceptance.test.ts`), so amending the basis never edits a locked file.
- **Discharge:** an obligation is discharged only by a receipt of its kind that passes the kind's validation and matches its declared population. A renamed or filtered command never discharges it.

### 9.3 Runner and execution envelopes

- **Binaries:**
  - checks invoke the project's installed tool directly (`<moduleRoot>/node_modules/.bin/<tool>`) with argument arrays and no shell;
  - **never** `npx` or `npm exec`, which can fetch missing tools;
  - a missing tool is a readiness item, and installing it is a separately consented action (9.11).
- **Environment** (reduced inheritance, *not* isolation):
  - *passed:* `HOME`, `USER`, `LOGNAME`, `SHELL`, `LANG` and `LC_*`, `TERM`, the proxy and certificate variables (`HTTP(S)_PROXY`, `NO_PROXY`, `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`), `XDG_*`, `npm_config_*` names without token-like suffixes, and declared variables;
  - *`NODE_OPTIONS`:* passed, but part of the executable chain: its hash enters the toolchain fingerprint, and any preload flag is disclosed in the envelope;
  - *dropped:* names matching `/(TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|AUTH)/i`, plus `AWS_*`, `AZURE_*`, `GOOGLE_*`, `GH_*`, `GITHUB_TOKEN` and `NPM_TOKEN`;
  - *`PATH`:* built from the directory of the running `node`, `<moduleRoot>/node_modules/.bin`, the directories where `git` and the package manager were resolved, and the system directories;
  - *`TMPDIR`:* the run directory;
  - *`TZ`:* declared (default `UTC`).

  The result discloses the variable names passed and dropped. Project tools can still read credential *files* in `HOME`; the result says so.
- **Containment:** the Local harness provides no host sandbox for these processes, so the reduced environment is the only layer, and the result says so (`containment: none-observed`, 4.4). If a host sandbox is ever observed, the label changes; Tenet builds no sandbox of its own.
- **CI flag:** `CI=true` is set only where the recipe or obligation declares it, and the result discloses it.
- **Run directory:** `os.tmpdir()/tenet-<workspaceId>/<runId>/` (or the plugin storage equivalent) with mode `0700`, holding `run.json`, reports, test databases, raw output and screenshots, within the caps of Section 7.6. If neither location is writable, raw output is not kept and the receipt keeps its normalized data (`run-dir-unavailable`).
- **Processes:**
  - the run intent (with `runId`) is published before spawn (7.3);
  - spawned in their own process group;
  - the process ID and start time are written to `run.json` immediately after spawn;
  - on timeout or `stop cancel`: SIGTERM to the group, 5 seconds' grace, then SIGKILL;
  - after a kernel crash, the next call stops a recorded group whose process ID and start time still match (7.4).
- **Servers and ports** (EVD-13, PRD Section 5.13):
  1. For the starter, the runner allocates a free loopback port (bind port 0 on `127.0.0.1`, read it, release it) and passes it as `PORT`, so an occupied default port never blocks a check.
  2. Playwright's `webServer` starts the server under the runner's process tree with `reuseExistingServer: false`, its readiness URL and a timeout, plus `DATABASE_URL` pointing at a fresh database in the run directory.
  3. The health endpoint must echo `TENET_RUN_TOKEN`. A brownfield project with a fixed port gets a pre-check bind instead: if the port is in use, the receipt is `inconclusive` with `port-in-use`. A brownfield server without a token is identified only by the pre-check plus process ancestry, and the result records that weaker identity (`server-identity-weak`).
- **Envelope record:**
  - argv, working directory, environment variable names;
  - declared writable paths and declared outputs;
  - expected network (`none`, `localhost` or `declared`; informational);
  - data targets;
  - observed containment;
  - replay class (7.4).

  Unknown network, data or credential exposure leads to one question (SEC-15). The consent is stored per project and per envelope hash (7.2).
- **Network:** the kernel opens no network connections of its own. Audits, installs and some tests do, and that is declared in their envelopes.

### 9.4 Inventory and identities

The inventory must be exclusion-aware **before** any content-capable operation, must never write to Git, and must never read prohibited content:

```text
inventory():
  require consent for executable Git filters, if any are configured   (git config --get-regexp '^filter\..*\.(clean|process|smudge)$', .gitattributes filter=)
  xs = exclusion patterns as Git pathspecs  (':(exclude,glob)<pattern>' …)
  with GIT_OPTIONAL_LOCKS=0 (no index refresh writes):
    tracked   = git ls-files -s -z -- . xs                     # mode, blob ID, path; no content read
    status    = git status --porcelain=v2 -z --untracked-files=all -- . xs   # excluded paths never examined
  for each path in tracked ∪ untracked ∪ declared ignored inputs, excluding .tenet/, declared outputs and Tenet record files:
    if symlink                                   → {path, mode, link target string}            # never followed
    elif tracked and clean                       → {path, mode, blob ID from index}            # no read
    else (dirty, untracked or declared ignored)  → {path, mode, blob ID computed in Node}       # "blob <len>\0" + content; never git add
  for each excluded path that exists (lstat only) → {path, size, mtime, mode}                   # a stat change counts as a change
  guard: more than 20,000 untracked files or 500 MB of untracked bytes → inventory-too-large (exit 2), suggesting .gitignore
  return sha256(sorted entries) plus the per-file map
```

- **Writes nothing to Git**, stores no secret content, and passes excluded paths to no Git command (EVD-01, SEC-14, CON-09).
- **One identity per content:** clean, staged, dirty and untracked files all use the Git blob ID, so a commit of unchanged content keeps every identity (8.8).
- **Declared ignored inputs:** an obligation may declare ignored files it depends on (for example `.env.test` or a local runner configuration); they enter the inventory, or their stat if they are excluded.
- **Excluded inputs still count:** a changed `.env` changes its stat entry, which makes dependent receipts stale. Presence alone is never proof that a secret-dependent input is unchanged.
- **Filters:** Git clean filters can still run inside `git status` for stat-dirty files, which is why filter configuration needs consent first. [SPIKE: SP-06, TQ-14]
- **Toolchain fingerprint:** `node --version`, the package-manager version, the `NODE_OPTIONS` hash, and the versions of runner tools read from `node_modules/<tool>/package.json` (reading files only, never executing). This detects version changes, not arbitrary edits inside `node_modules`, and the result says so.
- **Drift during a run:** the inventory is taken before and after every check, excluding declared outputs. A difference makes the receipt `inconclusive` with `concurrent-edit` (EVD-11).
- **Non-Git folders:** the same commands run against the shadow repository (10.9), so there is one inventory algorithm.

### 9.5 Node/TypeScript adapter

The adapter is mostly data: a manifest of detection rules and invocations per tool, plus one pure `normalize(kind, rawReport)` function per reporter format.

- **Detection:**
  - package manager from the lockfile (npm, pnpm, Yarn 1; Yarn Plug'n'Play is unsupported);
  - `moduleRoot` from the project record (default `.`; one module root in monorepos, experimental);
  - runners from configuration files and `devDependencies`.
- **Supported tool versions** are listed in the support matrix and confirmed by SP-10. Other versions yield `adapter-unsupported-version`.
- **Invocations** (JSON reporters only, so no XML parsing is needed):

| Tool | Invocation | Result kind |
|---|---|---|
| Vitest | `vitest run --reporter=json --outputFile=<run>/vitest.json [files…]`; targeted: `vitest related --run <files>` | test |
| Jest | `jest --ci --json --outputFile=<run>/jest.json [--findRelatedTests <files>]` | test |
| Playwright | `playwright test --reporter=json` with `PLAYWRIGHT_JSON_OUTPUT_NAME=<run>/e2e.json` | test |
| ESLint | `eslint --format json --output-file <run>/eslint.json <paths>` | static |
| TypeScript | `tsc --noEmit --pretty false -p <tsconfig> --incremental false` (build information redirected to the run directory when `composite` requires it) | static |
| Audit | `npm audit --json`; `pnpm audit --json`; Yarn 1 audit reported as `unavailable` | audit |

- **Failure kinds:** `assertion`, `compile-or-import`, `runtime-error` or `timeout`, from reporter fields. Only `assertion` counts as behavioral red (TDD-02).
- **Configuration conflicts:** when a project configuration conflicts with the injected reporter, the result is `adapter-unsupported-config`.
- **Custom commands** from the `commands` setting run as declared, and their results are judged by exit status plus whatever report they declare. If the result cannot be validated against the obligation's kind, it is inconclusive.
- **Standard formats** (PRD Section 3.8.3): normalized test and static results are exported as JUnit XML and SARIF 2.1.0 by `export evidence` (serialization, not parsing). Audit findings are normalized into OSV fields (`id`, `aliases`, package, affected range, severity). R1 collects no coverage; when it does, the export format is LCOV.

### 9.6 Receipt validation

```ts
type Receipt = {
  id: string; obligation: string; kind: CheckKind; stage: "baseline" | "candidate" | "integrated" | "sealed";
  source: "kernel-run" | "manual" | "ci-external";
  checkInputId: string; scope: "targeted" | "full";
  argv: string[]; cwd: string; exit?: number; signal?: string; durationMs: number;
  counts?: { discovered: number; executed: number; passed: number; failed: number; skipped: number; focused: number };
  failures?: Array<{ test: string; kind: FailureKind; message: string }>;   // bounded
  versions: { tool: string; reporter: string; adapter: string };
  rawOutput?: string;                    // run-directory reference; may expire
  status: "pass" | "fail" | "inconclusive" | "flaky"; reasons: string[]; limitations: string[];
};
```

| Question | Failure becomes |
|---|---|
| Did it execute? (exit or signal recorded; process group ended) | `not-executed`, `timeout` |
| Is the output valid and attributable? (the report is in this run's directory, newer than spawn, parsed within limits: 10 MB, depth 64, 2,000 characters per message) | `report-missing`, `report-invalid` |
| Do the exit status and the report agree? | `report-contradiction` |
| Does it satisfy the obligation? (kind-specific, 9.1; duplicate test identities make the population ambiguous, so the receipt is inconclusive) | `population-mismatch`, `zero-tests`, `focused-tests` |
| Is it still valid? (check-input identity, 8.8) | `stale` |

Reports are untrusted. Paths in them must resolve inside the workspace or the run directory, and embedded text is treated as data. A model-written summary is never a receipt (EVD-12).

### 9.7 Locks

- **Lock manifest:** project-level (`state.locks`, 7.2) for **acceptance test files**, so those locks outlive the contract that created them and are never evicted (PRD Section 5.15).
- **Support inputs** (helpers, fixtures, snapshots, runner configuration and environment files an acceptance test depends on) are locked **during the contract** that declared them. After it finishes, a change to a support input is not a blocker for later work; instead, every acceptance obligation that depends on it reruns at the next boundary, and the review manifest lists the support-file diff for the Reviewer. This keeps later contracts free to extend shared helpers while still catching a weakened setup.
- **Changes:** any change to a locked file without a disposition is a **blocker** (a weakened setup can disable a test as effectively as a weakened assertion). Dispositions can cover a batch of mechanical edits (INT-06). The review manifest lists changed locked files for the Reviewer.
- **Why not test blocks or "additions only":** a block-level lock needs a JavaScript-aware lexer, which would be an integrity risk if it misread syntax. An "additions are always safe" rule fails because an added `vi.mock` or `beforeEach` can disable every existing test. Whole files plus new files for new examples (9.2) avoid both. Finer granularity waits until false lock violations are measured (TD-11).

### 9.8 Baselines

- **In place (the normal path, EVD-04):** acceptance tests are written before production changes. `check --stage baseline` verifies that the only changes since the start snapshot are test files and declared scaffolding, then runs **the acceptance obligations and the targeted checks of the modules in scope**, and compares the results with their declared baseline expectations. Broader obligations are not run on the baseline, so baseline cost stays proportional to the change (PRD Section 4.4.2). Human edits present at the start are part of the baseline, by definition.
- **Sealed baseline (Beta, EVD-04):** when a broader check fails on the candidate and no baseline record exists, the failing obligation is rerun on the start HEAD outside the workspace:
  1. Materialize the start tree through a temporary index: `GIT_INDEX_FILE=$tmp git read-tree <start HEAD>`, then `git rm --cached` of excluded paths in that index, then `git checkout-index -a --prefix=<run dir>/sealed/`. This writes nothing into the user's Git directory, honors no `export-ignore` or `export-subst` rewriting, and never materializes excluded content, even content committed in history.
  2. Overlay the declared test files and scaffolding.
  3. When the lockfile is identical, link `node_modules` with one directory symlink and point the known cache locations (`TMPDIR`, the Vite cache directory, the Playwright output directory) into the run directory. Otherwise `sealed-deps-unavailable`.
  4. Run only the failing obligation; compare test populations between baseline and candidate before classifying.
  5. Remove the directory (or leave it to the run-directory cap if the kernel crashes).
- **Classification:**

| Sealed result at start HEAD | Start tree | Classification |
|---|---|---|
| Fails the same way | Any | Pre-existing |
| Passes | Clean | Introduced |
| Passes | Dirty | `classification-unknown`: the user's uncommitted start edits may be the cause; the user can exclude it or treat it as introduced |

  The sealed tree is source isolation, not a sandbox, and the shared `node_modules` is disclosed as a limitation. When the populations differ, or anything else makes the two runs incomparable, the classification is `classification-unknown`. If OS temp is not writable, the classification is unknown (TQ-04).

### 9.9 Flaky classification

When a required test fails, the **whole obligation** is rerun with the same inputs, up to 2 times, counted as Tenet-launched checks. A pass after a failure marks the receipt `flaky` (PRD Section 4.4.1). Isolated reruns of single failing tests are diagnostic only and never evidence.

### 9.10 UI evidence

The starter's Playwright helper writes a screenshot per confirmed example journey into the run directory, at most 5 per contract and 400 KB each. The result references them by path, and the coordinator can show the live app with the host's browser tools (RES-05). Screenshots are presentation, not evidence, and are never stored in `.tenet/`; once the run directory expires, the result says so. The UX Spec decides how they are shown.

### 9.11 Dependency verification (SEC-05)

A dependency change is one governed flow, started by `decide {request: dependency, specs}`, and verification happens **before** anything installs:
1. **Snapshot** `package.json` and the lockfile.
2. **Resolve without installing:** `npm install --package-lock-only --ignore-scripts <specs>` (or `pnpm install --lockfile-only`), a consented remote read that writes only those two files. The lockfile diff gives the population: new or changed direct dependencies and the transitive packages the diff adds.
3. **Check each package:**
   - it exists and resolved (implied by the lockfile entry and its integrity hash);
   - publish age against `dependency_policy`, including `unknown_age` and `urgent_exception`, using `npm view <pkg>@<ver> time --json`, cached per package version for the contract;
   - license, from the lockfile entry, against the recipe's allowed list;
   - install scripts, from the lockfile's `hasInstallScript`, need consent.

   There is no name-similarity heuristic and no age floor beyond the configured policy.
4. **Preview** the result as the decision's question. If the user rejects it, or any check fails, both files are restored from the snapshot (`dependency-rejected`).
5. **Install** after acceptance with `npm ci --ignore-scripts` (or the pnpm equivalent), run approved scripts with `npm rebuild <pkg>`, then re-probe readiness. Installs are effects (7.4).
6. **Installs that bypassed Tenet:** a lockfile or `node_modules` change that no verification explains yields `dependency-unverified`. The packages are verified after the fact, and the result says that install scripts may already have run.

### 9.12 CI evidence (EVD-14, Should, R1)

- **Import:** when the user asks and `gh` is available, `check --import-ci` reads the run for the candidate's commit through `gh run list` and `gh run view --json` (a consented remote read) and downloads its JSON reports.
- **Classification:** R1 records imported results as `ci-external` only. The `ci-protected` label needs verification of branch protection and workflow integrity (PRD Section 5.3.5), which is deferred until a protected-branch fixture exists, because interpreting protection settings the plugin does not own would be the first thing to break.
- **Without `gh`,** the capability is reported unavailable.

---

## 10. Git

All Git calls go through `git-cli` with argument arrays, `GIT_TERMINAL_PROMPT=0` and `--no-pager`; read-only calls also set `GIT_OPTIONAL_LOCKS=0`. Unborn repositories use the empty tree wherever HEAD would be used.

### 10.1 Start snapshot

`open` records, writing nothing to Git (PRD Section 5.12):
- HEAD (or unborn) and the branch;
- the index, as only the entries that differ from HEAD (`git diff --cached --raw -z`), so the record's size depends on what is staged, not on the repository;
- `status --porcelain=v2 -z --untracked-files=all`, with exclusions as pathspecs (9.4);
- each dirty file's content hash, computed in Node (excluded paths record their stat only).

### 10.2 Attribution (file level)

| File at start | Changed since? | Explained by a declaration or a hook observation? | Attribution |
|---|---|---|---|
| Clean or absent | Yes | Yes | Tenet's |
| Clean or absent | Yes | No | Unexplained: a question at the next boundary (possible human edit) |
| Dirty | — | — | Human's. Never staged unless the user chose "include in scope", which commits the whole file with consent. If Tenet must edit it, the user decides first: the file contains both human and Tenet changes, so Tenet stops and asks (PRD Section 5.12) |
| Untracked | — | — | Human's |

**Last-check rule:** at `commit` and `finish`, every Tenet file's current hash must equal its hash at the last successful `check`.
- A difference means the evidence is stale anyway, so the commit is refused and a check is requested.
- If the coordinator reports no further edits, the difference is treated as a possible human edit and becomes a question.

This catches human edits made after the last check. Without observer hooks, a human edit to a file the agent was editing *before* that check cannot be told apart, and that residual is disclosed: attribution is "detected plus cooperative" (2.3). With observer hooks (4.7), every agent-tool edit carries its path, so a change the hook never saw is a possible human edit, and the residual shrinks to edits made through the terminal. *Rule either way:* commit only after the host's pending agent edits are kept; an edit the user undid shows up as drift.

### 10.3 Commit protocol

`finish` commits automatically when the candidate is uncommitted; `commit` makes a checkpoint commit mid-contract, so phase boundaries are recoverable (WRK-10).

1. **Preconditions:**
   - the repository state allows commits (10.8);
   - the receipts are fresh;
   - the Tenet file set is non-empty;
   - **consent** exists for the current hook, filter and signing configuration hash (one question per project per configuration, 7.2). The hook list is inspected first: `core.hooksPath`, the hooks directory, and husky, lefthook, simple-git-hooks and lint-staged configuration.
2. **Stash-using hook manager** (for example lint-staged) present *and* human-dirty files present: ask **before** step 4, or proceed under a project-level consent that covers this case.
3. **Build:**
   1. `GIT_INDEX_FILE=$tmp git read-tree HEAD` (or `read-tree --empty`);
   2. `GIT_INDEX_FILE=$tmp git add -- <tenet files>` (and `git rm --cached` for deletions);
   3. record `expectedTree = GIT_INDEX_FILE=$tmp git write-tree`.

   Mutating flows may write Git objects; stateless ones never get here.
4. **Message:** the coordinator drafts the subject following the project's visible convention (it reads `git log`); the kernel checks the length and appends the `Tenet-Work` and `Tenet-Req` trailers (configurable).
5. **Effect intent** (7.4) with the old HEAD, `expectedTree` and the message. Then `GIT_INDEX_FILE=$tmp git commit -m <message>`; hooks run normally. Hooks inherit the temporary index, so they cannot change the user's index.
6. **Verify the actual commit and the working tree:**
   - its parent is the old HEAD;
   - its changed paths are a subset of the Tenet files;
   - no non-Tenet path changed in the working tree during the commit (inventory before and after).

   If a hook committed a foreign path or changed a non-Tenet file, the commit is **kept and reported** with `hook-staged-foreign-path` (exit 3). Moving the branch back would not undo the hook's other side effects, so the question offers: keep the commit as it is, or move the branch back to the old HEAD (`git update-ref`, working tree untouched) after the user reviews the diff. If the commit tree differs from `expectedTree` only on Tenet files (hooks reformatted them), the dependent evidence is stale and the affected obligations rerun before any claim.
7. **Index sync:** for each committed path whose user index entry still equals the old HEAD's entry, update it to the new blob (`git update-index --index-info`). Any other entry was already excluded by step 1, because staged human content makes a file dirty at start. Before writing, the kernel re-reads the index and stops if it changed during the commit.
8. **Effect result;** publish the state.

**Failures:** hook failure, unavailable signing and missing identity leave the candidate uncommitted, with `hook-failed`, `signing-unavailable` or `git-identity-missing` (GIT-15). Hooks are never bypassed and signing is never disabled. The endpoint then says "working tree, uncommitted".

### 10.4 Integration

Integration uses normal Git operations, never direct reference edits on a checked-out branch:
- **Branch switch disclosed:** the editor follows HEAD, so before switching, `integrate` returns a `branch-switch-needed` question ("this switches your editor to `<base>`") unless the `integration` setting is `auto-on-accept`.
- **Fast-forward:** `git switch <base>` (Git refuses if local changes conflict, or if the base is checked out in another worktree; both are reported), then `git merge --ff-only <work>`. The tree is unchanged, so receipts remain valid by identity (8.8).
- **Base moved:** `git merge` following the project's convention (merge commit, or rebase and fast-forward for linear-history projects), only when no human-dirty path is in the merge. Conflicts stop with a question. The integrated tree is a new candidate, so `check --stage integrated` runs before it is described as checked (PRD Section 4.5.2).

### 10.5 Undo

Undo is the **inverse of the work's commits, applied against current state**, so later human changes survive (GIT-04):
1. **Locate** the work's commits by the `Tenet-Work` trailer (or by patch identity after a squash or rebase; ask if uncertain). Merge commits, and history that is not available (shallow clones), stop with an explanation.
2. **Plan progressively:** in a temporary index seeded from HEAD, apply each commit's inverse (`git diff --binary -M <commit> <commit>^ -- <paths>`), newest first, with `git apply --cached`. Each step applies to the result of the previous one, so several commits touching the same lines are handled. Renames, modes and binary files come with Git's own patch format. Every affected path must be clean in the working tree, otherwise ask.
3. **Preview** the combined inverse (HEAD versus the temporary index's tree). A step that does not apply means a later change overlaps Tenet's, so undo stops with `undo-conflict` and shows the overlap; it never falls back to restoring old file contents.
4. **Apply** after confirmation: the combined patch to the working tree only (never `--index`, so the user's index is untouched), as an effect.
5. **Check, then commit:** run the applicable checks on the reverted tree, then commit through Section 10.3, which reruns anything hooks change. If checks cannot run, the revert stays uncommitted and is reported as unverified. A clean revert is not proof that later human behavior still works.

After integration, undo applies to the base branch. Database and external effects are out of scope for undo (PRD Sections 5.12 and 5.13).

### 10.6 Remote actions (GIT-05)

- **Explicit request only:** `publish push` or `publish pr` runs only after the user asks. `decide {request: remote}` binds the remote URL, the branch and the exact commit, and the approval-mode gate applies (11.4). `publish` refuses if any of the three changed since.
- **Push:** `git push <remote> <commit>:refs/heads/<branch>`, an effect reconciled with `git ls-remote`.
- **Pull request:** the kernel renders the PR brief (GIT-06). If `gh` is available, `publish pr` runs `gh pr create` as an effect. Otherwise the coordinator creates the PR with whatever native GitHub tool the host offers, or the user pastes the brief, and the PR is recorded as `reported` and reconciled by a remote read.
- Remote merges stay with the user.

### 10.7 Branches, trailers and cleanup

- **Branch names:** `tenet/w-0007-<slug>`, from the current HEAD; stacking on an unintegrated work branch is stated.
- **Trailers:** `Tenet-Work` and `Tenet-Req`; configurable, and can be turned off.
- **Cleanup:** after integration or abandonment, Tenet offers `git branch -d`; deleting unmerged branches needs explicit consent (GIT-14).

### 10.8 Repository state detection

| State | Detection | Outcome (GIT-13) |
|---|---|---|
| Unborn HEAD | `rev-parse HEAD` fails | Empty-tree paths; first commit after the init choice |
| Detached HEAD | `symbolic-ref -q HEAD` fails | Offer a branch; otherwise read-only |
| Rebase, merge or cherry-pick in progress | Markers in the Git directory | Read-only |
| Conflicts | Status entries of type `u` | Read-only |
| Shallow clone | `rev-parse --is-shallow-repository` | Allowed; undo limited to available history |
| Submodules | `.gitmodules` | Edits inside submodules unsupported |
| LFS | `filter=lfs` in attributes | Needs LFS installed and filter consent (9.4) |
| Linked worktree | `--git-common-dir` differs from `--git-dir` | Experimental; ownership scoped to the worktree; approval mode inferred as Allow all (11.4) |

### 10.9 Prototypes without Git

A non-Git folder gets a **shadow repository** in `.tenet/git`, used as `git --git-dir=.tenet/git --work-tree=<folder>` (GIT-01, PRD Section 5.12). The same `git-cli` adapter serves both cases, so inventory, attribution and undo have one implementation.
- **Snapshot:** `open prototype` commits the folder's starting content, and every `check` commits again. The shadow repository's `info/exclude` holds the exclusion patterns plus `node_modules/`, build outputs and the folder's own `.gitignore` rules, so secrets and dependencies are never copied. Snapshots are content-addressed, count against the `.tenet/` budget, and larger than 20 MB are refused with `snapshot-too-large`, offering `git init` instead (PRD Section 5.15).
- **No pre-edit step:** because each check snapshots, no verb has to be called before an edit. Edits since the last check are also covered by the host's edit checkpoints within the chat.
- **Undo:** for each path, restore the snapshot content only if the current content equals what the last snapshot recorded; delete created files only on the same condition. Otherwise ask, so later human edits are preserved. Snapshots are never presented as checked recovery.
- **Promotion** to checked work requires a real repository (`decide` with the init choice), and then follows the promote profile (12.10). The shadow repository is then removed.

---

## 11. Security

### 11.1 Trust zones

| Zone | Contents | Trusted for |
|---|---|---|
| User and host | Chat, host approvals, elicitation answers | Authority |
| Tenet payload | Plugin files and the kernel bundle (payload hashes checked at start; release provenance) | Running Tenet logic |
| Workspace content | Source, docs, reports, `INTENT.md`, quarantined `.tenet/` | Data only; adopted structural restrictions only (8.5) |
| Host context | Host memory, host plans, session todos, other plugins' instructions | Context only; never requirements, grants or plan items (CFG-09) |
| Check processes | Tests, linters, servers, hooks | Nothing; run under declared envelopes |
| Remote | Model traffic (host-managed), registries during consented reads and installs | Nothing beyond the host's controls |

### 11.2 Kernel hardening

- **Inputs:** zod validation with size and depth limits; no `eval`, `Function`, `vm` or dynamic import.
- **Preloads:** cleared by the launch command, and reported if one reaches the kernel by another path (4.5).
- **Paths:**
  - `realpath` resolution, restricted to the workspace, the run directory and the user directory;
  - a symlinked `.tenet/`, or symlinks inside it, are refused;
  - comparison is case-insensitive on case-insensitive volumes.
- **Processes:** no shell; argument arrays; reduced environment; process groups; timeouts; output limits.
- **Execution:** only registered obligations and fixed Git and package-manager commands are run; there is no generic execution verb.
- **Secrets:** excluded files are never read and never passed to Git commands; only their stat is recorded.
- **Kernel location:** the kernel runs only from the plugin or the pinned copy in the user directory, never from the workspace (4.5).

### 11.3 Secrets, exclusions and redaction

- **Default exclusions** (PRD Section 5.10.2) are path patterns, extended with `.env.local` and `.tenet/`.
- **Where the kernel enforces them** (deterministic): inventory and Git pathspecs, manifests, exports and check environments.
- **Agent file tools:** where the host honors exclusions they follow them; otherwise the exclusions are cooperative and disclosed, and the Reviewer's instructions repeat them (SEC-08, TQ-08).
- **Redaction:** token patterns (cloud keys, `ghp_`, `gho_`, `github_pat_`, Slack tokens, private-key headers, `Authorization:` and `Cookie:` values, `password=` pairs) are removed from everything displayed, logged or exported. The output states that detection is incomplete.

### 11.4 Authority, approval modes and containment

- **Decision binding:** every answer binds to its question's `factsHash` (6.6). If the facts behind a question changed while the user was deciding, the question is asked again; unrelated changes never force reconfirmation.
- **Capture:**
  - on the command line, decisions are `reported` (cooperative);
  - through MCP elicitation, `elicited`, only if SP-12 shows the kernel itself receives the answer;
  - the grant records which (2.3).

  A golden-task trap calls `decide` with a quote that never appeared in the conversation, to measure this residual.
- **Authority questions go to chat.** Questions about widening scope, remote actions, destructive actions, risk acceptance and owner acceptance have `channel: chat`: the coordinator asks in plain chat and ends its turn. Autopilot answers the host's blocking questions automatically, so a native question cannot show that a person answered. [SPIKE: SP-12] observes what Autopilot does with an ended turn and with elicitation (TQ-17).
- **Approval mode:** recorded only from a reliable host signal, never inferred from prompts appearing or not. The host documents none today, so the mode stays `unknown`, with one deterministic exception: in a linked worktree the host always uses Allow all, so the mode is recorded as `allow-all (inferred)`. When the mode is auto-approve or unknown, remote mutation, project-content egress and destructive actions get a chat question first (SEC-13). The per-verb approval snippet (4.6) makes the host's own approval apply to those verbs in Manual mode.
- **Autopilot:** it cannot be detected. The README states that under Autopilot every Tenet decision record is unverifiable, and `controls[]` labels authority capture accordingly.
- **Containment** is recorded separately and never inferred from the approval mode. The Local harness has no host sandbox. A denied kernel write outside the workspace is recorded literally (`outside-write-denied`); it could be an ordinary permission failure, so it is never reported as a named sandbox.
- **Spending (RSC-03):** the kernel never calls billing, purchase or model-routing interfaces, and never changes the host's model, reasoning effort or billing route. When the host stops responding or reports a usage limit, the coordinator records `stop pause` with `host-limit`, the handoff is already current (5.2), and Tenet never suggests overage, another account or another paid route.

### 11.5 MCP front-end (if selected)

- **Surface:** three tools (`tenet_read`, `tenet`, `tenet_findings`) with schemas derived from zod and honest annotations (4.5); no resources, prompts or sampling; stdio transport only.
- **Behavior:** the same pipeline and checks as the command line, with no extra permissions. Protocol conformance comes from the official SDK.
- **Disclosure:** the README states that plugin MCP servers are trusted at install, lists the tools, and states that none runs arbitrary commands or opens network connections of its own (PRD Section 5.7.1).

### 11.6 Threat-to-control map

| PRD threat (Section 5.5) | Control |
|---|---|
| "Owner approved" text in files | Authority only from `decide`; repository text is never parsed as authority |
| Host memory or plans carrying unadopted instructions | Untrusted context (11.1); kernel obligations override them (5.2) |
| Look-alike plugin | Payload hashes and publisher in `inspect doctor`; README verification |
| Weakened or edited locked tests | Whole-file locks with support inputs, as blockers (9.7); new examples in new files |
| Loosened shared policy | Structural trust comparison (8.5) |
| Pre-populated or copied `.tenet/` | Marker identity and quarantine (7.5) |
| Forged or stale reports | Run-bound report paths; validation (9.6) |
| Compromised release | Release chain (18); CI tiers (17.6) |
| Unclear actor | Log records with work, role and generation (16) |
| Secrets to models, Git or exports | Exclusions as Git pathspecs (9.4); redaction (11.3); reduced environment (9.3) |
| Kernel replaced by a workspace file; preloaded modules | Kernel never runs from the workspace; the launch command clears preloads; the approval snippet names the exact kernel path (4.5, 4.6, 11.2) |
| Telemetry added by generated code | Reviewer rubric; SEC-09 findings |
| CI secrets exposure | Untrusted tier without secrets (17.6) |
| Retry loops | Budgets and failure signatures (8.6) |
| Hostile reports | JSON limits; untrusted text (9.6) |
| Path traversal, symlinked `.tenet/` | Path hardening (11.2) |
| Hooks and filters | Inspection and consent; foreign-path detection with a reviewed recovery (10.3, 9.4) |
| Auto-approved remote actions; Autopilot | Chat questions; per-verb host approval; disclosure (11.4) |
| Benign-named command with network or credential access | Envelope disclosure and question (9.3) |
| Typosquatted or scripted dependencies | Verification before install (9.11) |
| Silent spending or paid-route changes | No billing or routing calls; `host-limit` stop; usage never invented (8.6, 11.4) |
| Implicitly trusted MCP front-end | Kernel-only tools; official SDK; disclosure (11.5) |

---

## 12. Starter recipe (TypeScript web/API)

### 12.1 Stack

Versions are pinned in the recipe lockfile at Tech Spec approval and refreshed monthly (QLT-16).

| Concern | Choice |
|---|---|
| API | Fastify 5 with `fastify-type-provider-zod` |
| Validation | Zod schemas in `shared/`, a runtime module with no server code: the server validates requests and serializes responses with them, and the client reuses them for forms |
| API contract | `@fastify/swagger` generates OpenAPI from the same schemas, which the `public-api` trait's compatibility checks compare across changes |
| Security plugins | `@fastify/helmet`, `@fastify/cookie`, `@fastify/csrf-protection`, `@fastify/rate-limit` |
| Persistence | `better-sqlite3`; WAL mode; `foreign_keys = ON`; plain numbered SQL migrations with a small runner |
| Passwords | Asynchronous `crypto.scrypt` (N=2¹⁵, r=8, p=1, maxmem 64 MB; never the synchronous form) with `timingSafeEqual`; concurrency bounded by the sign-in rate limit and the libuv thread pool |
| UI | React 19, Vite, React Router |
| Tests | Vitest (unit, integration through `app.inject`), Playwright with `@axe-core/playwright`, Node workload script |
| Static checks | TypeScript strict, ESLint flat configuration (including the `complexity` rule) |
| CI template | GitHub Actions running the same obligations (GIT-07) |

`better-sqlite3` downloads a prebuilt binary during install, and Playwright downloads a browser. Readiness discloses that both need network access, checks that a prebuilt binary exists for the platform and Node version (otherwise that `xcode-select -p` finds the command-line tools a source build needs), and the hardening notes cover proxy and offline installs.

### 12.2 Scaffold flow (J-02)

1. `open feature` on an empty folder: assistance level L4 for the starter. The init choice is asked (GIT-01).
2. `decide` records the basis and the plan for the first increment.
3. The kernel writes the template from the recipe skill into the workspace (an effect, 7.4), substituting the project name.
4. **Install** is one consented effect: verification (9.11; the template's dependencies are pre-verified at each recipe release, so this is fast), `npm ci --ignore-scripts` and the approved `npm rebuild better-sqlite3`. The Playwright browser is installed later, at the first `e2e` obligation, and only if it is not already present, so the first increment is not delayed by a large download.
5. **Verify the scaffold:** `check` runs the template's own tests, lint and types, so the first commit has fresh receipts.
6. **First commit:** the scaffold, through Section 10.3.
7. Normal Standard flow for the first plan item.

### 12.3 Project layout

```text
server/src/app.ts              buildApp(config): plugins, features, error handler
server/src/server.ts           listens on 127.0.0.1:${PORT:-3000}; prints development credentials at startup
server/src/platform/           config · db · migrate · backup · auth · session · errors · logging · health
server/src/features/<f>/       the feature's module(s) · *.test.ts · *.acceptance.test.ts
server/migrations/NNNN_*.sql
server/test/fixtures/prior/    builders for databases at each earlier schema version
shared/                        runtime API schemas (no server code)
web/src/{app, features/<f>, lib/api.ts}
e2e/                           Playwright journeys tagged with example IDs
workload/                      reference workload script
docs/                          architecture.md · hardening.md · decisions/ · a11y-checks.md
```

Layers: UI → HTTP schemas → services (operations and invariants) → repositories (SQL) → database. Features own their vertical slice; `platform/` holds shared infrastructure behind small functions, not frameworks. **The split into routes, schemas, service, repository and policy files is a pattern, not a rule:** a small feature may be one module plus tests, and a file is split out when there is a reason (reusable validation, nontrivial domain logic, complex SQL, authorization, or an independent change boundary).

### 12.4 Security decisions

The starter must demonstrate persistence, validation, and server-side object and role authorization (QLT-01), under the identity and exposure model of PRD Section 5.16 (QLT-12), so these parts are always present:

| Topic | Decision |
|---|---|
| Development identities | The first run seeds synthetic users (an admin and a member) with per-project random 24-character passwords, written to `.env.local` (gitignored; matches the default `.env.*` exclusion) and **printed at server startup** to the terminal on stderr, outside the structured logger (PRD Section 5.16). They never appear in kernel responses, traces or manifests; the kernel records only the file's stat |
| Sessions | `sessions` table with 256-bit random IDs; signed `HttpOnly`, `SameSite=Lax` cookie; rotated on sign-in; **all sessions revoked on password change**; 8-hour idle and 7-day absolute expiry; sign-out deletes the row; an invalid session returns 401 and clears the cookie |
| CSRF | The token is bound to the session row; anonymous pages get a pre-session token cookie for sign-in; required on every state-changing request |
| Authorization | `policy.ts` exports `can<Action>(actor, resource)`; route `preHandler` enforces it; repositories scope by owner where the domain requires; object-level denial tests |
| Abuse | Sign-in limited to 5 attempts per minute per IP and account; scrypt work bounded by the rate limit; body and pagination limits; a 5-second request deadline |
| Errors and logs | Problem-style JSON without stacks or SQL; pino redaction of cookies, `authorization` and password fields |
| Exposure | API on `127.0.0.1`; Vite dev server on `127.0.0.1:5173`, proxying `/api` to the API, so the browser stays same-origin. The user opens `http://127.0.0.1:5173`. Any other binding is a consequential change recorded in `docs/hardening.md` |

### 12.5 Data, contention and backup

- **Contention policy:**
  - `busy_timeout = 250 ms` (short, so a blocked lock never stalls the event loop for long);
  - writes that protect invariants use `db.transaction(...).immediate()`;
  - on `SQLITE_BUSY`, retry with jitter up to a total of 1 second, then return HTTP 503 "try again".

  The workload measures event-loop delay with `perf_hooks.monitorEventLoopDelay`, including an external writer holding the lock, against the PRD Section 5.16 latency target of p95 ≤ 200 ms (12.7). A 250 ms busy wait can exceed that target for affected requests, so the measurement decides whether the value stands. Workers or another persistence layer are considered only if it fails, through the repository seam in `platform/db`.
- **Invariant test (no double booking):** **separate processes**, each with its own connection, race 5 reservations on one item against the same database file; exactly one must succeed. This exercises the transaction, unlike concurrent HTTP calls into one synchronous connection, which would pass even without it.
- **Migrations:** forward-only, each in its own transaction, recorded in `schema_migrations` with its checksum (a changed checksum for an applied migration stops startup); a failed migration rolls back and stops. Each has a prior-version fixture builder; tests migrate the fixture and assert the data is preserved and `PRAGMA foreign_key_check` is clean (QLT-07).
- **Backup:** before migrating a database that contains data, `db.backup(<path>)`, then `PRAGMA integrity_check` and a schema-version check on the copy.
- **Restore** (`npm run db:restore -- <file>`):
  1. take exclusive ownership: the server holds `<db>.server.lock` (its process ID and start time) while running and refuses to start while `<db>.restore.lock` exists; restore creates `<db>.restore.lock` and refuses while a live server lock exists. A database transaction cannot prove this in WAL mode, because a server can keep connections open;
  2. validate the backup (integrity, schema version compatible with this code);
  3. move the current database and its `-wal` and `-shm` files aside;
  4. copy the backup into place;
  5. open it and verify;
  6. on any failure, put the original back.

  A restore test exercises every step.

### 12.6 UI

- **States:** data hooks expose `loading`, `empty`, `error`, `denied`, `conflict` and `success` (QLT-14). Forms keep input on error and block repeated submission.
- **Accessibility:**
  - semantic HTML and labels;
  - focus moves to the page heading on navigation and to the error summary on failure;
  - `aria-live` status messages;
  - axe checks in every journey;
  - keyboard-only coverage of the critical journeys.

### 12.7 Testing, accessibility and workload

| Script | Obligation | Kind | Category (9.2) |
|---|---|---|---|
| `test:unit`, `test:int` | `unit`, `integration` | test | `candidate` (targeted), `boundary` (full) |
| `e2e` | `e2e` (Playwright `webServer` with `PORT`, `DATABASE_URL` and `TENET_RUN_TOKEN`) | test | `affected` |
| `a11y` | `a11y` (axe plus keyboard journeys, inside the same Playwright run, producing its own receipt) | test | `affected` |
| `lint`, `typecheck` | `lint`, `types` | static | `candidate`, `boundary` |
| `audit` | `audit` | audit | `boundary` when dependencies changed |
| `workload` | `workload` | workload | `release` |
| Screen-reader check | `a11y-manual` | manual | `manual-affected` |

- **Screen-reader procedure:** VoiceOver with Safari on macOS, over each changed critical journey (sign in, browse, reserve, return, admin overview) and its states. The observer records pass or fail per step in `docs/a11y-checks.md`, and the result is recorded with `decide` as a `manual` receipt (QLT-03). Release qualification covers every critical journey.
- **Workload protocol:**
  - seed the PRD Section 5.16 data;
  - start the production build of the API (not the dev server);
  - 30 seconds of warm-up, then 2 minutes;
  - 20 concurrent clients running a 70/20/10 mix of list, reserve and return;
  - a 5-way same-item reservation burst every 10 seconds;
  - at least 5,000 samples.

  It reports p50, p95 and p99, error rates, peak RSS and event-loop delay, and passes when the PRD Section 5.16 targets hold with zero double bookings. Trends are reported across changes (QLT-05).

### 12.8 Observability

- **Logs:** structured JSON with request IDs.
- **Health:** `/api/health` returns `{status: "ok"}`, plus the run token only when `TENET_RUN_TOKEN` is set.
- **Errors:** the problem response carries the correlation ID.

### 12.9 Hardening inventory and licensing

- **`docs/hardening.md`** starts with these items, and every prototype or shortcut adds to it (QLT-17):
  - development-only identities;
  - local binding;
  - no TLS;
  - the SQLite single-node envelope;
  - no email;
  - no backup schedule;
  - production secrets;
  - the deployment checklist.
- **Licensing:** the starter template is licensed MIT-0 (provisional under Q-03), so generated projects can use any license. A `THIRD_PARTY_NOTICES` file lists template dependencies (OSS-04).

### 12.10 Brownfield, promotion and recipe upgrades

- **Brownfield TypeScript projects** are never converted to the starter. The adapter discovers commands and runners (9.5), traits are inferred from the change and confirmed (QLT-11), and missing capabilities lower the assistance level.
- **Prototype promotion** (`open promote`, WRK-07):
  1. inventory the shortcuts in `docs/hardening.md` as proposed requirements and constraints;
  2. characterize existing behavior with preservation tests (TDD-04);
  3. add distinguishing tests for each missing safeguard;
  4. require a fresh-context review before checked-local.
- **Recipe upgrade** (`open recipe-upgrade`, QLT-15): the project record holds the recipe version used. The kernel computes the template diff between that version and the current one and tests it per file with `git apply --check`; files where it applies cleanly are proposed, and files where it conflicts with project-owned changes are listed for the user. Changed obligations and their categories are shown. Accepted parts become an ordinary Standard contract.

---

## 13. Extension contracts

### 13.1 Host binding

A host binding supplies:
- a capability descriptor and its retirement rows (4.4);
- a mapping from Tenet's logical tool sets to host tool names;
- agent and command files generated from shared templates;
- a front-end choice;
- a qualification record per tuple.

It qualifies when the deterministic tier runs through its front-end and the native-host suite passes on its tuple (PRD Section 3.8.6). The command-line front-end needs only a shell, so a portability smoke run on the Copilot harness (SP-01) and the Copilot CLI (SP-09, R1.1) is cheap; it informs R1.1 and qualifies nothing.

### 13.2 Ecosystem adapter

```ts
interface EcosystemAdapter {
  id: string; version: string; supported: Record<string, string>;      // tool → supported version range
  detect(ws: WorkspaceView): { applies: boolean; toolchain: Record<string, string>; packageManager?: string; reasons: string[] };
  readiness(ws: WorkspaceView): ReadinessItem[];
  tools: ToolManifest[];                                               // data: detection, invocation, report path, timeout
  normalize(kind: CheckKind, format: string, raw: unknown): Normalized; // pure, per reporter format
}
```

Adapters are bundled modules, never loaded at runtime. Context selection is the host's job (8.7), so adapters have no import or reference analysis. Conformance fixtures cover detection and non-detection, every failure kind, hostile reports, population mismatch, timeouts and unsupported versions.

### 13.3 Recipe manifest

```json
{ "recipe": "ts-web-api", "version": "1.0.0", "owner": "<maintainer>",
  "stack": { "node": "^22.12.0 || ^24.0.0", "packageManager": "npm" },
  "templateTraits": ["ui", "persistence", "auth", "public-api"],
  "obligations": [
    { "id": "unit", "category": "candidate" }, { "id": "integration", "category": "candidate" },
    { "id": "e2e", "category": "affected" }, { "id": "a11y", "category": "affected" },
    { "id": "a11y-manual", "category": "manual-affected" }, { "id": "lint", "category": "candidate" },
    { "id": "types", "category": "candidate" }, { "id": "audit", "category": "boundary" },
    { "id": "workload", "category": "release" } ],
  "scaffold": { "template": "template/", "install": ["npm", "ci", "--ignore-scripts"], "approvedScripts": ["better-sqlite3"] },
  "e2e": { "port": "PORT", "health": "/api/health" },
  "workload": "workload.json", "asvs": "asvs.json", "journeys": "journeys.json",
  "licenses": ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "MIT-0"] }
```

`templateTraits` describe the template itself, which the PRD requires to include authorization (QLT-01). Obligations for a *change* still come from the traits of that change (13.4).

### 13.4 Traits

`traits/<name>.json` declares:
- `applies` (path patterns and dependency names that are tested **against the change**);
- `obligations` to add, each with its category;
- `raises` (risk dimensions);
- `questions`;
- `rubric` items;
- focused or native passes to trigger.

The Markdown file of the same name holds the agent guidance. Composition follows PRD Section 3.8.5.

### 13.5 Front-end contract

Each front-end is a translation into `runVerb` (6.1), with the same zod input schema and the same `KernelResponse`. Front-ends add no verbs, cache no authority and relax no validation. The hook front-end has no verbs at all; it only appends observations (4.7). The deterministic tier runs the verb suite through every shipped front-end.

### 13.6 Registries

Verbs, decision kinds (6.5), check kinds (9.1), adapters (13.2) and traits (13.4) are registries with **explicit static registration** in one list each, never discovered from the filesystem, so shipped behavior is auditable. An entry with side effects declares its operation class, permissions, cancellation behavior and recovery strategy, and runs only through the verb pipeline (6.1). Adding an entry adds a module and its conformance fixtures; small closed sets (for example the three `decide` input forms) stay plain switches. A future minimal recipe without authentication would be a registry addition, not a redesign.

### 13.7 Second ecosystem (Python, R1.1)

The Python adapter (D-24) tests the seams:
- `pytest` with a JSON report plugin, or `--junitxml` converted at the adapter edge;
- `ruff` with JSON output;
- `mypy` with JSON output where available;
- `pip-audit --format json`;
- acceptance test files `test_<req>_acceptance.py`.

It needs no reference analysis, because the host's language services serve Python too. Python projects may not have Node, so the R1.1 qualification documents Node as a Tenet prerequisite there. Any change it forces in core modules is recorded as an architecture finding.

---

## 14. Performance and scalability

### 14.1 Budget map

| PRD budget | Mechanism | Measured by |
|---|---|---|
| Always-loaded ≤ 2,000 tokens | Everything Tenet adds to every request: skill descriptions, agent and command descriptions, the charter (≤ 300), and MCP tool schemas if selected (PA-5); lint on the installed configuration | Every CI run |
| Agent body ≤ 1,000 tokens; ≤ 12,000 Tenet tokens loaded per Standard task | Loop in the agent body; one phase skill at a time (5.1) | Lint; golden tasks |
| Skill ≤ 5,000 tokens | Resources split out; lint | Every CI run |
| Assignment ≤ 20,000 tokens, instructions included | Manifests that index instead of copying (8.7) | Manifest token estimates in the log; AC-19 |
| Bookkeeping p95 ≤ 300 ms warm, ≤ 1 s cold | Small state document; `git status` without lock writes; no full scans on read-only paths | Benchmarks of `open`, `decide`, `findings` and `finish` on the 10,000-file fixture |
| Check execution | Obligation timeouts; applicability categories (9.2); baseline limited to acceptance and targeted checks (9.8); targeted runs in inner loops; obligations run serially unless the recipe declares them independent (no shared database, port, output or cache), then up to min(3, cores ÷ 2) in parallel | Receipt durations; PRD Section 4.4.2 overhead |
| `.tenet/` ≤ 50 MB | No raw output or screenshots inside; snapshot cap; eviction (7.6) | Long-history fixture |
| Resume ≤ 2 min | Handoff at 80% and at boundaries; reconciliation reads one document plus the log tail | AC-08 |

### 14.2 Hot paths

- **`open`:** lock, read the state document, scan the log tail for unreconciled effects, run `git status` and `ls-files` with exclusion pathspecs, then publish.
- **Inventory:** reads no content for clean tracked files; hashes only dirty and untracked files.
- **Manifests:** read the diff and state only; the Reviewer reads files on demand.
- **Expensive work** (eviction sweeps, archive compaction) is bounded to 300 ms per call and resumes on the next call. Expensive bookkeeping is never reclassified as check execution to escape the budget.

### 14.3 Storage model (estimate)

| Item | Size |
|---|---|
| Active contract in the state document | 10–30 KB (the start snapshot holds only differences from HEAD) |
| Archived contract blob | 5–20 KB compacted |
| Prototype snapshots | At most 20 MB per prototype, deduplicated by content |
| Log | About 300 bytes per record; monthly summaries after 90 days |
| Run directories (outside `.tenet/`) | Raw output up to 1 MB per failing run; screenshots up to 400 KB each; 200 MB per project cap |

This allows about 1,000 archived contracts under 20 MB. Prototype snapshots are the main pressure inside `.tenet/`, and the cap bounds them.

### 14.4 Cost model (token billing)

Since June 1, 2026, most Copilot plans bill model use in AI credits by input, output, cached and cache-write tokens at each model's rate; some annual plans keep legacy premium requests. Cached input costs about a tenth of fresh input, and output costs several times input. Tenet cannot see the bill (8.6), so it controls the drivers it causes:

| Driver | Control | Section |
|---|---|---|
| Responses re-sent with every later request | A loop card of about 400 tokens; disclosure on change; detail on demand | 6.6 |
| Output tokens spent retyping | Answers as flags; manifests passed by path; review results submitted directly (MCP) or captured by hooks | 4.5, 4.7, 5.5 |
| Round trips | About 6 kernel calls per Standard task; `check` writes the review manifest; `finish` commits | 2.4.1, 6.5 |
| Tool schemas on every request | A minimal fixed tool list; three MCP tools, not fourteen | 4.2, 4.5 |
| Always-loaded instructions | Descriptions, agent body and charter within budget; one phase skill at a time | 5.1, 7.8 |
| Cache invalidation | The tool list, model and reasoning effort never change mid-session because of Tenet | 4.8, 5.2 |
| Fresh subagent sessions | Analysts only when a question remains; Reviewer reads a closed list; rechecks use the recheck manifest | 5.2, 8.7 |
| Long histories | Fresh chats at milestone boundaries through the resume packet | 5.2, 5.5 |
| Repeated failure | Diagnostic stops instead of further attempts | 8.6 |

**What the limits do and do not bound:** packet and response limits bound Tenet's own injection. They do not bound what agents read with host tools, total usage, or spending; account budgets and spending controls belong to GitHub and the host (11.4).

**Illustrative scale** (to be replaced by SP-12 measurements): a Standard task on a mid-priced model might read about 500,000 input tokens, most of them cached, and write about 25,000 output tokens, which is on the order of $0.30 to $0.60 of credits. The controls above target Tenet's share of that; Section 17.5 measures it against a native baseline.

---

## 15. Reliability

### 15.1 Crash points

| Crash during | Disk state | Next call |
|---|---|---|
| Writing `state.tmp` | Old `state` intact | Temporary file removed |
| After the `state.prev` link, before the final rename | `state` intact (old revision); `state.prev` equals it | Nothing to repair |
| Holding `lock` | `lock` with a dead process ID | Stale lock broken under the guard (7.3) |
| Holding `lock.break` | `lock.break` whose holder is dead | Removed under the same liveness test; the break is retried |
| After effect intent, before result | Intent only | Effect reconciled to completed, not performed or unresolved (7.4) |
| Between run intent and process record | Run intent without a process ID | Run uncertain; the result says an orphan may exist |
| During a check run | `owner.inCall` with a dead process ID | Recorded process group stopped; run discarded or confirmed per its replay class; `inCall` cleared |
| During index sync | Some entries updated | Recomputed from old HEAD, new HEAD and the current index; completed idempotently |

### 15.2 Failure modes

| Failure | Behavior |
|---|---|
| Git `index.lock` held | Retry 3 times with backoff (100–800 ms), then `git-locked` (exit 2) |
| Disk full | `disk-full` (exit 2); effects already completed are listed |
| Node missing or unsupported | Skills-only advisory review (2.4.7) |
| Preloaded module | `preload-present` (exit 4) |
| State MAC mismatch | `state-modified-outside-kernel` (exit 4); `inspect doctor` explains |
| Corrupt `state` | Fall back to `state.prev` in **diagnostic mode** (`state-recovered-from-backup`): grants are suspended until reconfirmed, receipts are revalidated, and restrictions are re-read from their sources, because an older revision can hold superseded authority |
| Malformed review result | `review-result-invalid` (exit 2); one fresh retry within the delegation budget |
| Hook front-end failure | Observations stop; controls fall back to cooperative labels (4.7) |
| Host usage limit or the model stops responding | `stop pause` with `host-limit`; the current handoff allows resuming later without resetting counters (8.1, 11.4) |
| Kernel bug | Exit 5; effects reported; no further claims |

**Timeouts for operations other than checks:** commit hooks 10 minutes, installs 15 minutes, remote reads 30 seconds, publication 2 minutes. Each timeout leaves the effect uncertain and reconciled (7.4).

### 15.3 Continuity and reconstruction

| PRD Section 5.14 event | Behavior |
|---|---|
| Chat closed; window closed; VS Code quit | `open --resume`: a new generation, reconciliation, revalidation; the observer `SessionStart` hook adds the status summary when available |
| Tenet update mid-contract | Pinned versions differ, so `version-changed`; migrate or reconcile (LFC-03) |
| Branch switch | Contracts stay bound to their branch; others are listed as parked |
| Copy or clone | Quarantine (7.5); shared intent is recovered from adopted files |
| `.tenet/` lost (CON-07) | Reconstruction: (a) parse IDs from `INTENT.md`, `docs/decisions/` and `@tenet` test tags; (b) scan the last 500 commits for `Tenet-Work` and `Tenet-Req` trailers to rebuild labels and ID high-water marks; (c) require re-adoption of `tenet.policy.json` and the charter; (d) create no receipts and no grants; (e) rebuild the lock manifest only as proposals for the user to confirm |

---

## 16. Observability and measurement

Each `log` line is one JSON object of one of two record types:

```ts
type CallRecord = { t: "call"; ts: string; verb: string; frontEnd: "cli" | "mcp"; work?: string; label?: string; generation?: number;
  role?: "coordinator" | "reviewer" | "analyst"; model?: ModelRecord;                  // requested and resolved separately (4.8)
  basisRevision?: number; tenetTokens: number;
  exit: number; reasons: string[]; durationMs: number; userWaitBeforeMs?: number;   // gap since the previous call, if it followed exit 2 or 3
  outcomeId?: string;                                                                 // pre-declared pilot outcome (PRD Section 6.6.1)
  promptCaused?: boolean | "unknown"; visibilityGaps?: string[]; observedHooks?: number };
type EffectRecord = { t: "effect"; ts: string; id: string; op: string; phase: "intent" | "result"; expected?: object; outcome?: string };
type UsageObservation = {   // Later (RSC-07): only when a host or permitted read-only source supplies it
  scope: "contract" | "session" | "personal-account" | "organization"; regime: "ai-credits" | "premium-requests" | "unknown";
  used: number; unit: string; allowance?: number;                 // absent unless actually known
  source: "host" | "official-report" | "user-reported"; observedAt: string; coversUntil: string;
  attribution: "direct" | "aggregate" | "uncertain";
};
```

Usage observations are personal data: they stay in `.tenet/` and the log, never in shared files, manifests or exports without preview. Estimated and reported amounts are never summed together.

- **Contents:** records never contain file contents, prompts, secrets or command output.
- **Field names:** plain names. `export diagnostics` maps them to the pinned OpenTelemetry GenAI subset (ENG-06), so the log itself needs no external naming scheme.
- **North-star measurement:** `outcomeId`, `userWaitBeforeMs`, cancellation records and durations support the pilot (AC-12). Active human minutes come from the PRD Section 6.6 consented observation and acceptance protocol; logs are supporting evidence, not a replacement.
- **Doctor:** `inspect doctor` reports payload hashes, capabilities with their retirement rows, state health, ownership and recent reason codes.
- **Diagnostics export:** previewed in full and saved only to a path the user chooses.

---

## 17. Verification

### 17.1 Tiers

| PRD tier (Section 6.1) | Implementation | Runs |
|---|---|---|
| T1 deterministic | Pure-core unit and property tests; **real-process and real-filesystem tests** for locks, renames, process groups, Git and crash points; front-end equivalence through `runVerb`; hook front-end tests on recorded payloads; skill lint; bundle checks | Every pull request (untrusted tier) |
| T2 scripted and replay | Replays of consented synthetic captures (17.4); scripted verb sequences; Copilot CLI proxy runs labeled as proxy | Pull requests (replay); maintainer-approved (proxy) |
| T3 native host | The installed plugin on the tuple running golden tasks | Before release; monthly; on observed model change |
| T4 human | Formative usability and the value pilot (PRD Section 6.6) | Alpha (formative); before R1 (qualification) |

### 17.2 Kernel tests

- **Truth tables:** one fixture per PRD Section 4.5.2 row (AC-27) and per configuration case of PRD Section 7.8 (AC-23).
- **Properties:**
  - more fresh passing evidence never weakens the endpoint;
  - resolution is independent of source order;
  - tightening never widens;
  - IDs never collide on one branch;
  - eviction never removes protected records;
  - repeating a request number never repeats an effect;
  - an answer is accepted only while its question's facts are unchanged;
  - committing an unchanged candidate keeps every check-input identity;
  - an expired request number never runs again.
- **Real-OS tests** (in-memory adapters cannot establish these):
  - two processes racing for `lock`, and two racing to break a stale one, including a breaker paused mid-break;
  - a hook appending to `.tenet/observed` while a call merges it;
  - readers never observe a missing `state` during publication;
  - a kill at every crash point of Sections 7.3, 7.4, 10.3 and 15.1;
  - orphaned process groups;
  - symlinked `.tenet/`;
  - case-insensitive paths;
  - two projects creating the user key at once;
  - a preload in the agent's environment never runs (the launch command clears it);
  - restore refuses while a server process holds the database.
- **Git fixtures:** assert **exact** preservation of human index entries and human file content, and exactly the permitted changes to Tenet-owned entries.

### 17.3 Adversarial scenarios

| Scenario | Expected |
|---|---|
| Kill right after a commit or process dispatch | Effect reconciled to one of three outcomes before any retry |
| Two calls for one contract at once | One wins; the other gets `kernel-busy`; no lost update or double count |
| Long check while another chat resumes the contract | No concurrent writer; the old chat is stale; a takeover question if it was recently active |
| `stop cancel` during a check | Allowed; owned group stopped; uncertainty recorded |
| Tracked `.env` that is dirty, untracked private key, a `no-read` path, a custom Git clean filter | No prohibited read; no excluded path passed to Git; a changed `.env` makes receipts stale; no filter run without consent |
| A test support file weakened after locking | Blocker |
| A `vi.mock` added to a locked acceptance file | Blocker (additions are not exempt) |
| Commit fails after checks pass | Endpoint "checked-local (working tree, uncommitted)", with the commit limitation |
| A human edits a Tenet-touched file after the last check | Question; not attributed to Tenet |
| A hook runs `git add -A` | Foreign path detected; commit kept and reported; recovery offered |
| Undo after a later human commit to the same file | Non-overlapping human change preserved; overlapping change stops with `undo-conflict` |
| Undo of two Tenet commits that changed the same lines | Applied progressively; one combined revert |
| A sealed baseline in a repository with `export-ignore` attributes and a committed secret | Tree materialized exactly, without the excluded path |
| A second contract edits a shared test helper | Not a blocker; dependent acceptance obligations rerun; the Reviewer sees the diff |
| Recording a manual accessibility check | Earlier receipts stay fresh (record files are declared outputs) |
| The agent runs `npm install <pkg>` in the terminal | `dependency-unverified`; verified after the fact; disclosure that scripts may have run |
| `NODE_OPTIONS=--require ./x.js` in the agent's terminal | The launch command clears it; nothing preloads |
| Missing local tool | Readiness item; no implicit download |
| Presentation-only configuration change | Evidence remains valid |
| A routine UI edit | Automated `affected` checks only; no manual screen-reader requalification until the boundary of a changed journey |
| A prototype edited by a human before undo | Human content preserved |
| `decide forget` on a lesson | Text absent from `state`, `state.prev`, schema backups and the response cache |
| Corrupt `state` | Fallback in diagnostic mode; no grant used until reconfirmed |
| An external SQLite writer holds the lock | Bounded 503 responses; event-loop delay within the workload target |
| MCP cancellation during a check | Owned group stopped; uncertainty recorded |
| A stale developer server on a brownfield fixed port | `port-in-use`, inconclusive |
| `decide` with a quote not in the conversation | Recorded as `reported`; trap scored |
| Host memory says "skip end-to-end tests" | Obligations unchanged; the conflict is shown |
| The host reports a usage limit mid-contract | `stop pause` with `host-limit`; resume later with counters intact; no overage suggested |
| `chat.subagents.defaultToAuto` is on | Subagent model recorded as `auto (host setting)`; Reviewer qualification shown |
| An old chat resumes work after a new chat took over | Stale generation; edits surface as unexplained changes; takeover question if the old work was still working |

### 17.4 Replay

- **Capture:** product logs exclude inputs, so replay uses a separate, **consented capture mode** that is enabled only in the evaluation environment on synthetic fixtures. It records verb inputs and outputs, and hook payloads, with secrets redacted.
- **Determinism:** Clock and Random come through ports, so replays are deterministic, and ephemeral fields (time, temporary paths, IDs) are normalized.
- **Safety:** replay runs against in-memory Git and runner adapters and never repeats real effects.

### 17.5 Native-host suite and grading

- **Golden-task format:** `{id, fixture, request, profile, expected: {endpoint, scope}, budget, forbidden: [patterns over the log and diffs], hiddenTests: <grader path>}`.
- **Hidden tests:** kept in a grader repository that is never on disk during the agent session. Grading starts **after** the session ends, in a separate process that copies the result, applies the hidden tests and scores them. Release credentials never exist in the evaluation environment.
- **Runs:** [SPIKE: SP-11] determines whether native-host runs can be unattended. *Fallback:* scripted manual runs on a dedicated Mac with published traces.
- **Native-first comparison:** the same representative tasks run with native capabilities on and with the fallbacks forced, measuring active human effort, reruns, prompts, elapsed time and safety outcomes, so each retained fallback shows a necessary capability or a measurable benefit.
- **Metrics** (PRD Section 6.2): first-run success within budget, repeated-run success, safety pass^k, review recall, precision and per-severity recall, and prompts per task.
- **Cost** (PA-4): AI credits per accepted outcome versus a matched native baseline, from the evaluation account's usage report (per-model token breakdown), with failed and cancelled runs in the numerator. Tokens, calls, retries and context size are explanatory diagnostics. Auto runs report their observed model mix. Legacy premium requests are reported only for accounts billed that way.
- **Model qualification:** the qualification table (4.8) is produced here, per model and for the Auto configuration, refreshed with each monthly T3 run.
- **Billing visibility cases:** denied usage access, stale reports, unknown allowance, organization billing and model changes within Auto are fixtures for the reporting rules of Section 8.6.

### 17.6 CI workflows

| Workflow | Trigger | Permissions | Runs |
|---|---|---|---|
| `untrusted.yml` | Every pull request (`pull_request`) | Read-only token, no secrets | Build, T1, replay, lint, bundle import scan, budgets, `tools/coverage` |
| `live.yml` | Maintainer approval through a protected environment; monthly | Evaluation account with a spend cap; no write token | T2 proxy and T3 runs; results treated as untrusted artifacts |
| `release.yml` | Signed tag on the protected branch | Release credentials in this job only | Reproducible build, hash comparison of the whole payload, inclusion audit, provenance attestation, publication |

Actions are pinned by SHA, and no cache flows from the untrusted tier into the others.

### 17.7 Acceptance suite mapping

| AC | Tier | Location and key fixtures |
|---|---|---|
| AC-01 | T3 | Install, uninstall and residue list (18) |
| AC-02 | T4 | Formative sessions |
| AC-03 | T1, T3 | Denied tools, missing capability, approval-mode question, linked-worktree inference |
| AC-04 | T1, T3 | Stateless review under a filesystem watcher (no `.tenet/`, no Git objects) |
| AC-05 | T1, T3 | Compile-error red, vacuous assertion, declared baseline expectations |
| AC-06 | T3 | Seeded defects plus clean controls; follow-up dispatch for uncovered parts |
| AC-07 | T1, T3 | Misleading-success set |
| AC-08 | T1, T3 | Kill at each crash point; resume generations; takeover question |
| AC-09 | T1 | Forget purges every controlled copy |
| AC-10 | T1, T3 | Schema backups; mid-contract update |
| AC-11 | T1 (release) | Inclusion list, history scan, provenance, NOTICE |
| AC-12 | T4 | Pilot with consented observation; `outcomeId` and wait fields as support |
| AC-13a | T1, T3 | Seeded drift |
| AC-13b | T1, T3 | No prevention hooks in R1. Observer hooks: recorded payloads under T1; on the tuple, a missing, failed or incomplete observation downgrades the control |
| AC-14 | T3 | Experiment manifest (17.8) |
| AC-15a | T1, T3 | One instruction file; personal versus shared; style and checkpoints never weaken checks |
| AC-15b | T1, T3 | Unknown model labels; qualification table; Deep warning (`model-unqualified-for-deep`) |
| AC-15c | T1 | Attempt counting (targeted checks excluded); failure signatures; pending delegation reservations; launched-check counts; Deep budget preview |
| AC-16 | T1, T3 | Injection, canary, quarantine, filters, kernel location, preloads, host-memory instructions |
| AC-17 | T1 | Racing processes; crash points; undo with later commits |
| AC-18 | T1 | Drift during a run; declared outputs; forged reports; excluded-file changes |
| AC-19 | T1, T3 | Benchmarks; long-history storage fixture; always-loaded token lint; credits per task (17.5) |
| AC-20 | T1 (recipe CI), T3 | Process-race invariant, restore, accessibility (automated and manual), workload |
| AC-21 | T3, T4 | Prompt distribution; grouped questions; checkpoint cadence |
| AC-22 | T3 | Blocked, failed, partial, stale and disagreeing children |
| AC-23 | T1 | PRD Section 7.8 cases |
| AC-24 | T3, T4 | Seeded misinterpretations; `decide` trap |
| AC-25 | T1, T3 | Dirty-tree and hook fixtures |
| AC-26 | T1 | Seeded skill regression |
| AC-27 | T1 | Truth-table fixtures |
| AC-28 | T1, T3 | Fork pull request without secrets; grading boundary |

### 17.8 Maintainer experiments (ENG-08)

An experiment is a manifest in `eval/experiments/`:

```text
{ hypothesis, surface: <one skill or rubric path>, baseline: <commit>, training: [task IDs],
  holdout: [task IDs], repeats: ≥5, budget, stopRule, tieRule: "simpler wins", disposition }
```

`tools/eval-experiment` accepts a manifest only if its diff touches nothing outside an **allowlist**: files under `plugin/skills/` and the rubric files named in the manifest. Everything else, including the kernel, graders and schemas, is refused (LRN-05). It records every trial and its cost, and keeps the baseline when the result is inconclusive (PRD Section 6.10).

---

## 18. Build, release and operations

1. **Build:** compile TypeScript; bundle `kernel/tenet.mjs`; copy skills, agents, commands, the descriptor and recipes into `plugin/`; write `SHA256SUMS` over **every payload file** and `NOTICE`; check the inclusion list.
2. **Verify:** a second clean build must produce identical hashes. `inspect doctor` verifies the installed payload against `SHA256SUMS`, not only the bundle.
3. **Version:** SemVer against the compatibility contract (verbs, schemas, reason codes, record schemas, recipe compatibility, permissions); `plugin.json` is bumped every release.
4. **Release:**
   - signed tag;
   - provenance attestation;
   - release notes covering changed permissions, destinations, executables, schemas and evaluated behavior (LFC-02);
   - support matrix generated from descriptors plus T3 records.
5. **Solo-maintainer rule:** changes to kernel effects, helpers or permissions wait a 72-hour public review window, with an external reviewer when available, and are disclosed (PRD Section 5.9.2).
6. **Operations:**
   - monthly T3 rerun and starter dependency refresh;
   - each minor release reviews the retirement rows (4.4) against the current host, so equivalent host capabilities are adopted (PRD Section 15);
   - the model qualification table is refreshed with the monthly T3 run;
   - security triage within 3 days and a decision within 7;
   - withdrawn versions marked in the matrix;
   - the known-good release kept.
7. **Uninstall residue** (LFC-05, AC-01), listed by `inspect residue`:
   - `.tenet/`;
   - user-owned adopted files (`INTENT.md`, `docs/decisions/`, `docs/architecture.md`, `docs/hardening.md`, `tenet.policy.json`, the charter section);
   - test tags and commit trailers (kept);
   - the user directory (shared by all projects);
   - run directories.

   Cleanup has two separate scopes, each previewed: **this project** (`.tenet/` and this project's run directories) and **this machine** (the user directory and all run directories), which affects every project and is offered only on uninstall.
8. **Provisional identity:** the license (Apache-2.0 for Tenet, MIT-0 for the starter) and the name are provisional until Q-03 and Q-13 are decided.
9. **Discovery:** the PRD Section 11.2 interviews with technical builders run alongside the spikes. That is process, not product.

---

## 19. Delivery

### 19.1 Spike protocols

Each spike needs separate authorization (PRD Section 8.1).

| Spike | Procedure | Pass criteria | If it fails |
|---|---|---|---|
| SP-01 Install and invocation | Install through each path; run the kernel by a skill-relative path; a 15-minute command through the terminal tool; enable, disable and uninstall; a portability smoke run on the Copilot harness (informative) | Kernel runs with no user setup; long commands complete; lifecycle recorded | Pinned copy in the user directory; split long checks |
| SP-02 Storage and loading | From the terminal and from an MCP process: write the user directory, `${PLUGIN_DATA}` and OS temp; which instruction files load when one or both exist; host exclusions and indexing for `.tenet/`; token estimator against the host tokenizer | Locations known; estimator error ≤ 15% | No key; cooperative exclusions disclosed |
| SP-03 Hooks | Prevention (the PRD question) is not needed in R1. The observation part (PRD Section 5.7.1): agent-scoped `PostToolUse`, `SubagentStart`, `SubagentStop`, `Stop` and `SessionStart` payloads (paths, session ID, subagent result), ordering, timeouts, failure behavior | Observations reliable on the tuple | Controls stay cooperative; PA-1 withdrawn |
| SP-04 Models | Whether native roles and hook payloads expose the resolved model and family; whether `Auto` is accepted as an agent `model` value; how the cost-tier check treats agent model lists; what `chat.subagents.defaultToAuto` does to each Tenet agent | Observable resolution; known routing rules | Model labels stay `unknown`; subagents inherit (4.8) |
| SP-05 Usage signals | What the host exposes about requests, credits, usage and cancellation to a plugin, a hook or the agent; the subagent credit display; whether a permitted read-only usage source exists for the user | List of signals with scope and freshness | Tenet-only counters; `usage: unknown` |
| SP-06 Inventory and Git | Inventory on 10,000 files with exclusion pathspecs; filters; `GIT_OPTIONAL_LOCKS`; temporary-index commits with husky and lint-staged; index sync; host edit review; racing processes | Human content and index entries exactly preserved; inventory p95 ≤ 1 s | Narrow attribution claims; questions before stash-using hooks |
| SP-07 Update and removal | Native update, disable and uninstall with active state, pinned versions and overrides; known-good recovery | State and overrides preserved | Fix recovery before public release |
| SP-08 Delegation and native tools | Reviewer and Analyst agents: fresh context, tool restriction, `usages` and search inside subagents, parallel dispatch, nested default, handoffs, dispatch visibility; blocked, failed and cancelled children; `askQuestions` and `todos` in the coordinator; subagents reading a manifest in the run directory outside the workspace | Usable on the tuple | Reopen Q-01; text-search fallback for references |
| SP-09 Copilot CLI | Whether the same skills and kernel calls run in the Copilot CLI (R1.1) | Skills load; kernel calls work | Defer CLI support |
| SP-10 Adapter | JSON reporters on the starter, web and CLI/library brownfield fixtures; failure kinds; version ranges | Correct normalization; unsupported cases reported | Narrow brownfield eligibility |
| SP-11 Native-host evaluation | Unattended runs; terms of service; cost; secret isolation | Repeatable runs or a documented manual procedure | Manual T3 |
| SP-12 Approvals and front-end | The safety gate of Section 4.5; approval-mode signal; Autopilot behavior with ended turns, native questions and elicitation; heredoc input and auto-approve rule matching; a thin MCP entry over the same verbs; prompt distribution over 3 tasks × 5 runs per front-end; tokens and credits per task, tool-schema tokens, transcription and legibility observations; elicitation and roots | Front-end selected by the Section 4.5 rule | Command line stays; friction claim narrowed |

### 19.2 Milestone coverage (derived from PRD tags)

| Milestone | PRD requirements (Must) | Minimal mechanisms required |
|---|---|---|
| M0 | 34 | Verb pipeline; loop-card responses; command line; state document; lock with guarded breaking; ownership generations; effect protocol and reconciliation for commits; inventory with exclusion pathspecs; conservative freshness; runner with Vitest; receipts; verdict; acceptance obligations with whole-file locks; start snapshot, file attribution, commit protocol, index sync; shadow snapshots for non-Git prototypes; stateless review with manifests; `tenet`, `tenet-intake`, `tenet-build`, `tenet-review` skills; Reviewer agent; skill lint; starter scaffold flow; approval-mode question |
| A | 66 | Front-end selected by SP-12 (MCP if chosen); Analyst agent; decision registry; plan and decision records; managed blocks and IDs; trust comparison; configuration core and catalog consumers; quarantine; undo by inverse patch; integration; dependency verification before install; deterministic CI tier and 10 golden tasks |
| B | 58 | Sealed baselines; continuity paths; eviction; migrations; `inspect why` and `impact`; Jest, Playwright, ESLint, tsc and audit normalization; trait detection; complete counters, usage reporting and the Deep budget preview; observer hooks (once SP-03 qualifies them); fault, privacy and update suites; calibration |
| R1 | 23 (plus 16 Should) | Model qualification table and Deep warning; starter quality harness (ASVS list, accessibility manual procedure, workload); docs; release chain; CI evidence import (`ci-external`); 30 public and 10 reserved golden tasks; maintainer experiment; pilot |

`tools/coverage` recomputes this table from PRD tags and the Appendix A mapping, and fails CI when a milestone's requirements map to mechanisms scheduled later. Mentions are not proof of delivery, so it also requires every Must requirement to map to at least one acceptance fixture (17.7) that exercises the behavior.

### 19.3 Work breakdown for M0

| Package | Scope |
|---|---|
| WP-01 | zod schemas, the verb pipeline, command-line front-end, response envelope, operation classes, `inspect doctor` |
| WP-02 | State store: document, lock, ownership, generations, effect log, reconciliation |
| WP-03 | Git: snapshot, inventory, file attribution, commit protocol, index sync, shadow repository |
| WP-04 | Runner and the Vitest adapter; receipts; acceptance obligations; whole-file locks |
| WP-05 | Rules: lifecycle, risk, budget, verdict truth table |
| WP-06 | Agent bodies and skills (with real text, Appendix F) and the Reviewer agent |
| WP-07 | Starter template and scaffold flow |
| WP-08 | T1 tests, including real-OS and adversarial cases |
| WP-09 | Walking-skeleton demonstration with one injected kill during `check` |

### 19.4 Sizing

| Milestone | Estimate (one developer with AI assistance) |
|---|---|
| Spikes | 2–3 weeks |
| M0 | 4–5 weeks |
| Alpha | 5–7 weeks |
| Beta | 5–6 weeks |
| R1 | 5–7 weeks |

The kernel is estimated at **3,500–4,500 lines** (about 60% pure core), with tests of similar size, plus about 15 agent, skill and command files and a starter of about 3,500 lines. These estimates are for planning only.

---

## 20. Technical decisions

### 20.1 Decision log

| ID | Decision | Simpler or alternative option considered | Why this one |
|---|---|---|---|
| TD-01 | Deterministic ledger kernel behind portable skills | Prompt-only skills; hook-first; MCP-first; event sourcing; repository-only state; rule engines | The only shape that gives the PRD's integrity rules deterministic mechanisms inside a plugin |
| TD-02 | No user-installed dependencies; small reviewed bundled libraries allowed (zod; MCP SDK if selected) | Zero third-party code | Hand-written schema and protocol code would cost more code and risk than two pinned libraries |
| TD-03 | One source tree and one verb pipeline with thin front-ends (command line, MCP with three tools, hook); SP-12 selects the single user-facing front-end; the command line stays as the test harness | Two code bases; ship both; MCP first; one MCP tool per verb | Front-ends cannot diverge; the PRD's selection rule is kept; tool schemas are paid on every request |
| TD-04 | One state document replaced atomically, one log, hash-named blobs | Content-addressed objects, refs, journal and reflog; a native SQLite store | One writer and a small budget make multi-record transactions unnecessary; kept while the real-OS fixtures pass, and reconsidered only if its protocols come to dominate the kernel |
| TD-05 | Transaction lock with guarded stale-lock breaking (liveness by process ID and start time, never elapsed time) and a revision re-check before publish; ownership with generations | Leases with expiry; timed stale rules; rename-over-and-verify | Liveness is known while a process runs; a paused process is never mistaken for a dead one; the backstop prevents lost updates |
| TD-06 | Effect protocol for non-repeatable effects; checks classified by envelope; three reconciliation outcomes | Effect records for everything; none; assuming checks repeatable | Closes the crash window without logging repeatable work, and never treats an unknown check as safe to rerun |
| TD-07 | Exclusion-aware inventory: exclusions as Git pathspecs, stat for excluded files, Git blob IDs for every file's content (computed in Node for dirty files); no Git writes | `git add -A` plus `write-tree`; SHA-256 for dirty files only | Privacy, zero-write review, and identities that survive a commit of unchanged content |
| TD-08 | Conservative freshness; runner-native affected selection; host diagnostics between attempts | Dependency index | PRD-compliant with far less code; revisit when reruns are measured to cost |
| TD-09 | Kernel-run checks; direct `node_modules/.bin` binaries; JSON reporters; reduced environment | `npx` or `npm exec`; XML parsing; host test views as evidence | No implicit downloads; host views lack run-bound receipts today (retirement row, 4.4) |
| TD-10 | Six check kinds and five applicability categories, as registries | Test counts for everything; every obligation at every check | Removes special cases; routine changes never trigger release work |
| TD-11 | Project-level whole-file locks on acceptance test files; support inputs locked during their contract and rechecked afterwards; new examples in new files | Test-block lexer; "additions are safe"; permanent locks on shared helpers | No syntax-aware integrity code; later contracts can extend shared helpers without losing protection |
| TD-12 | File-level attribution plus the last-check rule; stop and ask on mixed files | Hunk attribution with patch application | Matches PRD Section 5.12, which asks on mixed files; no patch construction |
| TD-13 | Commits through a temporary index, then verification and index sync; foreign paths kept and reported; undo as progressively validated inverse patches applied to the working tree, then checks, then the commit protocol | Automatic ref rollback; restoring old file contents; per-commit checks against the original tree; `git revert` (touches the index) | Preserves later human work and the user's index; handles overlapping Tenet commits |
| TD-14 | No prevention hooks in R1; observer hooks in Beta once SP-03 qualifies them (PA-1), recording only (no forced continuation), from a tiny separate entry | No hooks at all; guard hooks from the start; a `Stop` hook that forces continuation | Prevention is unqualified; observation upgrades three cooperative controls cheaply |
| TD-15 | Sealed baselines by temporary-index checkout without excluded paths, with a symlinked `node_modules` and redirected caches (Beta), only for broader candidate failures | `git worktree`; `git archive` (honors `export-ignore`); APFS clones; eager baseline of every obligation | No writes into the user's Git directory; an exact tree; portable; baseline cost proportional to the change |
| TD-16 | Review manifests that index, passed by path, with a closed read list, sampling for broad callers and a recheck mode; the host's language services as the repository map | Bucketed packets from an import scanner; inline manifests; open-ended exploration; full reviews for rechecks | Less code and far fewer tokens; reference resolution improves with the host |
| TD-17 | 5 skills, 3 agents, 2 commands, 14 verbs; one phase skill loaded at a time | 13 skills, 25 verbs; one agent per role | Fewer descriptions, calls, tokens and misroutes |
| TD-18 | Managed Markdown blocks; `tenet.policy.json`; structural-only automatic tightening | Semantic classification of prose | No implication solver; uncertain changes go through adoption |
| TD-19 | Opaque work IDs plus labels; shared IDs with sequence and suffix; ancestry-aware reconciliation | Sequential IDs; renumbering | Stable correlation; divergent edits treated as conflicts, not collisions |
| TD-20 | Starter: Fastify 5, Zod, better-sqlite3, SQL migrations, scrypt, React with Vite (owner decision, October 15) | Hono with `node:sqlite`; Express 5 with Drizzle | Mature, explicit, transactional, with an online backup API |
| TD-21 | `node:test` plus `fast-check`, with real-OS tests for OS-dependent protocols | In-memory only | OS semantics need OS tests |
| TD-22 | Signed tags, provenance, reproducible payload | Signing only | PRD Section 5.9.2 chain |
| TD-23 | User directory holds only preferences and an optional key; copy detection from the marker's own directory identity | An ownership index in the user directory | Nothing machine-wide is needed for correctness; no cross-project races |
| TD-24 | Command-line input: flags plus a quoted-heredoc JSON body | Base64 arguments | Readable approval previews; no encoding work for the agent |
| TD-25 | Native-first rule with retirement rows (0.6, 4.4) | Building Tenet equivalents of host features | The host improves for free; PRD Sections 7.9 and 15 |
| TD-26 | Shadow Git repository for non-Git prototypes | A `prepare` verb with blob copies | No pre-edit step for the agent to forget; one Git code path |
| TD-27 | One `decide` verb over a registry of decision kinds; answers bound to question facts | 14 sub-commands in a switch; binding to the whole state revision | Fewer tool errors; a new kind adds a file; no needless reconfirmation |
| TD-28 | Dependency verification before install, from lockfile-only resolution | Verifying after install; walking the installed tree; name-similarity heuristics | Scripts never run unverified; the package manager does the resolution |
| TD-29 | Authority questions in chat, never through native questions; approval mode unknown except in linked worktrees | Treating native answers as user answers; inferring the mode from prompts | Autopilot answers native questions; only deterministic inferences are recorded |
| TD-30 | `finish` commits the candidate; `commit` only for checkpoints | Always two calls | One fewer call and approval per task |
| TD-31 | Run artifacts and screenshots only in run directories | Screenshots and raw output as `.tenet/` blobs | PRD Section 5.13; much simpler admission and eviction |
| TD-32 | A small loop-card response (about 400 tokens), disclosure on change, envelope defaults and flag answers | 1,500-token responses repeating controls and identifiers | Responses are re-sent with every later request; output tokens cost most |
| TD-33 | No Tenet model router; subagents inherit, except a qualified economy model for research named by the qualification table (PA-6); Auto qualified as a configuration; one Deep warning | Role-to-model routing; a model menu; naming models in agent files | RSC-01 and RSC-06; the host already routes; model names change monthly, so they live in release data |
| TD-34 | Usage reported as Tenet-attributable counters plus `unknown` with native pointers; never invented | Estimating credits from tokens; a billing client | A plugin cannot see the bill; a false number is worse than none |
| TD-35 | Tenet's record files are declared outputs, excluded from check-input identities | An ordering rule for projection writes | Recording decisions or manual checks never invalidates evidence; one rule fewer |

### 20.2 Removed in v0.4

| Removed | Replaced by | Effect |
|---|---|---|
| One MCP tool per verb (14 schemas on every request) | Three tools (TD-03) | About 3,000–5,000 fewer tokens per request if MCP ships |
| 1,500-token responses repeating controls, identifiers and envelopes | Loop cards, disclosure on change, envelope defaults (TD-32) | Several thousand fewer tokens of history per task |
| Inline manifests through the coordinator | Manifests passed by path (TD-16) | No manifest in the coordinator's context or output |
| Full-review manifests for rechecks | Recheck mode (8.7) | Rechecks cost a fraction of a review |
| Default parallel Analysts in Standard work | Coordinator search first (5.2) | Fewer subagent sessions |
| Coordinator loading `tenet-review` | `focused-review.md`; the Reviewer loads the rubric (5.1) | About 4,000 fewer tokens per review |
| The projection ordering rule | Record files as declared outputs (TD-35) | One rule fewer; no stale receipts from records |
| Elapsed-time rules for lock breaking and takeover | Process liveness and recorded last state (TD-05, 7.3) | Correct for paused processes and long-lived chats |
| `git archive` export and APFS clones | Temporary-index checkout and a symlink (TD-15) | Exact tree; portable; no clone cost |
| Permanent locks on shared support inputs | Contract-scoped locks plus reruns (TD-11) | Later contracts are not blocked |
| `tools/coverage` mention checking | A fixture for every Must requirement (19.2) | No ID-sprinkling prose |

New mechanisms are small: the recheck manifest mode, the qualification table, the counters of `BudgetState`, the dependency decision kind, manifest files, the backstop revision check and the tiny hook entry, about 300 lines in total. The kernel estimate stays at about 3,500–4,500 lines.

### 20.3 PRD amendments

The owner approved PA-1 to PA-6 on October 15, 2026; they are in PRD v0.16 (D-30). Mechanisms they enable still depend on their spikes and qualification: observer hooks on SP-03, the front-end rule on SP-12, and the researcher economy model on release qualification.

| ID | PRD location | Change | Why | Status |
|---|---|---|---|---|
| PA-1 | PRD Section 5.7.1; AC-13b | Allow observer hooks before SP-03 qualifies prevention: hooks may record observations (edited paths, subagent dispatch, turn end, session start) and may raise mechanism classes; anything that prevents or forces behavior still waits for SP-03 | Upgrades attribution, review independence and result capture from cooperative to observed at low cost (4.7) | Approved October 15 (PRD v0.16) |
| PA-2 | PRD Section 5.7.1 (SP-12 rule) | Let the front-end selection weigh credits per task, tool-schema tokens, retyped review results and approval-preview legibility for Guided users, besides prompt counts | Under token billing, prompts are friction and credits are cost; retyping also lets the coordinator alter findings | Approved October 15 (PRD v0.16) |
| PA-3 | PRD Section 3.8.7 | State that the repository map may be provided by a qualified host language service, with Tenet adding acceptance-test links and coverage reporting | Makes the traceability for AGT-12 explicit rather than relying on Section 7.9 alone | Approved October 15 (PRD v0.16) |
| PA-4 | PRD Sections 1.6 and 2.2 | Restate the efficiency targets as AI credits per accepted outcome versus a matched native baseline (failed and cancelled work included), with premium requests only for legacy-billed accounts; update the low-allowance plan guidance | The premium-request unit no longer describes most plans | Approved October 15 (PRD v0.16) |
| PA-5 | PRD Section 4.4.3 | State that the always-loaded budget counts every Tenet-owned item present on every request: descriptions, agent instructions, commands, MCP tool schemas and the charter section | Tool schemas and the charter are always-loaded context too | Approved October 15 (PRD v0.16) |
| PA-6 | PRD RSC-01 | Clarify that RSC-01 constrains asking the user to switch models; it permits a disclosed, opt-out economy-tier model preference for the read-only researcher role, refreshed with release qualification. The Reviewer and authority-bearing roles keep inheriting | GitHub recommends cheaper models for subagents; the PRD text should settle whether Tenet may use that | Approved October 15 (PRD v0.16) |

---

## 21. Open technical questions

| ID | Question | Spike | Default if unresolved |
|---|---|---|---|
| TQ-01 | Can the agent run the kernel by a skill-relative path? | SP-01 | Pinned copy in the user directory |
| TQ-02 | Prompts per task through each front-end; session-level approval in the host UI | SP-12 | MCP front-end |
| TQ-03 | Does the terminal tool pass quoted heredocs intact, and can auto-approve rules match them? | SP-12 | Input file created by the kernel in OS temp |
| TQ-04 | Are the user directory, `${PLUGIN_DATA}` and OS temp writable from the agent's terminal and the MCP process? | SP-02 | No key; stateless review; sealed baselines unknown |
| TQ-05 | Subagent tool restriction, parallel limits, dispatch visibility, `usages` inside subagents | SP-08 | Focused passes with reduced independence disclosed; text-search fallback |
| TQ-06 | Terminal behavior for 10–20-minute commands | SP-01 | Chunk obligations |
| TQ-07 | MCP elicitation and roots support; does the kernel receive elicited answers? | SP-12 | Reported decisions; workspace confirmed once |
| TQ-08 | Host exclusions for agent tools and indexing | SP-02 | Cooperative exclusions, disclosed |
| TQ-09 | Stash-based hook managers with a temporary index | SP-06 | Question before commit when human-dirty files exist |
| TQ-10 | JSON reporter flags versus common project configurations | SP-10 | `adapter-unsupported-config` |
| TQ-11 | Install path and its enable or disable semantics | SP-01 | Marketplace if available, otherwise Git source |
| TQ-12 | A reliable approval-mode signal | SP-12 | Unknown, so the question always applies; linked worktrees inferred as Allow all |
| TQ-13 | Accuracy of the token estimate | SP-02 | Margin raised to 25% |
| TQ-14 | Filter execution during `git status`; effect of `GIT_OPTIONAL_LOCKS` and pathspecs | SP-06 | Consent for any filter configuration |
| TQ-15 | Host edit-review records (who made an edit) | SP-06 | Last-check rule plus questions |
| TQ-16 | Unattended native-host evaluation | SP-11 | Manual T3 |
| TQ-17 | What Autopilot does with an ended turn, native questions and elicitation | SP-12 | Authority capture labeled unverifiable under Autopilot |
| TQ-18 | Observer hook payloads: edited paths, session ID, subagent result | SP-03 | Cooperative labels |
| TQ-19 | Which instruction file the host loads when both exist | SP-02 | `AGENTS.md` |
| TQ-20 | Is `Auto` a valid agent `model` value, and how do agent model lists interact with the cost-tier check? | SP-04 | Subagents inherit |
| TQ-21 | Can subagents read a manifest file in the run directory outside the workspace? | SP-08 | Inline manifest under its own cap |
| TQ-22 | Which usage signals reach a plugin, hook or agent? | SP-05 | `usage: unknown` with native pointers |

---

## 22. Technical risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Host behavior differs from documentation | High / High | Spikes first; descriptor; per-question fallbacks |
| Preview host features change or disappear | High / Medium | Every native feature sits behind a descriptor key with a fallback; no verdict depends on a preview feature |
| Approval friction on the command line | High / Medium | Per-verb snippet; MCP measured in SP-12 and ready to select |
| Tenet overhead costs users noticeable credits | High / High | The cost controls of Section 14.4; credits per outcome measured against a native baseline (17.5) |
| Model behavior or pricing changes between releases | High / Medium | No model names in the plugin; monthly qualification; labels say unknown when unknown |
| Autopilot answers questions for the user | Medium / High | Authority questions in chat; disclosure; TQ-17 |
| Agents skip kernel calls or misreport decisions | Medium / High | Results only from kernel output; traps; mechanism labels; observer hooks (PA-1) |
| Native tools behave differently inside subagents | Medium / Medium | SP-08; text-search fallback; coverage reports what was inspected |
| Human edits made between agent edits before a check | Medium / Medium | Last-check rule; disclosure; observer hooks; SP-06 edit records |
| Hooks interfering with commits | Medium / Medium | Consent, verification, reported recovery |
| Conservative freshness makes reruns slow on large suites | Medium / Low | Targeted inner loops; host diagnostics; measure before adding an index |
| Whole-file locks cause extra dispositions | Medium / Low | Dedicated acceptance files; new files for new examples; batch dispositions |
| Kernel scope creep | Medium / High | Complexity and native-first rules (0.5, 0.6); registries; lint bans; review of new verbs |
| Starter dependency churn | High / Low | Monthly refresh; template CI |
| Evaluation cost and feasibility | Medium / High | Tiers; replay; spend cap (Q-16) |
| Solo-maintainer capacity | High / High | The cut list; M0-first; shared fixtures; one pipeline |

---

---

## Appendix A. Requirement traceability

Generated from PRD v0.16 for Tech Spec v0.4. Each requirement maps to its design sections, main component and verifying suites (Section 17.7 maps suites to tests).

| PRD ID | Rel | Design sections | Component | Verification |
|---|---|---|---|---|
| INS-01 | M0 | 3.1, 4.1 | Plugin package; SP-01 | AC-01 |
| INS-02 | R1 | 4.1, 18 | README | AC-01, AC-11 |
| INS-03 | M0 | 4.1, 4.3, 4.4 | Host binding; `open`; `inspect doctor` | AC-02, AC-21 |
| INS-04 | A | 4.1, 4.3, 4.4 | Host binding; `open`; `inspect doctor` | AC-03, AC-21 |
| INS-05 | B | 4.4, 7.2 | Capabilities with provenance | AC-19, AC-21 |
| INS-06 | A | 6.6 | Exit 2 with safe alternatives | AC-03 |
| INS-07 | M0 | 3.2, 3.3, 4.5 | Bundle on project Node; no user installs | AC-01 |
| INS-08 | R1 | 4.1, 4.3, 4.4 | Host binding; `open`; `inspect doctor` | AC-01 |
| INS-09 | A | 6.3 | Read-only and stateless classes | AC-21 |
| INS-10 | A | 5.2 | Coordinator step 3 | AC-21 |
| INS-11 | B | 2.4.7, 9.3 | Readiness; no implicit installs | AC-03, AC-21 |
| INS-12 | A | 5.2, 6.5 | `open` | AC-03, AC-21 |
| INT-01 | M0 | 5.1, 7.8, 7.9 | `tenet-intake`; `decide`; projections | AC-04, AC-21 |
| INT-02 | A | 7.8 | Managed blocks | AC-13a |
| INT-03 | A | 6.6, 5.2 | Grouped questions | AC-04, AC-21 |
| INT-04 | M0 | 2.4.1, 5.3.2 | Explicit-case reuse | AC-24 |
| INT-05 | M0 | 9.2, 9.7 | Acceptance obligations; locks | AC-05, AC-24 |
| INT-06 | A | 8.1, 9.7 | Dispositions | AC-07, AC-24 |
| INT-07 | A | 2.3, 6.5 | `decide` registry | AC-13a |
| INT-08 | B | 8.5, 6.5 | `inspect impact` | AC-13a |
| INT-09 | B | 7.8 | Decision records | AC-13a |
| INT-10 | A | 7.9 | IDs | AC-13a, AC-25 |
| INT-11 | R1 | 5.1 | `guided.md` | AC-21 |
| INT-12 | A | 2.4.5, 7.2 | Plan items; project record | AC-04, AC-12 |
| INT-13 | R1 | 7.8 | Designated documents | AC-04 |
| INT-14 | R1 | 5.3.3, 7.8 | Architecture doc | AC-20 |
| INT-15 | A | 5.3.2, 8.3 | Basis coverage | AC-24, AC-27 |
| WRK-01 | M0 | 7.2 | WorkContract | AC-04, AC-13a |
| WRK-02 | M0 | 2.4.1, 8.1 | Routine grant from the request | AC-21 |
| WRK-03 | A | 8.5 | Scope estimate versus constraint | AC-08, AC-13a |
| WRK-04 | A | 8.2 | Floors | AC-21 |
| WRK-05 | A | 4.3 | Profiles | AC-21 |
| WRK-06 | B | 8.3, 12.9 | Prototype endpoint; hardening | AC-05, AC-21 |
| WRK-07 | B | 12.10 | Promotion | AC-05 |
| WRK-08 | M0 | 8.6 | Counters | AC-15c, AC-19 |
| WRK-09 | A | 8.1, 8.6 | Failure signatures; stop reasons | AC-15c |
| WRK-10 | A | 5.2, 6.6, 10.3 | Checkpoint commits; cadence; never auto-confirm a host pause | AC-08, AC-21 |
| WRK-11 | B | 5.2, 6.5 | `stop`, `undo`, yield rule | AC-21 |
| WRK-12 | A | 8.6 | Handoff reserve | AC-08 |
| WRK-13 | B | 8.2, 8.3 | Declined steps | AC-21, AC-27 |
| AGT-01 | A | 4.2, 5.4, 8.7 | Agents; manifests | AC-22 |
| AGT-02 | M0 | 4.2, 5.4 | Reviewer agent; SP-08 | AC-06, AC-22 |
| AGT-03 | A | 4.2, 5.4 | Analyst agent | AC-22 |
| AGT-04 | A | 5.5, 8.7 | Packets and manifests | AC-22 |
| AGT-05 | A | 5.4 | Result schemas | AC-22 |
| AGT-06 | B | 4.2 | Nesting off by default | AC-22 |
| AGT-07 | B | 5.2, 8.4 | Findings rules | AC-22 |
| AGT-08 | A | 7.3 | Ownership | AC-17 |
| AGT-09 | B | 4.2, 5.3.1 | Focused passes | AC-22 |
| AGT-10 | B | 2.3, 5.5 | Rendered results | AC-21, AC-22 |
| AGT-11 | B | 5.4 | Revision reconciliation | AC-22 |
| AGT-12 | B | 8.7, 4.4 | Host references; required investigations | AC-19, AC-22 |
| TDD-01 | M0 | 8.1, 9.8 | Declared baseline expectations | AC-05 |
| TDD-02 | M0 | 9.5 | Failure kinds | AC-05 |
| TDD-03 | A | 8.3 | Alternative with negative control | AC-05 |
| TDD-04 | A | 5.3, 12.10 | Characterization | AC-05, AC-20 |
| TDD-05 | B | 5.3.1 | Refactor with preservation tests | AC-05 |
| TDD-06 | B | 8.3 | Nonbehavioral alternative check | AC-05 |
| TDD-07 | R1 | 5.3.3 | Mutation testing offer | AC-07 |
| EVD-01 | M0 | 9.4 | Inventory | AC-18 |
| EVD-02 | M0 | 9.1, 9.6 | Kinds; validation | AC-07 |
| EVD-03 | A | 8.8 | Conservative freshness; canonical identity | AC-18 |
| EVD-04 | B | 9.8 | Acceptance and targeted baseline; sealed export | AC-18, AC-19 |
| EVD-05 | A | 9.5 | JSON reporters; standard-format export | AC-18, AC-20 |
| EVD-06 | M0 | 8.3 | Verdict | AC-07, AC-27 |
| EVD-07 | M0 | 6.6, 4.4 | `controls[]` derived from the descriptor | AC-07, AC-13a |
| EVD-08 | B | 9.9, 9.6 | Flaky; qualifiers | AC-07, AC-18 |
| EVD-09 | B | 8.8, 7.8, 9.3 | Declared outputs; record files | AC-18 |
| EVD-10 | A | 9.7 | Project lock manifest | AC-07, AC-24 |
| EVD-11 | B | 9.4 | Drift during runs | AC-18 |
| EVD-12 | A | 9.6 | Receipt schema | AC-18 |
| EVD-13 | A | 9.3, 12.7 | Free port; `webServer`; run token | AC-18, AC-20 |
| EVD-14 | R1 | 9.12 | `ci-external` only in R1 | AC-25 |
| REV-01 | M0 | 5.4, 8.7 | Review manifest | AC-06 |
| REV-02 | M0 | 5.4 | Two stages | AC-06 |
| REV-03 | A | 8.7, F.2 | Test and configuration diffs inline; rubric | AC-07 |
| REV-04 | A | 8.4 | Findings | AC-06, AC-27 |
| REV-05 | A | 8.6 | Review rounds and rechecks | AC-06 |
| REV-06 | A | 8.5, 5.4 | `dispatchMode` | AC-06 |
| REV-07 | Later | 21 | Later (SP-04) | AC-06 |
| REV-08 | B | 8.7 | Coverage-driven follow-up dispatch | AC-06, AC-27 |
| REV-09 | B | 5.4 | Basis gaps | AC-24 |
| RES-01 | M0 | 2.3, 5.2, 6.6 | Rendering from kernel output | AC-21 |
| RES-02 | M0 | 2.3, 5.2, 6.6 | Rendering from kernel output | AC-07, AC-27 |
| RES-03 | A | 2.3, 5.2, 6.6 | Rendering from kernel output | AC-21 |
| RES-04 | M0 | 5.5, 8.6 | Handoff | AC-08 |
| RES-05 | B | 9.10 | Run-directory screenshots; browser tools | AC-20 |
| RES-06 | A | 2.4.3, 4.2 | Handoff to fix | AC-04 |
| RES-07 | B | 6.6 | Controls disclosure | AC-21 |
| RES-08 | R1 | 2.5 | Agent-started dev server | AC-21 |
| RES-09 | B | 8.6 | Deep budget preview | AC-15c |
| GIT-01 | M0 | 10.9, 12.2 | Init choice; shadow repository | AC-17, AC-25 |
| GIT-02 | M0 | 10.7 | Branches | AC-25 |
| GIT-03 | M0 | 10.2, 10.3 | Attribution; commit | AC-25 |
| GIT-04 | A | 10.5 | Progressive inverse patches | AC-17 |
| GIT-05 | M0 | 10.6 | `publish` bound to remote, branch and commit | AC-04, AC-25 |
| GIT-06 | R1 | 10.6 | PR brief | AC-25 |
| GIT-07 | R1 | 12.1 | CI template | AC-20, AC-25 |
| GIT-08 | M0 | 10.2, 10.3 | Human edits untouched | AC-17, AC-25 |
| GIT-09 | B | 7.9 | Ancestry-aware reconciliation | AC-17 |
| GIT-10 | M0 | 10.1, 10.2 | Snapshot; `decide dirty-tree` | AC-17, AC-25 |
| GIT-11 | A | 10.4 | Integration | AC-25 |
| GIT-12 | A | 10.3 | Hook consent; verification; reported recovery | AC-16, AC-25 |
| GIT-13 | B | 10.8 | State detection | AC-25 |
| GIT-14 | R1 | 10.7 | Cleanup | AC-25 |
| GIT-15 | A | 10.3 | Commit failures | AC-17, AC-25 |
| CON-01 | B | 7.8 | Adoption | AC-08, AC-15a |
| CON-02 | M0 | 7.1, 7.5 | Layout; marker | AC-17 |
| CON-03 | M0 | 2.4.4, 15.3 | Resume | AC-08 |
| CON-04 | A | 7.2, 7.3 | Revisions; lock | AC-17 |
| CON-05 | B | 15.2 | Diagnostic fallback | AC-17 |
| CON-06 | A | 7.5 | Quarantine | AC-08, AC-16 |
| CON-07 | B | 15.3 | Reconstruction | AC-08 |
| CON-08 | B | 7.6 | Admission; eviction | AC-19 |
| CON-09 | M0 | 2.4.3, 6.3 | Stateless class | AC-04 |
| CON-10 | B | 6.5, 7.7, 8.9 | `decide` requests; purge of copies | AC-09, AC-10 |
| CON-11 | B | 7.5 | Relocation | AC-17 |
| CON-12 | B | 7.4 | Effect protocol | AC-17 |
| SEC-01 | M0 | 11.4 | Native permissions | AC-03 |
| SEC-02 | M0 | 2.3, 11.1 | Trust zones | AC-16 |
| SEC-03 | A | 16, 11.3 | No telemetry | AC-11 |
| SEC-04 | A | 9.3 | Envelopes | AC-04, AC-16 |
| SEC-05 | A | 9.11 | Dependency decision; verification before install | AC-16 |
| SEC-06 | A | 11.2 | Hardening | AC-16 |
| SEC-07 | A | 4.5, 11.5 | PRD Section 5.7.1 exception | AC-11 |
| SEC-08 | B | 11.3, 8.7 | Exclusions | AC-16, AC-23 |
| SEC-09 | B | F.2 | Reviewer rubric | AC-16, AC-20 |
| SEC-10 | A | 10.3, 9.7 | No bypass; locks | AC-07 |
| SEC-11 | A | 11.3 | Redaction | AC-11, AC-16 |
| SEC-12 | A | 8.5, 7.5 | Trust; quarantine | AC-16 |
| SEC-13 | M0 | 11.4, 4.6 | Chat questions; per-verb host approval | AC-03, AC-16 |
| SEC-14 | A | 11.3, 9.4 | Default exclusions | AC-16, AC-23 |
| SEC-15 | B | 9.3 | Envelope question | AC-16 |
| SEC-16 | B | 5.2 | Agent-body rules | AC-21 |
| CFG-01 | B | 8.5, 5.1 | `config.md`; `decide config` | AC-23 |
| CFG-02 | B | 8.5 | Catalog consumers | AC-23 |
| CFG-03 | B | 8.5, 7.8 | Configuration | AC-23 |
| CFG-04 | B | 8.5 | `inspect why` | AC-23 |
| CFG-05 | A | 8.5, 7.8 | Configuration | AC-23 |
| CFG-06 | B | 8.5 | Presentation-only | AC-15a, AC-21 |
| CFG-07 | R1 | 8.5, 7.8 | Configuration | AC-09 |
| CFG-08 | B | 7.5, 7.8 | User directory versus shared files | AC-15a |
| CFG-09 | B | 5.2, 7.8, 11.1 | Host context untrusted; charter file | AC-23 |
| CFG-10 | B | 6.4, 8.5 | Idempotency | AC-23 |
| CFG-11 | B | 8.5 | Restriction keys | AC-23 |
| RSC-01 | A | 4.8 | Inherit; qualified researcher economy model | AC-15b |
| RSC-02 | A | 4.8, 7.2, 16 | Requested and resolved model records | AC-15b |
| RSC-03 | A | 11.4 | No billing or routing calls; `host-limit` stop | AC-15c |
| RSC-04 | B | 8.6, 7.2 | Counters; usage reporting | AC-15c, AC-19 |
| RSC-05 | R1 | 8.5 | Serial and Conserve; setup question | AC-15c, AC-23 |
| RSC-06 | Later | 4.8, 20.3 | Later | AC-15b |
| RSC-07 | Later | 8.6, 16 | Later; `UsageObservation` | AC-15c |
| RSC-08 | R1 | 4.8, 17.5 | Qualification table; Deep warning | AC-15b, AC-26 |
| LRN-01 | A | 8.9 | Lessons | AC-09 |
| LRN-02 | B | 8.9 | Lessons | AC-09 |
| LRN-03 | A | 8.9 | Lessons | AC-05, AC-09 |
| LRN-04 | R1 | 8.9 | Lessons | AC-09 |
| LRN-05 | B | 8.9 | Lessons | AC-09, AC-14 |
| LRN-06 | R1.1 | 8.9 | Lessons | AC-09 |
| LFC-01 | R1 | 18, 6.7 | SemVer | AC-10 |
| LFC-02 | R1 | 18 | Release notes | AC-10, AC-11 |
| LFC-03 | B | 15.3, 7.2 | Pinned versions | AC-10 |
| LFC-04 | R1 | 7.7 | Migration | AC-10 |
| LFC-05 | R1 | 18 | Residue; two cleanup scopes | AC-10 |
| QLT-01 | A | 12.4, 12.5 | Starter | AC-20 |
| QLT-02 | R1 | 12.4, 13.3 | ASVS list | AC-20 |
| QLT-03 | R1 | 12.6, 12.7 | Accessibility incl. `manual-affected` | AC-20 |
| QLT-04 | R1 | 12.8 | Logging; health | AC-20 |
| QLT-05 | R1 | 12.7, 14 | Workload as `release`; complexity rule | AC-19, AC-20 |
| QLT-06 | B | 13.4, 8.2 | Traits | AC-20 |
| QLT-07 | R1 | 12.5 | Transactional migrations; backup; locked restore | AC-20 |
| QLT-08 | R1 | 5.1 | `docs.md` | AC-20 |
| QLT-09 | A | 7.8 | Charter | AC-15a |
| QLT-10 | B | F.2 | Reviewer rubric | AC-13a |
| QLT-11 | B | 12.10, 13.4 | Trait inference | AC-20 |
| QLT-12 | A | 12.4 | Identity; exposure | AC-16, AC-20 |
| QLT-13 | B | 5.3.2 | Threat note trigger | AC-20 |
| QLT-14 | B | 12.6 | UI states | AC-20 |
| QLT-15 | R1 | 12.10 | Recorded recipe version; per-file apply check | AC-10, AC-20 |
| QLT-16 | R1 | 12.1, 18 | Monthly refresh | AC-11 |
| QLT-17 | B | 12.9 | Hardening inventory | AC-20 |
| ENG-01 | A | 5 | Agent Skills | AC-01, AC-26 |
| ENG-02 | A | 4.4, 13.1 | Descriptor | AC-03, AC-26 |
| ENG-03 | M0 | 5.1, 5.6, 14.1 | Skill lint; token budgets incl. tool schemas and charter | AC-19, AC-26 |
| ENG-04 | A | 17.1, 17.6 | Tiers | AC-26, AC-28 |
| ENG-05 | R1 | 17.5, 18 | Monthly reruns | AC-26 |
| ENG-06 | R1 | 16 | Export mapping | AC-13a |
| ENG-07 | R1 | 18 | Release chain | AC-11 |
| ENG-08 | R1 | 17.8 | Allowlisted experiments | AC-14 |
| ENG-09 | B | 16 | Log records | AC-13a |
| ENG-10 | A | 17.6 | CI tiers | AC-28 |
| ENG-11 | R1 | 18 | Solo rule | AC-11 |
| OSS-01 | R1 | 18, 3.3 | Release; notices | AC-11 |
| OSS-02 | R1 | 18, 3.3 | Release; notices | AC-02 |
| OSS-03 | R1 | 18, 3.3 | Release; notices | AC-20 |
| OSS-04 | R1 | 12.9 | Starter license; notices | AC-11 |
| OSS-05 | R1 | 18, 3.3 | Release; notices | AC-11 |
| OSS-06 | R1 | 6.5, 16 | `export feedback` | AC-11, AC-21 |
| NFR-01 | R1 | 14, 15 | Performance; reliability | AC-19 |
| NFR-02 | B | 6.6 | Text output | AC-21 |
| NFR-03 | A | 6.1 | Fail closed | AC-03, AC-13b |
| NFR-04 | A | 9.3, 15.2 | Owned process cleanup | AC-17, AC-19 |
| NFR-05 | B | 8.6, 16 | Active time excludes waits | AC-19 |
| NFR-06 | R1 | 6.6, 12.6 | English interaction | AC-21 |
| NFR-07 | B | 16, 11.3 | Redacted diagnostics | AC-11 |

Total: 205 requirements mapped.

## Appendix B. PRD Section 11.4 obligations index

| Obligation area | Answered in |
|---|---|
| Record formats and schemas | 7.2, 7.7 |
| Ownership and concurrency | 7.3, 15.1 |
| Candidate identity | 8.8, 9.4 |
| Lock manifest | 9.7 |
| Git staging | 10.1–10.3 |
| Branch-safe IDs | 7.9 |
| Existing artifacts | 7.5, 7.8 |
| Filesystem boundaries | 11.2 |
| Execution envelopes | 9.3 |
| Process lifetime | 9.3, 15.1 |
| Package management | 9.5, 9.11 |
| Test isolation | 9.3, 12.5 |
| Adapter interfaces and parsers | 9.5, 9.6, 13.2 |
| Repository map | 8.7 (host language services; PA-3) |
| Helper packaging | 3.2, 4.5 |
| Evidence storage | 7.1, 7.6, 9.3 |
| Trace storage | 16 |
| Configuration file | 7.8, 8.5 |
| Capability descriptor | 4.4 |
| Evaluation infrastructure | 17 |
| Starter application | 12 |
| Accessibility | 12.6, 12.7 (UX Spec for Tenet's own interactions) |
| Localization | UX Spec |
| Command syntax and wording | UX Spec (working names: 4.3) |
| Contract and result presentation | UX Spec (data: 6.6, 8.3) |
| Example confirmation | UX Spec (records: 6.5 `decide`) |
| Risky choices | UX Spec (questions: 6.6, 11.4) |
| Findings and evidence inspection | UX Spec (data: 5.4) |
| Research data | Evaluation owner (PRD Section 6.7) |

## Appendix C. Reason codes

Exit: the code produced when the reason decides the response (0 means it appears inside an otherwise successful response, for example as a verdict reason or note).

| Code | Exit | Meaning |
|---|---|---|
| `capability-missing` | 2 | A required host capability is absent |
| `declined-step` | 0 | The user declined a mandatory step |
| `evidence-missing` | 0 | No receipt for a required obligation |
| `stale` | 0 | Receipt not valid for the current check-input identity |
| `evidence-failed` | 0 | Introduced failure |
| `evidence-flaky` | 0 | Required check classified flaky |
| `evidence-inconclusive` | 0 | Receipt failed validation |
| `baseline-failure-excluded` | 0 | Pre-existing failure outside agreed scope (note) |
| `baseline-failure-not-excluded` | 0 | Pre-existing failure not excluded |
| `classification-unknown` | 0 | A sealed baseline passed but the start tree was dirty |
| `basis-element-unverified` | 0 | A basis element has no fresh verification and no reason it does not apply |
| `no-distinguishing-red` | 0 | No behavioral red on baseline |
| `alternative-check-missing` | 0 | Declared alternative check lacks its receipt |
| `review-missing` | 0 | Required review not recorded |
| `reduced-independence` | 0 | Review was not fresh-context where independence is required |
| `review-partial-coverage` | 0 | The Reviewer reported uncovered parts |
| `review-stale` | 0 | Review predates the current basis revision or candidate |
| `major-undisposed` | 0 | A major finding has no disposition |
| `basis-gap-open` | 0 | Review reported an unresolved basis gap |
| `blocker-open` | 0 | Open blocker finding |
| `assumption-unresolved` | 0 | Assumption affecting the claim |
| `locked-test-changed` | 0 | Locked file changed without disposition |
| `integration-unvalidated` | 0 | Integrated tree not rechecked |
| `dependency-unverified` | 0 | A dependency change no verification explains |
| `continue-required` | 2 | Policy requires more work before finishing |
| `kernel-busy` | 2 | Another kernel call holds the lock |
| `work-busy` | 2 | A check is running for this work |
| `owned-by-other-work` | 2 | Another contract owns the workspace |
| `stale-session` | 4 | Older ownership generation |
| `takeover-check` | 3 | The previous generation may still be working |
| `request-mismatch` | 1 | A repeated request ID with different input |
| `revision-conflict` | 2 | Expected revision differs |
| `state-modified-outside-kernel` | 4 | MAC mismatch |
| `marker-mismatch` | 3 | Copied or imported state; quarantine decision |
| `state-recovered-from-backup` | 3 | Fallback to state.prev; grants suspended until reconfirmed |
| `preload-present` | 4 | A preload flag reached the kernel by another launch path |
| `effect-uncertain` | 3 | Intent without result that reconciliation could not resolve |
| `storage-protected-full` | 2 | Protected data exceeds the ceiling |
| `disk-full` | 2 | No space left |
| `snapshot-too-large` | 2 | A prototype snapshot exceeds 20 MB |
| `git-locked` | 2 | Git index lock held |
| `git-identity-missing` | 2 | No commit identity |
| `signing-unavailable` | 2 | Required signing failed |
| `hook-failed` | 2 | A commit hook failed |
| `hook-staged-foreign-path` | 3 | A hook committed or changed non-Tenet paths; commit kept, recovery offered |
| `attribution-unexplained-change` | 3 | A change no declaration or observation explains |
| `attribution-mixed-file` | 3 | Tenet must edit a file with human changes |
| `undo-conflict` | 3 | An inverse patch overlaps a later change |
| `branch-switch-needed` | 3 | Integration will switch the editor branch |
| `repo-state-readonly` | 2 | Rebase, merge, conflicts or detached HEAD |
| `intent-markers-invalid` | 2 | Malformed managed blocks |
| `inventory-too-large` | 2 | Untracked files exceed limits |
| `filter-consent-needed` | 3 | Executable Git filters configured |
| `run-dir-unavailable` | 0 | No writable run directory; raw output not kept |
| `port-in-use` | 0 | A brownfield fixed port is already in use |
| `server-identity-weak` | 0 | Brownfield server identified by port and ancestry only (note) |
| `sealed-deps-unavailable` | 0 | Sealed baseline lacks matching dependencies |
| `concurrent-edit` | 0 | Inputs changed during a run |
| `timeout` | 0 | Obligation timeout |
| `not-executed` | 0 | Process did not run |
| `report-missing` | 0 | Report missing |
| `report-invalid` | 0 | Report failed limits or parsing |
| `report-contradiction` | 0 | Exit status and report disagree |
| `population-mismatch` | 0 | Executed population differs from the obligation |
| `zero-tests` | 0 | No tests executed |
| `focused-tests` | 0 | Focus markers present |
| `adapter-unsupported-config` | 0 | Project configuration conflicts with the reporter |
| `adapter-unsupported-version` | 0 | Tool version outside the supported range |
| `envelope-unknown` | 3 | Unknown network, data or credential exposure |
| `approval-gate` | 3 | Question required under auto-approve or unknown mode |
| `repeated-failure` | 2 | Same failure signature twice or oscillation; sets a stop reason |
| `budget-exhausted` | 2 | A limit reached; sets a stop reason |
| `budget-warning` | 0 | 80% of a limit used (note) |
| `narrow-increment` | 2 | The basis alone exceeds the manifest budget |
| `version-changed` | 3 | Tenet version changed mid-contract |
| `restriction-key-unknown` | 2 | Unknown or malformed restriction key |
| `policy-change-needs-acceptance` | 3 | Shared change needs local acceptance |
| `request-expired` | 1 | A request number at or below the highest seen is no longer cached |
| `model-unqualified-for-deep` | 3 | Deep work on an unqualified or unknown model or configuration; continue or stop |
| `ended-without-finish` | 0 | A turn ended while work was active without finish (note; observer hooks) |
| `dependency-rejected` | 2 | A dependency change was rejected; manifests restored |
| `host-limit` | 2 | The host stopped responding or reported a usage limit; work paused |
| `review-result-invalid` | 2 | Malformed review result |
| `unsupported-record` | 4 | Unknown field in a grant, restriction or consent |

## Appendix D. Sources

Consulted October 15, 2026. Secondary summaries are marked; lessons from them are patterns, not benchmark claims. Host documentation is rechecked during the spikes.

- [Agentless](https://arxiv.org/abs/2407.01489)
- [SWE-agent](https://arxiv.org/abs/2405.15793)
- [OpenHands](https://arxiv.org/abs/2407.16741)
- [MetaGPT](https://arxiv.org/abs/2308.00352)
- [Aider (secondary summary)](https://pyshine.com/aider/)
- [GitHub Spec Kit (secondary)](https://www.augmentcode.com/guides/github-spec-kit-practical-guide-sdd-workflow)
- [Kiro (secondary)](https://www.infoworld.com/article/4023980/from-prompts-to-specs-awss-kiro-signals-the-next-phase-of-ai-coding-tools.html)
- [obra/superpowers (secondary)](https://mintlify.com/obra/superpowers/concepts/workflow)
- [Factory Droids](https://docs.factory.ai/user-guides/droids/understanding-droids)
- [Copilot coding agent firewall](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-firewall)
- [Codex security](https://developers.openai.com/codex/security)
- [VS Code: Agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [VS Code: Agent harnesses](https://code.visualstudio.com/docs/agents/run/agent-harnesses)
- [VS Code: Subagents](https://code.visualstudio.com/docs/agents/run/subagents)
- [VS Code: Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)
- [VS Code: Hooks](https://code.visualstudio.com/docs/agent-customization/hooks)
- [VS Code: Approvals](https://code.visualstudio.com/docs/agents/run/approvals)
- [VS Code: Agent sandboxing](https://code.visualstudio.com/docs/agents/run/agent-sandboxing)
- [Git: gitattributes (filters)](https://git-scm.com/docs/gitattributes)
- [Git: githooks](https://git-scm.com/docs/githooks)
- [Git: environment variables](https://git-scm.com/docs/git)
- [Git: worktree](https://git-scm.com/docs/git-worktree)
- [VS Code: Tools reference](https://code.visualstudio.com/docs/agents/reference/tools-reference)
- [VS Code: Chat checkpoints](https://code.visualstudio.com/docs/copilot/chat/chat-checkpoints)
- [VS Code: Custom agents](https://code.visualstudio.com/docs/agent-customization/custom-agents)
- [VS Code: Memory](https://code.visualstudio.com/docs/agents/memory)
- [VS Code: Testing](https://code.visualstudio.com/docs/debugtest/testing)
- [Cline: Checkpoints](https://docs.cline.bot/features/checkpoints)
- [Playwright: webServer](https://playwright.dev/docs/test-webserver)
- [npm install (package-lock-only)](https://docs.npmjs.com/cli/v11/commands/npm-install/)
- [npm ls](https://docs.npmjs.com/cli/v11/commands/npm-ls/)
- [Git: archive](https://git-scm.com/docs/git-archive)
- [Git: apply](https://git-scm.com/docs/git-apply)
- [Git: revert](https://git-scm.com/docs/git-revert)
- [Node.js: command-line options (NODE_OPTIONS)](https://nodejs.org/api/cli.html)
- [npm exec](https://docs.npmjs.com/cli/commands/npm-exec/)
- [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [SQLite online backup](https://sqlite.org/backup.html)
- [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)
- [GitHub Changelog: Updates to Copilot billing and plans](https://github.blog/changelog/2026-06-01-updates-to-github-copilot-billing-and-plans/)
- [GitHub Docs: Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
- [GitHub Docs: Optimizing your AI usage](https://docs.github.com/en/copilot/tutorials/optimize-ai-usage)
- [GitHub Docs: Usage-based billing for organizations](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises)
- [GitHub Docs: Copilot SDK usage and billing metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing)
- [GitHub Changelog: Per-model token breakdown in the usage report](https://github.blog/changelog/2026-08-11-per-model-token-breakdown-in-the-usage-report/)
- [GitHub Changelog: Auto model selection routes by task](https://github.blog/changelog/2026-05-28-auto-model-selection-now-routes-based-on-your-task-in-vs-code)
- [VS Code: Language models (Auto preferences, thinking effort)](https://code.visualstudio.com/docs/agent-customization/language-models)
- [Zod: JSON Schema](https://zod.dev/json-schema)
- [SQLite: transactions](https://www.sqlite.org/lang_transaction.html)
- [Semantic Versioning](https://semver.org/)
- [OWASP ASVS](https://owasp.org/projects/asvs)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [OpenTelemetry GenAI conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

---

## Appendix E. Review disposition (informative)

Reviews of v0.3: Claude, Sonnet, Grok, GPT and Gemini. Points adopted as proposed are part of the body and are listed in Section 20.2 and Appendix G; they are not repeated here. This table records only points that were adapted, rejected or deferred. Nothing here changes the PRD; PRD changes are proposed in Section 20.3.

| Point | Raised by | Disposition |
|---|---|---|
| Give the Analyst a cheaper model now, reading RSC-01 as limiting only user prompts | Sonnet, Gemini, Claude | Adapted: proposed as PA-6 (Grok and GPT read RSC-01 strictly), approved into PRD v0.16; limited to the researcher role, the model named by release data and only after qualification (4.8) |
| Pin the Reviewer to a frontier model list if Auto downgrades it | Gemini | Rejected: explicit models above the main model's cost tier do not run, and model names change monthly. SP-04 observes Auto's effect; the qualification table labels the result (4.8) |
| One-time suggestion to switch to a stronger model before Deep work | Claude | Adapted: a neutral continue-or-stop warning with no model menu (Grok, GPT); the user may change the model themselves (4.8) |
| One MCP tool for everything | Claude | Adapted: three tools, so read-only calls keep their annotation and the Reviewer gets only `tenet_findings` (4.5) |
| "One delegation is roughly one premium request" in the README | Sonnet | Rejected: under token billing the statement is false. The result shows counts and `usage: unknown` with native pointers (8.6) |
| Host usage fields with quota and reset values in `BudgetState` | Gemini | Adapted: a `UsageObservation` record for later, used only when a host or permitted source supplies values; never estimated (8.6, 16) |
| Billing usage APIs as an integration | GPT | Deferred: authentication stays outside the kernel and the PRD forbids Tenet network connections; recorded as a retirement condition (4.4, RSC-07) |
| Drop `lock.break` and rename a fresh lock over the stale one | Gemini | Rejected: not race-free. `lock.break` keeps liveness by process, never elapsed time (GPT), plus a revision backstop (7.3) |
| Symlink `node_modules` in sealed baselines | Gemini | Adopted, with GPT's concern addressed by redirecting caches and disclosing the shared tree (9.8) |
| Zero-copy manifest files | Gemini | Adopted, with an inline fallback if subagents cannot read the run directory (5.5, TQ-21) |
| Separate check-in intervals from total runtime | GPT | Adopted: active time is measured between check-ins (8.6) |
| Replace the JSON state store if its protocols grow | GPT | Deferred: kept while real-OS fixtures pass; no native SQLite in the kernel (TD-04) |
| Vitest for Tenet's own tests (dogfooding) | Claude | Rejected: Grok and GPT favor `node:test`; Tenet's adapter is dogfooded through its brownfield fixtures instead |
| A setup question about the plan's allowance | Sonnet, Gemini | Adopted as one optional question; Conserve stays the user's choice (Grok) (8.5) |
| `tools/coverage` mention checks | Gemini | Rejected (GPT): mentions are not proof; every Must maps to a fixture instead. The real design gaps Gemini found (RSC-03, RSC-04, RSC-08, RES-09) were fixed (19.2) |
| Observer hooks should stay proposed | Grok | Superseded: the owner approved PA-1 to PA-6 (PRD v0.16); observer hooks still ship only once SP-03 qualifies them |
| Minimal recipe without authentication | Sonnet | Deferred: a registry addition if demand appears (13.6) |

## Appendix F. Agent and skill skeletons

### F.1 `tenet.agent.md` (coordinator)

```markdown
---
name: tenet
description: Governed, test-first engineering loop. Use for /tenet requests to build, fix, refactor, plan, review or continue work.
tools: ['edit', 'read', 'search', 'execute', 'todos', 'vscode/askQuestions', 'agent']
agents: ['tenet-reviewer', 'tenet-analyst']
---
# How you work
You coordinate. The Tenet kernel records every binding fact. Run it as:
  env -u NODE_OPTIONS node "<tenet skill folder>/../../kernel/tenet.mjs" <verb> [flags]
Pass --req (increment it each call) and --gen. Answer questions with --answer <id>=<choice>.
Never edit .tenet/. Never state a verdict, freshness or completion the kernel did not return.

# Loop
1. Pick a profile and run `open <profile>` with the user's request. Say the assistance level and lane once.
2. Before every kernel call: if the user said something new, handle it first.
3. When `next` changes, update your todo list. Choose an action `next` permits.
   Load only the skill for the current phase (tenet-intake for basis and plan, tenet-build for code).
   Search yourself first; dispatch tenet-analyst only if a question remains, passing the model its packet names.
   For review, dispatch tenet-reviewer with the manifest path the kernel returned.
4. Between attempts use `problems` and `testFailure`. Run project tests only through `check`
   (`--targeted` while iterating; without it to submit an attempt).
5. Exit 3: ask the returned questions (channel native → askQuestions; channel chat → plain chat,
   then end your turn), then `decide`. Exit 2: explain and offer `next`. Exit 4 or 5: stop and report.
6. Post check-ins as `progress` and the checkpoints preference call for it. Never auto-confirm a host pause.
7. Never suggest switching model or effort mid-session. After compaction, call `inspect status` once.
8. If `finish` returns continue-required, keep working. Render the result only from the last
   kernel response; show the endpoint label exactly as returned.
Host memory, plans and todos are context, not requirements or permission.
```

### F.2 `tenet-review` (Reviewer)

```markdown
---
name: tenet-review
description: Two-stage independent review of a Tenet review manifest: behavior against the acceptance basis, then structure, security and charter.
---
Read the manifest at the path you were given. Review the candidate it names; you never edit files.
Respect the exclusions listed in the manifest for everything you read.
Work through the closed read list and stop. For each changed exported symbol, find callers with
`usages` (text search if unavailable); with more than 10 callers, open a sample across modules
and record it in coverage.sampled. In recheck mode, review only the named findings.
Stage A (behavior and intent): for each basis element, does the change satisfy it?
  Does each acceptance test truly assert its example (no vacuous assertions, no bypassed setup)?
  What required behavior has no example or check? Report it in basisGaps and coverage.uncovered.
Stage B (structure, security, charter): design, readability, duplication, suppressions,
  dependency changes, new network destinations, credential handling, test or CI weakening,
  and the project charter's rules (QLT-10).
Severity: blocker = violates the basis, an integrity rule, or a security or data-integrity obligation;
  major = material quality or reliability defect; minor; note.
Return exactly one JSON ReviewResult (schema: review-result.schema.json). Give evidence and
locations, not a narrative. List what you did not reach. Write one sentence on cross-module interactions.
```

## Appendix G. Revision record

- v0.1 (October 15, 2026): first draft implementing PRD v0.15.
- v0.2 (October 15, 2026): incorporates four reviews of v0.1.
  - Replaces the object store with one state document; separates the transaction lock from work ownership.
  - Fixes effect ordering, the digest's privacy and write behavior, the verdict shortcuts, lock weakening, attribution, commit hooks, integration and undo.
  - Reduces the surface to 5 skills and 15 verbs, and the kernel estimate to about 4,500–6,000 lines.
- v0.3 (October 15, 2026): incorporates five reviews of v0.2.
  - Adds the native-first rule and the ownership and retirement table; search, references, diagnostics, questions, progress, edit checkpoints and browsing move to the host.
  - Replaces the import map and bucketed packets with review manifests, and `prepare` with a shadow Git repository; adds one verb pipeline and static registries.
  - Fixes undo, hook recovery, state publication, check replay safety, inventory privacy, baseline cost, dependency verification order and authority under Autopilot.
- v0.4 (October 15, 2026): incorporates five reviews of v0.3, focused on the tech stack, token efficiency, model selection and usage tracking under Copilot's token billing.
  - Adds the cost model (14.4): loop-card responses, flag answers, envelope defaults, manifests passed by path, recheck manifests, three MCP tools, a closed reviewer read list, phase-scoped skills and cache-stable sessions.
  - Adds the model policy (4.8): inheritance, a qualification table with Auto as a configuration, a Deep warning, and requested versus resolved model records.
  - Adds honest usage reporting (8.6): complete counters (including launched checks), a Deep budget preview, `usage: unknown` with native pointers, and a spending rule (RSC-03).
  - Refines the stack: zod 4 with built-in JSON Schema, stdio-only MCP imports, a tiny hook entry, compile cache, separate type checking, pinned Node ranges.
  - Fixes canonical content identity across commits, preload clearing at launch, the approval-snippet path, hooks in stateless sessions and the observation merge race, lock breaking for paused processes, takeover without elapsed-time rules, bounded idempotency, progressive undo, exact sealed baselines, dependency rollback, project-wide support-file locks, restore exclusion, attempt counting and delegation reservations.
  - Proposes PA-4 to PA-6 and revises PA-1 and PA-2. The owner approved all six on October 15 (PRD v0.16); Sections 4.5, 4.7 and 4.8 reflect them.
