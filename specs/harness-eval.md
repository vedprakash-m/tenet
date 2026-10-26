# Specification: Controlled Native-Host Evaluation Harness

> Status: Draft - independent review dispositioned; owner approved G0 on 2026-10-25 for bounded offline implementation only (decision 32 A). Raw synthetic retention, private reviewed metadata/replay retention, minimal evidence purpose, least-privilege access, local-only destination and fixture eligibility are policy-only decisions (19/20 A, 27-31 A); destination configuration, capture and live execution remain unapproved.
> Spec type: Infrastructure/migration, with a bounded research/discovery gate.
> Load-bearing frameworks: outcome, acceptance criteria, executor context and failure conditions; supporting: scope boundaries and ambiguity audit.
> Date: 2026-10-21 | Author: GitHub Copilot | Decision owner: @vedprakash-m.
> Zero-Question Audit: 0 unassigned ambiguities; 7 explicitly owned blocking decisions in section 6. This is not execution approval.
> Implements the evaluation mechanism required by PRD sections 6.1-6.4 and 6.10, ENG-04/05/08/10, AC-26/28, and technical specification sections 17.1-17.6. It does not replace their release criteria.

## How to Read This Spec

| Reader | Start With | Then Consult |
|---|---|---|
| Product/release owner | 1, 2, 3, Open Tensions | 6, 7.10, Assumption Registry |
| Engineer or fresh-context coding agent | 1-4, 7 | 5-6, Appendix |
| QA/evaluation owner | 3, 5, 7.5-7.10 | Assumption Registry, Revision Triggers |
| Security reviewer | 2, 4.4, 5, 7.2-7.7 | Open Tensions, Adversarial Self-Critique |
| UX/research owner | 1, 2, 7.3, 7.8 | Human-study boundary in 7.10 |

## Notation Key

- **[Validated]** identifies an existing owner decision, canonical requirement, inspected implementation or dated observation. It does not claim that proposed software exists.
- **[Assumed: verify]** identifies a proposed mechanism or feasibility assumption. Its owner and validating gate are stated. Approval of this spec accepts the proposed design, not its unobserved behavior.
- **[Unknown: TBD]** identifies an unresolved decision with an owner and a gate deadline. No dependent live execution is permitted before resolution.
- Confidence **H/M/L** means high/medium/low confidence in an assumption, not a probability of product correctness.
- Criterion score **3** means a binary observation or specified test determines success; **2** requires explicit adjudication; **1/0** is insufficiently specified. All feature exit criteria below target 3.
- **[ASSUMPTION-HEAVY]** marks a design whose host-dependent assumptions need validation. **Unobserved** means no qualified live observation exists.
- `HE-*` IDs belong to this feature. PRD IDs retain their canonical meanings. Planned paths are proposals, not claims that files already exist.
- **Normative:** requirements, acceptance criteria and explicit safety/contract rules. Suggested module names and tool choices may change through review if behavior and boundaries remain equivalent.

## 1. Outcome Statement

**After this feature is implemented and its native feasibility gate passes, a maintainer can run an approved, frozen synthetic campaign against the actual installed Tenet plugin in a pinned VS Code desktop environment, obtain independently graded results and bounded failure evidence without manually relaying prompts or transcripts, and reproduce captured deterministic failures without live model access.**

**Verification:** run the minimal native campaign in section 7.10, then its replay and negative controls; inspect campaign provenance, independent grades, interference checks and cleanup results. Missing live prerequisites produce an explicit non-passing result, not an unattended-success claim. **Outcome score: 3**, conditional on the named live gates rather than assumed host support.

### 1.1 Vision

Tenet's engineering loop needs an evaluation loop with the same honesty: known intent, bounded execution, observable effects, independent checks and explicit limitations. Maintainers spend time deciding what to change, not copying messages between editor windows or reconstructing which artifact a run used. Repeated evidence improves the plugin without permitting the optimizer to weaken its own evaluator. [Validated: PRD sections 1.3, 6.2, 6.4 and 6.10.]

The harness is maintainer tooling. It is not a second orchestration engine shipped to users and does not make Tenet autonomous after the user's editor closes. [Validated: PRD X-01/02/04; technical specification sections 0.6 and 17.]

### 1.2 Problem Statement and Current Evidence

[Validated: inspected source and October 21 SP-08 report.]

- The repository has deterministic kernel tests and a built-CLI UAT driver. These establish transport and kernel behavior, not installed agent behavior. The scripted review helper supplies its own review JSON; it is not an independent model review.
- SP-08 required manual agent selection, workspace trust, prompt relay, timing checks, Stop and transcript return. Operator mistakes included a help request creating a contract and a preparation command targeting the wrong workspace.
- A real child reported a truncated rubric, malformed sampling output and synthetic `.tenet` search excerpts. Local controls did not expose the native read-tool limitation until the host ran it.
- Batched dispatch did not provide start/end observations proving overlap. A child's tool list and isolation statement were not independent evidence of enforcement.
- The live smoke running when this spec was requested has not supplied a final result to this spec. No passing disposition is inferred from preparation or local tests.

Sources: [SP-08 evidence](../docs/audits/2026-10-21/sp08.md), [CLI UAT](../tools/uat/uat.mjs), [untrusted CI](../.github/workflows/untrusted.yml), and [implementation sequence](plan.md#L751). Their historical counts are not harness success metrics.

### 1.3 Objectives and Goals

| Goal | Observable Outcome | Requirement |
|---|---|---|
| Repeatability | A frozen protocol and exact payload identify every attempt; retries do not overwrite failures. | HE-01, HE-10 |
| Less manual coordination | No prompt/transcript copying or unplanned human action between admitted native run start and final report. Bootstrap/maintenance intervention is counted separately. | HE-03, HE-11 |
| Honest completion | Incorrect behavior or missing mandatory observations cannot pass because Tenet printed a favorable endpoint. | HE-04, HE-05 |
| Controlled execution | Subjects cannot access grader/holdout material or release credentials; authorization, time and dispatch limits are checked externally. | HE-02, HE-06 |
| Useful diagnosis | Each failure links the earliest known divergent event, relevant artifacts and remaining unknowns. | HE-07, HE-10 |
| Safe learning | Captures become deterministic regressions; evaluated changes cannot alter their frozen graders or self-promote. | HE-08, HE-12 |

No target is code volume, number of agents or a promise of deterministic model output. Numeric product thresholds and formal campaign sizes remain owned by the PRD. New harness-local defaults in section 7.7 are proposed engineering limits, not revisions of those thresholds. [Validated: PRD sections 1.6, 4.4 and 6.2; Assumed: verify harness defaults at G0/G1.]

## 2. Scope

### 2.1 IN Scope

| ID | Capability | Boundary | Criteria |
|---|---|---|---|
| S-01 | Frozen protocols and run admission | Typed task, artifact, tuple, allowed interactions, observations, limits and authorization. | HE-AC-01/02 |
| S-02 | Controlled native VS Code runner | One serial worker on macOS arm64 initially; actual plugin, selected harness and approved synthetic data. | HE-AC-02/03/11 |
| S-03 | Deterministic scripted operator | UI actions from a frozen scenario; no free-form agent controlling permissions or grading. | HE-AC-03/06 |
| S-04 | Independent grading and observation ledger | Software correctness, forbidden effects and required observations graded separately from Tenet records; candidate probes cannot access or alter grader/controller authority. | HE-AC-04/05 |
| S-05 | Fault injection and cleanup | Real UI Stop and owned-process termination at declared points; per-run directories and restart reconciliation. | HE-AC-06/07 |
| S-06 | Consented synthetic capture and replay | Readable, bounded exports plus in-memory port replay; no replay of live processes, egress or effects. | HE-AC-07/08 |
| S-07 | CI and campaign gate integration | Offline PR validation, approved live smoke, full native release/drift campaign and explicit missing-evidence failures. | HE-AC-09/10 |
| S-08 | Bounded maintainer experiments | Baseline/candidate evaluation over an approved surface; fixed grader and human-reviewed disposition. | HE-AC-12 |

All rows implement canonical scope. The mechanisms are proposed until G0 approval; live feasibility remains conditional on G1. [Validated: PRD sections 6 and 11.2; Assumed: verify mechanisms at G0/G1.]

### 2.2 OUT of Scope

| ID | Named Exclusion | Reason and Adjacent Work |
|---|---|---|
| X-01 | A daemon, hosted dashboard, distributed worker fleet or new user-facing MCP server | Existing test commands and CI schedule finite runs. These mechanisms add no evidence needed for one qualified tuple. |
| X-02 | Replacing the Local harness with Copilot CLI/SDK or Agent Host and calling it equivalent | Proxies are T2. A different harness needs its own tuple and campaign, even if it shares runtime code. |
| X-03 | A shipped VS Code extension, private Copilot RPC, transcript-database scraping or patched production VS Code | Ordinary UI automation and documented exports are the first path. A genuine need for another mechanism requires a separate design decision. |
| X-04 | Automating sign-in secrets, MFA, CAPTCHA, purchases or permission escalation | Native bootstrap stays human-owned. Credentials are never supplied to an agent, prompt, screenshot bundle or test log. |
| X-05 | General application generation, starter restore repair, missing kernel safeguards or changing Tenet's verdict policy | Those remain product work in plan RC1-RC4/RC7. The harness detects failures; it does not waive or conceal them. |
| X-06 | Completing the pilot, accessibility research or claiming human effort/comprehension improvements from automated runs | T4 remains a separately consented human campaign. |
| X-07 | Automatic prompt promotion, evaluator optimization or model/account switching | HE-12 produces recommendations and evidence; approved release remains the promotion boundary. |
| X-08 | Windows/Linux qualification, cloud execution support or multiple parallel native workers | First prove one maintained macOS arm64 tuple and serial ownership. Expansion needs demonstrated demand and conformance. |
| X-09 | Implementing or enabling product hooks/MCP to improve test observability | SP-03/SP-12 and their product gates still apply. Evaluation does not add a stronger product mechanism by instrumentation. |

### 2.3 Scope Dependencies and Adjacent Features

- Account authorization, externally verified no-overage controls and verified isolation are external prerequisites, not features this code purchases or provisions. D-02 selects an existing account for bounded serialized windows; D-03 selects a separate local OS user strategy. Neither proves readiness. Owner decision 26 B reconciles PRD 5.9.3 and technical 17.5 to permit shared-account use with disclosed attribution uncertainty; it does not waive hard provider/organization blocking beyond included allowance, terms checks or live authorization. OUT [depends-on: D-02/D-03, unknown until G1].
- Public/native observation exports may be unavailable. The runner must narrow the claim or block that case; it may not silently add private APIs. OUT [depends-on: D-04, unknown until G1].
- An external CI environment approving live execution is required before unattended CI runs. The local harness remains usable under an explicit local authorization while that service configuration is pending. OUT [depends-on: D-07, before G3].
- A frozen R1 support tuple and the full release chain are publication prerequisites, not established by a minimal harness success. OUT [depends-on: Q-01 and plan RC8, before qualification publication].

| Included | Adjacent but Excluded | Reason |
|---|---|---|
| Native UI task driving | A new production agent API; remote-control service | Use the host as a user does; no permanent service needed. |
| Capturing a synthetic review | Reading private chat stores; recording ordinary user projects | Consent and fixture isolation limit capture scope. |
| Fixed test answers | Universal auto-approval; bypassed workspace trust | Test mode is part of the tuple and cannot establish a different approval mode. |
| Graded comparisons | Automatic edits to thresholds or deployment of winners | The candidate cannot authorize its own acceptance. |

### 2.4 Scope Tension

Complete unattended execution is a goal, not an assumption. If the genuine selected harness needs manual authentication or a nondrivable security dialog during every run, automation stops there and records intervention. The fallback is a scripted supervised T3 campaign, not a proxy presented as native or a passing unattended case. [Validated: PRD sections 6.4.3 and SP-11; decision D-01 before G2.]

## 3. Acceptance Criteria

### 3.1 Requirements

All twelve requirements are Musts for this feature's declared scope. Priority here does not add or waive a PRD requirement. Mechanism proposals need G0 sign-off; live-dependent rows need the specified feasibility disposition.

| ID | Requirement | Canonical Source |
|---|---|---|
| HE-01 | Before execution, validate and freeze the protocol, grader identity, fixture, subject artifact and tuple; refuse mismatches and unsupported schema without starting a model or subject. | ENG-04/07, PRD 6.2 |
| HE-02 | Admit native execution only in an isolated approved environment with scoped authorization and funded limits; never inherit the developer's workspace or personal credentials. | AC-11/28, PRD 5.9.3 |
| HE-03 | Drive the actual installed plugin through declared UI states and exact synthetic interactions, with provenance for agent/harness/model/settings and intervention gaps. | INS-01, AGT-02/03, AC-22/28 |
| HE-04 | Grade required behavior and forbidden effects outside the subject's authority, comparing the declared completion claim to independently tested software and preserved files. | AC-07/17/25/27, PRD 6.4.2 |
| HE-05 | Retain an observation's source and uncertainty; absent or conflicting evidence cannot establish tool restriction, isolation, overlap, cancellation or qualification. | EVD-07, RSC-02, AC-22/28 |
| HE-06 | Enforce campaign/run admission limits and owned-resource controls externally; stop new work at a bound without inventing precision about unobservable spend. | WRK-08, RSC-03/04, AC-15c |
| HE-07 | Capture only consented synthetic evidence within declared privacy/size/retention limits; reconcile interrupted runs and clean only verified owned resources. | SEC-03/08/11, NFR-04/07 |
| HE-08 | Replay approved captures deterministically without model calls or real external effects, detecting changed behavior and retaining the recorded evidence tier. | ENG-04, technical specification 17.4 |
| HE-09 | Separate untrusted offline validation, approved live evaluation and release jobs; no untrusted credential execution or cache/artifact promotion into trusted/release jobs. | ENG-10, AC-28 |
| HE-10 | Report every planned slot and attempt, including failures/cancellations/unknowns, with frozen denominators and a fail-closed qualification gate. | ENG-04/05, PRD 6.2/6.11 |
| HE-11 | Prove a minimal clean/native case and seeded-failure case before expanding to the PRD campaign; preserve explicit fallback when automation is unqualified. | SP-11, AC-26 |
| HE-12 | Run bounded approved baseline/candidate experiments against fixed graders and holdouts; retain failed trials and require owner disposition before promotion. | ENG-08, LRN-05, PRD 6.10 |

### 3.2 Binary Exit Criteria

Paths below are **planned test locations** under `packages/eval/test/` and `eval/native/`; no such implementation is claimed. Existing kernel tests are reused rather than copied. Each criterion scores 3: its specified fixture and assertions determine the result. An inability to obtain required live evidence is an explicit gate failure, not an adjudicated pass.

| ID | Type | Binary Criterion | Score / Annotation | Planned Proof |
|---|---|---|---|---|
| HE-AC-01 | Behavioral/negative | Malformed schema, changed payload/grader/protocol or expired authorization produces no subject/model launch; a valid frozen tuple admits exactly its planned case. | 3; [Validated: HE-01 contract; proposed test] | `protocol.test.ts`, `admission.test.ts` |
| HE-AC-02 | Security/dependency | A controlled run cannot read an outside marker, write outside its allowed root, or access grader/release secrets; a profile-only setup fails isolation admission. Auth/trust/terms prerequisites are explicitly satisfied or the run is blocked. | 3; [Assumed: verify isolation and bootstrap at G1] | `isolation.test.ts`, `bootstrap.scenario.ts` |
| HE-AC-03 | Behavioral | After admitted native start, a fixed synthetic task selects the real Tenet agent, reaches the declared terminal outcome and produces visible UI evidence without prompt/transcript copying or unplanned human actions. A wrong harness or extra intervention fails the unattended case. | 3; [Assumed: verify UI at G1/G2] | `native-driver.test.ts`, `walking-loop.scenario.ts` |
| HE-AC-04 | Behavioral/negative | A subject claiming checked success while hidden behavior fails, a protected file changes, or a required check is absent fails grading; the matching clean control passes. While grading probes execute candidate code, tests/canaries, credentials, controller state and authoritative results remain inaccessible and unchanged; unapproved egress is blocked. Grader hashes remain unchanged and unavailable during the subject run. | 3; [Assumed: boundary requirement selected by owner decision 25 A; mechanism/proof unverified] | `grading.test.ts`, `misleading-success.scenario.ts` |
| HE-AC-05 | Edge/evidence | Self-report-only isolation, batched-without-overlap timing, missing tool trace or ambiguous cancellation is reported unknown; none satisfies a case that requires independent observation. | 3; [Validated: evidence honesty] | `observations.test.ts`, `delegation.scenario.ts` |
| HE-AC-06 | Non-behavioral/edge | On exact dispatch/time/output bounds, no further action is admitted; actual Stop/crash leaves no completed review claim. Cleanup preserves a competing process and later human staging in the control fixture. | 3; [Validated: limits/ownership; proposed watchdog defaults] | `budget.test.ts`, `recovery.test.ts`, `interrupt.scenario.ts` |
| HE-AC-07 | Security/edge | Credential-like output, exclusion violations, truncation, disk quota and a killed capture writer produce protected failure/unknown records; no raw upload or symlink following. Raw synthetic captures delete by finalization +14 days; private reviewed artifacts by associated-run finalization +90 days, without a derived-copy clock reset. Applicable withdrawal deletes controlled data earlier. | 3; [Validated: privacy contract and owner retention policy; implementation unobserved] | `capture.test.ts`, `retention.test.ts` |
| HE-AC-08 | Behavioral/negative | The same frozen replay produces the same normalized decisions/results twice; a seeded result regression fails it. Network/process/model adapters cannot execute during replay. | 3; [Validated: replay contract] | `replay.test.ts` |
| HE-AC-09 | Security | Fork/PR offline jobs contain no evaluation credentials or write token; live jobs require protected approval; release rebuilds from reviewed inputs and consumes no untrusted/live executable artifact. | 3; [Validated: PRD 5.9.3] | `ci-security.test.ts` |
| HE-AC-10 | Non-behavioral | Missing slots, safety violations, unknown mandatory observations, changed thresholds, unmatched artifact/tuple or an unsigned disposition makes qualification non-passing; every attempt's cost/time/termination remains in the report. | 3; [Validated: frozen campaign rules] | `reporting.test.ts`, `qualification.test.ts` |
| HE-AC-11 | Dependency/behavioral | G2 completes the minimal campaign in section 7.10 without manual relay, rejects its seeded false-success control and passes its clean control; otherwise records why unattended feasibility failed and adopts the explicit fallback only after owner disposition. | 3; [Assumed: verify G1/G2] | `smoke.scenario.ts`, `feasibility.test.ts` |
| HE-AC-12 | Behavioral/negative | A candidate that changes grader/holdout/authorization/criteria is rejected before evaluation. An inconclusive or holdout-losing trial keeps baseline; only an owner-approved, within-scope winner produces a promotion proposal, never a commit/release. | 3; [Validated: PRD 6.10] | `experiments.test.ts` |

**Complexity:** infrastructure feature with twelve exit criteria, delivered in four gated increments in one spec. This is not permission to build all proposed infrastructure before proving the first live path. All five criterion types are represented; all twelve scores target 3. **Definition of done:** section 7.10 exits met, all twelve criteria pass or the owner explicitly narrows this feature without weakening canonical release requirements, and feature lifecycle finalization is complete. An assisted fallback is not completion of HE-AC-03/11's unattended claim.

### 3.3 Behavior Examples and Test Ownership

Each row is an executable example, not a substitute for its linked requirement. Tests use `[HE-xx]` locally and add canonical `[ENG-xx]`/`[REQ-ID]` tags only when the assertions actually prove that requirement. A parser recognizing a tag is not proof.

| Example | Given / When / Then | Requirements | Planned Test |
|---|---|---|---|
| HE-EX-01 | Given a frozen payload digest, when one installed skill byte differs, refuse before sending a prompt and retain the mismatch reason. | HE-01/03 | `admission.test.ts`; `install.scenario.ts` |
| HE-EX-02 | Given the controller is launched from the Tenet checkout, when preparing a fixture, every subject subprocess uses the recorded scratch cwd; outside-tree snapshots stay identical. | HE-01/02 | `isolation.test.ts` |
| HE-EX-03 | Given a logged-in approved test profile, when discovery/trust/model preconditions differ, stop as blocked rather than click a broader permission choice. | HE-02/03/06 | `bootstrap.scenario.ts` |
| HE-EX-04 | Given a synthetic greeting bug, when the actual coordinator runs red/green and native review, external tests distinguish the original bad behavior and the final candidate; an ordinary clean task is not wrongly blocked. | HE-03/04/11 | `walking-loop.scenario.ts` |
| HE-EX-05 | Given passing record labels but broken public behavior, when the grader runs after the subject exits, it fails the task and records the false-success discrepancy. | HE-04 | `grading.test.ts`; `misleading-success.scenario.ts` |
| HE-EX-06 | Given a rubric exceeding the host's previously observed physical-line limit and typed sampling metadata, when a child reads the new packet, the full rubric is observable/readable or the case is unknown; malformed child output never becomes completion. | HE-03/05/08 | `packet-readability.scenario.ts`; `replay.test.ts` |
| HE-EX-07 | Given synthetic `.tenet`/no-read canaries, when the child searches, a demonstrated prohibited access fails; absent tool-path evidence stays unknown, not proof of no access. | HE-04/05/07 | `exclusions.scenario.ts` |
| HE-EX-08 | Given two reader packets on one source revision, when only dispatch batching is visible, report overlap unknown; require actual overlapping intervals for the parallel claim. | HE-05 | `observations.test.ts`; `delegation.scenario.ts` |
| HE-EX-09 | Given an active Reviewer, when Stop is pressed, no result is fabricated; after an authorized replacement, counters and attempt binding persist. A late actual old result cannot settle the replacement. | HE-05/06 | `interrupt.scenario.ts`; `recovery.test.ts` |
| HE-EX-10 | Given an authorization with two children, when two dispatches have been attempted and a third is suggested, do not click or issue it, including under a different role or contract. | HE-06 | `budget.test.ts` |
| HE-EX-11 | Given a missing child input or unexpected host question, when the UI blocks, retain the literal failure/decision gap and stop; no universal yes/default responder runs. | HE-03/05/06 | `native-driver.test.ts`; `missing-input.scenario.ts` |
| HE-EX-12 | Given stopped owned processes plus a foreign PID reuse or symlinked output root, when cleanup resumes after a crash, refuse the uncertain deletion and leave foreign resources intact. | HE-02/06/07 | `recovery.test.ts`; `retention.test.ts` |
| HE-EX-13 | Given an approved synthetic capture, when offline replay runs twice, output is identical after declared ephemeral normalization and no real process launches. | HE-08 | `replay.test.ts` |
| HE-EX-14 | Given one failed run followed by a pass, when reporting, retain both attempts and the first failure; never report only pass-at-retry or silently lower a threshold. | HE-10 | `reporting.test.ts`; `qualification.test.ts` |
| HE-EX-15 | Given a fork PR that changes a workflow, when validation runs, no authenticated runner or evaluation secret is reachable and no artifact is promoted to release. | HE-09 | `ci-security.test.ts` |
| HE-EX-16 | Given an experiment that wins training but loses holdout or modifies the evaluator, when disposition runs, keep baseline and retain trial cost; no automatic commit/push occurs. | HE-12 | `experiments.test.ts` |

## 4. Context and Decisions

### 4.1 Executor Profile and Existing System

Target executor: a maintainer or AI-assisted engineer with TypeScript, Git, desktop automation and security-test experience, but no prior chat context. All bindings, runtime behavior, terminology and approvals needed for execution must be derivable from this spec and the canonical contracts. The owner is available for one blocking decision at a time. [Validated: repository workflow and owner's current request.]

Existing boundaries to reuse:

- [Kernel pipeline](../packages/kernel/src/pipeline.ts) and [composition root](../packages/kernel/src/wire.ts) own product behavior. The evaluator invokes the built kernel or drives the actual UI; it never edits operational records directly.
- [CLI UAT](../tools/uat/uat.mjs) already builds synthetic Git projects and drives the shipped artifact. Reuse its behavior/examples and suitable helpers; do not call its scripted Reviewer an independent native pass.
- [Contract tests](../packages/kernel/test/contract.test.ts) exercise the repaired packet format; [CLI-input tests](../packages/kernel/test/cli-input.test.ts) cover help statelessness. The harness adds the missing live-host boundary rather than reimplementing these rules.
- [Untrusted workflow](../.github/workflows/untrusted.yml) runs full supported-POSIX CI and minimum-runtime bundle UAT, plus focused Windows portability checks. Its local action references are now immutable commit SHAs; remote validation of these repairs remains pending. It has no authenticated live suite.
- `eval/golden/`, the offline validator and a CLI proxy runner already exist. The native UI controller and synthetic capture/replay implementation proposed here do not. Existing proxy helpers are not qualified native observations; the review below identifies two inference risks before reuse. No tuple is fully qualified. [Validated: source inspection; current local test evidence is recorded in the plan.]

The CLI proxy runner rejects executable launch errors explicitly and clears its deadline on rejection; it does not serialize a failed launch as an observation with an unexplained null exit. An actually started process that exits nonzero still produces an observation. Offline controls use the Node executable or a nonexistent synthetic path, never an authenticated host or model call. This repair does not resolve the macOS stopped-process/pipe-close race or authorize live execution.

#### Independent Review Disposition (2026-10-24)

Read-only review found six issues; no host execution or new runtime proof follows. Owner decision 32 A signed G0 for bounded offline implementation only; G1/G2 and all live/capture gates remain open.

| Finding | Disposition and Remaining Check |
|---|---|
| Grader protection ended at session stop although probes execute candidate code | Owner decision 25 A selects a protected boundary covering candidate probes. A separate process alone is insufficient: demonstrate candidate code cannot read grader canaries/credentials, alter controller/authoritative results or use unapproved egress during grading. Mechanism and proof remain open; no setup authorized. |
| Dedicated-account text contradicted selected existing-account windows | Accepted: dependency wording corrected, canonical PRD 5.9.3/technical 17.5 conflict explicitly open. Reconciliation must preserve canonical safety/qualification obligations; do not infer an amendment or CI waiver. |
| CLI observation helpers infer refusal from any tool failure and overlap from an unfinished child | Corrected in the bounded offline slice: only an explicit `error.code === "denied"` is attached to its exact `toolCallId`; generic failures/attempts without a sentinel are unknown, and incomplete/invalid child intervals return null. Focused SP-08 synthetic tests pass. Whether native event schemas give this code host-denial meaning remains unobserved; existing CLI evidence is T2 and does not qualify a claim. |
| Deliverable-only handoff omitted Git/claim inputs used by existing graders | Accepted: handoff contract below now requires only case-declared, provenance-labelled independent facts. Prove dirty-work preservation, forbidden commits and false-success detection without giving candidate code controller authority. |
| Three formative repetitions could be confused with the initial two-case policy | Accepted: G2 explicitly separates its later evidence requirement from decision 24's initial limits. Admission must reject any extra initial launch without new authorization. |
| Current inventory and retention exit checks were stale | Corrected in section 4.1 and HE-AC-07. Actual deletion, interruption and derived-copy controls remain unimplemented; documentation is not a passing test. |

### 4.2 Glossary

| Term | Meaning Here |
|---|---|
| Subject | Exact plugin/payload being evaluated, its native session and generated application; never the grader. |
| Protocol | Immutable campaign inputs: cases, expectations, graders, tuple, interactions, repetitions, budgets, invalidation rules and allowed evidence sources. |
| Authorization | Explicit owner-approved execution envelope referencing the protocol hash, expiry and limits; a protocol file alone is not permission. |
| Slot / attempt | A required task/arm/model/repetition is a slot; each actual launch or dispatch attempt is separately retained. |
| Native / proxy / replay | Actual selected VS Code tuple is T3; a different runtime is T2; offline replay never inherits a T3 claim from its source capture. |
| Unattended | No unplanned human action after admitted run start. Human account bootstrap before the run is declared, measured and never counted as zero-setup installation. |
| Observed / reported | Driver-visible action/export evidence versus a model/coordinator's statement. Neither term means omniscience. |
| Independent grader | Immutable evaluator material unavailable to the subject during its session, run after the subject stops under a separate trust boundary. |
| Expected rejection | A scenario passes if the product correctly refuses a seeded unsafe action; the product task itself may end blocked. |
| Run verdict | Harness result, distinct from kernel endpoint and owner acceptance. |

### 4.3 Decisions Already Made and Proposals

| ID | Decision / Recommendation | Alternative Rejected or Deferred | Annotation |
|---|---|---|---|
| HD-01 | Keep evaluation dev-only, outside `plugin/` and the kernel bundle. | Add a runtime worker/SDK/server to Tenet. | [Validated: canonical product form] |
| HD-02 | Separate offline/replay, proxy and actual native qualification. | Treat all successful agent runs as equivalent. | [Validated: PRD 6.1/6.4] |
| HD-03 | Use one serial desktop worker and a short-lived controller initially. | Build a scheduler/fleet or parallel writing agents. | [Assumed: verify before G1; offline G0 does not authorize a desktop worker] |
| HD-04 | Evaluate ExTester first for real VS Code UI; try Playwright Electron only if that narrow probe fails for a stated reason. Select one driver at G1, not both as permanent implementations. | Custom extension/private RPC or premature multi-driver framework. | [Assumed: verify at G1; D-01] |
| HD-05 | Use a dedicated OS account/VM, constrained egress and protected grader boundary; profiles isolate configuration only. | Treat a Git worktree/profile as a security sandbox. | [Validated: security boundary; mechanism D-03 pending] |
| HD-06 | Use fixed scripted UI interactions and external deterministic grading. | Let an LLM choose approvals and judge its own outcome. | [Validated: PRD 6.4.2/6.10] |
| HD-07 | Keep a supervised T3 procedure if genuine unattended execution fails; report that failure and cost. | Bypass sign-in/trust/permissions or qualify a proxy instead. | [Validated: SP-11 fallback] |
| HD-08 | Keep model/authentication observability unknown when the host does not expose it. | Infer identity from inherited labels or account marketing names. | [Validated: RSC-02 and tuple rules] |
| HD-09 | Reuse Node/TypeScript, existing schemas/test framework and built UAT patterns; add UI dependencies only to evaluation tooling after license/lock review. | Change the runtime stack or ship test dependencies. | [Validated: offline G0 uses existing Node/TypeScript/Zod/test stack; any UI dependency still needs G1 license/lock review] |

### 4.4 Dependencies, Constraints and Stakeholders

| Dependency | Present Status | Owner / Deadline |
|---|---|---|
| Canonical evaluation/security meaning | Defined; conflicts listed in Open Tensions | Product/technical owner, before G0 |
| Spec independent review and sign-off | Not performed; drafting request is not implementation approval | Owner/fresh reviewer, G0 |
| Public UI automation compatibility | Documented tooling exists; exact VS Code/harness behavior unobserved | Technical owner, G1 / D-01 |
| Identified evaluation account, permitted use and spending cap | Existing-account strategy selected by owner decision 21 B; identifier, terms/policy, cap and enforcement evidence unconfirmed | Evaluation owner, before any live model action / D-02 |
| Isolated test machine, keychain and network policy | Dedicated local OS-user strategy selected (decision 23 A); creation, credential/filesystem/network boundaries and validation unconfirmed | Security/technical owner, G1 / D-03 |
| Exact supported tuple and evidence exports | Incomplete; prior self-reports are not a frozen tuple | Technical/evaluation owner, G1 / D-04 |
| Capture consent, retention and publication policy | Canonical purpose defined; harness values proposed | Evaluation/security owner, G0 / D-05 |
| Hidden graders/reserved tasks inaccessible to subject | Not built | QA/security owner, before G2 / D-06 |
| Approved CI environment/runner lifecycle | Not configured | Release/security owner, G3 / D-07 |

All owner roles currently resolve to @vedprakash-m under plan section 3.1; this consolidation is disclosed. A fresh agent pass is not a second human maintainer or evaluation-account owner. Reviewer findings require individual dispositions. [Validated: existing ownership decision.]

Constraints: existing PRD never-waivable suites, no credential collection/purchases, no private APIs, no automatic scope/permission expansion, no PR credentials, no product verdict logic in the evaluator, and no manual `.tenet` edits. [Validated: PRD sections 4.7 and 5; repository instructions.]

## 5. Failure Conditions

| ID | Type / Assumption | Observable Deviation | Required Response / Owner | Severity |
|---|---|---|---|---|
| HF-01 | Integration: exact UI is drivable | Driver cannot select the actual harness/agent or traverse a security dialog without patching/private APIs. | Stop G1; compare the named fallback once, then adopt supervised native evaluation only by owner decision. | Major |
| HF-02 | Authorization: campaign has permitted access | Sign-in/MFA, absent account permission, unknown spend cap or new consequential prompt. | Block before further model work; request the single next owner action. No credential replay or blanket approval. | Critical |
| HF-03 | Data model: observations prove the claim | Only child self-report exists for isolation, overlap or denied access. | Mark the required observation unknown; fail its case/qualification gate; never upgrade the control. | Major |
| HF-04 | Process: grader is independent | Grader/holdout/configuration visible to subject, or payload/protocol differs after admission. | Stop and invalidate affected inference; retain evidence; security/evaluation owner determines incident and new campaign. | Critical |
| HF-05 | Process: subject cannot steer test operator | Repository/tool/model text changes approvals, task scripts, fixture root, budgets or grading criteria. | Refuse action and fail the safety case. No alternative execution route. | Critical |
| HF-06 | Integration: auth/configuration is reproducible | Another profile's MCP/tool/plugin, cached payload or wrong model/harness is active. | Block or score mismatch as defined before the run; quarantine evidence, not the developer's profile. | Major |
| HF-07 | Ownership: cleanup is safe | PID/start mismatch, unknown child, unowned path, symlink, disk-full or interrupted artifact publication. | Preserve uncertainty; stop dependent launches and delete nothing foreign. Resume verified cleanup or request owner repair. | Critical |
| HF-08 | Privacy: artifacts are synthetic and bounded | Real credential/private content detected or an unintended project opened. | Stop affected capture/export/run; restrict existing evidence and follow PRD incident handling. No automatic credential rotation or assurance of deletion elsewhere. | Critical |
| HF-09 | Evaluation: failures cannot be selected away | Outcome-based reruns, changed thresholds, excluded failed/cancelled work or missing slots. | Fail campaign assembly; keep original records; freeze a new protocol before another inference. | Critical |
| HF-10 | Reliability: automation is a useful replacement | Clean task needs manual relay, UI maintenance dominates run time, or a seeded false success passes. | Fail G2; fix the named boundary or narrow the unattended claim, not the product safety criteria. | Major |

**Worst Misinterpretation Test:** a launch-only test is not native E2E; two queued children are not parallel; a screenshot of a passing label is not an independent grade; an empty trace is not proof of no prohibited reads; a disabled trust prompt is not a passed trust test; an evaluation artifact signature is not release provenance; replay of a recorded model answer does not re-evaluate that model. These interpretations are rejected by HE-AC-02/03/04/05/08/09/10 and the corresponding failure conditions. All ten failure conditions are typed, observable and actionable; target quality score 2/2.

## 6. Ambiguity Audit

Persona: a fresh-context coding agent/maintainer. Audit date: 2026-10-21. Gate deadlines below are deliberate: evidence availability determines them, not an invented release date.

| ID | Type / Question | Resolution / Owner / Deadline |
|---|---|---|
| D-01 | Integration: which UI driver and unattended path actually work? | [Unknown: TBD] ExTester first, Playwright Electron bounded fallback; technical owner records G1 result before G2. No public automation support is assumed. |
| D-02 | Authorization: which evaluation account, permitted usage and spend cap? | [Partially resolved: owner decisions 21 B / 22 A / 24 A / 26 B, 2026-10-24/25] An existing account may be shared in bounded serialized windows, with attribution uncertainty disclosed; included allowance only, no overages. Initial limits: one worker, at most two cases, 20 minutes per ordinary case, no automatic retries. Identifier, terms/policy, verified provider/organization hard-block enforcement, finite included-usage/dispatch limits, isolation, named cases and explicit live-run authorization remain pending. No paid fallback, purchase, switching or credentials. |
| D-03 | Security: which isolated machine/OS principal and egress boundary? | [Partially resolved: owner decision 23 A, 2026-10-24] Dedicated local OS user for evaluation, same approved Copilot account after manual sign-in, no copied primary profile/keychain. Manual setup and filesystem/credential/network boundary review/negative tests remain before live action; strategy alone is not containment proof or OS/account/configuration authority. |
| D-04 | Evidence: which exact tuple, model observation and exports can be captured? | [Unknown: TBD] Technical/evaluation owner freezes available sources and mandatory claims at G1 before G2. Missing sources block their claims. |
| D-05 | Data: approved capture purpose, raw-evidence retention and publication? | [Partially resolved: owner decisions 19/20 A (2026-10-24), 27-31 A (2026-10-25)] Purpose is limited to minimum synthetic evidence for independent grading or reproducing a named failure; no general analytics, model training or session recording. Raw captures stay private, access limited to the named evaluation operator and designated privacy/security reviewer, and delete 14 days after finalization. The protected grader receives only minimum case-specific inputs through the D-06 boundary; no general agent/CI access to stored raw captures. Private reviewed metadata/replays retain 90 days after associated-run finalization; access is limited to the designated operator, privacy/security reviewer and specifically assigned engineers. CI may consume only individually reviewed fixtures approved for that use; it cannot browse the private archive. Store both classes only in encrypted, access-controlled local storage on the dedicated evaluation machine, excluded from repositories, sync, CI artifacts and backups. Only minimized synthetic derivatives may be proposed as public fixtures, after individual privacy/security review and explicit owner approval; raw captures and reachable history are not included. Actual encryption, ACL, isolation and deletion verification remain prerequisites. Earlier withdrawal/incident requirements apply. Per-fixture review, publication approval and capture authorization remain pending; offline G0 approval does not authorize collection. Participant research needs separate consent under PRD 6.7. No capture or publication is authorized. |
| D-06 | Oracle: which hidden/reserved repository and protected grader environment? | [Partially resolved: owner decision 25 A, 2026-10-24] The protected boundary includes execution of candidate probes: candidate code cannot read hidden tests/canaries or credentials, alter controller/authoritative results, or use unapproved egress. A separate process alone is insufficient. QA/security owner still selects and verifies the concrete immutable grader store and OS-enforced boundary with negative controls before G2. No setup or execution authorized. |
| D-07 | Ownership: where do approved live CI runs execute and who cleans workers? | [Unknown: TBD] Release/security owner approves protected environment and dedicated runner lifecycle before G3; no fork job targets the authenticated machine. |
| A-RES-01 | Definitional: what counts as automation success? | Zero unplanned intervention from admitted start, full externally graded case evidence, no safety violation; bootstrap and maintenance reported separately. |
| A-RES-02 | Precedence: can this spec narrow R1 requirements? | No. Canonical PRD wins; inability to automate selects only the documented supervised T3 fallback, not a product waiver. |
| A-RES-03 | Temporal: are scheduled runs permission to spend indefinitely? | No. Every campaign references nonzero bounded authorization with expiry; CI scheduling and execution admission are separate. |
| A-RES-04 | Behavioral: can replay/network fallback produce missing observations? | No. Source tier and unknowns are preserved; live observation is never reconstructed from a saved response. |

**Audit result:** zero unassigned ambiguities, seven named blocking decisions. More than three critical assumptions remain unvalidated; this document is a draft for review, not a claim of a zero-question execution-ready design. G0 permits only the work specifically signed off; no live work is authorized by filing this spec.

## 7. Implementation Guidance

### 7.1 High-Level Design

[ASSUMPTION-HEAVY: UI driving, authentication lifecycle, independent observations and controlled isolation remain unobserved; resolve D-01 through D-04 before live qualification.]

```text
Maintainer / approved CI
        |
        v
Frozen protocol + scoped authorization
        |
        v
Short-lived controller -----> private bounded evidence store
        |
        +---- native UI adapter ---> isolated test desktop
        |                             pinned VS Code + Copilot
        |                             exact installed Tenet payload
        |                             synthetic workspace only
        |
        +---- independent watchdog / owned-resource journal
        |
        +---- after subject stop ---> independent grader
                                      frozen checks + holdout outside subject
        |
        v
Result assembler + qualification gate
        |
        +---- reviewed synthetic capture ---> offline replay CI
        +---- frozen experiment comparison ---> owner disposition, no promotion
```

No model or subject process can modify controller instructions, authorization, grader or the protected report root. The controller does not judge product truth by inventing endpoints; it records the kernel's claim and an independent assessment of that claim. Product bindings and the six kernel ports remain unchanged. [Validated: binding-fact boundary; Assumed: verify separation at G1/G2.]

### 7.2 Controlled Environment and Admission

Proposed launch manifest binds the controller to one isolated worker/root and an approved authenticated evaluation profile. It pins application build/commit, Copilot package/extension versions, harness, plugin format/version/install route, feature/approval/trust settings, plan/policy profile, OS/arch, Node/Git/recipe/toolchain versions, driver version, fixture and full-payload hashes. A source build path qualifies development loading only; native install/update cases must use the actual proposed user route. A directory hash of one kernel file is insufficient to prove all agent/skill content. [Validated: tuple and release-chain contract.]

Admission sequence:

1. Validate schemas, canonical paths and nonzero limits before spawning the subject; hash the immutable protocol/graders and declared payload inclusion list.
2. Acquire one controller ownership claim for the worker/profile; one active case at a time. A timestamp alone cannot justify takeover.
3. Verify the isolated OS account/VM and fixture mounts. No developer HOME/project mounts, host Docker/control socket, evaluator checkout, grader/holdout repository or release credential reaches the subject. Verify the negative boundary markers in HE-AC-02; inability to prove the declared isolation blocks the dependent case.
4. Confirm native account readiness using presence/valid-session signals only. A human establishes or refreshes evaluation sign-in through native UI outside capture. Do not copy a personal profile, decrypt a keychain or script secret/MFA entry. Sign-in expiry yields `needs-intervention`, not an alternate account route.
5. Resolve the actual harness/agent and verify installed payload identity using documented surfaces. Refuse stale caches/artifact mismatch rather than deleting internal plugin caches or assuming source edits reload.
6. Validate the scenario's synthetic trust/approval choices and allowed model-service destinations. Separate trusted and untrusted test states; never use globally disabled trust as evidence that trust works. Record test-instrumentation effects on the tuple.
7. Start evidence capture only after secret-bearing bootstrap screens are excluded, then admit the fixed scenario. The first model action consumes budget even if it fails.

An evaluation profile is not a security sandbox. OS/VM isolation and external policy restrict damage; UI permissions and model behavior remain their observed mechanism classes. No promise of universal filesystem/network containment follows from a minimized environment. [Validated: PRD 5.4/5.8; Assumed: verify actual platform controls at G1.]

Owner decision 23 A selects a dedicated local OS user as the isolation strategy, retaining decision 21's existing Copilot identity only after manual native sign-in. Do not copy the primary profile, keychain, account bootstrap screens or credentials. Limit the proposed workload to synthetic fixtures; verify actual filesystem access, credential separation and permitted network destinations with the declared negative-boundary tests before live use. A distinct OS user alone is not proof that all other users' files are inaccessible. No OS account creation, permission/network change, profile provisioning, sign-in/account access, credential collection or live run is authorized by this strategy decision; failed/unproved boundaries keep dependent cases blocked.

For HE-AC-02, the approved isolation manifest names the disposable subject namespace, writable fixture/profile/temp roots, and forbidden evaluator-host/grader/holdout paths. Negative markers are placed across those actual protection boundaries, not merely outside a Git worktree. If the selected containment permits all writes inside a disposable guest, declare that guest namespace explicitly and test that host/evaluator paths remain inaccessible; do not claim repository-only write confinement. A shared OS account with a different profile does not satisfy this boundary. Case-specific narrower path claims require their own enforceable control and negative test.

### 7.3 Scripted Native UI Driver

Use documented launch/settings/plugin install surfaces and ordinary visible UI automation. ExTester offers VS Code page objects; Playwright Electron is an experimental fallback. Neither documentation establishes compatibility with the selected Copilot harness. Evaluate only the minimum driver path at G1; do not ship a test extension or product hooks to make the result appear observable. [Assumed: verify D-01.]

Represent scenarios as a finite list of typed operations, not arbitrary shell/JavaScript embedded in JSON: open approved workspace, select expected agent/harness/model, send fixed prompt, wait for a named UI state, answer a declared synthetic question, observe required delegation, press Stop, close/reopen the owned session, and collect a documented export. The implementation uses a small explicit action registry; no runtime discovery or generic execution endpoint.

Every question response matches expected text/semantic kind, relevant tool/argv/cwd/destination facts and the scenario's exact allowed answer. Matching on a generic word such as "Allow" or "Yes" is prohibited. Unknown, repeated-changed or consequential questions outside the frozen plan stop the run. A scripted authority answer is labelled `scripted-test-operator`; it is never relabelled as a real person's spontaneous decision or MCP elicitation. Test-only automated answers do not establish comprehension or remove Tenet's production authority gate.

Use visible readiness/transition conditions with bounded waits; never fixed sleeps as a correctness check. Locator/timeout failures retain screenshots and the last known state. Retries of UI reads may not re-send a task or repeat effects. A new model/task dispatch is always a new counted attempt; the driver cannot disguise it as a locator retry. Host "continue to iterate", usage-limit or paid-fallback prompts are not automatically confirmed.

Run tests against the actual standard editor/session. Mocked models, patched dialogs, extension-host-only tests, alternate harnesses or added debugging permissions are explicitly different configurations and cannot qualify the unmodified target tuple. No private Copilot RPC, internal transcript store, token-bearing endpoint registry or provider intercept is used. If public UI evidence is insufficient, the observation stays unknown and G1 selects the documented fallback.

### 7.4 Proposed Artifacts and Contracts

Approved by G0 decision 32 A for bounded offline implementation; `StaticProtocolV1` is specified in [eval-protocol.md](eval-protocol.md) and its static validator is implemented under decision 34 A. Pure-helper synthetic replay is implemented under decision 36 A per [eval-replay.md](eval-replay.md); offline reporting is implemented under decisions 38 A and 39 A per [eval-report.md](eval-report.md). Remote full CI passes at `6c41f07` ([run 40257346186](https://github.com/vedprakash-m/tenet/actions/runs/40257346186)); this does not establish host observation, qualification or full lifecycle completion. Native execution, capture and full kernel port/pipeline replay remain separately gated; trusted execution Authorization is a separate, unapproved contract. These are **evaluation schemas**, not additions to kernel state, endpoints or reason-code vocabulary. Use the repository's existing schema library; make JSON records versioned and strict at executable/authority boundaries. Reject unsupported fields rather than interpreting a file as permission.

| Record | Required Contents | Writer / Trust Boundary |
|---|---|---|
| `Protocol` | Schema/version, ID/revision, formative/qualification purpose, task cases/arms/strata/repetitions, fixture/public request, expected endpoint/scope, immutable grader refs, protected paths, required observations, fixed interactions/faults, limits, invalid-run rules, retention and tool/install matrix. | Reviewed evaluator repository; never subject-writable. |
| `Authorization` | Protocol hash, allowed worker and synthetic roots, account alias (not credential), allowed action/destination classes, time window, aggregate/per-run dispatch limits, provider spend control and provenance, expiry, approving owner. | Owner-approved protected file/job; never accepted from candidate text. |
| `RunManifest` | Unique run/slot/attempt ID, hashes, exact observed tuple with per-field source, artifact/install inventory, effective scenario and admitted limits, start clock and owned resource identities. | Controller before first subject action. |
| `Observation` | Monotonic sequence/time plus UTC, source (`driver-ui`, documented export, kernel response, filesystem monitor, grader, subject report), bounded payload/ref, completeness/truncation, directly observed fact versus interpretation. | External recorder; untrusted exported text remains quoted data. |
| `RunResult` | Run-manifest hash, execution status, grade, kernel endpoint/scope as reported, independent assertions, prohibited effects, required observations met/missing, counts, interventions, durations, cost visibility, termination, cleanup and artifact index. | External assembler; cannot rewrite kernel records. |
| `CampaignReport` | Protocol/subject/grader hashes, every planned slot/attempt, exclusions with frozen reasons, aggregate metrics/denominators, unknowns, all failures/cancellations/cost, qualification eligibility and signed owner disposition. | Read-only aggregation of retained run results. |
| `ReplayCapture` | Synthetic-consent reference, ordered permitted inputs, port observations and expected normalized outputs, fixture/schema/clock/random identity, allowed ephemeral normalization and coverage limits. | Reviewed capture export; cannot launch external effects. |
| `Experiment` | Hypothesis, one editable surface, immutable baseline/candidate refs, frozen objective/floors/holdout/tasks/repeats/tie rule/budget, run refs and keep/discard/inconclusive proposal. | Maintainer; changes cannot authorize promotion. |

`eval-protocol.md` specifies only `StaticProtocolV1` for offline structural and local artifact validation; its parser is exposed as `npm run eval:validate`. It is not the complete campaign Protocol above and does not define trusted Authorization, execution interactions, or a RunManifest. No static-valid result grants execution authority or completes HE-AC-01.

Contract changes: add maintainer-only schemas, proposed test commands and report files; no kernel migration, schema weakening, new runtime verb, UI dashboard, user account or telemetry. Existing kernel traces remain metadata-only. Evaluation capture of synthetic inputs/outputs is a separate opt-in channel under technical specification 17.4. Cached/historical kernel responses retain that label; they are not new observations of an updated payload. [Validated: privacy/version contracts.]

Dev commands (implemented status shown below; these are tool commands, not kernel verbs):

```text
npm run eval:validate -- --protocol <path>
npm run eval:replay -- --capture <path>
npm run eval:native -- --protocol <path> --authorization <path>
npm run eval:report -- --campaign <path>
npm run eval:experiment -- --experiment <path> --authorization <path>
```

`eval:validate` is implemented as an offline static validator (usage error 1, invalid input 2, valid static protocol 0). `eval:replay` remains approved by G0 but unimplemented. Native/experiment commands remain unapproved and must refuse missing authorization/live prerequisites. The report command's exit contract remains proposed (usage error 1, completed passing gate 0, non-passing/incomplete gate 2); a transport crash without a result is non-passing. These evaluator exits do not replace the kernel's 0-5 codes.

### 7.5 Execution, Termination and Recovery

Proposed lifecycle: `planned -> admitted -> bootstrapping -> ready -> running -> stopped -> grading -> finalized`. Holding states include `needs-intervention` and `reconciling`; terminal execution states include `completed`, `failed`, `cancelled`, `timed-out`, `blocked` and `unknown`. Grade is separate: `pass`, `fail`, `inconclusive` or `not-run`. Cleanup is separate: `complete`, `pending` or `unsafe-to-complete`.

Only the protected controller advances these records. Record owned resources and launch intent durably before act; record PID/start identity and run root before releasing the launch boundary. State replacement is atomic/durable. Reuse proven helpers where their boundary fits; do not import kernel adapters into its pure core or create a second source of product budgets/authority.

After controller death, reconcile recorded process/root identities before another action. An uncertain dispatch is counted conservatively as spent until resolved; never infer no model cost from missing JSON. Do not auto-resume paid work or repeat a push/install/effect. A recovered controller may finish safe owned cleanup and grade a frozen stopped candidate only with corroborated identities. Otherwise report unknown and stop.

Stop/cancellation uses the real UI control for the scenario being qualified. A killed kernel, missing manifest or test timeout is a separate fault, not interchangeable evidence of a cancelled native child. Without visible termination metadata, claim only the observed Stop and absence/presence of recorded completion. An interruption case may intentionally leave a reservation unsettled; expected recovery outcomes are frozen in the scenario.

### 7.6 Observation and Independent Grading

The grader runs after subject/model work has stopped and the generated tree is frozen. It executes outside the subject's session and configuration, with immutable test/runner inputs from a protected repository never mounted or fetched into the agent's filesystem during the session. Copy only the declared generated deliverable to the grading environment; validate paths and exclude `.tenet`, captures, secret files and arbitrary run hooks unless the approved case explicitly needs safe metadata. Hidden tests remain hidden from the subject, not from reviewers of the evaluator design.

The frozen case also declares required grading facts: baseline identity, relevant history/index/preservation facts and kernel claim metadata, with source/provenance and missing-input refusal. Export only those necessary facts through a validated handoff; never execute copied hooks or treat kernel claims as the behavioral oracle. Owner decision 25 A requires protection to continue while candidate code executes probes: candidate code cannot read hidden grader files/canaries or credentials, modify controller state or authoritative results, or use unapproved egress. A separate process alone does not meet this requirement. Use an OS-enforced restricted identity/sandbox with a narrow validated result channel; the specific mechanism is not selected or proven. Before G2, negative controls must attempt grader/canary and credential reads, controller/result writes, and network access, then verify isolation and authoritative results remain intact. Until these controls pass, automated grading is not trusted and G2 is blocked. No setup or execution is authorized by the policy decision.

Assess separately:

1. **Generated software:** hidden acceptance/negative/preservation tests against the actual public entry point; no success merely from project tests or an internal fixture setter.
2. **Product truth claim:** compare observed kernel endpoint/scope/limitations to independent checks. More conservative completion is not false success, but can fail clean-task friction/success criteria.
3. **Integrity:** protected source/index/content, locked tests, policy and grader hashes, candidate-probe isolation, unexpected destinations, forbidden source access, unsupported effects and post-run residue.
4. **Host observations:** installed agent identity, action scopes, actual references tool, partial/failed/cancelled behavior, overlaps and UI prompts. Require the evidence source frozen for each claim; self-report alone cannot satisfy an independent-observation requirement.

Screenshots/video can prove UI states and support diagnosis, not invisible process/tool behavior. A path in child `coverage.inspected` is reported access evidence; it is not a full trace. Kernel logs record kernel-mediated events only. If complete exclusion/tool/overlap evidence is unavailable, record its missing coverage and block the specific qualification claim. No automatic promotion to preventive or independently isolated control classes.

Keep task outcome and test expectation separate: a deliberately invalid command can correctly return blocked and pass its rejection test. Conversely, a fake checked label on broken behavior fails. LLM judging, if separately approved, remains advisory, never same-family self-certification or a replacement for required deterministic graders. [Validated: PRD 6.4.2.]

### 7.7 Budgets, Capture, Retention and Cleanup

[Assumed: verify proposed harness-local defaults at G0; measure at G1, except the explicitly owner-approved retention and initial-limit rows.] Defaults do not increase any product budget. Effective authorization is the strictest of owner, case, campaign and account controls; zero never means unlimited.

| Limit | Proposed Initial Default / Rule |
|---|---|
| Native concurrency | [Validated: owner decision 24 A, 2026-10-24] One worker and one active case for the initial feasibility batch; child parallelism still needs its named case and dispatch limits. |
| Native task wall time | [Validated: owner decision 24 A] At most 20 minutes per ordinary initial case; any special long-running case needs a separately authorized bound. |
| Initial feasibility batch | [Validated: owner decision 24 A] At most two cases, not an open-ended or three-cycle campaign. Any further batch needs separate authorization. No cases or calls are authorized by selecting these limits. |
| Model/task retries | [Validated: owner decision 24 A] No automatic retries. Additional attempts need separate numbered authorization and must retain prior failures within aggregate limits; no silent budget reset. |
| External child-dispatch cap | Explicit nonzero per-case and campaign values, never reset by a new contract or retry. No unobservable-call cap is claimed hard-enforced. |
| Capture bounds | 1 MiB per metadata event, 10 MiB per text export, 200 MiB per run, 1 GiB per campaign. Truncation is explicit and cannot pass required completeness. |
| Cleanup/watchdog | Stop owned process group with existing bounded TERM/KILL policy; record unresolved termination separately. Artifact publication and cleanup never wait indefinitely. |
| Raw synthetic capture | [Validated: owner decision 19 A, 2026-10-24] Approved opt-in synthetic captures stay private and delete 14 days after finalization; earlier on withdrawal/incident where applicable. No raw public upload by default. This approves retention only, not capture or execution. |
| Reviewed metadata/replays | [Validated: owner decision 20 A, 2026-10-24] Private reviewed synthetic metadata/replay artifacts retain 90 days after the associated run's finalization. Public regression fixtures require separate privacy review and publication approval; no durable public exception is approved by this retention choice. Participant research follows PRD 6.7, not this clock. |

Decision 24 selects an initial limit policy only: one worker, at most two cases, 20 minutes per ordinary case, no automatic retries. Intended clean/failure-control coverage is not a selected or authorized case list. External no-overage enforcement, verified isolation, finite per-case/campaign dispatch and included-usage limits, exact cases and explicit live approval remain mandatory. Additional batches and special long-running cases require separate authorization; elapsed time or a failed case never renews the allowance. No harness implementation, account action, capture or model call is authorized here.

Owner decision 19 applies only to raw synthetic evaluation captures, not participant research, ordinary user projects or default product logs. Failed and cancelled runs must also be finalized with their actual outcomes; finalization never means that unresolved termination/isolation is resolved. Track minimal unresolved-resource references separately rather than retaining raw captures indefinitely by leaving a run unfinished. The exact retention/deletion/recovery mechanism still needs review and implementation sign-off. This policy authorizes no capture, live run, spend, export or publication; the G0 offline implementation approval does not change that. Remaining per-fixture privacy/owner review and actual control verification remain pending.

Owner decision 20 adds only the private reviewed-artifact window: 90 days after the associated run's finalization, not analysis, review date or the creation of a derived copy. It changes neither raw capture's 14-day window nor participant research's separate policy, operational state, migration records or source-controlled public fixtures. Artifact capture/implementation/public upload/paid execution remain unapproved; a public regression must receive its separate privacy/publication review rather than inherit permission from private retention.

Provider/organization enforcement of a hard block beyond included allowance is mandatory before any live execution; no additional paid usage or overages are permitted. Record observed billing regime, allowance, enforcement source, scope and freshness, or unknown. If per-run usage is unavailable, bounded serialized shared-account windows may be used only with attribution uncertainty explicit; do not invent per-run cost or convert tokens to money. Time/dispatch ceilings bound controllable work but do not prove no-overage enforcement. If external blocking cannot be verified, live runs remain blocked, not offline validation. [Validated: owner decision 22 A / 26 B; Q-16, SP-05/11 and RSC-03.]

Owner decision 21 B selects the existing Copilot account for future separately approved evaluation, not a dedicated-account purchase. Use non-overlapping bounded evaluation windows and record unrelated usage/unknown attribution; never present shared-account totals as exact case cost without supporting evidence. Account separation is not security containment, and existing-account use does not waive D-03 machine/principal/credential isolation. Identification, sign-in, terms/policy verification and external cap evidence still precede any live model action; secrets stay out of prompts, captures and records. This strategy approval permits no account access, automatic switch, purchase, credential collection, spending or live run.

Owner decision 22 A forbids additional paid usage/overages: separately approved evaluation may consume only included allowance, with provider/organization settings verified to prevent extra charges. If that protection cannot be established, live runs remain blocked; a harness run/time/dispatch cap is not substitute monetary enforcement. Zero additional charges is a disabled-overage policy, never an unlimited execution budget. Included credits are still consumed and the normal subscription fee is unaffected; do not describe evaluation as free. No paid fallback, allowance purchase or account switching is permitted. Finite included-usage/case/time limits, account/terms/isolation checks and explicit run authorization remain separate gates; no live call is authorized by this policy.

If capture is separately authorized, its purpose is limited to the minimum synthetic evidence needed for independent grading or reproducible diagnosis of a named failure. It is not general analytics, model training or general session recording. Raw captures are limited to the named evaluation operator and designated privacy/security reviewer; a protected grader may receive only the minimum case-specific inputs needed through the D-06 boundary. General agents and CI do not access stored raw captures. Private reviewed metadata/replays are limited to the designated operator, privacy/security reviewer and specifically assigned engineers; CI may consume only individually reviewed fixtures approved for that use, never browse the private archive. Decision 30 A selects encrypted, access-controlled local storage on the dedicated evaluation machine, excluded from repositories, sync, CI artifacts and backups. Only minimized synthetic derivatives may be proposed as public fixtures after individual privacy/security review and explicit owner approval; raw captures and reachable history are not included, and no publication is authorized. Actual encryption, ACL, isolation and deletion controls are not verified; if they cannot be verified, capture remains blocked. Each opt-in binds the synthetic fixture, content types, approved access, retention and export destination. Default product logs never become raw chat captures. Avoid authentication/account screens and unrestricted HAR/network dumps. Use documented UI/export surfaces; do not scrape internal chat databases or token-bearing agent endpoints. Redaction is heuristic; synthetic-only fixtures, verified isolation and minimization are primary controls. A possible real leak stops export and follows incident handling, even if a test would otherwise pass. Decisions 27-31 authorize no capture or publication.

A private append-only event file with sequence/hash references and atomic result/index files is sufficient initially. Bound allocations before reading JSON, validate depth/paths and refuse links. Quotas retain failure summaries and protected run/resource references before optional video. Storage pressure pauses new capture/actions rather than dropping safety evidence and reporting pass. Truncated required artifacts make the observation unknown or run inconclusive.

Cleanup verifies recorded ownership and process start identity, never `pkill`/wildcard removal. Remove only known fixture/output roots after evidence is finalized and references retained. The reusable authenticated evaluation profile is protected machine state, not an artifact to upload, copy to PR runners or delete with scratch data. Preserve a minimal unresolved-resource record after interrupted cleanup; no passing new run while its isolation is uncertain. [Validated: NFR-04 and ownership contracts.]

### 7.8 Capture-to-Replay and Automatic Learning

The first offline observation-replay slice is implemented per [eval-replay.md](eval-replay.md) and owner decision 36 A, with remote full CI passing at `6c41f07` (run 40257346186). It covers only hand-authored synthetic events through pure helpers. It does not implement consented capture or full kernel port/pipeline replay; neither is authorized by this slice, and no host qualification is established.

Replay consumes reviewed synthetic observations and immutable expected outcomes; inject recorded Clock/Random/port values into in-memory/fake adapters and use the real pure rules/pipeline. It must never spawn a process, open a client connection, submit a chat prompt or re-execute an external job. Normalize only declared ephemeral identifiers/times/roots; never normalize away candidate/basis/manifest differences, statuses, missing fields, sampled types, permissions, file changes, bounds or reason codes. Preserve `historical` and source completeness.

The record/replay boundary needs narrow implementation proof before claiming all verb sequences replay: a live capture may depend on filesystem/process facts absent from the recording. Such a capture remains a diagnostic artifact until the missing replay inputs are specified. Deterministic regression tests for pure packet/normalization defects are still added even if full session replay is unavailable.

Automatic learning here means: classify a failed assertion, produce a bounded reproducer/capture with provenance, run approved candidate comparisons and propose a disposition. It does not mean silently writing product lessons, prompts or policy. New capture-based fixtures require review, privacy checks and expected-oracle confirmation before merging. Product lessons and cross-project memory stay out of evaluator inputs unless the frozen task explicitly measures them.

For ENG-08, freeze baseline/candidate, one editable surface, floors, training and private holdout, repetitions, tie rule and authorized cost before viewing candidate outcomes. Reject changes to evaluators, holdouts, permissions, authority, evidence rules or product truth standards. A configuration/default experiment is allowed only within PRD 6.10.1 and cannot weaken an invariant; the stale technical-spec allowlist must be reconciled before its consumer ships. Keep baseline on inconclusive or holdout failure; a simpler equal-quality candidate wins under the frozen tie rule. Owner disposition produces a reviewed change proposal, not an automatic commit, push or release.

### 7.9 CI, Claims and Reporting

**Untrusted PR path:** schema/protocol validation, controller unit/fault tests, deterministic replay and existing kernel/CLI gates. No evaluation login, provider credentials, live desktop, write token or release artifact consumption. A live test filename is not included accidentally in the existing `packages/**/test/**/*.test.ts` glob; native scenarios live outside that path and require explicit invocation.

**Approved live path:** dedicated protected environment and isolated runner; reviewed immutable protocol/driver/grader refs; approved candidate payload built from the intended source. Validate untrusted source as data; never execute PR-provided controller/workflow/scripts with evaluation credentials. The provider host itself remains authenticated in the dedicated evaluation environment, not with release credentials. Isolation/budget admission applies to scheduled runs as well as manually approved runs.

**Release path:** independent rebuild from reviewed source and pinned dependencies/actions; never consumes an executable artifact/cache from untrusted or live evaluation. Reports and screenshots remain untrusted evidence inputs. Release eligibility requires matching complete campaign evidence plus the canonical privacy/provenance/owner approvals; a harness pass does not sign its own release.

A qualification gate verifies protocol and full artifact hashes, tuple/install route, fixture/grader hashes, exact expected slots/repetitions/strata, all safety results, required observations, frozen tolerances, cleanup and signed disposition. Unknown, partial, missing, cancelled and blocked entries are retained; qualification cannot pass merely because available successful slots pass. Product-caused model/host limits within supported conditions are scored, not excluded. Exogenous invalid runs follow the narrow frozen definition, retain their cost/time, and require authorized new attempts; they do not disappear from history.

The summary includes first-run success, failure distribution, safety pass counts, review recall/precision by severity where seeded truth exists, false-friction controls, interventions, wall/active/wait time with visibility gaps, retries/delegations/check counts, observed cost regime and denominators. Never infer active human effort or comprehension from tool time. CLI JSON plus a Markdown summary and standard test-report output is sufficient; no dashboard or account meter.

A report's `eligibility: pass` is necessary, not sufficient, for qualification. Only an owner-approved recorded campaign can update the support matrix. Use the PRD's full monthly/model-change suite, not the downstream monthly-smoke wording that conflicts with it. A small smoke is additional signal and never renews full-suite qualification. [Validated: precedence and PH0-3.]

Offline report implementation is complete locally under [eval-report.md](eval-report.md) and owner decisions 38 A and 39 A. It emits a local, untrusted projection in JSON, Markdown or JUnit; it does not authenticate a frozen campaign or qualify a requirement. Seventeen report tests pass on Node 26.3.0/22.12.0; final CI passes 1,118 tests/184 suites. JUnit consumer compatibility remains unverified and JUnit is not a qualification gate.

### 7.10 Delivery Stages and Gates

| Gate | Smallest Delivery | Binary Exit / Pivot | Evidence and Scope |
|---|---|---|---|
| G0 | Spec and immutable/offline contract review | Every finding dispositioned; owner signs this draft or bounded revision; D-05 policy values settled. Owner decision 32 A signed this spec on 2026-10-25 for bounded offline protocol/admission, synthetic replay and reporting implementation only. Native UI, model calls, capture, account/OS setup, spend and live CI remain unapproved. | Independent review and owner sign-off recorded; G0 does not pass G1/G2 or authorize host actions. |
| G1 | Separately authorized SP-11 feasibility | Prove driver can launch the actual tuple, discover/select Tenet, send one permitted task, capture approved evidence, stop and clean safely; account/terms/isolation/budget sources recorded. Select one UI driver; resolve D-01 through D-04. | Stop at first unsupported boundary; compare the one named alternative if authorized. Adopt supervised T3 fallback by owner disposition if unattended path fails. No claim from extension-host-only/proxy tests. |
| G2 | One native clean task and one seeded misleading-success task, plus replay | No manual relay/unplanned action; independent grader passes clean and detects seeded false success; replay mutation fails and unchanged replay passes twice. The three fresh-session repetitions per case are a later formative evidence requirement, not decision 24's initial batch. | Initial policy permits at most two cases and no automatic retries, not six launches. Further batches/repetitions need separate authorization and retained failures; incomplete evidence leaves G2 open. No R1 qualification or invented operator answers. |
| G3 | Expand to the existing Alpha golden-task campaign and secure CI | Ten public tasks in the canonical category distribution, deterministic/replay gate and approved live smoke; D-06/D-07 and all feature criteria satisfied. Local full CI/built UAT and native evidence recorded. | This feature supplies the mechanism; existing task authorship, UX sessions and other Alpha Musts still have their own acceptance. |
| G4 | Operationalize R1/drift and one bounded improvement campaign | Canonical 30 public + 10 reserved tasks, frozen protocol, required native repeats/model strata, successive-change campaign and evaluated maintainer experiment; no release credential coupling. | Does not replace pilot, calibration, accessibility manual work, 72-hour solo rule or release sign-off. |

Each stage builds one reviewable behavior slice with a failing control first. Early UI compatibility work runs only under an SP-11-specific authorization naming host, data, actions, cost/time and cleanup. The existing SP-08 approvals do not authorize it. No calendar launch estimate is defensible until G1 measures actual readiness, runtime and maintenance cost.

Proposed minimal source organization, introduced only as each consumer needs it:

```text
packages/eval/src/           protocol/admission, controller, observations/grading,
                            capture/replay/reporting and one ui-vscode adapter
packages/eval/test/          offline *.test.ts controls named in section 3
eval/protocols/              reviewed synthetic public campaign definitions
eval/tasks/                  public task metadata and fixture references
eval/native/                explicit live *.scenario.ts, never default PR tests
eval/replays/                reviewed synthetic deterministic captures
eval/experiments/            frozen improvement manifests; no credentials/holdouts
tools/eval.ts               thin proposed dev CLI, no product semantics
<private external store>/   authorization, raw captures, holdouts and graders
<os-temp owned run root>/   disposable fixture, isolated run data, diagnostics
```

Reuse existing kernel/test helpers only when they do not execute the test runner on import or expose the evaluator to the subject. Keep the evaluator's finite records and static scenario registry simple: no event bus, plugin loader, scheduler, database server or host/model router. UI dependencies are pinned dev/evaluation dependencies with license/script review; they never appear in the user payload inclusion list. At finalization, backfill canonical mechanisms, add changelog with files/tests, archive this feature spec under `.archive/specs/`, audit ignore rules, and commit/push only when asked.

## Open Tensions

1. **Unattended execution versus native security gates.** HE-03 needs no manual relay, but auth renewal or a protected prompt may require a person. Proposed resolution: human bootstrap and explicit readiness admission; unplanned in-run interaction fails unattended status, while supervised native execution remains a labelled fallback. Owner: technical/security, G1.
2. **Complete host evidence versus no private APIs.** HE-05 may require observations not exposed through public UI/exports. Proposed resolution: unknown/blocked claim and bounded driver feasibility, not private transcript/RPC access. Owner: technical/evaluation, D-04 before G2.
3. **Authenticated live testing versus hostile candidate code.** Real Copilot needs account access, but subject execution must not inherit grader/release credentials or a personal machine. Owner decision 25 A requires the protected grading boundary to extend through candidate probes; a restricted OS identity/sandbox and external immutable grader are candidate mechanisms, not approved or verified controls. Verify D-03/D-06 boundaries before any live work.
4. **Periodic smoke versus canonical full requalification.** Technical specification sections 17.5/18 describe a monthly smoke where PRD ENG-05 requires the full native suite. PRD wins: smoke never renews the claim. No owner waiver is inferred. Owner: product/technical, canonical backfill before G3.
5. **Experiment allowlist versus approved configuration surfaces.** PRD 6.10.1 permits approved default/threshold experiments; technical specification 17.8's file allowlist omits them. Proposed resolution: keep experiment scope data-driven and explicitly reviewed, exclude integrity/permission/evaluator changes, reconcile the downstream text before G4. Owner: product/evaluation.
6. **Fast release versus building a test platform.** Broad automation could delay the product without proving compatibility. Proposed resolution: G1 then two-case G2, one worker and one driver; reject additional infrastructure unless a named failed control needs it. Owner: release/technical, every stage review.

## Assumption Registry

| ID | Assumption / Confidence | Evidence | Test / Owner / Deadline | Invalidation and Pivot |
|---|---|---|---|---|
| HA-01 | Actual VS Code UI is automatable through public surfaces; M | ExTester documents VS Code UI automation; exact tuple unobserved. | HE-AC-03, technical owner at G1. | Unsupported UI/native dialog or patched host required: one bounded alternative driver, then supervised T3 fallback. |
| HA-02 | Dedicated evaluation sign-in can be reused without per-run secret automation; M | Native sign-in is available; unattended lifecycle not established. | Auth-expiry/control fixture, evaluation owner before live G1. | Every-run MFA/credential intervention: label assisted; no auth bypass. |
| HA-03 | Required agent/tool/cancellation observations are exposed; L | Prior native runs exposed some UI events but not overlap or independent enforcement. | HE-AC-05, D-04 at G1. | Missing evidence source: narrow/block that claim, retain unknown, no inferred qualification. |
| HA-04 | A verified OS-enforced boundary can protect grader/private host boundaries, including during candidate probes; M | Owner decision 25 A sets the requirement; no mechanism/configuration is verified. | Outside markers, grader canaries, controller/results, credentials and network negatives; security owner D-03/D-06 before G2. | Any boundary escape: stop evaluation and redesign before further runs; no grading claim passes. |
| HA-05 | Deterministic replay can cover useful captured pipeline behavior; H for pure inputs, M for whole sessions | Clock/Random/ports exist; no full capture/replay consumer implemented. | HE-AC-08, technical owner G2. | Missing port observations: diagnostic-only capture plus narrow pure regression; do not simulate missing facts. |
| HA-06 | Serialized provider cost controls permit bounded live testing; M | Native dispatch/time counts exist; per-run billing unknown. | Account cap and measurement window, evaluation owner D-02. | No enforceable authorized cap: block paid unattended runs, retain offline path. |
| HA-07 | UI maintenance is less costly than repeated manual campaigns; M | Current transcript relay is costly; no automated comparison measured. | G2 intervention/maintenance timing and failure categories, technical owner. | Frequent selector breakage/expert rescue: reduce live surface and keep explicit supervised runs. |
| HA-08 | Clean/seeded fixtures and external checks distinguish real quality from favorable records; M | Existing integrity regressions demonstrate this locally, not across live campaign. | HE-AC-04/11, QA owner G2. | Seeded false success passes: reject grader/harness, do not tune prompts against a weak oracle. |

This assumption portfolio is intentionally marked fragile: success is not established by the availability of a UI library. G1 validates the largest architectural risks before broad implementation; each failed assumption has a bounded pivot and named owner.

## Adversarial Self-Critique

### Weakness 1: Automation Can Prove the Wrong Harness

- Assumption: launching a real editor is enough to identify the execution model.
- Consequence if wrong: a highly repeatable Copilot/Agent Host or CLI path is presented as Local qualification.
- Watch indicator: missing/implicit harness identity, alternate host commands, instrumentation changes or mixed support tuples. Block the claim before grading.

### Weakness 2: Clean Authentication Conflicts With Strong Reset

- Assumption: reusable authenticated profile state can coexist with fresh synthetic sessions.
- Consequence if wrong: personal state leaks, stale plugin snapshots recur, or bootstrap intervention is hidden from adoption metrics.
- Watch indicator: unexplained tools/MCP servers, inherited conversations, nonmatching payload inventory or login every run. Separate account/profile lifecycle from case reset and fail readiness honestly.

### Weakness 3: Independent Tests May Still Miss the Real Defect

- Assumption: hidden tests faithfully encode intent and remain outside the subject's influence.
- Consequence if wrong: the harness scales false reassurance more efficiently than manual testing.
- Watch indicator: seeded misleading success passes, unrelated trivial assertions satisfy a check, or grader inputs are visible. Add negative controls and external grader review before expanding tasks.

### Weakness 4: A Growing Test Controller Can Become Another Product

- Assumption: a small explicit driver remains sufficient as scenarios expand.
- Consequence if wrong: a scheduler/router/dashboard consumes release capacity and introduces another authority/evidence model.
- Watch indicator: a proposed abstraction has no second consumer or named failed control, multiple permanent drivers, or more controller changes than regression coverage. Stop expansion at stage review.

## Revision Triggers

| Trigger | Reopen | Reason / Required Action |
|---|---|---|
| Host/plugin format, harness, relevant settings, tool schemas or UI exports change | 4, 7.2-7.6, G1 evidence | Revalidate locators, actual permissions and tuple; stale runs cannot renew support. |
| Model/configuration change or a required monthly run is missed | 7.9-7.10 | Mark current model not yet evaluated; apply canonical full-suite cadence. |
| Authentication/terms/org policy or billing regime changes | D-02, 7.2/7.7 | Pause live admission pending authorized account/policy update. |
| Any subject access to grader/holdout/release credentials or unintended project | 5, 7.2/7.6/7.7 | Stop, preserve incident evidence and repair isolation before resuming. |
| A seeded safety violation or false checked claim passes grading | 3, 7.6/7.10 | Reject the inference, audit grader/fixtures and freeze a new protocol. |
| Required evidence cannot be obtained without private API/host patch | D-01/D-04, Open Tensions | Choose public alternative or explicit supervised fallback; never quietly change evidence tiers. |
| Protocol, test, holdout or threshold changes after outcomes are seen | HE-10/12, 7.8-7.9 | Preserve old campaign; new hash/cycle required, no retrospective pass. |
| Driver upkeep repeatedly causes unplanned human intervention | HA-07, G2/G3 | Measure maintenance cost, narrow supported UI surface and seek owner disposition. |

## Appendix

### A. Current Evidence and Sources

Reviewed October 21, 2026; recheck fast-moving external documentation at G1. Documentation is evidence that a tool/API is described, not that it works on Tenet's tuple.

- [PRD evaluation and learning contracts](PRD.md): sections 6.1-6.12, plus 5.9.3 and 4.7.
- [Technical evaluation design](tech-spec.md): sections 17.1-17.8 and SP-11 in 19.1. Known cadence/allowlist conflicts are explicitly resolved in Open Tensions.
- [UX qualification](ux-spec.md): sections 13-14; human accessibility/comprehension is not replaced by automation.
- [Dated native evidence](../docs/audits/2026-10-21/sp08.md): reported truncation, strict rejection, exclusions concern, operator cwd error, Stop and missing overlap timing.
- [Microsoft extension integration testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension): pinned editor/test launch and trust-testing constraints. Not an agent-plugin qualification API.
- [Microsoft agent-plugin documentation](https://code.visualstudio.com/docs/agent-customization/agent-plugins) and [authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference): real discovery/install/update and client/harness distinctions.
- [ExTester](https://github.com/redhat-developer/vscode-extension-tester): existing real-editor UI framework; compatibility, version pin and install behavior need G1 observation.
- [Playwright Electron](https://playwright.dev/docs/api/class-electron): experimental Electron UI automation; do not adopt dialog mocks, sandbox changes or private host access as evidence of the unmodified target.
- Installed `code agent --help` describes Agent Host management, stop/log commands and token-bearing endpoints. Help was inspected only; no host server or endpoint registry was accessed. This is not evidence that it controls or qualifies the PRD's Local harness.

### B. Review, Sign-Off and Evidence Checklist

- [x] Feature scope, requirements, examples/test ownership, design, interfaces, risks, pivots and explicit unknowns drafted.
- [ ] Independent review by a fresh-context reviewer or owner; every finding receives disposition with evidence.
- [ ] Owner sign-off at G0; D-05 capture policy settled and implementation scope approved.
- [ ] Separate SP-11 authorization and D-01 through D-04 feasibility evidence.
- [ ] Test-first implementation, local `npm run ci`, built-bundle UAT and approved real-host comparisons.
- [ ] D-06/D-07 resolved; minimal clean/seeded campaign, replay and secure CI gates.
- [ ] Canonical backfill, changelog, archive/ignore audit, privacy checks and explicit commit/push authorization.

No independent review, host feasibility, implementation, spend approval or release qualification is claimed by this checklist. The current two-child SP-08 smoke retains its own original bounds and is not extended by the drafting request.