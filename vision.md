# Tenet vision

> Level L0 · Version 0.1 · Status: **draft, unsigned** · Owner: Ved · Changes only by amendment packet, ratified twice by the Owner

## Purpose

Software is increasingly built by agents. Agents write code fast, but they drift from intent, overstate what they finished, grade their own work, and fail quietly for days. Owners respond either by reading everything, which does not scale, or by trusting outputs they cannot check.

Tenet exists so that an Owner can hand the building to a fleet of agents and still know, at any moment, what is being built, why, how far it got, and what evidence supports every claim.

## North star

**Any Owner can run a software factory they trust: they state intent and judge outcomes; governed agents do the rest; every change, claim and agent is traceable, evidenced and improving.**

## Value

| ID | Who | Gets |
|---|---|---|
| V-V1 | The Owner | Spends time only on intent, decisions and acceptance; never on reading code to learn what is true |
| V-V2 | The Owner | Sees the whole factory floor in one place: every change, its stage, its evidence and what waits on them |
| V-V3 | A project | Adopts the standard in an afternoon and receives every improvement to it without manual upgrade work |
| V-V4 | An implementer | Builds a product on a precise, testable standard and proves conformance with a shared test kit |
| V-V5 | Users of the software | Receive changes that were specified, verified, validated against scenarios the builders never saw, and released gradually |

## Principles

| ID | Principle |
|---|---|
| V-P1 | **Humans own intent; agents own execution.** Agency grows from vision toward code. The Owner alone changes the vision. |
| V-P2 | **No claim without evidence.** "Done" is computed from fresh evidence tied to the exact thing that was checked, never asserted. |
| V-P3 | **No agent judges, approves or edits itself.** Every piece of work is inspected by someone other than its author. |
| V-P4 | **Tool neutrality.** The standard names no tool, model, host or vendor as a requirement. Any engine that keeps its rules may run it. |
| V-P5 | **Small, visible units of work.** Every change is one bounded unit with one owner at a time, visible on one floor. |
| V-P6 | **Stuck work rises, it does not spin.** Repeated failure stops the work and raises the question to the lowest level that can answer it. |
| V-P7 | **Adopt in steps.** Each step of adoption is useful on its own; nothing requires adopting everything. |
| V-P8 | **Least ceremony that keeps the guarantees.** A rule that costs more Owner time than the failure it prevents is removed. |
| V-P9 | **The standard governs itself.** It is built, changed and released under its own rules. |

## Horizons

| ID | Horizon | Achieved when |
|---|---|---|
| V-H1 | **Usable by hand.** The standard and its kit can be followed by one Owner and general-purpose agents with no special tooling | 2 projects run ≥10 changes each end to end under the standard, and both Owners rate it worth continuing |
| V-H2 | **Enforced.** Gates, evidence, traceability and agent permissions are checked by a deterministic tool, and loops run on a deterministic orchestrator | ≥95% of state transitions in 2 projects pass through enforced gates over 30 days, with 0 false "done" claims found by audit |
| V-H3 | **Self-updating.** Subscribing projects receive every compatible release automatically | Median Owner time per compatible upgrade ≤5 minutes across ≥3 projects for 3 consecutive releases |
| V-H4 | **Managed workforce.** Agents are qualified, released gradually, measured and retired on evidence; process changes are tested as experiments | In 2 projects, every agent change passes qualification and staged release, and Owner minutes per accepted outcome fall ≥30% from the V-H2 baseline |
| V-H5 | **Ecosystem.** Independent implementations and projects build on the standard | ≥2 implementations pass the conformance kit at the same level, and ≥5 projects subscribe |

## Outcome metrics

| ID | Metric | Definition | Measured by | Baseline | Target (horizon) |
|---|---|---|---|---|---|
| V-M1 | Owner minutes per accepted outcome | Owner time logged on a change divided by changes accepted, per 30 days | Packet records | Set at V-H1 | −30% from V-H2 baseline (V-H4) |
| V-M2 | False-claim rate | Closed changes whose recorded result is contradicted by a later audit or rerun | Audit sample of 10% of closed changes | Unknown | 0 (V-H2 onward) |
| V-M3 | Escaped defects | Defects found after release that a stated scenario or check should have caught, per 10 releases | Defect packets tagged "escaped" | Set at V-H2 | ≤1 (V-H4) |
| V-M4 | Lead time | Median time from a change's arrival to its close, by lane | Packet history | Set at V-H1 | Recorded and stable (V-H2); −25% (V-H4) |
| V-M5 | Upgrade toil | Median Owner minutes per compatible standard upgrade | Upgrade change records | Set at V-H3 start | ≤5 (V-H3) |
| V-M6 | Conformance coverage | Share of normative rules with an automated conformance test | The conformance kit | 0 | ≥60% (V-H2); ≥90% (V-H5) |
| V-M7 | Agent violations | Agent actions outside the permissions of their definition | Run records | Unknown | 0 (V-H2 onward) |
| V-M8 | Adoption | Projects and implementations subscribed or conforming | Conformance declarations | 0 | 2 (V-H1); ≥5 projects and 2 implementations (V-H5) |
| V-M9 | Stuck-work recovery | Share of stopped changes resolved within 2 days of escalation | Escalation records | Set at V-H2 | ≥80% (V-H4) |

## Boundaries

| ID | Tenet never |
|---|---|
| V-B1 | Requires a particular model, host, editor, cloud or vendor |
| V-B2 | Lets an agent change the vision, approve its own work, or widen its own permissions |
| V-B3 | Hides a change, a failure or a pending decision from the Owner |
| V-B4 | Calls a model from its own enforcement tooling; enforcement stays deterministic |
| V-B5 | Sends a project's code, records or metrics anywhere without the Owner's explicit consent |
| V-B6 | Breaks a subscribing project silently; incompatible changes wait for the Owner |

## Completeness checklist

- [x] Every value maps to a metric (V-V1→V-M1; V-V2→V-M4, V-M9; V-V3→V-M5, V-M8; V-V4→V-M6, V-M8; V-V5→V-M2, V-M3)
- [x] Every metric has a definition, measurement method, baseline source and target
- [x] Every horizon has a numeric "achieved when" criterion
- [x] No sentence names a tool, file, command or vendor
- [ ] The Owner has signed version 1

## Amendment log

| Version | Date | Packet | Change | Ratified |
|---|---|---|---|---|
| 0.1 | 2026-11-22 | — | Initial draft | Not yet |
