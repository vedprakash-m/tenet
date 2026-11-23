---
id: L-0025
kind: decision
date: 2026-11-23
packet: CP-0001
title: "The careful lane is staffed in 0.1.0, and loops have an exact contract"
---
# L-0025 · The careful lane is staffed in 0.1.0, and loops have an exact contract

## Context

Tracing one careful-lane feature from drafting through release, after L-0024, exposed two gaps in the core flow:
- **The careful lane had no author for two of its artifacts.** It shipped in 0.1.0 needing a definition with acceptance items and independent tests pinned before the build. But the only reference agents in 0.1.0 were the builder and the judge; the shaper arrived in 0.1.x (CP-0028), and no card wrote independent tests.
- **The loop format was too thin for a build contract.** It named five step kinds but not how a step names its agent card, inputs and outputs, how a route reads the gate's verdict, or what the assignment and result records hold.

## Decision or event

The Owner approved fixing both:
1. **CP-0022 ships four cards in 0.1.0:**
   - the **shaper** writes definitions, with the skill `write-a-definition`
   - the **test writer** writes independent tests from the approved definition alone, with the skill `write-independent-tests`; it is a separate definition from the builder's, so its tests count as `different-definition`
   - the **builder**
   - the **judge**

   The test writer gets an activation test like the judge. CP-0028 keeps the verifier and the "stop and escalate" skill in 0.1.x. R-012 is updated.
2. **Contracts §14 defines loops:**
   - the fields and step kinds
   - inputs, outputs and targets (`done`, `stop`, `fix`, a step)
   - the assignment and result records
   - the static checks
   - worked `define` and `build` loops for the `minimal` pack

   CP-0020 ships the station loops `define`, `build` and `verify`, plus the shared `fix` loop. Tech spec §11 points to the contract.

## Evidence

The lifecycle walkthrough written after applying L-0024, in the session of 2026-11-23.

## Consequences

- The 0.1.0 careful lane runs end to end with reference agents: shaper, then the Owner's approval, then the test writer and pinning, then the builder, then the judge. CP-0020's proving exercises exactly that path.
- No change to the vision or to alpha.0.
