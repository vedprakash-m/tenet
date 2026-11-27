---
id: L-0043
kind: decision
date: 2026-11-26
packet: CP-0067
title: "Owner decisions for 0.2.0: all 14 recommendations accepted"
---
# L-0043 · Owner decisions for 0.2.0

## Context

Three tracks checked the 0.2.0 build contracts (the plan's alpha.1) and their independent cases against today's code ([CP-0067](../packets/CP-0067-groundwork-0.2.0/definition.md)). None of the five contracts can go to a builder yet: they raised 13 questions that only the Owner can answer. CP-0068 added two more. The coordinator merged overlapping questions into 14, each with a recommendation ([owner-decisions.md](../packets/CP-0067-groundwork-0.2.0/owner-decisions.md)).

## Decision or event

The Owner accepted every recommendation on 2026-11-26:

| ID | Decision |
|---|---|
| OD-1 | Legacy packets migrate with a compatibility snapshot next to the migrated events. No events are made up. |
| OD-2 | The default loop step cap is 20, so `agents.md` changes to match the contract. |
| OD-3 | The old alpha.1 fixtures are refreshed to the 0.1.x record formats before any build or the evaluator trial, by the independent writer. |
| OD-4 | `finding.json` stays strict. Case `kernel-schemas/n06` drops `pointer`, and the pointer goes in the `TN-SCHEMA` message. |
| OD-5 | An event whose parent is missing gives a warning (`TN-EV-ORPHAN`), and it and every later event are held until the parent arrives. |
| OD-6 | A `git-tree` subject is identified by ALG-01's filtered SHA-256. TS §3's wording changes to match. |
| OD-7 | `reduce()` follows cause only. `tenet move` and the gate check legal moves. A `resolve` event becomes the conflict's head. |
| OD-8 | One trigger table in CI §3 covers forge events. A forge event moves work only to a destination the pack defines as legal, and otherwise is recorded as an observation. Only a creation event starts a work item. |
| OD-9 | `blocking.rule` is `"always-enforce"` for ALG-07 rows 1 to 4. |
| OD-10 | CP-0008 extends `board.json` and contracts §5, only adding fields. `schema_version` stays 1. |
| OD-11 | Flow uses a rolling 30-day window, and every metric carries its sample size. |
| OD-12 | The full board shows recorded campaigns, read-only. |
| OD-13 | The pull request that first adds Tenet isn't flagged for changing protected files that `init`'s manifest lists, when the base has no `tenet.yaml`. |
| OD-14 | Onboarding excludes common archive folders by default and lists them as skipped. |

## Evidence

The Owner's reply of 2026-11-26: "I accept all your recommendations from owner-decisions.md".

## Consequences

- One spec pull request applies the proposed text from the three readiness reports, under these decisions. Each 0.2.0 contract can then be checked again for readiness.
- CP-0068 AC-B1 and AC-D3 are decided. AC-B1's spec text is still a proposal for blessing.
- The evaluator trial runs after the OD-3 fixture refresh.
