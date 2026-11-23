---
id: L-0016
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Practicality round applied: one adoption level, intent and proof first, no bookkeeping for people"
---
# L-0016 · Practicality round applied: one adoption level, intent and proof first, no bookkeeping for people

## Context

Three reviews of v0.8 (one by the steward's agent, two by others) agreed the architecture was ready but the defaults punished honest users: about a dozen concepts and sixty files before a first change, security keys for routine edits, gates that blocked by default, commit trailers, packet folders and separate spec pull requests for small changes, and digests typed into comments. They proposed several ladders (profiles, adoption levels, authority modes, spec depths, an enforcement dial). The reviews also found three contradictions (one introduced by the previous edit), that stored OIDC tokens cannot be re-verified once the forge rotates its keys, that public signing logs reveal private repository names, and that running a brand-new feature's test on the base fails to compile.

## Decision or event

The Owner approved the synthesis:

1. **One adoption setting** (DEC-40, R-214): `level` is `observe` (default; nothing blocks; self-acceptance labelled), `protect`, `verify` or `assure`. Every rule runs in `observe`, `advise` or `enforce` (R-215); the board shows what would have blocked. Person-present decisions and twice-ratified visions belong to `assure` (0.1.x; this project keeps its own vision at `assure`).
2. **Intent and proof first** (DEC-41): alpha.0 ships the starter ladder, existing documents imported by reference, `tenet context` with skills and a local MCP server, `check`, `fix` and `split`, and an advisory proof card on every pull request (R-218). Signing arrives with `verify`. The kit is loaded from the pinned package, vendored only on request.
3. **No bookkeeping for people** (DEC-42, R-219): no commit trailers; quick changes need no packet folder; spec deltas ride with code; native review approvals and `/tenet pick` replies bound to the head commit; plain-words errors; hooks warn and CI enforces; budgets warn and `tenet split` proposes the rollover.
4. **Living specifications** (R-220), a friction budget (R-216, V-M11, V-B10), safe failure states (R-217), protected surfaces in three tiers (R-103), distinguishing evidence scoped by change kind (R-172), an `explore` work type, lanes renamed quick, careful and deep, one agent card (R-206) with core and reviewer roles, a shared phase vocabulary, a default board view and an HTML viewer in 0.1.0.
5. **Signing** is chosen by spike B among a public signing service (public repositories, or where the forge offers private attestations), a key only the protected workflow can read, and OIDC verified when recorded.
6. Plan: alpha.0 intent and proof, alpha.1 protect, alpha verify, 0.1.0; new packets CP-0045 (agent context), CP-0046 (signed evidence), CP-0047 (assure level); the 0.1.x packets moved to `specs/plan/0.1.x.md`, and PRD §4.3 to `prd/tooling.md`, under the rollover rule.

Rejected: a separate friction event type, a rule-recommendation engine, coverage of changed lines as a default method, and a non-Git binding or further lifecycle packs before M2.

## Evidence

Reviews and synthesis of 2026-11-23; GitHub documentation on artifact attestations (private repositories need Enterprise Cloud; public repositories write to a public log); general guidance on signing-key rotation.

## Consequences

Vision v0.9; PRD, catalog and tooling v0.9; tech spec v0.8; UX spec v0.8; plan v0.9 with its 0.1.x part. Every guarantee from earlier rounds remains, at `verify` or `assure`.
