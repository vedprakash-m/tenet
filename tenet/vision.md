# Tenet vision

> Level L0 · Version 0.11 · Status: **draft, unsigned** · Owner: Ved · Changes only by amendment packet, ratified twice by the Owner · Budget: 4,000 tokens

## Purpose

When software work passes between people, agents and delivery systems, its intent, authority, evidence and outcome can each change on their own. An approval covers one version of a requirement; a check ran on another version of the code; a release shipped a third configuration. Every system involved can report success and the decision can still be wrong. Someone then has to reconstruct whether a claim still holds, what is unknown and who may act next. That reconstruction is slow, and the claims it misses travel into releases. Agents make it worse: they produce work faster than anyone can check it, report work as finished when it is not, and can game the checks that judge them. Drift takes three forms: from intent (what was approved versus what was built), from design (structure that erodes as agents copy what already exists), and from verification (checks that stop meaning what they once did).

Many products now declare and run agent factories, each in its own format and each grading its own gates. There is no shared way to say what a factory is, what it may do, how strongly its claims hold, or whether a change to the factory itself made it better.

**Agents build what you meant, and you can see that they did.** Tenet exists so that people and agents can build and run software together with every consequential ambiguity about what was intended, what is proven, what it cost and who decides made visible, bounded and assigned to someone who can resolve it, in any factory, whoever runs it. It does this through specifications: intent written at levels from the vision down to each change, owned by people, worked from by agents, traced by every change, changed only through governed change, and the basis against which "done" is proven. Drafts become truth only when a person blesses them.

## North star

**For any governed change, an authorized participant can see the intent that applies, reproduce what the evidence supports, see what is uncertain and what it cost, and hand the work on without losing accountability. Any factory, whoever runs it, can be declared and compared through disclosed claims and methods, and can show where delegation helps, where human judgment is required, and whether what it delivers improves the outcomes it exists to serve. Autonomy grows only as evidence earns it, and is withdrawn when evidence, environment or verifier trust degrades.**

## Value

| ID | Who | Gets |
|---|---|---|
| V-V1 | Decision-makers (one Owner or a team with named decision rights) | Spend their time on intent, judgment and exceptions; never *have to* read code to know a change's state |
| V-V2 | Anyone authorized: people, agents, dashboards | One computable answer to where every change is, what supports it and who acts next |
| V-V3 | A project | A first useful finding within ten minutes; drafted specifications, grounded in its own code and docs, blessed the same day for a small project; nothing blocked until it chooses; compatible upgrades without manual work |
| V-V4 | An implementer | A small, precise, testable core and conformance proven claim by claim |
| V-V5 | Users and operators of the software | Each obligation that applies to a change (verification, validation, a way back, observation) visibly met, or visibly not yet met |
| V-V6 | Whoever pays | The cost of each change and its source |
| V-V7 | A factory operator (who builds and tunes the factory) | Declares the factory once; sees which areas are ready for which autonomy and what each outcome costs; applies one intent across many targets with an honest count of what was automated, manual or unresolved; changes the factory only on evidence |
| V-V8 | People working with the factory | Receive questions and decisions where they already work, each showing what it covers and how strongly an answer counts |
| V-V10 | Maintainers and future contributors | See which earlier promises still hold, and whether the next intended change stays safe and affordable |

## Principles

| ID | Principle |
|---|---|
| V-P1 | **People own intent and decisions; agents do bounded work; authorized executors apply its effects.** Intent owner, approver, delegator, acting principal, executor and outcome owner may be different people or one. Only the project's decision-makers change its vision. |
| V-P18 | **Specifications are the source of truth; code follows them.** Intent lives in levelled documents with named owners; work starts from and traces to them; when work and a specification disagree, the conflict rises to the level that owns it, never settled silently in code. |
| V-P2 | **No claim without independent evidence.** "Done" is computed from fresh evidence about the exact thing checked, produced by someone other than the claimant; no agent judges, approves or edits itself, and independence is recorded, not assumed. |
| V-P4 | **A small neutral core, open edges.** The core names no tool, model, host or vendor and is the decision and evidence layer that trackers, orchestrators, factory platforms and dashboards share; lifecycles, agents, checks and views extend it. |
| V-P5 | **Small, admitted units of work.** Every change is one bounded unit with one owner at a time, visible to everyone authorized; a factory takes on work it can verify at the autonomy its readiness supports, and gives the rest back to people. |
| V-P6 | **Stuck work rises, it does not spin.** Repeated failure stops the work and raises the question to the lowest level that can answer it. |
| V-P7 | **Adopt in steps; least ceremony that keeps the guarantees.** The smallest step already pays; new rules observe, then advise, and block only when the project turns them on; the tool does the bookkeeping, never people; a rule whose cost exceeds the harm it prevents, judged by severity as well as frequency, is removed. |
| V-P9 | **Everything that changes is governed the same way, and promises only ratchet forward.** The software, its promises, its health, the factory and this standard change through the same rules; no change silently drops an obligation or worsens declared health. |
| V-P10 | **Agents propose; deterministic code applies; rules come from the target.** Only rule-checking code changes state, using the policy of the place a change is going. |
| V-P11 | **Containment beats instruction, and every run acts as someone.** What an agent must not see or do is prevented by where and how it runs; each run records on whose behalf it acts. |
| V-P12 | **Every guarantee states its strength.** Each rule is declared advisory, detected or enforced for each way of running it, with the assumptions it depends on, and nothing claims more. |

Retired IDs (merged, never reused): V-P3 → V-P2, V-P8 → V-P7, V-P13 → V-P4, V-P14 → V-P9, V-P15 → V-P11, V-P16 → V-P5, V-P17 → V-P9, V-V9 → V-V7.

## Trust assumptions

Tenet's strongest guarantees hold only when four things are true: the job that records evidence runs from a protected source and never runs the change's code; evidence carries proof that this job produced it; decisions reserved to people need proof an agent cannot produce (an authenticated forge session or a key that requires a person to be present); and agents never hold the credentials of those who decide. Tenet observes the first three; the fourth is declared. A check that runs the change's own code can still be subverted by that code; independent tests, review and hidden scenarios exist for that reason.

## Horizons

| ID | Horizon | Achieved when |
|---|---|---|
| V-H1 | **A verified slice.** One small lifecycle runs end to end with evidence agents cannot forge under the trust assumptions | 3 projects, at least 1 run by someone other than the steward, each close ≥10 verified changes; 0 forgeries accepted in the published red-team cases; decisions reconstructed faster than before at equal correctness; every Owner still using it 30 days later |
| V-H2 | **Enforced end to end.** The full lifecycle, from discovery through operation, runs with enforced gates on at least two different engines or hosts | Over 30 days in 3 projects, ≥95% of transitions pass enforced gates, with 0 bypasses in an audit of ≥100 changes |
| V-H3 | **Self-updating and interoperable.** Compatible releases arrive automatically; independent implementations agree | ≥90% of compatible upgrades merge with no human edits across ≥3 projects for 3 consecutive releases; 2 independently written implementations reach the same decision on every core fixture |
| V-H4 | **Managed, self-improving workforce.** Agents and the factory definition itself are qualified, compared, released gradually, measured and retired on evidence | In 2 projects every agent or factory-definition change passes comparison on the same tasks and staged release; human decisions per verified change fall ≥30% from the V-H2 baseline and autonomy share rises, without a rise in escaped defects |
| V-H5 | **Ecosystem.** Independent implementations and projects build on the standard | ≥2 implementations, including at least 1 factory platform not built by the steward, pass the conformance kit at the same level, and ≥5 projects subscribe |

## Outcome metrics

From records and delivery history, never self-reports, each with its sample size; a zero carries its upper bound. Diagnostics live in the technical specification.

| ID | Metric | Definition | Baseline | Target (horizon) |
|---|---|---|---|---|
| V-M1 | Time to a correct decision | Minutes for an unfamiliar maintainer to answer, correctly, what was authorized, what was checked, whether an action may proceed and who can resolve what is unknown, for real changes | Same exercise with the project's previous tools | Faster at equal correctness (V-H1); median ≤5 minutes at ≥95% correct (V-H3) |
| V-M2 | Unverified acceptance | Changes accepted whose required evidence was missing, stale, self-produced or forged: in the red-team cases, and in a random audit of real changes | — | 0 in red-team cases (V-H1); ≤2% audited, with ≥149 audits behind the bound (V-H2) |
| V-M3 | Lead time | Median and 85th-percentile hours from arrival to verification, by lane | Before adoption, best-effort from history | Recorded (V-H1); −25% (V-H4) |
| V-M4 | Throughput | Verified changes per week, by lane and type, with the size distribution | Before adoption, best-effort | Not lower than baseline (V-H2) |
| V-M5 | Escapes and change failure | Severity-weighted defects found after verification per 100 verified changes; share reverted, rolled back or reworked within 30 days | Set at V-H1 | 0 critical escapes; failure not above baseline (V-H2) |
| V-M6 | Human decisions and decision wait | Human decisions per verified change; median hours a change waits for one | Set at V-H1 | Wait ≤1 working day (V-H2); decisions −30% (V-H4) |
| V-M7 | Cost per outcome | Model and compute cost per outcome unit (a verified change, a migrated target, a recovered incident), including rejected attempts, with its source | Set at V-H1 | Recorded with its source (V-H1); falling (V-H4) |
| V-M8 | Adoption | Projects, implementations and factory platforms subscribed or conforming | 0 | 3 projects (V-H1); ≥5 projects and 2 implementations (V-H5) |
| V-M9 | Autonomy share | Share of verified changes no person edited beyond the decisions reserved to people, by lane, from the standard attribution; always shown beside V-M5 | Set at V-H1 | Recorded (V-H1); rising without a rise in V-M5 (V-H4) |
| V-M10 | Kept promises and changeability | Share of continuing obligations with current evidence, and share of areas whose declared health indicators held or improved, per 30 days | Set at V-H1 | Recorded (V-H1); rising, with no unwaived area decline lasting 30 days; promises and health reported separately, never as one score (V-H2) |
| V-M11 | Cost of using Tenet | Human minutes per change spent on Tenet's own records and decisions; Tenet-specific manual steps per quick change; refusals later waived or found wrong per 100 changes | Set at the first alpha | ≤2 minutes and 0 manual steps per quick change; under 2 false refusals per 100 changes (V-H1) |
| V-M12 | Faithful onboarding | Drafted statements kept without substantive edits; known obligations captured (recall against an answer key); invented commitments; Owner minutes to bless (tech spec ALG-13) | Set at the first alpha | ≥90% kept and recalled, 0 invented, a small project blessed in ≤30 min (V-H1) |

## Boundaries

| ID | Tenet never |
|---|---|
| V-B1 | Requires a particular model, host, editor, cloud or vendor |
| V-B2 | Lets an agent change the vision, approve its own work, or widen its own permissions |
| V-B3 | Hides a change, a failure, a cost or a pending decision from the people it concerns |
| V-B4 | Calls a model from its own enforcement tooling; enforcement stays deterministic |
| V-B5 | Sends a project's code, records or metrics anywhere without explicit consent |
| V-B6 | Breaks a subscribing project silently; incompatible changes wait for a decision |
| V-B7 | Treats a model's statement about its own work as evidence |
| V-B8 | Claims a guarantee stronger than the way it is run can enforce |
| V-B9 | Requires a particular store for its records |
| V-B10 | Costs a person more attention than it saves them; a rule that does is weakened or removed |

## Governance of this vision and of the standard

This vision governs the Tenet project, decided by its Owner. The standard Tenet publishes moves to an open proposal process, with more than one steward, before version 1.0.

## Completeness checklist

- [x] Every value maps to a metric (V-V1→M1, M6; V-V2→M1–M3; V-V3→M8, M11, M12, H3; V-V4→M8, H3; V-V5→M5; V-V6→M4, M7; V-V7→M9, M7, M4, H4; V-V8→M6; V-V10→M10)
- [x] Every metric has a definition, a baseline source and a target
- [x] Every horizon has a numeric "achieved when" criterion
- [x] No sentence names a tool, file, command or vendor
- [ ] The Owner has signed version 1

## Amendment log

| Version | Date | Packet | Change | Ratified |
|---|---|---|---|---|
| 0.1–0.6 | 2026-11-22 | CP-0001 | Initial draft and review rounds 1–6 (L-0007 to L-0011) | Not yet |
| 0.7–0.11 | 2026-11-23 | CP-0001 | L-0012, L-0014, L-0016, L-0022, L-0023 | Not yet |
