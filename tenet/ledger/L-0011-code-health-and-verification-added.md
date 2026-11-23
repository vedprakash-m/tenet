---
id: L-0011
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Code health and verification added: continuing obligations, health ratchet, method list, proof evidence"
---
# L-0011 · Code health and verification added

## Context

The Owner asked how leading organizations keep code healthy and verify it, and whether code health is part of preventing drift from intent. Four reviews agreed that it is: agent-written code duplicates more and survives less, about half of test-passing agent pull requests would not be merged as is, generated tests often assert what code does rather than what it should do, and AI-written proofs can cheat. They found that Tenet protected only the pinned tests of open packets, read suite passes as evidence for specific claims, treated anything outside the diff as safe, counted a located quote as a confirmed finding, mixed what is assessed with how, accepted baselines that failed in the harness, and had no notion of code health, baselines or proof evidence.

## Decision or event

Vision, PRD (with its factory-and-fleet part) and plan revised to 0.6, tech and UX specs to 0.5:

1. Drift has three forms: intent, design, verification. New value for maintainers (V-V10), principle that kept promises and health only ratchet forward (V-P17), and headline metric V-M10.
2. **Continuing obligations** through the requirement registry: closing a packet promotes its preservation items; proving cases of built requirements are protected (DEC-28, R-170).
3. Receipts name kind, dimension and method, and list the cases expected, executed and passed; acceptance items map to cases and declare a claim class, method and pass rule; methods have completion rules.
4. Findings are introduced, exposed, inherited or uncertain, and located or substantiated.
5. Distinguishing baselines must fail as expected; measurements may compare against a baseline.
6. Health indicators with a ratchet on the touched scope and a forge-verified exception (DEC-29); architecture rules; health in readiness and leading circuit breakers; checks with owners and, later, a lifecycle; durability.
7. One list of methods and evidence strengths; packs set minimums per claim class (DEC-30).
8. Proof, simulation and differential evidence, with an audit of what proofs rely on and protected theorem statements.
9. Configuration, data and flags as subjects with the same risk rules.
10. Tenet's own evaluator verified in stages (DEC-31).

New 0.1.x packet CP-0039; 0.1.0 gains fields, schema kinds and verifier rules in existing packets only.

## Evidence

The four reviews and their sources: Google (Tricorder, mutation testing at scale, flaky tests, code-quality and productivity studies), Meta (TestGen-LLM, ACH, predictive test selection), OpenAI (harness engineering, benchmark audit), Uber (AutoClean, flaky tests), Stripe (Sorbet, evaluations), AWS (Cedar, ShardStore), SQLite, FoundationDB, TigerBeetle, seL4, METR, GitClear, and formal-verification benchmarks.

## Consequences

CP-0015, CP-0004, CP-0007, CP-0012, CP-0014, CP-0016, CP-0018, CP-0021, CP-0025, CP-0035 and CP-0036 grow in scope.
