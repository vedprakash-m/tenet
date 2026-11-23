---
id: L-0034
kind: milestone
date: 2026-11-23
packet: CP-0015
title: "Round 1 of parallel tracks merged; proposals applied"
---
# L-0034 · Round 1 of parallel tracks merged

## Context

Four tracks ran in parallel on separate branches and worktrees, each from a prompt written by the M0 session:
- **Track 1** (`m0/track-1-kernel`): CP-0015, the kernel and every contract
- **Track 2** (`m0/track-2-trial-kit`): the CP-0058 trial, CP-0012 kit content, CP-0052 evaluation fixtures, the examples check
- **Track 3** (`m0/track-3-build`): CP-0003 bootstrap and the first alpha.0 packets, built before CP-0001 at the Owner's direction to keep the build track moving
- **Track 4** (`m0/track-4-docs`): user docs, the red-team catalog and CP-0016's evidence kit

## Decision or event

- All four branches were reviewed by the M0 session and merged into `main` without conflicts.
- Every proposal they raised for files outside their scope was applied:
  - **Track 1:** decisions per L-0032. These include renaming `acceptance-proven` to `acceptance-passed`; ALG-05's structural findings; ALG-07's `blocking` action; merge-queue stages in ci.md §3; the evaluator-trial and backtest wording in the plan. ALG-13 moved to onboarding.md §3 to keep algorithms.md within budget.
  - **Track 2:** the finding shape in TS §10, `practices/` in TS §2, `check:examples` in TS §15, the trial's full list of tested exports, and its scorer log kept in packet evidence.
  - **Track 4:** ci.md §7 now separates provenance from independence, says a forge session or key never shows separation, and requires the binding to show builders can't read an external holdout.
- **Escalation E-0001 (CP-0004)** is resolved by specification: the pack file shape is in TS §6.2 and the agent card shape in agents.md §1, each with a reference file.
- **This repository's `tenet.yaml`** is the approved profile (L-0032) with real `lint` and `test` checks; the old file is archived.
- **Test helper fixes:** temporary repositories turn off `core.autocrlf` and `core.safecrlf`, and cleanup retries on Windows. On this machine, 59 tests pass and 2 are pending (the two schemas above).

## Evidence

Merge commits `4868269`, `7597c3f` and `0226345`; each track's report and its packet's `evidence/` and `escalations/` folders; on `main`: `npm test`, `npm run lint`, `npm run check:examples`, link and schema checks, budget checks.

## Consequences

- M0 checklist items 6–8 hold. Item 5 (CP-0058) needs round 4, then CP-0001 ratification.
- Round 2:
  - finish CP-0004 and build CP-0018
  - an independent review of round 1's builds
  - independent conformance fixtures for CP-0044
  - trial round 4 with a message table
  - the backtest dataset
- CP-0044 and the waves after it wait for round 4.
