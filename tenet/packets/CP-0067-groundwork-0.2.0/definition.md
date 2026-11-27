---
packet: CP-0067
version: 1
---
# CP-0067 · 0.2.0 groundwork

> Started at the Owner's request on 2026-11-26. Published version 0.2.0 is the plan's milestone **0.1.0-alpha.1 (protect)** ([L-0040](../../ledger/L-0040-launch-decisions.md)). The build contracts are in [plan/alpha.1.md](../../specs/plan/alpha.1.md).

## Why

The alpha.1 contracts were frozen on 2026-11-23, before 0.1.0 and 0.1.1 shipped. Since then the code, the contracts and the independent cases have moved. Before any builder takes CP-0049, the Owner needs to know that each contract can be built from its text alone against today's code, that the independent cases still match, and that the specifications agents read have room to grow.

This packet produces **reports and proposals only**. It builds no alpha.1 code. CP-0049 stays blocked by CP-0057 as `packet.yaml` says.

## Work

| Track | Report in this folder | Scope |
|---|---|---|
| 1 | `readiness-cp-0049-cp-0007.md` | Build-contract readiness: CP-0049 kernel schemas, CP-0007 events and reduction |
| 3 | `readiness-cp-0050-cp-0019-cp-0008.md` | Build-contract readiness: CP-0050 gate, CP-0019 decisions, CP-0008 full board |
| 2 | `independent-cases-alpha.1.md` | The independent cases for alpha.1 (`kernel-schemas`, `events`, `gate`, `decisions`, `full-board`, `evaluator-trial`) checked against the current contracts, plus a runbook for the evaluator trial (plan §4) |
| 4 | `budget-trim.md` and a proposal pull request | `tenet/specs/tech-spec/onboarding.md` and `tenet/specs/ux-spec.md` brought under 80% of budget without changing meaning |

## Acceptance

- **AC-1:** each readiness report covers every one of the eight build-contract fields (plan §4) for each of its packets, with a verdict, the evidence as file and line, and proposed replacement text for each gap.
- **AC-2:** every decision only the Owner can make is listed once, with options and a recommendation, never chosen by the track.
- **AC-3:** no file outside this folder changes, except track 4's two specification files, and those changes are marked as a proposal for the Owner.
- **AC-4:** `npm run lint`, `npm test` and `tenet check` pass on each pull request, on Linux, Windows and macOS.

## Out of scope

Building or changing anything in `src/`, `kit/` or `test/`; editing other people's independent cases; changing `kit/TENET.md`, `tenet/vision.md`, the ledger or `tenet.yaml`.
