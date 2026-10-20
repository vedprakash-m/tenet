# Tenet — Implementation Plan & Progress Tracker

> Status: **Active** | Created October 18, 2026 · last restructured October 18, 2026 | Tracks implementation of [PRD v0.17](PRD.md), [Tech Spec v1.3](tech-spec.md), [UX Spec v0.5](ux-spec.md)
> This file is the single source of truth for *implementation progress*. The three specs above remain the single source of truth for *what Tenet is*. This file never redefines their semantics — it only sequences and tracks the work of building what they already specify. **This file does not duplicate numbers or rules the specs already state; it points to them.** Where an earlier draft of this plan copied a value, restated a fallback, or quietly reopened a rejected decision, that was a defect in the plan, not a second source of truth — see §13 for the corrections.

---

## 0. How to use this document (read this first, every session)

**This file is updated by whichever agent or person just did work, before ending their turn.** A handoff is only as good as this file's accuracy — if you did something, record it here before you stop, even if the session is not finished.

### 0.1 Status vocabulary (use exactly these, nothing else)

Because this project's own product principle is "never claim more than the evidence shows" (verdict honesty, PRD Section 4.5), this tracker holds itself to the same standard. A checkbox alone (`done` / `not done`) hides *what kind* of done. Use this five-state vocabulary for every phase, work package, and requirement-level row:

| Symbol | Meaning | Required evidence to mark it |
|---|---|---|
| `☐` Not started | No work begun | — |
| `◐` In progress | Actively being worked | A linked branch, PR, or note below in §13 |
| `✅` Implemented | Code exists; deterministic (T1) tests pass locally and in CI | CI run link or commit hash in §13 |
| `🔬` Observed | Seen working on the real installed artifact on the qualified tuple (T3), not just unit-tested | A dated observation note in §13 with host/model versions |
| `🏁` Qualified | Passed the formal qualification campaign for its milestone; claim is release-ready | Reference to the qualification run/report |
| `⛔` Blocked | Cannot proceed — dependency, decision, or spike outcome missing | The blocking item's ID, referenced in §13 |
| `✂️` Cut | Deliberately deferred via the pre-authorized cut list (§11.2); a narrower claim is recorded in its place | The narrower claim, written out, not just "cut" |

**Never mark something `✅` or `🏁` on the strength of "it should work" or "the logic looks right."** If you're unsure which state applies, use the lower one and say why in §13.

### 0.2 Updating this file

Evidence lives in Git history and CI, not in this file's prose — this file *points at* that evidence, it does not restate it. Keep the update cheap enough that it never competes with actually doing the work:

1. Before starting work, check §1 (dashboard) and the relevant phase section for blockers.
2. Flip individual checklist items (`- [ ]` → `- [x]`) as you complete them — binary, no ceremony.
3. Update a status symbol (§0.1) only when it actually changed, with a commit hash, CI link, or dated observation attached — a symbol with no evidence reference is worse than no symbol.
4. Append to §13 only when something milestone-relevant actually changed (a spike dispositioned, a phase gate crossed, a spec defect found, a decision closed) — not as a mandatory end-of-turn ritual for every session regardless of what happened. A session that made no milestone-relevant progress needs no log entry.
5. Never delete history from §13; correct a wrong past entry with a new one, don't rewrite it.
6. If you find a spec defect while implementing, record it in §12.3 and raise it immediately if it touches a never-waivable requirement (PRD §4.7) — don't quietly route around it.

### 0.3 Precedence, unchanged

PRD owns meaning. Tech Spec owns mechanism. UX Spec owns wording. This plan owns sequencing only — if anything below seems to contradict one of the three specs, the spec wins and this file is wrong; fix this file, don't silently implement the contradiction.

---

## 1. Dashboard (update this first on every session)

| Phase | Status | Started | Exit criteria met |
|---|---|---|---|
| Phase 0 — Alignment | ☐ Not started | — | — |
| Phase 1 — Feasibility spikes & discovery | ☐ Not started | — | — |
| Phase 2 — M0 walking skeleton | ◐ In progress | 2026-10-18 | 0 / 34 Musts qualified · 29 / 34 have a T1 fixture · 4 need the real host · 1 not reachable yet (`node tools/coverage.ts`) |
| Phase 3 — Alpha | ◐ Started ahead of its gate (M0 exit and SP-12 are not met) | 2026-10-19 | 0 / 66 Musts qualified; Git completion (`integrate`, `undo`) implemented, T1-green locally |
| Phase 4 — Beta | ☐ Not started | — | 0 / 58 Musts (0 / 158 cumulative) |
| Phase 5 — R1 | ☐ Not started | — | 0 / 23 Musts + 0 / 16 Shoulds (0 / 181 cumulative) |
| Phase 6 — Post-R1 operations | ☐ Not started | — | — |

**Current focus:** Phase 2 was started on the product owner's direct instruction before the Phase 1 host spikes were dispositioned (this deviates from §6's entry criterion; see §13, 2026-10-18). The kernel, the plugin payload and the T1 suite exist and are green locally. **The standard-lane loop has been run end to end inside VS Code Copilot (two runs, 2026-10-19, see §13)** — plugin load, skill-relative kernel path, kernel calls, a fresh reviewer subagent, commit and finish — so SP-01, SP-08 and SP-02 are `◐`: partly observed, with the gaps listed in §4.1 (reviewer tool restriction and isolation, `usages`, parallel and dead children, plugin data path, instruction-file loading). The qualified tuple is not yet fixed. SP-12 still needs an MCP prototype to compare against.

**Open blockers:** (1) the unobserved halves of SP-08 (reviewer tool restriction and context isolation, `usages`, parallel and dead children, native questions), SP-01 (a long command, enable/disable/uninstall) and SP-02, and all of SP-12; the reviewer's restrictions are the main remaining M0 risk. (2) none now: the bundle budget (750 KB) and the line budget (2,200, no verb or decision file over 250 lines) were decided by the owner on 2026-10-19. Otherwise none: all ten Phase 0 items are resolved (seven were already settled in the specs or fixed directly in tech-spec v1.2; PH0-10's mechanism is fixed and now awaits SP-12's measurement, not a prior decision).

**Qualified tuple (fill in once Phase 1 confirms it):** VS Code desktop ⟨version⟩ · GitHub Copilot Chat ⟨version⟩ · Local harness · ⟨OS/arch⟩ · Node ⟨version⟩ · Git ⟨version⟩.

**Development environment (T1 observations only, not the qualified tuple):** macOS (Darwin 27) · Node v26.3.0 · Git 2.56.0 · Vitest 3.2.7 · TypeScript 5.9.3. The shipped bundle has not been run on Node 22.12 (CI is written to; not yet executed).

---

## 2. Non-negotiable principles for the whole build

These are restated from the specs as execution discipline, because a plan that doesn't encode them drifts from them under deadline pressure. Re-read this list at the start of every phase.

1. **Walking skeleton before width** (tech-spec §19.3, WP-09). Build the thinnest possible version of everything needed for one end-to-end path before widening any single piece.
2. **Ship an operation only with its safeguard, or don't ship it** (tech-spec §19.2, milestone envelope). A commit without index preservation does not ship. A review that can write does not ship. A check without a receipt does not ship.
3. **One pipeline, `runVerb`.** Rules are pure functions. Git, files, and processes sit behind ports. Front-ends never invent verdicts or duplicate policy.
4. **Skills hold the UX rules once.** The kernel returns labels and reasons; skills render the four shapes. Never copy the stop rule, a headline, or a recovery sentence into more than one file — `tools/lint-skills.ts` checks this.
5. **Module budgets are a forcing function** (tech-spec §6.2, §19.4). A module over budget by >25% triggers a decision, not a shrug. The cut list (§11.2 below) is pre-authorized — use it the moment a milestone slips; don't re-litigate it under pressure.
6. **Never-waivable requirements are regression gates from day one** (PRD §4.7): AC-07 (misleading success), AC-11 (privacy/supply chain), AC-16 (security), AC-17 (state/Git recovery), AC-25 (human work never committed or reverted), AC-27 (verdict policy), AC-28 (CI-security). Wire fixtures for these into CI as soon as CI exists, not at Beta.
7. **Native-first is enforced at review time** (§0.6, §4.4 of tech-spec). Every PR that adds a mechanism gets checked against the retirement table — if the host already does it, the PR is wrong however good the code is.
8. **A spike's fallback is load-bearing, not a footnote.** If a spike misses its pass bar, adopt the documented fallback and move on. Spending longer trying to beat a spike result than the spike itself took is a process failure.
9. **Escapes become fixtures, not apologies** (tech-spec §19.3). From Phase 3 (Alpha) onward, Tenet's own development runs through Tenet where the loop can do the work; every defect found after a checked-local result becomes a regression fixture or a golden task, logged in §12.3.
10. **A13 stays rejected; A12 is implemented exactly as adopted** (ux-spec §15.2). Do not reopen the "logical complement" classifier through an implementation shortcut intended to reduce stops. Do not implement a silent branch-switch-on-accept that contradicts the stated `offer`/`auto-on-accept`/`never` disclosure rule in tech-spec §10.4.

---

## 3. Phase 0 — Alignment (record these resolutions, then start spikes — this is not a design phase)

**Purpose:** most of the ambiguity this phase originally listed turned out to already be answered in the specs, or fixable in one sentence plus a fixture — not a reason to delay Phase 1. **Target: a few hours of recording, not days of design.** Three reviews of this plan independently converged on the same correction: do not let "Phase 0" grow new mechanism (a reconciliation engine, a resource scheduler, a call-graph detector) — every item below is now either already settled by the specs, fixed directly in tech-spec v1.2, or a genuine measurement to make during Phase 1 rather than a decision to pre-empt it.

**Exit criteria:** every row is `✅`, each with its one-sentence resolution recorded (already done below for the settled/fixed items) and, where a fixture is named, that fixture exists before the owning phase's work starts.

| ID | Decision | Status | Resolution |
|---|---|---|---|
| PH0-1 | Spike-gating: PRD §10.2 labels most spikes "before Tech Spec," a gate already passed (tech-spec is explicitly a **pre-spike** baseline, §0.2 — drafting ahead of evidence is not the same as approving a design ahead of it). | ✅ | **Tech-spec §19.1's order is the build gate.** SP-01/02/06/08/10 gate M0 code start; SP-12 gates Alpha's front-end lock; SP-03/04/05/07/09/11 run alongside Alpha. Record spike results as they land, then issue a short PRD amendment correcting §10.2's stale table — do not block Phase 1 on rewriting PRD prose first. |
| PH0-2 | Starter domain model: immediate checkout vs. date-range reservations. | ✅ | **Already settled, not open:** tech-spec §12.5 specifies "a unique partial index allows at most one active reservation per item" — the simple immediate-checkout model. Any date-range/overlap language elsewhere is UX-spec illustrative prose, not the DB contract; the DB contract wins. SP-10's fixtures use this model as-is. |
| PH0-3 | Qualification cadence: PRD's monthly full suite vs. tech-spec's narrower reading. | ✅ | **PRD wins until amended; a smoke never renews a full-suite claim.** Run the full native-host suite monthly and on any observed model change; a lighter smoke between full runs is additional signal, never a substitute. Amend tech-spec §17.5 to say this explicitly before R1 qualification planning, not before Phase 1. |
| PH0-4 | Adopted-intent ownership across a branch switch. | ✅ | **Fixed directly in tech-spec v1.2 §7.8:** adopted intent follows the branch like any other committed file; `open`'s existing trust-comparison step re-hashes `INTENT.md` on every call, so a branch switch is handled as an ordinary external edit (diff preview), and no grant or decision crosses a generation boundary. No new reconciliation engine. Fixture: switch between two branches with divergent `INTENT.md`, confirm a diff preview appears and nothing from the old branch's contract is inherited. |
| PH0-5 | One consolidated action-semantics table for `stop`/`cancel`/`undo`/`continue`/`do it`/`accept`/`integrate`. | ✅ | **Already settled:** ux-spec §7.2 and UX-D10 are the single source; nothing to design. Action item is enforcement, not decision: `tools/lint-skills.ts` checks no skill file restates these words with different meaning (§6.6 below). |
| PH0-6 | `runVerb` response built before external-job execution. | ✅ | **Fixed directly in tech-spec v1.2 §6.1:** the response is now explicitly rebuilt from `tx.finalize`'s observed result, not carried forward from the pre-execution plan. Fixture (already specified in tech-spec): a `check` or `finish` whose external job fails must never render the provisional passing response. |
| PH0-7 | Resource compatibility beyond source ownership. | ✅ | **Already covered by existing mechanisms, no scheduler needed:** `sourceOwner` plus `session.inCall`'s `work-busy` rule (§7.3) already serializes conflicting mutating calls on one contract; each check run gets its own run-directory database and an ephemeral port (§9.3); obligations run serially unless declared independent. Add a guard only if a fixture in Alpha actually shows two effects colliding — do not pre-build one. |
| PH0-8 | Integration review for disjoint-but-interacting files. | ✅ | **Fixed directly in tech-spec v1.2 §8.7:** the delta-review trigger now also fires when the base's changes touch a file the host's repository map shows is imported by a reviewed path — reusing the existing `usages`-backed map, not a new call-graph engine, and making no claim beyond this one candidate. |
| PH0-9 | Lock-repair mechanism. | ✅ | **Confirmed, not reopened:** tech-spec §7.3's guarded-break-plus-confirmation design already explicitly rejected a rename-based alternative with its own stated reasoning (TD-05). Validate with the concurrency race test in WP-02 (§6.3); do not re-litigate the design. |
| PH0-10 | Front-end approval-count ceiling: PRD's "≤3 Tenet-caused prompts per Standard task" is a **provisional** target (PRD §1.6), not an invariant — "zero duplicate approvals" is the invariant. Today's blanket-consequential `decide` can produce more prompts than the provisional target describes. | ✅ mechanism fixed, 🔬 pending measurement | **Fixed directly in tech-spec v1.2 §4.6 (TD-44):** `decide`'s approval class is now set per kind (routine kinds like recording a basis or a lesson vs. consequential kinds like a grant or a destructive action), and `decide {propose, answers}` can close in one call when the answer is already known, instead of always costing two. This is a principled reclassification of what each kind already was — not a loosened boundary, and not invented to hit a number. **SP-12 measures the resulting prompt count against this fixed baseline, not the old one** — do not treat the provisional target as met until SP-12 actually observes it. |

**All spikes may start immediately** — nothing above blocks SP-01/02/06/08/10, and PH0-10 is a mechanism fix already applied, not a pending design choice, so SP-12 is unblocked too.

### 3.1 Role assignment (PRD §8.5–8.6 ownership model)

- [ ] Name a technical owner (integrity, mechanisms, kernel)
- [ ] Name a UX/evaluation owner (wording, qualification sessions, calibration sign-off)
- [ ] Name a security owner (threat review before Beta, PRD §5)
- [ ] Name a release owner (supply chain, sign-off, PRD §4.7)
- [ ] Confirm whether one person holds multiple roles (allowed) — record it, since it affects what counts as independent review

---

## 4. Phase 1 — Feasibility spikes & discovery

**Purpose:** confirm or falsify every host-behavior assumption tech-spec v1.2 made before committing engineering time to it. Tech-spec is explicitly a **pre-spike baseline** (its own §0.2) — treat it as a strong hypothesis, not ground truth, until this phase closes each one.

**Exit criteria:** every M0-blocking spike below is dispositioned (pass, or documented fallback adopted) and recorded in the tuple at the top of §1.

**Run in a throwaway directory, never the product tree.** Every result records exact host/extension/model versions, what was *observed* vs. only *documented*, and which product claim it permits (tech-spec §19.1).

### 4.1 M0-blocking spikes (sequenced by risk, highest architectural-reopen risk first)

| Order | ID | Status | What it decides | Pass bar | Fallback if it fails |
|---|---|---|---|---|---|
| 1 | SP-08 | ◐ | Fresh-context Reviewer subagent, tool restriction, parallel dispatch, dead/cancelled children, native questions, `usages` inside subagents | Usable on the qualified tuple | **If this fails, there is no in-place substitute for consequential work:** fresh independence is a Must (AGT-02/REV-01), not a preference, so a failure here means reopening the multi-agent minimum itself, not quietly falling back to a same-session pass. (A focused same-session pass for genuinely *small* tasks is a separate, intentional Beta-only Should — AGT-09 — that exists regardless of whether SP-08 passes; it is not a degraded stand-in for a failed spike.) **This is the single highest architecture-reopen risk in the plan, resolve it first.** |
| 2 | SP-01 | ◐ | Install path, kernel invocation, whether a 15-minute command survives, enable/disable/uninstall | Zero-setup execution; long commands complete | Pinned user-directory copy of `tenet.mjs`; split long checks into per-obligation calls |
| 3 | SP-02 | ◐ | Where preferences/plugin data can be written; which instruction file loads (`AGENTS.md` vs. others); `.tenet/` exclusion from host indexing; token-estimator accuracy | Write paths confirmed; estimator error ≤15% | Preferences not kept; cooperative, disclosed exclusions; margin widened to 25% |
| 4 | SP-06 | ☐ | Inventory at 10k/100k files; temporary-index commit with husky/lint-staged; atomic index sync under concurrent staging and a killed sync; split-index repos | p95 ≤1s on 100k files; zero lost human staged/unstaged content across every race case | Narrower attribution claims; ask before stash-using hook managers; consent before clean filters |
| 5 | SP-10 | ☐ | Vitest/Jest/Playwright/ESLint/tsc JSON normalization on starter (single-active-reservation model, per PH0-2) + brownfield fixtures, including malformed reports | Correct normalization; unsupported cases explicitly reported | Narrower brownfield eligibility (`adapter-unsupported-config`) |

**Local observations made while implementing (not spike dispositions; each spike still needs separate authorization, PRD §8.1):** *SP-06* — inventory of a 10,000-file repository takes about 0.25 s; temporary-index commits, the exact index sync under `.git/index.lock`, a held lock, a split index, and hooks that stage foreign paths behaved as designed in `git.test.ts` and `scenarios.test.ts` on Git 2.56. Added on 2026-10-19 (local): 100,000 files take about 350 ms to inventory clean and with 1,000 edited (`tools/bench-inventory.ts`; 10,000 files about 65 ms); real husky 9 and lint-staged 16 run on the temporary index without touching a person's staged or unstaged edits and leave no stash, and their reformatting of Tenet's file shows as a tree different from the planned one (`hooks.test.ts`); a client killed while holding `.git/index.lock` leaves the index byte-for-byte untouched and `decide sync-index` finishes the job once the lock is gone. Not yet exercised: concurrent staging by a second live process, a split index, a sync killed at its last rename. *SP-10* — Vitest 3.2.7's JSON reporter was inspected on a fixture with an assertion failure, a thrown error, a skipped test, an import error and `.only` (the last two surface as file-level failures and an "Unexpected .only modifier" failure under `CI=1`); the adapter normalizes these. Jest, Playwright, ESLint and tsc are not built. Vitest 5.0.5 produced the same normalized result on the same fixture, and the scaffolded starter runs under it end to end. The supported-version range (Vitest 2–5) in `adapters/node-ts.ts` is two observations and a guess for the versions between.

**Host observations, 2026-10-19 (SP-08, SP-01, SP-02; authorized by the owner for these three only; run by the development agent, with the owner's Copilot account in a separate VS Code profile).** Host: VS Code 1.142.0, profile `tenet-spike`, a throwaway TypeScript fixture, macOS, model "GPT-6.1 Sol" (managed by the account's organization), manual terminal permissions. The Copilot extension version and the qualified tuple were not recorded. Copilot CLI 1.0.99 was run first with `--plugin-dir`; its results are hypotheses for the VS Code tuple, not observations of it.
- **SP-01, observed on VS Code.** The plugin loads from `chat.pluginLocations`. VS Code keeps a snapshot copy under `~/Library/Application Support/Code/agentPlugins/<path>/<nonce>/`; the kernel ran from that copy as `skills/tenet/../../kernel/tenet.mjs`, so a skill-relative path works. The first run used a snapshot older than the source (edits are not picked up until the host refreshes it; deleting the copy made it recreate it on the next chat). The model ran the kernel through `env -u NODE_OPTIONS node …` from the terminal tool; the first run needed one approval ("Allow in this Session" for terminal commands), and later kernel calls needed none. Not observed: a 15-minute command, enable, disable, uninstall.
- **SP-08, partly observed on VS Code.** The coordinator dispatched the reviewer as a subagent; the reviewer read the manifest from the OS temp folder (this raised a separate "Allow reading file outside of workspace?" prompt in the second run and none in the first; the cause is unobserved), and returned a result the kernel accepted (`findings` exit 0; one delegation, one review round; recorded as `subagent-fresh`, which is the reviewer result's own claim, not host proof). Two runs of the same task ended `implemented-unverified` (the model left a basis assumption unresolved) and `checked-local`, committed on a work branch. The `tenet` agent was not selected in the second run (`code chat -m tenet` does not select a plugin agent); the loop ran from the skill alone. **Not observed:** the reviewer's actual tool list, whether its context is isolated, parallel dispatch, dead or cancelled children, native questions, `usages`.
- **SP-02, barely observed.** The kernel wrote `.tenet/` in the project and read the OS temp folder (with the prompt above). Plugin data path, which instruction file loads, `.tenet/` indexing exclusion and estimator accuracy are unobserved.
- **Copilot CLI 1.0.99 (hypotheses).** Needs `--add-dir <plugin>` for the kernel call (a read outside the working folder is refused otherwise); agent IDs are `plugin:agent`; a plugin with a wrong `$schema` was treated as legacy and its agents were not found; skills with an unquoted colon in the description failed to parse; the reviewer subagent has only read and search tools and could not load a skill, so the manifest now carries the rubric and a result template. All four are fixed in the plugin (see §12.3).

**Note on PRD §10.2's broader gate:** PRD's feasibility register lists eight spikes (adds SP-05, SP-11) under "before design approval." Per PH0-1's resolution, tech-spec's narrower M0-blocking set above is the code-start gate; SP-05 and SP-11 still need to close before this project claims full PRD-gate-2 "design approved" status, but that claim is separate from, and does not block, starting to write code.

### 4.2 Gates Alpha's front-end lock, not M0's code start

| ID | Status | What it decides | Depends on |
|---|---|---|---|
| SP-12 | ☐ | CLI vs. MCP front-end: prompts per Standard task (measured against the TD-44 baseline, §3 PH0-10), schema tokens, retyping, approval-mode observability, cancellation behavior | Installation (SP-01), storage (SP-02), and a working vertical slice to run representative flows through — not merely PH0-10, which is already fixed in the spec |

### 4.3 Runs alongside Alpha (lower individual risk, non-blocking for M0)

- [ ] SP-03 — hooks: reliable `PostToolUse`/`SubagentStart`/`SubagentStop`/`Stop` payloads, no noticeable latency. **Fallback (default assumption): observer hooks do not ship.**
- [ ] SP-04 — models: observable resolution, `Auto` behavior, cost-tier checks. **Fallback: labels stay `unknown`; inherit.**
- [ ] SP-05 — usage signals: what's observable about requests/credits/cancellation. **Fallback: Tenet counters + `usage: unknown`.** Evaluation-funding dependency (Q-16) is tied to this, and funding must be confirmed before Alpha's golden-task spend begins, not merely "before publication."
- [ ] SP-07 — update/removal: state and overrides preserved across native update/disable/uninstall. Must complete before public Beta, not just "alongside Alpha."
- [ ] SP-09 — Copilot CLI: same skills/calls work. **R1.1-scoped — do not let this become an accidental R1 dependency.**
- [ ] SP-11 — native-host evaluation: unattended runs, ToS compliance, cost, secret isolation. **Fallback: scheduled manual T3 runs, published traces.** Must complete before Alpha's golden-task campaign is trusted as evidence rather than a manual procedure; its funding is the same Q-16 dependency as SP-05.

### 4.4 Discovery (runs in parallel, zero code dependency)

- [ ] Interview 5–8 technical builders (PRD's discovery protocol)
- [ ] Observe current native-Copilot workflows for recurring coordination costs
- [ ] Collect representative dirty, broken, unfamiliar, and constrained fixture projects for later use in T1/T2/T3 fixtures
- [ ] Recruit the Beta/R1 qualification cohort early (8–12 participants needed by R1 — PRD §6.6) so scheduling isn't a late blocker

### 4.5 Owner-gate items (not code, must close before publication, can run anytime during Phase 1–2)

- [ ] License chosen
- [ ] Project name finalized
- [ ] Evaluation owner and account/budget confirmed
- [ ] Research-data retention values confirmed (90-day default per PRD §6.7, already reflected in ux-spec §14.3)
- [ ] Second maintainer identified (or explicitly deferred with a documented single-maintainer risk acceptance)

---

## 5. Day-1 repository & build scaffolding

Create this once, at the start of Phase 2 (not before — don't build infrastructure speculatively ahead of the first vertical slice). Layout follows tech-spec §3.1 exactly.

### 5.1 Repository layout

- [x] `package.json` — private workspace root, `engines.node >= 22.12.0`, single lockfile *(the TypeScript sources need Node 24+ to run directly; only the bundle targets 22.12)*
- [x] `tsconfig.json` — strict, NodeNext, isolatedModules, `noUncheckedIndexedAccess` *(plus `erasableSyntaxOnly`, so Node runs the sources without a build)*
- [x] `packages/kernel/src/core/` — pure, total functions only; **zero** `node:fs`/`node:child_process`/adapter imports *(enforced by `tools/lint-arch.ts`, a 60-line import scanner with its own failing fixtures, instead of adding ESLint)*
- [x] `packages/kernel/src/verbs/` — one module per verb *(plus `common`, `facts`, `manifest`, `recover`, `dirty`, `commit`-job helpers that more than one verb shares)*
- [x] `packages/kernel/src/decisions/` — a registry; `basis` has its own module, the small kinds share `simple.ts` until one grows
- [x] `packages/kernel/src/pipeline.ts` — `runVerb` orchestration
- [x] `packages/kernel/src/adapters/` — `store-fs.ts`, `git-cli.ts`, `runner.ts`, `node-ts.ts` *(front-ends live in `frontends/`, the composition root is `wire.ts`)*
- [x] `packages/kernel/test/` — T1 suite
- [ ] `packages/fixtures/` — repo/process builders (clean, dirty, hostile, malformed) *(builders live in `packages/kernel/test/support/` and `test/fixtures/` for now; hostile and malformed corpora are not built)*
- [x] `plugin/` — published payload (agents, skills, commands, schemas) *(`$schema` is now the agent-plugins.org 1.0.0 URL, observed to load on Copilot CLI and VS Code, 2026-10-19)*
- [x] `tools/` — `build.ts`, `lint-skills.ts` *(and `lint-arch.ts` and `coverage.ts`, added because they paid for themselves at once)*; `coverage.ts`, `release-audit.ts`, `eval-experiment.ts` are added when Alpha/R1 actually need them (§5.2) — building them on day one is exactly the kind of infrastructure-ahead-of-the-slice this plan otherwise warns against
- [ ] `eval/` — golden tasks, grader runner, replays, experiment manifests *(Alpha)*
- [ ] **Leave out for now:** `mcp.json`, `hooks.json` — these appear only once SP-12/SP-03 qualify them respectively

### 5.2 Day-1 tooling scripts

**Day 1 needs exactly enough tooling to write and test the first slice — not the release chain.** Build these two and stop:

- [x] `tools/build.ts` — `tsc --noEmit`, esbuild bundle to one `tenet.mjs` *(minified: the unminified bundle is 903 KB against the TS §14.1 budget (600 KB, raised to 750 KB on 2026-10-19), almost all of it zod; the minified one is 553 KB. See §12.3)*. **Defer until Alpha:** `SHA256SUMS`/`NOTICE`/reproducible double-build verification (that's R1's release-chain concern, §9.5, not a day-1 need)
- [x] `tools/lint-skills.ts` — enforces token/size budgets (tech-spec §5.1); checks that an action-semantics word (§6.6 below) and each headline occur in exactly one file **as a structural/reference check (does the word appear in more than one skill file), not a semantic-duplication detector** — a linter cannot verify two paraphrases mean the same thing, only that there's one canonical location; semantic review stays a human job
- [x] CI: read-only, no secrets, runs T1 on every PR *(`.github/workflows/untrusted.yml` ran green on ubuntu and macOS at `b8c2114`)*

**Explicitly deferred past Day 1, each to the phase that actually needs it:** `tools/coverage.ts` (earns its keep once there are fixtures to map against a milestone — start it alongside WP-08, not WP-01); `tools/release-audit.ts` and reproducible-build verification (R1, §9.5); `tools/eval-experiment.ts` (Alpha's golden-task work, §7.5).

### 5.3 Dependency policy

- [x] zod — sole mandatory kernel dependency
- [x] esbuild — build only
- [ ] MCP SDK — included only if SP-12 selects MCP
- [x] `node:test` + `fast-check` — kernel dev/test only, never shipped *(`vitest` is a dev dependency only so the fixture projects can run it)*
- [ ] Starter's dependencies stay fully separate from the kernel's (no shared lockfile, no shared test framework requirement)
- [x] Lint bans in kernel code: `vm`, worker threads, computed dynamic `import`, client sockets *(client sockets are banned outright: `net`, `http`, `https`, `dgram`, `tls`)*

---

## 6. Phase 2 — M0 walking skeleton

**Entry:** Phase 1's five M0-blocking spikes dispositioned; Phase 0 fully closed. *Not met when this phase started (2026-10-18): started on the product owner's direct instruction; host spikes SP-01/02/08 are unobserved and §3.1 role assignment is open (§13).*
**Exit:** all 34 PRD Musts tagged M0 pass on the qualified tuple; `tools/coverage.ts --milestone M0` is green; the walking-skeleton scenario (§6.9) passes including its three injected-failure cases.
**Estimate:** 4–5 weeks, recalibrated the moment §6.9 first goes green (tech-spec §19.4) — update this section's estimate honestly once that happens, don't silently keep the original number.

**Build order is dependency-driven, not work-package-number order.** Do not fill a package completely before the slice above it runs end-to-end — this is the single highest-leverage sequencing rule in this whole plan (prevents "five complete subsystems that don't compose," tech-spec §21's named Medium/High risk).

```mermaid
graph TD
    A["WP-05 Pure rules, first slice only<br/>verdict rows + schemas this slice needs — no I/O"] --> F["WP-09 Walking skeleton<br/>open→decide→check→finish→review"]
    B["WP-01 Pipeline + schemas + CLI front-end, M0 verb subset"] --> F
    C["WP-02 State store: doc, lock, call identity, effects"] --> F
    D["WP-03 Git adapter: snapshot, inventory, commit, index sync"] --> F
    E["WP-04 Runner + Vitest adapter + receipts"] --> F
    R["WP-06, minimal slice only: Reviewer agent dispatch + manifest<br/>(the skeleton needs fresh review to work, not full skill prose)"] --> F
    F --> G["Widen WP-06: coordinator body + tenet-intake/build/review skills"]
    F --> H["Widen: WP-07 starter template + scaffold"]
    G --> I["WP-08 T1: real-OS + composition scenarios"]
    H --> I
```

**WP-09 needs a working Reviewer dispatch to prove "fresh review," not the full coordinator/skill prose.** The earlier version of this diagram put the whole of WP-06 after WP-09, which is wrong — the skeleton scenario (§6.9) explicitly includes "fresh review" as one of its steps, so a minimal Reviewer-agent slice (dispatch, bounded manifest, findings back) is a WP-09 dependency, not something that waits for it. The *rest* of WP-06 (coordinator body, `tenet-intake`/`tenet-build`/`tenet-review` skill prose, the four rendered shapes) still correctly waits until after WP-09 passes, since that's where "don't write skill prose against call shapes that haven't been proven to compose yet" actually applies.

### 6.1 WP-05 — Pure core rules (build first; zero I/O, fastest to test) — **first-slice scope only**

**The first slice needs only the verdict rows and schemas it actually exercises — not every state machine.** Build exactly enough to make `open → decide → check → finish → review` honest for one fixture; defer the rest explicitly, rather than building the full module set here and discovering non-composition at WP-09 (the mistake this rule exists to prevent):

- [x] `core/schemas.ts` (≤400 LOC) — zod inputs/records/outputs **for the M0 verb subset only** (§6.2) *(367 lines)*
- [x] `core/risk.ts` (≤150 LOC) — lane floor calculator (Quick/Standard/Deep) **and** the L0–L4 assistance-level function (TD-43) — tech-spec's own module map (§6.2/§8.2) places both in this one module, not split across `risk` and `authority`
- [x] `core/verdict.ts` (≤300 LOC) — only the endpoint rows this slice can reach: `blocked`, `findings-only`, `implemented-unverified`, `checked-local` (no `prototype` yet — that needs the shadow-Git path, deferred to WP-03's later widening)
- [x] `core/budget.ts` (≤150 LOC) — *(77 lines; it is a little more than the minimal slice because fresh-review binding needs reservations and settlement from day one, and the walking skeleton needs review)* **minimal:** an attempt counter and a stop condition only; full reservation/delegation/failure-signature-loop machinery widens in during Alpha when the Analyst and parallel dispatch exist to need it

**Explicitly deferred past the first slice, built when WP-09 is green and widening starts:**
- `core/lifecycle.ts` — plan-item/requirement/example/finding state machines beyond what one fixture's one requirement needs
- `core/authority.ts` — grants, action classes, scope, decision binding (needed once `decide`'s consequential kinds exist, i.e. once there's more than one kind to classify)
- `core/review.ts` / `core/obligations.ts` / `core/config.ts` / `core/attribution.ts` — build each when the package that needs it (WP-03/WP-04/WP-06 widening) actually calls it, not speculatively here
- The remaining PRD §4.5.2 verdict-table rows (`prototype` and its reasons) and `integration` setting handling (A12, tech-spec §10.4) — add these once WP-03 widens to the shadow-Git/integrate path

- **Verification:** fast-check property tests + one fixture per verdict-table row this slice reaches (AC-27 applies to the full table once it's all built, later in M0) — write these fixtures *before* the skill prose that will render them

Status: ✅ Implemented — CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) green on ubuntu and macOS at `b8c2114` (`npm run ci`, 177 tests, bundle also run on Node 22.12.0). Also built because the loop needed them: `core/attribution`, `core/exclusions`, `core/obligations`, `core/review` (manifest, net-per-hunk attention, review chain), `core/handoff`, `core/controls`, `core/state`. The `prototype` row of the verdict exists in the pure function; the shadow-Git path it needs does not.

### 6.2 WP-01 — Pipeline, schemas, CLI front-end

- [x] zod schemas for the **10-verb M0 subset**: `open`, `decide`, `check`, `findings`, `finish`, `review`, `inspect`, **`stop`, `commit`, `packet`** (WRK-10 and GIT-03 are both M0 Musts; `stop cancel` racing a check and a mid-contract `commit` checkpoint both need fixtures in WP-08 — `integrate`, `undo`, and `publish` are the ones that genuinely wait for Alpha)
- [x] `pipeline.ts`: parse → class → lock → pure plan → in-lock effects → publish → external jobs → **rebuild the response from the finalized result** (tech-spec v1.2 §6.1 now states this explicitly — implement it exactly, including the "provisional until finalize" distinction for calls with no external job)
- [x] Response envelope: completed effects, uncertain effects, next action (loop-card shape, tech-spec §6.6)
- [x] CLI front-end only (`frontends/cli.ts`) — no MCP yet
- [x] `inspect doctor` — reports Node/Git versions, whether `.tenet/` is writable

Status: ✅ Implemented — CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) green on ubuntu and macOS at `b8c2114` (`npm run ci`, 177 tests, bundle also run on Node 22.12.0). Verified: a job's provisional response is never cached (a retry after a crash would otherwise be answered with an unobserved result) and a check finishing after `stop cancel` publishes nothing (`run-superseded`). `kernel.payloadHash` and the kernel-location check are not built (§12.3).

### 6.3 WP-02 — State store

- [x] `adapters/store-fs.ts`: state document, append-only effect log, hash-named blobs, marker *(user-directory preferences are not built; nothing needs them for correctness, TS §7.5; `putBlob`/`readBlob` exist but nothing archives into them yet)*
- [x] Transaction lock with guarded breaking by process liveness (confirm PH0-9's decision is implemented, not reopened)
- [x] Call identity per contract; source ownership tracked separately from lock-holding *(call identity also hashes the working tree for `check`, `finish`, `commit` and `packet`, §12.3)*
- [x] Two-phase effect protocol: intent record before a side effect *(built for the commit, the only non-repeatable effect in M0; dead check runs are discarded and their process groups stopped)* → postcondition verification on recovery → result record
- **Verification:** real-OS multi-process race tests — competing writers, paused-process liveness, dead `lock.break` recovery, crash recovery at all four effect-protocol steps

Status: ✅ Implemented — CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) green on ubuntu and macOS at `b8c2114` (`npm run ci`, 177 tests, bundle also run on Node 22.12.0). Real-OS tests: three processes racing 45 writes with no lost update; dead holder broken; dead `lock.break` refused until `repair-lock`; a SIGSTOPped holder is not broken; torn log line truncated; copied `.tenet/` detected; commit killed at each of its four steps (before intent, after intent, after act, after result) and recovered to exactly one commit.

### 6.4 WP-03 — Git adapter

- [x] `inventory()` — exclusion-aware, operation predicates, Git blob identities, never mutates the user's index
- [x] Start snapshot + file-level attribution by the last-check rule (`user-dirty-at-start`, `tenet-modified`, `user-concurrent`, `mixed`); a mixed/overlapping file triggers one specific chat question (per ux-spec J-03b, including the "edit in place, don't commit" option added in the last review round)
- [x] Temporary-index commit helper: stage only Tenet-owned paths, commit, verify parent + path-subset postconditions, **atomic index sync under `.git/index.lock`** preserving every human staged/unstaged entry byte-for-byte, with the documented untouched-index fallback on contention
- [x] Honor `--no-commit` (`finish`) when the user says "don't commit" for the task
- [x] Shadow Git repository for non-Git prototypes *(`.tenet/git`; `open prototype --no-git`; a snapshot at open and at every check; secrets, dependencies and build output excluded; over 20 MB refused; endpoint `prototype`; `prototype.test.ts`)* (build only after a real-repository commit works, per TD-26)
- **Verification:** Git preservation fixtures with staged/unstaged human hunks, husky/lint-staged mutation fixtures, concurrent `index.lock` contention, a killed sync

Status: ✅ Implemented — CI run [39363563698](https://github.com/vedprakash-m/tenet/actions/runs/39363563698) green on ubuntu and macOS at `da40ede` (196 tests). Includes the shadow repository, `decide sync-index` and support locks. Not covered: a sync killed mid-way, husky and lint-staged themselves (equivalent hook scripts only), 100,000-file inventory.

### 6.5 WP-04 — Runner, Vitest adapter, receipts

- [x] `adapters/runner.ts` — direct binaries (never `npx`), detached process groups for clean-tree kill, sanitized environment
- [x] `adapters/node-ts.ts` (Vitest slice only for M0) — parses Vitest JSON, verifies non-zero executed test count, binds receipts to candidate digest
- [x] Whole-file acceptance test locks (TD-11) *(anchored to the first commit that contains them and applied by ancestry, TS §9.7)*: once a test file passes red→green, lock its blob OID; any later edit/rename/mock needs a disposition
- **Verification:** misleading-success traps (AC-07) — vacuous assertions, skipped tests, compile-error-as-red, support-file weakening, mutated locked test

Status: ✅ Implemented — CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) green on ubuntu and macOS at `b8c2114` (`npm run ci`, 177 tests, bundle also run on Node 22.12.0). Traps covered: support-file and runner-configuration weakening, vacuous red, compile-error-as-red, skipped, focused, mutated locked test, forged contradictions (exit and report disagree). Support-file weakening is covered too: an example declares `support` files, which are locked with the test together with the runner configuration (`scenarios`). **Not covered:** Jest, Playwright, ESLint and tsc.

### 6.6 WP-06 — Coordinator, Reviewer agent, core skills

**Build in two slices, not one** (the DAG in §6 above): a minimal Reviewer-dispatch slice feeds WP-09 directly; the full coordinator/skill prose widens only after WP-09 passes.

**First slice (feeds WP-09, build alongside WP-01–05, not after):**
- [x] `tenet-reviewer` agent: read-only tools only *(dispatched as a real subagent on VS Code 1.142.0 in two runs, 2026-10-19, and returned results the kernel accepted; its tool restriction and context isolation are still unobserved: SP-08)*, dispatch with a bounded manifest, returns findings — just enough to prove fresh-context review actually works on the real harness
- [x] Minimal `tenet-review` skill: the rubric and the zero-write guarantee *(the full rubric from TS §5.4 is in)*, nothing else yet

**Widen only after WP-09 is green:**
- [x] Coordinator agent body + `tenet` skill: *(written; not exercised by a real model)* inspect-vs-act routing, the four shapes, headline wording sourced from `Result.label`, one-teammate voice
- [x] `tenet-intake` skill: kickoff card, *(the kickoff card itself is in the `tenet` skill; thin-answer follow-up and the AGENTS.md draft offer are not in the text yet)* the one-stop rule exactly as ux-spec UX-D1/A13 state it — **the kernel never classifies an unstated-but-inferred boundary case as "the user already said it"; only an element literally in the user's own words is `origin: request`. A13 is rejected, not pending — do not write skill prose that reintroduces an entailment exception** — grouped questions (≤3), front-loaded consents (UX-D16, hook consent asked once before first commit — not invented at kickoff), one real follow-up on a thin new-project answer before drafting the plan (never a second round on an already-substantive answer), and the one-time AGENTS.md-conventions draft offer when the loaded instruction file has no content of its own yet (tech-spec v1.2 §5.4 practice rules, ux-spec J-02)
- [x] `tenet-build` skill: test-first inner loop, dirty-tree/integration wording
- [x] Widen `tenet-review`/`tenet-reviewer` with the full rubric and packet retry handling
- [x] `tools/lint-skills.ts` passes: budgets held, every action-semantics word (ux-spec §7.2) appears in exactly one skill file

Status: ◐ In progress — payload and lint exist and pass in CI (CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) green on ubuntu and macOS at `b8c2114` (`npm run ci`, 177 tests, bundle also run on Node 22.12.0)) (the three coordinator skills load about 3,800 of the 12,000-token budget). Nothing in the skills or agents has been run by a model, so none of it is observed; the skills' quality is untested until a golden task (Alpha) or a real session exercises them. The tenet-analyst agent is not shipped (Analyst is out of M0).

### 6.7 WP-07 — Starter template (build last, after the skeleton proves the loop)

- [x] Resolve PH0-2 (domain model) before writing the schema *(no domain schema exists: only the platform layer ships; the reservation model arrives with the first feature)* — already settled as the single-active-reservation model (§3 above)
- [x] Single-package TypeScript + Node app per tech-spec §12.1 stack (TD-20) *(server only: Fastify 5, zod, SQLite; no React, Vite, Playwright, OpenAPI or workload yet; CSRF is built in rather than using `@fastify/csrf-protection`)*
- [x] Pre-verified lockfile; `npm ci --ignore-scripts` install path *(pinned by hash in `recipe.json`; Vitest 5.0.5 because 3.2.7 has a critical advisory in its dependencies; `npm audit` reports 0 vulnerabilities on 2026-10-18)*
- [x] **Platform layer ships complete in the scaffold effect** *(config, db, migrations with a verified backup, auth, sessions, CSRF, errors, logging, health; the restore tool is not built)* (`platform/`, §12.4 security decisions, migration runner, build/CI/lint config) — this is vetted, pinned recipe content, not rebuilt per project, so it's intentional that it ships at once rather than incrementally. **Feature content does not:** `features/<f>/` starts empty; the first plan item's build step is what populates the first feature, so what you read first is the smallest slice you asked for, not the platform (tech-spec v1.2 §12.2, now explicit — this was previously a disagreement between this plan and tech-spec; it's resolved)
- [x] Starter-specific `protected_paths` default proposed at scaffold time *(applied unless declined with `protectDefaults: false`)* (`platform/auth/*`, `platform/session/*`, `migrations/*`), shown in the same kickoff preview, declinable
- [x] `decide scaffold` (not `open --scaffold`; the effect needs a recorded basis first): copy template → verify lockfile hash → install → initial `check` *(real run: 8 s, the starter's 22 tests, typecheck and lint pass under the kernel)* so the user starts from a green baseline

Status: ✅ Implemented for the platform layer — CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) green on ubuntu and macOS at `b8c2114` (`npm run ci`, 177 tests, bundle also run on Node 22.12.0) (the real `npm ci` ran in CI). The scaffold is a non-repeatable file effect with all four crash points tested, never overwrites, rolls back a partial write, and retries only a failed install. Not built: web UI, Playwright/axe journeys, workload, restore tool, ESLint-in-the-kernel obligations. Starter quality (§9.1) is untouched.

### 6.8 WP-08 — T1 test suite (grows continuously alongside every package above, not a separate phase)

- [x] Verdict truth table (one fixture per row) *(`verdict.test.ts`: every row the pure function reaches, plus monotonicity properties; Appendix C is covered 38 of 96 codes, which is expected this early)*
- [x] Git preservation fixtures *(staged and unstaged human hunks, a path the human staged differently, `index.lock` contention, a hook that stages a foreign path, a failing hook)*
- [x] One kill test per commit step *(before intent, after intent, after act, after result; all recover to exactly one commit)*
- [x] Composition case: Tenet adds an example → `basis-confirm` fires exactly once
- [x] Composition case: a request with **no new requirement at all** (a bug fix, a refactor, selected review fixes) does not stop
- [x] Composition case: a new requirement whose user's own words **literally state** every boundary case (origin: request for every element, nothing inferred) does not stop — this is the genuine zero-stop path, and it is different from the rejected A13 idea: nothing here classifies an *unstated but logically implied* case as "the user already said it." A fixture that expects a stop-free path for an *inferred* boundary case is testing for A13 and should fail.
- [ ] `tools/coverage.ts` green for every M0-tagged requirement *(the tool exists and exits 0: 29 of 34 M0 Musts carry a T1 fixture tagged `[REQ-ID]` in its title; INS-01, INS-03, INT-01 and SEC-01 can only be shown on the real host; SEC-13 has nothing to test until a remote, destructive or content-sending verb exists. "Green" here means a fixture is mapped, not that the requirement is qualified, §12.1)*

Status: ✅ Implemented — CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) green on ubuntu and macOS at `b8c2114` (`npm run ci`, 177 tests, bundle also run on Node 22.12.0). Also covered: the AC-07 traps above, review binding (stale or replaced attempts, same-session independence, blocker then focused recheck), budgets (warn at 80%, repeated failure, exhaustion), idempotency, generations, ownership, zero-write review and inspect, hook consent, locks by ancestry, parking and resuming. The test scripts that stand in for the Reviewer return a hand-written result; they prove the kernel side only.

### 6.9 WP-09 — Walking skeleton (the actual gate, not a demo at the end)

Run this the moment the thinnest possible version of WP-01/02/03/04/05 **and WP-06's minimal Reviewer-dispatch slice** compiles together — before widening any of them further. This needs a real native subagent dispatch, not a stub, because "fresh review" is the exact thing this scenario exists to prove composes.

- [ ] One fixture repository, `open → basis → red test → green → fresh review → checked-local` *(T1 passes with a scripted reviewer; on VS Code 1.142.0 the loop ran end to end twice on a throwaway fixture with a real subagent on 2026-10-19 — `checked-local` once, `implemented-unverified` once. Left unchecked: the reviewer's tool restriction and isolation are unobserved, and the qualified tuple is not fixed)*
- [x] **Injected failure 1:** *(T1)* one concurrent human edit on an overlapping file → verify the dirty-overlap question and exact human-content preservation
- [x] **Injected failure 2:** *(T1; real SIGKILL of a real kernel process, orphaned runner found and stopped, clean rerun)* `SIGKILL` during `check` → verify process-group cleanup and a clean rerun
- [x] **Injected failure 3:** *(T1; at all four effect-protocol steps)* crash mid-commit before the effect's result record → verify postcondition reconciliation on the next call, no duplicate commit
- [x] Review creates zero project files; a clear bug fix needs no preview; a Tenet-added example stops exactly once
- [ ] Begin dogfooding: *(not started: it needs the plugin running in the host)* from this point, Tenet's own development runs through Tenet wherever the loop can already do the work

**M0 explicitly excludes (do not build yet):** undo, integrate, the Analyst agent, configuration sharing, Jest/Playwright/ESLint normalization, hooks, MCP. Remote push exists only as a refusal unless explicitly requested, and even then waits for the authority question.

Status: ◐ In progress — the T1 half of the scenario passes in CI; the real-subagent dispatch and dogfooding do not exist yet. **The estimate in §6 has not been recalibrated** because the gate ("first goes green" with a real dispatch) has not happened.

---

## 7. Phase 3 — Alpha (core loop completion)

**Entry:** M0 exit + SP-12 resolved (front-end locked).
**Exit:** all Musts tagged M0 or A pass (100 cumulative); 10 golden tasks run; 6 formative UX sessions completed.
**Estimate:** 5–7 weeks.

### 7.1 Front-end lock (week 1 of this phase)

- [ ] Implement SP-12's chosen front-end exclusively; **delete the other, don't maintain both**
- [ ] If MCP: four tools by verb risk class, same `runVerb` pipeline underneath
- [ ] Trigger-based approval-rule tip (after the 2nd routine approval in a session, per ux-spec UX-D15) — not buried behind the adopt/share offer queue

### 7.2 Decision registry, managed blocks, config

- [ ] All `decide` kinds implemented over one registry (TD-27); *(the registry exists with 12 kinds: basis, scaffold, dirty-overlap, acceptance, disposition, repair-lock, unexplained, hook-consent, sync-index, branch-switch, config, undo-confirm; forget, delete-records, cleanup, remote, adopt, grant, dependency, export and the content kinds are not built)* answers bind to the facts shown (`factsHash`), not the whole revision
- [ ] Managed Markdown blocks in `INTENT.md` (and `docs/architecture.md`, `docs/hardening.md`): preserve user prose outside Tenet's markers; malformed markers → `intent-markers-invalid` (already specified in ux-spec §10)
- [ ] **PH0-4's branch-reconciliation decision implemented and fixture-tested** before this is considered done
- [ ] `tenet.policy.json` structural trust comparison: automatic tightening, loosening/unknown needs explicit confirmation; `$schema` generated from zod
- [ ] 12-setting catalog, one typed source; *(started: `core/config.ts` holds one setting, `integration`, set with `decide config`; eleven remain)* "never touch X" must not silently become "ask before touching X" (preserve the user's actual restriction strength)

### 7.3 Analyst agent

- [ ] One agent for researcher/architect/security roles (split only if golden tasks show real misrouting — don't pre-split)
- [ ] Delta recheck chains bound to `basisHash`

### 7.4 Git completion

- [x] `undo`: inverse patch against current state, previewed, overlap stops cleanly (`undo-conflict`), never a restore of old contents *(`undo` previews in plain chat; `decide undo-confirm` applies to the working tree only; the revert becomes a new quick contract that is checked and committed; an interrupted apply rolls forward; `undo.test.ts`)*
- [x] `integrate`: conflict prediction before any branch switch; **A12 implemented exactly** *(`integrate.test.ts`: fast-forward keeps the receipts, a merge onto a moved base is unchecked until `check --stage integrated`, conflicts named before the editor moves, uncommitted edits ask regardless of setting, `auto-on-accept` integrates on acceptance, a crash after the merge recovers)* — `offer` names "integrate" as the disclosure, `auto-on-accept` states the consequence before acceptance, `never` omits the mention, a dirty-path switch still asks regardless of setting
- [ ] Dependency verification from lockfile before install, package-manager-specific postconditions (an npm postcondition is not a stand-in for pnpm)

### 7.5 Evaluation foundation

- [ ] T2 replay/capture CI wired
- [ ] 10 public golden tasks authored, each with a seeded failure the loop must not hide
- [ ] 6 formative UX sessions run (ux-spec §14.2: clear bug fix; ambiguous feature; review + selected fixes; interrupted task with conflicting human edits; temporary preference; status during active work) — tune skill copy from real evidence, not guesses

Status: ◐ In progress — `undo`, `integrate` and the first setting are ✅ implemented (CI run [39363563698](https://github.com/vedprakash-m/tenet/actions/runs/39363563698) green on ubuntu and macOS at `da40ede` (196 tests)), ahead of the Alpha gate, on the owner's instruction to continue. Everything else in this phase waits for the host spikes (front-end lock, golden tasks, UX sessions) or is not started.

---

## 8. Phase 4 — Beta (hardening)

**Entry:** Alpha exit.
**Exit:** all Musts through B pass (158 cumulative); PRD §6.12 calibration frozen with all four required sign-offs.
**Estimate:** 5–6 weeks. This phase is mostly the continuity matrix — resist adding new user-facing surface here.

### 8.1 Full adapter matrix & traits

- [ ] Jest, Playwright (+ axe-core accessibility), ESLint, tsc, audit normalization — same receipt shape as Vitest
- [ ] Unsupported config is named explicitly, never silently parsed into a success
- [ ] Traits as data (composable obligations/rubric items/risk floors), not new control flow
- [ ] Reviewer Stage B widened with the shotgun-surgery check (tech-spec v1.2 §8.7) — one conceptual change requiring edits across several unrelated files, distinct from blast radius

### 8.2 Sealed baselines & committed-tree checks, prototype promotion

- [ ] `check --stage baseline` / `--stage committed` via the shared temporary-index helper (TD-15)
- [ ] Honest `introduced` vs. `pre-existing` classification — **or**, per the cut list, `classification-unknown` if this is cut
- [ ] **Prototype promotion (WRK-07, a Beta Must — not cuttable, and not the same item as R1's recipe upgrades in §9.2):** when an unhardened prototype is promoted, inventory its shortcuts, characterize working behavior, add distinguishing checks for missing safeguards, and require independent review before any `checked-local` verdict

### 8.3 Continuity & storage

- [ ] `.tenet/` loss reconstruction from `INTENT.md`, decision records, test tags, `Tenet-Work` trailers — never invents a passing receipt or a carried-over grant
- [ ] Bounded storage + eviction (ceiling per tech-spec §7.6) — never evicts an active contract, accepted intent, active lesson, or unintegrated work
- [ ] Schema migration/upcasting with a backup before every write

### 8.4 Observer hooks (conditional) & remaining UX surfacing

- [ ] If SP-03 qualified: ship recording-only hooks, capped event files. **If not: leave absent — this is the expected outcome, not a failure.**
- [ ] `inspect why` / `inspect impact`
- [ ] Deep-lane budget preview (words, never currency)
- [ ] Assurance-profile wording surfaced in `why controls` (tech-spec §0.7 addition, satisfying EVD-07) — confirm this renders correctly now that the mechanism is spec'd

### 8.5 Fault/privacy/update suites & calibration

- [ ] SP-07 confirms disable/uninstall preserve state and overrides with known-good recovery — **required before public Beta**
- [ ] Run baseline-only measurements on fixtures (before any formative session) to get an honest starting distribution
- [ ] Run labeled formative cycles
- [ ] Freeze every provisional number in PRD §§1.6/4.4/5.16 within ±50% or document why not
- [ ] Obtain all four required sign-offs (technical + QA + UX owners on budgets; evaluation owner on value targets)

Status: ☐ Not started

---

## 9. Phase 5 — R1 (public release)

**Entry:** Beta exit + frozen calibration.
**Exit:** PRD §4.7 definition of done, verbatim — see §9.6 below.
**Estimate:** 5–7 weeks.

### 9.1 Starter quality harness

- [ ] ASVS L1 mapping with concrete tests
- [ ] WCAG 2.2 AA automated gate (part of the evidence, not a complete-conformance claim by itself) + the 3-step manual VoiceOver procedure, run as tech-spec §9.2's `manual-affected` obligation actually specifies: **once per candidate, in any lane, gated by whether a file in that critical journey's `journeys.json` entry actually changed — not "every small fix" (most don't touch a listed file, so most results carry no accessibility question) and not merely "the release profile" either (that would under-run it relative to the spec).** Skipping narrows the claim ("accessibility: automated checks only"); release qualification still requires every declared critical journey covered at least once.
- [ ] Concurrency/race fixtures matching PH0-2's chosen domain model exactly
- [ ] Crash-tested backup/restore
- [ ] Reference workload benchmark against PRD targets, each fitness function carrying its own declared degradation threshold (QLT-05, tech-spec v1.2 §12.7) — crossing it raises `fitness-trend-degraded` as an attention item, not just a reported number

### 9.2 Qualification & recipe mechanics

- [ ] Model qualification table populated; Deep-lane warning on an unqualified model (no model menu, no switch suggestion)
- [ ] Recipe upgrade (QLT-15, an R1 Should — genuinely cuttable per §11.2, distinct from Beta's prototype promotion above which is a Must and is not cuttable) — **or cut**, manual migration guidance only
- [ ] `check --import-ci` — **or cut**, `ci-external` stays unavailable

### 9.3 Full evaluation campaign

- [ ] 30 public + 10 reserved golden tasks
- [ ] 3-step successive-changes campaign (Tenet arm vs. matched native baseline, 5 repetitions per model stratum) — this is the direct test of the "Why Software Factories Fail" failure mode from an earlier review round
- [ ] ≥1 maintainer ablation experiment under the "simpler wins" tie rule, over a bounded editable surface that now explicitly includes default configuration values/thresholds (PRD §6.10.1), not just prompts/rubrics — e.g. the `dependency_policy`/`protected_paths` defaults flagged during the walkthrough review are ready-made first candidates

### 9.4 Pilot

- [ ] 8–12 participant counterbalanced crossover pilot (PRD §6.6): ≥30% fewer active human minutes, ≥80% comprehension, ≥70% seeded-misreading catch rate
- [ ] Research consent separate from product consent; retention per PRD's 90-day default unless the participant agrees otherwise

### 9.5 Release chain

- [ ] Reproducible double-build, hash comparison, `SHA256SUMS`, signed tag, provenance attestation
- [ ] Documentation written from the UX spec (what Tenet adds, the tuple, removal, the Autopilot limit, three starter requests — no tour)
- [ ] `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `NOTICE`

### 9.6 Definition of done (PRD §4.7 — copy exactly, do not soften)

- [ ] Every Must tagged M0/A/B/R1 passes on every supported tuple
- [ ] Every Should passes, or has an owner-signed omission
- [ ] Unresolved failures, non-applicability, and residual risks are **published**, not just known internally
- [ ] Release owner and product owner both approve
- [ ] **Never-waivable, confirmed passing, no exceptions:** AC-07, AC-11, AC-16, AC-17, AC-25, AC-27, AC-28
- [ ] Any waived value/experience target states which claims are withdrawn, disables (not hides) the affected capability, publishes the evidence, and ships as "R1 (limited)"

Status: ☐ Not started

---

## 10. Phase 6 — Post-R1 operations (brief; maintain, don't expand speculatively)

- [ ] Full native-host qualification at the agreed cadence (per PH0-3's resolution)
- [ ] Separate, accurately-labeled smoke runs
- [ ] Monthly starter dependency refresh
- [ ] Published security-response ownership
- [ ] Regression fixture for every escaped defect (§12.3)
- [ ] One bounded, evaluated maintainer-improvement cycle before any automatic-promotion mechanism is considered
- [ ] Expansion (Python adapter, additional host, additional OS, delivery recipe, team workflows) only on demonstrated demand with its own conformance gate — not spending R1.1+ capacity speculatively

---

## 11. Reference material (consult, don't duplicate into skill prose)

### 11.1 Budgets (checked every PR)

**Pointers only — do not copy numbers here.** An earlier version of this table copied specific figures out of tech-spec and they drifted from the canonical source during editing; that is exactly the "second source of truth" risk this plan's own §0.3 warns against, now corrected by removing the copy rather than re-syncing it. The authoritative numbers live in tech-spec, checked by the tools named:

| Item | Authoritative source | Enforced by |
|---|---|---|
| Kernel bundle size & cold start | tech-spec §14.1 | `tools/build.ts` |
| Hook payload size & exit latency (if shipped) | tech-spec §4.7, §14.1 | `tools/build.ts` |
| Kernel source size (core vs. adapters split) | tech-spec §6.2, §19.4 | `tools/coverage.ts` (added per §5.2 above) |
| Always-loaded / agent-body / skill-body / reference-file token budgets | tech-spec §5.1, §14.1 | `tools/lint-skills.ts` |
| Loop-card response size | tech-spec §6.6, §14.4 | pipeline test |
| Inventory latency (10k / 100k files) | tech-spec §14.1 | T1 benchmark |
| `.tenet/` footprint & eviction pass time | tech-spec §7.6 | `store-fs.ts` + T1 |

If a number here ever needs to be quoted (e.g., in a PR description), quote it from tech-spec directly and cite the section — never re-type it into this file.

### 11.2 Pre-authorized cut list (apply in this exact order if a module exceeds budget by >25% or a milestone slips)

Quoted from tech-spec §19.4 exactly — five items, each already paired with its narrower claim:

1. Committed-tree check → scope stays `working-tree-with-your-edits` (§8.2 above)
2. External CI import → `ci-external` unavailable
3. Sealed baseline checkout → `classification-unknown` (§8.2 above)
4. Recipe upgrades → manual migration guidance only (§9.2 above — **this is the R1 Should, not Beta's prototype promotion, which is a Must and is never on this list**)
5. The MCP front-end, **if the command line wins SP-12** — and only the MCP code is removed in that case. **If MCP wins SP-12 instead, the CLI front-end is kept in the repository as the deterministic test harness (tech-spec §4.5) — "the other front-end" is never simply deleted regardless of which one SP-12 selects as the shipping default.**

Nothing on this list is a Must requirement — nothing else may be added to it without an explicit, recorded product decision (a Must can be narrowed only through PRD §4.7's waiver process, never through this list).

### 11.3 Risk register (mapped to when it bites — see the joint-review session for full detail)

| When | Risk | Mitigation |
|---|---|---|
| Spikes | Host behavior differs from docs | Spikes first; descriptor fallback keys |
| M0 | Scope creep, solo-maintainer capacity | Module budgets + cut list; walking-skeleton-first |
| M0→Alpha | Agents misreport; Autopilot silently answers for the user | Results only from kernel output; chat-only authority questions |
| Alpha | Sound mechanisms compose into a false success | WP-09 ordering; composition scenarios |
| Alpha→Beta | Approval friction, credit overhead | SP-12; PH0-10 |
| Beta | Model behavior/pricing drift | No model names in the plugin; `unknown` stays `unknown` |
| R1 | Starter dependency churn, evaluation cost | Monthly refresh; measured spend cap |

---

## 12. Traceability & quality convention

### 12.1 Coverage model

`Requirement → implementation location → fixture → verification tier (T1/T2/T3/T4) → milestone → observed result.` `tools/coverage.ts` validates structure (every milestone requirement has a mapped fixture); a human still confirms the fixture actually proves the requirement — a green coverage report is necessary, not sufficient. **Convention:** a fixture is a test (or describe block) whose title carries the PRD requirement ID in brackets, for example `it("... [TDD-01]")`; a requirement whose acceptance criteria are all T3/T4 (or that is agent behavior) is reported as "needs the real host", not as covered.

### 12.2 Verification tiers

| Tier | Purpose | Cadence |
|---|---|---|
| T1 deterministic | Rules, schemas, real filesystem/process behavior, Git preservation | Every PR |
| T2 replay/scripted | Composition, captured synthetic regressions | CI + approved live proxy runs |
| T3 native host | Installed behavior on the exact qualified tuple | Qualification + drift cadence |
| T4 human | Comprehension, usability, accessibility, value | Formative cycles + pre-R1 |

### 12.3 Escapes & fixtures log (append a row every time a defect surfaces after a checked-local result, or a spec defect is found during implementation)

| Date | What happened | Root cause | Fixture/golden task added | Spec section affected (if any) |
|---|---|---|---|---|
| 2026-10-18 | **Decided 2026-10-19 (owner): TS §6.4 amended as built.** An unchanged `check` after the files were edited would have been answered with the previous (now stale) response as `historical`. | TS §6.4 hashes only the call's text for idempotency, but a check's meaning depends on the working tree. | `scenarios`: vacuous and compile-error reds re-run the same `check` after an edit; the walking skeleton. | TS §6.4: the call identity must include the candidate digest for `check`, `finish`, `commit`, `packet reviewer` (`Verb.identity`). Spec amendment needed. |
| 2026-10-18 | After a crash mid-job, a retried `finish` was answered with the provisional response drafted before the job ran. | The first transaction cached `session.last` for a call whose result was not yet observed (TS §6.1 says the response must be rebuilt from the finalized result; §6.4 is silent about caching). | `scenarios`: commit killed at four steps, then `finish` again. | TS §6.4: cache a response only when it is final. |
| 2026-10-18 | **Decided 2026-10-19 (owner): `check --stage baseline --scaffold <paths>`; TS §9.8 amended; `scenarios` "declared scaffolding".** Baseline check after the implementation exists: how does a coordinator declare "declared scaffolding"? | TS §9.8 says the baseline verifies that only tests and declared scaffolding changed, but no verb or flag declares scaffolding. | `scenarios` traps; `workflows` new-project test. | TS §9.8: M0 treats new files as scaffolding and a changed pre-existing source file as contamination (the baseline becomes inconclusive). Needs a decision. |
| 2026-10-18 | A reviewer's "basis gap" has no registry code (`basis-gap-open`) path in the verdict, and an undisposed non-marker attention item has no code at all. | TS §8.3 names both as blocking, Appendix C has no code for the second. | `verdict.test`, `findings` verb. | TS §8.3 / Appendix C: M0 turns each basis gap into a `major` finding located at `basis`, and reports an undisposed attention item as `major-undisposed`. `basis-gap-open` is never emitted. |
| 2026-10-18 | `finish` does not run checks. | TS §6.5 classes `finish` as "M, C" (may run checks), but nothing in M0 requires it and a `check` is already the single place checks run. | `workflows`: edit after check, then `finish` reports `stale`. | TS §6.5: M0 `finish` reports stale evidence; it never launches a check. |
| 2026-10-18 | The recheck manifest lists the delta's files with their diff against the base, not against the last reviewed candidate. | Only blob hashes are kept per review (`ReviewLink.files`); the reviewed content is not. | `scenarios`: blocker, fix, recheck. | TS §8.7: an approximation of "the complete diff since the last reviewed candidate"; the reviewer still covers the whole delta. |
| 2026-10-18 | Execution envelopes are not modeled: every check run is treated as repeatable after a crash, and project tests are not sandboxed. | WRK-01 lists envelopes in the contract; TS §7.4 and §9.3 need them for the repeatable/unknown split and `envelope-unknown`. | `controls` states "check execution: cooperative, not sandboxed". | PRD WRK-01 / TS §9.3: partially met; the contract has no `envelope` field in M0. |
| 2026-10-18 | `kernel.payloadHash` and the kernel-location/payload verification (TS §4.5, §6.6) are not built. | Needs the release chain (hashes) and SP-01 (location). | — | TS §6.6: omitted; `kernel` carries version and schema only. |
| 2026-10-18 | Stateless `review` returns the manifest by path only; there is no inline fallback. | TS §5.5 makes the inline fallback conditional on SP-08. | `scenarios`: review writes nothing to the project. | TS §5.5: build the fallback if SP-08 shows OS-temp reads are unavailable. |
| 2026-10-18 | The bundle must be minified to fit its budget (553 KB vs 600 KB; 903 KB unminified, mostly zod). | Plan §5.2 says "unminified"; TS §14.1 gives the budget. | `invariants`: bundle size and run with nothing but Node. | Plan §5.2 corrected here. `zod/mini` would shrink it further if the budget tightens. |
| 2026-10-19 | Three skills and two agents did not load on Copilot CLI: their `description:` values contained a colon, which is invalid YAML. | `lint-skills` read front matter with a line parser, not a YAML parser. | `tools.test`: front matter a YAML parser rejects fails the lint (`yaml` is a dev dependency). | None; all descriptions are quoted. |
| 2026-10-19 | The plugin's `$schema` URL was a placeholder, and the Copilot CLI treated the plugin as legacy and found no agents. | The real schema URL was unverified (SP-01). | `invariants`/`tools` do not check it; observed on Copilot CLI and VS Code. | `plugin.json` now names `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. Plan §5.1 note is stale. |
| 2026-10-19 | The reviewer subagent has only read and search tools, so it cannot load the `tenet-review` skill, and it invented its own result shape. | The reviewer's instructions lived in a skill. | `contract`: the review manifest is self-sufficient. | TS §5.5: the manifest carries `rubric` (the skill body) and `resultTemplate`; `Recipes` gained `text(rel)`. |
| 2026-10-19 | A model typed the shorthand `tenet inspect doctor` literally. | The expansion to the kernel path was only in the coordinator agent, and VS Code does not always select the agent. | Observed on VS Code. | The `tenet` skill now defines the expansion and says to stop if not started by the agent. |
| 2026-10-18 | **Decided 2026-10-19 (owner): re-baselined to 2,200 lines with a 250-line cap per verb or decision file, enforced by `tools/coverage.ts`; TS §6.2 amended.** Pipeline, verbs and decisions totalled 1,629 lines against a 1,050-line budget (90% over; the other modules are within budget). | TS §6.2: more than 25% over needs a decision before the module grows. Lines here are long; the real size is larger than the count suggests. | `node tools/coverage.ts` reports it. | TS §6.2: **needs a decision** (simplify, or raise the budget with a reason). `verbs/check.ts` (the receipt derivation could move to a tested pure module) and `decisions/simple.ts` are the first places to look. |
| 2026-10-18 | Locks are anchored by ancestry, but when the anchor is not an ancestor and the path exists, the lock still applies. | TS §9.7 says "ask the user when ambiguous"; M0 has no such question and prefers protection over silence. | `workflows`: locks follow history. | TS §9.7: M0 never drops a lock silently and never asks. |
| 2026-10-18 | `hook-consent` first used the chat channel, then the native picker. | UX §5.2 classifies a commit-hook consent as routine (native); an earlier reading of SEC-13 suggested chat. | `workflows`: hook consent. | None; UX §5.2 wins. SEC-13 has no M0 fixture because no M0 verb performs a remote, destructive or content-sending action. |
| 2026-10-18 | `open` in a non-Git folder creates `.tenet/` (a marker and a lock) before refusing with the Git question. | The lock needs the directory; the refusal happens inside the transaction. | `workflows`: new project. | Minor: harmless but contradicts "nothing is written until it is needed" (CON-09 covers review and readiness, not a refused `open`). |
| 2026-10-18 | 80% of an integer limit of 3 attempts is 2.4, so the warning and the bound coincide. | PRD WRK-08 says "warn at 80%" without saying how integers round. | `core`/`contract` tests. | None; the literal rule is implemented. |
| 2026-10-19 | TS §10.3 step 7 promises a one-step "sync my index" but names no verb. | The commit protocol was written without the verb surface. | `workflows`: killed index lock. | TS §6.5 / §10.3: implemented as `decide sync-index`; add it to the decision table. |
| 2026-10-19 | A non-Git folder can be built as a prototype only by opening the prototype profile with `--no-git`; any other profile with `--no-git` is refused. | GIT-01 offers a snapshot prototype but the spec does not say how the choice is made. | `prototype.test`. | TS §10.9 / UX §5.1: the Git question's second option names the prototype profile. |
| 2026-10-19 | `Lock.supportInputs` is a map of file to blob (it was a list of paths), and the runner configuration is a support input of every lock without being declared. | A list cannot say what a support file looked like when locked. | `scenarios`: support-file weakening. | TS §7.2 / §9.7. |
| 2026-10-19 | `undo` creates a new quick `fix` contract for the revert. | TS §10.5 says "check, then commit through §10.3" without saying under which contract; the original is finished and its obligations describe the work being removed. | `undo.test`. | TS §10.5. The original is marked `undoneBy` and cannot be undone twice. |
| 2026-10-19 | `undo` finds the work's commits by the `Tenet-Work` trailer only, refuses a shallow clone or a merge commit, and does not use `git patch-id` after a squash or rebase. | Patch-id matching needs a decision on what "uncertain" asks the user. | `undo.test`. | TS §10.5: M0/Alpha subset; squash and rebase cases are not handled. |
| 2026-10-19 | `integrate` uses a merge commit when the base moved; rebase-then-fast-forward and `branching: current` are not built. | TS §10.4 allows either convention "following the project". | `integrate.test`. | TS §10.4 / §10.7. |
| 2026-10-19 | A runner that finds no test files exits non-zero; that is `zero-tests`, not a report contradiction. | Vitest exits 1 with an empty report when nothing matches. | `receipts.test`, `undo.test`. | TS §9.6. |
| 2026-10-19 | Removing assertions from files an `undo` was asked to revert raises no attention item. | The user's request is the disposition. | `undo.test`. | TS §8.7. |
| 2026-10-19 | The shipped bundle was 581 KB of its 600 KB budget (zod is 447 KB; `zod/mini` saves only 26 KB). | Each verb adds schemas. | `invariants.test` enforces the budget. | **Decided 2026-10-19 (owner): budget raised to 750 KB; TS §14.1 amended, bundle is minified.** TS §3.2 already says bundle sizes are gates, not reasons to hand-write library code. |
| 2026-10-18 | The starter recipe adds three reason codes: `scaffold-target-not-empty`, `recipe-integrity-failed`, `install-failed`. | Appendix C has none for a refused or failed scaffold. | `scaffold.test`. | TS Appendix C (additive, minor). |
| 2026-10-18 | After a scaffold and install the assistance level is recomputed (it was L2 at `open`, with no dependencies, which would cap the endpoint at findings-only). | TS §8.2 computes the level at `open` only. | `scaffold.test`. | TS §8.2 / §12.2: recompute after an install. |
| 2026-10-18 | Recipe files a scaffold wrote raise no attention items while unchanged (`WorkContract.vetted`). | TS §8.7 lists configuration changes as attention but a vetted recipe's own config should not need a disposition. | `scaffold.test`. | TS §8.7 / §12.2. |
| 2026-10-18 | Every `decide` first recovers unfinished effects (needed for a crashed scaffold). | TS §7.4 says recovery runs "before anything else touches the resource". | `scaffold.test` crash points. | None; consistent. |
| 2026-10-18 | The Vitest range was widened to 2–5 and the starter pins 5.0.5. | 3.2.7 carries a critical advisory (tinypool) in its dependencies. | `receipts.test`, `starter.test`. | TS §9.5 supported-version table needs real measurements (SP-10). |
| 2026-10-18 | `.github/copilot-instructions.md` (copied in from another project) was rewritten for Tenet; `CLAUDE.md` now imports it so there is one copy. Its working habits (assumptions, simplicity, surgical changes, checks, impact first) also drive the onboarding flows in `tenet-intake/resources/onboarding.md`; `inspect doctor` now reports detected facts for the brownfield read. | The original described xshiproom-iaag. | `scenarios`: doctor reports the detected stack. | None; the greenfield and brownfield flows are skill text, unexercised by a model (UX J-02, J-03b). |

---

## 13. Progress log (append-only, newest entry at top — this is the handoff record)

### 2026-10-19 (later) — First runs on VS Code Copilot: SP-08, SP-01, SP-02 partly observed

On the owner's decision (D5), the development agent ran Copilot CLI 1.0.99 and then VS Code 1.142.0 (isolated profile, throwaway folder) through the standard-lane loop. Results and gaps are in §4.1; defects found and fixed in the plugin are in §12.3. Two VS Code runs of the same task completed the loop through a real fresh subagent, a commit and `finish` (`implemented-unverified` once, `checked-local` once). The shipped kernel changes in this round (`--scaffold`, the manifest rubric and template, YAML lint, the 750 KB and 2,200-line decisions) are `◐` until committed and CI passes. SP-08, SP-01 and SP-02 are `◐`, not `🔬`: the qualified tuple is not fixed, the extension version was not recorded, and the reviewer's tool restriction and isolation were not observed.

**Correction:** the 2026-10-18 entry below says VS Code is not installed. It is installed (`code` is not on `PATH`; the app is in `/Applications`). The spikes were not blocked by that.

Still open: SP-12 (needs an MCP prototype), the unobserved parts of SP-08, SP-01 and SP-02, the instruction-file and brownfield flows on a model, and everything after M0.

### 2026-10-19 — Prototypes, SP-06 observations, support locks, integrate and undo (CI green)

Implemented and tested locally (`npm run ci`: 196 tests): the shadow repository for non-Git prototypes (`open prototype --no-git`; snapshots at open and every check; secrets and dependencies never copied; 20 MB refusal); `decide sync-index`; locks on support files and runner configuration; `integrate` (A12 as specified) and `undo`; the first typed setting (`integration`). SP-06 observations: 100,000 files inventory in about 350 ms; real husky 9 and lint-staged 16 leave a person's staged and unstaged edits untouched on the temporary index; a client killed while holding `.git/index.lock` leaves the index untouched. **Alpha work was started ahead of its gate** (M0 exit and SP-12 are not met) on the owner's instruction to continue; the plan phase table says so. Committed as `5f7ee9a` and `da40ede` and pushed; CI run [39363563698](https://github.com/vedprakash-m/tenet/actions/runs/39363563698) green on ubuntu and macOS at `da40ede` (196 tests), so the items above are `✅` implemented (T1 only; nothing observed on the real host).

Still blocked, unchanged: SP-08, SP-01, SP-12 and everything that depends on them. Decisions still open: the pipeline/verbs/decisions line budget (now 2,000 lines against 1,050), how a coordinator declares baseline scaffolding, the TS §6.4 amendment, and (since decided: raised to 750 KB) the bundle budget.

### 2026-10-18 — First CI run: T1 green on ubuntu and macOS; spikes still need the real host

Pushed `b8c2114` (4 commits) to the public `origin/main` after `node tools/privacy-check.ts --range @{u}..HEAD`; its one hit was the fake `-----BEGIN PRIVATE KEY-----` fixture string in a test, with no key material. CI run [39207795574](https://github.com/vedprakash-m/tenet/actions/runs/39207795574) passed on `ubuntu-latest` and `macos-latest`: typecheck, both lints, coverage, bundle build (561 KB), 177 tests (including the real `npm ci` of the starter), and the shipped bundle running on Node 22.12.0. Items whose only missing evidence was a commit and CI run are now `✅` (WP-05, WP-01, WP-02, WP-04, WP-08, the platform layer of WP-07, and WP-03 apart from the shadow repository). Not changed: WP-06 and WP-09 stay `◐` (nothing is observed on the real host), and no phase is marked complete. <!-- privacy-ok -->

**Not done, and why:** SP-08, SP-01 and SP-12 need VS Code with GitHub Copilot, which is not installed here (`code` is not on this machine), and each spike needs separate authorization (PRD §8.1). The real-subagent half of the walking skeleton and dogfooding depend on them. The three decisions at the top of this log entry's predecessor (line budget, scaffolding declaration, TS §6.4 amendment) are still open.

### 2026-10-18 — M0 kernel, plugin payload and T1 suite built; nothing observed on the real host

Implemented `specs/plan.md` Phase 2 as far as it can go without the VS Code Copilot host, on the product owner's instruction to implement the plan (Phase 1 spikes were not run first; the Phase 2 entry criterion was not met, and this is recorded rather than hidden).

**What exists (committed and pushed; see the later entry for the CI run):**
- `packages/kernel`: pure core (schemas, reasons, ids, risk, verdict, budget, review, obligations, attribution, exclusions, controls, handoff), six ports, one `pipeline.ts`, adapters (filesystem store with guarded lock and effect log, Git CLI with inventory, temporary-index commit and exact index sync, process runner, Node/Vitest), ten verbs, seven decision kinds, a command-line front-end. About 3,300 kernel source lines plus an 800-line starter template.
- `plugin/`: `plugin.json`, the `tenet` and `tenet-reviewer` agents, two commands, four skills, generated review-result schema, and (after `npm run build`) the 553 KB bundle.
- `tools/`: build, `lint-arch`, `lint-skills`, `coverage`, `privacy-check`; `.github/workflows/untrusted.yml` (green at `b8c2114`).
- `.github/copilot-instructions.md` (working rules for this repo, tailored to Tenet; `CLAUDE.md` imports it), `tenet-intake/resources/onboarding.md` (greenfield and brownfield start) and `conventions-draft.md` (the instruction-file draft), derived from the instruction file the product owner copied in from another project.
- 174 T1 tests (`npm run ci` green locally): core and property tests, a verdict row per reachable endpoint, real-OS lock races and kill tests, Git preservation, the walking-skeleton loop, the three injected failures (crash at all four commit steps), misleading-success traps, hook consent, locks by ancestry, zero-write review, and the lints' own failing fixtures.

**Observed vs. documented:** every statement above is T1 on macOS / Node 26 / Git 2.56. Nothing was run in VS Code. SP-01 (install path, skill-relative kernel path), SP-08 (fresh reviewer, tools, `usages`), SP-12 (approval counts, front-end choice), and SP-02 (host storage and instruction-file loading) are unobserved. The agent and skill text was written from the specs and has not been exercised by a model.

**Decisions and spec gaps found:** see §12.3 (30 rows). The ones that need a product decision: the line budget for pipeline, verbs and decisions (90% over), and the TS §6.4 amendment for call identity.

**Not built (still open in M0):** the starter's UI/journeys/workload/restore tool (§6.7), shadow-Git prototypes, user-directory preferences, `inspect result/impact/residue/settings`, dogfooding, the real-host half of the walking skeleton, and the §3.1 role assignment.

Next action: commit, push, and get a CI run so the `◐` items can become `✅`; then authorize and run SP-08, SP-01 and SP-12 on the real host.

### 2026-10-18 — User walkthrough of the full install-to-operate journey surfaced 9 gaps, all resolved

Walked the entire user journey (install/first-contact → greenfield/brownfield → core loop → Git mechanics → publish/R1.1 deploy boundary → configuration/steering/recovery) end to end, explicitly to find gaps a pure document review wouldn't surface. Nine items came out of that, all now resolved directly in the specs (not left as plan-only notes):

- **PRD v0.16 → v0.17:** QLT-05 now escalates a degrading fitness-function trend to an attention item instead of only reporting it (Section 4.3, new reason code `fitness-trend-degraded`); `dependency_policy`'s default for `unknown_age` tightened from `allow` to `require-approval` (Section 7.3); the maintainer experiment protocol's editable surface now explicitly names default configuration values/thresholds as their own category (Section 6.10.1) — directly useful for experimenting with the `dependency_policy`/`protected_paths` defaults just tightened.
- **tech-spec v1.2 → v1.3:** resolved the plan-vs-spec disagreement on starter scaffolding — the platform layer (`platform/`, §12.4 security decisions, migrations, build/CI config) is vetted recipe content and ships complete in one effect; feature content starts empty and grows per plan item, which is what was actually meant by "smallest first slice" all along (§12.2); the scaffold now also proposes a starter-specific `protected_paths` default (auth/session/migrations) rather than leaving it empty even on Tenet's own recipe; added a shotgun-surgery check to the Reviewer's Stage B rubric (§8.7), distinct from blast-radius; added the multi-round-on-a-thin-answer practice rule and the one-time AGENTS.md-conventions-draft offer to the intake practice rules (§5.4).
- **ux-spec v0.4 → v0.5:** removed J-03b's 4th dirty-overlap option ("edit in place, don't commit") — it violated the ≤3-choice rule by bundling two different decisions into one menu; "don't commit" already covers the same outcome as a standing word, so nothing was lost. Reflected the multi-round intake and AGENTS.md-offer behavior, plus the starter protected-paths proposal, in J-02.
- **plan.md:** updated WP-07 and WP-06 checklists to match the now-resolved tech-spec text instead of carrying an open question; added the shotgun-surgery and fitness-trend-escalation items to their respective Beta/R1 sections; added the config-defaults-as-editable-surface note to the R1 maintainer-experiment item.

One item was raised and deliberately **not** added: a second, specialized model for review independence — noted as a documented option only, since added complexity there wasn't confirmed as wanted.

Next action: §3.1 role assignment, then Phase 1 spikes, starting with SP-08 — unchanged from the last entry; this round was documentation refinement surfaced by a user walkthrough, not a sequencing change.

### 2026-10-18 — Joint review round 4: kernel-pipeline bug fixed, approval-count fixed at the source, Phase 0 collapsed to one-liners

Three independent reviews plus a fresh self-audit found and fixed, directly in the specs (not worked around in the plan):

- **tech-spec v1.1 → v1.2:** (1) fixed a real correctness bug in `runVerb` (§6.1) — the response was rendered from the pre-execution plan, never rebuilt from what `tx.finalize` actually observed, so `check`/`commit`/`finish`/`integrate`/`publish` could report success before confirming it; (2) split `decide`'s approval classification by kind instead of blanket-consequential (TD-44, §4.6/§6.5) and allowed `decide {propose, answers}` to close in one call — a principled fix to the approval-count problem, not a number-driven shortcut; (3) corrected the assurance-profile mapping (§0.7) so observed-but-unenforced controls are never described as "Guarded local" (that profile requires evidence of an actual blocked dispatch, which R1's recording-only hooks can never produce); (4) closed a zero-write-review gap where hooks could write into a *pre-existing* `.tenet/observed/` during a stateless review call (§4.7, `TENET_STATELESS` suppression); (5) added branch-switch intent reconciliation (§7.8) and extended integration-review coverage to imported-but-disjoint files (§8.7), both reusing existing mechanisms rather than new ones.
- **plan.md:** deleted a sentence in the WP-06 checklist that silently reintroduced the rejected A13 entailment classifier (three independent reviewers caught this same defect) and fixed the same imprecision in a WP-08 fixture description; collapsed Phase 0 from a "3–5 day design phase" to one-line resolutions — seven of ten items were already settled by the specs or are now fixed directly above, leaving only role assignment as actual remaining work; fixed the WP-05/Day-1-tooling checklists, which had listed the *entire* module/tooling set as "build first," directly contradicting the plan's own walking-skeleton-first principle; fixed the WP-09 dependency graph, which omitted the Reviewer-agent slice the skeleton scenario actually requires; added `stop`/`commit`/`packet` to the M0 verb subset (both are M0 Musts — WRK-10, GIT-03); fixed the SP-08 fallback, which had treated a same-session review as a valid substitute for a failed fresh-review spike on consequential work (it isn't — AGT-09's same-session pass is a separate, Beta-only, small-task-only Should); separated prototype promotion (WRK-07, a Beta Must, never cuttable) from recipe upgrades (QLT-15, an R1 Should, genuinely cuttable) — they had been bundled under one "or cut" line; fixed the cut-list's front-end item, which said to "delete the other" front-end regardless of outcome, contradicting tech-spec's own policy of keeping the CLI as a permanent test harness; converted the budget table (§11.1) to pointers instead of copied numbers, since the copies had already drifted from tech-spec's actual values; corrected the VoiceOver-check description to match tech-spec's actual `manual-affected` trigger (gated by `journeys.json`, not "release profile only"); simplified the mandatory per-turn update ritual, since requiring a log entry every session regardless of whether anything milestone-relevant happened was itself the kind of unearned process weight this project's own principles warn against.
- **Not changed, by deliberate choice:** PRD.md and ux-spec.md needed no further edits this round — all three reviews' findings against them were either already resolved by the prior round's edits or are addressed here by fixing the downstream documents to match what PRD/ux-spec already correctly say.

Next action: §3.1 role assignment, then start Phase 1 with SP-08.

### 2026-10-18 — Plan created

- Created `specs/plan.md` synthesizing PRD v0.16 / tech-spec v1.1 / ux-spec v0.4 and four independent build-plan reviews into one trackable document.
- No implementation work has started. Phase 0 (§3) is the current focus — specifically PH0-1 (reconcile the PRD §10.2 vs. tech-spec §19.1 spike-gating mismatch) and PH0-10 (front-end approval-count ceiling, which must close before SP-12 can run meaningfully in Phase 1).
- Nothing is blocked except by the unresolved Phase 0 decisions themselves.
- Next action for whoever picks this up: work through §3's checklist with the product owner, then move to Phase 1 spikes (§4), starting with SP-08 per the risk-ordered sequence in §4.1.
