---
id: L-0032
kind: decision
date: 2026-11-23
packet: CP-0015
title: "Decisions on Track 1's kernel and contracts"
---
# L-0032 · Decisions on Track 1's kernel and contracts

## Context

Track 1 (CP-0015, branch `m0/track-1-kernel`) submitted:
- Part I of `kit/TENET.md` (32 provisional rules)
- `tech-spec/kernel.md`
- all eight contract fields for the alpha.1, alpha.2 and 0.1.0 packets
- the four R-009 reference cases and the evaluator-trial fixture

It also raised open decisions and 13 proposals for files outside its scope.

## Decision or event

The Owner decided:
1. **0.1.x contracts come later.** Point-release packets stay as planning rows. Each gets its full eight-field contract from a capable model while 0.1.0 is being built, and none is dispatched without one.
2. **Five technical choices, as recommended:**
   - The rule `acceptance-proven` is renamed `acceptance-passed` everywhere (results never say "proven").
   - Merge queues: alpha.1 records merge-queue candidates; alpha.2 verifies the exact candidate before publishing its status; full merge-queue evidence and quarantine ship in 0.1.x.
   - `tenet close` ships in 0.1.0; alpha.2 replay may compute closure internally.
   - Alpha.1's overhead gate is the average active Tenet minutes per pull request across the fixed 100-PR backtest, counting zero-work cases. Incomplete timing reports incomplete coverage.
   - When the gate blocks, its result also names the blocking action: the earliest enforcing match, by row and then claim ID.
3. **This repository's profile:** Track 1's `proposed-tenet.yaml` is approved and is applied once CP-0003 provides the real check commands. The old stop rules map to `stop.failing_evaluations`; wip limits, release stages and the other old fields are retired.

## Evidence

Track 1's report and proposals (`tenet/packets/CP-0015-*/escalations/proposals.md`), and the Owner's answers in the session of 2026-11-23.

## Consequences

- When the tracks are merged, Track 1's proposals 1–13 are applied with these choices: proposal 4 uses `acceptance-passed`, proposal 9 the "later" wording, and proposals 10–13 as written.
- Part of the rename lands in files Track 2 owns (ci.md, contracts), so it is applied after Track 2 merges.
