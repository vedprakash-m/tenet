# Tenet catalog: standard claims, evidence, decisions and features

> Level L1 · Version 0.7 · Part of [prd.md](../prd.md) · Status: **draft, awaiting the Owner's approval** · Budget: 7,000 tokens · Replaces `prd/factory-and-fleet.md` (archived at `archive/specs/prd/factory-and-fleet.md@0.6.md`)

**Context card.** Every feature Tenet offers beyond the kernel is an entry here: a standard type of one of the seven primitives (Subject, Actor, Claim, Evidence, Decision, Event, Policy) or a view computed from them. Packs choose which entries apply. IDs are those the features had before the restructure; they are never reused. Guarantee levels follow [prd.md §4](../prd.md#4-requirements); an entry is enforced at the level of the kernel rule it relies on.

## Claims

| ID | Entry | Primitive | Rule | Serves | Release |
|---|---|---|---|---|---|
| R-171 | Acceptance item | Claim (packet) | Declares claim class (functional, compatibility, non-functional, health, safety-security, outcome), method, pass rule and case IDs; the template has a worked example and asks which requirement a property captures and what would make it true but wrong | V-P2, V-V5 | 0.1.0 |
| R-111 | Independent acceptance tests | Claim (packet) | In the standard lane, acceptance tests are written by a run other than the builder's before Build and pinned in the approved subject; in the quick lane the builder may write them, and the board says so | V-P2 | 0.1.0 |
| R-170 | Continuing promise | Claim (continuing) | Closing a packet turns its preservation items into built requirements whose proving cases are protected; replacing or retiring a proving case needs a forge-verified `waive` or evidence of an equivalent; a change touching an area keeps evidence fresh for that area's promises | V-P9, V-M10 | 0.1.0 |
| R-103 | Protected paths | Claim (continuing) | Check definitions, CI and hook configuration, test, coverage, compiler and linter configuration, build scripts, pinned tests, proving cases, health indicators, theorem statements, axiom allowlists, lock, policy and factory definition (and named keys such as `package.json#/scripts`) change only with a `person-present` `approve` of `change-policy`; lockfile changes are flagged | V-B2, V-P9 | 0.1.0 |
| R-146 | Change size | Claim (packet) | Each lane caps files and lines; a larger change is split or raised | V-P5 | 0.1.0 |
| R-175 | Health indicator | Claim (continuing, baseline-relative) | Declared, tool-neutral indicators per area (complexity, duplication, architecture violations, dead code and stale flags, type coverage, suite time and flake rate, docs referring to missing code) may not worsen beyond tolerance on the touched scope versus the target's baseline without a forge-verified `waive` (`accept-health-regression`); improvements on main raise the baseline; adoption records existing problems as the baseline | V-P9, V-M10 | 0.1.x |
| R-176 | Architecture rule | Claim (continuing) | Layers, forbidden dependencies and cycles as pinned checks with fix hints, counted as health indicators | V-P9 | 0.1.x |
| R-143 | Area readiness | Claim (continuing, area) | The environment reproduces, pinned checks exist and are fast and stable, an owner is known, the protected paths are in place and health is holding; each lane names the readiness it needs; a declining area loses express and quick lanes; intake records a disposition (admitted, linked, deferred, rejected, already resolved) | V-P5, V-V7 | 0.1.x |
| R-154 | Outcome | Claim (outcome class) | Statuses `recovered`, `partial`, `no-change`, `insufficient-exposure`, `unknown`, scoped to a region or cohort; evidence available at decision time is kept apart from later evidence | V-V5 | 0.1.0 (vocabulary); M2 |

## Evidence

| ID | Entry | Primitive | Rule | Serves | Release |
|---|---|---|---|---|---|
| R-174 | Methods and strengths | Evidence vocabulary | Methods: static, health-ratchet, unit, integration, contract, e2e, property, fuzz, mutation, differential, simulation, model-check, proof, benchmark, holdout, visual-runtime, review, production-observation. Strengths, never merged: generated trials, bounded model checking (timeout is unknown), machine-checked theorem; correspondence to the implementation is sampled or proved. Packs set, per lane, which methods satisfy each claim class (M2) | V-V4, V-P12 | 0.1.0; M2 |
| R-172 | Distinguishing evidence | Evidence | The baseline run must fail with the expected failure; a harness failure is inconclusive | V-P2 | 0.1.0 |
| R-173 | Baseline-relative measurement | Evidence | `baseline_value`, `rule` (gte, lte, no-regression, max-delta, relative-pct), `scope` and optional `confidence`; benchmarks report samples, never a single run | V-P9, V-M5 | 0.1.0 |
| R-150 | Dimensions and fix hints | Evidence | Checks declare their dimension; reports may carry `rule_id`, `path` and a fix hint for the `fix` loop | V-P2 | 0.1.x |
| R-151 | Mutation evidence | Evidence | Eligible, generated, executed, killed, survived, invalid, equivalent, timed-out and excluded counts; `catching_tests` states its unit; lanes may require a threshold on changed lines at M2 | V-P2, V-M5 | 0.1.x; M2 |
| R-179 | Proof evidence | Evidence | Prover and version, theorem hash matching the approved definition, obligations discharged, and an audit: no escape hatches, axioms within the allowlist, no new unsafe code or bypasses | V-P2, V-B7 | schema 0.1.0; M2 |
| R-180 | Simulation and differential evidence | Evidence | Seed, fault profile, steps, properties and replay command; or reference, generator, cases and divergences; seeds replay deterministically | V-P2 | schema 0.1.0; M2 |
| R-130 | Visual and runtime evidence | Evidence | Screenshots, recordings and traces recorded by hash as attestations; a pack may require them for user-facing changes | V-V5, V-P2 | 0.1.x |
| R-152 | Merge-queue evidence | Evidence | Covers the queue candidate, the checks run and the environment; release and observation keep their own verdicts | V-P2 | 0.1.x |
| R-156 | Input provenance | Evidence about inputs | Every assignment input carries source, trust and hash (used by R-105) | V-P11 | 0.1.0 |
| R-163 | Twins | Evidence qualifier | Twins declare version, known differences, last fidelity check and how long it stays valid; simulated evidence names its twin and is marked `stale-twin` and downgraded after expiry | V-P11, V-V5 | M2 |
| R-182 | Selective execution | Evidence | Eligible, selected and skipped tests are recorded; a periodic full run reports what selection missed | V-P2, V-B8 | M2 |
| R-177 | Check lifecycle | Evidence about checks | Each pinned check names an owner (0.1.x); at M2 a known-bad fixture it must keep failing, a noise budget and retirement when cost exceeds benefit | V-P7, V-P2 | 0.1.x; M2 |
| R-148 | Reviewer metrics | Evidence about reviewers | Precision, missed defects, false blockers, abstentions and consistency by class; a second model family confirms material findings where available | V-P2, V-M2 | M2 |
| R-183 | Maintainability audit | Evidence | Audits ask whether a maintainer would merge as is, with three reasons | V-M2, V-M10 | M2 |
| R-126 | Sampled scoring | Evidence | A random sample of runs and changes graded against declared criteria; failures become proposed packets | V-V7, V-M2 | M2 |
| R-127 | Comparison | Evidence | Two to six configurations on the same pinned tasks; hard failures beside averages; population disclosed | V-P9, V-V7 | M2 |

## Decisions

| ID | Entry | Primitive | Rule | Serves | Release |
|---|---|---|---|---|---|
| R-090 | Approval staleness | Decision rule | An `approve` is fresh only while its subject is current | V-P2 | 0.1.0 |
| R-108 | Decision rights and delegation | Decision (`delegate`) | Several decision-makers with roles and keys; delegation with expiry | V-V1 | 0.1.0; 0.1.x |
| R-123 | Channels | Decision proof | Requests on the pull request (0.1.0), chat and trackers (M2); an answer counts at the strength its channel proves | V-V8, V-P12 | 0.1.0; M2 |
| R-145 | Approvals by risk | Policy for decisions | 0, 0, 1, 2 human decisions for express, quick, standard, deep; protected changes `person-present`; projects may only tighten | V-P7, V-B2 | 0.1.x |
| R-141 | Campaign approval | Decision (`approve`) | One decision covers child packets inside the campaign's declared scope; each child is still verified | V-V7, V-B2 | 0.1.x |
| R-153 | Quarantine | Decision (`waive`, expiring) | Waives a flaky check; the claims it covered are re-checked and need substitute evidence, a limited exception or a narrower endpoint; the board shows time uncovered and the restoring owner | V-P2, V-B3 | 0.1.x |
| R-147 | Review queue and class approval | View; Decision (`approve`) | A review queue with age and limits (0.1.x); approving a class of low-risk changes under policy (M2) | V-M6 | 0.1.x; M2 |
| R-121 | Factory changes | Decision (`approve`) | A `factory` packet states its purpose: improvement (needs R-127), mandatory replacement, containment (immediate, reviewed afterwards) or restoration | V-P9, V-B2 | 0.1.x; M2 |
| R-160 | Hotfix and heal | Decision (`waive`) | A signed override, a pinned smoke check and an automatic reconciliation packet due within 48 hours; a `heal` loop for main-line or guardrail failures | V-V5, V-P6 | M2 |

## Work items, subjects and policy

| ID | Entry | Primitive | Rule | Serves | Release |
|---|---|---|---|---|---|
| R-091 | Packet identity | Work item | `packet.yaml` holds only identity; everything else is events | V-P10 | 0.1.0 |
| R-142 | Work types | Policy | Pack-declared work types (feature, defect, debt, spec, migration-target; investigation and incident at M2), each with its loop, evidence, outcome unit and quality floor | V-V7, V-M7 | 0.1.0; M2 |
| R-092 | Express lane | Policy | Granted by the attest job within size, denied paths and per-area daily limits; configuration, data and flag changes with runtime effect are never express by default; ends at `checked` before merge | V-P7, V-P2 | 0.1.x |
| R-140 | Campaign | Work item (with children) | One intent over a target-set snapshot, with counts of automated, manual, unresolved and excluded targets and a stop threshold; waves and automatic halt at M2 | V-V7 | 0.1.x; M2 |
| R-144 | Areas | Policy | Paths mapped to owners, decision rights and work-in-progress limits | V-V1, V-V2 | 0.1.x |
| R-157 | Scoped rules | Policy | Directory-scoped rule files attached to assignments whose paths match | V-P7 | 0.1.x |
| R-149 | Circuit breakers | Policy | Change failure, revert rate or a leading indicator (health fall, duplication or churn spike) past a threshold switches express off and raises lanes until a decision restores them | V-M5, V-P12 | M2 |
| R-161 | Cleanup campaigns | Work item | Prioritized by hotspot, including dead-code and stale-flag pruning, within a capacity share; each declares a preservation claim, a reason, a stop condition and an owner who may decline cosmetic work; sampled later | V-P7, V-P9 | M2 |
| R-129 | Governed knowledge | Work item | Learned conventions are proposed as changes to `AGENTS.md`, skills or knowledge records, never written silently | V-P10, V-P7 | M2 |
| R-181 | Configuration, data and flags | Subject kinds | Same risk and rollout rules as code | V-V5, V-B6 | names 0.1.0; 0.1.x; M2 |
| R-165 | Platform objects | Subject kind | Changes inside platforms (pipelines, ontology or schema objects, dashboards), with branch semantics from the binding | V-P4 | M2 |
| R-167 | Scale tiers | Storage binding | Git event files; git with compaction and the evidence store; an external append-only store under the same schemas | V-B9, V-H5 | definitions 0.1.0; M3–M4 |

## Factory definition and execution

| ID | Entry | Primitive | Rule | Serves | Release |
|---|---|---|---|---|---|
| R-120 | Factory definition | Policy (execution plane) | Workers, triggers, environments, identities, routing, channels, scorers and comparison suites in `factory.yaml`; validated and recorded on every run; executed by engines and platforms | V-V7, V-P9 | 0.1.x; M2 |
| R-125 | Routing | Policy (execution plane) | Work routed to models and harnesses by lane, role or complexity; recorded per run | V-V7, V-M7 | 0.1.x; M3 |
| R-122 | Triggers | Work item source | Forge events, schedules and signed webhooks create intake packets with source and event identity; duplicates are linked | V-V5, V-P11 | M2 |
| R-162 | Tool registry | Policy (execution plane) | Tools with owner, scopes, side-effect class and default-off status, granted by ID and narrowed per assignment | V-P11, V-B2 | M2; M3 |
| R-166 | Context providers | Actor (adapter hook) | Budgeted, provenance-tagged context added to assignments; Tenet never builds it | V-P4 | M3 |
| R-128 | Hand-off | Lease | A local session takes and returns a packet's lease; executors recheck authority and lease generation before consequential effects | V-V8, V-P11 | M3 |
| R-158 | Session links and steering | Events | `session_url`, `preview_url`, `run.steered` and subrun summaries | V-V8, V-P11 | 0.1.x |
| R-131 | Platform mappings | Conformance | Published mappings from Warp Factories and a Symphony-style dispatcher, with a worked conformance claim | V-V4, V-H5 | 0.1.x |

## Views and measurement

| ID | Entry | Primitive | Rule | Serves | Release |
|---|---|---|---|---|---|
| R-159 | Attribution | View | Who selected, authored, reviewed, authorized and released each change, and whether a person edited it; feeds autonomy share | V-M9, V-V4 | 0.1.x |
| R-155 | Funnels and cost per outcome | View | Attempted, built, verified, accepted, shipped and influenced per work type; cost per outcome unit | V-M7, V-M4 | 0.1.x; M2 |
| R-178 | Durability | View | Lines rewritten or reverted within 30 days, by agent definition and work type | V-M10, V-M5 | 0.1.x |
| R-184 | Cost of the next change | View | Similar tasks in the same area compared over time; sampled next-change exercises | V-M10, V-M7 | M2 |
| R-164 | Durable summaries | View | A decision summary survives the expiry of its telemetry; what can no longer be re-checked is shown | V-B3 | M2 |
| R-185 | Evaluator self-verification | Conformance | Property tests of the evaluator over generated event histories (0.1.0); bounded model checking (M2); proofs optional later | V-P9, V-H3 | 0.1.0; M2 |
