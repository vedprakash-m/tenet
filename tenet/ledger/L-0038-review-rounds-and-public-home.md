---
id: L-0038
kind: decision
date: 2026-11-24
packet: CP-0039
title: "Loops iterate until agreement or N rounds (default 5); Tenet's home is public; code health is shaped by three model families"
---
# L-0038 · Review rounds, public home, and how code health is shaped

## Context

- **Rounds.** The define and build loops (tech-spec/agents.md §5) capped fix rounds at 2, then sent the work to a person. The Owner wants critics and creators to converge where they can.
- **Home.** The private repository ran out of included Actions minutes. Its history also carried a work email and an internal package-feed URL, and GitHub keeps every pull request's original commits.
- **Code health.** It is a critical feature and the first one to go through the idea, review, implement and validate cycle. The cycle runs by hand until the 0.1.0 runner exists. A research report on low-friction code health is in [CP-0039's evidence](../packets/CP-0039-health-indicators-and-ratchet/evidence/research-code-health.md).

## Decision or event

1. **Loops stop at agreement or at `limits.rounds`, whichever comes first.**
   - Agreement means the critic step returns no blocking finding.
   - `limits.rounds` defaults to 5 (was 2), and `tenet.yaml` may lower it.
   - `limits.steps` defaults to 40 (was 20), so five rounds fit.
   - Applied to tech-spec/agents.md §5 and tech-spec.md.
2. **Tenet's home is the public `vedprakash-m/tenet`, created from rewritten history.**
   - Every commit is now `Ved Mishra <vedprakash.m@me.com>`.
   - The feed URL is replaced by the public npm registry.
   - The old repository, with pull requests #1–#37, is the private `vedprakash-m/tenet-private`.
3. **Code health (CP-0039, with the changed-line and mutation parts of R-227 and CP-0036 as needed) is shaped by three model families.**
   - The Owner chose this because code health is a critical feature.
   - Gemini shapes, and GPT and MAI review as read-only critics.
   - Rounds run until both critics return no blocking finding, or five rounds pass.
   - The Owner then approves, revises or stops.

## Evidence

- The Owner's messages of 2026-11-24.
- Public pull requests #1 (CI runs once per pull request) and #6 (CP-0010 rulings).
- The research report above.

## Consequences

- **Retries:** the research found that more retries raise agents' rate of gaming checks. The higher round limit therefore relies on read-only critics, pinned tests and evidence-based gates staying in place.
- **Scope freeze (DEC-38):** code health stays scheduled for 0.1.x. Shaping it now produces a definition and proposed spec changes; building it follows the plan's order unless the Owner moves it.
