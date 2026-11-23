---
id: L-0009
kind: decision
date: 2026-11-22
packet: CP-0001
title: "The factory definition becomes part of the standard; Tenet declares and governs it, platforms run it"
---
# L-0009 · The factory definition becomes part of the standard

## Context

The Owner asked whether Tenet has parity with Warp Factories (launched 18 August 2026) and other leading factory implementations. Warp declares a factory as files rooted at `factory.yaml`: workers with models or harnesses, automations triggered by forge events, schedules and signed webhooks, runners with images, network policy and secrets per worker, model routers, tool servers, skills, scorers on sampled runs, benchmarks comparing up to six configurations, and self-improvement that proposes fixes as pull requests. A foreman agent works with people in chat and trackers. Its own documents say its gates are prompts that do not enforce permissions, its reviews are advisory, routing is decided by the foreman reading prose conditions, and the factory stops at the pull request. Symphony, Stripe's Minions, StrongDM and GitHub's agentic workflows likewise centre triggers, environments and dispatch.

Tenet v0.3 was ahead on enforced trust, rule-based routing, neutrality and the lifecycle beyond the pull request, but its vision did not say how a factory is declared, what starts its work, where and as whom it runs, how it reaches people, how its runs are scored and compared, or how the factory itself is improved.

## Decision or event

Vision and PRD revised to version 0.4 (plan to 0.4; tech spec one line):

1. The factory definition (workers, triggers, environments, identities, routing, channels, scoring, comparison) is part of the standard. Tenet declares, validates, records and governs it; engines and platforms execute it (DEC-21).
2. Changes to the factory are `factory` packets, adopted on comparison evidence from M2 (DEC-22, V-P14).
3. Every run records on whose behalf it acts, its credential policy, environment, harness and model (V-P15, R-124, in 0.1.0).
4. New values for factory operators and for people working in their usual channels; decision requests reach the pull request in 0.1.x and chat and trackers at M2, at the strength each channel can prove.
5. Autonomy share becomes headline metric V-M9, always shown beside escapes.
6. V-H4 covers the factory definition as well as agents; V-H5 requires a factory platform not built by the steward among the conforming implementations.
7. A published mapping from Warp Factories (and a Symphony-style dispatcher) to Tenet, with a worked conformance claim, is the first platform conformance target (R-131).

New packets CP-0031 (factory definition and the Warp mapping) and CP-0032 (decisions on pull requests and visual evidence) for 0.1.x; CP-0020 gains R-124. Triggers, chat channels, sampled scoring, comparison and governed knowledge are M2; routing applied by adapters and local-agent hand-off are M3.

## Evidence

Warp Factories documentation (overview, factory as code, how factories work, blueprints, infrastructure and security, factory agents), TechCrunch's launch coverage, and the `warpdotdev/oz-for-oss` repository, read on 2026-11-22.

## Consequences

CP-0015 adds the `factory` packet type and a factory-definition section to the core. The tech spec and UX spec gain the factory-definition details when CP-0031 is shaped. Risk RK-12 (drifting into building a platform) is mitigated by DEC-21.
