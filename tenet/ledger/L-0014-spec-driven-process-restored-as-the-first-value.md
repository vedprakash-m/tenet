---
id: L-0014
kind: pivot
date: 2026-11-23
packet: CP-0001
title: "The spec-driven process is restored as Tenet's first value"
---
# L-0014 · The spec-driven process is restored as Tenet's first value

## Context

Tenet began as a spec-driven development process for software factories (`design/origin/process.md`): a ladder of levelled documents with owners, governed change to them, traceability from vision to evidence, and escalation to the level that can resolve a conflict. Over seven review rounds every reviewer attacked the trust mechanics, and each fix added them; DEC-18 placed spec tools beside Tenet rather than inside it; and the kernel restructure (L-0012) turned requirements into claims without keeping the ladder anywhere. By v0.8 the vision and PRD no longer described the spec process at all, and `kit/TENET.md`, the only living description of it, had been marked superseded (L-0013). The Owner noticed this: it is the drift from intent that Tenet exists to prevent.

This repository is the evidence for the process's value: it has worked under the ladder for weeks with no CLI, CI verifier or signatures.

## Decision or event

The Owner approved restoring it:

1. Vision: the purpose names the method, and a new principle V-P18 says specifications are the source of truth and code follows them.
2. PRD: Tenet is positioned as a spec-driven development standard (DEC-39, amending DEC-18); a new §4.0 holds the spec process (R-207 document ladder, R-208 ownership gradient, R-209 governed spec change, R-210 requirements and traceability, R-211 agents work from the specifications), with R-008, R-011, R-033 and R-036 moved beside them. The PRD exceeded its budget, so §4.4–§4.5 moved to `specs/prd/tooling.md` under the rollover rule, IDs unchanged.
3. Catalog: specification document (R-212) and spec change (R-213).
4. Tech spec §6.3: the default ladder, who changes and approves each level, the deltas format and the checks. UX: the board shows the specifications; `init` starts with intent; agents are told which levels apply.
5. Plan: **0.1.0-alpha.0, the spec kit**, ships first and needs no CI (CP-0004, CP-0005, CP-0006, CP-0009, CP-0010, CP-0012, new CP-0044). Part I of the standard opens with the spec process. CP-0016 asks how intent reaches agents today.
6. `kit/TENET.md` §3 and §9–§11 stay authoritative until CP-0015.

## Evidence

The Owner's observation of 2026-11-23; a comparison of `process.md` and `kit/TENET.md` §3, §9–§11 with vision v0.8 and PRD v0.8.

## Consequences

Order of value: the spec process, then verified evidence, then factory governance. Reviews must check the spec process as well as the trust mechanics (RK-17).
