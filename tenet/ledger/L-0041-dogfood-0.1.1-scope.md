---
id: L-0041
kind: decision
date: 2026-11-26
packet: CP-0066
title: "0.1.1 scope from the first dogfood; anchors keep hashes only"
---
# L-0041 · 0.1.1 scope from the first dogfood

## Context

The Owner ran 0.1.0 on a private existing project as a typical new user, before announcing Tenet. The run logged 58 findings: 3 blockers (install behind a blocked registry, blessing that can't be finished, agent context that misses the matching section), 33 rough edges and 22 polish items. The proof card was not seen, because Actions could not run on the account and there is no local preview. The project's content is private and is not recorded here.

## Decision or event

1. **0.1.1 fixes five groups** ([CP-0066](../packets/CP-0066-dogfood-0.1.1/definition.md)): blessing can be finished; agents get the right context and find the skills; the test check works from day one and locally (`verify --local`); install, help and docs; and the path to the release (same-version `upgrade`) plus privacy.
2. **Anchors keep hashes and line ranges only (F-47).** Blessing no longer copies cited source text into the repository. Old text, when needed, comes from git history; without it, Tenet shows the changed range.
3. **Deferred:** `doctor` reading workflow runs (F-39), because R-080 doesn't allow that network call; a testable-statement kind (F-51) and budgets for large spec sets (F-23), which go with an "adopt" onboarding mode as a proposal for the standard; and the polish items listed in CP-0066.
4. **Work is split across four model tracks**, with independent scenarios for groups A to C written by a track that isn't building them.

## Evidence

The Owner's approval of 2026-11-26. The findings log and evidence stay outside this repository.

## Consequences

- The Owner announces Tenet after 0.1.1 ships and a repeat run on the same project passes, with a real proof card.
- The deferred items are tracked for 0.1.2 and for the standard's next proposals.
