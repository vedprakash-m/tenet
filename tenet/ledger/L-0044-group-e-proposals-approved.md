---
id: L-0044
kind: decision
date: 2026-11-28
packet: CP-0068
title: "Owner approves the four group E specification proposals"
---
# L-0044 · Group E specification proposals approved

## Context

CP-0068 group E fixed the round 1 items deferred from 0.1.1 ([definition](../packets/CP-0068-dogfood-fixes-0.2.0/definition.md#e--round-1-items-deferred-for-012-l-0041-now-020)). Four of its changes alter what a command promises, so they went in as proposals. All of them are merged on main at `0eaca5d`, with CI green on three operating systems and their independent scenarios passing (s21, s22, s23).

## Decision or event

The Owner approved all four on 2026-11-28:

| Item | Decision |
|---|---|
| AC-E2 | `remove` shows *Will delete* and *Will keep*, then asks *Continue? [y/N]*. `--yes` skips the question. Without a terminal and without `--yes`, it stops with `TN-REMOVE-NO-TTY` (usage, exit 2). |
| AC-E11 | `check` gives one `TN-SPEC-INFERRED` warning for each file with `origin: inferred` statements, naming their IDs. The docs say a citation check confirms the cited lines exist, not that they support the statement. |
| AC-E4 | The layout is `separate` at 20,000 source lines, 4 owner areas, or 12,000 estimated tokens of project documentation (characters ÷ 4). `onboard` prints the layout and why. |
| AC-E4/E5 | Tenet's own records are not project documentation. The records folder and the specification documents are left out of the documentation count and the `docs` unit (Owner decision of 2026-11-27). A root-level document keeps its own path in the `docs` unit. |

## Evidence

The Owner's reply of 2026-11-28: "Approve all four".

## Consequences

- The proposal marks on AC-E2, AC-E4 and AC-E11 in the definition, and on the matching text in the onboarding and UX specifications, now cite this entry.
- Contracts §4 adds the `archive` skip reason that AC-D3 introduced (a clarification; the code and schema already used it).
- Other CP-0068 text still marked as a proposal (AC-A1 to A5, AC-B1, AC-B2, AC-D2, AC-E1) is unchanged by this decision.
