---
id: L-0042
kind: decision
date: 2026-11-26
packet: CP-0068
title: "Fixes from the second dogfood ship in 0.2.0; no 0.1.2"
---
# L-0042 · Fixes from the second dogfood ship in 0.2.0

## Context

The Owner repeated the dogfood run on the same private project with 0.1.1. This time a medium model ran it, blind to round 1, acting as a new user. It logged 21 entries: 2 blockers, 6 major problems, 2 minor problems, 2 docs gaps and 9 things that worked well. Seven round 1 fixes held up. Both blockers come from one gap: the drafting skill doesn't state the specification front matter, and `check`, `fix`, `onboard --card` and `bless` each judge front matter differently. As a result, blessing can't finish when an agent guesses the shape wrong. Actions didn't start on the account, so the hosted proof card was again not seen. The project's content is private and is not recorded here.

## Decision or event

1. **There is no 0.1.2.** The fixes from the second run ([CP-0068](../packets/CP-0068-dogfood-fixes-0.2.0/definition.md)) ship in **0.2.0**, together with the protect milestone. That milestone is the plan's 0.1.0-alpha.1 ([L-0040](L-0040-launch-decisions.md)).
2. **Round 1 items that L-0041 deferred "for 0.1.2" now target 0.2.0.**
3. **0.1.1 stays the current release until 0.2.0.** Its blessing path is known to fail when the front matter is missing or invented.

## Evidence

The Owner's decision of 2026-11-26. The coordinator advised shipping the front-matter fix alone as 0.1.2 first; the Owner chose a single release. The findings log stays outside this repository.

## Consequences

- L-0041's condition for announcing Tenet (a repeat run that passes, with a real proof card) now applies to 0.2.0.
- The two false blocks found (R2-15, R2-18) must be fixed before 0.2.0's rules can block. Otherwise they count against the backtest's limit of 2 false blocks per 100 pull requests.
- The next dogfood run tests 0.2.0.
