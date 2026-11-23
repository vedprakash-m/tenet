---
id: L-0010
kind: decision
date: 2026-11-22
packet: CP-0001
title: "Specs revised after comparison with leading organizations' factories: proof table, decision-time snapshots, campaigns, readiness"
---
# L-0010 · Specs revised after comparison with leading organizations' factories

## Context

The Owner asked how software factories run at Anthropic, OpenAI, Uber, Stripe, Palantir and other organizations that use AI heavily, and where Tenet falls short. Four reviews (Claude, Copilot, ChatGPT, Gemini) agreed that Tenet's trust spine leads every public factory, and that it lacked the factory-scale parts these organizations depend on: campaigns over many targets, work types with their own outcome units, readiness before autonomy, review capacity, ownership by area, delegation chains, environments, tool scoping, merge queues, flaky-test handling, partial outcomes in production, and cost per outcome. They also found defects in v0.4: unclear proof strength across channels and a hardware-key default that would block adoption; evidence judged at the wrong moment; a scope-changing decision option that approved the old definition; evidence that could satisfy the wrong claim; an unproven exclusive writer for the evidence store and colliding concurrent writers; a check job able to tamper with itself; gaps in the protected set; overlap between the profile and the factory definition; and contradictions between documents.

## Decision or event

Vision and PRD revised to 0.5, tech spec and UX spec to 0.4, plan to 0.5:

1. **Proof table** for decisions with strengths `person-present`, `forge-verified`, `key` and `channel`; `forge-verified` (a pull-request review by a listed owner whose organization enforces two-factor authentication) is the default, and `person-present` is required for policy, permission and vision changes (DEC-23). OQ-06 closed.
2. **Decision-time snapshots**: every gate evaluation records the policy, evidence-store and trust-observation revisions it used; replay uses them.
3. Scope-changing options return to Define or carry the new definition; acceptance items declare their method and evidence kind; reviews mark findings `pre-existing` or `confirmed`.
4. Check-job tamper detection, evidence-store retry with a fallback binding, a wider protected set with lockfile flagging.
5. **Two configuration planes**: `tenet.yaml` governs; optional `factory.yaml` describes execution (DEC-24). OQ-08 closed. Factory changes state a purpose: improvement, mandatory replacement, containment or restoration.
6. **Fleet and capacity**: campaigns with one decision for in-scope children (DEC-25), work types, readiness and admission, areas, approvals by risk (DEC-26), change-size limits, review queue, reviewer metrics, circuit breakers.
7. **Operations**: merge-queue verification, governed flaky-test quarantine, outcome statuses per region or cohort, hotfix and heal, cleanup sweeps, environment services and twins, telemetry retention.
8. **Measurement**: attribution definitions behind autonomy share, funnels and cost per outcome unit, usage detail and actor chains in run records, trust tags on assignment inputs.
9. **Scale tiers** from git files to an external store under the same contracts; the vision no longer requires a particular store.
10. Kept outside Tenet (DEC-27): judging whether an action fits its intent, model-based risk prediction, and building context graphs, tool gateways or sandboxes.

The PRD neared its budget, so §4.11–4.12 moved to `specs/prd/factory-and-fleet.md` under the rollover rule: the first use of Tenet's own split procedure.

0.1.0 gains only fixes, fields and gate rules, with no new packets; new 0.1.x packets CP-0033 to CP-0038; M2 and M3 gain the rest.

## Evidence

The four reviews and their sources, including primary accounts from Anthropic (internal use, Code Review, agent autonomy, source control), OpenAI (harness engineering, Performance Factory, Symphony), Stripe (Minions, evaluations), Uber (software factory economics, uReview, agent identity), Palantir (AI FDE, AIP Evolve), Microsoft, Meta, Google, Airbnb, Ramp and Spotify.

## Consequences

CP-0015, CP-0016 and CP-0017 grow in scope (proof table, snapshots, two planes and outcome vocabulary in Part I; evidence-cost and case types in validation; evidence-store exclusivity, forge-verified checks and tamper detection in the spike). Supersedes L-0008's default of `person-present` for all reserved decisions.
