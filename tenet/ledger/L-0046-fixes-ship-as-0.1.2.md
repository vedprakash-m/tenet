---
id: L-0046
kind: decision
date: 2026-11-28
packet: CP-0068
title: "The CP-0068 fixes ship as 0.1.2; 0.2.0 stays the protect release"
---
# L-0046 · The CP-0068 fixes ship as 0.1.2

## Context

[L-0042](L-0042-second-dogfood-rolls-into-0.2.0.md) said there would be no 0.1.2: the fixes from the second dogfood run would ship in 0.2.0 together with the protect milestone (the plan's alpha.1). CP-0068 is now complete on main, with its specification text approved ([L-0044](L-0044-group-e-proposals-approved.md), [L-0045](L-0045-cp-0068-spec-text-approved.md)) and CI green on three operating systems. The protect milestone has not started. Until it ships, 0.1.1 is the current release, and its blessing path fails when a draft's front matter is missing or made up.

## Decision or event

1. **The CP-0068 fixes ship now as 0.1.2.** This replaces part 1 of L-0042.
2. **0.2.0 stays the protect release,** as the plan describes.

## Evidence

The Owner's reply of 2026-11-28: "Ship fixes as 0.1.2". The coordinator recommended this, because the round 2 blockers are fixed and protect has not started.

## Consequences

- 0.1.2 is released from main with the usual steps: the starter is pinned to the integrity of the tarball the release workflow builds on Linux, then the Owner tags and publishes.
- L-0041's condition for announcing Tenet (a repeat run that passes, with a real proof card) applies to the next dogfood run, which tests 0.1.2.
- The packet folder keeps its name (`CP-0068-dogfood-fixes-0.2.0`); its release notes are `release-notes-v0.1.2.md`.
