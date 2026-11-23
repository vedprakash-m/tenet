---
id: L-0036
kind: milestone
date: 2026-11-23
packet: CP-0058
title: "Round 2 merged: alpha.0 waves A0-1 and A0-2 built, trial byte-identical, ALG-08 moved"
---
# L-0036 · Round 2 merged

## Context

Round 2 ran four tracks from `main` at `1225d8d`, each on its own branch and worktree:
- **MAI Code 2:** finish CP-0004 and build CP-0018
- **GPT:** independent review of round 1's builds, then independent conformance cases for CP-0044, then fixes from its own review
- **Gemini:** `messages.md` and trial rounds 4–6
- **MAI Code 2 Flash:** the backtest dataset

## Decision or event

- **Merged** through pull requests #1, #2 and #3 on `vedprakash-m/tenet`, each after CI.
  - #1 and #2 passed on Linux, Windows and macOS.
  - #3 changed only specifications and was merged after Linux and Windows passed, while macOS runners were queued at GitHub.
- **Waves A0-1 and A0-2 are built:** CP-0003, CP-0004, CP-0005, CP-0006, CP-0012 and CP-0018. GPT reviewed round 1's builds against their contracts and found four blockers:
  - the coordinator fixed two: draft front matter, and the kit test suite
  - GPT fixed the other two: the examples check, plus Unicode and observe-fallback issues
  - the coordinator registered `pack` and `agent-card` with the validator, an ownership gap in the round 2 prompt
  - critics' cards need no `outputs.writes` (agents.md §1)
- **One test** depended on this repository's own test files and failed once another track added sample tags. It now runs in a clean temporary repository; the scanner was right under ALG-09.
- **Trial (CP-0058):**
  - Rounds 4 and 5 were byte-identical (25,818 bytes each) once `messages.md` gave the text for every error code.
  - Round 6 diverged on a round-5 wording change; Gemini fixed it, then stopped under the stop rule. Escalation E-0002 asks the Owner to accept "byte-identical results and no divergent inventions" as done.
  - Gemini's session hit its quota before committing its last fixes; the coordinator committed them unchanged.
- **CP-0044's six questions** are answered ([answers-r2.md](../packets/CP-0044-spec-ladder/escalations/answers-r2.md)) and applied to ALG-02, ALG-03, ALG-04, ALG-14 and its contract. Its proving now runs the independent suites.
- **ALG-08 moved** to evidence.md §3 under the rollover rule: applying the answers put algorithms.md at 92% of its budget.

## Evidence

Pull requests #1–#3 and their CI runs; the round 2 reviews in each packet's `evidence/review-r2.md`; CP-0058's `scorer-log.md` and `E-0002.md`; on `main`: 98 tests pass, plus lint, the examples check, links and budgets.

## Consequences

- **The Owner:** decide E-0002, which closes checklist item 5; then CP-0001 ratification is the last M0 step.
- **Next build:** CP-0044 (wave A0-3), then CP-0009, CP-0045 and CP-0053 (A0-4).
- **Independent conformance cases** for A0-4 are written in parallel, apart from their builders.
