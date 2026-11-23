# Tenet vision

> Level L0 · Version 0.6 · Status: **draft, unsigned** · Owner: Ved · Changes only by amendment packet, ratified twice by the Owner · Budget: 4,000 tokens

## Purpose

When software work passes between people, agents and delivery systems, its intent, authority, evidence and outcome can each change on their own. An approval covers one version of a requirement; a check ran on another version of the code; a release shipped a third configuration. Every system involved can report success and the decision can still be wrong. Someone then has to reconstruct whether a claim still holds, what is unknown and who may act next. That reconstruction is slow, and the claims it misses travel into releases. Agents make it worse: they produce work faster than anyone can check it, report work as finished when it is not, and can game the checks that judge them. Drift takes three forms: from intent (what was approved versus what was built), from design (structure that erodes as agents copy what already exists), and from verification (checks that stop meaning what they once did).

Many products now declare and run agent factories, each in its own format and each grading its own gates. There is no shared way to say what a factory is, what it may do, how strongly its claims hold, or whether a change to the factory itself made it better.

Tenet exists so that people and agents can build and run software together with no ambiguity about what was intended, what is proven, what it cost and who decides, in any factory, whoever runs it.

## North star

**For any governed change, an authorized participant can see the intent that applies, reproduce what the evidence supports, see what is uncertain and what it cost, and hand the work on without losing accountability. Any factory, whoever runs it, can be declared and compared through disclosed claims and methods, and can show where delegation helps, where human judgment is required, and whether what it delivers improves the outcomes it exists to serve. Autonomy grows only as evidence earns it.**

## Value

| ID | Who | Gets |
|---|---|---|
| V-V1 | Decision-makers (one Owner or a team with named decision rights) | Spend their time on intent, judgment and exceptions; never *have to* read code to know a change's state, though they always may |
| V-V2 | Anyone authorized: people, agents, dashboards | One computable answer to where every change is, what supports it and who acts next |
| V-V3 | A project | A first verified change within an afternoon of adopting, and compatible improvements to the standard without manual upgrade work |
| V-V4 | An implementer | A small, precise, testable core and conformance proven claim by claim |
| V-V5 | Users and operators of the software | Each obligation that applies to a change (verification, validation, a way back, observation) visibly met, or visibly not yet met |
| V-V6 | Whoever pays | The cost of each change, and where that figure comes from |
| V-V7 | A factory operator (who builds and tunes the factory) | Declares the factory once: its workers, what starts their work, where they run, which models they use, how they reach people, and how runs are scored; sees which areas are ready for which autonomy and what each outcome costs; changes the factory only when measured evidence shows the change is better |
| V-V8 | People working with the factory | Receive questions and decisions where they already work, each showing what it is about and how strongly an answer from there counts |
| V-V9 | Teams making fleet-wide change | Apply one approved intent across many targets with one decision, a visible denominator, and an honest count of what was automated, done by hand or left unresolved |
| V-V10 | Maintainers and future contributors | See which earlier promises still hold, and whether people and agents can make the next intended change safely at a sustainable cost |

## Principles

| ID | Principle |
|---|---|
| V-P1 | **People own intent and decisions; agents own execution.** A decision can involve an intent owner, a policy approver, a delegator, an acting principal, an executor and whoever is accountable for the outcome; one person may hold several of these. Agency grows from the vision toward code. Only the project's decision-makers change its vision. |
| V-P2 | **No claim without evidence from someone other than the claimant.** "Done" is computed from fresh evidence about the exact thing that was checked, never asserted. |
| V-P3 | **No agent judges, approves or edits itself.** Every piece of work is inspected by someone other than its author, and independence is recorded, not assumed. |
| V-P4 | **Tool neutrality.** The standard names no tool, model, host or vendor as a requirement. Any engine that keeps its rules may run it. |
| V-P5 | **Small, visible units of work.** Every change is one bounded unit with one owner at a time, visible to everyone authorized. |
| V-P6 | **Stuck work rises, it does not spin.** Repeated failure stops the work and raises the question to the lowest level that can answer it. |
| V-P7 | **Adopt in steps; the smallest step already pays.** Nothing requires adopting everything. |
| V-P8 | **Least ceremony that keeps the guarantees.** A rule whose cost exceeds the harm it prevents, judged by severity as well as frequency, is removed. |
| V-P9 | **The standard governs itself.** It is built, changed and released under its own rules. |
| V-P10 | **Agents propose; deterministic code applies; the rules come from the target, never from the change.** Agents return structured proposals; only rule-checking code changes state, using the policy of the place the change is going. |
| V-P11 | **Containment beats instruction.** What an agent must not see or do is prevented by where and how it runs, not by asking it nicely. |
| V-P12 | **Every guarantee states its strength.** Each rule is declared advisory, detected or enforced for each way of running it, with the assumptions it depends on, and nothing claims more. |
| V-P13 | **A small core, open edges.** A small core is standard everywhere; lifecycles, agents, skills, loops and views extend it; Tenet is the decision and evidence layer that trackers, orchestrators, factory platforms, hosts and dashboards share, not a replacement for them; a platform conforms by mapping its own factory definition onto the core. |
| V-P14 | **A factory is declared, and changing it is a governed change.** What a factory is, what may start its work, where it runs and who it acts as are written down; a change to any of that is proposed, compared against the current factory on the same tasks, and adopted only on evidence. |
| V-P15 | **Every run acts as someone.** Each run records on whose behalf it acts, with which credentials and in which environment, so accountability never stops at "an agent did it". |
| V-P16 | **Work is admitted, not just received.** A factory takes on work it can verify and that is worth its capacity, at the autonomy its readiness supports; the rest goes back to people. |
| V-P17 | **Kept promises and health only ratchet forward.** No change silently drops an earlier obligation or worsens a declared health indicator; cleanup keeps pace with what the factory generates. |

## Trust assumptions

Tenet's strongest guarantees hold only when three things are true, and Tenet shows whether they are: the job that records evidence runs from a protected source and never runs the change's code; the store that holds evidence can be written only by that job; and the keys that sign people's decisions require a person to be present. A check that runs the change's own code can still be subverted by that code; independent tests, review and hidden scenarios exist for that reason.

## Horizons

| ID | Horizon | Achieved when |
|---|---|---|
| V-H1 | **A verified slice.** One small lifecycle runs end to end with evidence agents cannot forge under the trust assumptions | 3 projects, at least 1 run by someone other than the steward, each close ≥10 verified changes; 0 forgeries accepted in the published red-team cases; decisions reconstructed faster than with the project's previous tools at no loss of correctness; every Owner still using it 30 days later |
| V-H2 | **Enforced end to end.** The full lifecycle, from discovery through operation, runs with enforced gates on at least two different engines or hosts | Over 30 days in 3 projects, ≥95% of all transitions, counted against the code and delivery history, pass enforced gates, with 0 bypasses found in an audit of ≥100 changes |
| V-H3 | **Self-updating and interoperable.** Projects receive compatible releases automatically, and independent implementations agree on decisions | ≥90% of compatible upgrades merge with no human edits across ≥3 projects for 3 consecutive releases; 2 independently written implementations reach the same decision on every core fixture |
| V-H4 | **Managed, self-improving workforce.** Agents and the factory definition itself are qualified, compared, released gradually, measured and retired on evidence | In 2 projects every agent or factory-definition change passes comparison on the same tasks and staged release; human decisions per verified change fall ≥30% from the V-H2 baseline and autonomy share rises, without a rise in escaped defects |
| V-H5 | **Ecosystem.** Independent implementations and projects build on the standard | ≥2 implementations, including at least 1 factory platform not built by the steward, pass the conformance kit at the same level, and ≥5 projects subscribe |

## Outcome metrics

Computed from records and delivery history, never self-reports. Every figure carries its sample size; a zero, the upper bound it supports. Diagnostics live in the technical specification.

| ID | Metric | Definition | Baseline | Target (horizon) |
|---|---|---|---|---|
| V-M1 | Time to a correct decision | Minutes for an unfamiliar maintainer to answer, correctly, what was authorized, what was checked, whether an action may proceed and who can resolve what is unknown, for real changes | Same exercise with the project's previous tools | Faster at equal correctness (V-H1); median ≤5 minutes at ≥95% correct (V-H3) |
| V-M2 | Unverified acceptance | Changes accepted whose required evidence was missing, stale, self-produced or forged: in the red-team cases, and in a random audit of real changes | — | 0 in red-team cases (V-H1); ≤2% audited, with ≥149 audits behind the bound (V-H2) |
| V-M3 | Lead time | Median and 85th-percentile hours from arrival to verification, by lane | Before adoption, best-effort from history | Recorded (V-H1); −25% (V-H4) |
| V-M4 | Throughput | Verified changes per week, by lane and type, with the size distribution | Before adoption, best-effort | Not lower than baseline (V-H2) |
| V-M5 | Escapes and change failure | Severity-weighted defects found after verification per 100 verified changes; share reverted, rolled back or reworked within 30 days | Set at V-H1 | 0 critical escapes; failure not above baseline (V-H2) |
| V-M6 | Human decisions and decision wait | Human decisions per verified change; median hours a change waits for one | Set at V-H1 | Wait ≤1 working day (V-H2); decisions −30% (V-H4) |
| V-M7 | Cost per outcome | Model and compute cost per outcome unit of each kind of work (a verified change, a migrated target, a recovered incident), including rejected attempts, labelled measured, estimated, included in a seat, or unknown | Set at V-H1 | Recorded with its source (V-H1); falling (V-H4) |
| V-M8 | Adoption | Projects, implementations and factory platforms subscribed or conforming | 0 | 3 projects (V-H1); ≥5 projects and 2 implementations (V-H5) |
| V-M9 | Autonomy share | Share of verified changes that no person edited beyond the decisions reserved to people, using the standard attribution of who selected, authored, reviewed, authorized and released each change, by lane; always shown beside V-M5 | Set at V-H1 | Recorded (V-H1); rising without a rise in V-M5 (V-H4) |
| V-M10 | Kept promises and changeability | Share of continuing obligations with current evidence, and share of areas whose declared health indicators held or improved, per 30 days | Set at V-H1 | Recorded (V-H1); rising, with no area declining for 30 days (V-H2) |

## Boundaries

| ID | Tenet never |
|---|---|
| V-B1 | Requires a particular model, host, editor, cloud or vendor |
| V-B2 | Lets an agent change the vision, approve its own work, or widen its own permissions |
| V-B3 | Hides a change, a failure, a cost or a pending decision from the people it concerns |
| V-B4 | Calls a model from its own enforcement tooling; enforcement stays deterministic |
| V-B5 | Sends a project's code, records or metrics anywhere without explicit consent |
| V-B6 | Breaks a subscribing project silently; incompatible changes wait for a decision-maker |
| V-B7 | Treats a model's statement about its own work as evidence |
| V-B8 | Claims a guarantee stronger than the way it is run can enforce |
| V-B9 | Requires a particular store for its records; any store that keeps the same contracts will do |

## Governance of this vision and of the standard

This vision governs the Tenet project, decided by its Owner. The standard Tenet publishes moves to an open proposal process, with more than one steward, before version 1.0.

## Completeness checklist

- [x] Every value maps to a metric (V-V1→V-M1, V-M6; V-V2→V-M1, V-M2, V-M3; V-V3→V-M8 and the V-H3 upgrade criterion; V-V4→V-M8 and the V-H3 agreement criterion; V-V5→V-M5; V-V6→V-M4, V-M7; V-V7→V-M9, V-M7 and the V-H4 comparison criterion; V-V8→V-M6; V-V9→V-M4, V-M7; V-V10→V-M10)
- [x] Every metric has a definition, a baseline source and a target
- [x] Every horizon has a numeric "achieved when" criterion
- [x] No sentence names a tool, file, command or vendor
- [ ] The Owner has signed version 1

## Amendment log

| Version | Date | Packet | Change | Ratified |
|---|---|---|---|---|
| 0.1 | 2026-11-22 | — | Initial draft | Not yet |
| 0.2 | 2026-11-22 | CP-0001 | Reviews round 1 (L-0007) | Not yet |
| 0.3 | 2026-11-22 | CP-0001 | Reviews round 2 (L-0008) | Not yet |
| 0.4 | 2026-11-22 | CP-0001 | Factory platforms (L-0009) | Not yet |
| 0.5 | 2026-11-22 | CP-0001 | Leading organizations (L-0010) | Not yet |
| 0.6 | 2026-11-22 | CP-0001 | Code health and verification (L-0011) | Not yet |
