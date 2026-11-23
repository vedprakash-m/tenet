---
id: L-0007
kind: decision
date: 2026-11-22
packet: CP-0001
title: "M0 documents revised after four adversarial reviews: a small core, a verified slice first"
---
# L-0007 · M0 documents revised after four adversarial reviews: a small core, a verified slice first

## Context

Before ratification the Owner asked for adversarial reviews of the vision, PRD, tech spec, UX spec and plan. Four independent reviews (Claude, Copilot, ChatGPT, Gemini) agreed on the direction and on the main risks: too much ceremony for a first release; evidence, approvals and human gates that an agent could forge in host-driven mode; holdout scenarios stored where builders can read them; git state that conflicts across parallel branches; a candidate digest invalidated by its own bookkeeping; no read model for other interfaces; a solo-Owner model; no cost or stability metrics; and reliance on LLM critics. Six concrete defects they reported were confirmed in the repository. The Owner asked for all good recommendations to be adopted without making Tenet slow or hard to build.

## Decision or event

Vision, PRD, tech spec, UX spec and plan revised to version 0.2 on these decisions:

1. A normative core of at most 500 lines plus packs and bindings; `minimal` (six stations, lanes express, quick, standard) is the default pack; the thirteen-station process becomes the `software-standard` pack at M2.
2. Every rule declares its guarantee level (advisory, detected, enforced) per execution mode; nothing claims more than it can enforce.
3. Events, one immutable file each, are the source of truth; `packet.yaml` keeps only fixed fields; generated views are not committed on branches.
4. Collision-free packet IDs; existing `CP-0001`…`CP-0014` stay valid.
5. Checks are pinned in the profile; the CI verifier is the evidence authority; local receipts are advisory.
6. Human decisions are signed commits answering durable decision requests; unsigned decisions are advisory.
7. Builders cannot write the verification surface; holdout may be external; the Rule of Two applies to every run.
8. Critics run after deterministic checks, cite locatable evidence or a named omission, use a different model family where one exists, and run only where the lane calls for them.
9. Open formats are reused where they fit: `AGENTS.md`, agent skills, CloudEvents envelopes, JUnit and CTRF reports, git signing. The loop format stays the small five-kind format.
10. Tenet ships process skills and a loop library; flow is measured in accepted changes per week and hours of lead time, with DORA measures in the standard pack; every document has a size budget with archive-then-compact rollover.
11. The first release, 0.1.0 (M1), is a vertical slice gated on three projects (one external) and a red-team suite with zero accepted forgeries. Problem validation runs alongside M1 rather than before it.

Rejected to protect speed: a separate discovery milestone before M1, randomized multi-arm pilots, a new workflow language, mandatory sandboxes or vaults, five-level independence classes and quorum rules in the core.

## Evidence

The four reviews and their sources (frontier practice from OpenAI, Stripe, Spotify, StrongDM, Anthropic, Cursor and GitHub; studies of LLM judges, reward hacking and multi-agent failure; DORA and METR). Confirmed defects: CP-0001 and CP-0004 `stage` disagree with their last history entry; `skills` missing from the agent schema; `agent` missing from the escalation levels in the standard; a local path in the standard; a closed engine list in the profile schema; the station loop checks convergence before required human judgment and resets rounds.

## Consequences

New packets CP-0015 (core carve-out and kit fixes), CP-0016 (problem validation), CP-0017 (feasibility spike) for M0, and CP-0018 to CP-0024 for M1. CP-0001 now needs CP-0015 and CP-0017 before ratification. Supersedes L-0003's "Conductor first": engine adapters are chosen at M3. L-0002 and L-0005 still hold.
