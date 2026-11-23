---
id: L-0028
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Working practices ship with Tenet"
---
# L-0028 · Working practices ship with Tenet

## Context

The Owner keeps working rules and a slim feature-development process in each project's `copilot-instructions.md`, and asked whether Tenet can carry the same practices. Those files mix three kinds of content:
- how agents should work: think first, keep changes small and surgical, verify against a goal, plain words
- what the project must always be: import boundaries, a single write path, read-only integrations, rendering limits
- how a feature moves: specification, approval, failing tests first, validation, acceptance by a person, finalize

Tenet's careful lane already matches the feature process closely. Two pieces had no home: the working rules themselves, and the parts of the process that could be checked (staying in scope, changed-line coverage, acceptance by a person, the changelog, no secrets committed).

## Decision or event

The Owner approved all three layers (DEC-56, R-225):
1. **Default working rules in the `AGENTS.md` block** (`kit/practices/default.md`, owned by CP-0012, installed by CP-0010). A project can replace them with its own file or turn them off (`agents.working_rules`). They are advisory: they depend on the agent following them.
2. **Onboarding imports existing instruction files** (`copilot-instructions.md`, `CLAUDE.md`, `GEMINI.md`, editor rules) as sources of kind `instructions` (CP-0048).
   - The drafter turns project rules into cited `scope: global` requirements, and working rules into a "Working rules" design section; the Owner blesses them.
   - `init` adds a pointer block to `.github/copilot-instructions.md` where that file exists.
3. **Practices that can be checked, as catalog ideas:**
   - R-226 scope drift
   - R-227 changed-line coverage
   - R-228 acceptance by a person (UAT), with attached artifacts
   - R-229 changelog updated
   - R-230 no secrets or ignored files committed

   The scope freeze allows nothing more until build; they are scheduled after 0.1.0.

## Evidence

The Owner's two instruction files and the mapping of their lifecycle onto the careful lane, in the session of 2026-11-23.

## Consequences

- **Unchanged:** the vision.
- **Updated:** the PRD (R-225, DEC-56), the catalog (five ideas), the tech spec (`agents` field, the instruction-file kind, the Copilot host row, working rules in the block), onboarding, the UX spec and README wording, and the CP-0012, CP-0048 and CP-0010 contracts.
