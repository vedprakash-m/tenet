---
id: L-0029
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Two tracks, no calendar waits"
---
# L-0029 · Two tracks, no calendar waits

## Context

The estimate of 4–5 months to reach 0.1.0 came almost entirely from waits built into the plan, not from building. Building is roughly 250–350 agent-hours of bounded packets. The waits were:
- each release's gate required real use (about 100 changes; 3 or 5 verified changes; outside maintainers' sessions)
- the vision was ratified twice, a day apart
- spike, kernel and trial time boxes were read as durations
- the Owner approved each packet separately
- each later release's contracts were written only after the previous one shipped

## Decision or event

The Owner approved the fast track (DEC-57):
1. **Two tracks.**
   - The **build track** is gated only by automatic checks: tests on three platforms, scenario and evaluation suites, sandbox runs, the packed install, and backtests.
   - The **evidence track** (outside maintainers, verified changes here and on Torus, interviews, pilots) runs alongside. It gates announcing a release and claiming a horizon, never building the next release.
2. **Backtests replace waiting for use.** Alpha.1's false-block and overhead measures come from replaying 100 past pull requests.
3. **No waits based on time.** This project's vision is ratified once, with a second read in the same sitting. Time boxes are limits in hours (spikes 4, kernel 12, trial 6).
4. **Front-loading.**
   - All four spikes run at once on day 1; Spike D (CP-0056) moves from GA to M0.
   - CP-0015 writes every release's contracts before building starts.
   - Bootstrap may start while the trial runs.
5. **Per-wave approval.** A capable model reviews each packet as it lands; the Owner approves once per wave.
6. **Snapshots.** Alpha releases are published when their build gate is green.

**Plan v0.14** adds §0, "Status and next actions", which is kept current so work can be handed to other models.

## Evidence

The Owner's request in the session of 2026-11-23, and the breakdown of build effort against waits in the same session.

## Consequences

- **Estimated timing:**
  - M0: 1–2 days, plus the Owner's decisions
  - alpha.0: about 3–5 days of building
  - through 0.1.0: about 2 weeks of building
  - evidence: runs in parallel
- **Packets:** CP-0056's and CP-0024's dependencies change, and CP-0014 leaves the 0.1.0 build path.
- **Unchanged:** the vision.
