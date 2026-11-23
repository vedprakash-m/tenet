---
id: L-0037
kind: decision
date: 2026-11-23
packet: CP-0058
title: "Medium-model trial accepted on byte parity (E-0002)"
---
# L-0037 · Medium-model trial accepted on byte parity

## Context

CP-0058 ran six rounds. Rounds 4 and 5 gave byte-identical machine results from two fresh sessions. Round 6 diverged on a wording change made in round 5, which was then fixed. Fresh sessions still log six to nine small defensive questions per round. Escalation E-0002 asked the Owner to define done as byte-identical results with no divergent inventions.

## Decision or event

The Owner accepted E-0002 on 2026-11-23:
- CP-0058 is done.
- Checklist item 5's "done" now means byte-identical machine results, with no invention that changes behavior between the two sessions.
- CP-0044's build, checked against 46 independent conformance cases, serves as the confirmation instead of a round 7.

## Evidence

`tenet/packets/CP-0058-medium-model-trial/evidence/scorer-log.md`, `escalations/E-0002.md`, and the Owner's answer in the session of 2026-11-23.

## Consequences

- Every M0 checklist item holds except Owner ratification. CP-0001 is ready for the Owner.
- Later trials (the alpha.1 evaluator trial) use the same definition of done.
