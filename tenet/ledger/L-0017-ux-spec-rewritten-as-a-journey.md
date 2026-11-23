---
id: L-0017
kind: decision
date: 2026-11-23
packet: CP-0001
title: "The UX specification is rewritten as a step-by-step journey, with a 0.1.0 upgrade path"
---
# L-0017 · The UX specification is rewritten as a step-by-step journey, with a 0.1.0 upgrade path

## Context

Reading the UX specification to understand the end user's experience, the Owner found it unclear and too complex: it was organized as reference fragments (output conventions, `init`, the board, decisions) rather than as what a person experiences. It said nothing about installing Tenet as a step, and nothing about updating it before M4: `tenet upgrade` was scheduled only for M4, which left early adopters without an update path.

## Decision or event

1. The UX specification (v0.9) is organized as a journey: an at-a-glance table of thirteen steps, then each step in order (install, set up, write intent, make a change, review and merge, see where things are, change a specification, turn on rules, careful work, stuck work, verified work, update, remove), each with what the person does and sees and when it arrives. The agent's side and the reference (principles, output, the full board, wording) follow.
2. A minimal **`tenet upgrade`** ships in 0.1.0: update the lock, regenerate the `AGENTS.md` block and skills, report what changed and run `tenet check`; it never changes the level or starts a new rule beyond `observe`. `tenet check` reports a package version that differs from the lock. Migrations and the scheduled upgrade pull request stay at M4 (R-051, R-054; CP-0010 becomes "Init and upgrade").
3. Commands named by the journey are listed in the tech spec: `level`, `rules`, `board --all`, `board --open`, `upgrade`.

## Evidence

The Owner's reading of the UX specification v0.8.

## Consequences

The UX specification is the first document to read for what Tenet is like to use; the PRD and tech spec remain the source of rules and mechanisms.
